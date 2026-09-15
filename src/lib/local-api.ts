/* eslint-disable @typescript-eslint/no-explicit-any */
import { apiFetch, API_BASE } from "@/lib/api/client";

type Result<T> = { data: T | null; error: Error | null };
type Filter = { field: string; operator: string; value: unknown };

function endpointFor(table: string): string {
  const views: Record<string, string> = {
    v_dashboard_stats: "/dashboard/stats",
    v_top_products: "/dashboard/top-products",
    v_expiring_products: "/products/expiring",
    v_warehouse_summary: "/warehouses/summary",
    v_sales_by_day: "/dashboard/sales-by-day",
    v_revenue_trend: "/dashboard/revenue-trend",
    v_profit_by_day: "/dashboard/profit-by-day",
    v_profit_by_month: "/dashboard/profit-by-month",
    v_best_customers: "/dashboard/best-customers",
    v_cultivation_next_round: "/cultivations/next-round",
    stock_movements: "/inventory/movements",
    store_settings: "/settings",
    crop_stages: "/crop-stages",
    stage_products: "/stage-products",
    cultivation_schedules: "/cultivation-schedules",
  };
  return views[table] ?? `/${table}`;
}

class LocalQuery<T = any> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private ordering: { field: string; ascending: boolean } | undefined;
  private countLimit: number | undefined;
  private body: unknown;
  private method = "GET";
  private selection = "*";
  private singleResult = false;
  private maybeSingleResult = false;

  constructor(private readonly table: string) {}

  select(columns = "*"): this {
    this.selection = columns;
    return this;
  }

  eq(field: string, value: unknown): this {
    this.filters.push({ field, operator: "eq", value });
    return this;
  }

  is(field: string, value: unknown): this {
    this.filters.push({ field, operator: "is", value });
    return this;
  }

  in(field: string, values: unknown[]): this {
    this.filters.push({ field, operator: "in", value: values });
    return this;
  }

  lte(field: string, value: unknown): this {
    this.filters.push({ field, operator: "lte", value });
    return this;
  }

  gte(field: string, value: unknown): this {
    this.filters.push({ field, operator: "gte", value });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }): this {
    this.ordering = { field, ascending: options?.ascending ?? true };
    return this;
  }

  limit(value: number): this {
    this.countLimit = value;
    return this;
  }

  insert(value: unknown): this {
    this.method = "POST";
    this.body = value;
    return this;
  }

  update(value: unknown): this {
    this.method = "PATCH";
    this.body = value;
    return this;
  }

  upsert(value: unknown, _options?: unknown): this {
    this.method = "PUT";
    this.body = value;
    return this;
  }

  delete(): this {
    this.method = "DELETE";
    return this;
  }

  single(): this {
    this.singleResult = true;
    return this;
  }

  maybeSingle(): this {
    this.maybeSingleResult = true;
    return this;
  }

  async then<TResult1 = Result<T>, TResult2 = never>(
    onfulfilled?: ((value: Result<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    try {
      const query = new URLSearchParams();
      for (const filter of this.filters) {
        if (filter.operator === "eq") query.set(filter.field, String(filter.value));
        if (filter.operator === "is" && filter.value === null) query.set(filter.field, "null");
        if (filter.operator === "in")
          query.set(filter.field, (filter.value as unknown[]).join(","));
        if (filter.operator === "lte" || filter.operator === "gte")
          query.set(filter.field, String(filter.value));
      }
      if (this.ordering)
        query.set("order", `${this.ordering.field}.${this.ordering.ascending ? "asc" : "desc"}`);
      if (this.countLimit) query.set("limit", String(this.countLimit));
      if (this.selection !== "*") query.set("select", this.selection);
      let endpoint = endpointFor(this.table);
      const idFilter = this.filters.find(
        (filter) => filter.field === "id" && filter.operator === "eq",
      );
      if (idFilter && (this.method === "PATCH" || this.method === "DELETE")) {
        endpoint += `/${encodeURIComponent(String(idFilter.value))}`;
        query.delete("id");
      }
      const suffix = query.size ? `?${query}` : "";
      const request: RequestInit = { method: this.method };
      if (this.body !== undefined) request.body = JSON.stringify(this.body);
      const response = await apiFetch<T>(endpoint + suffix, request);
      const data =
        this.singleResult || this.maybeSingleResult
          ? Array.isArray(response)
            ? (response[0] ?? null)
            : response
          : response;
      const result = { data, error: null } as Result<T>;
      return onfulfilled ? await onfulfilled(result) : (result as TResult1);
    } catch (error) {
      const result = {
        data: null,
        error: error instanceof Error ? error : new Error(String(error)),
      } as Result<T>;
      if (onrejected) return onrejected(result.error);
      return result as TResult1;
    }
  }
}

export const localApi = {
  from<T = any>(table: string): LocalQuery<T> {
    return new LocalQuery<T>(table);
  },
  async rpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<Result<T>> {
    const a = args as any;
    const routes: Record<string, string> = {
      record_stock_movement: "/inventory/movements",
      create_sale_transaction: "/orders/transaction",
      delete_product_safe: `/products/${a.p_product_id}`,
      increment_promotion_used: `/promotions/${a.p_id}/increment`,
      record_care_atomic: "/cultivations/schedules",
    };
    const methods: Record<string, string> = {
      record_stock_movement: "POST",
      create_sale_transaction: "POST",
      delete_product_safe: "DELETE",
      increment_promotion_used: "POST",
      record_care_atomic: "POST",
    };
    try {
      const payload =
        name === "record_stock_movement"
          ? {
              type: a.p_type,
              product_id: a.p_product_id,
              qty: a.p_qty,
              warehouse: a.p_warehouse,
              by_user: a.p_by_user,
              note: a.p_note,
              reference: a.p_reference,
              unit_cost: a.p_unit_cost,
              expiry_date: a.p_expiry_date,
            }
          : name === "create_sale_transaction"
            ? {
                id: a.p_order_id,
                code: a.p_code,
                customer_id: a.p_customer_id,
                customer_name: a.p_customer_name,
                total: a.p_total,
                status: a.p_status,
                channel: a.p_channel,
                salesperson: a.p_salesperson,
                payment: a.p_payment,
                items: a.p_items,
              }
            : args;
      const data = await apiFetch<T | { result: T }>(routes[name]!, {
        method: methods[name]!,
        body: JSON.stringify(payload),
      });
      const normalized =
        name === "delete_product_safe" &&
        typeof data === "object" &&
        data !== null &&
        "result" in data
          ? data.result
          : data;
      return { data: normalized as T, error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async (path: string, file: File, _options?: unknown) => {
        const productId = path.split("-")[0] ?? path;
        const form = new FormData();
        form.append("file", file);
        try {
          const data = await fetch(`${API_BASE}/storage/product-images/${productId}`, {
            method: "POST",
            body: form,
          }).then(async (response) => {
            if (!response.ok)
              throw new Error((await response.json()).detail ?? response.statusText);
            return response.json() as Promise<{ url: string }>;
          });
          return { data: { path: data.url }, error: null };
        } catch (error) {
          return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
        }
      },
      remove: async (_paths: string[]) => ({ data: null, error: null }),
      getPublicUrl: (path: string) => ({
        data: { publicUrl: path.startsWith("/") ? path : `${API_BASE}/storage/files/${path}` },
      }),
    }),
  },
};
