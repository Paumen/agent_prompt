import fs from 'fs';
import { globSync } from 'glob';
import * as cheerio from 'cheerio';

const cssFiles = globSync('**/*.css', { ignore: 'node_modules/**' });
const htmlFiles = globSync('**/*.html', { ignore: 'node_modules/**' });
const jsFiles = globSync('**/*.js', { ignore: 'node_modules/**' });

const definedCssClasses = new Set();
const usedClasses = new Set();
const definedHtmlElements = new Set();
let report = '# DOM & CSS Analysis Report\n\n';

// 1. Extract CSS Classes
cssFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const classRegex = /\.([a-zA-Z0-9_-]+)[\s\w>~+:,]*\{/g;
    let match;
    while ((match = classRegex.exec(content)) !== null) {
        definedCssClasses.add(match[1]);
    }
});

// 2. Extract HTML Elements and Classes
report += '## Approximate DOM Trees (HTML Files)\n';
htmlFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const $ = cheerio.load(content);
    
    report += `### ${file}\n\`\`\`\n`;
    
    function traverse(node, depth) {
        if (node.type === 'tag') {
            const tagName = node.name;
            definedHtmlElements.add(tagName);
            
            const className = node.attribs.class || '';
            const classes = className.split(/\s+/).filter(Boolean);
            classes.forEach(c => usedClasses.add(c));

            const indent = '  '.repeat(depth);
            const classString = className ? `.${classes.join('.')}` : '';
            const styleString = node.attribs.style ? ` { style: ${node.attribs.style} }` : '';
            
            report += `${indent}${tagName}${classString}${styleString}\n`;
            
            if (node.children) {
                node.children.forEach(child => traverse(child, depth + 1));
            }
        }
    }
    
    $('body').children().each((_, el) => traverse(el, 0));
    report += `\`\`\`\n\n`;
});

// 3. Extract Classes from JS
jsFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const jsClassRegex = /(?:class|className)\s*=\s*['"]([^'"]+)['"]|classList\.(?:add|remove|toggle)\(['"]([^'"]+)['"]\)/g;
    let match;
    while ((match = jsClassRegex.exec(content)) !== null) {
        const classNames = (match[1] || match[2] || '').split(/\s+/).filter(Boolean);
        classNames.forEach(c => usedClasses.add(c));
    }
});

// 4. Compute Results
const unusedCss = [...definedCssClasses].filter(c => !usedClasses.has(c));
const missingCss = [...usedClasses].filter(c => !definedCssClasses.has(c));

report += '## Analysis Results\n\n';
report += '### ⚠️ CSS Classes Defined but NOT Used\n';
report += unusedCss.length ? unusedCss.map(c => `- \`${c}\``).join('\n') : 'None found.\n';
report += '\n\n';

report += '### ⚠️ CSS Classes Used but NOT Defined\n';
report += missingCss.length ? missingCss.map(c => `- \`${c}\``).join('\n') : 'None found.\n';
report += '\n\n';

fs.writeFileSync('analysis_report.md', report);
console.log('Analysis complete.');
