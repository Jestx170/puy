import { createFileRoute } from "@tanstack/react-router";
import { InventoryOpsPage } from "@/components/inventory/InventoryOpsPage";

export const Route = createFileRoute("/inventory/stock-in")({
  head: () => ({
    meta: [
      { title: "รับสินค้าเข้าคลัง — ปุ๋ยไทย CRM" },
      { name: "description", content: "บันทึกการรับสินค้าจากผู้จำหน่ายเข้าสู่คลัง" },
      { property: "og:title", content: "รับสินค้าเข้าคลัง — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "บันทึกการรับสินค้าจากผู้จำหน่ายเข้าสู่คลัง" },
      { property: "og:url", content: "/inventory/stock-in" },
    ],
    links: [{ rel: "canonical", href: "/inventory/stock-in" }],
  }),
  component: () => (
    <InventoryOpsPage
      title="รับสินค้าเข้าคลัง"
      description="บันทึกการรับสินค้าจากผู้จำหน่ายเข้าสู่คลัง"
      type={"รับเข้า"}
      actionLabel="สร้างใบรับเข้า"
    />
  ),
});
