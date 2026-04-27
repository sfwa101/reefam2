// Force any number / string with Arabic-Indic digits to Latin (Western) digits.
const arabicIndic = /[\u0660-\u0669\u06F0-\u06F9]/g;
const map: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
};

export const toLatin = (input: string | number | null | undefined): string => {
  if (input === null || input === undefined) return "";
  return String(input).replace(arabicIndic, (d) => map[d] ?? d);
};

export const fmtMoney = (n: number) => `${toLatin(Math.round(n))} ج.م`;
