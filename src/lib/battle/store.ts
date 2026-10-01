import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BattleSecrets, BattleState } from "./types";

export interface StoredBattle {
  state: BattleState;
  secrets: BattleSecrets;
  version: number;
}

/**
 * Persistencia de las salas. Con Supabase configurado se usa la base de datos
 * (necesaria en Vercel, donde cada petición puede caer en otra instancia);
 * en desarrollo local, sin variables de entorno, se usa memoria.
 */
export interface BattleStore {
  readonly kind: "supabase" | "memory";
  insert(battle: StoredBattle): Promise<void>;
  get(id: string): Promise<StoredBattle | null>;
  /** Escribe solo si nadie cambió la sala desde `expectedVersion` (concurrencia optimista). */
  update(id: string, expectedVersion: number, state: BattleState, secrets: BattleSecrets): Promise<boolean>;
}

export class BattleConfigError extends Error {
  constructor() {
    super(
      "Las batallas en vivo no están configuradas: faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY.",
    );
    this.name = "BattleConfigError";
  }
}

// ---------- Supabase ----------

class SupabaseBattleStore implements BattleStore {
  readonly kind = "supabase" as const;
  constructor(private readonly db: SupabaseClient) {}

  async insert({ state, secrets, version }: StoredBattle) {
    const { error } = await this.db.from("battles").insert({ id: state.id, state, secrets, version });
    if (error) throw new Error(`No se pudo crear la sala: ${error.message}`);
    await this.signal(state.id, version);
  }

  async get(id: string) {
    const { data, error } = await this.db
      .from("battles")
      .select("state, secrets, version")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`No se pudo leer la sala: ${error.message}`);
    return (data as StoredBattle | null) ?? null;
  }

  async update(id: string, expectedVersion: number, state: BattleState, secrets: BattleSecrets) {
    const { data, error } = await this.db
      .from("battles")
      .update({ state, secrets, version: expectedVersion + 1, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("version", expectedVersion)
      .select("id");
    if (error) throw new Error(`No se pudo guardar la sala: ${error.message}`);
    if (!data || data.length === 0) return false;
    await this.signal(id, expectedVersion + 1);
    return true;
  }

  /**
   * battle_signals es la única tabla legible con la clave pública: solo
   * contiene el número de versión. Los navegadores escuchan sus cambios por
   * Realtime y vuelven a pedir la vista; el estado completo nunca se expone.
   */
  private async signal(id: string, version: number) {
    const { error } = await this.db
      .from("battle_signals")
      .upsert({ battle_id: id, version, updated_at: new Date().toISOString() });
    if (error) console.error("No se pudo notificar el cambio de la sala", error.message);
  }
}

// ---------- Memoria (solo desarrollo) ----------

const memory = globalThis as unknown as { __battles?: Map<string, StoredBattle> };

class MemoryBattleStore implements BattleStore {
  readonly kind = "memory" as const;
  private readonly battles = (memory.__battles ??= new Map());

  async insert(battle: StoredBattle) {
    this.battles.set(battle.state.id, structuredClone(battle));
  }

  async get(id: string) {
    const battle = this.battles.get(id);
    return battle ? structuredClone(battle) : null;
  }

  async update(id: string, expectedVersion: number, state: BattleState, secrets: BattleSecrets) {
    const current = this.battles.get(id);
    if (!current || current.version !== expectedVersion) return false;
    this.battles.set(id, structuredClone({ state, secrets, version: expectedVersion + 1 }));
    return true;
  }
}

// ---------- Selección ----------

/** Acepta las claves nuevas de Supabase (sb_secret / sb_publishable) o las antiguas. */
function serverKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function publicKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

let store: BattleStore | undefined;

export function getBattleStore(): BattleStore {
  if (store) return store;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = serverKey();

  if (url && serviceKey) {
    store = new SupabaseBattleStore(
      createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  } else if (process.env.NODE_ENV !== "production" || process.env.BATTLE_STORE === "memory") {
    store = new MemoryBattleStore();
  } else {
    throw new BattleConfigError();
  }
  return store;
}

/** El navegador puede escuchar Realtime solo si hay URL y clave pública. */
export function realtimeEnabled(): boolean {
  return (
    getBattleStore().kind === "supabase" &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicKey())
  );
}
