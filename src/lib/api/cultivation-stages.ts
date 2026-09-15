// ============================================================
// Fieldstone ERP — Cultivation stages API
// จัดการข้อมูลระยะการเจริญเติบโต (crop_stages) + สินค้าที่ใช้ (stage_products)
// + ประวัติการดูแล (cultivation_schedules) + คำนวณรอบถัดไป
// ============================================================

import { localApi } from "@/lib/local-api";
import { stageRounds } from "@/types";
import type {
  CropStage,
  CultivationSchedule,
  NextRoundInfo,
  RecommendedProduct,
  StageProduct,
} from "@/types";

/* ----------------------------- crop_stages ----------------------------- */

interface DbCropStage {
  id: string;
  name: string;
  emoji: string;
  description: string | null;
  days_min: number | null;
  days_max: number | null;
  frequency_days: number | null;
  sort_order: number;
  crop_type: string;
}

function rowToCropStage(r: DbCropStage): CropStage {
  return {
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    description: r.description,
    daysMin: r.days_min,
    daysMax: r.days_max,
    frequencyDays: r.frequency_days,
    sortOrder: r.sort_order,
    cropType: r.crop_type,
  };
}

export const cropStagesApi = {
  /** ดึงระยะทั้งหมดของพืชชนิดหนึ่ง (เรียงตาม sort_order) */
  async listByCrop(cropType = "ลำไย"): Promise<CropStage[]> {
    const { data, error } = await localApi
      .from("crop_stages")
      .select("*")
      .eq("crop_type", cropType)
      .order("sort_order");
    if (error) throw error;
    return (data as DbCropStage[]).map(rowToCropStage);
  },

  async get(id: string): Promise<CropStage> {
    const { data, error } = await localApi.from("crop_stages").select("*").eq("id", id).single();
    if (error) throw error;
    return rowToCropStage(data as DbCropStage);
  },
};

/* ----------------------------- stage_products ----------------------------- */

interface DbStageProduct {
  id: string;
  stage_id: string;
  product_id: string | null;
  formula: string | null;
  sequence: number;
  is_optional: boolean;
}

function rowToStageProduct(r: DbStageProduct): StageProduct {
  return {
    id: r.id,
    stageId: r.stage_id,
    productId: r.product_id,
    formula: r.formula,
    sequence: r.sequence,
    isOptional: r.is_optional,
  };
}

export const stageProductsApi = {
  /** ดึงสินค้าทั้งหมดที่ใช้ในระยะหนึ่ง (เรียงตาม sequence) */
  async listByStage(stageId: string): Promise<StageProduct[]> {
    const { data, error } = await localApi
      .from("stage_products")
      .select("*")
      .eq("stage_id", stageId)
      .order("sequence");
    if (error) throw error;
    return (data as DbStageProduct[]).map(rowToStageProduct);
  },

  /** ดึงสินค้าของระยะ + sequence เฉพาะ (สำหรับรอบถัดไป) */
  async listByStageAndSequence(stageId: string, sequence: number): Promise<StageProduct[]> {
    const { data, error } = await localApi
      .from("stage_products")
      .select("*")
      .eq("stage_id", stageId)
      .eq("sequence", sequence)
      .order("sequence");
    if (error) throw error;
    return (data as DbStageProduct[]).map(rowToStageProduct);
  },
};

/* ----------------------------- cultivation_schedules ----------------------------- */

interface DbCultivationSchedule {
  id: string;
  cultivation_id: string;
  stage_id: string;
  product_id: string | null;
  action_date: string;
  sequence: number;
  notes: string | null;
}

function rowToSchedule(r: DbCultivationSchedule): CultivationSchedule {
  return {
    id: r.id,
    cultivationId: r.cultivation_id,
    stageId: r.stage_id,
    productId: r.product_id,
    actionDate: r.action_date,
    sequence: r.sequence,
    notes: r.notes,
  };
}

export const cultivationSchedulesApi = {
  /** ดึงประวัติการดูแลของแปลงหนึ่ง (เรียงจากใหม่สุด) */
  async listByCultivation(cultivationId: string): Promise<CultivationSchedule[]> {
    const { data, error } = await localApi
      .from("cultivation_schedules")
      .select("*")
      .eq("cultivation_id", cultivationId)
      .order("action_date", { ascending: false });
    if (error) throw error;
    return (data as DbCultivationSchedule[]).map(rowToSchedule);
  },

  /** บันทึกการดูแลรอบใหม่ + อัปเดต stage/sequence ใน cultivations */
  async create(input: {
    cultivationId: string;
    stageId: string;
    productId?: string | null;
    actionDate?: string;
    sequence: number;
    notes?: string;
  }): Promise<CultivationSchedule> {
    const stage = await cropStagesApi.get(input.stageId);
    const { data, error } = await localApi
      .from("cultivation_schedules")
      .insert({
        cultivation_id: input.cultivationId,
        stage_id: input.stageId,
        product_id: input.productId ?? null,
        action_date: input.actionDate ?? new Date().toISOString().slice(0, 10),
        sequence: input.sequence,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    // อัปเดต stage_id และ current_sequence ใน cultivations
    const { error: updateError } = await localApi
      .from("cultivations")
      .update({ stage: stage.name, stage_id: input.stageId, current_sequence: input.sequence })
      .eq("id", input.cultivationId);
    if (updateError) throw updateError;

    return rowToSchedule(data as DbCultivationSchedule);
  },
};

/* --------------------- รอบถัดไป + สินค้าแนะนำ --------------------- */

interface DbNextRoundRow {
  cultivation_id: string;
  customer_id: string;
  current_stage_id: string | null;
  current_stage_name: string | null;
  current_emoji: string | null;
  current_sequence: number;
  next_stage_id: string | null;
  next_stage_name: string | null;
  next_emoji: string | null;
  next_description: string | null;
  next_sequence: number;
  next_frequency_days: number | null;
  next_action_date: string | null;
  days_until_next: number | null;
}

function rowToNextRound(r: DbNextRoundRow): NextRoundInfo {
  return {
    cultivationId: r.cultivation_id,
    customerId: r.customer_id,
    currentStageId: r.current_stage_id,
    currentStageName: r.current_stage_name,
    currentEmoji: r.current_emoji,
    currentSequence: r.current_sequence,
    nextStageId: r.next_stage_id,
    nextStageName: r.next_stage_name,
    nextEmoji: r.next_emoji,
    nextDescription: r.next_description,
    nextSequence: r.next_sequence,
    nextFrequencyDays: r.next_frequency_days,
    nextActionDate: r.next_action_date,
    daysUntilNext: r.days_until_next,
  };
}

export const nextRoundApi = {
  /** ดึงข้อมูลรอบถัดไปของแปลงทั้งหมดของลูกค้าคนหนึ่ง */
  async listByCustomer(customerId: string): Promise<NextRoundInfo[]> {
    const { data, error } = await localApi
      .from("v_cultivation_next_round")
      .select("*")
      .eq("customer_id", customerId);
    if (error) throw error;
    return (data as DbNextRoundRow[]).map(rowToNextRound);
  },

  /** ดึงสินค้าที่แนะนำสำหรับรอบถัดไปของแปลงหนึ่ง */
  async recommendedProducts(nextRound: NextRoundInfo): Promise<RecommendedProduct[]> {
    if (!nextRound.nextStageId) return [];

    const stageProducts = await stageProductsApi.listByStageAndSequence(
      nextRound.nextStageId,
      nextRound.nextSequence,
    );

    if (stageProducts.length === 0) {
      if (nextRound.nextStageName && stageRounds[nextRound.nextStageName]) return [];
      // fallback: ดึงสินค้าทั้งหมดของ stage นั้น (ไม่กรอง sequence)
      const all = await stageProductsApi.listByStage(nextRound.nextStageId);
      return mapToRecommended(all);
    }

    return mapToRecommended(stageProducts);
  },
};

async function mapToRecommended(items: StageProduct[]): Promise<RecommendedProduct[]> {
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
  if (productIds.length === 0) return [];

  const { data: products, error } = await localApi
    .from("products")
    .select("id, name, sku, price, stock")
    .in("id", productIds);
  if (error) throw error;

  const productMap = new Map(
    (products as { id: string; name: string; sku: string; price: number; stock: number }[]).map(
      (p) => [p.id, p],
    ),
  );

  return items
    .filter((item) => item.productId && productMap.has(item.productId))
    .map((item) => {
      const p = productMap.get(item.productId!)!;
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        price: Number(p.price),
        stock: p.stock,
        formula: item.formula,
        sequence: item.sequence,
      };
    });
}
