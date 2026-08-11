import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Boxes, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Warehouse } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  compactCurrency,
  lowStockProducts,
  movements,
  numberFmt,
  stockMovementChart,
  warehouses as seedWarehouses,
} from "@/data/mock";
import { warehousesApi } from "@/lib/api/warehouses";

export const Route = createFileRoute("/inventory/")({
  head: () => ({
    meta: [
      { title: "คลังสินค้า — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content: "ภาพรวมสต็อกคงเหลือ การเคลื่อนไหว การปรับปรุงล่าสุด และสินค้าใกล้หมดในทุกคลัง",
      },
      { property: "og:title", content: "คลังสินค้า — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "บริหารสต็อกหลายคลังในหน้าเดียว" },
      { property: "og:url", content: "/inventory" },
    ],
    links: [{ rel: "canonical", href: "/inventory" }],
  }),
  component: InventoryOverview,
});

function InventoryOverview() {
  const { data: warehouses = seedWarehouses } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => warehousesApi.list(),
    placeholderData: seedWarehouses,
  });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="คลังสินค้า"
        description="ภาพรวมสต็อกทั้ง 3 คลัง · อัปเดตทุก 15 นาที"
        crumbs={[{ label: "คลังสินค้า" }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link to="/inventory/stock-out">
                <ArrowUpFromLine className="size-4" /> จ่ายออก
              </Link>
            </Button>
            <Button size="sm" className="rounded-xl" asChild>
              <Link to="/inventory/stock-in">
                <ArrowDownToLine className="size-4" /> รับเข้า
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="สต็อกคงเหลือรวม"
          value={numberFmt(2244)}
          delta={4.8}
          hint="ทุกคลังรวมกัน"
          icon={Boxes}
        />
        <StatCard
          label="มูลค่าสต็อก"
          value={compactCurrency(5020000)}
          delta={2.1}
          hint="ตามราคาทุน"
          icon={Warehouse}
          tone="info"
        />
        <StatCard
          label="เคลื่อนไหววันนี้"
          value="34 รายการ"
          delta={11.2}
          hint="รับเข้า 18 · จ่ายออก 16"
          icon={ArrowDownToLine}
        />
        <StatCard
          label="สินค้าใกล้หมด"
          value={String(lowStockProducts.length)}
          hint="ต้องเติมสต็อกด่วน"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card-soft xl:col-span-2">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">การเคลื่อนไหวสต็อก</h2>
            <p className="text-xs text-muted-foreground">รับเข้าเทียบจ่ายออก 7 วันล่าสุด</p>
          </header>
          <div className="h-64 p-4 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stockMovementChart}
                margin={{ left: -22, right: 0, top: 6, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar
                  dataKey="in"
                  name="รับเข้า"
                  fill="var(--chart-1)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={26}
                />
                <Bar
                  dataKey="out"
                  name="จ่ายออก"
                  fill="var(--chart-3)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={26}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card-soft">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">คลังสินค้า</h2>
            <p className="text-xs text-muted-foreground">ความจุที่ใช้งาน</p>
          </header>
          <ul className="divide-y">
            {warehouses.map((w) => (
              <li key={w.name} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{w.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {w.capacity}%
                  </span>
                </div>
                <Progress value={w.capacity} className="mt-2 h-1.5" />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {numberFmt(w.items)} ชิ้น · {compactCurrency(w.value)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-soft">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">การปรับปรุงล่าสุด</h2>
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" asChild>
              <Link to="/inventory/movements">ดูทั้งหมด</Link>
            </Button>
          </header>
          <ul className="divide-y">
            {movements.slice(0, 6).map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.code} · {m.type}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.product} · {m.warehouse}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold tabular-nums ${m.qty < 0 ? "text-destructive" : "text-success"}`}
                >
                  {m.qty > 0 ? "+" : ""}
                  {m.qty}
                </span>
                <StatusBadge status={m.status} className="hidden shrink-0 sm:inline-flex" />
              </li>
            ))}
          </ul>
        </section>

        <section className="card-soft">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">สินค้าใกล้หมด</h2>
            <p className="text-xs text-muted-foreground">เรียงตามความเร่งด่วน</p>
          </header>
          <ul className="divide-y">
            {lowStockProducts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to="/products/$productId"
                    params={{ productId: p.id }}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    เหลือ {p.stock} · ขั้นต่ำ {p.minStock}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
