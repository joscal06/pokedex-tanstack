import "server-only";

import { API_URL, artworkUrl, request } from "@/lib/pokeapi/api";
import type { MoveResponse, PokemonResponse } from "@/lib/pokeapi/types";
import type { BattleMove, BattlePokemon, StatKey, Status } from "./types";

const LEVEL = 50;
const MAX_MOVES = 4;

/** Ataques que el motor no modela bien (carga en dos turnos, autodestrucción, etc.). */
const EXCLUDED_MOVES = new Set([
  "explosion", "self-destruct", "misty-explosion", "memento", "final-gambit",
  "hyper-beam", "giga-impact", "blast-burn", "hydro-cannon", "frenzy-plant", "rock-wrecker",
  "roar-of-time", "prismatic-laser", "eternabeam", "meteor-assault",
  "solar-beam", "solar-blade", "sky-attack", "skull-bash", "razor-wind", "meteor-beam",
  "fly", "dig", "dive", "bounce", "phantom-force", "shadow-force", "sky-drop", "geomancy",
  "outrage", "thrash", "petal-dance", "raging-fury", "rollout", "ice-ball", "uproar",
  "focus-punch", "dream-eater", "belch", "last-resort", "future-sight", "doom-desire",
  "snore", "sleep-talk", "fling", "natural-gift", "spit-up", "synchronoise", "steel-beam",
  "mind-blown", "burn-up", "double-shock", "fake-out", "first-impression", "counter",
  "mirror-coat", "metal-burst", "bide", "endeavor", "struggle",
]);

const DAMAGE_CATEGORIES = new Set([
  "damage", "damage-ailment", "damage-lower", "damage-raise", "damage-heal",
]);

const AILMENTS: Record<string, Status> = {
  burn: "brn",
  paralysis: "par",
  poison: "psn",
  freeze: "frz",
};

const STATS: Record<string, StatKey> = {
  attack: "atk",
  defense: "def",
  "special-attack": "spa",
  "special-defense": "spd",
  speed: "spe",
};

/** Forcejeo: el último recurso de un Pokémon sin ataques que hagan daño. */
const STRUGGLE: BattleMove = {
  id: 165, name: "struggle", label: "Forcejeo", type: "typeless", category: "physical",
  power: 50, accuracy: null, priority: 0, critStage: 0, drain: -25, minHits: 1, maxHits: 1,
  flinchChance: 0, ailment: null, ailmentChance: 0, statChanges: [], statChance: 0, statTarget: "target",
};

/** Ejecuta `tasks` con un máximo de `limit` peticiones simultáneas a PokéAPI. */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }),
  );
  return results;
}

function toBattleMove(move: MoveResponse): BattleMove | null {
  const meta = move.meta;
  if (!meta || !move.power || EXCLUDED_MOVES.has(move.name)) return null;
  if (!DAMAGE_CATEGORIES.has(meta.category.name)) return null;
  if (move.damage_class.name === "status") return null;

  return {
    id: move.id,
    name: move.name,
    label: move.names.find((n) => n.language.name === "es")?.name ?? move.name.replace(/-/g, " "),
    type: move.type.name,
    category: move.damage_class.name === "physical" ? "physical" : "special",
    power: move.power,
    accuracy: move.accuracy,
    priority: move.priority,
    critStage: meta.crit_rate,
    drain: meta.drain,
    minHits: meta.min_hits ?? 1,
    maxHits: meta.max_hits ?? 1,
    flinchChance: meta.flinch_chance,
    ailment: AILMENTS[meta.ailment.name] ?? null,
    ailmentChance: meta.ailment_chance,
    statChanges: move.stat_changes
      .filter((s) => STATS[s.stat.name])
      .map((s) => ({ stat: STATS[s.stat.name], change: s.change })),
    statChance: meta.stat_chance,
    statTarget: meta.category.name === "damage-raise" ? "self" : "target",
  };
}

/** Puntaje aproximado de un ataque para este Pokémon. */
function score(move: BattleMove, pokemon: { types: string[]; atk: number; spa: number }): number {
  const hits = (move.minHits + move.maxHits) / 2;
  const stab = pokemon.types.includes(move.type) ? 1.5 : 1;
  const stat = move.category === "physical" ? pokemon.atk : pokemon.spa;
  const accuracy = (move.accuracy ?? 100) / 100;
  const recoil = move.drain < 0 ? 0.85 : 1;
  return move.power * hits * stab * stat * accuracy * recoil;
}

/**
 * Elige 4 ataques como lo haría un jugador: el mejor de cada tipo propio
 * (STAB) y luego ataques de tipos distintos para tener cobertura.
 */
function pickMoves(candidates: BattleMove[], pokemon: { types: string[]; atk: number; spa: number }) {
  const ranked = [...candidates].sort((a, b) => score(b, pokemon) - score(a, pokemon));
  const chosen: BattleMove[] = [];
  const add = (move: BattleMove | undefined) => {
    if (move && chosen.length < MAX_MOVES && !chosen.includes(move)) chosen.push(move);
  };

  for (const type of pokemon.types) add(ranked.find((m) => m.type === type));
  for (const move of ranked) {
    if (!chosen.some((m) => m.type === move.type)) add(move);
  }
  for (const move of ranked) add(move);

  return chosen.length > 0 ? chosen : [STRUGGLE];
}

function battleStat(base: number, isHp: boolean): number {
  // IV 31, EV 0, naturaleza neutra.
  const core = Math.floor(((2 * base + 31) * LEVEL) / 100);
  return isHp ? core + LEVEL + 10 : core + 5;
}

export async function buildBattlePokemon(name: string, slot: number): Promise<BattlePokemon> {
  const pokemon = await request<PokemonResponse>(`${API_URL}/pokemon/${encodeURIComponent(name)}`);

  const base = Object.fromEntries(pokemon.stats.map((s) => [s.stat.name, s.base_stat]));
  const stats = {
    hp: battleStat(base.hp, true),
    atk: battleStat(base.attack, false),
    def: battleStat(base.defense, false),
    spa: battleStat(base["special-attack"], false),
    spd: battleStat(base["special-defense"], false),
    spe: battleStat(base.speed, false),
  };
  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);

  const levelUpMoves = pokemon.moves
    .filter((m) => m.version_group_details.some((d) => d.move_learn_method.name === "level-up"))
    .map((m) => m.move.url);
  const moves = await mapLimited(levelUpMoves, 8, (url) => request<MoveResponse>(url));
  const candidates = moves.map(toBattleMove).filter((m): m is BattleMove => m !== null);

  const showdown = pokemon.sprites.other?.showdown;
  const front = showdown?.front_default ?? pokemon.sprites.front_default ?? artworkUrl(pokemon.id);

  return {
    slot,
    id: pokemon.id,
    name: pokemon.name,
    types,
    level: LEVEL,
    sprite: front,
    backSprite: showdown?.back_default ?? pokemon.sprites.back_default ?? front,
    stats,
    hp: stats.hp,
    status: null,
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: pickMoves(candidates, { types, atk: stats.atk, spa: stats.spa }),
  };
}

export function buildTeam(names: string[]): Promise<BattlePokemon[]> {
  return Promise.all(names.map((name, slot) => buildBattlePokemon(name, slot)));
}
