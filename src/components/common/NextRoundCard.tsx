import { useState } from "react";
import { Calendar, Package, ShoppingCart, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { currency } from "@/lib/format";
import { cultivationSchedulesApi } from "@/lib/api/cultivation-stages";
import type { NextRoundInfo, RecommendedProduct } from "@/types";

interface NextRoundCardProps {
  nextRound: NextRoundInfo;
  products: RecommendedProduct[];
  /** เรียกเมื่อกดปุ่มสั่งซื้อ — ส่ง productIds ไปให้หน้า POS/ออเดอร์ */
  onOrder?: (productIds: string[]) => void;
  /** เรียกเมื่อบันทึกการดูแลเสร็จ — เพื่อ refresh ข้อมูล */
  onCompleted?: () => void;
}

export function NextRoundCard({ nextRound, products, onOrder, onCompleted }: NextRoundCardProps) {
  const [recording, setRecording] = useState(false);

  const daysUntil = nextRound.daysUntilNext ?? 0;
  const isOverdue = daysUntil < 0;
  const isUrgent = daysUntil >= 0 && daysUntil <= 3;
  const isComingSoon = daysUntil > 3 && daysUntil <= 7;

  const tone = isOverdue || isUrgent ? "urgent" : isComingSoon ? "soon" : "normal";

  const toneClass: Record<typeof tone, string> = {
    urgent: "border-destructive/40 bg-destructive/5",
    soon: "border-warning/40 bg-warning/5",
    normal: "",
  };

  const badgeClass: Record<typeof tone, string> = {
    urgent: "bg-destructive/10 text-destructive border-destructive/25",
    soon: "bg-warning/15 text-warning border-warning/30",
    normal: "bg-muted text-muted-foreground border-border",
  };

  const badgeLabel: Record<typeof tone, string> = {
    urgent: isOverdue ? "เลยกำหนด" : "ด่วน",
    soon: "ใกล้ถึง",
    normal: "ปกติ",
  };

  const totalValue = products.reduce((sum, p) => sum + p.price, 0);
  const hasLowStock = products.some((p) => p.stock <= 0);

  const handleRecordDone = async () => {
    if (!nextRound.nextStageId) return;
    setRecording(true);
    try {
      await cultivationSchedulesApi.create({
        cultivationId: nextRound.cultivationId,
        stageId: nextRound.nextStageId,
        sequence: nextRound.nextSequence,
      });
      toast.success("บันทึกการดูแลเรียบร้อย — คำนวณรอบถัดไปใหม่แล้ว");
      onCompleted?.();
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className={`card-soft p-4 ${toneClass[tone]}`}>
      {/* หัวการ์ด: stage ปัจจุบัน → ถัดไป */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">ระยะปัจจุบัน</p>
          <p className="truncate text-sm font-semibold">
            {nextRound.currentEmoji} {nextRound.currentStageName ?? "—"}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">รอบถัดไป</p>
          <p className="truncate text-sm font-semibold text-primary">
            {nextRound.nextEmoji} {nextRound.nextStageName ?? "—"}
          </p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${badgeClass[tone]}`}>
          {badgeLabel[tone]}
        </Badge>
      </div>

      {/* วันที่ควรทำ */}
      <div className="mt-3 flex items-center gap-2 text-sm">
        <Calendar className="size-4 text-muted-foreground" />
        {isOverdue ? (
          <span className="font-semibold text-destructive">เลยกำหนด {Math.abs(daysUntil)} วัน</span>
        ) : daysUntil === 0 ? (
          <span className="font-semibold text-destructive">ควรทำวันนี้</span>
        ) : (
          <span>
            ควรทำอีก <span className="font-semibold">{daysUntil}</span> วัน
            {nextRound.nextActionDate && (
              <span className="text-muted-foreground"> ({nextRound.nextActionDate})</span>
            )}
          </span>
        )}
      </div>

      {/* คำอธิบายระยะ */}
      {nextRound.nextDescription && (
        <p className="mt-1.5 text-xs text-muted-foreground">{nextRound.nextDescription}</p>
      )}

      {/* สินค้าที่ต้องใช้ */}
      {products.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            สินค้าที่ต้องใช้ ({products.length} รายการ)
          </p>
          {products.map((product) => (
            <div
              key={product.productId}
              className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Package className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.productName}</p>
                  {product.formula && (
                    <p className="truncate text-xs text-muted-foreground">{product.formula}</p>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums">{currency(product.price)}</p>
                <p
                  className={`text-xs tabular-nums ${
                    product.stock <= 0 ? "text-destructive" : "text-muted-foreground"
                  }`}
                >
                  คงเหลือ {product.stock}
                </p>
              </div>
            </div>
          ))}

          {/* รวม + แจ้งเตือนสต็อก */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">มูลค่ารวม</span>
            <span className="text-sm font-bold tabular-nums">{currency(totalValue)}</span>
          </div>
          {hasLowStock && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5" />
              บางรายการสต็อกไม่พอ
            </div>
          )}
        </div>
      )}

      {/* ปุ่ม action */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          variant={tone === "urgent" ? "destructive" : "default"}
          onClick={() => onOrder?.(products.map((p) => p.productId))}
          disabled={products.length === 0}
        >
          <ShoppingCart className="size-4" /> สั่งซื้อ
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRecordDone}
          disabled={recording || !nextRound.nextStageId}
        >
          {recording ? "กำลังบันทึก..." : "บันทึกทำแล้ว"}
        </Button>
      </div>
    </div>
  );
}
