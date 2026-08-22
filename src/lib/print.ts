// ============================================================
// Fieldstone ERP — Print utility
// พิมพ์ใบเสร็จผ่านหน้าต่างเบราว์เซอร์ (window.print)
// เปิดหน้าต่างใหม่พร้อม layout ใบเสร็จแล้วเรียก print dialog
// ============================================================

export interface ReceiptLine {
  name: string;
  qty: number;
  unit?: string;
  price: number;
}

export interface ReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  /** ชื่อเอกสาร เช่น "ใบเสนอราคา" (ค่าเริ่มต้น "ใบเสร็จ") */
  docTitle?: string | undefined;
  /** ข้อความปิดท้าย (ค่าเริ่มต้นเป็นข้อความขอบคุณ) */
  footerText?: string | undefined;
  receiptNo: string;
  date: string;
  customer?: string | undefined;
  salesperson?: string | undefined;
  channel?: string | undefined;
  lines: ReceiptLine[];
  subtotal: number;
  discountPct?: number | undefined;
  discountAmt?: number | undefined;
  vat?: number | undefined;
  total: number;
  payment?: string | undefined;
  note?: string | undefined;
}

const THB = (n: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  }).format(n);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReceiptHTML(r: ReceiptData): string {
  const linesHtml = r.lines
    .map(
      (l) => `
      <tr>
        <td class="name">${esc(l.name)}${l.unit ? ` <span class="unit">(${esc(l.unit)})</span>` : ""}</td>
        <td class="num">${l.qty}</td>
        <td class="num">${THB(l.price)}</td>
        <td class="num">${THB(l.price * l.qty)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    r.discountAmt && r.discountAmt > 0
      ? `<div class="row"><span>ส่วนลด${r.discountPct ? ` ${r.discountPct}%` : ""}</span><span class="num">-${THB(r.discountAmt)}</span></div>`
      : "";

  const vatRow =
    r.vat && r.vat > 0
      ? `<div class="row"><span>ภาษีมูลค่าเพิ่ม 7%</span><span class="num">${THB(r.vat)}</span></div>`
      : "";

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>ใบเสร็จ ${esc(r.receiptNo)}</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Sukhumvit Set", "Thonburi", "Noto Sans Thai", system-ui, sans-serif;
    color: #1a1a1a;
    margin: 0;
    padding: 4mm;
    max-width: 80mm;
    font-size: 12px;
    line-height: 1.5;
  }
  .header { text-align: center; margin-bottom: 8px; }
  .header h1 { font-size: 16px; margin: 0; font-weight: 700; }
  .header p { margin: 2px 0; font-size: 11px; color: #555; }
  .header .doctitle { margin-top: 5px; font-size: 13px; font-weight: 700; color: #1a1a1a; letter-spacing: 0.5px; }
  .divider { border-top: 1px dashed #aaa; margin: 8px 0; }
  .meta { font-size: 11px; margin-bottom: 6px; }
  .meta div { display: flex; justify-content: space-between; }
  .meta .label { color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { text-align: left; border-bottom: 1px solid #ccc; padding: 4px 2px; font-size: 10px; color: #555; }
  th.num, td.num { text-align: right; }
  td { padding: 3px 2px; vertical-align: top; }
  td.name { word-break: break-word; }
  .unit { color: #888; font-size: 10px; }
  .totals { margin-top: 8px; font-size: 12px; }
  .totals .row { display: flex; justify-content: space-between; padding: 1px 0; }
  .totals .grand { font-size: 14px; font-weight: 700; border-top: 2px solid #1a1a1a; padding-top: 4px; margin-top: 4px; }
  .grand .num { font-size: 16px; }
  .footer { text-align: center; margin-top: 12px; font-size: 11px; color: #555; }
  .note { text-align: center; font-size: 10px; color: #777; margin-top: 6px; }
  @media print { body { padding: 0; max-width: none; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${esc(r.storeName)}</h1>
    ${r.storeAddress ? `<p>${esc(r.storeAddress)}</p>` : ""}
    ${r.storePhone ? `<p>โทร. ${esc(r.storePhone)}</p>` : ""}
    ${r.docTitle ? `<p class="doctitle">${esc(r.docTitle)}</p>` : ""}
  </div>
  <div class="divider"></div>
  <div class="meta">
    <div><span class="label">เลขที่</span><span>${esc(r.receiptNo)}</span></div>
    <div><span class="label">วันที่</span><span>${esc(r.date)}</span></div>
    ${r.customer ? `<div><span class="label">ลูกค้า</span><span>${esc(r.customer)}</span></div>` : ""}
    ${r.salesperson ? `<div><span class="label">พนักงาน</span><span>${esc(r.salesperson)}</span></div>` : ""}
    ${r.channel ? `<div><span class="label">ช่องทาง</span><span>${esc(r.channel)}</span></div>` : ""}
  </div>
  <div class="divider"></div>
  <table>
    <thead>
      <tr><th>สินค้า</th><th class="num">จำนวน</th><th class="num">ราคา</th><th class="num">รวม</th></tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>
  <div class="divider"></div>
  <div class="totals">
    <div class="row"><span>ยอดรวม</span><span class="num">${THB(r.subtotal)}</span></div>
    ${discountRow}
    ${vatRow}
    <div class="row grand"><span>ยอดสุทธิ</span><span class="num">${THB(r.total)}</span></div>
  </div>
  ${r.payment ? `<div class="divider"></div><div class="meta"><div><span class="label">วิธีชำระ</span><span>${esc(r.payment)}</span></div></div>` : ""}
  ${r.note ? `<p class="note">${esc(r.note)}</p>` : ""}
  <div class="divider"></div>
  <div class="footer">${
    r.footerText
      ? esc(r.footerText).replace(/\n/g, "<br/>")
      : "ขอบคุณที่อุดหนุน<br/>ใบเสร็จนี้ใช้เป็นหลักฐานการรับสินค้า"
  }</div>
</body>
</html>`;
}

/**
 * เปิดหน้าต่างใหม่พร้อมใบเสร็จแล้วเรียก print dialog ของเบราว์เซอร์
 * ผู้ใช้เลือกเครื่องพิมพ์ได้จาก dialog เหมือนพิมพ์เอกสารทั่วไป
 */
export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHTML(data);
  const win = window.open("", "_blank", "width=420,height=640");
  if (!win) {
    // popup ถูกบล็อก — ใช้ hidden iframe แทน
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => iframe.remove(), 1000);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // รอให้ DOM render ก่อนเรียก print
  setTimeout(() => {
    win.print();
  }, 300);
}
