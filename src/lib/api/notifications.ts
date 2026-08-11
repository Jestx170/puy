import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/types";

/** แปลง timestamp เป็นข้อความระยะเวลาแบบอ่านง่าย เช่น "10 นาที" */
function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาที`;
  if (mins < 1440) return `${Math.floor(mins / 60)} ชม.`;
  return `${Math.floor(mins / 1440)} วัน`;
}

function rowToNotification(r: DbNotification): AppNotification {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    unread: r.unread,
    time: relativeTime(r.created_at),
    link: r.link ?? undefined,
  };
}

export const notificationsApi = {
  async list(limit = 10): Promise<AppNotification[]> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as DbNotification[]).map(rowToNotification);
  },

  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from("notifications").update({ unread: false }).eq("id", id);
    if (error) throw error;
  },

  /** ทำเครื่องหมายอ่านทั้งหมด — คืนจำนวนรายการที่เปลี่ยน */
  async markAllRead(): Promise<number> {
    const { data, error } = await supabase
      .from("notifications")
      .update({ unread: false })
      .eq("unread", true)
      .select("id");
    if (error) throw error;
    return (data as { id: string }[]).length;
  },
};

interface DbNotification {
  id: string;
  title: string;
  description: string;
  unread: boolean;
  link: string | null;
  created_at: string;
}
