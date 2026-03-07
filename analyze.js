#!/usr/bin/env node
/**
 * DOM-CSS Analysis Tool
 *
 * Scans src/ for CSS, HTML, and JS files. Produces a report covering:
 *   1. Summary metrics
 *   2. Elements without CSS classes (HTML + JS)
 *   3. Unused CSS classes (defined but never referenced)
 *   4. Undefined classes (referenced but never defined)
 *   5. Inline style violations
 *   6. Approximate DOM tree (L3–L7)
 *   7. Class usage map (flat list by file)
 *
 * Zero external dependencies beyond jsdom (already in devDependencies).
 */
import fs from "node:fs";
import path from "node:path";

// ─── Configuration ───────────────────────────────────────────────────────────

const SRC_DIR = "src";
const REPORT_FILE = "analysis_report.md";

const LAYOUT_PROPS = new Set([
  "display",
  "grid-template-columns",
  "grid-template-rows",
  "grid-template-areas",
  "gap",
  "column-gap",
  "row-gap",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "width",
  "height",
  "position",
]);

const IGNORE_HTML_TAGS = new Set([
  "html",
  "head",
  "meta",
  "link",
  "script",
  "style",
  "title",
  "noscript",
  "body",
  "!doctype",
]);

// ─── File Scanner ────────────────────────────────────────────────────────────

function findFiles(dir, extensions) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, {
      recursive: true,
      withFileTypes: false,
    });
    for (const entry of entries) {
      const full = path.join(dir, String(entry));
      if (
        extensions.some((ext) => full.endsWith(ext)) &&
        !full.includes("node_modules") &&
        !full.includes("dist")
      ) {
        results.push(full);
      }
    }
  } catch {
    /* dir missing */
  }
  return results.sort();
}

// ─── CSS Parser ──────────────────────────────────────────────────────────────

function parseCss(files) {
  /** @type {Map<string, Array<{file:string, line:number, selector:string, layout:Record<string,string>}>>} */
  const classes = new Map();

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    // Preserve newlines so line counts stay correct; blank out comment content
    const content = raw.replace(/\/\*[\s\S]*?\*\//g, (m) =>
      m.replace(/[^\n]/g, " "),
    );

    // Remove @keyframes blocks (they don't define class selectors)
    const noKf = content.replace(
      /@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g,
      (m) => m.replace(/[^\n]/g, " "),
    );

    // Remove @import lines (url paths like './variables.css' would be false positives)
    const noImport = noKf.replace(/@import\s+[^;]+;/g, (m) =>
      m.replace(/[^\n]/g, " "),
    );

    // Match rule blocks: selector { declarations }
    const ruleRe = /([^{@}][^{]*?)\s*\{([^{}]*)\}/g;
    let m;
    while ((m = ruleRe.exec(noImport)) !== null) {
      const selectorText = m[1].trim();
      if (!selectorText || selectorText.startsWith("@")) continue;

      const bodyText = m[2];
      const line = content.substring(0, m.index).split("\n").length;

      // Extract layout properties
      const layout = {};
      const declRe = /([\w-]+)\s*:\s*([^;]+)/g;
      let d;
      while ((d = declRe.exec(bodyText)) !== null) {
        const prop = d[1].trim();
        if (LAYOUT_PROPS.has(prop)) layout[prop] = d[2].trim();
      }

      // Extract class names from selector
      const classRe = /\.([a-zA-Z_][\w-]*)/g;
      let c;
      // Find the primary (target) classes: only from the LAST segment after combinators
      // e.g. ".card-header > :first-child" → target segment is ":first-child" (no classes)
      // e.g. ".card-body:has(> .btn-select)" → target segment is ".card-body:has(…)"
      // Skip pseudo-element selectors (::before, ::after) — layout is for the pseudo, not the element
      const hasPseudoElement = /::/.test(selectorText);
      const segments = selectorText.split(/\s*[>+~]\s*|\s+/).filter(Boolean);
      const lastSegment = segments[segments.length - 1] || "";
      const targetClasses = hasPseudoElement
        ? new Set() // pseudo-element layout doesn't apply to the element itself
        : new Set(
            [...lastSegment.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((x) => x[1]),
          );

      while ((c = classRe.exec(selectorText)) !== null) {
        const cls = c[1];
        if (!classes.has(cls)) classes.set(cls, []);
        // Only attribute layout properties to the target (last-segment) class
        const entryLayout = targetClasses.has(cls) ? layout : {};
        classes.get(cls).push({
          file: shortPath(file),
          line,
          selector: selectorText,
          layout: entryLayout,
        });
      }
    }
  }
  return classes;
}

// ─── HTML Parser ─────────────────────────────────────────────────────────────

function parseHtml(files) {
  /** @type {Array<{file:string, line:number, tag:string, classes:string[], id:string, depth:number}>} */
  const elements = [];
  /** @type {Array<{file:string, line:number, code:string}>} */
  const inlineStyles = [];

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    // Simple tag-based parser (sufficient for well-formed HTML)
    const tagRe = /<(\/?)([\w-]+)([^>]*)>/g;
    let depth = 0;
    let m;
    while ((m = tagRe.exec(content)) !== null) {
      const isClosing = m[1] === "/";
      const tag = m[2].toLowerCase();
      const attrs = m[3];

      if (IGNORE_HTML_TAGS.has(tag)) continue;

      if (isClosing) {
        depth = Math.max(0, depth - 1);
        continue;
      }

      const lineNum = content.substring(0, m.index).split("\n").length;

      // Extract classes
      const classMatch = attrs.match(/class\s*=\s*"([^"]*)"/);
      const classes = classMatch
        ? classMatch[1].split(/\s+/).filter(Boolean)
        : [];

      // Extract id
      const idMatch = attrs.match(/id\s*=\s*"([^"]*)"/);
      const id = idMatch ? idMatch[1] : "";

      // Inline style check
      if (/style\s*=\s*"/.test(attrs)) {
        inlineStyles.push({
          file: shortPath(file),
          line: lineNum,
          code: m[0].trim(),
        });
      }

      const isSelfClosing =
        attrs.endsWith("/") ||
        ["br", "hr", "img", "input", "meta", "link"].includes(tag);

      elements.push({
        file: shortPath(file),
        line: lineNum,
        tag,
        classes,
        id,
        depth,
      });

      if (!isSelfClosing) depth++;
    }
  }

  return { elements, inlineStyles };
}

// ─── JS Parser ───────────────────────────────────────────────────────────────

function parseJs(files, cssDefinedClasses) {
  /** @type {Map<string, Array<{file:string, line:number, context:string}>>} */
  const classRefs = new Map();
  /** @type {Array<{file:string, line:number, tag:string, varName:string}>} */
  const elementsCreated = [];
  /** @type {Set<string>} per-file var names that get a class */
  const varsWithClass = new Map(); // file -> Set<varName>
  /** @type {Array<{file:string, line:number, code:string}>} */
  const inlineStyles = [];
  /** @type {Array<{file:string, line:number, parent:string, child:string}>} */
  const appends = [];

  function addRef(cls, file, line, context) {
    if (!classRefs.has(cls)) classRefs.set(cls, []);
    classRefs.get(cls).push({ file: shortPath(file), line, context });
  }

  function markVarWithClass(file, varName) {
    const fp = shortPath(file);
    if (!varsWithClass.has(fp)) varsWithClass.set(fp, new Set());
    varsWithClass.get(fp).add(varName);
  }

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    const fp = shortPath(file);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      // ── createElement ──
      const createMatch = line.match(
        /(?:const|let|var)\s+(\w+)\s*=\s*document\.createElement\(\s*['"](\w+)['"]\s*\)/,
      );
      if (createMatch) {
        elementsCreated.push({
          file: fp,
          line: ln,
          tag: createMatch[2],
          varName: createMatch[1],
        });
      }

      // ── className = 'literal' ──
      const cnLiteralMatch = line.match(/(\w+)\.className\s*=\s*'([^']+)'/);
      if (cnLiteralMatch) {
        for (const cls of cnLiteralMatch[2].split(/\s+/).filter(Boolean)) {
          addRef(cls, file, ln, "className");
        }
        markVarWithClass(file, cnLiteralMatch[1]);
      }

      // ── className = "literal" ──
      const cnDblMatch = line.match(/(\w+)\.className\s*=\s*"([^"]+)"/);
      if (cnDblMatch && !cnLiteralMatch) {
        for (const cls of cnDblMatch[2].split(/\s+/).filter(Boolean)) {
          addRef(cls, file, ln, "className");
        }
        markVarWithClass(file, cnDblMatch[1]);
      }

      // ── className = `template ${var}` ──
      const cnTemplateMatch = line.match(/(\w+)\.className\s*=\s*`([^`]+)`/);
      if (cnTemplateMatch) {
        markVarWithClass(file, cnTemplateMatch[1]);
        const parts = cnTemplateMatch[2].split(/\s+/).filter(Boolean);
        for (const part of parts) {
          if (!part.includes("$")) {
            addRef(part, file, ln, "className");
          } else {
            // Extract static prefix
            const prefix = part.split("${")[0];
            if (prefix) {
              // Find CSS classes that match this prefix
              for (const cssCls of cssDefinedClasses) {
                if (cssCls.startsWith(prefix)) {
                  addRef(cssCls, file, ln, "className (dynamic)");
                }
              }
            }
          }
        }
      }

      // ── classList.add/remove/toggle/contains ──
      const clMatches = [
        ...line.matchAll(
          /(\w+)\.classList\.(add|remove|toggle|contains)\(\s*'([^']+)'/g,
        ),
      ];
      for (const m of clMatches) {
        addRef(m[3], file, ln, `classList.${m[2]}`);
        markVarWithClass(file, m[1]);
      }
      // Also handle double-quoted
      const clMatchesDbl = [
        ...line.matchAll(
          /(\w+)\.classList\.(add|remove|toggle|contains)\(\s*"([^"]+)"/g,
        ),
      ];
      for (const m of clMatchesDbl) {
        addRef(m[3], file, ln, `classList.${m[2]}`);
        markVarWithClass(file, m[1]);
      }

      // ── setAttribute('class', '...') ──
      const setAttrMatch = line.match(
        /(\w+)\.setAttribute\(\s*['"]class['"]\s*,\s*['"]([^'"]+)['"]\s*\)/,
      );
      if (setAttrMatch) {
        for (const cls of setAttrMatch[2].split(/\s+/).filter(Boolean)) {
          addRef(cls, file, ln, "setAttribute");
        }
        markVarWithClass(file, setAttrMatch[1]);
      }

      // ── Inline style: element.style.X = ... ──
      const styleMatch = line.match(/(\w+)\.style\.\w+\s*=/);
      if (styleMatch && !line.includes("// ")) {
        inlineStyles.push({ file: fp, line: ln, code: line.trim() });
      }

      // ── setAttribute('style', ...) ──
      if (/\.setAttribute\(\s*['"]style['"]/.test(line)) {
        inlineStyles.push({ file: fp, line: ln, code: line.trim() });
      }

      // ── appendChild / append ──
      const appendMatch = line.match(/(\w+)\.(?:appendChild|append)\(\s*(\w+)/);
      if (appendMatch) {
        appends.push({
          file: fp,
          line: ln,
          parent: appendMatch[1],
          child: appendMatch[2],
        });
      }
    }

    // Second pass: scan for string literals matching CSS-defined classes
    // (catches indirect patterns like classMap = { x: 'btn-primary' })
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ln = i + 1;

      for (const cssCls of cssDefinedClasses) {
        // Only check classes we haven't already found via direct patterns
        if (
          classRefs.has(cssCls) &&
          classRefs.get(cssCls).some((r) => r.file === fp)
        )
          continue;

        // Look for exact string literal match
        const escaped = cssCls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const litRe = new RegExp(`['"\`]${escaped}['"\`]`);
        if (litRe.test(line)) {
          addRef(cssCls, file, ln, "string literal");
          // Only add once per file per class
          break;
        }
      }
    }
  }

  return { classRefs, elementsCreated, varsWithClass, inlineStyles, appends };
}

// ─── DOM Tree Builder ────────────────────────────────────────────────────────

function buildDomTree(htmlElements, jsData, cssClasses) {
  // Build tree from HTML elements (L3+, skip html/body)
  const trees = [];

  // Group HTML elements by file
  for (const el of htmlElements) {
    trees.push({
      tag: el.tag,
      id: el.id,
      classes: el.classes,
      file: el.file,
      line: el.line,
      depth: el.depth,
      layout: getLayoutSummary(el.classes, cssClasses),
      children: [],
    });
  }

  // Build hierarchy from depth values
  const roots = [];
  const stack = [];

  for (const node of trees) {
    while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
      stack.pop();
    }
    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }

  // Merge JS-created elements into each card body
  const cardFileMap = {
    "bd-configuration": "cards/card-configuration.js",
    "bd-tasks": "cards/card-tasks.js",
    "bd-steps": "cards/card-steps.js",
    "bd-prompt": "cards/card-prompt.js",
  };

  for (const root of roots) {
    for (const child of root.children) {
      if (child.id && cardFileMap[child.id]) {
        const jsFile = cardFileMap[child.id];
        const jsElements = buildJsTree(jsFile, jsData, cssClasses);
        child.children.push(...jsElements);
      }
    }
  }

  return roots;
}

function buildJsTree(targetFile, jsData, cssClasses) {
  const { elementsCreated, appends } = jsData;
  const fileElements = elementsCreated.filter((e) =>
    e.file.endsWith(targetFile),
  );
  const fileAppends = appends.filter((a) => a.file.endsWith(targetFile));

  // Build var -> element map
  const varMap = new Map();
  for (const el of fileElements) {
    varMap.set(el.varName, {
      tag: el.tag,
      varName: el.varName,
      classes: [],
      file: el.file,
      line: el.line,
      layout: "",
      children: [],
    });
  }

  // Assign classes from jsData.classRefs by matching var names in source lines
  // Re-scan the file for className assignments to map vars to classes
  const filePath = fileElements[0]?.file;
  if (filePath) {
    const fullPath = path.join(SRC_DIR, targetFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // className = 'x' or "x" or `x`
        const cnMatch = line.match(
          /(\w+)\.className\s*=\s*['"`]([^'"`]+)['"`]/,
        );
        if (cnMatch && varMap.has(cnMatch[1])) {
          varMap.get(cnMatch[1]).classes = cnMatch[2]
            .split(/\s+/)
            .filter(Boolean);
        }
        // classList.add('x')
        const clMatch = line.match(/(\w+)\.classList\.add\(\s*'([^']+)'/);
        if (clMatch && varMap.has(clMatch[1])) {
          varMap.get(clMatch[1]).classes.push(clMatch[2]);
        }
      }
    }
  }

  // Set layout info
  for (const [, node] of varMap) {
    node.layout = getLayoutSummary(node.classes, cssClasses);
  }

  // Build parent-child relationships
  const childSet = new Set();
  for (const ap of fileAppends) {
    const parent = varMap.get(ap.parent);
    const child = varMap.get(ap.child);
    if (parent && child) {
      parent.children.push(child);
      childSet.add(ap.child);
    }
  }

  // Return root elements (not appended to another tracked element)
  return [...varMap.values()].filter((n) => !childSet.has(n.varName));
}

function getLayoutSummary(classes, cssClasses) {
  const parts = [];
  for (const cls of classes) {
    const defs = cssClasses.get(cls);
    if (!defs) continue;
    for (const def of defs) {
      const l = def.layout;
      if (!l.display || l.display === "none") continue;

      if (l.display === "grid") {
        const cols = l["grid-template-columns"];
        const shortCols = cols
          ? cols
              .replace(/var\(--[^)]+\)/g, "")
              .replace(/clamp\([^)]+\)/g, "clamp")
              .replace(/repeat\((\d+),\s*1fr\)/, "$1×1fr")
              .replace(/\s+/g, " ")
              .trim()
          : "";
        parts.push(`Grid${shortCols ? " " + shortCols : ""}`);
      } else if (l.display === "flex" || l.display === "inline-flex") {
        const dir = l["flex-direction"] || "row";
        const wrap = l["flex-wrap"] ? " wrap" : "";
        parts.push(`Flex ${dir}${wrap}`);
      } else if (l.display !== "block" && l.display !== "inline") {
        parts.push(l.display);
      }
    }
  }
  return [...new Set(parts)].join(", ");
}

// ─── Analysis ────────────────────────────────────────────────────────────────

function analyze(cssClasses, htmlData, jsData) {
  const allUsedClasses = new Set();

  // Gather classes from HTML
  const htmlClassRefs = new Map();
  for (const el of htmlData.elements) {
    for (const cls of el.classes) {
      allUsedClasses.add(cls);
      if (!htmlClassRefs.has(cls)) htmlClassRefs.set(cls, []);
      htmlClassRefs.get(cls).push({ file: el.file, line: el.line });
    }
  }

  // Gather classes from JS
  for (const [cls] of jsData.classRefs) {
    allUsedClasses.add(cls);
  }

  // Unused CSS classes: defined in CSS, never referenced anywhere
  const unusedCss = [];
  for (const [cls, defs] of cssClasses) {
    if (!allUsedClasses.has(cls)) {
      unusedCss.push({ className: cls, definitions: defs });
    }
  }

  // Undefined classes: referenced in HTML/JS but not in CSS
  const undefinedClasses = [];
  const allRefClasses = new Map(); // cls -> [{file, line}]
  for (const el of htmlData.elements) {
    for (const cls of el.classes) {
      if (!allRefClasses.has(cls)) allRefClasses.set(cls, []);
      allRefClasses.get(cls).push({ file: el.file, line: el.line });
    }
  }
  for (const [cls, refs] of jsData.classRefs) {
    if (!allRefClasses.has(cls)) allRefClasses.set(cls, []);
    allRefClasses.get(cls).push(...refs);
  }
  for (const [cls, refs] of allRefClasses) {
    if (!cssClasses.has(cls)) {
      undefinedClasses.push({ className: cls, references: refs });
    }
  }

  // Elements without classes
  // HTML elements
  const elementStats = new Map(); // tag -> { total, noClass, violations }
  for (const el of htmlData.elements) {
    if (!elementStats.has(el.tag))
      elementStats.set(el.tag, { total: 0, noClass: 0, violations: [] });
    const stat = elementStats.get(el.tag);
    stat.total++;
    if (el.classes.length === 0) {
      stat.noClass++;
      stat.violations.push({ file: el.file, line: el.line });
    }
  }

  // JS elements
  for (const el of jsData.elementsCreated) {
    const tag = el.tag;
    if (!elementStats.has(tag))
      elementStats.set(tag, { total: 0, noClass: 0, violations: [] });
    const stat = elementStats.get(tag);
    stat.total++;
    const varSet = jsData.varsWithClass.get(el.file);
    const hasClass = varSet && varSet.has(el.varName);
    if (!hasClass) {
      stat.noClass++;
      stat.violations.push({ file: el.file, line: el.line });
    }
  }

  // Inline styles (merged)
  const inlineStyles = [...htmlData.inlineStyles, ...jsData.inlineStyles];

  return {
    cssClasses,
    htmlClassRefs,
    unusedCss,
    undefinedClasses,
    elementStats,
    inlineStyles,
    allUsedClasses,
    jsClassRefs: jsData.classRefs,
  };
}

// ─── Report Generator ────────────────────────────────────────────────────────

function generateReport(analysis, domTree, cssClasses) {
  const lines = [];
  const w = (...args) => lines.push(args.join(""));

  // ── Summary ──
  w("# DOM-CSS Analysis Report\n");
  w("| Metric | Count |");
  w("|--------|-------|");
  w(`| CSS classes defined | ${analysis.cssClasses.size} |`);
  w(`| Classes used (HTML+JS) | ${analysis.allUsedClasses.size} |`);
  w(`| Unused CSS classes | ${analysis.unusedCss.length} |`);
  w(`| Undefined classes | ${analysis.undefinedClasses.length} |`);
  w(`| Inline style violations | ${analysis.inlineStyles.length} |`);
  w("");

  // ── Elements Without Classes ──
  w("## Elements Without Classes\n");
  w("| Element | Occurrences | Without Class | Violations |");
  w("|---------|-------------|---------------|------------|");
  const sortedTags = [...analysis.elementStats.entries()].sort(
    (a, b) => b[1].noClass - a[1].noClass,
  );
  for (const [tag, stat] of sortedTags) {
    if (stat.noClass === 0) continue;
    const viols = stat.violations.map((v) => `${v.file}:${v.line}`).join(", ");
    w(`| \`<${tag}>\` | ${stat.total} | ${stat.noClass} | ${viols} |`);
  }
  w("");

  // ── Unused CSS Classes ──
  w("## Unused CSS Classes\n");
  if (analysis.unusedCss.length === 0) {
    w("None detected.\n");
  } else {
    for (const item of analysis.unusedCss.sort((a, b) =>
      a.className.localeCompare(b.className),
    )) {
      const locs = item.definitions
        .map((d) => `${d.file}:${d.line}`)
        .join(", ");
      w(`- \`.${item.className}\` — defined at ${locs}`);
    }
    w("");
  }

  // ── Undefined Classes ──
  w("## Undefined Classes (used but not in CSS)\n");
  if (analysis.undefinedClasses.length === 0) {
    w("None detected.\n");
  } else {
    for (const item of analysis.undefinedClasses.sort((a, b) =>
      a.className.localeCompare(b.className),
    )) {
      const locs = item.references.map((r) => `${r.file}:${r.line}`).join(", ");
      w(`- \`.${item.className}\` — used at ${locs}`);
    }
    w("");
  }

  // ── Inline Style Violations ──
  w("## Inline Style Violations\n");
  if (analysis.inlineStyles.length === 0) {
    w("None detected.\n");
  } else {
    for (const s of analysis.inlineStyles) {
      w(`- **${s.file}:${s.line}** — \`${s.code.substring(0, 100)}\``);
    }
    w("");
  }

  // ── DOM Tree ──
  w("## Approximate DOM Tree (L3–L7)\n");
  w("```");
  for (let i = 0; i < domTree.length; i++) {
    renderTreeNode(domTree[i], 3, "", true, true, lines);
    if (i < domTree.length - 1) w(""); // blank line between cards
  }
  w("```\n");

  // ── Class Usage Map ──
  w("## Class Usage Map\n");
  // Group all class refs by file
  const byFile = new Map();
  for (const el of analysis.htmlClassRefs) {
    const [cls, refs] = el;
    for (const r of refs) {
      if (!byFile.has(r.file)) byFile.set(r.file, new Map());
      const fm = byFile.get(r.file);
      fm.set(cls, (fm.get(cls) || 0) + 1);
    }
  }
  for (const [cls, refs] of analysis.jsClassRefs) {
    for (const r of refs) {
      if (!byFile.has(r.file)) byFile.set(r.file, new Map());
      const fm = byFile.get(r.file);
      fm.set(cls, (fm.get(cls) || 0) + 1);
    }
  }

  for (const [file, classMap] of [...byFile.entries()].sort()) {
    w(`### ${file}\n`);
    const sorted = [...classMap.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cls, count] of sorted) {
      w(`- \`.${cls}\` × ${count}`);
    }
    w("");
  }

  // ── Cross-File Class Map (reverse view, classes in 3+ files) ──
  w("## Cross-File Class Map\n");
  w("*Classes appearing in 3+ files (CSS definitions + HTML/JS usage).*\n");

  // Build class → Set<file> from all sources: CSS defs, HTML refs, JS refs
  const classToFiles = new Map();
  for (const [cls, defs] of analysis.cssClasses) {
    if (!classToFiles.has(cls)) classToFiles.set(cls, new Set());
    for (const d of defs)
      classToFiles.get(cls).add(`css/${path.basename(d.file)}`);
  }
  for (const [cls, refs] of analysis.htmlClassRefs) {
    if (!classToFiles.has(cls)) classToFiles.set(cls, new Set());
    for (const r of refs) classToFiles.get(cls).add(r.file);
  }
  for (const [cls, refs] of analysis.jsClassRefs) {
    if (!classToFiles.has(cls)) classToFiles.set(cls, new Set());
    for (const r of refs) classToFiles.get(cls).add(r.file);
  }

  const crossFile = [...classToFiles.entries()]
    .filter(([, files]) => files.size >= 3)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));

  if (crossFile.length === 0) {
    w("No classes found in 3+ files.\n");
  } else {
    for (const [cls, files] of crossFile) {
      w(`### \`.${cls}\` (${files.size} files)\n`);
      for (const f of [...files].sort()) {
        w(`- ${f}`);
      }
      w("");
    }
  }

  return lines.join("\n");
}

/**
 * Render a tree node with box-drawing lines and level labels.
 * @param {object} node       Tree node
 * @param {number} baseLevel  DOM level (L3 = top-level cards)
 * @param {string} prefix     Accumulated prefix of box-drawing chars
 * @param {boolean} isLast    Whether this node is the last sibling
 * @param {boolean} isRoot    Whether this is a root call (no connector)
 * @param {string[]} lines    Output array
 */
function renderTreeNode(node, baseLevel, prefix, isLast, isRoot, lines) {
  const idStr = node.id ? `#${node.id}` : "";
  const clsStr = node.classes.length ? `.${node.classes.join(".")}` : "";
  const layoutStr = node.layout ? ` [${node.layout}]` : "";
  const fileStr = ` — ${node.file}:${node.line}`;
  const levelTag = `L${baseLevel} `;

  const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";
  lines.push(
    `${prefix}${connector}${levelTag}${node.tag}${idStr}${clsStr}${layoutStr}${fileStr}`,
  );

  const children = node.children || [];
  const childPrefix = isRoot ? prefix : prefix + (isLast ? "   " : "│  ");
  for (let i = 0; i < children.length; i++) {
    renderTreeNode(
      children[i],
      baseLevel + 1,
      childPrefix,
      i === children.length - 1,
      false,
      lines,
    );
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function shortPath(p) {
  return p.replace(/^src\//, "");
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log("Scanning src/ ...");

  const cssFiles = findFiles(SRC_DIR, [".css"]);
  const htmlFiles = findFiles(SRC_DIR, [".html"]);
  const jsFiles = findFiles(SRC_DIR, [".js"]);

  console.log(
    `  Found ${cssFiles.length} CSS, ${htmlFiles.length} HTML, ${jsFiles.length} JS files`,
  );

  // 1. Parse CSS
  const cssClasses = parseCss(cssFiles);
  console.log(`  CSS: ${cssClasses.size} classes defined`);

  // 2. Parse HTML
  const htmlData = parseHtml(htmlFiles);
  console.log(`  HTML: ${htmlData.elements.length} elements`);

  // 3. Parse JS
  const jsData = parseJs(jsFiles, new Set(cssClasses.keys()));
  console.log(
    `  JS: ${jsData.classRefs.size} class refs, ${jsData.elementsCreated.length} elements created`,
  );

  // 4. Analyze
  const result = analyze(cssClasses, htmlData, jsData);

  // 5. Build DOM tree
  const domTree = buildDomTree(htmlData.elements, jsData, cssClasses);

  // 6. Generate report
  const report = generateReport(result, domTree, cssClasses);

  fs.writeFileSync(REPORT_FILE, report);
  console.log(`\nReport written to ${REPORT_FILE}`);
  console.log(`  Unused CSS: ${result.unusedCss.length}`);
  console.log(`  Undefined classes: ${result.undefinedClasses.length}`);
  console.log(`  Inline style violations: ${result.inlineStyles.length}`);
}

main();
