import { supabase } from "@/lib/supabase";
import { cultivationStageSelection, cultivationStageStorage } from "@/types";
import type { Customer, Cultivation, MemberTier } from "@/types";

function rowToCustomer(r: DbCustomer): Customer {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    phone: r.phone,
    email: r.email,
    address: r.address,
    type: r.type as Customer["type"],
    tier: r.tier as MemberTier,
    lifetime: Number(r.lifetime),
    orders: r.orders,
    lastOrder: r.last_order ?? "",
    since: r.since ?? "",
    notes: r.notes,
    tags: r.tags ?? [],
    cultivations: [], // ดึงแยกผ่าน cultivationsApi
  };
}

export const customersApi = {
  async list(): Promise<Customer[]> {
    const { data, error } = await supabase.from("customers").select("*").order("name");
    if (error) throw error;
    return (data as DbCustomer[]).map(rowToCustomer);
  },

  async get(id: string): Promise<Customer> {
    const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
    if (error) throw error;
    return rowToCustomer(data as DbCustomer);
  },

  async create(c: Customer): Promise<Customer> {
    const { data, error } = await supabase
      .from("customers")
      .insert({
        id: c.id,
        name: c.name,
        code: c.code,
        phone: c.phone,
        email: c.email,
        address: c.address,
        type: c.type,
        tier: c.tier,
        lifetime: c.lifetime,
        orders: c.orders,
        last_order: c.lastOrder || null,
        since: c.since || null,
        notes: c.notes,
        tags: c.tags,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToCustomer(data as DbCustomer);
  },

  async update(id: string, patch: Partial<Customer>): Promise<Customer> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row["name"] = patch.name;
    if (patch.phone !== undefined) row["phone"] = patch.phone;
    if (patch.email !== undefined) row["email"] = patch.email;
    if (patch.address !== undefined) row["address"] = patch.address;
    if (patch.type !== undefined) row["type"] = patch.type;
    if (patch.tier !== undefined) row["tier"] = patch.tier;
    if (patch.lifetime !== undefined) row["lifetime"] = patch.lifetime;
    if (patch.orders !== undefined) row["orders"] = patch.orders;
    if (patch.lastOrder !== undefined) row["last_order"] = patch.lastOrder || null;
    if (patch.notes !== undefined) row["notes"] = patch.notes;
    if (patch.tags !== undefined) row["tags"] = patch.tags;
    const { data, error } = await supabase
      .from("customers")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToCustomer(data as DbCustomer);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },
};

// Cultivations
function rowToCultivation(r: DbCultivation): Cultivation {
  return {
    id: r.id,
    crop: r.crop,
    stage: cultivationStageSelection(r.stage, r.current_sequence ?? 0),
    area: Number(r.area),
    plantedDate: r.planted_date ?? "",
    expectedHarvest: r.expected_harvest ?? "",
    location: r.location,
    note: r.note ?? undefined,
    stageId: r.stage_id ?? undefined,
    currentSequence: r.current_sequence ?? undefined,
  };
}

export const cultivationsApi = {
  async listAll(): Promise<(Cultivation & { customerId: string })[]> {
    const { data, error } = await supabase.from("cultivations").select("*");
    if (error) throw error;
    return (data as DbCultivation[]).map((r) => ({
      ...rowToCultivation(r),
      customerId: r.customer_id,
    }));
  },

  async listByCustomer(customerId: string): Promise<Cultivation[]> {
    const { data, error } = await supabase
      .from("cultivations")
      .select("*")
      .eq("customer_id", customerId)
      .order("planted_date", { ascending: false });
    if (error) throw error;
    return (data as DbCultivation[]).map(rowToCultivation);
  },

  async create(c: Cultivation & { customerId: string }): Promise<Cultivation> {
    const stored = cultivationStageStorage(c.stage, c.currentSequence);
    const { data, error } = await supabase
      .from("cultivations")
      .insert({
        id: c.id,
        customer_id: c.customerId,
        crop: c.crop,
        stage: stored.stage,
        area: c.area,
        planted_date: c.plantedDate || null,
        expected_harvest: c.expectedHarvest || null,
        location: c.location,
        note: c.note ?? null,
        stage_id: stored.stageId,
        current_sequence: stored.currentSequence,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToCultivation(data as DbCultivation);
  },

  async update(id: string, patch: Partial<Cultivation>): Promise<Cultivation> {
    const row: Record<string, unknown> = {};
    if (patch.crop !== undefined) row["crop"] = patch.crop;
    if (patch.stage !== undefined) {
      const stored = cultivationStageStorage(patch.stage, patch.currentSequence);
      row["stage"] = stored.stage;
      row["stage_id"] = stored.stageId;
      row["current_sequence"] = stored.currentSequence;
    }
    if (patch.area !== undefined) row["area"] = patch.area;
    if (patch.plantedDate !== undefined) row["planted_date"] = patch.plantedDate || null;
    if (patch.expectedHarvest !== undefined)
      row["expected_harvest"] = patch.expectedHarvest || null;
    if (patch.location !== undefined) row["location"] = patch.location;
    if (patch.note !== undefined) row["note"] = patch.note ?? null;
    if (patch.stageId !== undefined) row["stage_id"] = patch.stageId ?? null;
    if (patch.currentSequence !== undefined) row["current_sequence"] = patch.currentSequence;
    const { data, error } = await supabase
      .from("cultivations")
      .update(row)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToCultivation(data as DbCultivation);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("cultivations").delete().eq("id", id);
    if (error) throw error;
  },
};

interface DbCustomer {
  id: string;
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  type: string;
  tier: string;
  lifetime: number;
  orders: number;
  last_order: string | null;
  since: string | null;
  notes: string;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

interface DbCultivation {
  id: string;
  customer_id: string;
  crop: string;
  stage: string;
  area: number;
  planted_date: string | null;
  expected_harvest: string | null;
  location: string;
  note: string | null;
  stage_id: string | null;
  current_sequence: number | null;
  created_at: string;
}
