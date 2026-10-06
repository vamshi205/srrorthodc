const fs = require('fs');
const path = 'c:\\Users\\Admin\\Documents\\srrprojects\\orthodc\\srrorthodc\\src\\components\\ortho\\OrthoApp.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">[\s\S]*?<\/div>\s*<\/div>\s*\) : \(/m;

const newContent = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <Label className="text-sm font-semibold">
                            Hospital / Clinic Name <span className="text-destructive">*</span>
                          </Label>
                          <div className="mt-1.5">
                            <HospitalSelect
                              id="hospital-name-input-step1"
                              value={hospitalName}
                              onChange={handleHospitalChange}
                              placeholder="Search or enter hospital name..."
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">Doctor / Surgeon Name</Label>
                          <div className="mt-1.5">
                            <DoctorSelect
                              id="doctor-name-input-step1"
                              value={doctorName}
                              onChange={setDoctorName}
                              hospitalName={hospitalName}
                              placeholder="Select Dr. Name..."
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">
                            DC Number <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            value={dcNo}
                            onChange={(e) => setDcNo(e.target.value)}
                            placeholder="Enter DC No. (e.g. 1024)"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">Delivered By</Label>
                          <div className="mt-1.5">
                            <PersonnelSelect
                              value={deliveredBy}
                              onChange={setDeliveredBy}
                              placeholder="Select delivery personnel..."
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">Received By (OT Desk / Staff)</Label>
                          <Input
                            value={receivedBy}
                            onChange={(e) => setReceivedBy(e.target.value)}
                            placeholder="Recipient Name / Staff"
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label className="text-sm font-semibold">DC Date</Label>
                          <Input
                            type="date"
                            value={customDcDate}
                            onChange={(e) => setCustomDcDate(e.target.value)}
                            className="mt-1.5"
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t flex justify-end">
                        <Button
                          onClick={() => {
                            if (!hospitalName.trim()) {
                              toast({
                                title: 'Hospital Name Required',
                                description: 'Please select or enter a hospital name to proceed to procedure selection.',
                                variant: 'destructive',
                              });
                              return;
                            }
                            setAutoDcStep('procedures');
                          }}
                          className="w-full sm:w-auto h-11 px-8 gap-2"
                        >
                          <span>Submit Details &amp; Select Procedure</span>
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (`;

content = content.replace(regex, newContent);
fs.writeFileSync(path, content);
console.log("Simplified inputs for Step 1.");
