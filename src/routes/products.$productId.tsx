import { useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil,
  Plus,
  Printer,
  Trash2,
  ArrowLeft,
  Loader2,
  CalendarClock,
  Package,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProductImage } from "@/components/common/ProductImage";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { currency } from "@/lib/format";
import { useCategories } from "@/hooks/useCategories";
import type { Product } from "@/types";
import { productsApi } from "@/lib/api/products";

export const Route = createFileRoute("/products/$productId")({
  // loader ดึงสินค้าจาก Supabase ก่อน render — ถ้าหาไม่เจอจะ 404
  loader: async ({ params }) => {
    const product = await productsApi.get(params.productId);
    return { product };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "ไม่พบสินค้า — ปุ๋ยไทย CRM" }, { name: "robots", content: "noindex" }],
      };
    }
    const p = loaderData.product;
    return {
      meta: [
        { title: `${p.name} — ปุ๋ยไทย CRM` },
        {
          name: "description",
          content: `${p.name} (${p.sku}) หมวด ${p.category} ราคา ${currency(p.price)} คงเหลือ ${p.stock} ${p.unit}`,
        },
        { property: "og:title", content: `${p.name} — ปุ๋ยไทย CRM` },
        { property: "og:type", content: "product" },
        {
          property: "og:description",
          content: `${p.category} · ${p.brand} · ${currency(p.price)}`,
        },
      ],
    };
  },
  component: ProductDetail,
});

function Field({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        tone === "danger"
          ? "border-destructive/25 bg-destructive/5"
          : tone === "warning"
            ? "border-warning/30 bg-warning/10"
            : ""
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 truncate text-sm font-semibold ${
          tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ProductDetail() {
  const { product: initial } = Route.useLoaderData();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { categories } = useCategories();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ดึงข้อมูลสดจาก Supabase (มี loaderData เป็น placeholder กันกระตุก)
  const { data: p = initial } = useQuery({
    queryKey: ["products", initial.id],
    queryFn: () => productsApi.get(initial.id),
    placeholderData: initial,
  });

  // ดึงรายการสินค้าทั้งหมดสำหรับ "สินค้าที่เกี่ยวข้อง"
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  const margin = Math.round(((p.price - p.cost) / p.price) * 100);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await productsApi.remove(p.id);
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(
        result === "soft"
          ? `ซ่อน "${p.name}" จากแคตตาล็อกแล้ว (มีประวัติขาย — เก็บไว้ใช้ในรายงาน)`
          : `ลบสินค้า "${p.name}" แล้ว`,
      );
      navigate({ to: "/products" });
    } catch (e) {
      toast.error("ลบสินค้าไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title={p.name}
        description={`${p.category} · ${p.brand}`}
        crumbs={[{ label: "สินค้า", to: "/products" }, { label: p.sku }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link to="/products">
                <ArrowLeft className="size-4" /> กลับ
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const html = `<!DOCTYPE html><html lang="th"><head><meta charset="utf-8"/><title>ฉลาก ${p.sku}</title><style>@page{margin:4mm}body{font-family:"Noto Sans Thai",system-ui,sans-serif;text-align:center;padding:4mm;max-width:60mm;margin:0 auto}.name{font-size:13px;font-weight:700;margin-bottom:4px}.barcode{font-size:28px;letter-spacing:3px;font-family:"Courier New",monospace;margin:6px 0}.sku{font-size:11px;color:#555}.price{font-size:16px;font-weight:700;margin-top:4px}@media print{body{padding:0;max-width:none}}</style></head><body><div class="name">${p.name.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")}</div><div class="barcode">${(p.barcode || p.sku).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">")}</div><div class="sku">SKU: ${p.sku}</div><div class="price">${new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format(p.price)}</div></body></html>`;
                const win = window.open("", "_blank", "width=300,height=200");
                if (!win) {
                  toast.error("ป๊อปอัปถูกบล็อก — อนุญาตป๊อปอัปแล้วลองอีกครั้ง");
                  return;
                }
                win.document.open();
                win.document.write(html);
                win.document.close();
                win.focus();
                setTimeout(() => win.print(), 300);
                toast.success("เปิดหน้าต่างพิมพ์ฉลากแล้ว");
              }}
            >
              <Printer className="size-4" /> พิมพ์ฉลาก
            </Button>
            <Button size="sm" className="rounded-xl" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> แก้ไข
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card-soft p-4">
          <div className="grid h-52 place-items-center overflow-hidden rounded-xl bg-muted">
            <ProductImage imageUrl={p.imageUrl} name={p.name} iconClassName="size-20" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <StatusBadge status={p.status} />
            <span className="text-xs text-muted-foreground">{p.barcode}</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-primary tabular-nums">{currency(p.price)}</p>
          <p className="text-xs text-muted-foreground">
            ต้นทุน {currency(p.cost)} · กำไรขั้นต้น {margin}%
          </p>

          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">ระดับสต็อก</span>
              <span className="tabular-nums">
                {p.stock} / ขั้นต่ำ {p.minStock}
              </span>
            </div>
            <Progress
              value={Math.min(100, (p.stock / Math.max(p.minStock * 3, 1)) * 100)}
              className="h-2"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => navigate({ to: "/inventory/stock-in" })}
            >
              <Plus className="size-4" /> สั่งซื้อ
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-destructive"
                  disabled={deleting}
                >
                  {deleting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}{" "}
                  ลบ
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันการลบสินค้า?</AlertDialogTitle>
                  <AlertDialogDescription>
                    การลบ “{p.name}” จะไม่สามารถย้อนกลับได้ ประวัติการขายเดิมจะยังคงอยู่
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction
                    className="rounded-xl"
                    disabled={deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? "กำลังลบ..." : "ลบสินค้า"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="space-y-4">
          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">ข้อมูลสินค้า</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="SKU" value={p.sku} />
              <Field label="บาร์โค้ด" value={p.barcode} />
              <Field label="หมวดหมู่" value={p.category} />
              <Field label="แบรนด์" value={p.brand} />
              <Field label="หน่วยนับ" value={p.unit} />
              <Field label="ราคาขาย" value={currency(p.price)} />
              <Field label="ต้นทุน" value={currency(p.cost)} />
              <Field label="สต็อกคงเหลือ" value={`${p.stock} ${p.unit}`} />
              <Field label="สต็อกขั้นต่ำ" value={`${p.minStock} ${p.unit}`} />
              {p.expiryDate && (
                <Field
                  label="วันหมดอายุ"
                  value={p.expiryDate}
                  tone={
                    new Date(p.expiryDate) < new Date()
                      ? "danger"
                      : new Date(p.expiryDate) <= new Date(Date.now() + 7 * 86400000)
                        ? "warning"
                        : "default"
                  }
                />
              )}
            </div>

            {/* แจ้งเตือนสินค้าใกล้หมดอายุ */}
            {p.expiryDate && new Date(p.expiryDate) <= new Date(Date.now() + 30 * 86400000) && (
              <div
                className={`mt-3 flex items-center gap-2 rounded-xl border p-3 text-sm ${
                  new Date(p.expiryDate) < new Date()
                    ? "border-destructive/25 bg-destructive/5 text-destructive"
                    : new Date(p.expiryDate) <= new Date(Date.now() + 7 * 86400000)
                      ? "border-warning/30 bg-warning/10 text-warning"
                      : "border-info/25 bg-info/5 text-info"
                }`}
              >
                <CalendarClock className="size-4 shrink-0" />
                <span>
                  {new Date(p.expiryDate) < new Date()
                    ? `สินค้านี้หมดอายุแล้วเมื่อ ${p.expiryDate} — ควรเอาออกจากการขาย`
                    : new Date(p.expiryDate) <= new Date(Date.now() + 7 * 86400000)
                      ? `สินค้าจะหมดอายุภายใน ${Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000)} วัน — รีบขายหรือโปรโมชัน`
                      : `สินค้าจะหมดอายุใน ${Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000)} วัน`}
                </span>
              </div>
            )}
          </section>

          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">สินค้าที่เกี่ยวข้อง</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {allProducts
                .filter((x) => x.category === p.category && x.id !== p.id)
                .slice(0, 3)
                .map((x) => (
                  <Link
                    key={x.id}
                    to="/products/$productId"
                    params={{ productId: x.id }}
                    className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      <ProductImage imageUrl={x.imageUrl} name={x.name} iconClassName="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{x.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {currency(x.price)}
                      </p>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        </div>
      </div>

      <EditProductSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        product={p}
        onSaved={(updated) => {
          qc.setQueryData<Product[]>(["products"], (prev) =>
            (prev ?? []).map((x) => (x.id === updated.id ? updated : x)),
          );
          qc.setQueryData(["products", updated.id], updated);
        }}
      />
    </div>
  );
}

/* --------------------------- Edit Product Sheet ----------------------------- */

function EditProductSheet({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product;
  onSaved: (p: Product) => void;
}) {
  const { categories } = useCategories();
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku);
  const [barcode, setBarcode] = useState(product.barcode);
  const [category, setCategory] = useState(product.category);
  const [brand, setBrand] = useState(product.brand);
  const [price, setPrice] = useState(String(product.price));
  const [cost, setCost] = useState(String(product.cost));
  const [stock, setStock] = useState(String(product.stock));
  const [minStock, setMinStock] = useState(String(product.minStock));
  const [unit, setUnit] = useState(product.unit);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อสินค้า");
      return;
    }
    setSaving(true);
    try {
      const updated = await productsApi.update(product.id, {
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        category,
        brand: brand.trim(),
        price: Number(price) || 0,
        cost: Number(cost) || 0,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        unit: unit.trim(),
      });
      onSaved(updated);
      toast.success(`แก้ไข "${updated.name}" แล้ว`);
      onOpenChange(false);
    } catch (e) {
      toast.error("แก้ไขไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>แก้ไขสินค้า</SheetTitle>
          <SheetDescription>แก้ไขข้อมูล "{product.name}" — บันทึกทันที</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ชื่อสินค้า *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">บาร์โค้ด</Label>
              <Input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">หมวดหมู่</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">แบรนด์</Label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ราคาขาย</Label>
              <Input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ต้นทุน</Label>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">หน่วยนับ</Label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">สต็อก</Label>
              <Input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ขั้นต่ำ</Label>
              <Input
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button className="rounded-xl" onClick={submit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> กำลังบันทึก...
              </>
            ) : (
              "บันทึก"
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
