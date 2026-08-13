import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Package,
  Warehouse,
  TrendingUp,
  Gift,
  Sprout,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  History,
  ClipboardList,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

const modules = [
  { title: "แดชบอร์ด", en: "Dashboard", url: "/", icon: LayoutDashboard, exact: true },
  { title: "ลูกค้า CRM", en: "Customer CRM", url: "/customers", icon: Users },
  { title: "ขายหน้าร้าน", en: "POS", url: "/pos", icon: CreditCard },
  { title: "สินค้า", en: "Products", url: "/products", icon: Package },
  { title: "คลังสินค้า", en: "Inventory", url: "/inventory", icon: Warehouse },
  { title: "การขาย", en: "Sales", url: "/sales", icon: TrendingUp },
  { title: "โปรโมชัน", en: "Promotion", url: "/promotions", icon: Gift },
];

const inventorySub = [
  { title: "รับเข้า", url: "/inventory/stock-in", icon: ArrowDownToLine },
  { title: "จ่ายออก", url: "/inventory/stock-out", icon: ArrowUpFromLine },
  { title: "ปรับปรุง", url: "/inventory/adjustment", icon: SlidersHorizontal },
  { title: "ประวัติเคลื่อนไหว", url: "/inventory/movements", icon: History },
  { title: "ตรวจนับสต็อก", url: "/inventory/count", icon: ClipboardList },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b px-3 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Sprout className="size-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">ปุ๋ยไทย CRM</p>
              <p className="truncate text-[11px] text-muted-foreground">Agri ERP Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1.5 py-2">
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>โมดูลหลัก</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => {
                const active = isActive(item.url, item.exact);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="gap-2.5">
                        <item.icon className="size-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>

                    {item.url === "/inventory" && active && !collapsed && (
                      <SidebarMenuSub>
                        {inventorySub.map((sub) => (
                          <SidebarMenuSubItem key={sub.url}>
                            <SidebarMenuSubButton asChild isActive={pathname === sub.url}>
                              <Link to={sub.url} className="gap-2">
                                <sub.icon className="size-3.5 shrink-0" />
                                <span className="truncate">{sub.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-3">
        {collapsed ? (
          <div className="grid size-8 place-items-center rounded-lg bg-secondary text-xs font-semibold text-secondary-foreground">
            ธ
          </div>
        ) : (
          <div className="rounded-xl bg-secondary/60 p-3">
            <p className="text-xs font-semibold text-secondary-foreground">แผนธุรกิจ · Pro</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">1 สาขา · 1 ผู้ใช้งาน</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
