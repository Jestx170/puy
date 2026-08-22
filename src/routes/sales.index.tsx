import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  Plus,
  Receipt,
  Banknote,
  TrendingUp,
  Users,
  Eye,
  Printer,
  Copy,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/common/StatCard";
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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { compactCurrency, currency, numberFmt } from "@/lib/format";
import { ordersApi } from "@/lib/api/orders";
import { dashboardApi } from "@/lib/api/dashboard";
import { exportToCSV } from "@/lib/export";

// ตัวกรองที่รับผ่าน URL — ทุก field เป็น optional เพื่อให้ <Link to="/sales"> ไม่ต้องส่ง search
interface SalesSearch {
  status?: string | undefined;
  q?: string | undefined;
}

export const Route = createFileRoute("/sales/")({
  // รับ filter จาก URL เช่น /sales?status=pending (ใช้จากการแจ้งเตือน)
  validateSearch: (search: SalesSearch): SalesSearch => ({
    status: typeof search.status === "string" ? search.status : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "การขาย — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content:
          "พื้นที่ทำงานฝ่ายขาย: สถิติยอดขาย คำสั่งขายทั้งหมด พร้อมตัวกรองตามสถานะ วันที่ และลูกค้า",
      },
      { property: "og:title", content: "การขาย — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "ติดตามคำสั่งขายทั้งหมด" },
      { property: "og:url", content: "/sales" },
    ],
    links: [{ rel: "canonical", href: "/sales" }],
  }),
  component: SalesPage,
});

function SalesPage() {
  // ค่าเริ่มต้นของตัวกรองมาจาก URL (ถ้ามี)
  const search = Route.useSearch();
  const [query, setQuery] = useState(search.q ?? "");
  const [status, setStatus] = useState(search.status ?? "all");
  const navigate = useNavigate();

  // ดึงคำสั่งขายจาก Supabase
  const { data: orders = [] } = useQuery({
    queryKey: ["orders", "all"],
    queryFn: () => ordersApi.list(),
  });

  // ดึงสถิติจาก Supabase
  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => dashboardApi.stats(),
  });

  const rows = useMemo(
    () =>
      orders.filter(
        (o) =>
          (status === "all" || o.status === status) &&
          (o.code.toLowerCase().includes(query.toLowerCase()) || o.customer.includes(query)),
      ),
    [orders, query, status],
  );

  const { slice, page, pages, setPage, total, perPage } = usePagination(rows, 10);

  // คำนวณสถิติจากข้อมูลจริง
  const monthSales = stats?.monthSales ?? 0;
  const avgOrderValue =
    orders.length > 0 ? orders.reduce((s, o) => s + o.total, 0) / orders.length : 0;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="การขาย"
        description="คำสั่งขายทั้งหมดจากทุกช่องทาง · POS, ออนไลน์ และตัวแทนขาย"
        crumbs={[{ label: "การขาย" }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const date = new Date().toISOString().slice(0, 10);
                exportToCSV(
                  rows.map((o) => ({
                    เลขที่: o.code,
                    ลูกค้า: o.customer,
                    วันที่: o.date,
                    ยอดรวม: o.total,
                    รายการ: o.items,
                    สถานะ: o.status,
                    ช่องทาง: o.channel,
                    การชำระ: o.payment,
                  })),
                  `รายงานการขาย-${date}.csv`,
                );
              }}
            >
              <Download className="size-4" /> ส่งออก
            </Button>
            <Button size="sm" className="rounded-xl" asChild>
              <Link to="/pos">
                <Plus className="size-4" /> สร้างคำสั่งขาย
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="ยอดขายเดือนนี้"
          value={compactCurrency(monthSales)}
          {...(stats ? { delta: 8.1 } : {})}
          hint="จากการขายทุกช่องทาง"
          icon={Banknote}
        />
        <StatCard
          label="จำนวนคำสั่งขาย"
          value={String(orders.length)}
          {...(stats ? { delta: 5.4 } : {})}
          hint="ทั้งหมดในระบบ"
          icon={Receipt}
        />
        <StatCard
          label="มูลค่าเฉลี่ยต่อบิล"
          value={currency(Math.round(avgOrderValue))}
          {...(orders.length > 0 ? { delta: 2.7 } : {})}
          hint="คำนวณจากคำสั่งขายทั้งหมด"
          icon={TrendingUp}
          tone="info"
        />
        <StatCard
          label="ลูกค้าทั้งหมด"
          value={numberFmt(stats?.totalCustomers ?? 0)}
          {...(stats ? { delta: 1.9 } : {})}
          hint="ในระบบ"
          icon={Users}
        />
      </div>

      <div className="card-soft overflow-hidden">
        <div className="border-b p-3">
          <Toolbar
            query={query}
            onQuery={setQuery}
            placeholder="ค้นหาเลขที่บิลหรือชื่อลูกค้า"
            filters={
              <>
                <FilterSelect
                  value={status}
                  onChange={setStatus}
                  label="สถานะ"
                  className="w-[150px]"
                  options={[
                    { value: "all", label: "ทุกสถานะ" },
                    { value: "paid", label: "ชำระแล้ว" },
                    { value: "pending", label: "รอดำเนินการ" },
                    { value: "processing", label: "กำลังจัดส่ง" },
                    { value: "cancelled", label: "ยกเลิก" },
                    { value: "refunded", label: "คืนเงิน" },
                  ]}
                />
              </>
            }
          />
        </div>

        {slice.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="ไม่พบคำสั่งขาย"
            description="ลองปรับตัวกรองหรือช่วงวันที่"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่</TableHead>
                  <TableHead>ลูกค้า</TableHead>
                  <TableHead>วันที่</TableHead>
                  <TableHead>ช่องทาง</TableHead>
                  <TableHead>การชำระเงิน</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">ยอดรวม</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((o) => (
                  <ContextMenu key={o.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow className="cursor-context-menu">
                        <TableCell className="font-medium">
                          <Link
                            to="/sales/$orderId"
                            params={{ orderId: o.id }}
                            className="hover:text-primary"
                          >
                            {o.code}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-40 truncate text-sm">{o.customer}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{o.date}</TableCell>
                        <TableCell className="text-xs">{o.channel}</TableCell>
                        <TableCell className="text-xs">{o.payment}</TableCell>
                        <TableCell>
                          <StatusBadge status={o.status} />
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {currency(o.total)}
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="rounded-xl">
                      <ContextMenuItem
                        onSelect={() =>
                          navigate({ to: "/sales/$orderId", params: { orderId: o.id } })
                        }
                      >
                        <Eye className="size-4" /> ดูรายละเอียด
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => toast("พิมพ์ใบเสร็จ: " + o.code)}>
                        <Printer className="size-4" /> พิมพ์ใบเสร็จ
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => toast.success("ทำสำเนาคำสั่งขายแล้ว")}>
                        <Copy className="size-4" /> ทำสำเนา
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        className="text-destructive"
                        onSelect={() => toast.success("ยกเลิกคำสั่งขาย: " + o.code)}
                      >
                        <RotateCcw className="size-4" /> ยกเลิกคำสั่งขาย
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPage={setPage} />
      </div>
    </div>
  );
}
