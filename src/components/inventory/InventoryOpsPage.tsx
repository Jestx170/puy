import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Boxes, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Toolbar, FilterSelect, Pagination, usePagination } from "@/components/common/DataToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { numberFmt } from "@/lib/format";
import type { Movement } from "@/types";
import { movementsApi } from "@/lib/api/movements";
import { productsApi } from "@/lib/api/products";

export function InventoryOpsPage({
  title,
  description,
  type,
  actionLabel,
}: {
  title: string;
  description: string;
  type?: string;
  actionLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  // ดึง movements จาก Supabase
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["movements", type ?? "all"],
    queryFn: () => movementsApi.list({ type }),
  });

  const rows = useMemo(
    () =>
      list.filter(
        (m) =>
          (!type || m.type === type) &&
          (status === "all" || m.status === status) &&
          (m.product.includes(query) || m.code.toLowerCase().includes(query.toLowerCase())),
      ),
    [list, query, status, type],
  );

  const { slice, page, pages, setPage, total, perPage } = usePagination(rows, 8);

  const addMovement = async (m: Movement) => {
    qc.setQueryData<Movement[]>(["movements", type ?? "all"], (prev) => [m, ...(prev ?? [])]);
    toast.success(`บันทึก${title}สำเร็จ`, {
      description: `${m.code} · ${m.product} · ${m.qty > 0 ? "+" : ""}${m.qty}`,
    });
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title={title}
        description={description}
        crumbs={[{ label: "คลังสินค้า", to: "/inventory" }, { label: title }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => toast.success("ส่งออกรายการแล้ว")}
            >
              <Download className="size-4" /> ส่งออก
            </Button>
            <Button size="sm" className="rounded-xl" onClick={() => setOpen(true)}>
              <Plus className="size-4" /> {actionLabel}
            </Button>
          </>
        }
      />

      <div className="card-soft overflow-hidden">
        <div className="border-b p-3">
          <Toolbar
            query={query}
            onQuery={setQuery}
            placeholder="ค้นหาเลขที่เอกสารหรือสินค้า"
            filters={
              <FilterSelect
                value={status}
                onChange={setStatus}
                label="สถานะ"
                className="w-[150px]"
                options={[
                  { value: "all", label: "ทุกสถานะ" },
                  { value: "completed", label: "สำเร็จ" },
                  { value: "pending", label: "รอดำเนินการ" },
                  { value: "draft", label: "ฉบับร่าง" },
                ]}
              />
            }
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="mt-2 text-sm">กำลังโหลดรายการ…</p>
          </div>
        ) : slice.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="ยังไม่มีรายการ"
            description="เมื่อมีการเคลื่อนไหวสต็อก รายการจะแสดงที่นี่"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่</TableHead>
                  <TableHead>ประเภท</TableHead>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>คลัง</TableHead>
                  <TableHead className="text-right">จำนวน</TableHead>
                  <TableHead>ผู้ทำรายการ</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.code}</TableCell>
                    <TableCell className="text-xs">{m.type}</TableCell>
                    <TableCell className="max-w-48 truncate text-sm">{m.product}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.warehouse}</TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${m.qty < 0 ? "text-destructive" : "text-success"}`}
                    >
                      {m.qty > 0 ? "+" : ""}
                      {numberFmt(m.qty)}
                    </TableCell>
                    <TableCell className="text-xs">{m.by}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.date}</TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPage={setPage} />
      </div>

      <MovementForm
        open={open}
        onOpenChange={setOpen}
        type={type}
        title={title}
        actionLabel={actionLabel}
        onCreate={addMovement}
      />
    </div>
  );
}

/* ----------------------------- Movement Form ------------------------------- */

function MovementForm({
  open,
  onOpenChange,
  type,
  title,
  actionLabel,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type?: string | undefined;
  title: string;
  actionLabel: string;
  onCreate: (m: Movement) => void;
}) {
  const qc = useQueryClient();

  // ดึง products จาก Supabase
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  // ค่าเริ่มต้นของฟอร์ม — สาขาเดียว ใช้ "คลังหลัก" เสมอ
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState("10");
  const [by, setBy] = useState("admin");
  const [note, setNote] = useState("");

  // ประเภท movement (ถ้าหน้ากำหนด type มา ใช้ type นั้น, ถ้าไม่ ให้เลือกได้)
  const fixedType = type as Movement["type"] | undefined;
  const [moveType, setMoveType] = useState<Movement["type"]>(fixedType ?? "รับเข้า");

  const reset = () => {
    setProductId(products[0]?.id ?? "");
    setQty("10");
    setBy("admin");
    setNote("");
  };

  const submit = async () => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      toast.error("กรุณาเลือกสินค้า");
      return;
    }
    const qtyNum = Number(qty);
    if (!qtyNum || qtyNum === 0) {
      toast.error("กรุณากรอกจำนวนให้ถูกต้อง");
      return;
    }

    // กำหนดเครื่องหมายจำนวนตามประเภท: จ่ายออก = ลบ, อื่น ๆ = บวก
    const signedQty = moveType === "จ่ายออก" ? -Math.abs(qtyNum) : Math.abs(qtyNum);

    if (moveType === "จ่ายออก" && Math.abs(signedQty) > product.stock) {
      toast.error(`สต็อก ${product.name} เหลือเพียง ${product.stock} ${product.unit}`);
      return;
    }

    try {
      // RPC record_stock_movement ทำทุกอย่างใน transaction เดียว:
      // - สร้าง stock_movement (พร้อม audit trail stock_before/after)
      // - อัปเดต products.stock
      // - trigger คำนวณ products.status อัตโนมัติ
      // - ป้องกัน negative stock (DB CHECK constraint)
      const created = await movementsApi.create({
        type: moveType,
        productId: product.id,
        productName: product.name,
        qty: signedQty,
        warehouse: "คลังหลัก",
        by: by.trim() || "admin",
        note: note.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["low-stock-products"] });
      onCreate(created);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{actionLabel}</SheetTitle>
          <SheetDescription>บันทึก{title} · ข้อมูลจะอัปเดตในตารางทันที</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* ประเภท (ถ้าไม่ได้ fix ตามหน้า) */}
          {!fixedType && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ประเภทการเคลื่อนไหว</Label>
              <Select value={moveType} onValueChange={(v) => setMoveType(v as Movement["type"])}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="รับเข้า">รับเข้า</SelectItem>
                  <SelectItem value="จ่ายออก">จ่ายออก</SelectItem>
                  <SelectItem value="ปรับปรุง">ปรับปรุง</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* สินค้า */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">สินค้า *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · คงเหลือ {p.stock}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const p = products.find((x) => x.id === productId);
              return p ? (
                <p className="text-[11px] text-muted-foreground">
                  SKU {p.sku} · คงเหลือ {p.stock} {p.unit} · ขั้นต่ำ {p.minStock}
                </p>
              ) : null;
            })()}
          </div>

          {/* จำนวน */}
          <div className="space-y-1.5">
            <Label htmlFor="mv-qty" className="text-xs font-semibold">
              จำนวน *{" "}
              {moveType === "จ่ายออก" && (
                <span className="text-destructive">(จะถูกหักออกจากสต็อก)</span>
              )}
            </Label>
            <Input
              id="mv-qty"
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* ผู้ทำรายการ */}
          <div className="space-y-1.5">
            <Label htmlFor="mv-by" className="text-xs font-semibold">
              ผู้ทำรายการ
            </Label>
            <Input
              id="mv-by"
              value={by}
              onChange={(e) => setBy(e.target.value)}
              placeholder="admin"
              className="rounded-xl"
            />
          </div>

          {/* หมายเหตุ */}
          <div className="space-y-1.5">
            <Label htmlFor="mv-note" className="text-xs font-semibold">
              หมายเหตุ (ไม่บังคับ)
            </Label>
            <Textarea
              id="mv-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น รับจากผู้จำหน่าย บริษัท ก. / ปรับปรุงตามการตรวจนับ"
              className="min-h-16 rounded-xl text-sm"
            />
          </div>

          {/* พรีวิว */}
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">พรีวิว</p>
            <div className="mt-2 flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">
                {products.find((p) => p.id === productId)?.name ?? "—"}
              </span>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  moveType === "จ่ายออก" ? "text-destructive" : "text-success"
                }`}
              >
                {moveType === "จ่ายออก" ? "-" : "+"}
                {qty || "0"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {moveType} · คลังหลัก · {by || "admin"}
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button className="rounded-xl" onClick={submit}>
            บันทึก
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
