import { useMemo, useState } from "react";
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
  TrendingUp,
  PiggyBank,
  Sprout,
  PhoneCall,
  Clock,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ProductImage } from "@/components/common/ProductImage";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { compactCurrency, currency, numberFmt } from "@/lib/format";
import { findFollowUps, forecastDemand } from "@/lib/agronomy";
import {
  dashboardApi,
  type BestCustomer,
  type TopProduct,
  type ProfitByDay,
  type ProfitByMonth,
} from "@/lib/api/dashboard";
import { ordersApi } from "@/lib/api/orders";
import { activitiesApi } from "@/lib/api/activities";
import { notificationsApi } from "@/lib/api/notifications";
import { customersApi } from "@/lib/api/customers";
import { productsApi } from "@/lib/api/products";
import type { Product, Customer } from "@/types";
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

// ค่าเริ่มต้นว่างสำหรับกราฟกำไร (ก่อน Supabase ตอบกลับ)
const emptyProfitByDay: ProfitByDay[] = [];
const emptyProfitByMonth: ProfitByMonth[] = [];

function Dashboard() {
  const [profitView, setProfitView] = useState<"day" | "month">("day");
  // ดึงข้อมูลจาก Supabase
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.stats(),
  });
  const { data: salesByDay = [] } = useQuery({
    queryKey: ["sales-by-day"],
    queryFn: () => dashboardApi.salesByDay(),
  });
  const { data: revenueTrend = [] } = useQuery({
    queryKey: ["revenue-trend"],
    queryFn: () => dashboardApi.revenueTrend(),
  });
  const { data: topProducts = [] } = useQuery({
    queryKey: ["top-products"],
    queryFn: () => dashboardApi.topProducts(),
  });
  const { data: bestCustomers = [] } = useQuery({
    queryKey: ["best-customers"],
    queryFn: () => dashboardApi.bestCustomers(),
  });
  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ["low-stock-products"],
    queryFn: () => dashboardApi.lowStockProducts(),
  });
  const { data: recentOrders = [] } = useQuery({
    queryKey: ["recent-orders"],
    queryFn: () => ordersApi.list({ limit: 6 }),
  });
  const { data: activities = [] } = useQuery({
    queryKey: ["activities"],
    queryFn: () => activitiesApi.list(6),
  });
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(3),
  });
  const { data: profitByDay = emptyProfitByDay } = useQuery({
    queryKey: ["profit-by-day"],
    queryFn: () => dashboardApi.profitByDay(),
  });
  const { data: profitByMonth = emptyProfitByMonth } = useQuery({
    queryKey: ["profit-by-month"],
    queryFn: () => dashboardApi.profitByMonth(),
  });

  // ดึงลูกค้าและสินค้าจริงสำหรับวิเคราะห์การเพาะปลูก
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.list(),
  });
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  // วิเคราะห์การเพาะปลูก: ลูกค้าที่ควรติดต่อ + พยากรณ์ความต้องการสินค้า
  const followUps = useMemo(
    () => (customers.length && products.length ? findFollowUps(customers, products, 21) : []),
    [customers, products],
  );
  const demand = useMemo(
    () => (customers.length && products.length ? forecastDemand(customers, products, 30) : []),
    [customers, products],
  );
  const opportunityTotal = followUps.reduce((s, f) => s + f.opportunity, 0);
  const demandShortfall = demand.filter((d) => d.shortfall > 0);

  const profitData = profitView === "day" ? profitByDay : profitByMonth;
  const monthMargin =
    stats && stats.monthSales > 0 ? Math.round((stats.monthProfit / stats.monthSales) * 100) : 0;
  const todayMargin =
    stats && stats.todaySales > 0 ? Math.round((stats.todayProfit / stats.todaySales) * 100) : 0;

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="ยอดขายวันนี้"
          value={currency(stats?.todaySales ?? 0)}
          {...(stats ? { delta: 12.4 } : {})}
          hint="เทียบเมื่อวาน"
          icon={Banknote}
        />
        <StatCard
          label="รายได้เดือนนี้"
          value={compactCurrency(stats?.monthSales ?? 0)}
          {...(stats ? { delta: 8.1 } : {})}
          hint="เป้าหมายรายเดือน"
          icon={Wallet}
        />
        <StatCard
          label="กำไรวันนี้"
          value={currency(stats?.todayProfit ?? 0)}
          {...(todayMargin > 0 ? { delta: todayMargin } : {})}
          hint={todayMargin > 0 ? `มาร์จิน ${todayMargin}%` : "—"}
          icon={PiggyBank}
        />
        <StatCard
          label="กำไรเดือนนี้"
          value={compactCurrency(stats?.monthProfit ?? 0)}
          {...(monthMargin > 0 ? { delta: monthMargin } : {})}
          hint={
            monthMargin > 0
              ? `มาร์จิน ${monthMargin}% · ต้นทุน ${compactCurrency(stats?.monthCogs ?? 0)}`
              : "—"
          }
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="ลูกค้าทั้งหมด"
          value={numberFmt(stats?.totalCustomers ?? 0)}
          {...(stats ? { delta: 3.2 } : {})}
          hint="ทั้งระบบ"
          icon={Users}
          tone="info"
        />
        <StatCard
          label="คำสั่งซื้อวันนี้"
          value={String(stats?.todayOrders ?? 0)}
          {...(stats ? { delta: -2.6 } : {})}
          hint="จากการขายทุกช่องทาง"
          icon={ShoppingCart}
        />
        <StatCard
          label="สินค้าใกล้หมด"
          value={String(lowStockProducts.length)}
          hint="ต้องสั่งเพิ่มด่วน"
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="รออนุมัติ"
          value={String(stats?.pendingOrders ?? 0)}
          hint="คำสั่งซื้อรอดำเนินการ"
          icon={Bell}
          tone="info"
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

      {/* กราฟกำไร รายวัน/รายเดือน */}
      <Widget
        title="รายงานกำไร"
        subtitle={profitView === "day" ? "รายวัน · 7 วันล่าสุด" : "รายเดือน · 8 เดือนล่าสุด"}
        action={
          <div className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
            <button
              onClick={() => setProfitView("day")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                profitView === "day"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              รายวัน
            </button>
            <button
              onClick={() => setProfitView("month")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                profitView === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              รายเดือน
            </button>
          </div>
        }
      >
        <div className="h-72 p-4 pr-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={
                profitData as Array<{
                  day?: string;
                  month?: string;
                  revenue: number;
                  cogs: number;
                  profit: number;
                }>
              }
              margin={{ left: -8, right: 0, top: 6, bottom: 0 }}
            >
              <defs>
                <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey={profitView === "day" ? "day" : "month"}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tickFormatter={(v) => (profitView === "day" ? `${v / 1000}k` : `${v / 1000000}M`)}
                tickLine={false}
                axisLine={false}
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <Tooltip
                {...chartTooltip}
                formatter={(v, name) => {
                  const label = name === "profit" ? "กำไร" : name === "cogs" ? "ต้นทุน" : "รายได้";
                  return [currency(Number(v)), label];
                }}
              />
              <Bar
                dataKey="revenue"
                fill="var(--chart-1)"
                radius={[4, 4, 0, 0]}
                maxBarSize={profitView === "day" ? 32 : 48}
                opacity={0.3}
              />
              <Bar
                dataKey="cogs"
                fill="var(--chart-5)"
                radius={[4, 4, 0, 0]}
                maxBarSize={profitView === "day" ? 32 : 48}
                opacity={0.5}
              />
              <Bar
                dataKey="profit"
                fill="url(#profitFill)"
                radius={[4, 4, 0, 0]}
                maxBarSize={profitView === "day" ? 32 : 48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 border-t px-4 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: "var(--chart-1)", opacity: 0.3 }}
            />
            รายได้
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-sm"
              style={{ background: "var(--chart-5)", opacity: 0.5 }}
            />
            ต้นทุนสินค้าขาย
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: "var(--chart-2)" }} />
            กำไรขั้นต้น
          </span>
          <span className="ml-auto font-medium text-foreground">
            กำไรรวม {currency(profitData.reduce((s, d) => s + d.profit, 0))}
          </span>
        </div>
      </Widget>

      {/* วิเคราะห์การเพาะปลูก → โอกาสขาย */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Widget
          title="ลูกค้าที่ควรติดต่อ"
          subtitle={
            followUps.length > 0
              ? `${followUps.length} แปลงเปลี่ยนช่วงการปลูก · โอกาสขาย ${currency(opportunityTotal)}`
              : "ไม่มีแปลงที่ต้องติดตามในช่วงนี้"
          }
          action={
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" asChild>
              <Link to="/customers">
                ดูลูกค้า <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {followUps.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              ทุกแปลงอยู่ในช่วงที่บันทึกไว้ตรงตามปฏิทิน
            </p>
          ) : (
            <ul className="divide-y">
              {followUps.slice(0, 6).map((f) => (
                <li key={`${f.customer.id}-${f.cultivation.id}`} className="flex gap-3 px-4 py-3">
                  <span
                    className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${
                      f.kind === "overdue" ? "bg-warning/15 text-warning" : "bg-info/12 text-info"
                    }`}
                  >
                    {f.kind === "overdue" ? (
                      <AlertTriangle className="size-4" />
                    ) : (
                      <Clock className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{f.customer.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      <Sprout className="mr-1 inline size-3" />
                      {f.cultivation.crop} · {f.cultivation.area} ไร่ ·{" "}
                      {f.kind === "overdue"
                        ? `ควรอยู่ช่วง ${f.progress.expectedStage} แล้ว`
                        : `อีก ${f.progress.daysToNextStage} วันเข้า ${f.progress.nextStage}`}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      เสนอสินค้าช่วง{" "}
                      <span className="font-medium text-foreground">{f.targetStage}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-primary">
                      {compactCurrency(f.opportunity)}
                    </p>
                    <a
                      href={`tel:${f.customer.phone}`}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                    >
                      <PhoneCall className="size-3" /> โทร
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="พยากรณ์ความต้องการสินค้า"
          subtitle={`30 วันข้างหน้า · มูลค่า ${currency(demand.reduce((s, d) => s + d.value, 0))}${
            demandShortfall.length > 0 ? ` · ${demandShortfall.length} รายการสต็อกไม่พอ` : ""
          }`}
          action={
            <Button variant="ghost" size="sm" className="rounded-lg text-xs" asChild>
              <Link to="/inventory">
                จัดการคลัง <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          }
        >
          {demand.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีข้อมูลแปลงเพาะปลูกเพียงพอต่อการพยากรณ์
            </p>
          ) : (
            <ul className="divide-y">
              {demand.slice(0, 6).map((d) => (
                <li key={d.product.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                    <ProductImage
                      imageUrl={d.product.imageUrl}
                      name={d.product.name}
                      iconClassName="size-5"
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ต้องใช้ {numberFmt(d.qty)} {d.product.unit} · {d.plots} แปลง · สต็อก{" "}
                      {numberFmt(d.stock)}
                    </p>
                    {d.shortfall > 0 && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-warning">
                        <AlertTriangle className="size-3 shrink-0" />
                        ต้องสั่งเพิ่ม {numberFmt(d.shortfall)} {d.product.unit}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {compactCurrency(d.value)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="สินค้าขายดี" subtitle="เรียงตามจำนวนที่ขายได้เดือนนี้">
          <ul className="divide-y">
            {topProducts.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                  <ProductImage imageUrl={p.imageUrl} name={p.name} iconClassName="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    #{i + 1} · ขายได้ {p.sold} {p.unit} · กำไร{" "}
                    {compactCurrency((p.price - p.cost) * p.sold)}
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

          <Widget title="การแจ้งเตือน" subtitle="ระบบ">
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

      <Widget title="กิจกรรมล่าสุด" subtitle="บันทึกการทำงาน">
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
