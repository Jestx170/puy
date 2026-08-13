import { createFileRoute } from "@tanstack/react-router";
import { InventoryOpsPage } from "@/components/inventory/InventoryOpsPage";

export const Route = createFileRoute("/inventory/count")({
  head: () => ({
    meta: [
      { title: "ตรวจนับสต็อก — ปุ๋ยไทย CRM" },
      { name: "description", content: "รอบการตรวจนับและผลต่างที่พบ" },
      { property: "og:title", content: "ตรวจนับสต็อก — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "รอบการตรวจนับและผลต่างที่พบ" },
      { property: "og:url", content: "/inventory/count" },
    ],
    links: [{ rel: "canonical", href: "/inventory/count" }],
  }),
  component: () => (
    <InventoryOpsPage
      title="ตรวจนับสต็อก"
      description="รอบการตรวจนับและผลต่างที่พบ"
      actionLabel="เริ่มรอบตรวจนับ"
    />
  ),
});
