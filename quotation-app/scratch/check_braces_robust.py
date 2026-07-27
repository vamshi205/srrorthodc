
import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove comments
content = re.sub(r'//.*', '', content)
content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

# Remove strings
content = re.sub(r"'(?:\\.|[^'])*'", "''", content)
content = re.sub(r'"(?:\\.|[^"])*"', '""', content)
content = re.sub(r'`(?:\\.|[^`])*`', '``', content)

brace_count = 0
paren_count = 0
for i, char in enumerate(content):
    if char == '{': brace_count += 1
    elif char == '}': brace_count -= 1
    elif char == '(': paren_count += 1
    elif char == ')': paren_count -= 1
    
    if brace_count < 0:
        print(f"Brace underflow at {i}")
        brace_count = 0
    if paren_count < 0:
        print(f"Paren underflow at {i}")
        paren_count = 0

print(f"Final brace count: {brace_count}")
print(f"Final paren count: {paren_count}")
