import { createFileRoute } from "@tanstack/react-router";
import { InventoryOpsPage } from "@/components/inventory/InventoryOpsPage";

export const Route = createFileRoute("/inventory/movements")({
  head: () => ({
    meta: [
      { title: "ประวัติการเคลื่อนไหว — ปุ๋ยไทย CRM" },
      { name: "description", content: "รายการเคลื่อนไหวสต็อกทั้งหมดทุกประเภท" },
      { property: "og:title", content: "ประวัติการเคลื่อนไหว — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "รายการเคลื่อนไหวสต็อกทั้งหมดทุกประเภท" },
      { property: "og:url", content: "/inventory/movements" },
    ],
    links: [{ rel: "canonical", href: "/inventory/movements" }],
  }),
  component: () => (
    <InventoryOpsPage
      title="ประวัติการเคลื่อนไหว"
      description="รายการเคลื่อนไหวสต็อกทั้งหมดทุกประเภท"
      actionLabel="บันทึกรายการ"
    />
  ),
});
