import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Store, Save, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { settingsApi } from "@/lib/api/settings";
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
    </div>
  );
}
