/** Tipos del minijuego de batalla. Todo es serializable a JSON (se guarda en Supabase). */

export type Side = "host" | "guest";
export type StatKey = "atk" | "def" | "spa" | "spd" | "spe";
export type Status = "brn" | "par" | "psn" | "frz" | null;
export type TeamSize = 1 | 3 | 6;
export const TEAM_SIZES: TeamSize[] = [1, 3, 6];

export interface BattleMove {
  id: number;
  name: string;
  /** Nombre en español. */
  label: string;
  type: string;
  category: "physical" | "special";
  power: number;
  /** null = nunca falla. */
  accuracy: number | null;
  priority: number;
  critStage: number;
  /** % del daño que recupera (positivo) o que recibe como retroceso (negativo). */
  drain: number;
  minHits: number;
  maxHits: number;
  flinchChance: number;
  ailment: Status;
  ailmentChance: number;
  statChanges: { stat: StatKey; change: number }[];
  statChance: number;
  statTarget: "self" | "target";
}

export interface BattlePokemon {
  slot: number;
  id: number;
  name: string;
  types: string[];
  level: number;
  sprite: string;
  backSprite: string;
  stats: Record<"hp" | StatKey, number>;
  hp: number;
  status: Status;
  stages: Record<StatKey, number>;
  moves: BattleMove[];
}

export interface PlayerState {
  name: string;
  team: BattlePokemon[];
  active: number;
  /** Su Pokémon activo se debilitó y debe elegir otro antes de seguir. */
  mustSwitch: boolean;
}

export type Phase = "waiting" | "choose" | "switch" | "finished";

export type BattleAction =
  | { kind: "move"; index: number }
  | { kind: "switch"; slot: number };

export interface SideSnapshot {
  active: number;
  hp: number[];
  status: Status[];
}

export type EventKind = "info" | "move" | "hit" | "miss" | "faint" | "switch" | "status" | "stat" | "heal";

/**
 * Un paso de la animación. `snapshot` es el estado visible de ambos lados
 * justo después del evento, así el cliente solo tiene que mostrarlo en orden.
 */
export interface BattleEvent {
  kind: EventKind;
  text: string;
  side?: Side;
  snapshot: Record<Side, SideSnapshot | null>;
}

export interface TurnLog {
  turn: number;
  events: BattleEvent[];
}

export interface BattleState {
  id: string;
  size: TeamSize;
  phase: Phase;
  turn: number;
  players: { host: PlayerState; guest: PlayerState | null };
  winner: Side | "draw" | null;
  log: TurnLog[];
  /** Estado del generador pseudoaleatorio: la resolución es reproducible. */
  rng: number;
  createdAt: string;
}

/** Datos privados: nunca salen del servidor. */
export interface BattleSecrets {
  hostToken: string;
  guestToken: string | null;
  actions: Partial<Record<Side, BattleAction>>;
}

export type Role = Side | "spectator";

/** Lo que recibe el navegador: el estado sin secretos ni movimientos del rival. */
export interface BattleView {
  state: BattleState;
  role: Role;
  /** El jugador ya envió su acción para la fase actual. */
  submitted: Partial<Record<Side, boolean>>;
  realtime: boolean;
}
