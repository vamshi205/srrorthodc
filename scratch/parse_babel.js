import fs from 'fs';
import { parse } from '@babel/parser';

const code = fs.readFileSync('src/pages/SavedDcs.tsx', 'utf8');

try {
  parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
  console.log('SUCCESS! Babel parsed SavedDcs.tsx with NO errors!');
} catch (err) {
  console.error('Babel Parse Error:');
  console.error(err.message);
  if (err.loc) {
    console.error(`At Line ${err.loc.line}, Column ${err.loc.column}`);
    const lines = code.split('\n');
    console.error('Line content:', lines[err.loc.line - 1]);
  }
}
