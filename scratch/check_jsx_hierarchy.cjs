const ts = require('typescript');
const fs = require('fs');

const code = fs.readFileSync('src/pages/Customers.tsx', 'utf8');
const sf = ts.createSourceFile('Customers.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

// Find ReturnStatement
function findReturn(node) {
  if (ts.isReturnStatement(node) && node.expression) {
    const pos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    console.log('Return statement at Line', pos.line + 1);
    checkJsx(node.expression, 0);
  } else {
    ts.forEachChild(node, findReturn);
  }
}

function checkJsx(node, depth) {
  const indent = '  '.repeat(depth);
  if (ts.isJsxElement(node)) {
    const name = node.openingElement.tagName.getText(sf);
    const startPos = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const endPos = sf.getLineAndCharacterOfPosition(node.getEnd());
    console.log(`${indent}<${name}> (Lines ${startPos.line + 1} to ${endPos.line + 1})`);
    node.children.forEach(child => checkJsx(child, depth + 1));
  } else if (ts.isJsxFragment(node)) {
    console.log(`${indent}<Fragment>`);
    node.children.forEach(child => checkJsx(child, depth + 1));
  } else if (ts.isJsxExpression(node)) {
    console.log(`${indent}{Expr}`);
    if (node.expression) {
      checkJsx(node.expression, depth + 1);
    }
  } else if (ts.isBinaryExpression(node)) {
    checkJsx(node.left, depth);
    checkJsx(node.right, depth);
  } else if (ts.isParenthesizedExpression(node)) {
    checkJsx(node.expression, depth);
  } else {
    // Other node
  }
}

findReturn(sf);
