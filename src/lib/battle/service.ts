import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { PokeApiError } from "@/lib/pokeapi/api";
import { buildTeam } from "./build-team";
import { OTHER, requiredSides, resolve, startBattle, validateAction } from "./engine";
import { randomSeed } from "./rng";
import { getBattleStore, realtimeEnabled, type StoredBattle } from "./store";
import {
  TEAM_SIZES,
  type BattleAction,
  type BattleState,
  type BattleView,
  type Role,
  type Side,
  type TeamSize,
} from "./types";

export class BattleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BattleError";
  }
}

const ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const NAME_PATTERN = /^[a-z0-9-]{1,40}$/;
const MAX_RETRIES = 5;

function newId(): string {
  return Array.from(randomBytes(8), (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join("");
}

function newToken(): string {
  return randomBytes(24).toString("base64url");
}

function sameToken(a: string | null | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function roleOf(battle: StoredBattle, token: string | undefined): Role {
  if (sameToken(battle.secrets.hostToken, token)) return "host";
  if (sameToken(battle.secrets.guestToken, token)) return "guest";
  return "spectator";
}

function cleanPlayerName(name: string | undefined, fallback: string): string {
  const trimmed = (name ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
  return trimmed || fallback;
}

async function buildValidatedTeam(size: TeamSize, names: string[]) {
  if (!TEAM_SIZES.includes(size)) throw new BattleError("Tamaño de equipo no válido.");
  if (names.length !== size) throw new BattleError(`Debes elegir exactamente ${size} Pokémon.`);
  if (new Set(names).size !== names.length) throw new BattleError("No puedes repetir Pokémon.");
  if (!names.every((name) => NAME_PATTERN.test(name))) throw new BattleError("Nombre de Pokémon no válido.");

  try {
    return await buildTeam(names);
  } catch (error) {
    if (error instanceof PokeApiError) throw new BattleError("Uno de los Pokémon elegidos no existe.");
    throw error;
  }
}

/** Lee, modifica y guarda con reintentos si otro jugador escribió a la vez. */
async function mutate(id: string, change: (battle: StoredBattle) => Promise<StoredBattle> | StoredBattle) {
  const store = getBattleStore();
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const current = await store.get(id);
    if (!current) throw new BattleError("La sala no existe.");
    const next = await change(structuredClone(current));
    if (await store.update(id, current.version, next.state, next.secrets)) return next;
  }
  throw new BattleError("La sala está ocupada, inténtalo de nuevo.");
}

// ---------- Casos de uso ----------

export async function createBattle(input: { size: TeamSize; names: string[]; playerName?: string }) {
  const team = await buildValidatedTeam(input.size, input.names);
  const id = newId();
  const token = newToken();

  const state: BattleState = {
    id,
    size: input.size,
    phase: "waiting",
    turn: 0,
    players: {
      host: { name: cleanPlayerName(input.playerName, "Jugador 1"), team, active: 0, mustSwitch: false },
      guest: null,
    },
    winner: null,
    log: [],
    rng: randomSeed(),
    createdAt: new Date().toISOString(),
  };

  await getBattleStore().insert({ state, secrets: { hostToken: token, guestToken: null, actions: {} }, version: 1 });
  return { id, token };
}

export async function joinBattle(input: { id: string; names: string[]; playerName?: string }) {
  const store = getBattleStore();
  const existing = await store.get(input.id);
  if (!existing) throw new BattleError("La sala no existe.");
  if (existing.secrets.guestToken) throw new BattleError("La sala ya tiene dos jugadores.");

  // El equipo se arma antes de entrar al ciclo de reintentos (son peticiones lentas).
  const team = await buildValidatedTeam(existing.state.size, input.names);
  const token = newToken();

  await mutate(input.id, (battle) => {
    if (battle.secrets.guestToken) throw new BattleError("La sala ya tiene dos jugadores.");
    battle.state.players.guest = {
      name: cleanPlayerName(input.playerName, "Jugador 2"),
      team,
      active: 0,
      mustSwitch: false,
    };
    battle.state = startBattle(battle.state);
    battle.secrets.guestToken = token;
    return battle;
  });

  return { token };
}

export async function submitAction(input: { id: string; token: string | undefined; action: BattleAction }) {
  await mutate(input.id, (battle) => {
    const role = roleOf(battle, input.token);
    if (role === "spectator") throw new BattleError("No participas en esta batalla.");

    const error = validateAction(battle.state, role, input.action);
    if (error) throw new BattleError(error);
    if (battle.secrets.actions[role]) throw new BattleError("Ya elegiste tu acción para este turno.");

    battle.secrets.actions[role] = input.action;

    const pending = requiredSides(battle.state).filter((side) => !battle.secrets.actions[side]);
    if (pending.length === 0) {
      battle.state = resolve(battle.state, battle.secrets.actions);
      battle.secrets.actions = {};
    }
    return battle;
  });
}

/** Vista para el navegador: sin tokens ni acciones pendientes, y sin los ataques del rival. */
export async function getBattleView(id: string, token: string | undefined): Promise<BattleView | null> {
  const battle = await getBattleStore().get(id);
  if (!battle) return null;

  const role = roleOf(battle, token);
  const state = structuredClone(battle.state);
  const hidden: Side[] = role === "spectator" ? ["host", "guest"] : [OTHER[role]];
  for (const side of hidden) {
    state.players[side]?.team.forEach((pokemon) => (pokemon.moves = []));
  }

  return {
    state,
    role,
    submitted: {
      host: Boolean(battle.secrets.actions.host),
      guest: Boolean(battle.secrets.actions.guest),
    },
    realtime: realtimeEnabled(),
  };
}
