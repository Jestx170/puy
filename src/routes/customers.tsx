import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Phone,
  Mail,
  MapPin,
  Download,
  MessageSquarePlus,
  ShoppingBag,
  FileText,
  Sparkles,
  UserRound,
  Sprout,
  Calendar,
  MapPinned,
  Ruler,
  Eye,
  Trash2,
  Printer,
  AlertTriangle,
  TrendingUp,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Toolbar, FilterSelect } from "@/components/common/DataToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  customers as seedCustomers,
  currency,
  orders,
  products,
  documents,
  timeline,
  cultivationStages,
  stageTone,
  allCrops,
  type CultivationStage,
  type Customer,
  type MemberTier,
} from "@/data/mock";
import {
  recommendForCustomer,
  recommendForCultivation,
  stageProgress,
  stagePlaybook,
} from "@/lib/agronomy";
import { printReceipt } from "@/lib/print";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { exportToCSV } from "@/lib/export";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "ลูกค้า CRM — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content: "จัดการฐานข้อมูลลูกค้าเกษตรกร ประวัติการซื้อ ระดับสมาชิก และกิจกรรมทั้งหมด",
      },
      { property: "og:title", content: "ลูกค้า CRM — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "ฐานข้อมูลลูกค้าและประวัติการซื้อแบบครบวงจร" },
      { property: "og:url", content: "/customers" },
    ],
    links: [{ rel: "canonical", href: "/customers" }],
  }),
  component: CrmPage,
});

const tierTone: Record<string, string> = {
  Platinum: "bg-foreground/10 text-foreground",
  Gold: "bg-warning/15 text-warning",
  Silver: "bg-muted text-muted-foreground",
  Bronze: "bg-accent text-accent-foreground",
};

function CrmPage() {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [stage, setStage] = useState("all"); // กรองตามช่วงการปลูก
  const [crop, setCrop] = useState("all"); // กรองตามพืชที่ปลูก
  const [list, setList] = useState<Customer[]>(seedCustomers);
  const [selected, setSelected] = useState(seedCustomers[0]!.id);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const filtered = useMemo(
    () =>
      list.filter(
        (c) =>
          (tier === "all" || c.tier === tier) &&
          (stage === "all" || c.cultivations.some((cul) => cul.stage === stage)) &&
          (crop === "all" || c.cultivations.some((cul) => cul.crop === crop)) &&
          (c.name.includes(query) ||
            c.code.toLowerCase().includes(query.toLowerCase()) ||
            c.cultivations.some((cul) => cul.crop.includes(query))),
      ),
    [list, query, tier, stage, crop],
  );

  const customer = list.find((c) => c.id === selected) ?? list[0]!;
  const custOrders = orders.filter((o) => o.customerId === customer.id);

  const addCustomer = (c: Customer) => {
    setList((prev) => [c, ...prev]);
    setSelected(c.id);
    toast.success(`เพิ่มลูกค้าใหม่แล้ว: ${c.name}`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setList((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    if (selected === deleteTarget.id) {
      setSelected(list[0]?.id ?? "");
    }
    toast.success(`ลบลูกค้าแล้ว: ${deleteTarget.name}`);
    setDeleteTarget(null);
  };

  // สรุปแปลงเพาะปลูกของลูกค้าที่เลือก (เรียงตามช่วงการปลูก)
  const cultivations = useMemo(
    () =>
      [...customer.cultivations].sort(
        (a, b) => cultivationStages.indexOf(a.stage) - cultivationStages.indexOf(b.stage),
      ),
    [customer],
  );

  // สินค้าแนะนำ คำนวณจากช่วงการปลูก + พื้นที่จริงของทุกแปลง
  const recommendations = useMemo(
    () => recommendForCustomer(cultivations, products),
    [cultivations],
  );
  const recoTotal = useMemo(
    () => recommendations.reduce((s, i) => s + i.subtotal, 0),
    [recommendations],
  );

  const printQuote = () => {
    if (recommendations.length === 0) {
      toast.error("ไม่มีสินค้าแนะนำให้เสนอราคา");
      return;
    }
    const vat = Math.round(recoTotal * 0.07);
    printReceipt({
      storeName: "ปุ๋ยไทย CRM",
      storeAddress: "123 ถนนเกษตร ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000",
      storePhone: "043-123-456",
      docTitle: "ใบเสนอราคา",
      receiptNo: `QT-${Date.now()}`,
      date: new Date().toLocaleDateString("th-TH"),
      customer: customer.name,
      lines: recommendations.map((it) => ({
        name: it.product.name,
        qty: it.qty,
        unit: it.product.unit,
        price: it.product.price,
      })),
      subtotal: recoTotal,
      vat,
      total: recoTotal + vat,
      note: `คำนวณจาก ${cultivations.length} แปลง รวม ${cultivations.reduce((s, c) => s + c.area, 0)} ไร่`,
      footerText: "ราคานี้ยืนยัน 7 วัน\nกรุณาติดต่อเจ้าหน้าที่เพื่อยืนยันการสั่งซื้อ",
    });
    toast.success("เปิดหน้าต่างพิมพ์ใบเสนอราคาแล้ว");
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="ลูกค้า CRM"
        description={`${list.length} รายชื่อในระบบ · อัปเดตอัตโนมัติจากการขายหน้าร้าน`}
        crumbs={[{ label: "ลูกค้า CRM" }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const date = new Date().toISOString().slice(0, 10);
                exportToCSV(
                  filtered.map((c) => ({
                    รหัส: c.code,
                    ชื่อ: c.name,
                    เบอร์: c.phone,
                    อีเมล: c.email,
                    ประเภท: c.type,
                    ระดับ: c.tier,
                    มูลค่าสะสม: c.lifetime,
                    จำนวนคำสั่ง: c.orders,
                    สั่งล่าสุด: c.lastOrder,
                    สมาชิกตั้งแต่: c.since,
                    แท็ก: c.tags.join(", "),
                  })),
                  `ลูกค้า-${date}.csv`,
                );
              }}
            >
              <Download className="size-4" /> ส่งออก
            </Button>
            <Button size="sm" className="rounded-xl" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> เพิ่มลูกค้า
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="card-soft flex max-h-[calc(100vh-13rem)] flex-col overflow-hidden">
          <div className="space-y-2 border-b p-3">
            <Toolbar query={query} onQuery={setQuery} placeholder="ค้นหาชื่อ รหัส หรือพืชที่ปลูก" />
            <div className="grid grid-cols-2 gap-2">
              <FilterSelect
                value={tier}
                onChange={setTier}
                label="ระดับสมาชิก"
                className="w-full"
                options={[
                  { value: "all", label: "ทุกระดับ" },
                  { value: "Platinum", label: "Platinum" },
                  { value: "Gold", label: "Gold" },
                  { value: "Silver", label: "Silver" },
                  { value: "Bronze", label: "Bronze" },
                ]}
              />
              <FilterSelect
                value={stage}
                onChange={setStage}
                label="ช่วงการปลูก"
                className="w-full"
                options={[
                  { value: "all", label: "ทุกช่วง" },
                  ...cultivationStages.map((s) => ({ value: s, label: s })),
                ]}
              />
            </div>
            <FilterSelect
              value={crop}
              onChange={setCrop}
              label="พืชที่ปลูก"
              className="w-full"
              options={[
                { value: "all", label: "ทุกพืช" },
                ...allCrops.map((c) => ({ value: c, label: c })),
              ]}
            />
            {(stage !== "all" || crop !== "all") && (
              <p className="text-[11px] text-muted-foreground">
                พบ {filtered.length} รายชื่อที่ตรงกับช่วง/พืชที่เลือก
              </p>
            )}
          </div>
          <ScrollArea className="flex-1">
            {filtered.length === 0 ? (
              <EmptyState
                icon={UserRound}
                title="ไม่พบลูกค้า"
                description="ลองเปลี่ยนคำค้นหรือตัวกรองช่วงการปลูก"
              />
            ) : (
              <ul className="divide-y">
                {filtered.map((c) => {
                  // ดึงช่วงการปลูกทั้งหมดของลูกค้า (ไม่ซ้ำ) เพื่อแสดงเป็น badge
                  const stages = Array.from(
                    new Set(c.cultivations.map((cul) => cul.stage)),
                  ) as CultivationStage[];
                  return (
                    <li key={c.id}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <button
                            onClick={() => setSelected(c.id)}
                            className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
                              c.id === customer.id ? "bg-accent/60" : ""
                            }`}
                          >
                            <Avatar className="size-9 shrink-0">
                              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                {c.name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{c.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {c.code} · {c.type}
                              </p>
                              {stages.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {stages.slice(0, 3).map((s) => (
                                    <span
                                      key={s}
                                      className={`rounded border px-1 py-0 text-[9px] font-semibold ${
                                        stageTone[s] === "neutral"
                                          ? "bg-muted text-muted-foreground border-border"
                                          : stageTone[s] === "info"
                                            ? "bg-info/12 text-info border-info/25"
                                            : stageTone[s] === "success"
                                              ? "bg-success/12 text-success border-success/25"
                                              : stageTone[s] === "warning"
                                                ? "bg-warning/15 text-warning border-warning/30"
                                                : "bg-destructive/10 text-destructive border-destructive/25"
                                      }`}
                                    >
                                      {s}
                                    </span>
                                  ))}
                                  {stages.length > 3 && (
                                    <span className="text-[9px] text-muted-foreground">
                                      +{stages.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tierTone[c.tier]}`}
                            >
                              {c.tier}
                            </span>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="rounded-xl">
                          <ContextMenuItem onSelect={() => setSelected(c.id)}>
                            <Eye className="size-4" /> ดูโปรไฟล์
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => toast(`สร้างคำสั่งขายใหม่ให้ ${c.name}`)}
                          >
                            <Plus className="size-4" /> สร้างคำสั่งขาย
                          </ContextMenuItem>
                          <ContextMenuItem
                            onSelect={() => toast.success(`คัดลอกเบอร์ติดต่อ: ${c.phone}`)}
                          >
                            <Phone className="size-4" /> คัดลอกเบอร์
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="text-destructive"
                            onSelect={() => setDeleteTarget(c)}
                          >
                            <Trash2 className="size-4" /> ลบลูกค้า
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </aside>

        <section className="card-soft min-w-0 overflow-hidden">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b p-4 sm:flex sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-12 shrink-0">
                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                  {customer.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold">{customer.name}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {customer.code} · ลูกค้าตั้งแต่ {customer.since}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" className="rounded-xl">
                <Phone className="size-4" /> โทร
              </Button>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => toast.success("สร้างคำสั่งขายใหม่")}
              >
                <ShoppingBag className="size-4" /> ขายให้ลูกค้านี้
              </Button>
            </div>
          </header>

          <div className="grid gap-3 border-b p-4 sm:grid-cols-4">
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">ยอดซื้อสะสม</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{currency(customer.lifetime)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">คำสั่งซื้อทั้งหมด</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{customer.orders}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">ระดับสมาชิก</p>
              <p className="mt-1 text-xl font-bold">{customer.tier}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">แปลงเพาะปลูก</p>
              <p className="mt-1 text-xl font-bold tabular-nums">
                {cultivations.length}
                <span className="ml-1 text-xs font-normal text-muted-foreground">แปลง</span>
              </p>
            </div>
          </div>

          <Tabs defaultValue="cultivation" className="p-4">
            <TabsList className="rounded-xl">
              <TabsTrigger value="cultivation">การเพาะปลูก</TabsTrigger>
              <TabsTrigger value="profile">โปรไฟล์</TabsTrigger>
              <TabsTrigger value="history">ประวัติการซื้อ</TabsTrigger>
              <TabsTrigger value="orders">คำสั่งซื้อ</TabsTrigger>
              <TabsTrigger value="docs">เอกสาร</TabsTrigger>
              <TabsTrigger value="reco">สินค้าแนะนำ</TabsTrigger>
            </TabsList>

            <TabsContent value="cultivation" className="mt-4 space-y-4">
              {cultivations.length === 0 ? (
                <EmptyState
                  icon={Sprout}
                  title="ยังไม่มีแปลงเพาะปลูก"
                  description={`${customer.type} รายนี้ไม่ได้ปลูกพืชเอง สามารถเพิ่มแปลงได้ที่ปุ่มด้านล่าง`}
                  action={
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={() => toast("เปิดฟอร์มเพิ่มแปลง")}
                    >
                      <Plus className="size-4" /> เพิ่มแปลงเพาะปลูก
                    </Button>
                  }
                />
              ) : (
                <>
                  {/* สรุปรวมตามช่วงการปลูก */}
                  <div className="grid gap-2 sm:grid-cols-5">
                    {cultivationStages.map((s) => {
                      const count = cultivations.filter((c) => c.stage === s).length;
                      const totalArea = cultivations
                        .filter((c) => c.stage === s)
                        .reduce((sum, c) => sum + c.area, 0);
                      return (
                        <div
                          key={s}
                          className={`rounded-xl border p-3 ${
                            stage === s ? "ring-2 ring-primary/40" : ""
                          } ${count === 0 ? "opacity-50" : ""}`}
                        >
                          <p className="truncate text-[11px] font-semibold text-muted-foreground">
                            {s}
                          </p>
                          <p className="mt-1 text-lg font-bold tabular-nums">{count}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {totalArea > 0 ? `${totalArea} ไร่` : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* รายการแปลงเพาะปลูก */}
                  <div className="space-y-2">
                    {cultivations.map((cul) => {
                      const prog = stageProgress(cul);
                      return (
                        <div key={cul.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Sprout className="size-4 shrink-0 text-primary" />
                                <h3 className="truncate text-sm font-semibold">{cul.crop}</h3>
                                <span
                                  className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${
                                    stageTone[cul.stage] === "neutral"
                                      ? "bg-muted text-muted-foreground border-border"
                                      : stageTone[cul.stage] === "info"
                                        ? "bg-info/12 text-info border-info/25"
                                        : stageTone[cul.stage] === "success"
                                          ? "bg-success/12 text-success border-success/25"
                                          : stageTone[cul.stage] === "warning"
                                            ? "bg-warning/15 text-warning border-warning/30"
                                            : "bg-destructive/10 text-destructive border-destructive/25"
                                  }`}
                                >
                                  {cul.stage}
                                </span>
                              </div>
                              {cul.note && (
                                <p className="mt-1 text-xs text-muted-foreground">{cul.note}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-xl"
                              onClick={() => toast(`อัปเดตช่วงการปลูก: ${cul.crop}`)}
                            >
                              อัปเดตช่วง
                            </Button>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
                            <div className="flex items-center gap-2">
                              <Ruler className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground">พื้นที่:</span>
                              <span className="font-medium tabular-nums">{cul.area} ไร่</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPinned className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground">ที่ตั้ง:</span>
                              <span className="font-medium">{cul.location}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground">ปลูกเมื่อ:</span>
                              <span className="font-medium tabular-nums">{cul.plantedDate}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-muted-foreground">เก็บเกี่ยว:</span>
                              <span className="font-medium tabular-nums">
                                {cul.expectedHarvest}
                              </span>
                            </div>
                          </div>

                          {/* ความคืบหน้ารอบการปลูก คำนวณจากวันปลูก + รอบของพืชชนิดนั้น */}
                          <div className="mt-3 border-t pt-3">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-muted-foreground">
                                ผ่านมา {Math.max(0, prog.daysSincePlanted)} / {prog.cycleDays} วัน
                              </span>
                              <span className="font-semibold tabular-nums">
                                {prog.progressPct}%
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${prog.progressPct}%` }}
                              />
                            </div>

                            {prog.isBehindSchedule ? (
                              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                                <AlertTriangle className="mt-px size-3 shrink-0" />
                                <span>
                                  ตามปฏิทินควรอยู่ช่วง{" "}
                                  <span className="font-semibold">{prog.expectedStage}</span> แล้ว —
                                  ข้อมูลอาจไม่อัปเดต ควรโทรเช็กและเสนอสินค้าช่วงนี้
                                </span>
                              </p>
                            ) : prog.nextStage ? (
                              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                <Clock className="mt-px size-3 shrink-0" />
                                <span>
                                  อีก{" "}
                                  <span className="font-semibold text-foreground">
                                    {prog.daysToNextStage} วัน
                                  </span>{" "}
                                  จะเข้าช่วง{" "}
                                  <span className="font-semibold text-foreground">
                                    {prog.nextStage}
                                  </span>{" "}
                                  — เตรียมเสนอสินค้าล่วงหน้าได้
                                </span>
                              </p>
                            ) : (
                              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                <TrendingUp className="mt-px size-3 shrink-0" />
                                <span>ครบรอบการปลูกแล้ว — เสนอสินค้าเตรียมดินรอบถัดไปได้</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => toast("เปิดฟอร์มเพิ่มแปลงเพาะปลูก")}
                  >
                    <Plus className="size-4" /> เพิ่มแปลงเพาะปลูก
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="profile" className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">ข้อมูลส่วนตัว</h3>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">ประเภทลูกค้า</dt>
                      <dd className="font-medium">{customer.type}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">ระดับสมาชิก</dt>
                      <dd className="font-medium">{customer.tier}</dd>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {customer.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="rounded-md">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </dl>
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">ข้อมูลติดต่อ</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Phone className="size-4 shrink-0 text-muted-foreground" /> {customer.phone}
                    </li>
                    <li className="flex items-center gap-2">
                      <Mail className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{customer.email}</span>
                    </li>
                    <li className="flex gap-2">
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>{customer.address}</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border p-4">
                  <h3 className="text-sm font-semibold">บันทึกภายใน</h3>
                  <Textarea
                    defaultValue={customer.notes}
                    className="mt-2 min-h-24 rounded-xl text-sm"
                    key={customer.id}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 rounded-xl"
                    onClick={() => toast.success("บันทึกโน้ตแล้ว")}
                  >
                    <MessageSquarePlus className="size-4" /> บันทึกโน้ต
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <h3 className="text-sm font-semibold">ไทม์ไลน์กิจกรรม</h3>
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
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <ul className="divide-y rounded-xl border">
                {products.slice(0, 5).map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                      {p.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        ซื้อล่าสุด 2026-0{7 - i}-1{i} · {2 + i} {p.unit}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {currency(p.price * (2 + i))}
                    </p>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="orders" className="mt-4">
              {custOrders.length === 0 ? (
                <EmptyState
                  title="ยังไม่มีคำสั่งซื้อ"
                  description="เมื่อลูกค้ารายนี้สั่งซื้อ รายการจะแสดงที่นี่"
                />
              ) : (
                <ul className="divide-y rounded-xl border">
                  {custOrders.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{o.code}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.date} · {o.payment}
                        </p>
                      </div>
                      <StatusBadge status={o.status} />
                      <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">
                        {currency(o.total)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="docs" className="mt-4">
              <ul className="divide-y rounded-xl border">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 p-3">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.kind} · {d.size} · {d.date}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="rounded-lg">
                      <Download className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </TabsContent>

            <TabsContent value="reco" className="mt-4 space-y-3">
              {recommendations.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="ยังแนะนำสินค้าไม่ได้"
                  description={`${customer.type} รายนี้ไม่มีข้อมูลแปลงเพาะปลูก จึงคำนวณความต้องการไม่ได้ — เพิ่มแปลงก่อนเพื่อให้ระบบแนะนำสินค้าและปริมาณ`}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        คำนวณจาก {cultivations.length} แปลง · รวม{" "}
                        {cultivations.reduce((s, c) => s + c.area, 0)} ไร่
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ปริมาณคิดจากอัตราการใช้ต่อไร่ตามช่วงการปลูกที่บันทึกไว้
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-right">
                        <span className="block text-[11px] text-muted-foreground">มูลค่ารวม</span>
                        <span className="text-lg font-bold tabular-nums text-primary">
                          {currency(recoTotal)}
                        </span>
                      </p>
                      <Button size="sm" className="rounded-xl" onClick={printQuote}>
                        <Printer className="size-4" /> พิมพ์ใบเสนอราคา
                      </Button>
                    </div>
                  </div>

                  {/* แยกตามแปลง เพื่อให้เห็นว่าของแต่ละอย่างมาจากแปลงไหน */}
                  {cultivations.map((cul) => {
                    const items = recommendForCultivation(cul, products);
                    if (items.length === 0) return null;
                    return (
                      <div key={cul.id} className="rounded-xl border">
                        <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                          <Sprout className="size-4 shrink-0 text-primary" />
                          <span className="text-sm font-semibold">{cul.crop}</span>
                          <span className="text-xs text-muted-foreground">
                            {cul.area} ไร่ · {cul.stage}
                          </span>
                          <span className="ml-auto text-xs font-semibold tabular-nums">
                            {currency(items.reduce((s, i) => s + i.subtotal, 0))}
                          </span>
                        </header>
                        <p className="border-b bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                          {stagePlaybook[cul.stage].advice}
                        </p>
                        <ul className="divide-y">
                          {items.map((it) => (
                            <li key={it.product.id} className="flex items-start gap-3 px-3 py-2.5">
                              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-base">
                                {it.product.emoji}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{it.product.name}</p>
                                <p className="text-xs text-muted-foreground">{it.reason}</p>
                                {it.shortStock && (
                                  <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-warning">
                                    <AlertTriangle className="size-3 shrink-0" />
                                    สต็อกเหลือ {it.product.stock} {it.product.unit} —
                                    ไม่พอตามที่แนะนำ
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold tabular-nums">
                                  {it.qty} {it.product.unit}
                                </p>
                                <p className="text-[11px] text-muted-foreground tabular-nums">
                                  {currency(it.subtotal)}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <CustomerForm open={addOpen} onOpenChange={setAddOpen} onCreate={addCustomer} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบลูกค้า?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบ “{deleteTarget?.name}” จะไม่สามารถย้อนกลับได้ ประวัติคำสั่งขายเดิมจะยังคงอยู่
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl" onClick={confirmDelete}>
              ลบลูกค้า
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ----------------------------- Customer Form ------------------------------- */

function CustomerForm({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (c: Customer) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Customer["type"]>("เกษตรกร");
  const [tier, setTier] = useState<MemberTier>("Bronze");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setName("");
    setType("เกษตรกร");
    setTier("Bronze");
    setPhone("");
    setEmail("");
    setAddress("");
    setNotes("");
  };

  const submit = () => {
    if (!name.trim()) {
      toast.error("กรุณากรอกชื่อลูกค้า");
      return;
    }
    const id = `c-${Date.now()}`;
    const newCustomer: Customer = {
      id,
      name: name.trim(),
      code: `CUS-${String(1100 + Math.floor(Math.random() * 8999))}`,
      phone: phone.trim() || "08XXXXXXXX",
      email: email.trim() || `${id}@puithai.co.th`,
      address: address.trim() || "—",
      type,
      tier,
      lifetime: 0,
      orders: 0,
      lastOrder: new Date().toISOString().slice(0, 10),
      since: new Date().toISOString().slice(0, 10),
      notes: notes.trim(),
      tags: ["ลูกค้าใหม่"],
      cultivations: [],
    };
    onCreate(newCustomer);
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" /> เพิ่มลูกค้าใหม่
          </SheetTitle>
          <SheetDescription>
            กรอกข้อมูลลูกค้า · สามารถเพิ่มแปลงเพาะปลูกได้ภายหลังในหน้าโปรไฟล์
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="cus-name" className="text-xs font-semibold">
              ชื่อลูกค้า *
            </Label>
            <Input
              id="cus-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี / ร้านเกษตร ABC"
              autoFocus
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ประเภทลูกค้า</Label>
              <Select value={type} onValueChange={(v) => setType(v as Customer["type"])}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="เกษตรกร">เกษตรกร</SelectItem>
                  <SelectItem value="ร้านค้าปลีก">ร้านค้าปลีก</SelectItem>
                  <SelectItem value="สหกรณ์">สหกรณ์</SelectItem>
                  <SelectItem value="องค์กร">องค์กร</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ระดับสมาชิก</Label>
              <Select value={tier} onValueChange={(v) => setTier(v as MemberTier)}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="Bronze">Bronze</SelectItem>
                  <SelectItem value="Silver">Silver</SelectItem>
                  <SelectItem value="Gold">Gold</SelectItem>
                  <SelectItem value="Platinum">Platinum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cus-phone" className="text-xs font-semibold">
              เบอร์โทร
            </Label>
            <Input
              id="cus-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="08XXXXXXXX"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cus-email" className="text-xs font-semibold">
              อีเมล
            </Label>
            <Input
              id="cus-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cus-address" className="text-xs font-semibold">
              ที่อยู่
            </Label>
            <Textarea
              id="cus-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="บ้านเลขที่ หมู่ ต. อ. จ. รหัสไปรษณีย์"
              className="min-h-16 rounded-xl text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cus-notes" className="text-xs font-semibold">
              หมายเหตุ (ไม่บังคับ)
            </Label>
            <Textarea
              id="cus-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น ลูกค้าประจำ ติดต่อผ่านไลน์"
              className="min-h-16 rounded-xl text-sm"
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button className="rounded-xl" onClick={submit}>
            <Plus className="size-4" /> เพิ่มลูกค้า
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
