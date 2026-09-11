// ============================================================
// Fieldstone ERP — API barrel export
// import { productsApi, ordersApi } from "@/lib/api"
// ============================================================

export { productsApi } from "./products";
export { warehousesApi, type Warehouse } from "./warehouses";
export { movementsApi } from "./movements";
export { customersApi, cultivationsApi } from "./customers";
export {
  cropStagesApi,
  stageProductsApi,
  cultivationSchedulesApi,
  nextRoundApi,
} from "./cultivation-stages";
export { ordersApi, type OrderLineInput } from "./orders";
export { activitiesApi } from "./activities";
export { notificationsApi } from "./notifications";
export {
  dashboardApi,
  type DashboardStats,
  type SalesByDay,
  type RevenueTrend,
  type TopProduct,
  type BestCustomer,
} from "./dashboard";
export { settingsApi } from "./settings";
export { promotionsApi, calcDiscountAmount } from "./promotions";
