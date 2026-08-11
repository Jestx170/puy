// ============================================================
// Fieldstone ERP — Format utilities
// ฟังก์ชัน format ตัวเลข/เงิน ใช้ทั่วโปรเจกต์
// ============================================================

/** format เงินบาทเต็ม เช่น ฿9,124 */
export const currency = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(n);

/** format เงินบาทแบบย่อ เช่น ฿1.2M */
export const compactCurrency = (n: number) =>
  "฿" + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** format ตัวเลขธรรมดา เช่น 1,284 */
export const numberFmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
