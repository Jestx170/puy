import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { currency, documents, orders, products, timeline } from "@/data/mock";

export const Route = createFileRoute("/sales/$orderId")({
  loader: ({ params }) => {
    const order = orders.find((o) => o.id === params.orderId);
    if (!order) throw notFound();
    return { order };
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
  const lines = products.slice(0, order.items).map((p, i) => ({ p, qty: 1 + i }));
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const vat = Math.round(subtotal * 0.07);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title={order.code}
        description={`${order.channel} · ${order.date} · พนักงานขาย ${order.salesperson}`}
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
              onClick={() => toast("ส่งเอกสารไปยังเครื่องพิมพ์")}
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
              {lines.map((l) => (
                <li key={l.p.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-lg">
                    {l.p.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.p.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {currency(l.p.price)} × {l.qty} {l.p.unit}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {currency(l.p.price * l.qty)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ยอดรวม</span>
                <span className="tabular-nums">{currency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ภาษีมูลค่าเพิ่ม 7%</span>
                <span className="tabular-nums">{currency(vat)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-bold">
                <span>ยอดสุทธิ</span>
                <span className="text-primary tabular-nums">{currency(subtotal + vat)}</span>
              </div>
            </div>
          </section>

          <section className="card-soft">
            <header className="border-b px-4 py-3">
              <h2 className="text-sm font-semibold">เอกสารที่เกี่ยวข้อง</h2>
            </header>
            <ul className="divide-y">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.kind} · {d.size}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-lg">
                    <Download className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
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
              {timeline.map((t) => (
                <li key={t.id} className="relative flex gap-3 pl-5">
                  <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.desc}</p>
                    <p className="text-[11px] text-muted-foreground/70">{t.time}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
