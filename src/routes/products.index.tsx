import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, List, Plus, Download, Package, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Toolbar, FilterSelect, Pagination, usePagination } from "@/components/common/DataToolbar";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { productCategories as categories } from "@/lib/constants";
import { currency } from "@/lib/format";
import type { Product, ProductStatus } from "@/types";
import { productsApi } from "@/lib/api/products";
import { exportToCSV } from "@/lib/export";
import { uploadProductImage } from "@/lib/storage";
import { ProductImage } from "@/components/common/ProductImage";

// ตัวกรองที่รับผ่าน URL — ทุก field เป็น optional เพื่อให้ <Link to="/products"> ไม่ต้องส่ง search
interface ProductsSearch {
  status?: string | undefined;
  category?: string | undefined;
  q?: string | undefined;
}

export const Route = createFileRoute("/products/")({
  // รับ filter จาก URL เพื่อให้ลิงก์จากที่อื่นพาไปหน้าที่กรองไว้ได้
  // เช่น /products?status=low (สินค้าใกล้หมด) จากการแจ้งเตือน
  validateSearch: (search: ProductsSearch): ProductsSearch => ({
    status: typeof search.status === "string" ? search.status : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  head: () => ({
    meta: [
      { title: "แคตตาล็อกสินค้า — ปุ๋ยไทย CRM" },
      {
        name: "description",
        content:
          "จัดการสินค้าเกษตร ปุ๋ย ยา เมล็ดพันธุ์ และอุปกรณ์ พร้อมราคา ต้นทุน และสต็อกคงเหลือ",
      },
      { property: "og:title", content: "แคตตาล็อกสินค้า — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "แคตตาล็อกสินค้าเกษตรแบบตารางและกริด" },
      { property: "og:url", content: "/products" },
    ],
    links: [{ rel: "canonical", href: "/products" }],
  }),
  component: ProductsPage,
});

function ProductsPage() {
  // ค่าเริ่มต้นของตัวกรองมาจาก URL (ถ้ามี) — ผู้ใช้ปรับต่อได้ตามปกติ
  const search = Route.useSearch();
  const [query, setQuery] = useState(search.q ?? "");
  const [category, setCategory] = useState(search.category ?? "all");
  const [status, setStatus] = useState(search.status ?? "all");
  const [sort, setSort] = useState("name");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [addOpen, setAddOpen] = useState(false);
  const qc = useQueryClient();

  // ดึงสินค้าจาก Supabase
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => productsApi.list(),
  });

  const filtered = useMemo(() => {
    const out = list.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        (status === "all" || p.status === status) &&
        (p.name.includes(query) || p.sku.toLowerCase().includes(query.toLowerCase())),
    );
    return [...out].sort((a, b) =>
      sort === "price"
        ? b.price - a.price
        : sort === "stock"
          ? b.stock - a.stock
          : a.name.localeCompare(b.name),
    );
  }, [list, query, category, status, sort]);

  const { slice, page, pages, setPage, total, perPage } = usePagination(filtered, 12);

  const addProduct = async (p: Product) => {
    try {
      const created = await productsApi.create(p);
      qc.setQueryData<Product[]>(["products"], (prev) => [created, ...(prev ?? [])]);
      toast.success(`เพิ่มสินค้าใหม่แล้ว: ${created.name}`);
    } catch (e) {
      toast.error("เพิ่มสินค้าไม่สำเร็จ", { description: (e as Error).message });
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageHeader
        title="สินค้า"
        description={`${list.length} รายการในแคตตาล็อก · ${list.filter((p) => p.status !== "active").length} รายการต้องเติมสต็อก`}
        crumbs={[{ label: "สินค้า" }]}
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
                    SKU: p.sku,
                    ชื่อสินค้า: p.name,
                    หมวดหมู่: p.category,
                    แบรนด์: p.brand,
                    ราคา: p.price,
                    ต้นทุน: p.cost,
                    สต็อก: p.stock,
                    ขั้นต่ำ: p.minStock,
                    หน่วย: p.unit,
                    สถานะ: p.status,
                  })),
                  `สินค้า-${date}.csv`,
                );
              }}
            >
              <Download className="size-4" /> ส่งออก
            </Button>
            <Button size="sm" className="rounded-xl" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> เพิ่มสินค้า
            </Button>
          </>
        }
      />

      <div className="card-soft overflow-hidden">
        <div className="border-b p-3">
          <Toolbar
            query={query}
            onQuery={setQuery}
            placeholder="ค้นหาชื่อสินค้าหรือ SKU"
            filters={
              <>
                <FilterSelect
                  value={category}
                  onChange={setCategory}
                  label="หมวดหมู่"
                  className="w-[160px]"
                  options={[
                    { value: "all", label: "ทุกหมวดหมู่" },
                    ...categories.map((c) => ({ value: c, label: c })),
                  ]}
                />
                <FilterSelect
                  value={status}
                  onChange={setStatus}
                  label="สถานะ"
                  className="w-[140px]"
                  options={[
                    { value: "all", label: "ทุกสถานะ" },
                    { value: "active", label: "พร้อมขาย" },
                    { value: "low", label: "ใกล้หมด" },
                    { value: "out", label: "สินค้าหมด" },
                  ]}
                />
                <FilterSelect
                  value={sort}
                  onChange={setSort}
                  label="เรียงตาม"
                  icon={false}
                  className="w-[150px]"
                  options={[
                    { value: "name", label: "เรียงตามชื่อ" },
                    { value: "price", label: "ราคาสูง → ต่ำ" },
                    { value: "stock", label: "สต็อกมาก → น้อย" },
                  ]}
                />
              </>
            }
            right={
              <div className="flex items-center rounded-xl border p-0.5">
                <Button
                  variant={view === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => setView("grid")}
                >
                  <LayoutGrid className="size-4" />
                </Button>
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="icon"
                  className="size-8 rounded-lg"
                  onClick={() => setView("table")}
                >
                  <List className="size-4" />
                </Button>
              </div>
            }
          />
        </div>

        {isLoading ? (
          <div className="grid place-items-center py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
            <p className="mt-2 text-sm">กำลังโหลดสินค้า…</p>
          </div>
        ) : slice.length === 0 ? (
          <EmptyState
            icon={Package}
            title="ไม่พบสินค้า"
            description="ลองปรับตัวกรองหรือเพิ่มสินค้าใหม่เข้าสู่ระบบ"
            action={
              <Button size="sm" className="rounded-xl" onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> เพิ่มสินค้า
              </Button>
            }
          />
        ) : view === "grid" ? (
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {slice.map((p) => (
              <ContextMenu key={p.id}>
                <ContextMenuTrigger asChild>
                  <Link
                    to="/products/$productId"
                    params={{ productId: p.id }}
                    className="group flex flex-col rounded-xl border bg-card p-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--shadow-soft)]"
                  >
                    <span className="mb-3 grid h-24 place-items-center overflow-hidden rounded-lg bg-muted">
                      <ProductImage imageUrl={p.imageUrl} name={p.name} iconClassName="size-10" />
                    </span>
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 min-w-0 text-sm font-semibold">{p.name}</p>
                      <StatusBadge status={p.status} className="shrink-0" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.sku} · {p.brand}
                    </p>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-base font-bold text-primary tabular-nums">
                        {currency(p.price)}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        คงเหลือ {p.stock} {p.unit}
                      </p>
                    </div>
                  </Link>
                </ContextMenuTrigger>
                <ContextMenuContent className="rounded-xl">
                  <ContextMenuItem onSelect={() => toast("แก้ไขด่วน: " + p.name)}>
                    <Pencil className="size-4" /> แก้ไขด่วน
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => toast.success("เพิ่มเข้ารายการสั่งซื้อแล้ว")}>
                    <Plus className="size-4" /> สั่งซื้อเพิ่ม
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>สินค้า</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="text-right">ราคา</TableHead>
                  <TableHead className="text-right">ต้นทุน</TableHead>
                  <TableHead className="text-right">สต็อก</TableHead>
                  <TableHead>สถานะ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slice.map((p) => (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        to="/products/$productId"
                        params={{ productId: p.id }}
                        className="flex items-center gap-2 hover:text-primary"
                      >
                        <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted">
                          <ProductImage
                            imageUrl={p.imageUrl}
                            name={p.name}
                            iconClassName="size-4"
                          />
                        </span>
                        <span className="truncate">{p.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.sku}</TableCell>
                    <TableCell className="text-xs">{p.category}</TableCell>
                    <TableCell className="text-right tabular-nums">{currency(p.price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {currency(p.cost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.stock}</TableCell>
                    <TableCell>
                      <StatusBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination page={page} pages={pages} total={total} perPage={perPage} onPage={setPage} />
      </div>

      <ProductForm open={addOpen} onOpenChange={setAddOpen} onCreate={addProduct} />
    </div>
  );
}

/* ------------------------------ Product Form ------------------------------- */

function ProductForm({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (p: Product) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(categories[0]!);
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState("10");
  const [unit, setUnit] = useState("ชิ้น");
  const [expiryDate, setExpiryDate] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName("");
    setCategory(categories[0]!);
    setBrand("");
    setPrice("");
    setCost("");
    setStock("0");
    setMinStock("10");
    setUnit("ชิ้น");
    setExpiryDate("");
    setImageFile(null);
    setImagePreview("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ไฟล์ใหญ่เกิน 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const submit = async () => {
    if (!name.trim() || !price || !cost) {
      toast.error("กรุณากรอกชื่อ ราคา และต้นทุน");
      return;
    }
    const priceNum = Number(price);
    const costNum = Number(cost);
    const stockNum = Number(stock) || 0;
    const minNum = Number(minStock) || 0;
    const status: ProductStatus = stockNum === 0 ? "out" : stockNum < minNum ? "low" : "active";

    const productId = `p-${Date.now()}`;

    // อัปโหลดรูปถ้ามี
    let imageUrl: string | undefined;
    if (imageFile) {
      setUploading(true);
      try {
        imageUrl = await uploadProductImage(productId, imageFile);
      } catch (e) {
        toast.error("อัปโหลดรูปไม่สำเร็จ", { description: (e as Error).message });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const newProduct: Product = {
      id: productId,
      name: name.trim(),
      sku: `NEW-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
      barcode: `885${String(Math.floor(Math.random() * 9999999)).padStart(7, "0")}`,
      category,
      brand: brand.trim() || "ไม่ระบุ",
      price: priceNum,
      cost: costNum,
      stock: stockNum,
      minStock: minNum,
      unit,
      status,
      expiryDate: expiryDate || undefined,
      imageUrl,
    };
    onCreate(newProduct);
    reset();
    onOpenChange(false);
  };

  const margin =
    price && cost ? Math.round(((Number(price) - Number(cost)) / Number(price)) * 100) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Plus className="size-4 text-primary" /> เพิ่มสินค้าใหม่
          </SheetTitle>
          <SheetDescription>
            กรอกข้อมูลสินค้า · สถานะคำนวณอัตโนมัติจากสต็อกและสต็อกขั้นต่ำ
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="prod-name" className="text-xs font-semibold">
              ชื่อสินค้า *
            </Label>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น ปุ๋ยยูเรีย 46-0-0"
              autoFocus
              className="rounded-xl"
            />
          </div>

          {/* อัปโหลดรูปสินค้า */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              รูปสินค้า <span className="text-muted-foreground">(ไม่บังคับ)</span>
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            {imagePreview ? (
              <div className="relative inline-block">
                <img
                  src={imagePreview}
                  alt="preview"
                  className="h-24 w-24 rounded-xl border object-cover"
                />
                <button
                  onClick={removeImage}
                  className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full bg-destructive text-white shadow"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="size-5" />
                เพิ่มรูป
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">หมวดหมู่</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-brand" className="text-xs font-semibold">
                แบรนด์
              </Label>
              <Input
                id="prod-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="เช่น ตราหัววัว"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-price" className="text-xs font-semibold">
                ราคาขาย (฿) *
              </Label>
              <Input
                id="prod-price"
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="___"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost" className="text-xs font-semibold">
                ต้นทุน (฿) *
              </Label>
              <Input
                id="prod-cost"
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="___"
                className="rounded-xl"
              />
            </div>
          </div>

          {price && cost && (
            <p className="text-xs text-muted-foreground">
              กำไรขั้นต้น <span className="font-semibold text-foreground">{margin}%</span>
            </p>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-stock" className="text-xs font-semibold">
                สต็อก
              </Label>
              <Input
                id="prod-stock"
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-min" className="text-xs font-semibold">
                ขั้นต่ำ
              </Label>
              <Input
                id="prod-min"
                type="number"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-unit" className="text-xs font-semibold">
                หน่วย
              </Label>
              <Input
                id="prod-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ชิ้น/กระสอบ"
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prod-expiry" className="text-xs font-semibold">
              วันหมดอายุ <span className="text-muted-foreground">(ไม่บังคับ)</span>
            </Label>
            <Input
              id="prod-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="rounded-xl"
            />
            {expiryDate && (
              <p className="text-[11px] text-muted-foreground">
                {new Date(expiryDate) < new Date()
                  ? "⚠️ วันที่เลือกผ่านมาแล้ว — สินค้าหมดอายุแล้ว"
                  : `เหลืออีก ${Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000)} วัน`}
              </p>
            )}
          </div>

          {/* พรีวิว */}
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">พรีวิว</p>
            <div className="mt-2 flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-background">
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
                ) : (
                  <Package className="size-6 text-muted-foreground" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{name || "ชื่อสินค้า"}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {category} · {brand || "แบรนด์"}
                </p>
              </div>
              <p className="shrink-0 text-base font-bold text-primary tabular-nums">
                {price ? currency(Number(price)) : "฿0"}
              </p>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={uploading}
          >
            ยกเลิก
          </Button>
          <Button className="rounded-xl" onClick={submit} disabled={uploading}>
            {uploading ? (
              <>กำลังอัปโหลดรูป...</>
            ) : (
              <>
                <Plus className="size-4" /> เพิ่มสินค้า
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
