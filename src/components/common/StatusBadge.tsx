import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const toneClass: Record<Tone, string> = {
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/15 text-warning border-warning/30",
  danger: "bg-destructive/10 text-destructive border-destructive/25",
  info: "bg-info/12 text-info border-info/25",
  neutral: "bg-muted text-muted-foreground border-border",
};

const map: Record<string, { label: string; tone: Tone }> = {
  active: { label: "พร้อมขาย", tone: "success" },
  low: { label: "ใกล้หมด", tone: "warning" },
  out: { label: "สินค้าหมด", tone: "danger" },
  draft: { label: "ฉบับร่าง", tone: "neutral" },
  paid: { label: "ชำระแล้ว", tone: "success" },
  pending: { label: "รอดำเนินการ", tone: "warning" },
  processing: { label: "กำลังจัดส่ง", tone: "info" },
  cancelled: { label: "ยกเลิก", tone: "danger" },
  refunded: { label: "คืนเงิน", tone: "neutral" },
  completed: { label: "สำเร็จ", tone: "success" },
  scheduled: { label: "ตั้งเวลา", tone: "info" },
  ended: { label: "สิ้นสุด", tone: "neutral" },
  paused: { label: "หยุดชั่วคราว", tone: "warning" },
  invited: { label: "รอตอบรับ", tone: "info" },
  suspended: { label: "ระงับใช้งาน", tone: "danger" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const entry = map[status] ?? { label: status, tone: "neutral" as Tone };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
        toneClass[entry.tone],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {entry.label}
    </span>
  );
}
