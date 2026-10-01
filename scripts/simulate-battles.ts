/**
 * Prueba de humo del motor: simula batallas aleatorias y verifica invariantes.
 * Uso: npx tsx scripts/simulate-battles.ts
 */
import { requiredSides, resolve, startBattle, validateAction } from "../src/lib/battle/engine";
import { Rng } from "../src/lib/battle/rng";
import type { BattleAction, BattleMove, BattlePokemon, BattleState, Side, TeamSize } from "../src/lib/battle/types";

const TYPES = ["fire", "water", "grass", "electric", "ground", "flying", "ghost", "normal", "dragon", "fairy", "steel"];
const rng = new Rng(42);

function move(i: number): BattleMove {
  const type = TYPES[rng.int(0, TYPES.length - 1)];
  return {
    id: i, name: `m${i}`, label: `Ataque ${i}`, type, category: rng.chance(50) ? "physical" : "special",
    power: rng.int(20, 120), accuracy: rng.chance(20) ? null : rng.int(70, 100), priority: rng.chance(10) ? 1 : 0,
    critStage: rng.chance(10) ? 1 : 0, drain: rng.chance(10) ? 50 : rng.chance(10) ? -33 : 0,
    minHits: 1, maxHits: rng.chance(10) ? 5 : 1, flinchChance: rng.chance(10) ? 30 : 0,
    ailment: rng.chance(15) ? (["brn", "par", "psn", "frz"] as const)[rng.int(0, 3)] : null, ailmentChance: 30,
    statChanges: rng.chance(15) ? [{ stat: "def", change: -1 }] : [], statChance: 50,
    statTarget: rng.chance(50) ? "self" : "target",
  };
}

function mon(slot: number): BattlePokemon {
  const hp = rng.int(100, 200);
  return {
    slot, id: slot + 1, name: `poke-${slot}`, types: [TYPES[rng.int(0, TYPES.length - 1)]], level: 50,
    sprite: "", backSprite: "",
    stats: { hp, atk: rng.int(50, 150), def: rng.int(50, 150), spa: rng.int(50, 150), spd: rng.int(50, 150), spe: rng.int(50, 150) },
    hp, status: null, stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: Array.from({ length: 4 }, (_, i) => move(slot * 10 + i)),
  };
}

function pickAction(state: BattleState, side: Side): BattleAction {
  const player = state.players[side]!;
  const bench = player.team.filter((p) => p.slot !== player.active && p.hp > 0);
  if (state.phase === "switch" || (bench.length > 0 && rng.chance(10))) {
    return { kind: "switch", slot: bench[rng.int(0, bench.length - 1)].slot };
  }
  return { kind: "move", index: rng.int(0, 3) };
}

let turns = 0;
const results = { host: 0, guest: 0, draw: 0 };
for (let game = 0; game < 500; game++) {
  const size = ([1, 3, 6] as TeamSize[])[game % 3];
  let state: BattleState = {
    id: `g${game}`, size, phase: "waiting", turn: 0, winner: null, log: [], rng: game, createdAt: "",
    players: {
      host: { name: "A", team: Array.from({ length: size }, (_, i) => mon(i)), active: 0, mustSwitch: false },
      guest: { name: "B", team: Array.from({ length: size }, (_, i) => mon(i)), active: 0, mustSwitch: false },
    },
  };
  state = startBattle(state);

  let guard = 0;
  while (state.phase !== "finished") {
    if (++guard > 2000) throw new Error(`La batalla ${game} no termina`);
    const actions: Partial<Record<Side, BattleAction>> = {};
    for (const side of requiredSides(state)) {
      const action = pickAction(state, side);
      const error = validateAction(state, side, action);
      if (error) throw new Error(`Acción inválida generada: ${error}`);
      actions[side] = action;
    }
    state = resolve(state, actions);
    turns++;

    for (const side of ["host", "guest"] as Side[]) {
      for (const p of state.players[side]!.team) {
        if (!Number.isInteger(p.hp) || p.hp < 0 || p.hp > p.stats.hp) throw new Error(`PS fuera de rango: ${p.hp}`);
        if (Object.values(p.stages).some((s) => s < -6 || s > 6)) throw new Error("Etapa fuera de rango");
      }
    }
    if (state.log.some((t) => t.events.some((e) => !e.text || e.text.includes("undefined") || e.text.includes("NaN")))) {
      throw new Error("Texto de evento inválido");
    }
  }
  results[state.winner as keyof typeof results]++;
}

console.log(`500 batallas, ${turns} resoluciones, sin errores. Resultados:`, results);
