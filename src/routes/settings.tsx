import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, Save, Loader2, Printer, Plus, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { settingsApi } from "@/lib/api/settings";
import { categoriesApi } from "@/lib/api/categories";
import { printReceipt } from "@/lib/print";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "ตั้งค่าร้าน — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content:
          "ตั้งค่าข้อมูลร้าน ชื่อร้าน ที่อยู่ เบอร์โทร เลขผู้เสียภาษี สำหรับใช้ในใบเสร็จและใบเสนอราคา",
      },
      { property: "og:title", content: "ตั้งค่าร้าน — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "ตั้งค่าข้อมูลร้านสำหรับพิมพ์เอกสาร" },
      { property: "og:url", content: "/settings" },
    ],
    links: [{ rel: "canonical", href: "/settings" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: storeSettings, isLoading } = useQuery({
    queryKey: ["store-settings"],
    queryFn: () => settingsApi.get(),
  });

  const [form, setForm] = useState<StoreSettings>(DEFAULT_STORE_SETTINGS);
  const [saving, setSaving] = useState(false);

  // โหลดค่าจาก Supabase เมื่อข้อมูลมาถึง
  useEffect(() => {
    if (storeSettings) setForm(storeSettings);
  }, [storeSettings]);

  const handleSave = async () => {
    if (!form.storeName.trim()) {
      toast.error("กรุณากรอกชื่อร้าน");
      return;
    }
    setSaving(true);
    try {
      const updated = await settingsApi.update({
        storeName: form.storeName.trim(),
        storeAddress: form.storeAddress?.trim() || null,
        storePhone: form.storePhone?.trim() || null,
        taxId: form.taxId?.trim() || null,
        footerText: form.footerText?.trim() || null,
      });
      setForm(updated);
      qc.invalidateQueries({ queryKey: ["store-settings"] });
      toast.success("บันทึกการตั้งค่าร้านแล้ว");
    } catch (e) {
      toast.error("บันทึกไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    printReceipt({
      storeName: form.storeName,
      storeAddress: form.storeAddress ?? undefined,
      storePhone: form.storePhone ?? undefined,
      taxId: form.taxId ?? undefined,
      docTitle: "ตัวอย่างใบเสร็จ",
      receiptNo: `PREVIEW-${Date.now()}`,
      date: new Date().toLocaleString("th-TH"),
      customer: "ลูกค้าตัวอย่าง",
      salesperson: "พนักงานทดสอบ",
      channel: "POS",
      lines: [
        { name: "สาหร่าย/อะมิโน (ตัวอย่าง)", qty: 2, unit: "ขวด", price: 350 },
        { name: "ปุ๋ยเกร็ด 30-10-10 (ตัวอย่าง)", qty: 1, unit: "ถุง", price: 800 },
      ],
      subtotal: 1500,
      total: 1500,
      payment: "เงินสด",
      footerText: form.footerText ?? undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="ตั้งค่าร้าน"
        description="ข้อมูลร้านสำหรับพิมพ์ใบเสร็จและใบเสนอราคา"
        crumbs={[{ label: "ตั้งค่าร้าน" }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handlePreview}>
              <Printer className="size-4" /> พรีวิวใบเสร็จ
            </Button>
            <Button size="sm" className="rounded-xl" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              บันทึก
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="size-4 text-primary" />
              ข้อมูลร้าน
            </CardTitle>
            <CardDescription>ค่าเหล่านี้จะแสดงบนหัวใบเสร็จ/ใบเสนอราคาทุกฉบับ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="storeName" className="text-xs font-semibold">
                ชื่อร้าน <span className="text-destructive">*</span>
              </Label>
              <Input
                id="storeName"
                value={form.storeName}
                onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))}
                placeholder="เช่น ปุ๋ยไทย CRM"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="storeAddress" className="text-xs font-semibold">
                ที่อยู่ร้าน
              </Label>
              <Textarea
                id="storeAddress"
                value={form.storeAddress ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, storeAddress: e.target.value }))}
                placeholder="เช่น 123 ถนนเกษตร ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000"
                className="rounded-xl min-h-[72px]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="storePhone" className="text-xs font-semibold">
                  เบอร์โทรร้าน
                </Label>
                <Input
                  id="storePhone"
                  value={form.storePhone ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, storePhone: e.target.value }))}
                  placeholder="เช่น 043-123-456"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="taxId" className="text-xs font-semibold">
                  เลขประจำตัวผู้เสียภาษี (Tax ID)
                </Label>
                <Input
                  id="taxId"
                  value={form.taxId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                  placeholder="เช่น 1234567890123"
                  className="rounded-xl tabular-nums"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="footerText" className="text-xs font-semibold">
                ข้อความปิดท้ายใบเสร็จ
              </Label>
              <Textarea
                id="footerText"
                value={form.footerText ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, footerText: e.target.value }))}
                placeholder="ว่าง = ใช้ข้อความ default (ขอบคุณที่อุดหนุน...)"
                className="rounded-xl min-h-[60px]"
              />
              <p className="text-[11px] text-muted-foreground">
                ใช้ \n สำหรับขึ้นบรรทัดใหม่ (เช่น "ราคานี้ยืนยัน 7 วัน\nกรุณาติดต่อเจ้าหน้าที่")
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">ตัวอย่างหัวใบเสร็จ</CardTitle>
            <CardDescription>พรีวิวก่อนบันทึก</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border bg-muted/30 p-4 text-center">
              <p className="text-base font-bold">{form.storeName || "—"}</p>
              {form.storeAddress && (
                <p className="mt-1 text-xs text-muted-foreground whitespace-pre-line">
                  {form.storeAddress}
                </p>
              )}
              {form.storePhone && (
                <p className="mt-1 text-xs text-muted-foreground">โทร. {form.storePhone}</p>
              )}
              {form.taxId && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  เลขประจำตัวผู้เสียภาษี: {form.taxId}
                </p>
              )}
              <Separator className="my-3" />
              <p className="text-xs font-semibold tracking-wide">ใบเสร็จ</p>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              กดปุ่ม "พรีวิวใบเสร็จ" ด้านบนเพื่อดูตัวอย่างเต็มรูปแบบก่อนพิมพ์จริง
            </p>
          </CardContent>
        </Card>
      </div>

      <CategoryManager />
    </div>
  );
}

// ============================================================
// CategoryManager — จัดการหมวดหมู่สินค้า (เพิ่ม/ลบ)
// ============================================================
function CategoryManager() {
  const qc = useQueryClient();
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => categoriesApi.list(),
    retry: false,
  });

  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error("กรุณากรอกชื่อหมวดหมู่");
      return;
    }
    if (categories.includes(trimmed)) {
      toast.error("หมวดหมู่นี้มีอยู่แล้ว");
      return;
    }
    setAdding(true);
    try {
      await categoriesApi.create(trimmed);
      qc.invalidateQueries({ queryKey: ["categories"] });
      setNewName("");
      toast.success(`เพิ่มหมวดหมู่แล้ว: ${trimmed}`);
    } catch (e) {
      toast.error("เพิ่มหมวดหมู่ไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await categoriesApi.remove(deleteTarget);
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success(`ลบหมวดหมู่แล้ว: ${deleteTarget}`);
      setDeleteTarget(null);
    } catch (e) {
      toast.error("ลบหมวดหมู่ไม่สำเร็จ", { description: (e as Error).message });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Tags className="size-4 text-primary" />
          หมวดหมู่สินค้า
        </CardTitle>
        <CardDescription>
          เพิ่มหรือลบหมวดหมู่ — ใช้ในฟอร์มสินค้า, POS, คลังสินค้า และโปรโมชัน
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* เพิ่มหมวดหมู่ใหม่ */}
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="ชื่อหมวดหมู่ใหม่"
            className="rounded-xl"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button
            size="sm"
            className="rounded-xl shrink-0"
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
          >
            {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            เพิ่ม
          </Button>
        </div>

        <Separator />

        {/* รายการหมวดหมู่ */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ยังไม่มีหมวดหมู่ — เพิ่มได้จากช่องด้านบน
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <div
                key={c}
                className="flex items-center gap-1.5 rounded-xl border bg-muted/30 px-3 py-1.5"
              >
                <span className="text-sm">{c}</span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(c)}
                  aria-label={`ลบ ${c}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* ยืนยันการลบ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบหมวดหมู่ "{deleteTarget}"?</AlertDialogTitle>
            <AlertDialogDescription>
              สินค้าที่ใช้หมวดหมู่นี้อยู่จะยังคงชื่อหมวดหมู่เดิมไว้ แต่จะไม่แสดงในตัวเลือก dropdown
              อีก
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : null}
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
