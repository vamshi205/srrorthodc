"""
Extract the step tracker IIFE (lines 6640-7021) into a separate DcWorkflowTracker component.
This fixes the react-swc parser complexity error on line 7611.
"""

content = open('src/pages/SavedDcs.tsx', encoding='utf-8').read()
lines = content.split('\n')

# Boundaries (0-indexed)
IIFE_START = 6639  # Line 6640: {(() => {
IIFE_END   = 7021  # Line 7022: })}  -> this is line after the IIFE closing

# The IIFE block is lines 6640-7021 (1-indexed), i.e. indices 6639-7020
# It is wrapped in:
#   {(() => {      <- line 6640
#   ...
#   })()}          <- line 7022 (0-idx 7021)

# Extract the IIFE body (everything between the outer function braces)
# Line 6640: "                        {(() => {"
# Line 7022: "                        })()}"

iife_section = lines[IIFE_START:IIFE_END+1]

# The actual body content starts at line 6641 (index 6640 relative to file)
# and ends before the closing })()}
# Let's extract the body (between {(() => { ... })()})
body_lines = iife_section[1:-1]  # Skip first and last lines

# Determine the indentation of the body - find minimum indentation
min_indent = min(
    len(line) - len(line.lstrip())
    for line in body_lines
    if line.strip()
)

# De-indent the body by (min_indent - 2) spaces to get clean 2-space indented content
def dedent(line, amount):
    if len(line) < amount:
        return line
    if line[:amount].strip() == '':
        return line[amount:]
    return line

dedented_body = [dedent(line, min_indent) for line in body_lines]

# Build the new component
component_lines = [
    '// ─── DcWorkflowTracker component (extracted for parser complexity) ───',
    'interface DcWorkflowTrackerProps {',
    '  selectedDc: SavedDc;',
    '  linkedBankTx: import("@/services/bankStatementService").BankTransaction | null;',
    '  formatDate: (dateStr: string | undefined) => string;',
    '  getDisplayDate: (dc: SavedDc) => string;',
    '}',
    '',
    'const DcWorkflowTracker: React.FC<DcWorkflowTrackerProps> = ({',
    '  selectedDc,',
    '  linkedBankTx,',
    '  formatDate,',
    '  getDisplayDate,',
    '}) => {',
]

# Add the body (it should be converted from an IIFE body to a component body)
# The IIFE body contains: const declarations, Step/Line function defs, and returns JSX
# We need to wrap the last return statement appropriately
# The body ends with: return ( <div ...> ... </div> );
# We just use the body as-is but replace the final "return (" with "return ("

for line in dedented_body:
    component_lines.append(line)

component_lines.append('};')
component_lines.append('')

component_text = '\n'.join(component_lines)

print("=== New component (first 50 lines) ===")
for i, line in enumerate(component_lines[:50]):
    print(f"{i+1}: {line}")

print(f"\n... total component lines: {len(component_lines)}")
print(f"\nOriginal IIFE section: lines {IIFE_START+1}-{IIFE_END+1}")
print(f"Original body lines: {len(body_lines)}")
