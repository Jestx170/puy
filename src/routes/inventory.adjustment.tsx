import { createFileRoute } from "@tanstack/react-router";
import { InventoryOpsPage } from "@/components/inventory/InventoryOpsPage";

export const Route = createFileRoute("/inventory/adjustment")({
  head: () => ({
    meta: [
      { title: "ปรับปรุงสต็อก — ปุ๋ยไทย CRM" },
      { name: "description", content: "ปรับยอดสต็อกให้ตรงกับของจริงพร้อมเหตุผลกำกับ" },
      { property: "og:title", content: "ปรับปรุงสต็อก — ปุ๋ยไทย CRM" },
      { property: "og:description", content: "ปรับยอดสต็อกให้ตรงกับของจริงพร้อมเหตุผลกำกับ" },
      { property: "og:url", content: "/inventory/adjustment" },
    ],
    links: [{ rel: "canonical", href: "/inventory/adjustment" }],
  }),
  component: () => (
    <InventoryOpsPage
      title="ปรับปรุงสต็อก"
      description="ปรับยอดสต็อกให้ตรงกับของจริงพร้อมเหตุผลกำกับ"
      type={"ปรับปรุง"}
      actionLabel="สร้างใบปรับปรุง"
    />
  ),
});
