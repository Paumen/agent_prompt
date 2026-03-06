import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import * as cheerio from 'cheerio';
import css from 'css';

/**
 * CONFIGURATION & FILTERS
 */
const LAYOUT_PROPS = ['display', 'grid-template-columns', 'grid-template-rows', 'flex-direction', 'justify-content', 'align-items', 'width', 'height', 'position'];
const IGNORE_TAGS = ['html', 'head', 'meta', 'link', 'script', 'style', 'title', 'noscript'];
// Words commonly found in JS strings that aren't CSS classes
const JS_NOISE_THRESHOLD = 3; // Ignore strings shorter than this
const JS_IGNORE_PATTERN = /^(node:|utf8|module|click|change|input|true|false|null|undefined|DOMContentLoaded|px|vh|vw|%)/i;

const CSS_FILES = globSync('**/*.css', { ignore: 'node_modules/**' });
const HTML_FILES = globSync('**/*.html', { ignore: 'node_modules/**' });
const JS_FILES = globSync('**/*.js', { ignore: ['node_modules/**', 'analyze.js'] }); // Ignore this script

const cssData = {
    classes: new Map(),
    allDefinedClasses: new Set()
};

const usageData = {
    classesInHtml: new Set(),
    classesInJs: new Set(),
    elements: [],
};

/**
 * 1. EXTRACT CSS CLASSES & PROPERTIES
 */
CSS_FILES.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        const ast = css.parse(content);
        
        ast.stylesheet.rules.forEach(rule => {
            if (rule.type === 'rule') {
                rule.selectors.forEach(selector => {
                    // Refined regex to exclude trailing commas and brackets
                    const classMatches = selector.match(/\.[_a-zA-Z0-9-][^ .#:[>+~,()]* /g);
                    if (classMatches) {
                        classMatches.forEach(match => {
                            const className = match.substring(1).trim().replace(/,$/, '');
                            cssData.allDefinedClasses.add(className);
                            
                            if (!cssData.classes.has(className)) {
                                cssData.classes.set(className, { layout: {} });
                            }
                            
                            rule.declarations?.forEach(decl => {
                                if (LAYOUT_PROPS.includes(decl.property)) {
                                    cssData.classes.get(className).layout[decl.property] = decl.value;
                                }
                            });
                        });
                    }
                });
            }
        });
    } catch (e) {
        console.error(`Error parsing CSS file ${file}: ${e.message}`);
    }
});

/**
 * 2. EXTRACT HTML ELEMENTS & USAGE
 */
HTML_FILES.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(content);

    $('*').each((i, el) => {
        const tagName = el.tagName.toLowerCase();
        if (IGNORE_TAGS.includes(tagName)) return;

        const classAttr = $(el).attr('class') || '';
        const classes = classAttr.split(/\s+/).filter(Boolean);
        
        classes.forEach(c => usageData.classesInHtml.add(c));
        
        usageData.elements.push({
            tag: tagName,
            classes: classes,
            file: file,
            hasClass: classes.length > 0
        });
    });
});

/**
 * 3. SCAN JS FOR CLASS OCCURRENCES
 */
JS_FILES.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    // Look for strings that look like kebab-case or BEM classes specifically
    const stringMatches = content.match(/['"`]([a-z0-9]+(?:-[a-z0-9]+)+|card(?:--[a-z0-9]+)?)['"`]/g);
    
    if (stringMatches) {
        stringMatches.forEach(match => {
            const className = match.replace(/['"`]/g, '');
            if (className.length >= JS_NOISE_THRESHOLD && !JS_IGNORE_PATTERN.test(className)) {
                usageData.classesInJs.add(className);
            }
        });
    }
});

/**
 * 4. ANALYSIS & REPORT GENERATION
 */
const allUsedClasses = new Set([...usageData.classesInHtml, ...usageData.classesInJs]);
let report = `# DOM & CSS Analysis Report\n\n`;

// Section: HTML Elements without CSS Classes
const elementsNoClass = usageData.elements.filter(e => !e.hasClass);
report += `## Elements without CSS Classes (${elementsNoClass.length})\n`;
report += `*Excluding structural tags like <head>, <meta>, <script>*\n\n`;
elementsNoClass.slice(0, 50).forEach(e => {
    report += `- \`<${e.tag}>\` in \`${e.file}\`\n`;
});

// Section: Unused CSS Classes
const unusedCss = [...cssData.allDefinedClasses].filter(c => !allUsedClasses.has(c));
report += `\n## Unused CSS Classes (${unusedCss.length})\n`;
unusedCss.forEach(c => report += `- \`.${c}\`\n`);

// Section: Undefined Classes used in HTML/JS
const orphanedClasses = [...allUsedClasses].filter(c => !cssData.allDefinedClasses.has(c));
report += `\n## Undefined Classes used in HTML/JS (${orphanedClasses.length})\n`;
report += `*Classes found in code but missing from .css files*\n\n`;
orphanedClasses.forEach(c => report += `- \`.${c}\`\n`);

// Section: Tree View
report += `\n## Approximate DOM Tree View\n`;
HTML_FILES.forEach(file => {
    report += `\n### File: \`${file}\`\n\`\`\`text\n`;
    const content = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(content);
    
    function walk(el, depth = 0) {
        if (!el || el.type !== 'tag') return "";
        const tagName = el.tagName.toLowerCase();
        if (IGNORE_TAGS.includes(tagName)) return "";

        const node = $(el);
        const indent = "  ".repeat(depth);
        const classAttr = node.attr('class');
        const classNames = classAttr ? classAttr.split(/\s+/) : [];
        const classStr = classNames.length ? `.${classNames.join('.')}` : "";
        
        let layoutInfo = [];
        classNames.forEach(cls => {
            const data = cssData.classes.get(cls);
            if (data && Object.keys(data.layout).length > 0) {
                Object.entries(data.layout).forEach(([k, v]) => layoutInfo.push(`${k}: ${v}`));
            }
        });
        
        const layoutStr = layoutInfo.length > 0 ? ` [${layoutInfo.join('; ')}]` : "";
        let line = `${indent}${tagName}${classStr}${layoutStr}\n`;
        
        node.children().each((i, child) => {
            line += walk(child, depth + 1);
        });
        return line;
    }

    $('body').each((i, el) => {
        report += walk(el);
    });
    report += `\`\`\`\n`;
});

fs.writeFileSync('analysis_report.md', report);
console.log('Analysis complete. Report saved to analysis_report.md');
 
