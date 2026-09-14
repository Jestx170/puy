import { toast } from "sonner";

/**
 * แปลง array ของ object เป็น CSV string
 * - รองรับ field ที่มี comma, quote, newline
 * - ใช้ double-quote escaping ตามมาตรฐาน RFC 4180
 */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns?: { key: keyof T; label: string }[],
): string {
  if (rows.length === 0) return "";

  // ถ้าไม่ระบุ columns ให้ใช้ keys ของ row แรก
  const cols =
    columns ??
    (Object.keys(rows[0] as Record<string, unknown>) as (keyof T)[]).map((k) => ({
      key: k,
      label: String(k),
    }));

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    let s = String(val);
    // ป้องกัน CSV/formula injection: ค่าที่ขึ้นต้นด้วย = + - @ \t อาจถูก Excel ประมวลผลเป็นสูตร
    if (/^[=+\-@\t]/.test(s)) {
      s = `'${s}`;
    }
    // ถ้ามี comma, quote, หรือ newline ต้อง wrap ด้วย double-quote
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = cols.map((c) => escape(c.label)).join(",");
  const body = rows.map((row) => cols.map((c) => escape(row[c.key])).join(",")).join("\n");

  return `${header}\n${body}`;
}

/**
 * ดาวน์โหลด CSV ไฟล์ พร้อม toast แจ้ง
 */
export function downloadCSV(filename: string, csv: string): void {
  // เพิ่ม BOM เพื่อให้ Excel เปิดแล้วอ่าน UTF-8 ภาษาไทยได้
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // ล้าง URL หลัง 100ms
  setTimeout(() => URL.revokeObjectURL(url), 100);
  toast.success(`ส่งออก ${filename} แล้ว`, {
    description: `${csv.split("\n").length - 1} รายการ`,
  });
}

/**
 * Helper สำหรับ export ง่าย ๆ — รับ rows + columns + filename
 */
export function exportToCSV<T extends Record<string, unknown>>(
  rows: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[],
): void {
  if (rows.length === 0) {
    toast.error("ไม่มีข้อมูลให้ส่งออก");
    return;
  }
  const csv = toCSV(rows, columns);
  downloadCSV(filename, csv);
}
