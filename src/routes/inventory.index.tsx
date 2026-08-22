import { useMemo, useState } from "react";
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
import {
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Warehouse,
  PackageX,
  PackageCheck,
  Search,
  Download,
  CalendarClock,
} from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Toolbar, FilterSelect } from "@/components/common/DataToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { compactCurrency, currency, numberFmt } from "@/lib/format";
import { warehousesApi } from "@/lib/api/warehouses";
import { movementsApi } from "@/lib/api/movements";
import { productsApi } from "@/lib/api/products";
import { dashboardApi } from "@/lib/api/dashboard";
import { exportToCSV } from "@/lib/export";
import { productCategories } from "@/lib/constants";

export const Route = createFileRoute("/inventory/")({
  head: () => ({
    meta: [
      { title: "คลังสินค้า — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content: "ภาพรวมสต็อกคงเหลือ การเคลื่อนไหว การปรับปรุงล่าสุด และสินค้าใกล้หมด",
      },
      { property: "og:title", content: "คลังสินค้า — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "บริหารสต็อกสินค้าในหน้าเดียว" },
      { property: "og:url", content: "/inventory" },
    ],
    links: [{ rel: "canonical", href: "/inventory" }],
  }),
  component: InventoryOverview,
});

function InventoryOverview() {
  const [productQuery, setProductQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => warehousesApi.list(),
  });

  // ดึงสินค้าทั้งหมดจาก Supabase
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  // ดึงการเคลื่อนไหวสต็อกล่าสุด
  const { data: movements = [] } = useQuery({
    queryKey: ["movements", "all"],
    queryFn: () => movementsApi.list(),
  });

  // ดึงสินค้าใกล้หมดจาก dashboard
  const { data: lowStockProducts = [] } = useQuery({
    queryKey: ["low-stock-products"],
    queryFn: () => dashboardApi.lowStockProducts(),
  });

  // ดึงสินค้าใกล้หมดอายุ
  const { data: expiringProducts = [] } = useQuery({
    queryKey: ["expiring-products"],
    queryFn: () => productsApi.expiring(),
  });

  // คำนวณสถิติจากข้อมูลจริง
  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const stockValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
  const totalSkus = products.length;
  const outOfStockCount = products.filter((p) => p.status === "out").length;
  const lowStockCount = products.filter((p) => p.status === "low").length;
  const inStockCount = products.filter((p) => p.status === "active").length;
  const expiredCount = expiringProducts.filter((p) => p.expiryStatus === "expired").length;
  const criticalExpiryCount = expiringProducts.filter((p) => p.expiryStatus === "critical").length;
  const warningExpiryCount = expiringProducts.filter((p) => p.expiryStatus === "warning").length;
  const todayMovements = movements.filter((m) => {
    const today = new Date().toISOString().slice(0, 10);
    return m.date.startsWith(today);
  });
  const inCount = todayMovements.filter((m) => m.qty > 0).length;
  const outCount = todayMovements.filter((m) => m.qty < 0).length;

  // กรองสินค้าตาม search/category/status
  const filteredProducts = useMemo(() => {
    return products.filter(
      (p) =>
        (categoryFilter === "all" || p.category === categoryFilter) &&
        (statusFilter === "all" || p.status === statusFilter) &&
        (p.name.includes(productQuery) ||
          p.sku.toLowerCase().includes(productQuery.toLowerCase()) ||
          (p.barcode ?? "").includes(productQuery)),
    );
  }, [products, productQuery, categoryFilter, statusFilter]);

  // สร้างข้อมูลกราฟ 7 วันล่าสุดจาก movements จริง
  const chartData = useMemo(() => {
    const days: { day: string; in: number; out: number }[] = [];
    const dayNames = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayMovements = movements.filter((m) => m.date.startsWith(key));
      days.push({
        day: dayNames[d.getDay()] ?? "?",
        in: dayMovements.filter((m) => m.qty > 0).reduce((s, m) => s + m.qty, 0),
        out: Math.abs(dayMovements.filter((m) => m.qty < 0).reduce((s, m) => s + m.qty, 0)),
      });
    }
    return days;
  }, [movements]);

  const handleExport = () => {
    exportToCSV(
      filteredProducts.map((p) => ({
        ชื่อสินค้า: p.name,
        SKU: p.sku,
        บาร์โค้ด: p.barcode,
        หมวดหมู่: p.category,
        แบรนด์: p.brand,
        สต็อก: p.stock,
        ขั้นต่ำ: p.minStock,
        หน่วย: p.unit,
        ราคาทุน: p.cost,
        ราคาขาย: p.price,
        มูลค่าสต็อก: p.stock * p.cost,
        สถานะ: p.status,
      })),
      "inventory-stock.csv",
    );
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="คลังสินค้า"
        description="ภาพรวมสต็อกทั้งหมด · อัปเดตทุก 15 นาที"
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
          value={numberFmt(totalStock)}
          hint={`${totalSkus} รายการสินค้า`}
          icon={Boxes}
        />
        <StatCard
          label="มูลค่าสต็อก"
          value={compactCurrency(stockValue)}
          hint="ตามราคาทุน"
          icon={Warehouse}
          tone="info"
        />
        <StatCard
          label="เคลื่อนไหววันนี้"
          value={`${todayMovements.length} รายการ`}
          hint={`รับเข้า ${inCount} · จ่ายออก ${outCount}`}
          icon={ArrowDownToLine}
        />
        <StatCard
          label="สินค้าใกล้หมด"
          value={String(lowStockCount + outOfStockCount)}
          hint={`ใกล้หมด ${lowStockCount} · หมดแล้ว ${outOfStockCount}`}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="สินค้าพร้อมขาย"
          value={numberFmt(inStockCount)}
          hint="สต็อกปกติ"
          icon={PackageCheck}
          tone="info"
        />
        <StatCard
          label="สินค้าหมดสต็อก"
          value={numberFmt(outOfStockCount)}
          hint="ต้องเติมทันที"
          icon={PackageX}
          tone="warning"
        />
        <StatCard
          label="จำนวน SKU ทั้งหมด"
          value={numberFmt(totalSkus)}
          hint="รายการสินค้าในระบบ"
          icon={Boxes}
        />
        <StatCard
          label="มูลค่าเฉลี่ยต่อ SKU"
          value={compactCurrency(totalSkus > 0 ? Math.round(stockValue / totalSkus) : 0)}
          hint="ตามราคาทุน"
          icon={Warehouse}
          tone="info"
        />
        <StatCard
          label="สินค้าใกล้หมดอายุ"
          value={String(expiringProducts.length)}
          hint={
            expiringProducts.length > 0
              ? `หมดอายุ ${expiredCount} · 7วัน ${criticalExpiryCount} · 30วัน ${warningExpiryCount}`
              : "ไม่มีสินค้าใกล้หมดอายุ"
          }
          icon={CalendarClock}
          tone={expiringProducts.length > 0 ? "warning" : "default"}
        />
      </div>

      {/* แจ้งเตือนสินค้าใกล้หมดอายุ */}
      {expiringProducts.length > 0 && (
        <section className="card-soft border-warning/30">
          <header className="flex items-center gap-2 border-b border-warning/20 px-4 py-3">
            <CalendarClock className="size-4 text-warning" />
            <h2 className="text-sm font-semibold">สินค้าใกล้หมดอายุ</h2>
            <span className="ml-auto text-xs text-muted-foreground">
              {expiringProducts.length} รายการ
            </span>
          </header>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">สต็อก</TableHead>
                  <TableHead>วันหมดอายุ</TableHead>
                  <TableHead>เหลืออีก</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiringProducts.map((p) => {
                  const tone =
                    p.expiryStatus === "expired"
                      ? "bg-destructive/10 text-destructive border-destructive/25"
                      : p.expiryStatus === "critical"
                        ? "bg-warning/15 text-warning border-warning/30"
                        : "bg-info/12 text-info border-info/25";
                  const label =
                    p.expiryStatus === "expired"
                      ? "หมดอายุแล้ว"
                      : p.expiryStatus === "critical"
                        ? "ใกล้หมดอายุ (7 วัน)"
                        : "ใกล้หมดอายุ (30 วัน)";
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm">
                            {p.emoji}
                          </span>
                          <span className="truncate text-sm font-medium">{p.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.sku}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {numberFmt(p.stock)}{" "}
                        <span className="text-xs text-muted-foreground">{p.unit}</span>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">{p.expiryDate}</TableCell>
                      <TableCell className="text-sm font-semibold tabular-nums">
                        {p.daysUntilExpiry < 0 ? (
                          <span className="text-destructive">
                            หมดอายุ {Math.abs(p.daysUntilExpiry)} วันแล้ว
                          </span>
                        ) : p.daysUntilExpiry === 0 ? (
                          <span className="text-destructive">หมดอายุวันนี้</span>
                        ) : (
                          <span className={p.daysUntilExpiry <= 7 ? "text-warning" : ""}>
                            {p.daysUntilExpiry} วัน
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${tone}`}
                        >
                          {label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="rounded-lg" asChild>
                          <Link to="/products/$productId" params={{ productId: p.id }}>
                            ดู
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="card-soft xl:col-span-2">
          <header className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">การเคลื่อนไหวสต็อก</h2>
            <p className="text-xs text-muted-foreground">รับเข้าเทียบจ่ายออก 7 วันล่าสุด</p>
          </header>
          <div className="h-64 p-4 pr-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -22, right: 0, top: 6, bottom: 0 }}>
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
            {movements.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                ยังไม่มีการเคลื่อนไหวสต็อก
              </li>
            )}
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
            {lowStockProducts.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                สต็อกเพียงพอทุกรายการ
              </li>
            )}
          </ul>
        </section>
      </div>

      {/* ตารางสต็อกสินค้าทั้งหมด */}
      <section className="card-soft">
        <header className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">สต็อกสินค้าทั้งหมด</h2>
            <p className="text-xs text-muted-foreground">
              {filteredProducts.length} จาก {totalSkus} รายการ
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="ค้นหาชื่อ / SKU / บาร์โค้ด"
                className="h-9 w-44 rounded-xl pl-8"
              />
            </div>
            <FilterSelect
              label="หมวดหมู่"
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[
                { value: "all", label: "ทุกหมวดหมู่" },
                ...productCategories.map((c) => ({ value: c, label: c })),
              ]}
            />
            <FilterSelect
              label="สถานะ"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "all", label: "ทุกสถานะ" },
                { value: "active", label: "พร้อมขาย" },
                { value: "low", label: "ใกล้หมด" },
                { value: "out", label: "หมดสต็อก" },
                { value: "draft", label: "ร่าง" },
                { value: "discontinued", label: "เลิกขาย" },
              ]}
            />
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleExport}>
              <Download className="size-4" /> ส่งออก
            </Button>
          </div>
        </header>

        {filteredProducts.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="ไม่พบสินค้าที่ตรงกับตัวกรอง"
            description="ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="text-right">สต็อก</TableHead>
                  <TableHead className="text-right">ขั้นต่ำ</TableHead>
                  <TableHead className="text-right">ราคาทุน</TableHead>
                  <TableHead className="text-right">มูลค่าสต็อก</TableHead>
                  <TableHead>วันหมดอายุ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-sm">
                          {p.emoji}
                        </span>
                        <span className="truncate text-sm font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.sku}</TableCell>
                    <TableCell className="text-sm">{p.category}</TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {numberFmt(p.stock)}{" "}
                      <span className="text-xs text-muted-foreground">{p.unit}</span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {p.minStock}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {currency(p.cost)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {currency(p.stock * p.cost)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {p.expiryDate ? (
                        <span
                          className={
                            new Date(p.expiryDate) < new Date()
                              ? "text-destructive font-semibold"
                              : new Date(p.expiryDate) <= new Date(Date.now() + 7 * 86400000)
                                ? "text-warning font-semibold"
                                : ""
                          }
                        >
                          {p.expiryDate}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="rounded-lg" asChild>
                        <Link to="/products/$productId" params={{ productId: p.id }}>
                          ดู
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableRow className="border-t-2 font-semibold">
                <TableCell colSpan={3}>รวมทั้งหมด</TableCell>
                <TableCell className="text-right tabular-nums">
                  {numberFmt(filteredProducts.reduce((s, p) => s + p.stock, 0))}
                </TableCell>
                <TableCell></TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right tabular-nums">
                  {currency(filteredProducts.reduce((s, p) => s + p.stock * p.cost, 0))}
                </TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
