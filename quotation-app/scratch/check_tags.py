
import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Simple tag counter
tags = re.findall(r'<([a-zA-Z0-9]+)(?:\s+[^>]*?)?>|</([a-zA-Z0-9]+)>', content)
stack = []
for open_tag, close_tag in tags:
    if open_tag:
        # Ignore self-closing tags (this regex is simple, might miss some)
        # Check if it's self-closing in the original content
        # Actually, let's just find tags that don't end with />
        pass
    
# Better tag counter
tag_pattern = re.compile(r'<(/?[a-zA-Z0-9]+)(?:\s+[^>]*?)?(/?)>')
brace_count = 0
in_jsx_expression = False

stack = []
for match in tag_pattern.finditer(content):
    tag_name = match.group(1)
    is_self_closing = match.group(2) == '/'
    
    if tag_name.startswith('/'):
        tag_name = tag_name[1:]
        if not stack:
            print(f"Unexpected closing tag </{tag_name}> at {match.start()}")
        else:
            last_tag = stack.pop()
            if last_tag != tag_name:
                print(f"Mismatched tag: expected </{last_tag}>, found </{tag_name}> at {match.start()}")
    elif not is_self_closing:
        stack.append(tag_name)

print(f"Unclosed tags: {stack}")
