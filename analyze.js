import fs from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import * as cheerio from 'cheerio';
import css from 'css';

/**
 * CONFIGURATION & SELECTORS
 */
const LAYOUT_PROPS = ['display', 'grid-template-columns', 'grid-template-rows', 'flex-direction', 'justify-content', 'align-items', 'width', 'height', 'position'];
const CSS_FILES = globSync('**/*.css', { ignore: 'node_modules/**' });
const HTML_FILES = globSync('**/*.html', { ignore: 'node_modules/**' });
const JS_FILES = globSync('**/*.js', { ignore: 'node_modules/**' });

const cssData = {
    classes: new Map(), // className -> { properties: {} }
    allDefinedClasses: new Set()
};

const usageData = {
    classesInHtmlJs: new Set(),
    elements: [], // { tag, classes, file, hasClass: bool }
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
                    const classMatches = selector.match(/\.[_a-zA-Z0-9-][^ .#:[>+~]*/g);
                    if (classMatches) {
                        classMatches.forEach(match => {
                            const className = match.substring(1);
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
        const tagName = el.tagName;
        const classAttr = $(el).attr('class') || '';
        const classes = classAttr.split(/\s+/).filter(Boolean);
        
        classes.forEach(c => usageData.classesInHtmlJs.add(c));
        
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
    const stringMatches = content.match(/['"`]([_a-zA-Z0-9-]+)['"`]/g);
    if (stringMatches) {
        stringMatches.forEach(match => {
            const className = match.replace(/['"`]/g, '');
            usageData.classesInHtmlJs.add(className);
        });
    }
});

/**
 * 4. ANALYSIS & REPORT GENERATION
 */
let report = `# DOM & CSS Analysis Report\n\n`;

// Section: Elements without CSS Classes
const elementsNoClass = usageData.elements.filter(e => !e.hasClass);
report += `## Elements without CSS Classes (${elementsNoClass.length})\n`;
elementsNoClass.slice(0, 50).forEach(e => {
    report += `- \`<${e.tag}>\` in \`${e.file}\`\n`;
});

// Section: Unused CSS Classes
const unusedCss = [...cssData.allDefinedClasses].filter(c => !usageData.classesInHtmlJs.has(c));
report += `\n## Unused CSS Classes (${unusedCss.length})\n`;
unusedCss.forEach(c => report += `- \`.${c}\`\n`);

// Section: Undefined Classes used in HTML/JS
const orphanedClasses = [...usageData.classesInHtmlJs].filter(c => !cssData.allDefinedClasses.has(c));
report += `\n## Undefined Classes used in HTML/JS (${orphanedClasses.length})\n`;
orphanedClasses.forEach(c => report += `- \`.${c}\`\n`);

// Section: Tree View
report += `\n## Approximate DOM Tree View\n`;
HTML_FILES.forEach(file => {
    report += `\n### File: \`${file}\`\n\`\`\`text\n`;
    const content = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(content);
    
    function walk(el, depth = 0) {
        if (!el || (el.type !== 'tag' && el.name === undefined)) return "";
        const node = $(el);
        const indent = "  ".repeat(depth);
        
        const tagName = el.name || el.tagName;
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

    $('body').children().each((i, el) => {
        report += walk(el);
    });
    report += `\`\`\`\n`;
});

fs.writeFileSync('analysis_report.md', report);
console.log('Analysis complete. Report saved to analysis_report.md');
 
