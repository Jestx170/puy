import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

if (!url || !anonKey) {
  // ไม่ throw เพื่อให้ build ผ่าน — หน้าที่ใช้ supabase จะจัดการ error เอง
  console.warn(
    "[supabase] ขาด VITE_SUPABASE_URL หรือ VITE_SUPABASE_ANON_KEY — ฟีเจอร์ Supabase จะไม่ทำงาน",
  );
}

export const supabase = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  {
    auth: { persistSession: false },
  },
);

export const supabaseReady = Boolean(url && anonKey);
