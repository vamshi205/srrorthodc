content = open('src/pages/SavedDcs.tsx', encoding='utf-8').read()

# The error says "jsx text (\n\n                 )"
# This is two-line text: line1="(", line2="                 )"
# Let's find this exact pattern in the overview section

lines = content.split('\n')

# Find overview boundaries
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'value="overview"' in line and 'TabsContent' in line:
        start_line = i
    if start_line and i > start_line and 'value="history"' in line and 'TabsContent' in line:
        end_line = i
        break

print(f'Overview: {start_line+1} to {end_line+1}')

# Look for the literal pattern "(  " on its own where
# - it's NOT inside {} blocks
# - NOT part of JSX attribute value like className="..."
# Strategy: Find all occurrences of line that is ONLY whitespace + "(" + optional whitespace

import re
for j in range(start_line, end_line):
    line = lines[j]
    stripped = line.strip()
    
    # Look for specific problematic patterns:
    # 1. Line that ENDS with "(" outside of {} 
    # 2. Line that starts with ")" (that might be mistaken for JSX text)
    
    # Simple: a line that is just "(" could be JSX text
    if stripped == '(':
        print(f'BARE ( at L{j+1}: {repr(line)}')
        # Show context
        for k in range(max(0,j-3), min(len(lines), j+4)):
            print(f'  {k+1}: {lines[k].rstrip()}')
        print()

# Also look for template with:
# ...
# (
#
#                 )
# which would be the exact error pattern
print('\n--- Looking for ( on line N followed by ) on line N+2 ---')
for j in range(start_line, end_line-2):
    l1 = lines[j].strip()
    l2 = lines[j+1].strip()  
    l3 = lines[j+2].strip()
    
    if l1 == '(' and l2 == '' and l3 == ')':
        print(f'FOUND at L{j+1}-{j+3}')
        for k in range(max(0,j-2), min(len(lines), j+5)):
            print(f'  {k+1}: {lines[k].rstrip()}')
        print()
    
    if l1 == '(' and l3.startswith(')'):
        print(f'POTENTIAL at L{j+1}: l1={repr(l1)}, l2={repr(l2)}, l3={repr(l3[:40])}')

print('Done')
