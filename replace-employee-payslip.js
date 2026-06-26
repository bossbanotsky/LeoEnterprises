const fs = require('fs');
const path = require('path');

const fileToEdit = path.join(__dirname, 'src', 'components', 'EmployeeDashboard.tsx');
let content = fs.readFileSync(fileToEdit, 'utf8');

// We want to replace the entire inner content of <div ref={payslipRef} ...>
// It starts after the opening tag of payslipRef:
// className="p-4 max-h-[90vh] overflow-y-auto payslip-mockup bg-black font-sans text-xs" \n            >
// and ends before the closing </div> of payslipRef, which is followed by \n            )}

const startToken = `className="p-4 max-h-[90vh] overflow-y-auto payslip-mockup bg-black font-sans text-xs" \n            >`;
const endToken = `            </div>\n            )}`;

const startIndex = content.indexOf(startToken);
if (startIndex === -1) {
  console.error("Start token not found!");
  process.exit(1);
}

const endIndex = content.indexOf(endToken, startIndex);
if (endIndex === -1) {
  console.error("End token not found!");
  process.exit(1);
}

const before = content.substring(0, startIndex).trim() + ` className="p-8 payslip-mockup bg-white font-sans text-xs text-slate-900 border border-slate-200 rounded-xl select-none" \n            >`;
const after = content.substring(endIndex);

const newInnerContent = `
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-white border border-slate-200 rounded-full flex items-center justify-center overflow-hidden shrink-0">
                    <img 
                      src="/src/assets/images/lp_logo_final_1781661072015.jpg" 
                      alt="L&P Logo" 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                  <div>
                    <h2 className="text-[17px] font-extrabold text-slate-900 tracking-tight leading-none uppercase">
                      L&P TRADING AND SERVICES
                    </h2>
                    <div className="text-[11px] font-semibold text-slate-500 mt-1">
                      Santa Maria, Bauan, Batangas.
                    </div>
                    <div className="text-[9px] font-medium text-slate-400 mt-0.5">
                      Phone: +639946064463 &nbsp;&nbsp; TIN: 000-000-000-000
                    </div>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 font-extrabold text-[10px] uppercase tracking-wider">
                    OFFICIAL PAYSLIP
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mt-2.5">
                    {format(parseISO(selectedPayslip.generatedAt || selectedPayslip.createdAt || new Date().toISOString()), 'MMMM dd, yyyy')}
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 my-4" />

              {/* Employee and Payroll Period */}
              <div className="grid grid-cols-3 gap-4 mb-4 text-left">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">EMPLOYEE NAME</div>
                  <div className="text-[15px] font-extrabold text-slate-950 mt-1 tracking-tight">
                    {selectedPayslip.employee?.fullName || selectedPayslip.employeeName}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PAYROLL PERIOD</div>
                  <div className="text-[15px] font-extrabold text-slate-950 mt-1 tracking-tight">
                    {format(parseISO(selectedPayslip.startDate), 'yyyy-MM-dd')} to {format(parseISO(selectedPayslip.endDate), 'yyyy-MM-dd')}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PERIOD DAYS</div>
                  <div className="text-[15px] font-extrabold text-slate-950 mt-1 tracking-tight">
                    {Math.round((parseISO(selectedPayslip.endDate).getTime() - parseISO(selectedPayslip.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} Days
                  </div>
                </div>
              </div>

              <div className="border-b border-slate-200 my-4" />

              {/* Metrics Card Row */}
              <div className="grid grid-cols-6 border border-slate-200 rounded-xl bg-slate-50/50 py-3 px-1 mb-5 text-center items-center">
                <div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">PRESENT (P)</div>
                  <div className="text-[18px] font-extrabold text-slate-900 mt-1">{selectedPayslip.totalPresent || 0}</div>
                </div>
                <div className="border-l border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ABSENT (A)</div>
                  <div className="text-[18px] font-extrabold text-red-500 mt-1">{selectedPayslip.totalAbsent || 0}</div>
                </div>
                <div className="border-l border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">HALFDAY (HD)</div>
                  <div className="text-[18px] font-extrabold text-amber-500 mt-1">{selectedPayslip.totalHalfDays || 0}</div>
                </div>
                <div className="border-l border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">UNDERTIME (UT)</div>
                  <div className="text-[18px] font-extrabold text-amber-500 mt-1">{selectedPayslip.totalUndertimeDays || 0}</div>
                </div>
                <div className="border-l border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">OVERTIME (OT)</div>
                  <div className="text-[18px] font-extrabold text-emerald-600 mt-1 font-mono">
                    {selectedPayslip.totalOtHours ? \`\${selectedPayslip.totalOtHours}h\` : '0h'}
                  </div>
                </div>
                <div className="border-l border-slate-200">
                  <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">BASIC DAILY RATE</div>
                  <div className="text-[18px] font-extrabold text-slate-900 mt-1">
                    ₱{(selectedPayslip.employee?.dailySalary || selectedPayslip.baseRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Main 2 Column Details */}
              <div className="grid grid-cols-2 gap-8 text-left">
                {/* Left Column: Earnings */}
                <div>
                  <div className="flex justify-between items-center font-bold text-[10px] text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-2.5">
                    <span>EARNINGS BREAKDOWN</span>
                    <span className="font-bold text-slate-950">VALUE</span>
                  </div>

                  <div className="space-y-2 text-[11px] font-medium text-slate-700">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className={\`h-5 w-5 rounded-md shrink-0 flex items-center justify-center transition-all \${selectedPayslip.isAttendancePaid ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}\`}>
                          <CheckCircle className="w-3 h-3" />
                        </div>
                        <span>Present: {selectedPayslip.totalPresent || 0} Day(s) x ₱{(selectedPayslip.baseRate || 0).toLocaleString()}</span>
                      </div>
                      <span className="font-bold text-slate-900">₱{(selectedPayslip.presentEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>

                    {selectedPayslip.totalHalfDays > 0 && (
                      <div className="flex justify-between">
                        <span>Half-Day: {selectedPayslip.totalHalfDays} Day(s) x ₱{((selectedPayslip.baseRate || 0) / 2).toLocaleString()}</span>
                        <span className="font-bold text-slate-900">₱{(selectedPayslip.hdEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {selectedPayslip.totalUndertimeDays > 0 && (
                      <div className="flex justify-between">
                        <span>Undertime: {selectedPayslip.totalUndertimeDays} Day(s) ({((selectedPayslip.totalUndertimeDays * 8) - selectedPayslip.totalUndertimeHours).toFixed(1)} hrs total)</span>
                        <span className="font-bold text-slate-900">₱{(selectedPayslip.utEarnings || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {selectedPayslip.totalOtHours > 0 && (
                      <div className="bg-emerald-50 text-emerald-800 rounded-lg px-2 py-1.5 mt-2">
                        <div className="flex justify-between items-center text-[11px] font-bold">
                          <span>Total Overtime: {selectedPayslip.totalOtHours} hrs</span>
                          <span>₱{(selectedPayslip.otPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="text-[9px] text-emerald-600 mt-0.5">Applied rate: 1x</div>
                      </div>
                    )}

                    {selectedPayslip.totalPakyawPay > 0 && (
                      <div className="bg-purple-50 text-purple-800 rounded-lg px-2 py-1.5 mt-2 flex flex-col gap-1">
                        <div className="flex justify-between items-center text-[11px] font-bold">
                          <span>Pakyaw Earnings</span>
                          <span>₱{(selectedPayslip.totalPakyawPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        {selectedPayslip.pakyawItems && selectedPayslip.pakyawItems.length > 0 && (
                          <div className="space-y-1 mt-1">
                            {selectedPayslip.pakyawItems.map((item, dIdx) => (
                              <div key={dIdx} className="flex justify-between items-center text-[10px] pl-2 border-l border-purple-200">
                                <div className="flex items-center gap-1.5">
                                  <div className={\`h-4.5 w-4.5 rounded-sm shrink-0 flex items-center justify-center transition-all \${item.isPaid ? 'bg-purple-600 text-white' : 'bg-slate-100 border border-slate-200'}\`}>
                                    <CheckCircle className="w-2.5 h-2.5" />
                                  </div>
                                  <span className="truncate max-w-[120px] font-medium text-purple-900">{item.description}</span>
                                </div>
                                <span className="font-bold text-purple-900">₱{(item.amount || 0).toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedPayslip.totalAdjustments !== 0 && (
                      <div className="bg-blue-50 text-blue-800 rounded-lg px-2 py-1.5 mt-2">
                        <div className="flex justify-between items-center text-[11px] font-bold">
                          <span>Manual Adjustments</span>
                          <span className={selectedPayslip.totalAdjustments > 0 ? 'text-emerald-700' : 'text-red-700'}>
                            {selectedPayslip.totalAdjustments > 0 ? '+' : ''}₱{(selectedPayslip.totalAdjustments || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        {selectedPayslip.adjustments && selectedPayslip.adjustments.map((adj, i) => (
                          <div key={i} className="text-[9px] text-blue-600 mt-0.5 ml-2">
                            ● {adj.description}: {adj.type === 'deduction' ? '-' : '+'}₱{adj.amount.toLocaleString()}
                          </div>
                        ))}
                      </div>
                    )}

                    {selectedPayslip.carryOverFromPrevious > 0 && (
                      <div className="bg-amber-50 text-amber-800 rounded-lg px-2 py-1.5 mt-2 flex justify-between items-center text-[11px] font-bold">
                        <span>Debt Carry-Over (Prev)</span>
                        <span>₱{(selectedPayslip.carryOverFromPrevious || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {selectedPayslip.cashAdvanceDeduction > 0 && (
                      <div className="bg-red-50 text-red-800 rounded-lg px-2 py-1.5 mt-2 flex justify-between items-center text-[11px] font-bold">
                        <span>Cash Advance Deduction</span>
                        <span>-₱{(selectedPayslip.cashAdvanceDeduction || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {selectedPayslip.isAttendancePaid && (
                      <div className="bg-slate-50 text-slate-800 rounded-lg px-2 py-1.5 mt-2 flex justify-between items-center text-[11px] font-bold">
                        <span>Daily Paid (Attendance)</span>
                        <span>-₱{((selectedPayslip.regularPay || 0) + (selectedPayslip.otPay || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {selectedPayslip.pakyawItems?.some(i => i.isPaid) && (
                      <div className="bg-indigo-50 text-indigo-800 rounded-lg px-2 py-1.5 mt-2 flex justify-between items-center text-[11px] font-bold">
                        <span>Paid Pakyaw</span>
                        <span>-₱{selectedPayslip.pakyawItems.filter(i => i.isPaid).reduce((sum, i) => sum + (i.amount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t-2 border-slate-900 my-4" />

                  <div className="flex justify-between items-center">
                    <span className="text-[12px] font-extrabold text-slate-950 uppercase tracking-wider">NET TAKE HOME PAY</span>
                    <span className="text-[22px] font-black text-slate-950 tracking-tight">
                      ₱{Math.max(0, (Number(selectedPayslip.totalEarnings || selectedPayslip.totalGrossPay || 0)) - 
                        (selectedPayslip.carryOverFromPrevious || 0) - 
                        (selectedPayslip.cashAdvanceDeduction || 0) - 
                        (selectedPayslip.isAttendancePaid ? (Number(selectedPayslip.regularPay || 0) + (selectedPayslip.otPay || 0)) : 0) -
                        (selectedPayslip.pakyawItems?.filter(i => i.isPaid).reduce((sum, i) => sum + (i.amount || 0), 0) || 0)
                      ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="mt-8 flex flex-col justify-start items-start w-3/4">
                    <div className="font-serif text-[12px] italic text-slate-400 select-none tracking-wider mb-1 pl-4 h-5">
                      digital_sign_valid
                    </div>
                    <div className="w-full border-t border-slate-300 my-1" />
                    <span className="text-[9px] font-extrabold text-slate-900 uppercase tracking-wider leading-none">AUTHORIZED SIGNATURE</span>
                    <span className="text-[8px] text-slate-500 font-medium mt-0.5 leading-none">FINANCE DEPARTMENT</span>
                  </div>
                </div>

                {/* Right Column: Logs */}
                <div>
                  <div className="font-bold text-[10px] text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-1.5 mb-2.5">
                    CHRONOLOGICAL AUDIT LOG
                  </div>

                  {/* Dates Present */}
                  <div className="space-y-1.5 mb-3.5">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">DATES PRESENT:</span>
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2 text-[11px] text-slate-700 font-semibold tracking-wide flex flex-wrap gap-x-2 gap-y-1">
                      {selectedPayslip.dailyAttendanceLog && selectedPayslip.dailyAttendanceLog.filter(log => log.status === 'present').length > 0 ? (
                        selectedPayslip.dailyAttendanceLog
                          .filter(log => log.status === 'present')
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((log, i, arr) => (
                            <span key={i} className="flex items-center">
                              {format(parseISO(log.date), 'MM-dd')}
                              {i < arr.length - 1 && <span className="text-emerald-300 ml-2">•</span>}
                            </span>
                          ))
                      ) : (
                        <span className="text-slate-400 italic font-medium">No days present</span>
                      )}
                    </div>
                  </div>

                  {/* Undertime Records */}
                  <div className="space-y-1.5 mb-3.5">
                    <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">UNDERTIME RECORDS:</span>
                    <div className="bg-amber-50/70 border border-amber-100 rounded-xl px-3 py-2 text-[11px] text-slate-700 font-semibold tracking-wide flex flex-wrap gap-x-2 gap-y-1">
                      {selectedPayslip.dailyAttendanceLog && selectedPayslip.dailyAttendanceLog.filter(log => log.status === 'undertime').length > 0 ? (
                        selectedPayslip.dailyAttendanceLog
                          .filter(log => log.status === 'undertime')
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((log, i, arr) => {
                            const undertimeHrs = 8 - log.regHrs;
                            return (
                              <span key={i} className="flex items-center">
                                {format(parseISO(log.date), 'MM-dd')}({undertimeHrs.toFixed(undertimeHrs % 1 === 0 ? 0 : 1)}h)
                                {i < arr.length - 1 && <span className="text-amber-300 ml-2">•</span>}
                              </span>
                            );
                          })
                      ) : (
                        <span className="text-slate-400 italic font-medium">No undertime records</span>
                      )}
                    </div>
                  </div>

                  {/* Overtime Sessions */}
                  <div className="space-y-1.5 mb-3.5">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">OVERTIME SESSIONS:</span>
                    <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl px-3 py-2 text-[11px] text-slate-700 font-semibold tracking-wide flex flex-wrap gap-x-2 gap-y-1">
                      {selectedPayslip.dailyAttendanceLog && selectedPayslip.dailyAttendanceLog.filter(log => log.otHrs > 0).length > 0 ? (
                        selectedPayslip.dailyAttendanceLog
                          .filter(log => log.otHrs > 0)
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((log, i, arr) => (
                            <span key={i} className="flex items-center">
                              {format(parseISO(log.date), 'MM-dd')}({log.otHrs.toFixed(log.otHrs % 1 === 0 ? 0 : 1)}h)
                              {i < arr.length - 1 && <span className="text-emerald-300 ml-2">•</span>}
                            </span>
                          ))
                      ) : (
                        <span className="text-slate-400 italic font-medium">No overtime sessions</span>
                      )}
                    </div>
                  </div>

                  {/* Absenteeism Record */}
                  <div className="space-y-1.5 mb-3.5">
                    <span className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">ABSENTEEISM RECORD:</span>
                    <div className="bg-rose-50/70 border border-rose-100 rounded-xl px-3 py-2 text-[11px] text-slate-700 font-semibold tracking-wide flex flex-wrap gap-x-2 gap-y-1">
                      {selectedPayslip.dailyAttendanceLog && selectedPayslip.dailyAttendanceLog.filter(log => log.status === 'absent').length > 0 ? (
                        selectedPayslip.dailyAttendanceLog
                          .filter(log => log.status === 'absent')
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((log, i, arr) => (
                            <span key={i} className="flex items-center">
                              {format(parseISO(log.date), 'MM-dd')}
                              {i < arr.length - 1 && <span className="text-rose-300 ml-2">•</span>}
                            </span>
                          ))
                      ) : (
                        <span className="text-slate-400 italic font-medium">No absences</span>
                      )}
                    </div>
                  </div>

                  {/* Half-day Records */}
                  {selectedPayslip.dailyAttendanceLog && selectedPayslip.dailyAttendanceLog.some(log => log.status === 'halfday') && (
                    <div className="space-y-1.5 mb-3.5">
                      <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">HALFDAY RECORDS:</span>
                      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-3 py-2 text-[11px] text-slate-700 font-semibold tracking-wide flex flex-wrap gap-x-2 gap-y-1">
                        {selectedPayslip.dailyAttendanceLog
                          .filter(log => log.status === 'halfday')
                          .sort((a, b) => a.date.localeCompare(b.date))
                          .map((log, i, arr) => (
                            <span key={i} className="flex items-center">
                              {format(parseISO(log.date), 'MM-dd')}
                              {i < arr.length - 1 && <span className="text-indigo-300 ml-2">•</span>}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Employee Signature */}
                  <div className="mt-8 flex flex-col justify-end items-end w-full">
                    <div className="w-2/3 border-t border-slate-300 my-1" />
                    <div className="flex flex-col items-center w-2/3 text-center">
                      <span className="text-[9px] font-extrabold text-slate-900 uppercase tracking-wider leading-none">EMPLOYEE SIGNATURE</span>
                      <span className="text-[8px] text-slate-500 font-medium mt-1 leading-none">DATE RECEIVED: ________________</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400 font-mono">
                <span>ID: {selectedPayslip.id}</span>
                <span>Generated via L&P Payroll System</span>
              </div>
`;

const newContent = before + newInnerContent + after;
fs.writeFileSync(fileToEdit, newContent, 'utf8');
console.log("Successfully replaced the inner content of payslipRef in EmployeeDashboard.tsx!");
