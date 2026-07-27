
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract the history view block
block = lines[1995:2197]
content = "".join(block)

import re
tag_pattern = re.compile(r'<(/?[a-zA-Z0-9]+)(?:\s+[^>]*?)?(/?)>')
stack = []
for match in tag_pattern.finditer(content):
    tag_name = match.group(1)
    is_self_closing = match.group(2) == '/'
    
    if tag_name.startswith('/'):
        tag_name = tag_name[1:]
        if not stack:
            print(f"Unexpected closing tag </{tag_name}>")
        else:
            last_tag = stack.pop()
            if last_tag != tag_name:
                print(f"Mismatched tag: expected </{last_tag}>, found </{tag_name}>")
    elif not is_self_closing:
        if tag_name not in ['img', 'br', 'hr', 'input']:
            stack.append(tag_name)

print(f"Unclosed tags: {stack}")
