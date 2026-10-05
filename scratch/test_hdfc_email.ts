import { parseHdfcEmailAlert } from '../src/services/gmailConnectorService.ts';

const text = `HDFC BANK 
 
Dear Customer,

Greetings from HDFC Bank!

We're writing to inform you that Rs.3.00 has been successfully credited to 
your HDFC Bank account ending in 1538.

Transaction Details: 
a. Date: 05-10-26 
b. Sender: ANANTHULA NAGA VAMSHI KRISHNA (VPA: sendtovamshi@axl) 
c. UPI Reference No.: 178728327427`;

console.log('Includes 1538?', text.includes('1538'));
console.log('Regex 1538 test:', /1538/.test(text));

const res = parseHdfcEmailAlert(text, [
  { id: 'acc_1538', accountName: 'HDFC (1538)', bankName: 'HDFC', accountNumber: '1538', accountType: 'savings', isDefault: true, currentBalance: 0, createdAt: 0, updatedAt: 0 }
] as any);

console.log('Parsed:', res);
