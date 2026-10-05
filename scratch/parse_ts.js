import fs from 'fs';
import ts from 'typescript';

const code = fs.readFileSync('src/pages/SavedDcs.tsx', 'utf8');

const sourceFile = ts.createSourceFile('SavedDcs.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(node, depth = 0) {
  if (ts.isJsxElement(node)) {
    const openTag = node.openingElement.tagName.getText(sourceFile);
    const closeTag = node.closingElement.tagName.getText(sourceFile);
    const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    if (openTag !== closeTag) {
      console.log(`Mismatch: <${openTag}> at line ${startLine} closed with </${closeTag}> at line ${endLine}`);
    }
  }
  ts.forEachChild(node, child => walk(child, depth + 1));
}

// Check syntax errors reported by TS compiler
const result = ts.transpileModule(code, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext },
  reportDiagnostics: true
});

if (result.diagnostics && result.diagnostics.length > 0) {
  console.log('TS Compiler Diagnostics:');
  result.diagnostics.forEach(diag => {
    const line = diag.file ? sourceFile.getLineAndCharacterOfPosition(diag.start).line + 1 : 0;
    console.log(`Line ${line}: ${diag.messageText}`);
  });
} else {
  console.log('TS Compiler Diagnostics: NO ERRORS!');
}

walk(sourceFile);
