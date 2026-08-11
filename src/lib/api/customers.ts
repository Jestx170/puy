import { supabase } from "@/lib/supabase";
import type { Customer, Cultivation, MemberTier } from "@/data/mock";

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
    stage: r.stage as Cultivation["stage"],
    area: Number(r.area),
    plantedDate: r.planted_date ?? "",
    expectedHarvest: r.expected_harvest ?? "",
    location: r.location,
    note: r.note ?? undefined,
  };
}

export const cultivationsApi = {
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
    const { data, error } = await supabase
      .from("cultivations")
      .insert({
        id: c.id,
        customer_id: c.customerId,
        crop: c.crop,
        stage: c.stage,
        area: c.area,
        planted_date: c.plantedDate || null,
        expected_harvest: c.expectedHarvest || null,
        location: c.location,
        note: c.note ?? null,
      })
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
  created_at: string;
}
