import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Banknote,
  Wallet,
  Users,
  ShoppingCart,
  AlertTriangle,
  Download,
  Plus,
  ArrowRight,
  PackageSearch,
  Bell,
  Loader2,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  activities as seedActivities,
  bestCustomers as seedBestCustomers,
  compactCurrency,
  currency,
  lowStockProducts as seedLowStock,
  notifications as seedNotifications,
  numberFmt,
  orders as seedOrders,
  revenueTrend as seedRevenueTrend,
  salesByDay as seedSalesByDay,
  topProducts as seedTopProducts,
} from "@/data/mock";
import { dashboardApi, type BestCustomer, type TopProduct } from "@/lib/api/dashboard";
import { ordersApi } from "@/lib/api/orders";
import { activitiesApi } from "@/lib/api/activities";
import { notificationsApi } from "@/lib/api/notifications";
import type { Product } from "@/data/mock";
import { exportToCSV } from "@/lib/export";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "แดชบอร์ดผู้บริหาร — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content:
          "ภาพรวมยอดขายวันนี้ รายได้รายเดือน ลูกค้า คำสั่งซื้อ และการแจ้งเตือนสต็อกของร้านค้าเกษตร",
      },
      { property: "og:title", content: "แดชบอร์ดผู้บริหาร — ปุ๋ยไทย CRM" },
      {
        property: "og:description",
        content: "ภาพรวมธุรกิจร้านค้าเกษตรแบบเรียลไทม์ในหน้าเดียว",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: Dashboard,
});

const chartTooltip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid var(--border)",
    background: "var(--card)",
    fontSize: 12,
    boxShadow: "var(--shadow-soft)",
  },
} as const;

function Widget({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card-soft flex flex-col ${className}`}>
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}

function Dashboard() {
  // ดึงข้อมูลจาก Supabase พร้อม fallback เป็น mock
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.stats(),
  });
  const { data: salesByDay = seedSalesByDay } = useQuery({
    queryKey: ["sales-by-day"],
    queryFn: () => dashboardApi.salesByDay(),
    placeholderData: seedSalesByDay,
  });
  const { data: revenueTrend = seedRevenueTrend } = useQuery({
    queryKey: ["revenue-trend"],
    queryFn: () => dashboardApi.revenueTrend(),
    placeholderData: seedRevenueTrend,
  });
  const { data: topProducts = seedTopProducts } = useQuery({
    queryKey: ["top-products"],
    queryFn: () => dashboardApi.topProducts(),
    placeholderData: seedTopProducts as unknown as TopProduct[],
  });
  const { data: bestCustomers = seedBestCustomers } = useQuery({
    queryKey: ["best-customers"],
    queryFn: () => dashboardApi.bestCustomers(),
    placeholderData: seedBestCustomers as unknown as BestCustomer[],
  });
  const { data: lowStockProducts = seedLowStock } = useQuery({
    queryKey: ["low-stock-products"],
    queryFn: () => dashboardApi.lowStockProducts(),
    placeholderData: seedLowStock,
  });
  const { data: recentOrders = seedOrders } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: () => ordersApi.list({ limit: 6 }),
    placeholderData: seedOrders,
  });
  const { data: activities = seedActivities } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(6),
    placeholderData: seedActivities,
  });
  const { data: notifications = seedNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(3),
    placeholderData: seedNotifications,
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="แดชบอร์ดผู้บริหาร"
        description="ภาพรวมผลประกอบการวันนี้ · อัปเดตล่าสุด 5 นาทีที่แล้ว"
        crumbs={[{ label: "แดชบอร์ด" }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const date = new Date().toISOString().slice(0, 10);
                exportToCSV(
                  recentOrders.map((o) => ({
                    เลขที่: o.code,
                    ลูกค้า: o.customer,
                    วันที่: o.date,
                    ยอดรวม: o.total,
                    รายการ: o.items,
                    สถานะ: o.status,
                    ช่องทาง: o.channel,
                    พนักงาน: o.salesperson,
                    การชำระ: o.payment,
                  })),
                  `รายงานการขาย-${date}.csv`,
                );
              }}
            >
              <Download className="size-4" /> ส่งออกรายงาน
            </Button>
            <Button size="sm" className="rounded-xl" asChild>
              <Link to="/pos">
                <Plus className="size-4" /> เปิดการขาย
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="ยอดขายวันนี้"
          value={currency(stats?.todaySales ?? 91240)}
          delta={12.4}
          hint="เทียบเมื่อวาน"
          icon={Banknote}
        />
        <StatCard
          label="รายได้เดือนนี้"
          value={compactCurrency(stats?.monthSales ?? 1180000)}
          delta={8.1}
          hint="94% ของเป้า"
          icon={Wallet}
        />
        <StatCard
          label="ลูกค้าทั้งหมด"
          value={numberFmt(stats?.totalCustomers ?? 1284)}
          delta={3.2}
          hint="+41 เดือนนี้"
          icon={Users}
          tone="info"
        />
        <StatCard
          label="คำสั่งซื้อวันนี้"
          value={String(stats?.todayOrders ?? 41)}
          delta={-2.6}
          hint="ค่าเฉลี่ย ฿2,225/บิล"
          icon={ShoppingCart}
        />
        <StatCard
          label="สินค้าใกล้หมด"
          value={String(lowStockProducts.length)}
          hint="ต้องสั่งเพิ่มด่วน"
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Widget
          title="ภาพรวมยอดขาย"
          subtitle="7 วันล่าสุด"
          className="xl:col-span-2"
          action={
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" asChild>
              <Link to="/sales">
                ดูรายงาน <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          <div className="h-64 p-4 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDay} margin={{ left: -12, right: 0, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tickFormatter={(v) => `${v / 1000}k`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip {...chartTooltip} formatter={(v) => currency(Number(v))} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Widget>

        <Widget title="แนวโน้มรายได้" subtitle="เทียบเป้าหมายรายเดือน">
          <div className="h-64 p-4 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueTrend} margin={{ left: -18, right: 0, top: 6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tickFormatter={(v) => `${v / 1000000}M`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip {...chartTooltip} formatter={(v) => currency(Number(v))} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="var(--chart-5)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Widget>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="สินค้าขายดี" subtitle="เรียงตามจำนวนที่ขายได้เดือนนี้">
          <ul className="divide-y">
            {topProducts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-base">
                  {p.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    #{i + 1} · ขายได้ {p.sold} {p.unit}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums">{compactCurrency(p.revenue)}</p>
                  <Progress value={100 - i * 16} className="mt-1 h-1 w-20" />
                </div>
              </li>
            ))}
          </ul>
        </Widget>

        <Widget title="ลูกค้ายอดเยี่ยม" subtitle="มูลค่าการซื้อสะสมสูงสุด">
          <ul className="divide-y">
            {bestCustomers.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {c.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.tier} · {c.orders} คำสั่งซื้อ
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">
                  {compactCurrency(c.lifetime)}
                </p>
              </li>
            ))}
          </ul>
        </Widget>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Widget
          title="คำสั่งซื้อล่าสุด"
          subtitle="อัปเดตแบบเรียลไทม์"
          className="xl:col-span-2"
          action={
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" asChild>
              <Link to="/sales">ดูทั้งหมด</Link>
            </Button>
          }
        >
          <ul className="divide-y">
            {recentOrders.slice(0, 6).map((o) => (
              <li
                key={o.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to="/sales/$orderId"
                    params={{ orderId: o.id }}
                    className="truncate text-sm font-semibold hover:text-primary"
                  >
                    {o.code}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.customer} · {o.items} รายการ · {o.date}
                  </p>
                </div>
                <StatusBadge status={o.status} className="hidden shrink-0 sm:inline-flex" />
                <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                  {currency(o.total)}
                </p>
              </li>
            ))}
          </ul>
        </Widget>

        <div className="grid gap-4">
          <Widget
            title="แจ้งเตือนคลังสินค้า"
            subtitle={`${lowStockProducts.length} รายการต้องดำเนินการ`}
            action={
              <Button variant="ghost" size="sm" className="rounded-lg text-xs" asChild>
                <Link to="/inventory">จัดการ</Link>
              </Button>
            }
          >
            <ul className="divide-y">
              {lowStockProducts.slice(0, 4).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <PackageSearch className="size-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      เหลือ {p.stock} / ขั้นต่ำ {p.minStock}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </li>
              ))}
            </ul>
          </Widget>

          <Widget title="การแจ้งเตือน" subtitle="ระบบและทีมงาน">
            <ul className="divide-y">
              {notifications.slice(0, 3).map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-2.5">
                  <Bell className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{n.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Widget>
        </div>
      </div>

      <Widget title="กิจกรรมลูกค้าและทีมงาน" subtitle="บันทึกการทำงานล่าสุด">
        <ol className="relative space-y-4 px-5 py-4">
          {activities.map((a) => (
            <li key={a.id} className="relative flex gap-3 pl-5">
              <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
              <span className="absolute left-[3.5px] top-4 h-full w-px bg-border last:hidden" />
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-semibold">{a.actor}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>{" "}
                  <span className="font-medium">{a.target}</span>
                </p>
                <p className="text-xs text-muted-foreground">{a.time}</p>
              </div>
            </li>
          ))}
        </ol>
      </Widget>

      <Widget title="ปริมาณคำสั่งซื้อรายวัน" subtitle="จำนวนบิลต่อวันใน 7 วันล่าสุด">
        <div className="h-56 p-4 pr-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesByDay} margin={{ left: -22, right: 0, top: 6, bottom: 0 }}>
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
              <Tooltip {...chartTooltip} />
              <Bar dataKey="orders" fill="var(--chart-2)" radius={[8, 8, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Widget>
    </div>
  );
}
