from pathlib import Path

files = {
    'src/pages/ImageDatabase.tsx': (
        '        {/* Left Menu (desktop only - hidden on tablets) */}',
        '        </aside>\n\n        {/* Main Content */}'
    ),
    'src/pages/SavedDcs.tsx': (
        '        {/* Left Menu (desktop only - hidden on tablets) */}',
        '        </aside>\n\n        {/* Main Content */}'
    ),
}

for rel, (start, end) in files.items():
    path = Path(rel)
    text = path.read_text(encoding='utf-8')
    idx = text.find(start)
    if idx == -1:
        print(f"START not found in {rel}")
        continue
    jdx = text.find(end, idx)
    if jdx == -1:
        print(f"END not found in {rel}")
        continue
    jdx_end = jdx + len(end)
    new_text = text[:idx] + '        {/* Main Content */}' + text[jdx_end:]
    path.write_text(new_text, encoding='utf-8')
    print(f"Removed sidebar block from {rel}")
