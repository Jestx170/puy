# ปุ๋ยไทย CRM — Agri ERP Platform (Phase 1 UI)

Build the full ERP interface as a polished, front-end-first application with realistic mock data. No backend in this phase — every screen is fully navigable and interactive so the flows can be validated before wiring a database.

## Design system

- Palette: primary green (deep foliage), secondary green (fresh sprout), warm neutral grays, white surfaces, soft low-spread shadows. No decorative gradients.
- Radius 12–16px, generous whitespace, dense-but-calm enterprise typography.
- All colors as semantic tokens in `src/styles.css`; shadcn/ui components restyled through variants, Lucide icons throughout.
- Motion kept restrained: 150–200ms transitions, skeleton shimmer, sidebar collapse.

## App shell

- Top bar: logo, global search (⌘K command palette), notifications popover, quick-actions menu, user menu.
- Collapsible left sidebar with icon+label nav for the 8 modules, icon-only mini state.
- Breadcrumb strip under the top bar, toast notifications mounted globally.

## Modules and routes

```text
/                    Dashboard   KPI row (sales today, monthly revenue, customers,
                                 orders, low stock) + sales chart, revenue trend,
                                 top products, best customers + recent orders,
                                 inventory alerts, activity feed, notifications
/customers           CRM         master list left / profile right, tabs:
                                 Profile, Purchase History, Orders, Documents,
                                 Recommended Products; timeline + notes
/pos                 POS         left customer + search + categories,
                                 center product grid, right cart,
                                 bottom payment panel (cash/QR/card/transfer)
/products            Catalog     grid + table toggle, filters
/products/$id        Detail      image, SKU, barcode, category, brand,
                                 price/cost, stock, min stock, status, quick edit
/inventory           Overview    current stock, movement, adjustments, low stock
/inventory/stock-in|stock-out|adjustment|transfer|movements|count
/sales               Workspace   stats header + order table with filters
/sales/$id           Detail      customer, products, payment, documents, timeline
/promotions          Center      discount / coupon / campaign / bundle cards,
                                 active campaigns, rule builder drawer
/users               Admin       user list, role list, interactive permission matrix
```

Each route gets its own `head()` with distinct title/description/OG tags.

## Shared components

Reusable `DataTable` (search, filter, sort, pagination, empty state, error state, row context menu), `PageHeader` with breadcrumb + quick actions, `StatCard`, `StatusBadge` (color-coded), skeleton loaders, confirm dialog, and a command palette with keyboard shortcuts.

## Widgets

Dashboard widgets are rendered from a config array in a grid, so drag-to-rearrange can be added later without restructuring.

## Build order

1. Design tokens, app shell, sidebar, top bar, shared primitives
2. Dashboard
3. POS
4. Customer CRM
5. Products + Inventory
6. Sales
7. Promotions + Users & Permissions

## Technical notes

TanStack Start file routes, Tailwind v4 tokens in `src/styles.css`, shadcn/ui, Recharts for charts, mock data modules under `src/data/` typed with shared interfaces so a later Lovable Cloud migration is a swap of the data layer only.
