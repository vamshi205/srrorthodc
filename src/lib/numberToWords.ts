/**
 * Converts a numeric amount to Indian English words.
 * Example: 15420.50 -> "Rupees Fifteen Thousand Four Hundred Twenty and Fifty Paise Only"
 */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"
];

const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
];

function convertUnderThousand(num: number): string {
  let str = "";
  if (num >= 100) {
    str += ONES[Math.floor(num / 100)] + " Hundred ";
    num %= 100;
  }
  if (num >= 20) {
    str += TENS[Math.floor(num / 10)] + " ";
    if (num % 10 > 0) {
      str += ONES[num % 10] + " ";
    }
  } else if (num > 0) {
    str += ONES[num] + " ";
  }
  return str.trim();
}

export function numberToIndianWords(amount: number): string {
  if (!amount || isNaN(amount) || amount === 0) {
    return "Zero Rupees Only";
  }

  const rounded = Math.round(amount * 100) / 100;
  const isNegative = rounded < 0;
  const absAmount = Math.abs(rounded);

  let integerPart = Math.floor(absAmount);
  const decimalPart = Math.round((absAmount - integerPart) * 100);

  const parts: string[] = [];

  // Crores (10,000,000)
  if (integerPart >= 10000000) {
    const crore = Math.floor(integerPart / 10000000);
    parts.push(`${convertUnderThousand(crore)} Crore`);
    integerPart %= 10000000;
  }

  // Lakhs (100,000)
  if (integerPart >= 100000) {
    const lakh = Math.floor(integerPart / 100000);
    parts.push(`${convertUnderThousand(lakh)} Lakh`);
    integerPart %= 100000;
  }

  // Thousands (1,000)
  if (integerPart >= 1000) {
    const thousand = Math.floor(integerPart / 1000);
    parts.push(`${convertUnderThousand(thousand)} Thousand`);
    integerPart %= 1000;
  }

  // Hundreds & Below
  if (integerPart > 0) {
    parts.push(convertUnderThousand(integerPart));
  }

  let words = parts.filter(Boolean).join(" ").trim();
  if (!words) {
    words = "Zero";
  }

  let result = `Rupees ${words}`;
  if (decimalPart > 0) {
    result += ` and ${convertUnderThousand(decimalPart)} Paise`;
  }
  result += " Only";

  return isNegative ? `Minus ${result}` : result;
}
