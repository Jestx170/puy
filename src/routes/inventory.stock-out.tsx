import { createFileRoute } from "@tanstack/react-router";
import { InventoryOpsPage } from "@/components/inventory/InventoryOpsPage";

export const Route = createFileRoute("/inventory/stock-out")({
  head: () => ({
    meta: [
      { title: "จ่ายสินค้าออก — ปุ๋ยไทย CRM" },
      { name: "description", content: "บันทึกการจ่ายสินค้าออกให้ลูกค้า" },
      { property: "og:title", content: "จ่ายสินค้าออก — ปุ๋ยไทย CRM" },
      {
        property: "og:description",
        content: "บันทึกการจ่ายสินค้าออกให้ลูกค้า",
      },
      { property: "og:url", content: "/inventory/stock-out" },
    ],
    links: [{ rel: "canonical", href: "/inventory/stock-out" }],
  }),
  component: () => (
    <InventoryOpsPage
      title="จ่ายสินค้าออก"
      description="บันทึกการจ่ายสินค้าออกให้ลูกค้า"
      type={"จ่ายออก"}
      actionLabel="สร้างใบจ่ายออก"
    />
  ),
});
