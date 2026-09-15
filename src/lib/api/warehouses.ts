import { localApi } from "@/lib/local-api";

export interface Warehouse {
  id: string;
  name: string;
  items: number;
  value: number;
  capacity: number;
}

function rowToWarehouse(r: DbWarehouse): Warehouse {
  return {
    id: r.id,
    name: r.name,
    items: r.items,
    value: Number(r.value),
    capacity: r.capacity,
  };
}

export const warehousesApi = {
  async list(): Promise<Warehouse[]> {
    const { data, error } = await localApi.from("warehouses").select("*").order("name");
    if (error) throw error;
    return (data as DbWarehouse[]).map(rowToWarehouse);
  },
};

interface DbWarehouse {
  id: string;
  name: string;
  items: number;
  value: number;
  capacity: number;
}
