import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProductImage } from "@/components/common/ProductImage";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { printReceipt } from "@/lib/print";
import { currency } from "@/lib/format";
import { ordersApi } from "@/lib/api/orders";
import { productsApi } from "@/lib/api/products";
import { settingsApi } from "@/lib/api/settings";
import { DEFAULT_STORE_SETTINGS } from "@/types";
import type { Product } from "@/types";

export const Route = createFileRoute("/sales/$orderId")({
  loader: async ({ params }) => {
    try {
      const order = await ordersApi.get(params.orderId);
      return { order };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "ไม่พบคำสั่งขาย — ปุ๋ยไทย CRM" }, { name: "robots", content: "noindex" }],
      };
    }
    const o = loaderData.order;
    return {
      meta: [
        { title: `${o.code} — คำสั่งขาย | ปุ๋ยไทย CRM` },
        {
          name: "description",
          content: `รายละเอียดคำสั่งขาย ${o.code} ของ ${o.customer} มูลค่า ${currency(o.total)}`,
        },
        { property: "og:title", content: `${o.code} — คำสั่งขาย | ปุ๋ยไทย CRM` },
        { property: "og:description", content: `${o.customer} · ${currency(o.total)}` },
      ],
    };
  },
  component: OrderDetail,
});

function OrderDetail() {
  const { order } = Route.useLoaderData();

  // ดึงรายการสินค้าในออเดอร์จาก Supabase
  const { data: items = [] } = useQuery({
    queryKey: ["order-items", order.id],
    queryFn: () => ordersApi.getItems(order.id),
  });

  // ดึงสินค้าทั้งหมดเพื่อ map รูปภาพ/สำหรับแสดง
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });
  // ดึงข้อมูลร้านสำหรับพิมพ์ใบเสร็จ
  const { data: storeSettings = DEFAULT_STORE_SETTINGS } = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => settingsApi.get(),
  });

  const productMap = useMemo(
    () => new Map<string, Product>(products.map((p) => [p.id, p])),
    [products],
  );

  const subtotal = items.reduce((s, l) => s + l.price * l.qty, 0);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title={order.code}
        description={`${order.channel} · ${order.date}`}
        crumbs={[{ label: "การขาย", to: "/sales" }, { label: order.code }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link to="/sales">
                <ArrowLeft className="size-4" /> กลับ
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                printReceipt({
                  storeName: storeSettings.storeName,
                  storeAddress: storeSettings.storeAddress ?? undefined,
                  storePhone: storeSettings.storePhone ?? undefined,
                  taxId: storeSettings.taxId ?? undefined,
                  receiptNo: order.code,
                  date: order.date,
                  customer: order.customer,
                  salesperson: order.salesperson,
                  channel: order.channel,
                  lines: items.map((l) => ({
                    name: l.productName,
                    qty: l.qty,
                    unit: productMap.get(l.productId)?.unit ?? "ชิ้น",
                    price: l.price,
                  })),
                  subtotal,
                  total: subtotal,
                  payment: order.payment,
                });
                toast.success("เปิดหน้าต่างพิมพ์แล้ว — เลือกเครื่องพิมพ์เพื่อพิมพ์ใบเสร็จ");
              }}
            >
              <Printer className="size-4" /> พิมพ์
            </Button>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => toast.success("ดาวน์โหลดใบกำกับภาษีแล้ว")}
            >
              <Download className="size-4" /> ใบกำกับภาษี
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <section className="card-soft overflow-hidden">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-sm font-semibold">รายการสินค้า</h2>
              <StatusBadge status={order.status} />
            </header>
            <ul className="divide-y">
              {items.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  ไม่มีรายการสินค้าในคำสั่งขายนี้
                </li>
              ) : (
                items.map((l) => {
                  const p = productMap.get(l.productId);
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                        <ProductImage
                          imageUrl={p?.imageUrl}
                          name={l.productName}
                          iconClassName="size-5"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.productName}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {currency(l.price)} × {l.qty} {p?.unit ?? "ชิ้น"}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums">
                        {currency(l.price * l.qty)}
                      </p>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="space-y-1.5 border-t px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ยอดรวม</span>
                <span className="tabular-nums">{currency(subtotal)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold">
                <span>ยอดสุทธิ</span>
                <span className="text-primary tabular-nums">{currency(subtotal)}</span>
              </div>
            </div>
          </section>

          <section className="card-soft">
            <header className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">เอกสารที่เกี่ยวข้อง</h2>
            </header>
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีเอกสารแนบ — ฟีเจอร์นี้จะพร้อมเร็ว ๆ นี้
            </div>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">ลูกค้า</h2>
            <p className="mt-2 text-sm font-medium">{order.customer}</p>
            <Button variant="outline" size="sm" className="mt-3 w-full rounded-xl" asChild>
              <Link to="/customers">ดูโปรไฟล์ลูกค้า</Link>
            </Button>
          </section>

          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">การชำระเงิน</h2>
            <dl className="mt-2 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">วิธีชำระ</dt>
                <dd className="font-medium">{order.payment}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">สถานะ</dt>
                <dd>
                  <StatusBadge status={order.status} />
                </dd>
              </div>
            </dl>
          </section>

          <section className="card-soft p-4">
            <h2 className="text-sm font-semibold">ไทม์ไลน์</h2>
            <ol className="mt-3 space-y-4">
              <li className="relative flex gap-3 pl-5">
                <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">สร้างคำสั่งขาย</p>
                  <p className="text-xs text-muted-foreground">{order.date}</p>
                </div>
              </li>
              {order.status === "paid" && (
                <li className="relative flex gap-3 pl-5">
                  <span className="absolute left-0 top-1.5 size-2 rounded-full bg-success" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">ชำระเงินเรียบร้อย</p>
                    <p className="text-xs text-muted-foreground">{order.payment}</p>
                  </div>
                </li>
              )}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
