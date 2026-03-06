const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const cheerio = require('cheerio');
const css = require('css');

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
    elements: [], // { tag, classes, file, hasClass: bool, tree: string }
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
                    // Extract classes from selectors like .my-class or div.my-class
                    const classMatches = selector.match(/\.[_a-zA-Z0-9-][^ .#:[>+~]*/g);
                    if (classMatches) {
                        classMatches.forEach(match => {
                            const className = match.substring(1);
                            cssData.allDefinedClasses.add(className);
                            
                            if (!cssData.classes.has(className)) {
                                cssData.classes.set(className, { layout: {} });
                            }
                            
                            // Extract key layout properties
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
    
    // Simple regex for string literals that might be classes (e.g., classList.add('foo') or className = 'bar')
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

// Section: HTML Elements without CSS Classes
const elementsNoClass = usageData.elements.filter(e => !e.hasClass);
report += `## Elements without CSS Classes (${elementsNoClass.length})\n`;
elementsNoClass.slice(0, 50).forEach(e => {
    report += `- \`<${e.tag}>\` in \`${e.file}\`\n`;
});
if (elementsNoClass.length > 50) report += `- ... and ${elementsNoClass.length - 50} more.\n`;

// Section: Unused CSS Classes (Defined in CSS, not found in HTML/JS)
const unusedCss = [...cssData.allDefinedClasses].filter(c => !usageData.classesInHtmlJs.has(c));
report += `\n## Unused CSS Classes (${unusedCss.length})\n`;
report += `*Defined in .css but never referenced in .html or .js*\n\n`;
unusedCss.forEach(c => report += `- \`.${c}\`\n`);

// Section: Orphaned Classes (Used in HTML/JS, not defined in CSS)
const orphanedClasses = [...usageData.classesInHtmlJs].filter(c => !cssData.allDefinedClasses.has(c));
report += `\n## Undefined Classes used in HTML/JS (${orphanedClasses.length})\n`;
report += `*Referenced in code but no definition found in .css files*\n\n`;
orphanedClasses.forEach(c => report += `- \`.${c}\`\n`);

// Section: Approximate DOM Tree View
report += `\n## Approximate DOM Tree View (Sample from HTML files)\n`;
HTML_FILES.forEach(file => {
    report += `\n### File: \`${file}\`\n\`\`\`text\n`;
    const content = fs.readFileSync(file, 'utf8');
    const $ = cheerio.load(content);
    
    function walk(el, depth = 0) {
        let node = $(el);
        if (!el.tagName) return "";
        
        const indent = "  ".repeat(depth);
        const classes = node.attr('class') ? `.${node.attr('class').split(/\s+/).join('.')}` : "";
        
        // Get combined layout props for all classes on this element
        let layoutInfo = [];
        if (node.attr('class')) {
            node.attr('class').split(/\s+/).forEach(cls => {
                const data = cssData.classes.get(cls);
                if (data && Object.keys(data.layout).length > 0) {
                    Object.entries(data.layout).forEach(([k, v]) => layoutInfo.push(`${k}: ${v}`));
                }
            });
        }
        
        const layoutStr = layoutInfo.length > 0 ? ` [${layoutInfo.join('; ')}]` : "";
        let line = `${indent}${el.tagName}${classes}${layoutStr}\n`;
        
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
 
