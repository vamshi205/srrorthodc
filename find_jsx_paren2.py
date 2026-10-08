content = open('src/pages/SavedDcs.tsx', encoding='utf-8').read()
lines = content.split('\n')

# Find overview tab boundaries
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'value="overview"' in line and 'TabsContent' in line:
        start_line = i
    if start_line and i > start_line and 'value="history"' in line and 'TabsContent' in line:
        end_line = i
        break

# The SWC error: "Expected '</', got 'jsx text (\n  │\n  │                 )'"
# This means: parser is in JSX element context (between tags), 
# found character '(' which it interprets as text, then sees ')' after some whitespace.
# The issue: a closing ')' appearing as raw text in JSX between tags.

# In JSX context, ')' only appears as text when it's NOT inside {}.
# This happens with multi-line conditionals where the closing ) for a
# JS expression bleeds into JSX text context.

# Let's look at the exact structure of conditionals:
# Pattern that causes problems:
#   ) : (            <- This ) before : ( is fine (ternary)
#   ) : null}        <- This is fine 
#   )}               <- Closing a conditional, fine
#
# Problem pattern: When JSX children contain something that the parser sees as 
# opening a new expression with '(' but then can't close it properly.

# Let me look for all '&&' conditionals where the JSX immediately after
# the opening '(' is multi-line or complex:

section = lines[start_line:end_line]

print('Scanning for problematic patterns in overview tab...')
print()

# Look for the actual issue: a line that starts with ")" as JSX text
# In JSX, after a closing tag like </div>, if next line starts with ')'
# that's a JSX text problem
for j in range(1, len(section)):
    lineno = start_line + j + 1
    cur = section[j].strip()
    prev = section[j-1].strip()
    
    # Look for ternary/conditional closing ')' that appears after JSX closing tags
    # which would make it look like JSX text
    if cur.startswith(')') and (prev.endswith('>') or prev.endswith('/>')):
        print(f'  ⚠️  L{lineno}: "{cur[:80]}" after tag close: "{prev[:80]}"')
    
    # Look for lines that have only ')' or start with ')' after JSX closing tags
    if (cur == ')' or cur == ') :' or cur.startswith(') :') or cur.startswith(') ?')) and (prev.endswith('>') or prev.endswith('/>')):
        print(f'  🔴 TERNARY ) after JSX close at L{lineno}: "{cur}"')

# Also: let's check for the specific case where a JSX conditional uses
# ternary where the false branch has ')' on its own as JSX text
# Pattern: 
#   ...JSX content...
#                 )    <-- closing paren of false branch
#               )      <-- but there's ALSO outer closing paren that looks like text
print()
print('--- Looking for nested closing parens that may appear as JSX text ---')
for j in range(2, len(section)):
    lineno = start_line + j + 1
    cur = section[j].strip()
    prev1 = section[j-1].strip()
    prev2 = section[j-2].strip()
    
    # Two consecutive ')' lines
    if cur in (')', ')}', ');}') and prev1 in (')', ')}', ');}', ');'):
        print(f'  L{lineno-1}: {prev1}')
        print(f'  L{lineno}: {cur}')
        print()

# More targeted: find where the error might actually be
# The error text shows "jsx text (\n  │\n  │                 )"
# │ is a vite box-drawing char, so real text is "(\n\n                 )"
# or the error shows text that IS the source span
# Let's look for any place where a "(" is surrounded by JSX

print()
print('--- Lines that might have bare ( as JSX children ---')
# Simple heuristic: look for lines in JSX body (not in {}) that start/end with (
# by tracking when we're "inside" JSX element body
in_jsx = 0
brace_depth = 0

for j, line in enumerate(section):
    lineno = start_line + j + 1
    stripped = line.strip()
    
    # Skip empty lines and comments
    if not stripped or stripped.startswith('//') or stripped.startswith('/*') or stripped.startswith('*'):
        continue
    
    # Look for a line that is ONLY "(" or ends with " ("
    # and the previous non-empty line is a JSX closing tag or text
    if stripped == '(' :
        prev_nonempty = ''
        for k in range(j-1, max(0, j-5), -1):
            if section[k].strip():
                prev_nonempty = section[k].strip()
                break
        print(f'  BARE ( at L{lineno}, prev: "{prev_nonempty[:80]}"')

print()
print('DONE.')
