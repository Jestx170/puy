import { localApi } from "@/lib/local-api";
import { DEFAULT_STORE_SETTINGS, type StoreSettings } from "@/types";

interface DbStoreSettings {
  id: number;
  store_name: string;
  store_address: string | null;
  store_phone: string | null;
  tax_id: string | null;
  footer_text: string | null;
  updated_at: string;
}

function rowToSettings(r: DbStoreSettings): StoreSettings {
  return {
    storeName: r.store_name,
    storeAddress: r.store_address,
    storePhone: r.store_phone,
    taxId: r.tax_id,
    footerText: r.footer_text,
    updatedAt: r.updated_at,
  };
}

function settingsToRow(s: Partial<StoreSettings>): Partial<DbStoreSettings> {
  const row: Partial<DbStoreSettings> = {};
  if (s.storeName !== undefined) row.store_name = s.storeName;
  if (s.storeAddress !== undefined) row.store_address = s.storeAddress;
  if (s.storePhone !== undefined) row.store_phone = s.storePhone;
  if (s.taxId !== undefined) row.tax_id = s.taxId;
  if (s.footerText !== undefined) row.footer_text = s.footerText;
  return row;
}

export const settingsApi = {
  /** ดึงข้อมูลร้าน (single row id = 1) — คืน default ถ้ายังไม่มี row */
  async get(): Promise<StoreSettings> {
    const { data, error } = await localApi
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.warn("[settings] ดึงข้อมูลร้านไม่สำเร็จ — ใช้ default", error.message);
      return DEFAULT_STORE_SETTINGS;
    }
    if (!data) return DEFAULT_STORE_SETTINGS;
    return rowToSettings(data as DbStoreSettings);
  },

  /** บันทึกข้อมูลร้าน (upsert single row id = 1) */
  async update(s: Partial<StoreSettings>): Promise<StoreSettings> {
    const row = { ...settingsToRow(s), id: 1, updated_at: new Date().toISOString() };
    const { data, error } = await localApi
      .from("store_settings")
      .upsert(row, { onConflict: "id" })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return rowToSettings(data as DbStoreSettings);
  },
};
