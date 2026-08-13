import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sprout, Lock, UserRound, Eye, EyeOff, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "เข้าสู่ระบบ — ปุ๋ยไทย CRM" },
      { name: "description", content: "เข้าสู่ระบบ ERP ร้านค้าเกษตร ปุ๋ยไทย CRM" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // การ redirect เมื่อ login แล้ว จัดการโดย AuthGuard ใน __root.tsx
  // (ห้ามเรียก navigate() ระหว่าง render — เป็น side effect ที่ทำให้ render ไม่ pure)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // จำลอง delay เล็กน้อยให้รู้สึกเหมือนจริง
    setTimeout(() => {
      const res = login(user, password);
      setLoading(false);
      if (res.ok) {
        toast.success("เข้าสู่ระบบสำเร็จ", { description: "ยินดีต้อนรับสู่ ปุ๋ยไทย CRM" });
        navigate({ to: "/" });
      } else {
        toast.error("เข้าสู่ระบบไม่สำเร็จ", { description: res.error });
      }
    }, 350);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ซ้าย: แบรนด์/ภาพ (ซ่อนบนมือถือ) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="absolute inset-0 opacity-10" aria-hidden>
          <div className="absolute -left-10 top-10 size-72 rounded-full bg-white blur-3xl" />
          <div className="absolute bottom-10 right-0 size-96 rounded-full bg-white blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-primary-foreground/15 backdrop-blur">
            <Sprout className="size-6" />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">ปุ๋ยไทย CRM</p>
            <p className="text-xs text-primary-foreground/70">Agri ERP Platform</p>
          </div>
        </div>

        <div className="relative space-y-5">
          <h1 className="text-3xl font-bold leading-tight">
            ระบบบริหารร้านค้าเกษตร
            <br />
            ครบวงจรในที่เดียว
          </h1>
          <p className="max-w-md text-sm text-primary-foreground/80">
            จัดการลูกค้า การเพาะปลูก ขายหน้าร้าน สินค้า คลังสินค้า และการขาย
            พร้อมข้อมูลเรียลไทม์เพื่อช่วยให้ธุรกิจเติบโต
          </p>

          <ul className="space-y-2 text-sm text-primary-foreground/90">
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary-foreground" /> CRM +
              ติดตามการเพาะปลูกลูกค้า
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary-foreground" /> POS
              ปิดการขายไวในไม่กี่คลิก
            </li>
            <li className="flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary-foreground" /> บริหารสต็อกสินค้า
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          © 2026 ปุ๋ยไทย CRM · สงวนลิขสิทธิ์
        </p>
      </aside>

      {/* ขวา: ฟอร์ม login */}
      <main className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-sm">
          {/* โลโก้บนมือถือ */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Sprout className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">ปุ๋ยไทย CRM</p>
              <p className="text-[11px] text-muted-foreground">Agri ERP Platform</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight">เข้าสู่ระบบ</h2>
            <p className="text-sm text-muted-foreground">
              กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งานระบบ
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="user" className="text-xs font-semibold">
                ชื่อผู้ใช้
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="user"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  autoFocus
                  required
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">
                  รหัสผ่าน
                </Label>
                <button
                  type="button"
                  onClick={() => toast("ติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่าน")}
                  className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="h-11 rounded-xl pl-9 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPwd ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              className="mt-2 h-11 w-full rounded-xl text-sm font-semibold"
              disabled={loading || !user || !password}
            >
              {loading ? (
                "กำลังเข้าสู่ระบบ..."
              ) : (
                <>
                  เข้าสู่ระบบ <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* คำใบ้สำหรับ demo */}
          <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">ข้อมูลเข้าระบบ (สำหรับทดลอง)</p>
            <p className="mt-1">
              ผู้ใช้: <code className="rounded bg-background px-1.5 py-0.5 font-mono">admin</code>
              {" · "}
              รหัสผ่าน:{" "}
              <code className="rounded bg-background px-1.5 py-0.5 font-mono">admin123</code>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
