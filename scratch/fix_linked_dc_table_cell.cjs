const fs = require('fs');
const path = require('path');

const viewPath = path.join(__dirname, '..', 'src', 'components', 'bank-accounts', 'BankAccountsView.tsx');
let viewContent = fs.readFileSync(viewPath, 'utf8');

const regexPattern = /<td className="p-3 whitespace-nowrap">\r?\n\s*<Badge className="bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-teal-300 font-mono font-bold text-\[11px\]">\r?\n\s*\{invRef\}\r?\n\s*<\/Badge>\r?\n\s*<\/td>/g;

const replacement = `<td className="p-3 whitespace-nowrap">
                            {(() => {
                              const dcNo = resolveDcNumber(tx);
                              return (
                                <div className="flex flex-col gap-1 items-start">
                                  <Badge className="bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200 border-teal-300 font-mono font-bold text-[11px]">
                                    {invRef}
                                  </Badge>
                                  {dcNo && (
                                    <span className="inline-flex items-center gap-1 text-[10.5px] font-bold font-mono bg-amber-100/90 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded border border-amber-300/80">
                                      <span className="text-[9.5px] uppercase opacity-75 font-semibold">DC:</span>
                                      <span>#{dcNo}</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>`;

viewContent = viewContent.replace(regexPattern, replacement);
fs.writeFileSync(viewPath, viewContent, 'utf8');
console.log('Linked table cell updated successfully!');
