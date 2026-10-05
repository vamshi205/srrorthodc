const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\pages\\SavedDcs.tsx';
let content = fs.readFileSync(path, 'utf8');

const targetStr = `                            </div>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              </>
            )}
          </CardContent>`;

const replacementStr = `                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
              </>
            )}
          </CardContent>`;

content = content.replace(targetStr, replacementStr);

fs.writeFileSync(path, content);
console.log("Replaced successfully!");
