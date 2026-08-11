import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Pencil, Plus, Printer, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { currency, products } from "@/data/mock";

export const Route = createFileRoute("/products/$productId")({
  loader: ({ params }) => {
    const product = products.find((p) => p.id === params.productId);
    if (!product) throw notFound();
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function ProductDetail() {
  const { product: p } = Route.useLoaderData();
  const margin = Math.round(((p.price - p.cost) / p.price) * 100);

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
              onClick={() => toast("พิมพ์ฉลากบาร์โค้ด")}
            >
              <Printer className="size-4" /> พิมพ์ฉลาก
            </Button>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => toast.success("บันทึกการแก้ไขแล้ว")}
            >
              <Pencil className="size-4" /> แก้ไขด่วน
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="card-soft p-4">
          <div className="grid h-52 place-items-center rounded-xl bg-muted text-7xl">{p.emoji}</div>
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
              onClick={() => toast.success("เพิ่มเข้าใบสั่งซื้อ")}
            >
              <Plus className="size-4" /> สั่งซื้อ
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl text-destructive">
                  <Trash2 className="size-4" /> ลบ
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
                    onClick={() => toast.success("ลบสินค้าแล้ว")}
                  >
                    ลบสินค้า
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
            </div>
          </section>

          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">สินค้าที่เกี่ยวข้อง</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {products
                .filter((x) => x.category === p.category && x.id !== p.id)
                .slice(0, 3)
                .map((x) => (
                  <Link
                    key={x.id}
                    to="/products/$productId"
                    params={{ productId: x.id }}
                    className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                      {x.emoji}
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
    </div>
  );
}
