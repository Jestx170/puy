import { useState } from "react";
import { Calendar, Package, ShoppingCart, AlertCircle, MapPin, Ruler } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/format";
import { cultivationSchedulesApi } from "@/lib/api/cultivation-stages";
import { setItemQty, type CareRecommendation, type PlotNextAction } from "@/lib/agronomy";
import type { Cultivation } from "@/types";

interface NextRoundCardProps {
  /** แปลงเพาะปลูก (เพื่อแสดงตัวตนแปลง) */
  cultivation: Cultivation;
  /** การดูแลถัดไปที่คำนวณจากโปรแกรม + ประวัติ */
  action: PlotNextAction;
  /** คำแนะนำสูตรของครั้งถัดไป (อาจเป็น null ถ้าไม่มีครั้งถัดไป) */
  recommendation: CareRecommendation | null;
  /**
   * เรียกเมื่อกดส่งไป POS — ส่ง payload ที่มีลูกค้า/แปลง/สูตร/จำนวน
   * (ไม่ใช่แค่ productIds อย่างเดียว)
   */
  onOrder?: (payload: {
    cultivationId: string;
    stageId: string | null;
    sequence: number | null;
    lines: { productId: string; qty: number; sku: string; label: string }[];
  }) => void;
  /** เรียกเมื่อบันทึกการดูแลเสร็จ — เพื่อ refresh ข้อมูล */
  onCompleted?: () => void;
}

export function NextRoundCard({
  cultivation,
  action,
  recommendation,
  onOrder,
  onCompleted,
}: NextRoundCardProps) {
  const [recording, setRecording] = useState(false);
  const [actionDate, setActionDate] = useState(""); // ว่าง = วันนี้ (เมื่อกดบันทึก)
  // draft จำนวนต่อกลุ่ม/SKU — พนักงานกรอกเอง
  const [qtys, setQtys] = useState<Record<string, number>>({});
  // draft สูตรที่เลือกในกลุ่มทางเลือก
  const [selectedAlt, setSelectedAlt] = useState<Record<string, string>>({});

  const daysUntil = action.recommendation ? null : null; // ไม่คำนวณวันถ้าไม่ทราบ
  const unknownDate = !cultivation.plantedDate;

  // สถานะแผน: ครบแผนหรือยัง
  const planComplete = action.planComplete;

  const handleRecordDone = async () => {
    if (!action.currentStageId) return;
    if (planComplete && !action.nextStageId) {
      toast.error("ครบแผนระยะสุดท้ายแล้ว — ไม่มีครั้งถัดไป");
      return;
    }
    setRecording(true);
    try {
      const stageId = action.nextSequence ? action.currentStageId : action.nextStageId;
      const sequence = action.nextSequence ?? 1;
      if (!stageId) {
        toast.error("ไม่พบระยะที่จะบันทึก — ตรวจสอบระยะของแปลง");
        return;
      }
      await cultivationSchedulesApi.create({
        cultivationId: cultivation.id,
        stageId,
        sequence,
        actionDate: actionDate || undefined, // ว่าง = วันนี้ ตามที่ API กำหนด
      } as { cultivationId: string; stageId: string; sequence: number; actionDate?: string });
      toast.success(`บันทึกการดูแล${actionDate ? ` วันที่ ${actionDate}` : ""} เรียบร้อย`);
      onCompleted?.();
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setRecording(false);
    }
  };

  const buildLines = () => {
    if (!recommendation) return [];
    const lines: { productId: string; qty: number; sku: string; label: string }[] = [];
    for (const group of recommendation.groups) {
      if (group.alternatives) {
        const selectedSku = selectedAlt[group.id];
        if (!selectedSku) continue;
        const item = group.items.find((i) => i.sku === selectedSku);
        if (item && item.product && (qtys[`${group.id}:${item.sku}`] ?? 0) > 0) {
          lines.push({
            productId: item.product.id,
            qty: qtys[`${group.id}:${item.sku}`]!,
            sku: item.sku,
            label: item.label,
          });
        }
      } else {
        for (const item of group.items) {
          const qty = qtys[`${group.id}:${item.sku}`] ?? 0;
          if (item.product && qty > 0) {
            lines.push({ productId: item.product.id, qty, sku: item.sku, label: item.label });
          }
        }
      }
    }
    return lines;
  };

  const lines = buildLines();
  const totalValue = lines.reduce((s, l) => {
    const p = recommendation?.groups.flatMap((g) => g.items).find((i) => i.sku === l.sku)?.product;
    return s + (p ? p.price * l.qty : 0);
  }, 0);

  const handleOrder = () => {
    if (lines.length === 0) {
      toast.error("ยังไม่ได้กรอกจำนวนสินค้า — เลือกสูตรและกรอกจำนวนก่อนส่งไป POS");
      return;
    }
    onOrder?.({
      cultivationId: cultivation.id,
      stageId: action.currentStageId,
      sequence: action.nextSequence,
      lines,
    });
  };

  return (
    <div className="card-soft p-4">
      {/* ตัวตนแปลง */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{cultivation.crop}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {cultivation.location && (
              <span className="flex items-center gap-0.5">
                <MapPin className="size-3" />
                {cultivation.location}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Ruler className="size-3" />
              {cultivation.area} ไร่
            </span>
          </p>
        </div>
        {planComplete ? (
          <Badge variant="outline" className="shrink-0 bg-muted text-muted-foreground">
            ครบแผน
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 bg-info/12 text-info border-info/25">
            ครั้งที่ {action.nextSequence} / {action.roundsMax}
          </Badge>
        )}
      </div>

      {/* ระยะปัจจุบัน → ถัดไป */}
      <div className="mt-3 space-y-1 text-xs">
        <p className="text-muted-foreground">
          ระยะปัจจุบัน:{" "}
          <span className="font-semibold text-foreground">{action.currentStageName ?? "—"}</span>
          {action.completedSequence > 0 && ` (ทำแล้ว ${action.completedSequence} ครั้ง)`}
        </p>
        {planComplete ? (
          <p className="text-primary">
            ครบแผน {action.roundsDefault} ครั้งแล้ว —{" "}
            {action.nextStageName
              ? `ยืนยันเปลี่ยนระยะเป็น "${action.nextStageName}" หรือเพิ่มครั้ง`
              : "อยู่ระยะสุดท้ายแล้ว"}
          </p>
        ) : (
          <p className="text-primary">
            ครั้งถัดไป: {recommendation?.stageName ?? action.currentStageName ?? "—"} ครั้งที่{" "}
            {action.nextSequence}
            {recommendation?.method ? ` (${recommendation.method})` : ""}
          </p>
        )}
      </div>

      {/* วันติดตาม — ไม่แสดง "ด่วนวันนี้" ถ้าไม่ทราบวัน */}
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="size-3.5 shrink-0" />
        {unknownDate
          ? "ยังไม่ทราบวันติดตาม — ใช้ระยะ/ครั้งเป็นหลัก"
          : daysUntil !== null && daysUntil <= 0
            ? "ถึงรอบดูแลแล้ว"
            : "วันติดตามตามประวัติการดูแล"}
      </div>

      {/* สูตร/สินค้าของครั้งถัดไป */}
      {recommendation && !planComplete && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {recommendation.summary}
            {recommendation.spacingNote ? ` · ${recommendation.spacingNote}` : ""}
          </p>

          {recommendation.allMissing && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              สูตรของครั้งนี้ยังไม่มีสินค้าในแคตตาล็อก
            </p>
          )}

          {recommendation.groups.map((group) => {
            const selectedSku = group.alternatives ? selectedAlt[group.id] : undefined;
            return (
              <div key={group.id} className="rounded-lg border p-2">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold">{group.label}</p>
                  {group.alternatives && (
                    <Badge variant="outline" className="text-[10px]">
                      ทางเลือก
                    </Badge>
                  )}
                </div>
                <div className="mt-1.5 space-y-1">
                  {group.items.map((item) => {
                    const isSelected = group.alternatives ? selectedSku === item.sku : true;
                    const key = `${group.id}:${item.sku}`;
                    return (
                      <div
                        key={item.sku}
                        className={`flex items-center gap-2 ${group.alternatives && !isSelected ? "opacity-60" : ""}`}
                      >
                        {group.alternatives ? (
                          <button
                            type="button"
                            onClick={() => setSelectedAlt((p) => ({ ...p, [group.id]: item.sku }))}
                            className="flex shrink-0 items-center"
                          >
                            <span
                              className={`grid size-4 place-items-center rounded-full border ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : ""
                              }`}
                            >
                              {isSelected && "✓"}
                            </span>
                          </button>
                        ) : (
                          <Package className="size-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{item.label}</p>
                          {item.missingCatalog ? (
                            <p className="text-[10px] text-destructive">
                              ยังไม่มีในแคตตาล็อก (SKU {item.sku})
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {currency(item.product!.price)} · คงเหลือ {item.product!.stock}
                            </p>
                          )}
                        </div>
                        {!item.missingCatalog && (
                          <Input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            value={qtys[key] ?? ""}
                            onChange={(e) =>
                              setQtys((p) => ({
                                ...p,
                                [key]: Number(e.target.value) || 0,
                              }))
                            }
                            placeholder="จำนวน"
                            className="h-7 w-16 rounded-md text-xs tabular-nums"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                {group.alternatives && !selectedSku && (
                  <p className="mt-1 text-[10px] text-muted-foreground">เลือกสูตรในกลุ่มนี้</p>
                )}
              </div>
            );
          })}

          {lines.length > 0 && (
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-muted-foreground">มูลค่าที่กรอก</span>
              <span className="font-bold tabular-nums">{currency(totalValue)}</span>
            </div>
          )}
        </div>
      )}

      {/* วันที่ทำจริง (สามารถกรอกย้อนหลังได้) */}
      <div className="mt-3 flex items-center gap-2 text-xs">
        <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="text-muted-foreground">วันที่ทำจริง:</span>
        <Input
          type="date"
          value={actionDate}
          onChange={(e) => setActionDate(e.target.value)}
          className="h-7 flex-1 rounded-md text-xs"
          placeholder="วันนี้"
        />
      </div>

      {/* ปุ่ม action */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={handleOrder}
          disabled={!recommendation || planComplete}
        >
          <ShoppingCart className="size-4" /> ส่งไป POS
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRecordDone}
          disabled={recording || !action.currentStageId || (planComplete && !action.nextStageId)}
        >
          {recording ? "กำลังบันทึก..." : "บันทึกทำแล้ว"}
        </Button>
      </div>
    </div>
  );
}
