import { localApi } from "@/lib/local-api";
import type { ActivityItem } from "@/types";

function rowToActivity(r: DbActivity): ActivityItem {
  const diffMs = Date.now() - new Date(r.created_at).getTime();
  const mins = Math.floor(diffMs / 60000);
  let time: string;
  if (mins < 1) time = "เมื่อสักครู่";
  else if (mins < 60) time = `${mins} นาทีที่แล้ว`;
  else if (mins < 1440) time = `${Math.floor(mins / 60)} ชม.ที่แล้ว`;
  else time = `${Math.floor(mins / 1440)} วันที่แล้ว`;

  return {
    id: r.id,
    actor: r.actor,
    action: r.action,
    target: r.target,
    time,
    kind: r.kind as ActivityItem["kind"],
  };
}

export const activitiesApi = {
  async list(limit = 10): Promise<ActivityItem[]> {
    const { data, error } = await localApi
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data as DbActivity[]).map(rowToActivity);
  },

  async create(a: {
    actor: string;
    action: string;
    target?: string;
    kind?: ActivityItem["kind"];
  }): Promise<void> {
    const { error } = await localApi.from("activities").insert({
      actor: a.actor,
      action: a.action,
      target: a.target ?? "",
      kind: a.kind ?? "system",
    });
    if (error) throw error;
  },
};

interface DbActivity {
  id: string;
  actor: string;
  action: string;
  target: string;
  kind: string;
  created_at: string;
}
