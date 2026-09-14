import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  LogOut,
  Settings,
  UserRound,
  CreditCard,
  Users,
  Package,
  ArrowDownToLine,
  Gift,
  Command as CommandIcon,
} from "lucide-react";
import { toast } from "sonner";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth";
import { notificationsApi } from "@/lib/api/notifications";
import type { AppNotification } from "@/types";

const quickActions = [
  { label: "เปิดการขายใหม่ (POS)", to: "/pos", icon: CreditCard },
  { label: "เพิ่มลูกค้า", to: "/customers", icon: Users },
  { label: "เพิ่มสินค้า", to: "/products", icon: Package },
  { label: "รับสินค้าเข้าคลัง", to: "/inventory/stock-in", icon: ArrowDownToLine },
  { label: "สร้างโปรโมชัน", to: "/promotions", icon: Gift },
];

const searchTargets = [
  { label: "แดชบอร์ด", to: "/" },
  { label: "ลูกค้า CRM", to: "/customers" },
  { label: "ขายหน้าร้าน POS", to: "/pos" },
  { label: "สินค้าทั้งหมด", to: "/products" },
  { label: "คลังสินค้า", to: "/inventory" },
  { label: "รับสินค้าเข้าคลัง", to: "/inventory/stock-in" },
  { label: "ประวัติเคลื่อนไหวสต็อก", to: "/inventory/movements" },
  { label: "คำสั่งขาย", to: "/sales" },
  { label: "โปรโมชัน", to: "/promotions" },
];

export function TopBar() {
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(10),
  });
  const unread = notifications.filter((n) => n.unread).length;

  /** อัปเดต cache ของทุก query ที่ขึ้นต้นด้วย ["notifications"] (TopBar ใช้ 10, แดชบอร์ดใช้ 3) */
  const patchCache = (fn: (list: AppNotification[]) => AppNotification[]) => {
    qc.setQueriesData<AppNotification[]>({ queryKey: ["notifications"] }, (prev) =>
      prev ? fn(prev) : prev,
    );
  };

  /** กดที่การแจ้งเตือน → ทำเครื่องหมายอ่าน + นำทางไปหน้าที่เกี่ยวข้อง */
  const openNotification = (n: AppNotification) => {
    setNotifOpen(false);

    if (n.unread) {
      // optimistic update ก่อน แล้วค่อยยิง API (ไม่ต้องรอ เพื่อให้นำทางได้ทันที)
      patchCache((list) => list.map((x) => (x.id === n.id ? { ...x, unread: false } : x)));
      notificationsApi.markRead(n.id).catch((e: Error) => {
        // ถ้าพลาด ให้ย้อนสถานะกลับ
        patchCache((list) => list.map((x) => (x.id === n.id ? { ...x, unread: true } : x)));
        toast.error("อัปเดตการแจ้งเตือนไม่สำเร็จ", { description: e.message });
      });
    }

    if (n.link) {
      const [pathname, qs] = n.link.split("?");
      navigate({
        // link เก็บเป็น string ใน DB จึงต้อง cast ให้เข้ากับ type ของ router
        to: pathname as "/",
        search: qs ? Object.fromEntries(new URLSearchParams(qs)) : {},
      });
    }
  };

  const markAllRead = async () => {
    if (unread === 0) {
      toast.info("ไม่มีการแจ้งเตือนใหม่");
      return;
    }
    const before = notifications;
    patchCache((list) => list.map((x) => ({ ...x, unread: false })));
    try {
      const count = await notificationsApi.markAllRead();
      toast.success(`ทำเครื่องหมายอ่านแล้ว ${count || unread} รายการ`);
    } catch (e) {
      patchCache(() => before);
      toast.error("อัปเดตการแจ้งเตือนไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  // Keyboard shortcuts: Cmd/Ctrl+K (search), g+<key> (navigation แบบ Linear)
  // g d=แดชบอร์ด, g c=ลูกค้า, g p=POS, g r=สินค้า, g i=คลัง, g s=ขาย, g o=โปรโมชัน
  useEffect(() => {
    let pendingG = false;
    let gTimer: ReturnType<typeof setTimeout> | undefined;

    const go = (to: string) => navigate({ to });

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.tagName === "SELECT");

      // Cmd/Ctrl+K — เปิด command palette (ทำงานได้แม้กำลังพิมพ์)
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // ไม่ทำ shortcut อื่นขณะพิมพ์
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      // g + <key> — navigation สไตล์ Linear/GitHub
      if (e.key === "g") {
        pendingG = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => (pendingG = false), 700);
        return;
      }
      if (pendingG) {
        pendingG = false;
        if (gTimer) clearTimeout(gTimer);
        const map: Record<string, string> = {
          d: "/",
          c: "/customers",
          p: "/pos",
          r: "/products",
          i: "/inventory",
          s: "/sales",
          o: "/promotions",
        };
        const to = map[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          go(to);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [navigate]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-card/85 px-3 backdrop-blur-md sm:px-4">
      <SidebarTrigger className="shrink-0" />
      <Separator orientation="vertical" className="mr-1 hidden h-6 sm:block" />

      <button
        onClick={() => setOpen(true)}
        className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/60 md:max-w-sm"
      >
        <Search className="size-4 shrink-0" />
        <span className="truncate">ค้นหาลูกค้า สินค้า คำสั่งขาย...</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:flex">
          <CommandIcon className="size-2.5" />K
        </kbd>
        <kbd className="hidden shrink-0 rounded-md border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground lg:flex">
          g+key
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="hidden gap-1.5 rounded-xl sm:inline-flex">
              <Plus className="size-4" />
              <span>สร้างใหม่</span>
              <ChevronDown className="size-3.5 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuLabel>ทางลัด</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {quickActions.map((a) => (
              <DropdownMenuItem key={a.label} onSelect={() => navigate({ to: a.to })}>
                <a.icon className="size-4" />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-xl">
              <Bell className="size-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-card" />
              )}
              <span className="sr-only">การแจ้งเตือน</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 rounded-xl p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold">การแจ้งเตือน</p>
              <Badge variant="secondary" className="rounded-md">
                ใหม่ {unread}
              </Badge>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  ยังไม่มีการแจ้งเตือน
                </p>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotification(n)}
                    className="group flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${n.unread ? "bg-primary" : "bg-border"}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${n.unread ? "font-semibold" : "font-medium text-muted-foreground"}`}
                      >
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{n.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/70">{n.time}ที่แล้ว</p>
                    </div>
                    {n.link && (
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full rounded-lg"
                disabled={unread === 0}
                onClick={markAllRead}
              >
                อ่านทั้งหมด
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="พิมพ์เพื่อค้นหาโมดูล ลูกค้า หรือสินค้า..." />
        <CommandList>
          <CommandEmpty>ไม่พบผลลัพธ์</CommandEmpty>
          <CommandGroup heading="ไปยังหน้า">
            {searchTargets.map((t) => (
              <CommandItem
                key={t.to + t.label}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: t.to });
                }}
              >
                {t.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="การกระทำด่วน">
            {quickActions.map((a) => (
              <CommandItem
                key={a.label}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to: a.to });
                }}
              >
                <a.icon className="size-4" />
                {a.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <Link to="/pos" className="sr-only">
        POS
      </Link>
    </header>
  );
}
