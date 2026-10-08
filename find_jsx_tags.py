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

print(f'Overview tab: lines {start_line+1} to {end_line+1}')

import re

section = lines[start_line:end_line]
section_text = '\n'.join(section)

# Find all opening and closing JSX tags (non-self-closing)
# Opening: <TagName or <tagname (not </ and not <! and not <?
# Must be component or HTML tags

component_stack = []
issues = []

for j, line in enumerate(section):
    lineno = start_line + j + 1
    
    # Find opening tags: <[A-Za-z][^>]*> that aren't self-closing
    # Self-closing: ends with />
    # We need to track them
    
    # Find all tags on this line
    # Opening non-self-closing: <Tag ... > (not />)  
    # Opening self-closing: <Tag ... />
    # Closing: </Tag>
    
    opens = re.findall(r'<([A-Z][A-Za-z0-9]*|[a-z]+)(?:\s[^>]*)?>(?<!/)', line)
    closes = re.findall(r'</([A-Za-z][A-Za-z0-9]*)\s*>', line)
    self_closes = re.findall(r'<([A-Za-z][A-Za-z0-9]*)(?:\s[^>]*)?\s*/>', line)
    
    # Filter: if the tag ends with /, it's self-closing
    # More carefully: check if it ends with "/>
    real_opens = []
    for tag in re.finditer(r'<([A-Z][A-Za-z0-9]*|[a-z]+)(\s[^>]*)?>',  line):
        tag_text = tag.group(0)
        if not tag_text.endswith('/>'):
            real_opens.append(tag.group(1))
    
    for tag in real_opens:
        component_stack.append((tag, lineno))
    
    for close_tag in closes:
        # Find matching open
        found = False
        for k in range(len(component_stack)-1, -1, -1):
            if component_stack[k][0] == close_tag:
                component_stack.pop(k)
                found = True
                break
        if not found:
            issues.append(f'L{lineno}: UNMATCHED CLOSE </{close_tag}> (no open tag found): {line.strip()[:80]}')

print('\nUnmatched tags remaining on stack:')
for tag, lineno in component_stack:
    print(f'  <{tag}> opened at L{lineno}')

print('\nIssues found:')
for issue in issues:
    print(f'  {issue}')

if not component_stack and not issues:
    print('  All tags balanced!')
