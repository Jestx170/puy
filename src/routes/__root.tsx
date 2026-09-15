import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopBar } from "@/components/layout/TopBar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">ไม่พบหน้าที่ต้องการ</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          หน้านี้อาจถูกย้ายหรือไม่มีอยู่ในระบบแล้ว
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            กลับสู่แดชบอร์ด
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          โหลดหน้านี้ไม่สำเร็จ
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          เกิดข้อผิดพลาดบางอย่าง ลองใหม่อีกครั้งหรือกลับสู่หน้าแรก
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            ลองอีกครั้ง
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            กลับหน้าแรก
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ปุ๋ยไทย CRM — ระบบ ERP ร้านค้าเกษตร" },
      {
        name: "description",
        content: "ระบบบริหารร้านค้าเกษตรครบวงจร: CRM, POS, สินค้า, คลัง, การขาย และโปรโมชัน",
      },
      { property: "og:site_name", content: "ปุ๋ยไทย CRM" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/Logo.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/Logo.png" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

// คอมโพเนนต์ที่ตรวจสถานะ login ฝั่งไคลเอนต์ และ redirect ถ้ายังไม่ login
function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isLoginRoute = pathname === "/login";

  useEffect(() => {
    // รอให้อ่าน localStorage เสร็จก่อน ไม่งั้นคนที่ login แล้วจะถูกเด้งไป /login ตอน refresh
    if (!ready) return;
    if (!isAuthenticated && !isLoginRoute) {
      navigate({ to: "/login" });
    }
    if (isAuthenticated && isLoginRoute) {
      navigate({ to: "/" });
    }
  }, [ready, isAuthenticated, isLoginRoute, navigate]);

  // หน้า login ไม่ต้องมี sidebar/topbar
  if (isLoginRoute) {
    return <>{children}</>;
  }

  // ยังอ่าน localStorage ไม่เสร็จ (รวมถึงตอน SSR) หรือยังไม่ login → ยังไม่ render layout
  // ต้อง return null ทั้งฝั่ง server และ render แรกของ client เพื่อให้ hydration ตรงกัน
  if (!ready || !isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="min-w-0 flex-1 bg-background">
          <TopBar />
          <main className="min-w-0 flex-1">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          <AuthGuard>
            {/* Required: nested routes render here. */}
            <Outlet />
          </AuthGuard>
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
