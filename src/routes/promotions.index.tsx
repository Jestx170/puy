import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Download,
  Gift,
  Ticket,
  Megaphone,
  Package,
  Pencil,
  Pause,
  Play,
  Copy,
  Trash2,
  Sparkles,
  Calendar,
  Users,
  TrendingUp,
  Target,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatCard } from "@/components/common/StatCard";
import { Toolbar, FilterSelect } from "@/components/common/DataToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useCategories } from "@/hooks/useCategories";
import { promotionsApi } from "@/lib/api/promotions";
import type { Promotion, PromotionScopeType } from "@/types";
import { exportToCSV } from "@/lib/export";

export const Route = createFileRoute("/promotions/")({
  head: () => ({
    meta: [
      { title: "โปรโมชัน — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content:
          "ศูนย์จัดการโปรโมชัน ส่วนลด คูปอง แคมเปญ และชุดสินค้า พร้อมสร้างโปรโมชันใหม่ด้วย Promotion Builder",
      },
      { property: "og:title", content: "โปรโมชัน — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "จัดการโปรโมชันและแคมเปญทั้งหมด" },
      { property: "og:url", content: "/promotions" },
    ],
    links: [{ rel: "canonical", href: "/promotions" }],
  }),
  component: PromotionsPage,
});

const kindIcon: Record<Promotion["kind"], typeof Gift> = {
  ส่วนลด: Gift,
  คูปอง: Ticket,
  แคมเปญ: Megaphone,
  ชุดสินค้า: Package,
};

const kindTone: Record<Promotion["kind"], string> = {
  ส่วนลด: "bg-success/12 text-success border-success/25",
  คูปอง: "bg-info/12 text-info border-info/25",
  แคมเปญ: "bg-warning/15 text-warning border-warning/30",
  ชุดสินค้า: "bg-primary/10 text-primary border-primary/25",
};

function PromotionsPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("priority");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Promotion | null>(null);

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["promotions"],
    queryFn: () => promotionsApi.list(),
  });

  const openCreate = () => {
    setEditTarget(null);
    setBuilderOpen(true);
  };

  const openEdit = (p: Promotion) => {
    setEditTarget(p);
    setBuilderOpen(true);
  };

  const editPromotion = async (id: string, p: Partial<Promotion>) => {
    try {
      await promotionsApi.update(id, p);
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(`แก้ไขโปรโมชันแล้ว: ${p.name ?? ""}`);
    } catch (e) {
      toast.error("แก้ไขไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  const filtered = useMemo(() => {
    const out = list.filter(
      (p) =>
        (kind === "all" || p.kind === kind) &&
        (status === "all" || p.status === status) &&
        (p.name.includes(query) || p.scope.includes(query) || p.value.includes(query)),
    );
    return [...out].sort((a, b) =>
      sort === "priority"
        ? a.priority - b.priority
        : sort === "used"
          ? b.used - a.used
          : sort === "budget"
            ? b.budget - a.budget
            : a.name.localeCompare(b.name),
    );
  }, [list, query, kind, status, sort]);

  const activeCount = list.filter((p) => p.status === "active").length;
  const scheduledCount = list.filter((p) => p.status === "scheduled").length;
  const totalUsed = list.reduce((s, p) => s + p.used, 0);
  const totalBudget = list.reduce((s, p) => s + p.budget, 0);

  const toggleStatus = async (id: string) => {
    const target = list.find((p) => p.id === id);
    if (!target) return;
    const newStatus =
      target.status === "active" ? "paused" : target.status === "paused" ? "active" : target.status;
    if (newStatus === target.status) return;
    try {
      await promotionsApi.update(id, { status: newStatus });
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(
        target.status === "active"
          ? `หยุดโปรโมชันชั่วคราว: ${target.name}`
          : `เปิดใช้งานโปรโมชัน: ${target.name}`,
      );
    } catch (e) {
      toast.error("เปลี่ยนสถานะไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  const duplicate = async (p: Promotion) => {
    try {
      await promotionsApi.create({
        name: `${p.name} (สำเนา)`,
        kind: p.kind,
        value: p.value,
        scope: p.scope,
        scopeType: p.scopeType,
        start: p.start,
        end: p.end,
        budget: p.budget,
        priority: p.priority,
        status: "scheduled",
        note: p.note,
      });
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(`ทำสำเนาโปรโมชันแล้ว: ${p.name}`);
    } catch (e) {
      toast.error("ทำสำเนาไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  const remove = async (id: string) => {
    try {
      await promotionsApi.remove(id);
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("ลบโปรโมชันแล้ว");
    } catch (e) {
      toast.error("ลบไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  const addPromotion = async (p: Omit<Promotion, "id" | "used">) => {
    try {
      await promotionsApi.create(p);
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success(`สร้างโปรโมชันใหม่แล้ว: ${p.name}`);
    } catch (e) {
      toast.error("สร้างไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="โปรโมชัน"
        description={`${list.length} โปรโมชันในระบบ · ${activeCount} กำลังทำงาน · ${scheduledCount} ตั้งเวลาไว้`}
        crumbs={[{ label: "โปรโมชัน" }]}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => {
                const date = new Date().toISOString().slice(0, 10);
                exportToCSV(
                  filtered.map((p) => ({
                    ชื่อ: p.name,
                    ประเภท: p.kind,
                    มูลค่า: p.value,
                    ขอบเขต: p.scope,
                    เริ่ม: p.start,
                    สิ้นสุด: p.end,
                    สถานะ: p.status,
                    ใช้แล้ว: p.used,
                    งบประมาณ: p.budget,
                    ลำดับความสำคัญ: p.priority,
                  })),
                  `โปรโมชัน-${date}.csv`,
                );
              }}
            >
              <Download className="size-4" /> ส่งออก
            </Button>
            <Button size="sm" className="rounded-xl" onClick={openCreate}>
              <Plus className="size-4" /> สร้างโปรโมชัน
            </Button>
          </>
        }
      />

      {/* สถิติรวม */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="กำลังทำงาน"
          value={String(activeCount)}
          hint="โปรโมชันที่ใช้งานอยู่"
          icon={Play}
        />
        <StatCard
          label="ตั้งเวลาไว้"
          value={String(scheduledCount)}
          hint="รอเริ่มตามวันที่กำหนด"
          icon={Calendar}
          tone="info"
        />
        <StatCard
          label="ใช้งานทั้งหมด"
          value={String(totalUsed)}
          delta={12.4}
          hint="ครั้งที่ใช้โปรโมชัน"
          icon={TrendingUp}
        />
        <StatCard
          label="งบประมาณรวม"
          value={String(totalBudget)}
          hint="หน่วย · ครั้ง"
          icon={Target}
          tone="info"
        />
      </div>

      {/* ตัวกรอง */}
      <div className="card-soft overflow-hidden">
        <div className="border-b p-3">
          <Toolbar
            query={query}
            onQuery={setQuery}
            placeholder="ค้นหาชื่อโปรโมชัน ขอบเขต หรือมูลค่า"
            filters={
              <>
                <FilterSelect
                  value={kind}
                  onChange={setKind}
                  label="ประเภท"
                  className="w-[150px]"
                  options={[
                    { value: "all", label: "ทุกประเภท" },
                    { value: "ส่วนลด", label: "ส่วนลด" },
                    { value: "คูปอง", label: "คูปอง" },
                    { value: "แคมเปญ", label: "แคมเปญ" },
                    { value: "ชุดสินค้า", label: "ชุดสินค้า" },
                  ]}
                />
                <FilterSelect
                  value={status}
                  onChange={setStatus}
                  label="สถานะ"
                  className="w-[150px]"
                  options={[
                    { value: "all", label: "ทุกสถานะ" },
                    { value: "active", label: "กำลังทำงาน" },
                    { value: "scheduled", label: "ตั้งเวลา" },
                    { value: "paused", label: "หยุดชั่วคราว" },
                    { value: "ended", label: "สิ้นสุด" },
                  ]}
                />
                <FilterSelect
                  value={sort}
                  onChange={setSort}
                  label="เรียงตาม"
                  icon={false}
                  className="w-[150px]"
                  options={[
                    { value: "priority", label: "ลำดับความสำคัญ" },
                    { value: "used", label: "ใช้มาก → น้อย" },
                    { value: "budget", label: "งบมาก → น้อย" },
                    { value: "name", label: "ชื่อ ก-ฮ" },
                  ]}
                />
              </>
            }
          />
        </div>

        {/* รายการโปรโมชัน */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="ไม่พบโปรโมชัน"
            description="ลองปรับตัวกรองหรือสร้างโปรโมชันใหม่"
            action={
              <Button size="sm" className="rounded-xl" onClick={() => setBuilderOpen(true)}>
                <Plus className="size-4" /> สร้างโปรโมชัน
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => {
              const Icon = kindIcon[p.kind];
              const usagePct = Math.min(100, Math.round((p.used / Math.max(p.budget, 1)) * 100));
              return (
                <div
                  key={p.id}
                  className="flex flex-col rounded-xl border bg-card p-4 transition-all duration-150 hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-xl border ${kindTone[p.kind]}`}
                      >
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.scope}</p>
                      </div>
                    </div>
                    <StatusBadge status={p.status} className="shrink-0" />
                  </div>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-primary tabular-nums">{p.value}</span>
                    <Badge variant="secondary" className="rounded-md text-[10px]">
                      {p.kind}
                    </Badge>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      ลำดับ #{p.priority}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="size-3.5" />
                      <span className="tabular-nums">
                        {p.start} → {p.end}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="size-3.5" />
                      <span>
                        ใช้แล้ว {p.used} / {p.budget} ครั้ง
                      </span>
                    </div>
                    <Progress value={usagePct} className="h-1.5" />
                  </div>

                  <div className="mt-3 flex items-center gap-1 border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="size-3.5" /> แก้ไข
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => toggleStatus(p.id)}
                      disabled={p.status === "ended" || p.status === "scheduled"}
                    >
                      {p.status === "active" ? (
                        <>
                          <Pause className="size-3.5" /> หยุด
                        </>
                      ) : (
                        <>
                          <Play className="size-3.5" /> เปิด
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => duplicate(p)}
                    >
                      <Copy className="size-3.5" /> สำเนา
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto rounded-lg text-xs text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>ยืนยันการลบโปรโมชัน?</AlertDialogTitle>
                          <AlertDialogDescription>
                            การลบ “{p.name}” จะไม่สามารถย้อนกลับได้ ประวัติการใช้งานเดิมจะยังคงอยู่
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
                          <AlertDialogAction className="rounded-xl" onClick={() => remove(p.id)}>
                            ลบโปรโมชัน
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Promotion Builder (Sheet ฝั่งขวา) */}
      <PromotionBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        onCreate={addPromotion}
        onEdit={editPromotion}
        editTarget={editTarget}
      />
    </div>
  );
}

/* --------------------------- Promotion Builder ------------------------------ */

function PromotionBuilder({
  open,
  onOpenChange,
  onCreate,
  onEdit,
  editTarget,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (p: Omit<Promotion, "id" | "used">) => void;
  onEdit: (id: string, p: Partial<Promotion>) => void;
  editTarget: Promotion | null;
}) {
  const { categories } = useCategories();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Promotion["kind"]>("ส่วนลด");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState("");
  const [scopeType, setScopeType] = useState<PromotionScopeType>("category");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [budget, setBudget] = useState("500");
  const [priority, setPriority] = useState("3");
  const [note, setNote] = useState("");

  // โหลดค่าจาก editTarget เมื่อเปิดฟอร์มแก้ไข
  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setName(editTarget.name);
      setKind(editTarget.kind);
      setValue(editTarget.value);
      setScope(editTarget.scope);
      setScopeType(editTarget.scopeType ?? "category");
      setStart(editTarget.start);
      setEnd(editTarget.end);
      setBudget(String(editTarget.budget));
      setPriority(String(editTarget.priority));
      setNote(editTarget.note ?? "");
    } else {
      reset();
    }
  }, [open, editTarget]);

  const reset = () => {
    setName("");
    setKind("ส่วนลด");
    setValue("");
    setScope("");
    setScopeType("category");
    setStart("");
    setEnd("");
    setBudget("500");
    setPriority("3");
    setNote("");
  };

  const submit = () => {
    if (!name.trim() || !value.trim() || !start || !end) {
      toast.error("กรุณากรอกข้อมูลให้ครบ", { description: "ชื่อ มูลค่า และช่วงวันที่จำเป็น" });
      return;
    }
    const scopeText =
      scopeType === "category"
        ? scope || categories[0]!
        : scopeType === "all"
          ? "ทั้งหมด"
          : scope || "ระบุภายหลัง";
    const payload = {
      name: name.trim(),
      kind,
      value: value.trim(),
      scope: scopeText,
      scopeType,
      start,
      end,
      budget: Number(budget) || 100,
      priority: Number(priority) || 5,
      note: note.trim() || undefined,
    };
    if (editTarget) {
      onEdit(editTarget.id, payload);
    } else {
      onCreate({
        ...payload,
        status: new Date(start) > new Date() ? "scheduled" : "active",
      });
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            {editTarget ? "แก้ไขโปรโมชัน" : "Promotion Builder"}
          </SheetTitle>
          <SheetDescription>
            {editTarget
              ? "แก้ไขเงื่อนไข ขอบเขต และช่วงเวลาของโปรโมชัน"
              : "สร้างโปรโมชันใหม่ กำหนดเงื่อนไข ขอบเขต และช่วงเวลา"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* ชื่อ */}
          <div className="space-y-1.5">
            <Label htmlFor="promo-name" className="text-xs font-semibold">
              ชื่อโปรโมชัน *
            </Label>
            <Input
              id="promo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ลดปุ๋ยอินทรีย์ต้อนรับฤดูฝน"
              className="rounded-xl"
            />
          </div>

          {/* ประเภท + มูลค่า */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">ประเภท *</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Promotion["kind"])}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="ส่วนลด">ส่วนลด</SelectItem>
                  <SelectItem value="คูปอง">คูปอง</SelectItem>
                  <SelectItem value="แคมเปญ">แคมเปญ</SelectItem>
                  <SelectItem value="ชุดสินค้า">ชุดสินค้า</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-value" className="text-xs font-semibold">
                มูลค่า *
              </Label>
              <Input
                id="promo-value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  kind === "ส่วนลด"
                    ? "-15%"
                    : kind === "คูปอง"
                      ? "฿200"
                      : kind === "แคมเปญ"
                        ? "10+1"
                        : "฿1,290"
                }
                className="rounded-xl"
              />
            </div>
          </div>

          {/* ขอบเขต */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">ขอบเขต</Label>
            <Select value={scopeType} onValueChange={(v) => setScopeType(v as typeof scopeType)}>
              <SelectTrigger className="h-9 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="category">ตามหมวดหมู่</SelectItem>
                <SelectItem value="product">ตามสินค้า</SelectItem>
                <SelectItem value="customer">ตามกลุ่มลูกค้า</SelectItem>
                <SelectItem value="all">ทั้งหมด</SelectItem>
              </SelectContent>
            </Select>
            {scopeType === "category" ? (
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue placeholder="เลือกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : scopeType !== "all" ? (
              <Input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder={
                  scopeType === "product"
                    ? "เช่น FRT-4600 หรือชื่อสินค้า"
                    : "เช่น สมาชิก Platinum หรือลูกค้าใหม่"
                }
                className="rounded-xl"
              />
            ) : null}
          </div>

          {/* ช่วงวันที่ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-start" className="text-xs font-semibold">
                วันเริ่ม *
              </Label>
              <Input
                id="promo-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end" className="text-xs font-semibold">
                วันสิ้นสุด *
              </Label>
              <Input
                id="promo-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          {/* งบ + ลำดับ */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="promo-budget" className="text-xs font-semibold">
                งบประมาณ (ครั้ง)
              </Label>
              <Input
                id="promo-budget"
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-priority" className="text-xs font-semibold">
                ลำดับความสำคัญ
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? "(สูงสุด)" : n === 5 ? "(ต่ำสุด)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* หมายเหตุ */}
          <div className="space-y-1.5">
            <Label htmlFor="promo-note" className="text-xs font-semibold">
              หมายเหตุ (ไม่บังคับ)
            </Label>
            <Textarea
              id="promo-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น ใช้ได้เฉพาะสมาชิก ไม่รวมสินค้าลดราคาแล้ว"
              className="min-h-16 rounded-xl text-sm"
            />
          </div>

          {/* พรีวิว */}
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">พรีวิว</p>
            <div className="mt-2 flex items-center gap-2.5">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-lg border ${kindTone[kind]}`}
              >
                {(() => {
                  const Icon = kindIcon[kind];
                  return <Icon className="size-4" />;
                })()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name || "ชื่อโปรโมชัน"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {value || "มูลค่า"} · {scope || (scopeType === "all" ? "ทั้งหมด" : "ขอบเขต")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button className="rounded-xl" onClick={submit}>
            {editTarget ? (
              <>
                <Pencil className="size-4" /> บันทึกการแก้ไข
              </>
            ) : (
              <>
                <Plus className="size-4" /> สร้างโปรโมชัน
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
