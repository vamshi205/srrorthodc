const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const sf = ts.createSourceFile('Customers.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function visit(node) {
  if (ts.isJsxExpression(node)) {
    if (!node.expression) {
      const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      console.log('Empty or unclosed JsxExpression at Line', pos.line + 1, 'Col', pos.character + 1, ':', node.getText(sf).slice(0, 50));
    }
  }
  ts.forEachChild(node, visit);
}

visit(sf);
