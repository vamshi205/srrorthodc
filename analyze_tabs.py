import re

content = open('src/pages/SavedDcs.tsx', encoding='utf-8').read()
lines = content.split('\n')

# Find overview and history tab boundaries
start_line = None
end_line = None
for i, line in enumerate(lines):
    if 'value="overview"' in line and 'TabsContent' in line:
        start_line = i
    if start_line and i > start_line and 'value="history"' in line and 'TabsContent' in line:
        end_line = i
        break

print(f'Overview tab: lines {start_line+1} to {end_line+1}')
section = lines[start_line:end_line]

depth = 0
for j, line in enumerate(section):
    lineno = start_line + j + 1
    opens = len(re.findall(r'<div[\s>]', line))
    closes = len(re.findall(r'</div>', line))
    depth += opens - closes
    if abs(opens - closes) > 0:
        print(f'  L{lineno}: +{opens} -{closes} = depth {depth}  | {line.strip()[:90]}')

print(f'Final depth: {depth}')
print()
print('--- Checking around lines 7395-7615 ---')
for i in range(7394, 7615):
    line = lines[i]
    opens = len(re.findall(r'<div[\s>]', line))
    closes = len(re.findall(r'</div>', line))
    if opens or closes:
        print(f'  L{i+1}: +{opens} -{closes}  | {line.strip()[:90]}')
