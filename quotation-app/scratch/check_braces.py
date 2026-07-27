
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

brace_count = 0
paren_count = 0
for i, char in enumerate(content):
    if char == '{': brace_count += 1
    elif char == '}': brace_count -= 1
    elif char == '(': paren_count += 1
    elif char == ')': paren_count -= 1
    
    if brace_count < 0:
        print(f"Brace underflow at character {i}")
        # Print some context
        print(content[max(0, i-20):min(len(content), i+20)])
        brace_count = 0
    if paren_count < 0:
        print(f"Paren underflow at character {i}")
        # Print some context
        print(content[max(0, i-20):min(len(content), i+20)])
        paren_count = 0

print(f"Final brace count: {brace_count}")
print(f"Final paren count: {paren_count}")
