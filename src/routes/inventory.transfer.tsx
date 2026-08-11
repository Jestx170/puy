import { createFileRoute } from "@tanstack/react-router";
import { InventoryOpsPage } from "@/components/inventory/InventoryOpsPage";

export const Route = createFileRoute("/inventory/transfer")({
  head: () => ({
    meta: [
      { title: "โอนย้ายระหว่างคลัง — ปุ๋ยไทย CRM" },
      { name: "description", content: "ย้ายสินค้าระหว่างคลังหลัก คลังสาขา และหน้าร้าน" },
      { property: "og:title", content: "โอนย้ายระหว่างคลัง — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "ย้ายสินค้าระหว่างคลังหลัก คลังสาขา และหน้าร้าน" },
      { property: "og:url", content: "/inventory/transfer" },
    ],
    links: [{ rel: "canonical", href: "/inventory/transfer" }],
  }),
  component: () => (
    <InventoryOpsPage
      title="โอนย้ายระหว่างคลัง"
      description="ย้ายสินค้าระหว่างคลังหลัก คลังสาขา และหน้าร้าน"
      type={"โอนย้าย"}
      actionLabel="สร้างใบโอนย้าย"
    />
  ),
});
