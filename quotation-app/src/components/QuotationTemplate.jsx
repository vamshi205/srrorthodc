import React, { memo } from 'react';
import logoImg from '../assets/logo.png';

const QuotationTemplate = memo(({ id = "quotation-template", data, company, content, forceScale }) => {
  const { hospitalName, doctorName, address, date, referenceNumber, discount, payment, gst, validity, warranty, make, delivery, subject, lineSpacing = 'standard' } = data;
  const { 
    name: companyName, 
    address: companyAddress, 
    phone: companyPhone, 
    email: companyEmail, 
    website: companyWebsite,
    signature,
    signatoryName = 'A. Padmavathi',
    signatoryRole = 'Proprietor'
  } = company || {};

  // Dynamic Spacing Config
  const spacing = {
    compact: {
      leading: 'leading-[1.1]',
      tablePy: 'py-0.5',
      tablePx: 'px-2',
      gap: 'mb-2',
      subGap: 'mb-1',
      fontSize: 'text-[9.5pt]'
    },
    standard: {
      leading: 'leading-[1.3]',
      tablePy: 'py-1.5',
      tablePx: 'px-3',
      gap: 'mb-4',
      subGap: 'mb-2',
      fontSize: 'text-[10pt]'
    },
    relaxed: {
      leading: 'leading-[1.6]',
      tablePy: 'py-3',
      tablePx: 'px-4',
      gap: 'mb-8',
      subGap: 'mb-4',
      fontSize: 'text-[11pt]'
    }
  }[lineSpacing] || spacing.standard;

  const numberToWords = (num) => {
    if (num === 0) return 'Zero';
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if ((num = num.toString()).length > 9) return 'overflow';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return ''; 
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
    return str.trim();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    // If it's a string that already looks like a formatted date or isn't a parseable date, return as is
    if (typeof dateStr === 'string' && (dateStr.includes('/') || isNaN(Date.parse(dateStr)))) {
      return dateStr;
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const containerRef = React.useRef(null);
  const contentRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    if (!containerRef.current || !contentRef.current) return;
    
    const updateScale = () => {
      if (typeof forceScale === 'number' && forceScale > 0) {
        setScale(forceScale);
        return;
      }

      const container = containerRef.current;
      const targetWidth = 794; // 210mm in px at 96dpi
      const targetHeight = 1123; // 297mm in px at 96dpi
      
      const availableWidth = container.clientWidth - (window.innerWidth < 768 ? 20 : 40);
      const availableHeight = container.clientHeight - 40;
      
      const scaleW = availableWidth / targetWidth;
      const scaleH = availableHeight / targetHeight;
      
      const isMobile = window.innerWidth < 768;
      let newScale = isMobile ? scaleW : Math.min(scaleW, scaleH, 1);

      setScale(newScale * 0.98);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    const timer = setTimeout(updateScale, 100);
    return () => {
      window.removeEventListener('resize', updateScale);
      clearTimeout(timer);
    };
  }, [data, company, content, forceScale]);

  const scaledWidth = Math.round(794 * scale);
  const scaledHeight = Math.round(1123 * scale);

  return (
    <div ref={containerRef} className="w-full h-full flex items-start justify-center overflow-auto p-2 sm:p-4 bg-[var(--apple-bg)] font-sans">
      {/* UI Wrapper with Shadow */}
      <div
        style={{
          width: `${scaledWidth}px`,
          height: `${scaledHeight}px`,
          position: 'relative'
        }}
        className="shrink-0 transition-all duration-150 my-2"
      >
        <div 
          id={id}
          ref={contentRef} 
          style={{ 
            transform: `scale(${scale})`, 
            transformOrigin: 'top left',
            width: '794px',
            height: '1123px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
            display: 'flex', 
            flexDirection: 'column'
          }}
          className="quotation-page bg-white text-black font-sans select-none p-[10mm] shrink-0 rounded-sm overflow-hidden transition-transform duration-150"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex-1">
              <h1 
                className="text-[17pt] text-slate-900 leading-tight uppercase whitespace-nowrap"
                style={{ fontFamily: "'Jost', sans-serif", fontWeight: 800, letterSpacing: '-0.02em' }}
              >
                {companyName}
              </h1>
              <div className="text-[9pt] text-slate-700 font-medium mt-1 leading-[1.15]">
                <p>{companyAddress}</p>
                <p>Phone: {companyPhone}</p>
                <p>Email: {companyEmail} | Website: {companyWebsite}</p>
              </div>
            </div>
            <div className="w-[72mm] ml-4 flex justify-end overflow-visible">
              <img 
                src={logoImg} 
                alt="Logo" 
                className="w-full object-contain max-h-[26mm]" 
                style={{ transform: 'translateX(45px)' }} 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = './logo.png';
                }} 
              />
            </div>
          </div>

          <div className="w-full h-[1.5px] bg-slate-900 mb-3"></div>

          <div className={`flex justify-between items-center ${spacing.gap} text-[11pt]`}>
            <div className="font-bold">Ref No: {referenceNumber}</div>
            <div className="font-bold text-right">Date: {formatDate(date)}</div>
          </div>

          <div className={`${spacing.subGap} text-[11pt]`}>
            <p className="font-bold mb-1">To</p>
            <div className="max-w-md">
              {hospitalName && (
                <p className="font-bold uppercase text-[12pt] mb-0.5">{hospitalName}</p>
              )}
              {doctorName && (
                <p className="font-bold text-[11pt] text-slate-900 mb-0.5">
                  Dr. {doctorName.replace(/^dr\.?\s*/i, '')}
                </p>
              )}
              {address && (
                <div className="text-left font-normal">
                  {address.split('\n').map((line, i) => (
                    <React.Fragment key={i}>{line}<br/></React.Fragment>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`${spacing.subGap} text-center text-[11pt]`}>
            <p className="font-bold mb-0.5 underline">Sub : {(subject || 'Quotation for Orthopedic Implants & instruments').replace(/^Sub\s*:\s*/i, '')}</p>
            <p className="font-bold">Kind attn: Department purchase</p>
          </div>

          {/* RENDER DYNAMIC TEMPLATE CONTENT */}
          <div className={spacing.subGap}>
            {content && content.length > 0 ? (
              content.map((block, idx) => (
                <div key={idx} className={`${idx === content.length - 1 ? '' : spacing.gap} text-[11pt] leading-[1.5]`}>
                  {block.type === 'text' ? (
                    <div className="text-left">
                      {(block.value || '').split('\n').map((line, i) => (
                        <React.Fragment key={i}>{line}<br/></React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <table className="w-full border-collapse mt-2" style={{ border: '1px solid #111' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f4f4f6' }}>
                          {block.headers.map((h, hi) => (
                            <th key={hi} className="py-1 px-2 text-center font-bold text-[10pt] uppercase" style={{ border: '1px solid #111' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => {
                              const headerName = (block.headers[ci] || '').toLowerCase();
                              const isItemCol = headerName.includes('item') || headerName.includes('desc') || headerName.includes('description');
                              const isHSNCol = headerName.includes('hsn');
                              const isAmountCol = headerName.includes('amount') || headerName.includes('rate') || headerName.includes('price') || headerName.includes('qty') || headerName.includes('quantity');
                              const isLong = (cell || '').toString().length > 30 || (cell || '').toString().includes('\n');
                              const lines = (cell || '').toString().split('\n');
                              const hasBullets = lines.some(line => line.trim().startsWith('-') || line.trim().startsWith('*'));
                              
                              let alignClass = 'text-center';
                              if (isItemCol || isLong || hasBullets) alignClass = 'text-left';
                              else if (isAmountCol) alignClass = 'text-right';
                              else if (isHSNCol) alignClass = 'text-center';

                              // Auto-format number cells if they look like numbers
                              let displayValue = cell;
                              if (isAmountCol && !isNaN(parseFloat(cell)) && isFinite(cell)) {
                                displayValue = parseFloat(cell).toFixed(2);
                              }

                              return (
                                <td 
                                  key={ci} 
                                  className={`${spacing.tablePy} ${spacing.tablePx} ${spacing.fontSize} ${spacing.leading} ${alignClass}`} 
                                  style={{ border: '1px solid #111', verticalAlign: 'top' }}
                                >
                                  {isAmountCol ? displayValue : lines.map((line, li) => {
                                    const isBullet = line.trim().startsWith('-') || line.trim().startsWith('*');
                                    // For HSN, we want to keep lines centered but allow multi-line matching
                                    return (
                                      <div key={li} className={`${isBullet ? 'pl-3 relative' : ''} ${isHSNCol ? 'text-center' : ''}`}>
                                        {isBullet && <span className="absolute left-0">•</span>}
                                        {isBullet ? line.trim().substring(1).trim() : line}
                                      </div>
                                    );
                                  })}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {(() => {
                          const headers = block.headers.map(h => h.toLowerCase());
                          const amountIdx = headers.findIndex(h => h === 'amount' || h === 'total');
                          if (amountIdx === -1) return null;
                          const subtotal = block.rows.reduce((sum, row) => sum + (parseFloat(row[amountIdx]) || 0), 0);
                          if (subtotal === 0) return null;
                          const gstStr = data.gst ? data.gst.toString() : '0';
                          const gstMatch = gstStr.match(/\d+(\.\d+)?/);
                          const gstPercent = gstMatch ? parseFloat(gstMatch[0]) : 0;
                          const gstAmount = subtotal * (gstPercent / 100);
                          const roundedTotal = Math.round(subtotal + gstAmount);
                          return (
                            <>
                              <tr>
                                <td colSpan={block.headers.length - 1} className="py-1 px-2 text-right font-bold text-[10pt]" style={{ border: '1px solid #111' }}>Subtotal</td>
                                <td className="py-1 px-2 text-right font-bold text-[10pt]" style={{ border: '1px solid #111' }}>{subtotal.toFixed(2)}</td>
                              </tr>
                              {gstPercent > 0 && (
                                <tr>
                                  <td colSpan={block.headers.length - 1} className="py-1 px-2 text-right font-bold text-[10pt]" style={{ border: '1px solid #111' }}>GST ({gstStr})</td>
                                  <td className="py-1 px-2 text-right font-bold text-[10pt]" style={{ border: '1px solid #111' }}>{gstAmount.toFixed(2)}</td>
                                </tr>
                              )}
                              <tr>
                                <td colSpan={block.headers.length - 1} className="py-1 px-2 text-right font-bold text-[10pt]" style={{ border: '1px solid #111', backgroundColor: '#f4f4f6' }}>Grand Total</td>
                                <td className="py-1 px-2 text-right font-bold text-[10pt]" style={{ border: '1px solid #111', backgroundColor: '#f4f4f6' }}>{roundedTotal.toFixed(2)}</td>
                              </tr>
                              <tr>
                                <td colSpan={block.headers.length} className="py-1 px-2 text-left font-bold text-[10pt] italic" style={{ border: '1px solid #111' }}>
                                  Amount in Words: Rupees {numberToWords(roundedTotal)}
                                </td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </table>
                  )}
                </div>
              ))
            ) : (
              <div className="p-10 text-slate-300 text-center border-2 border-dashed border-slate-100 rounded-3xl italic">
                Select a template from the sidebar to populate document content
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`${lineSpacing === 'compact' ? 'mt-1' : lineSpacing === 'relaxed' ? 'mt-2' : 'mt-4'} pt-1`}>
            <p className="font-bold underline mb-1 text-[11pt]">Terms and Conditions:</p>
            <table className={`w-full text-[11pt] ${spacing.leading} ${spacing.subGap}`}>
              <tbody>
                {make && <tr><td className="w-32 font-bold py-0.5">Make</td><td className="w-4 text-center">:</td><td>{make}</td></tr>}
                {delivery && <tr><td className="w-32 font-bold py-0.5">Delivery</td><td className="w-4 text-center">:</td><td>{delivery}</td></tr>}
                {payment && <tr><td className="w-32 font-bold py-0.5">Payment</td><td className="w-4 text-center">:</td><td>{payment}</td></tr>}
                {gst && <tr><td className="w-32 font-bold py-0.5">GST</td><td className="w-4 text-center">:</td><td>{gst}</td></tr>}
                {warranty && <tr><td className="w-32 font-bold py-0.5">Warranty</td><td className="w-4 text-center">:</td><td>{warranty}</td></tr>}
                {discount && <tr><td className="w-32 font-bold py-0.5">Discount</td><td className="w-4 text-center">:</td><td>{discount}</td></tr>}
                {validity && <tr><td className="w-32 font-bold py-0.5">Validity</td><td className="w-4 text-center">:</td><td>{formatDate(validity)}</td></tr>}
              </tbody>
            </table>

            <div className={`${spacing.subGap} text-[11pt] ${spacing.leading}`}>
              <p>We look forward to receive your valuable orders assuring you the best service all the time.</p>
              <p>Thanking you,</p>
            </div>

            <div className="flex justify-between items-end gap-10">
              <div className="flex-1">
                <p className="font-bold underline mb-2 text-[10pt]">Bank Details:</p>
                <div className="text-[9pt] leading-[1.3]">
                  <p><span className="font-bold">NAME:</span> <span className="uppercase">{companyName}</span></p>
                  <p><span className="font-bold">A/C NO:</span> <span className="bg-yellow-100 font-bold border-b border-black px-1">50200095456569</span></p>
                  <p><span className="font-bold">BANK NAME:</span> HDFC BANK, KALYAN NAGAR</p>
                  <p><span className="font-bold">IFSC:</span> HDFC0004348</p>
                </div>
              </div>
              <div className="text-center w-72 flex flex-col items-center">
                <p className="font-bold text-[10pt] w-full text-center">For {companyName.toUpperCase()}</p>
                <div className="h-12 w-full flex items-center justify-center overflow-hidden">
                  {signature ? (
                    <img 
                      src={signature} 
                      alt="Signature" 
                      className="max-h-12 max-w-[200px] object-contain block" 
                    />
                  ) : (
                    <div className="h-12"></div>
                  )}
                </div>
                <p className="font-bold text-[11pt] border-t border-black pt-1 w-full text-center">({signatoryName})</p>
                <p className="text-[9pt] font-medium italic w-full text-center">{signatoryRole}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default QuotationTemplate;
