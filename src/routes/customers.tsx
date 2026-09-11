import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Loader2,
  Printer,
  AlertTriangle,
  TrendingUp,
  Clock,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Toolbar, FilterSelect } from "@/components/common/DataToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductImage } from "@/components/common/ProductImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { currency } from "@/lib/format";
import {
  cultivationStages,
  stageEmoji,
  stageIdByName,
  stageTone,
  readyCropPrograms,
  DEFAULT_CROP,
} from "@/types";
import type {
  Cultivation,
  CultivationStage,
  Customer,
  MemberTier,
  NextRoundInfo,
  Product,
  RecommendedProduct,
} from "@/types";
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
import { customersApi, cultivationsApi } from "@/lib/api/customers";
import { productsApi } from "@/lib/api/products";
import { ordersApi } from "@/lib/api/orders";
import { nextRoundApi } from "@/lib/api/cultivation-stages";
import { NextRoundCard } from "@/components/common/NextRoundCard";

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

const stageOrderIndex = (stageName: string) => {
  const idx = cultivationStages.indexOf(stageName as CultivationStage);
  return idx === -1 ? 999 : idx;
};

function stageBadgeClass(stageName: string) {
  const tone = stageTone[stageName as CultivationStage] ?? "neutral";
  if (tone === "neutral") return "bg-muted text-muted-foreground border-border";
  if (tone === "info") return "bg-info/12 text-info border-info/25";
  if (tone === "success") return "bg-success/12 text-success border-success/25";
  if (tone === "warning") return "bg-warning/15 text-warning border-warning/30";
  return "bg-destructive/10 text-destructive border-destructive/25";
}

function CrmPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState("all");
  const [stage, setStage] = useState("all"); // กรองตามช่วงการปลูก
  const [crop, setCrop] = useState("all"); // กรองตามพืชที่ปลูก
  const [selected, setSelected] = useState<string>("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [sellOpen, setSellOpen] = useState(false);
  const [cultFormOpen, setCultFormOpen] = useState(false);
  const [cultEditTarget, setCultEditTarget] = useState<Cultivation | null>(null);
  const qc = useQueryClient();

  // ดึงลูกค้าจาก Supabase
  const { data: list = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.list(),
  });
  const { data: allCultivations = [] } = useQuery({
    queryKey: ["cultivations", "all"],
    queryFn: () => cultivationsApi.listAll(),
  });

  const customersWithCultivations = useMemo(() => {
    const byCustomer = new Map<string, Cultivation[]>();
    for (const cul of allCultivations) {
      const current = byCustomer.get(cul.customerId) ?? [];
      current.push({
        id: cul.id,
        crop: cul.crop,
        stage: cul.stage,
        area: cul.area,
        plantedDate: cul.plantedDate,
        expectedHarvest: cul.expectedHarvest,
        location: cul.location,
        note: cul.note,
        stageId: cul.stageId,
        currentSequence: cul.currentSequence,
      });
      byCustomer.set(cul.customerId, current);
    }
    return list.map((c) => ({ ...c, cultivations: byCustomer.get(c.id) ?? [] }));
  }, [list, allCultivations]);

  // ดึงสินค้าจาก Supabase (สำหรับสินค้าแนะนำ)
  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  // เลือกลูกค้าคนแรกเป็นค่าเริ่มต้นถ้ายังไม่ได้เลือก
  const effectiveSelected = selected || customersWithCultivations[0]?.id || "";
  const customerBase =
    customersWithCultivations.find((c) => c.id === effectiveSelected) ??
    customersWithCultivations[0];

  // ดึงแปลงเพาะปลูกของลูกค้าที่เลือกจาก Supabase
  const { data: cultivationsData = [] } = useQuery({
    queryKey: ["cultivations", effectiveSelected],
    queryFn: () => cultivationsApi.listByCustomer(effectiveSelected),
    enabled: !!effectiveSelected,
  });

  // รวมแปลงเพาะปลูกเข้ากับ customer object
  const customerWithCultivations: Customer | undefined = useMemo(
    () => (customerBase ? { ...customerBase, cultivations: cultivationsData } : undefined),
    [customerBase, cultivationsData],
  );

  // ดึงคำสั่งซื้อของลูกค้าจาก Supabase
  const { data: custOrders = [] } = useQuery({
    queryKey: ["orders", "customer", effectiveSelected],
    queryFn: () => ordersApi.listByCustomer(effectiveSelected),
    enabled: !!effectiveSelected,
  });

  // ดึงรายการพืชทั้งหมดจากแปลงเพาะปลูกของลูกค้าทั้งระบบ
  const allCrops = useMemo(
    () =>
      Array.from(
        new Set(customersWithCultivations.flatMap((c) => c.cultivations.map((cul) => cul.crop))),
      ).sort(),
    [customersWithCultivations],
  );

  const filtered = useMemo(
    () =>
      customersWithCultivations.filter(
        (c) =>
          (tier === "all" || c.tier === tier) &&
          (stage === "all" || c.cultivations.some((cul) => cul.stage === stage)) &&
          (crop === "all" || c.cultivations.some((cul) => cul.crop === crop)) &&
          (c.name.includes(query) ||
            c.code.toLowerCase().includes(query.toLowerCase()) ||
            c.cultivations.some((cul) => cul.crop.includes(query))),
      ),
    [customersWithCultivations, query, tier, stage, crop],
  );

  const addCustomer = async (c: Customer) => {
    try {
      const created = await customersApi.create(c);
      qc.setQueryData<Customer[]>(["customers"], (prev) => [created, ...(prev ?? [])]);
      setSelected(created.id);
      toast.success(`เพิ่มลูกค้าใหม่แล้ว: ${created.name}`);
    } catch (e) {
      toast.error("เพิ่มลูกค้าไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await customersApi.remove(deleteTarget.id);
      qc.setQueryData<Customer[]>(["customers"], (prev) =>
        (prev ?? []).filter((c) => c.id !== deleteTarget.id),
      );
      if (selected === deleteTarget.id) {
        setSelected("");
      }
      toast.success(`ลบลูกค้าแล้ว: ${deleteTarget.name}`);
    } catch (e) {
      toast.error("ลบลูกค้าไม่สำเร็จ", { description: (e as Error).message });
    }
    setDeleteTarget(null);
  };

  // สรุปแปลงเพาะปลูกของลูกค้าที่เลือก (เรียงตามช่วงการปลูก)
  const cultivations = useMemo(
    () =>
      [...(customerWithCultivations?.cultivations ?? [])].sort(
        (a, b) => stageOrderIndex(a.stage) - stageOrderIndex(b.stage),
      ),
    [customerWithCultivations],
  );

  const stageSummary = useMemo(
    () =>
      Array.from(new Set(cultivations.map((c) => c.stage))).sort(
        (a, b) => stageOrderIndex(a) - stageOrderIndex(b),
      ),
    [cultivations],
  );

  // สินค้าแนะนำ คำนวณจากช่วงการปลูก + พื้นที่จริงของทุกแปลง
  const recommendations = useMemo(
    () => (products.length ? recommendForCustomer(cultivations, products) : []),
    [cultivations, products],
  );
  const recoTotal = useMemo(
    () => recommendations.reduce((s, i) => s + i.subtotal, 0),
    [recommendations],
  );

  // ดึงข้อมูลรอบถัดไปจาก view v_cultivation_next_round
  const { data: nextRounds = [], refetch: refetchNextRounds } = useQuery({
    queryKey: ["next-rounds", effectiveSelected],
    queryFn: () => nextRoundApi.listByCustomer(effectiveSelected),
    enabled: !!effectiveSelected,
  });
  const nextRoundByCultivation = useMemo(
    () => new Map(nextRounds.map((nr) => [nr.cultivationId, nr])),
    [nextRounds],
  );

  // ดึงสินค้าแนะนำของแต่ละรอบถัดไป (parallel)
  const [nextRoundProducts, setNextRoundProducts] = useState<Record<string, RecommendedProduct[]>>(
    {},
  );

  useEffect(() => {
    if (nextRounds.length === 0) {
      setNextRoundProducts({});
      return;
    }
    let cancelled = false;
    Promise.all(
      nextRounds.map(async (nr: NextRoundInfo) => ({
        cultivationId: nr.cultivationId,
        products: await nextRoundApi.recommendedProducts(nr),
      })),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, RecommendedProduct[]> = {};
      for (const r of results) map[r.cultivationId] = r.products;
      setNextRoundProducts(map);
    });
    return () => {
      cancelled = true;
    };
  }, [nextRounds]);

  /** ข้อมูลรอบถัดไป + สินค้าที่ผูกกับระยะจริงในฐานข้อมูล (แยกตามแปลง) */
  const stageRecoByCultivation = useMemo(
    () =>
      cultivations.map((cul) => ({
        cultivation: cul,
        nextRound: nextRoundByCultivation.get(cul.id),
        items: nextRoundProducts[cul.id] ?? [],
      })),
    [cultivations, nextRoundByCultivation, nextRoundProducts],
  );

  const hasAnyRecommendation = recommendations.length > 0 || stageRecoByCultivation.length > 0;

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
      customer: customerWithCultivations?.name ?? "",
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

  // ถ้ายังไม่มีลูกค้าเลย แสดง empty state
  if (customersWithCultivations.length === 0) {
    return (
      <div className="space-y-5 p-4 sm:p-6">
        <PageHeader
          title="ลูกค้า CRM"
          description="0 รายชื่อในระบบ"
          crumbs={[{ label: "ลูกค้า CRM" }]}
          actions={
            <Button size="sm" className="rounded-xl" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> เพิ่มลูกค้า
            </Button>
          }
        />
        <EmptyState
          icon={UserRound}
          title="ยังไม่มีลูกค้าในระบบ"
          description="เพิ่มลูกค้าคนแรกเพื่อเริ่มต้นใช้งาน CRM"
          action={
            <Button size="sm" className="rounded-xl" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> เพิ่มลูกค้า
            </Button>
          }
        />
        <CustomerForm open={addOpen} onOpenChange={setAddOpen} onCreate={addCustomer} />
      </div>
    );
  }

  // หลังจากนี้ customerWithCultivations จะมีค่าเสมอ (list ไม่ว่าง)
  const customer = customerWithCultivations!;

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="ลูกค้า CRM"
        description={`${customersWithCultivations.length} รายชื่อในระบบ · อัปเดตอัตโนมัติจากการขายหน้าร้าน`}
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
                  const stages = Array.from(new Set(c.cultivations.map((cul) => cul.stage))).sort(
                    (a, b) => stageOrderIndex(a) - stageOrderIndex(b),
                  );
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
                                      className={`rounded border px-1 py-0 text-[9px] font-semibold ${stageBadgeClass(s)}`}
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
                            onSelect={() => {
                              setSelected(c.id);
                              setSellOpen(true);
                            }}
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
              <Button size="sm" className="rounded-xl" onClick={() => setSellOpen(true)}>
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
              <TabsTrigger value="next">รอบถัดไป</TabsTrigger>
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
                      onClick={() => {
                        setCultEditTarget(null);
                        setCultFormOpen(true);
                      }}
                    >
                      <Plus className="size-4" /> เพิ่มแปลงเพาะปลูก
                    </Button>
                  }
                />
              ) : (
                <>
                  {/* สรุปรวมตามช่วงการปลูก */}
                  <div className="grid gap-2 sm:grid-cols-5">
                    {stageSummary.map((s) => {
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
                      const nextRoundInfo = nextRoundByCultivation.get(cul.id);
                      return (
                        <div key={cul.id} className="rounded-xl border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Sprout className="size-4 shrink-0 text-primary" />
                                <h3 className="truncate text-sm font-semibold">{cul.crop}</h3>
                                <span
                                  className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${stageBadgeClass(cul.stage)}`}
                                >
                                  {cul.stage}
                                </span>
                              </div>
                              {cul.note && (
                                <p className="mt-1 text-xs text-muted-foreground">{cul.note}</p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => {
                                  setCultEditTarget(cul);
                                  setCultFormOpen(true);
                                }}
                              >
                                <Pencil className="size-3.5" /> แก้ไข
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl text-destructive"
                                onClick={async () => {
                                  try {
                                    await cultivationsApi.remove(cul.id);
                                    qc.invalidateQueries({
                                      queryKey: ["cultivations", effectiveSelected],
                                    });
                                    qc.invalidateQueries({ queryKey: ["cultivations", "all"] });
                                    qc.invalidateQueries({ queryKey: ["customers"] });
                                    toast.success(`ลบแปลง ${cul.crop} แล้ว`);
                                  } catch (e) {
                                    toast.error("ลบแปลงไม่สำเร็จ", {
                                      description: (e as Error).message,
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
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

                          {/* ความคืบหน้ารอบการดูแล + รอบถัดไปจากโปรแกรมลำไย */}
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

                            {nextRoundInfo ? (
                              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                <Clock className="mt-px size-3 shrink-0" />
                                <span>
                                  รอบถัดไป{" "}
                                  <span className="font-semibold text-foreground">
                                    {nextRoundInfo.nextEmoji} {nextRoundInfo.nextStageName}
                                  </span>
                                  {typeof nextRoundInfo.daysUntilNext === "number" &&
                                    (nextRoundInfo.daysUntilNext < 0 ? (
                                      <>
                                        {" "}
                                        — เลยกำหนด{" "}
                                        <span className="font-semibold text-destructive">
                                          {Math.abs(nextRoundInfo.daysUntilNext)} วัน
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        {" "}
                                        — อีก{" "}
                                        <span className="font-semibold text-foreground">
                                          {nextRoundInfo.daysUntilNext} วัน
                                        </span>
                                      </>
                                    ))}
                                </span>
                              </p>
                            ) : prog.isBehindSchedule ? (
                              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
                                <AlertTriangle className="mt-px size-3 shrink-0" />
                                <span>
                                  ตามปฏิทินควรอยู่ระยะ{" "}
                                  <span className="font-semibold">{prog.expectedStage}</span> แล้ว —
                                  ข้อมูลอาจไม่อัปเดต ควรโทรเช็กและเสนอสินค้าระยะนี้
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
                                  จะเข้าระยะ{" "}
                                  <span className="font-semibold text-foreground">
                                    {prog.nextStage}
                                  </span>{" "}
                                  — เตรียมเสนอสินค้าล่วงหน้าได้
                                </span>
                              </p>
                            ) : (
                              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                                <TrendingUp className="mt-px size-3 shrink-0" />
                                <span>ครบรอบแล้ว — เสนอชุดเตรียมต้นหลังเก็บเกี่ยวรอบถัดไปได้</span>
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
                    onClick={() => {
                      setCultEditTarget(null);
                      setCultFormOpen(true);
                    }}
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
                  <li className="relative flex gap-3 pl-5">
                    <span className="absolute left-0 top-1.5 size-2 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">สมัครสมาชิก</p>
                      <p className="text-xs text-muted-foreground">ตั้งแต่ {customer.since}</p>
                    </div>
                  </li>
                  {customer.lastOrder && (
                    <li className="relative flex gap-3 pl-5">
                      <span className="absolute left-0 top-1.5 size-2 rounded-full bg-success" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">ซื้อครั้งล่าสุด</p>
                        <p className="text-xs text-muted-foreground">{customer.lastOrder}</p>
                      </div>
                    </li>
                  )}
                </ol>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {custOrders.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="ยังไม่มีประวัติการซื้อ"
                  description="เมื่อลูกค้ารายนี้ซื้อสินค้า รายการจะแสดงที่นี่"
                />
              ) : (
                <ul className="divide-y rounded-xl border">
                  {custOrders.map((o) => {
                    // ดึง items ของ order นี้เพื่อแสดงสินค้าที่ซื้อ
                    return (
                      <li key={o.id} className="flex items-center gap-3 p-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                          <ShoppingBag className="size-4 text-muted-foreground" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{o.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.date} · {o.items} รายการ · {o.payment}
                          </p>
                        </div>
                        <StatusBadge status={o.status} />
                        <p className="shrink-0 text-sm font-semibold tabular-nums">
                          {currency(o.total)}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
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
              <EmptyState
                icon={FileText}
                title="ยังไม่มีเอกสาร"
                description="ฟีเจอร์แนบเอกสารจะพร้อมเร็ว ๆ นี้"
              />
            </TabsContent>

            <TabsContent value="reco" className="mt-4 space-y-3">
              {!hasAnyRecommendation ? (
                <EmptyState
                  icon={Sparkles}
                  title="ยังแนะนำสินค้าไม่ได้"
                  description={`${customer.type} รายนี้ยังไม่มีข้อมูลเพียงพอสำหรับคำนวณคำแนะนำ — เพิ่มแปลง/อัปเดตระยะ แล้วลองอีกครั้ง`}
                />
              ) : (
                <>
                  {recommendations.length > 0 && (
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
                  )}

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
                              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                                <ProductImage
                                  imageUrl={it.product.imageUrl}
                                  name={it.product.name}
                                  iconClassName="size-5"
                                />
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

                  {stageRecoByCultivation.length > 0 && (
                    <div className="space-y-2">
                      <div className="rounded-xl border bg-muted/30 px-3 py-2">
                        <p className="text-sm font-semibold">คำแนะนำตามระยะจริงในฐานข้อมูล</p>
                        <p className="text-xs text-muted-foreground">
                          อ้างอิงโปรแกรมดูแลลำไย 12 ระยะ + รอบถัดไปของแต่ละแปลง
                        </p>
                      </div>
                      {stageRecoByCultivation.map(({ cultivation, nextRound, items }) => (
                        <div key={`stage-${cultivation.id}`} className="rounded-xl border">
                          <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
                            <Sprout className="size-4 shrink-0 text-primary" />
                            <span className="text-sm font-semibold">{cultivation.crop}</span>
                            <span className="text-xs text-muted-foreground">
                              {cultivation.area} ไร่ · {cultivation.stage}
                            </span>
                            {nextRound?.nextStageName && (
                              <span className="ml-auto text-xs font-medium text-primary">
                                รอบถัดไป: {nextRound.nextEmoji} {nextRound.nextStageName}
                              </span>
                            )}
                          </header>
                          {items.length === 0 ? (
                            <p className="px-3 py-2 text-xs text-muted-foreground">
                              ยังไม่มีสินค้าผูกกับระยะนี้ (ให้ตรวจสอบ stage_products ใน Supabase)
                            </p>
                          ) : (
                            <ul className="divide-y">
                              {items.map((it) => (
                                <li
                                  key={`${cultivation.id}-${it.productId}-${it.sequence}`}
                                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">{it.productName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {it.formula ?? "สูตรตามโปรแกรมระยะนี้"}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-sm font-semibold tabular-nums">
                                      {currency(it.price)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground tabular-nums">
                                      คงเหลือ {it.stock}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="next" className="mt-4 space-y-3">
              {nextRounds.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  title="ยังไม่มีข้อมูลรอบถัดไป"
                  description="แปลงเพาะปลูกของลูกค้ารายนี้ยังไม่ได้ผูกระยะการเจริญเติบโต (stage_id) — เพิ่มข้อมูลระยะในแปลงเพื่อให้ระบบคำนวณรอบถัดไปได้"
                />
              ) : (
                <>
                  <div className="flex items-center justify-between rounded-xl border bg-muted/40 p-3">
                    <div>
                      <p className="text-sm font-semibold">
                        รอบการดูแลถัดไป ({nextRounds.length} แปลง)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        คำนวณจากประวัติการดูแล + ความถี่ของแต่ละระยะ
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {nextRounds.map((nr: NextRoundInfo) => (
                      <NextRoundCard
                        key={nr.cultivationId}
                        nextRound={nr}
                        products={nextRoundProducts[nr.cultivationId] ?? []}
                        onOrder={(productIds) => {
                          if (productIds.length === 0) return;
                          sessionStorage.setItem(
                            "pos_prefill_product_ids",
                            JSON.stringify(productIds),
                          );
                          navigate({ to: "/pos" });
                          toast.success(`เลือก ${productIds.length} รายการ — ไปหน้า POS`);
                        }}
                        onCompleted={() => {
                          refetchNextRounds();
                          qc.invalidateQueries({ queryKey: ["cultivations", effectiveSelected] });
                          qc.invalidateQueries({ queryKey: ["cultivations", "all"] });
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </div>

      <CustomerForm open={addOpen} onOpenChange={setAddOpen} onCreate={addCustomer} />

      <SellSheet
        open={sellOpen}
        onOpenChange={setSellOpen}
        customer={customer}
        products={products}
        onSold={() => {
          qc.invalidateQueries({ queryKey: ["customers"] });
          qc.invalidateQueries({ queryKey: ["orders"] });
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["movements"] });
          qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
          qc.invalidateQueries({ queryKey: ["low-stock-products"] });
          qc.invalidateQueries({ queryKey: ["notifications"] });
        }}
      />

      <CultivationForm
        open={cultFormOpen}
        onOpenChange={setCultFormOpen}
        customerId={customer.id}
        editTarget={cultEditTarget}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["cultivations", effectiveSelected] });
          qc.invalidateQueries({ queryKey: ["cultivations", "all"] });
          qc.invalidateQueries({ queryKey: ["customers"] });
        }}
      />

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
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="08XXXXXXXX"
              inputMode="numeric"
              maxLength={10}
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

// ============================================================
// SellSheet — ขายสินค้าให้ลูกค้าโดยตรงจากหน้า CRM
// เลือกสินค้า + จำนวน + วิธีชำระ → สร้างคำสั่งขายผ่าน RPC atomic
// ============================================================

interface SellLine {
  product: Product;
  qty: number;
}

function SellSheet({
  open,
  onOpenChange,
  customer,
  products,
  onSold,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customer: Customer;
  products: Product[];
  onSold: () => void;
}) {
  const [lines, setLines] = useState<SellLine[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [payment, setPayment] = useState<string>("cash");
  const [submitting, setSubmitting] = useState(false);

  const paymentMethods = [
    { key: "cash", label: "เงินสด" },
    { key: "transfer", label: "โอนเงิน" },
    { key: "card", label: "บัตรเครดิต" },
    { key: "qr", label: "QR PromptPay" },
    { key: "credit30", label: "เครดิต 30 วัน" },
  ] as const;

  const paymentKeyToLabel = (key: string): string =>
    paymentMethods.find((m) => m.key === key)?.label ?? "เงินสด";

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products.filter((p) => p.stock > 0).slice(0, 20);
    const q = productSearch.toLowerCase();
    return products
      .filter(
        (p) =>
          p.stock > 0 &&
          (p.name.includes(productSearch) ||
            p.sku.toLowerCase().includes(q) ||
            (p.barcode ?? "").includes(productSearch)),
      )
      .slice(0, 20);
  }, [products, productSearch]);

  const total = lines.reduce((s, l) => s + l.product.price * l.qty, 0);

  const addLine = (p: Product) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, qty: Math.min(l.qty + 1, p.stock) } : l,
        );
      }
      return [...prev, { product: p, qty: 1 }];
    });
    setProductSearch("");
  };

  const updateQty = (productId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.product.id !== productId) return l;
        return { ...l, qty: Math.max(1, Math.min(qty, l.product.stock)) };
      }),
    );
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.product.id !== productId));
  };

  const reset = () => {
    setLines([]);
    setProductSearch("");
    setPayment("cash");
  };

  const submit = async () => {
    if (lines.length === 0) {
      toast.error("กรุณาเลือกสินค้าอย่างน้อย 1 รายการ");
      return;
    }
    // เช็กสต็อก
    for (const l of lines) {
      if (l.qty > l.product.stock) {
        toast.error(`สต็อก ${l.product.name} ไม่พอ (เหลือ ${l.product.stock})`);
        return;
      }
    }

    setSubmitting(true);
    const orderId = `o-${Date.now()}`;
    const orderCode = `CRM-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;
    const paymentLabel = paymentKeyToLabel(payment);

    try {
      const order = await ordersApi.createSaleTransaction({
        id: orderId,
        code: orderCode,
        customerId: customer.id,
        customerName: customer.name,
        total,
        status: "paid",
        channel: "Sales Rep",
        salesperson: "admin",
        payment: paymentLabel as
          "เงินสด" | "โอนเงิน" | "บัตรเครดิต" | "QR PromptPay" | "เครดิต 30 วัน",
        items: lines.map((l) => ({
          productId: l.product.id,
          productName: l.product.name,
          qty: l.qty,
          price: l.product.price,
          cost: l.product.cost,
        })),
      });

      onSold();
      toast.success(`ขายสินค้าให้ ${customer.name} สำเร็จ`, {
        description: `${order.code} · ${currency(total)}`,
      });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error("บันทึกการขายไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingBag className="size-4 text-primary" /> ขายสินค้า
          </SheetTitle>
          <SheetDescription>
            ลูกค้า: {customer.name} ({customer.code})
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {/* ค้นหาและเลือกสินค้า */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">เพิ่มสินค้า</Label>
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / SKU / บาร์โค้ด..."
              className="rounded-xl"
            />
            {filteredProducts.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-xl border">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addLine(p)}
                    className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                  >
                    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      <ProductImage imageUrl={p.imageUrl} name={p.name} iconClassName="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {currency(p.price)} · เหลือ {p.stock} {p.unit}
                      </p>
                    </div>
                    <Plus className="size-4 shrink-0 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* รายการสินค้าในตะกร้า */}
          {lines.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs font-semibold">รายการสินค้า ({lines.length})</Label>
              <div className="divide-y rounded-xl border">
                {lines.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-2 p-3">
                    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                      <ProductImage
                        imageUrl={l.product.imageUrl}
                        name={l.product.name}
                        iconClassName="size-5"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {currency(l.product.price)} × {l.qty} = {currency(l.product.price * l.qty)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="size-7 rounded-lg p-0"
                        onClick={() => updateQty(l.product.id, l.qty - 1)}
                      >
                        −
                      </Button>
                      <Input
                        type="number"
                        value={l.qty}
                        onChange={(e) => updateQty(l.product.id, Number(e.target.value))}
                        className="h-7 w-14 rounded-lg text-center text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="size-7 rounded-lg p-0"
                        onClick={() => updateQty(l.product.id, l.qty + 1)}
                      >
                        +
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 rounded-lg p-0 text-destructive"
                        onClick={() => removeLine(l.product.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              ยังไม่มีสินค้าในรายการ — ค้นหาและเลือกสินค้าด้านบน
            </div>
          )}

          {/* วิธีชำระเงิน */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">วิธีชำระเงิน</Label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPayment(m.key)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    payment === m.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* สรุปยอด + ปุ่ม */}
        <div className="border-t pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">รวมทั้งสิ้น</span>
            <span className="text-xl font-bold tabular-nums text-primary">{currency(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              ยกเลิก
            </Button>
            <Button
              className="flex-1 rounded-xl"
              onClick={submit}
              disabled={submitting || lines.length === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> กำลังบันทึก...
                </>
              ) : (
                <>
                  <ShoppingBag className="size-4" /> บันทึกการขาย
                </>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// CultivationForm — เพิ่ม/แก้ไขแปลงเพาะปลูก
// ============================================================

const DEFAULT_STAGE: CultivationStage = cultivationStages[0];

function CultivationForm({
  open,
  onOpenChange,
  customerId,
  editTarget,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerId: string;
  editTarget: Cultivation | null;
  onSaved: () => void;
}) {
  const isEdit = !!editTarget;
  const [crop, setCrop] = useState(DEFAULT_CROP);
  const [stage, setStage] = useState<CultivationStage>(DEFAULT_STAGE);
  const [area, setArea] = useState("1");
  const [location, setLocation] = useState("");
  const [plantedDate, setPlantedDate] = useState("");
  const [expectedHarvest, setExpectedHarvest] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // โหลดค่าจาก editTarget เมื่อเปิดฟอร์ม
  useEffect(() => {
    if (open) {
      if (editTarget) {
        setCrop(editTarget.crop);
        setStage(editTarget.stage);
        setArea(String(editTarget.area));
        setLocation(editTarget.location);
        setPlantedDate(editTarget.plantedDate);
        setExpectedHarvest(editTarget.expectedHarvest);
        setNote(editTarget.note ?? "");
      } else {
        setCrop(DEFAULT_CROP);
        setStage(DEFAULT_STAGE);
        setArea("1");
        setLocation("");
        setPlantedDate(new Date().toISOString().slice(0, 10));
        setExpectedHarvest("");
        setNote("");
      }
    }
  }, [open, editTarget]);

  const submit = async () => {
    if (!crop.trim()) {
      toast.error("กรุณากรอกชื่อพืช");
      return;
    }
    if (!location.trim()) {
      toast.error("กรุณากรอกที่ตั้งแปลง");
      return;
    }
    const areaNum = Number(area) || 0;
    if (areaNum <= 0) {
      toast.error("พื้นที่ต้องมากกว่า 0");
      return;
    }

    setSaving(true);
    try {
      if (isEdit && editTarget) {
        await cultivationsApi.update(editTarget.id, {
          crop: crop.trim(),
          stage,
          area: areaNum,
          location: location.trim(),
          plantedDate,
          expectedHarvest,
          note: note.trim() || undefined,
          stageId: stageIdByName[stage],
          currentSequence: 0,
        });
        toast.success(`แก้ไขแปลง ${crop.trim()} แล้ว`);
      } else {
        await cultivationsApi.create({
          id: `cul-${Date.now()}`,
          customerId,
          crop: crop.trim(),
          stage,
          area: areaNum,
          location: location.trim(),
          plantedDate,
          expectedHarvest,
          note: note.trim() || undefined,
          stageId: stageIdByName[stage],
          currentSequence: 0,
        });
        toast.success(`เพิ่มแปลง ${crop.trim()} แล้ว`);
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error("บันทึกแปลงไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sprout className="size-4 text-primary" />
            {isEdit ? "แก้ไขแปลงเพาะปลูก" : "เพิ่มแปลงเพาะปลูก"}
          </SheetTitle>
          <SheetDescription>
            {isEdit ? "แก้ไขข้อมูลแปลงและช่วงการปลูก" : "กรอกข้อมูลแปลงเพาะปลูกใหม่"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* พืช + ช่วงการปลูก */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">พืช (ลำไย) *</Label>
              <Input
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                placeholder="เช่น ลำไย อีดอ"
                list="crop-list"
                className="rounded-xl"
              />
              <datalist id="crop-list">
                {readyCropPrograms.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ระยะการเจริญเติบโต</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as CultivationStage)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cultivationStages.map((s) => (
                    <SelectItem key={s} value={s}>
                      {stageEmoji[s]} {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* พื้นที่ + ที่ตั้ง */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">พื้นที่ (ไร่) *</Label>
              <Input
                type="number"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                min="0"
                step="0.5"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ที่ตั้ง *</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="เช่น ต.หนองโสน อ.เมือง"
                className="rounded-xl"
              />
            </div>
          </div>

          {/* วันปลูก + วันเก็บเกี่ยว */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">วันปลูก</Label>
              <Input
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">วันเก็บเกี่ยว (คาดการณ์)</Label>
              <Input
                type="date"
                value={expectedHarvest}
                onChange={(e) => setExpectedHarvest(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* หมายเหตุ */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">หมายเหตุ</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ดินเค็ม ใช้ปุ๋ยอินทรีย์ มีโรคราสีชมพู..."
              className="rounded-xl"
              rows={3}
            />
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button className="rounded-xl" onClick={submit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> กำลังบันทึก...
              </>
            ) : (
              <>
                <Plus className="size-4" /> {isEdit ? "บันทึกการแก้ไข" : "เพิ่มแปลง"}
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
