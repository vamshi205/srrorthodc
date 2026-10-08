import re

content = open('src/pages/SavedDcs.tsx', encoding='utf-8').read()
lines = content.split('\n')

# Find overview tab section 
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'value="overview"' in line and 'TabsContent' in line:
        start_line = i
    if start_line and i > start_line and 'value="history"' in line and 'TabsContent' in line:
        end_line = i
        break

print(f'Overview tab: lines {start_line+1} to {end_line+1}')

# Look for patterns where a line ends with just "(" in JSX context
# (not inside {})
print('\n--- Lines ending with bare "(" possibly as JSX text ---')
section = lines[start_line:end_line]
brace_depth = 0
for j, line in enumerate(section):
    lineno = start_line + j + 1
    stripped = line.strip()
    
    # Count brace depth - simplified
    for ch in line:
        if ch == '{':
            brace_depth += 1
        elif ch == '}':
            brace_depth -= 1
    
    # A line that is ONLY ")" with whitespace (closing JSX text paren)
    if stripped == ')' and brace_depth == 0:
        print(f'  BARE ) at L{lineno}: {repr(line)}')
    
    # A line that is only "(" with whitespace 
    if stripped == '(' and brace_depth == 0:
        print(f'  BARE ( at L{lineno}: {repr(line)}')

    # Lines where "(" appears right after JSX text (outside {})
    if brace_depth == 0 and re.search(r'\w\s*\n', line) and stripped.startswith('('):
        print(f'  TEXT+( at L{lineno}: {repr(line)}')

print('\nDone.')

# Also look for lines that contain just ")" or end with ")" that might be JSX text
print('\n--- All lines 6625-7611 matching pattern ---')
for j, line in enumerate(section):
    lineno = start_line + j + 1
    stripped = line.strip()
    # Lines that are purely ")" - potential JSX text issue
    if stripped in (')', ');', '})', '});', ')}') :
        continue  # These are normal
    # Something weird
    if stripped.startswith('(') and not stripped.startswith('({') and not stripped.startswith('(/*') and not stripped.startswith('(selectedDc') and not stripped.startswith('(isPart') and not stripped.startswith('(linked') and not stripped.startswith('(selected') and not stripped.startswith('(linked') and not stripped.startswith('("') and not stripped.startswith("('") and not stripped.startswith('(!'):
        prev_line = lines[start_line + j - 1].strip() if j > 0 else ''
        # Check if previous line ends in a way that would leave this ( as JSX text
        if not prev_line.endswith('{') and not prev_line.endswith('&&') and not prev_line.endswith('?') and not prev_line.endswith(':') and not prev_line.endswith('||') and not prev_line.endswith('=') and not prev_line.endswith('(') and not prev_line.endswith(','):
            print(f'  SUSPECT ( at L{lineno} (prev: {repr(prev_line[:60])}): {repr(stripped[:60])}')
