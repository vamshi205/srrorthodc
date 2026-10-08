import re

filepath = r"c:\Users\Admin\Documents\srrprojects\orthodc\srrorthodc\src\pages\SavedDcs.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    code = f.read()

# Replace <DropdownMenuContent ... className="w-52" ... > ... </DropdownMenuContent>
pattern = re.compile(r'<DropdownMenuContent\s+align="end"\s+className="w-52"\s*>.*?</DropdownMenuContent>', re.DOTALL)

matches = pattern.findall(code)
print(f"Found {len(matches)} DropdownMenuContent blocks to replace.")

code = pattern.sub("{renderDcActionDropdownContent(dc)}", code)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(code)

print("SavedDcs.tsx updated successfully!")
