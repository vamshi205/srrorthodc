const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('c:/Users/Admin/Documents/srrprojects/orthodc/srrorthodc/src/pages/SavedDcs.tsx');
let content = fs.readFileSync(targetFile, 'utf8').replace(/\r\n/g, '\n');

const brokenPartStart = `                                {linkedBankTx?.description && (
                                  <div className="sm:col-span-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                      Bank Narration
                                    </span>
                                    <span
                                      className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block truncate"
                                      title={linkedBankTx.description}
                                    >
                                      {linkedBankTx.description}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">No active payment record attached</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">DC is currently unpaid or awaiting payment collection.</p>
                            </div>
                          )
                        )}
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          No Payment Settlement Recorded
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Payment settlements, cash receipts, and bank transaction reconciliations for DC #{selectedDc.dcNo} will appear here once recorded.
                        </p>
                      </div>
                    )
                  )}
                </TabsContent>`;

const fixedPart = `                                {linkedBankTx?.description && (
                                  <div className="sm:col-span-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                      Bank Narration
                                    </span>
                                    <span
                                      className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 block truncate"
                                      title={linkedBankTx.description}
                                    >
                                      {linkedBankTx.description}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
                              <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">No active payment record attached</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">DC is currently unpaid or awaiting payment collection.</p>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-6 text-center space-y-2">
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 flex items-center justify-center mx-auto">
                          <Banknote className="w-5 h-5" />
                        </div>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          No Payment Settlement Recorded
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Payment settlements, cash receipts, and bank transaction reconciliations for DC #{selectedDc.dcNo} will appear here once recorded.
                        </p>
                      </div>
                    )}
                </TabsContent>`;

if (content.includes(brokenPartStart)) {
  content = content.replace(brokenPartStart, fixedPart);
  fs.writeFileSync(targetFile, content, 'utf8');
  console.log("Successfully fixed JSX syntax in SavedDcs.tsx!");
} else {
  console.log("brokenPartStart not found!");
}
