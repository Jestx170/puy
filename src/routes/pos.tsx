import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Barcode,
  Minus,
  Plus,
  Search,
  Trash2,
  UserRound,
  Banknote,
  QrCode,
  Building2,
  Printer,
  Percent,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
import { EmptyState } from "@/components/common/EmptyState";
import { ProductImage } from "@/components/common/ProductImage";
import { printReceipt } from "@/lib/print";
import { productCategories as categories } from "@/lib/constants";
import { currency } from "@/lib/format";
import type { Customer, Product } from "@/types";
import { productsApi } from "@/lib/api/products";
import { customersApi } from "@/lib/api/customers";
import { ordersApi, type OrderLineInput } from "@/lib/api/orders";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/pos")({
  head: () => ({
    meta: [
      { title: "ขายหน้าร้าน POS — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content:
          "หน้าจอขายหน้าร้านแบบหน้าเดียว ค้นหาบาร์โค้ด ตะกร้าสินค้า ส่วนลด และรับชำระเงินหลายช่องทาง",
      },
      { property: "og:title", content: "ขายหน้าร้าน POS — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "ปิดการขายได้ในไม่กี่คลิก" },
      { property: "og:url", content: "/pos" },
    ],
    links: [{ rel: "canonical", href: "/pos" }],
  }),
  component: PosPage,
});

interface CartLine {
  product: Product;
  qty: number;
}

// เก็บค่า key ของวิธีชำระ (UI) แยกจาก label ภาษาไทย (DB)
const paymentMethods = [
  { key: "cash", label: "เงินสด", icon: Banknote },
  { key: "qr", label: "QR PromptPay", icon: QrCode },
  { key: "transfer", label: "โอนเงิน", icon: Building2 },
] as const;

// แปลง key ของวิธีชำระเป็น label ที่ใช้ใน DB (check constraint)
const paymentKeyToLabel = (key: string): string =>
  paymentMethods.find((m) => m.key === key)?.label ?? "เงินสด";

function PosPage() {
  const { user } = useAuth();
  const salesperson = user ?? "admin";
  const qc = useQueryClient();

  // ดึงสินค้า/ลูกค้าจาก Supabase
  const { data: productList = [] } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });
  const { data: customerList = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: () => customersApi.list(),
  });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<string>(customerList[0]?.id ?? "");
  const [discount, setDiscount] = useState(0);
  const [method, setMethod] = useState<string>("cash");
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const visible = useMemo(
    () =>
      productList.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          (p.name.includes(query) ||
            p.sku.toLowerCase().includes(query.toLowerCase()) ||
            p.barcode.includes(query)),
      ),
    [query, category, productList],
  );

  const add = (p: Product) =>
    setCart((c) => {
      const hit = c.find((l) => l.product.id === p.id);
      // กัน over-sell: ถ้ามีอยู่แล้วและ qty + 1 เกินสต็อก ไม่เพิ่ม
      if (hit && hit.qty + 1 > p.stock) {
        toast.error(`สต็อก ${p.name} เหลือเพียง ${p.stock} ${p.unit}`, {
          description: "ไม่สามารถเพิ่มเกินจำนวนสต็อกได้",
        });
        return c;
      }
      if (p.stock === 0) {
        toast.error(`${p.name} สินค้าหมดสต็อก`);
        return c;
      }
      return hit
        ? c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...c, { product: p, qty: 1 }];
    });

  const setQty = (id: string, delta: number) =>
    setCart((c) =>
      c
        .map((l) => {
          if (l.product.id !== id) return l;
          const next = l.qty + delta;
          // กัน over-sell เมื่อเพิ่มจำนวน
          if (delta > 0 && next > l.product.stock) {
            toast.error(`สต็อก ${l.product.name} เหลือเพียง ${l.product.stock} ${l.product.unit}`);
            return l;
          }
          return { ...l, qty: next };
        })
        .filter((l) => l.qty > 0),
    );

  const subtotal = cart.reduce((s, l) => s + l.product.price * l.qty, 0);
  const discountAmt = Math.round((subtotal * discount) / 100);
  const total = subtotal - discountAmt;

  const printCart = () => {
    if (cart.length === 0) {
      toast.error("ตะกร้าว่าง ไม่สามารถพิมพ์ใบเสร็จได้");
      return;
    }
    const cust = customerList.find((c) => c.id === customerId);
    const methodLabel = paymentKeyToLabel(method);
    printReceipt({
      storeName: "ปุ๋ยไทย CRM",
      storeAddress: "123 ถนนเกษตร ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000",
      storePhone: "043-123-456",
      receiptNo: `POS-${Date.now()}`,
      date: new Date().toLocaleString("th-TH"),
      customer: cust?.name,
      channel: "POS",
      lines: cart.map((l) => ({
        name: l.product.name,
        qty: l.qty,
        unit: l.product.unit,
        price: l.product.price,
      })),
      subtotal,
      discountPct: discount,
      discountAmt: discountAmt,
      total,
      payment: methodLabel,
    });
  };

  // checkout จริง: บันทึกทุกอย่างใน transaction เดียวผ่าน RPC create_sale_transaction
  // - สร้าง order + order_items
  // - ลด stock + สร้าง stock_movements (พร้อม audit trail)
  // - อัปเดตยอดสะสมลูกค้า
  // - บันทึก activity
  // มี idempotency protection — ถ้าส่ง order_id ซ้ำจะคืน order เดิม (กัน double-submit)
  const checkout = async () => {
    if (cart.length === 0) {
      toast.error("ตะกร้าว่าง กรุณาเลือกสินค้า");
      return;
    }
    const cust = customerList.find((c) => c.id === customerId);
    if (!cust) {
      toast.error("กรุณาเลือกลูกค้า");
      return;
    }
    // เช็กสต็อกอีกครั้งก่อน submit (กันกรณีสต็อกเปลี่ยนระหว่างนั้น)
    for (const l of cart) {
      if (l.qty > l.product.stock) {
        toast.error(`สต็อก ${l.product.name} ไม่พอ (เหลือ ${l.product.stock})`);
        return;
      }
    }

    setSubmitting(true);
    const methodLabel = paymentKeyToLabel(method);
    const orderId = `o-${Date.now()}`;
    const orderCode = `POS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-5)}`;
    const lines: OrderLineInput[] = cart.map((l) => ({
      productId: l.product.id,
      productName: l.product.name,
      qty: l.qty,
      price: l.product.price,
      cost: l.product.cost,
    }));

    try {
      // เรียก RPC เดียว — ทุกอย่าง atomic (all or nothing)
      const order = await ordersApi.createSaleTransaction({
        id: orderId,
        code: orderCode,
        customerId: cust.id,
        customerName: cust.name,
        total,
        status: "paid",
        channel: "POS",
        salesperson,
        payment: methodLabel as "เงินสด" | "โอนเงิน" | "QR PromptPay" | "เครดิต 30 วัน",
        items: lines,
      });

      // invalidate queries ให้ข้อมูลสดทั่วแอป
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["movements"] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["low-stock-products"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });

      // พิมพ์ใบเสร็จ
      printCart();

      toast.success(`รับชำระ ${currency(total)} สำเร็จ`, {
        description: `${order.code} · ${cust.name}`,
      });
      setCart([]);
      setDiscount(0);
    } catch (e) {
      toast.error("บันทึกการขายไม่สำเร็จ", {
        description: (e as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 gap-3 overflow-y-auto p-3 lg:grid-cols-[260px_minmax(0,1fr)_340px] lg:overflow-hidden">
      {/* Left: customer + search + categories */}
      <aside className="card-soft flex min-h-0 flex-col overflow-hidden">
        <div className="space-y-3 border-b p-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">ลูกค้า</p>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-9 w-full rounded-xl">
                <UserRound className="size-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {customerList.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              ค้นหา / สแกนบาร์โค้ด
            </p>
            <div className="relative">
              <Barcode className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ชื่อ / SKU / บาร์โค้ด"
                className="h-9 rounded-xl pl-9"
              />
            </div>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">หมวดหมู่</p>
            {[
              { label: "ทั้งหมด", value: "all" },
              ...categories.map((c) => ({ label: c, value: c })),
            ].map((c) => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  category === c.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <span className="truncate">{c.label}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Center: product grid */}
      <section className="card-soft flex min-h-0 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">เลือกสินค้า</h2>
          <Badge variant="secondary" className="rounded-md">
            {visible.length} รายการ
          </Badge>
        </header>
        <ScrollArea className="flex-1">
          {visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="ไม่พบสินค้า"
              description="ลองค้นหาด้วยชื่อ SKU หรือบาร์โค้ดอื่น"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 xl:grid-cols-4">
              {visible.map((p) => (
                <button
                  key={p.id}
                  onClick={() => add(p)}
                  disabled={p.stock === 0}
                  className="group flex flex-col rounded-xl border bg-card p-3 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-soft)] disabled:opacity-40"
                >
                  <span className="mb-2 grid h-14 place-items-center overflow-hidden rounded-lg bg-muted">
                    <ProductImage imageUrl={p.imageUrl} name={p.name} iconClassName="size-7" />
                  </span>
                  <p className="line-clamp-2 min-h-9 text-xs font-medium">{p.name}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">คงเหลือ {p.stock}</p>
                  <p className="mt-1 text-sm font-bold text-primary tabular-nums">
                    {currency(p.price)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </section>

      {/* Right: cart + payment (desktop) */}
      <aside className="card-soft hidden min-h-0 flex-col overflow-hidden lg:flex">
        <CartPanel
          cart={cart}
          discount={discount}
          method={method}
          subtotal={subtotal}
          discountAmt={discountAmt}
          total={total}
          submitting={submitting}
          onClear={() => setCart([])}
          onQty={setQty}
          onDiscount={setDiscount}
          onMethod={setMethod}
          onCheckout={checkout}
          onPrint={printCart}
        />
      </aside>

      {/* Floating cart bar + Sheet (mobile) */}
      {cart.length > 0 && (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <button className="fixed inset-x-3 bottom-3 z-40 flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg lg:hidden">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-foreground/20 text-xs font-bold">
                {cart.reduce((s, l) => s + l.qty, 0)}
              </span>
              <span className="text-sm font-semibold">ตะกร้า · {currency(total)}</span>
              <ShoppingCart className="ml-auto size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl p-0">
            <CartPanel
              cart={cart}
              discount={discount}
              method={method}
              subtotal={subtotal}
              discountAmt={discountAmt}
              total={total}
              submitting={submitting}
              onClear={() => setCart([])}
              onQty={setQty}
              onDiscount={setDiscount}
              onMethod={setMethod}
              onCheckout={() => {
                checkout();
                setCartOpen(false);
              }}
              onPrint={printCart}
              compact
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/* ----------------------------- Cart Panel ------------------------------- */

function CartPanel({
  cart,
  discount,
  method,
  subtotal,
  discountAmt,
  total,
  submitting,
  onClear,
  onQty,
  onDiscount,
  onMethod,
  onCheckout,
  onPrint,
  compact = false,
}: {
  cart: CartLine[];
  discount: number;
  method: string;
  subtotal: number;
  discountAmt: number;
  total: number;
  submitting: boolean;
  onClear: () => void;
  onQty: (id: string, delta: number) => void;
  onDiscount: (v: number) => void;
  onMethod: (m: string) => void;
  onCheckout: () => void;
  onPrint: () => void;
  compact?: boolean;
}) {
  return (
    <>
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">ตะกร้าสินค้า</h2>
        {cart.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-lg text-xs text-destructive">
                <Trash2 className="size-3.5" /> ล้าง
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>ล้างตะกร้าทั้งหมด?</AlertDialogTitle>
                <AlertDialogDescription>
                  จะลบรายการสินค้า {cart.length} รายการออกจากตะกร้า ไม่สามารถย้อนกลับได้
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-xl">ยกเลิก</AlertDialogCancel>
                <AlertDialogAction className="rounded-xl" onClick={onClear}>
                  ล้างตะกร้า
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </header>

      <ScrollArea className={compact ? "max-h-64" : "min-h-32 flex-1"}>
        {cart.length === 0 ? (
          <EmptyState title="ยังไม่มีสินค้า" description="เลือกสินค้าจากตารางเพื่อเริ่มการขาย" />
        ) : (
          <ul className="divide-y">
            {cart.map((l) => (
              <li key={l.product.id} className="flex items-center gap-2 px-3 py-2.5">
                <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                  <ProductImage
                    imageUrl={l.product.imageUrl}
                    name={l.product.name}
                    iconClassName="size-4"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{l.product.name}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {currency(l.product.price)} × {l.qty}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 rounded-md"
                    onClick={() => onQty(l.product.id, -1)}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-6 text-center text-xs font-semibold tabular-nums">
                    {l.qty}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 rounded-md"
                    onClick={() => onQty(l.product.id, 1)}
                    disabled={l.qty >= l.product.stock}
                  >
                    <Plus className="size-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="space-y-3 border-t p-3">
        <div className="flex items-center gap-2">
          <Percent className="size-4 shrink-0 text-muted-foreground" />
          <Input
            type="number"
            min={0}
            max={100}
            value={discount}
            onChange={(e) => onDiscount(Number(e.target.value) || 0)}
            className="h-8 rounded-lg text-xs"
            placeholder="ส่วนลด %"
          />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            -{currency(discountAmt)}
          </span>
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">ยอดรวม</span>
            <span className="tabular-nums">{currency(subtotal)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">ยอดชำระ</span>
          <span className="text-2xl font-bold text-primary tabular-nums">{currency(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {paymentMethods.map((m) => (
            <button
              key={m.key}
              onClick={() => onMethod(m.key)}
              className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors ${
                method === m.key ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <m.icon className="size-4 shrink-0" />
              <span className="truncate">{m.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Button
            className="h-11 rounded-xl text-sm font-semibold"
            onClick={onCheckout}
            disabled={submitting || cart.length === 0}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> กำลังบันทึก...
              </>
            ) : (
              <>ชำระเงิน · {currency(total)}</>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 rounded-xl"
            disabled={cart.length === 0 || submitting}
            onClick={onPrint}
          >
            <Printer className="size-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
