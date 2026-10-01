/**
 * Motor de batalla: funciones puras que reciben el estado y devuelven el
 * siguiente. No conoce la base de datos ni la red, por eso se puede probar
 * de forma aislada y el servidor es la única autoridad que lo ejecuta.
 *
 * Mecánicas implementadas (simplificación de las generaciones 5+):
 * fórmula de daño oficial a nivel 50, STAB, tabla de tipos, golpes críticos,
 * variación aleatoria 85–100 %, precisión, prioridad y velocidad, golpes
 * múltiples, drenaje/retroceso, retroceso por miedo, cambios de estadísticas
 * (−6…+6) y estados quemado, paralizado, envenenado y congelado.
 */
import { formatName } from "@/lib/format";
import { Rng } from "./rng";
import { typeEffectiveness } from "./type-chart";
import type {
  BattleAction,
  BattleEvent,
  BattleMove,
  BattlePokemon,
  BattleState,
  EventKind,
  PlayerState,
  Side,
  SideSnapshot,
  StatKey,
  Status,
} from "./types";

export const OTHER: Record<Side, Side> = { host: "guest", guest: "host" };

const STAT_LABELS: Record<StatKey, string> = {
  atk: "Ataque",
  def: "Defensa",
  spa: "Ataque Especial",
  spd: "Defensa Especial",
  spe: "Velocidad",
};

const STATUS_IMMUNITY: Record<Exclude<Status, null>, string[]> = {
  brn: ["fire"],
  par: ["electric"],
  psn: ["poison", "steel"],
  frz: ["ice"],
};

const STATUS_APPLIED: Record<Exclude<Status, null>, string> = {
  brn: "sufrió quemaduras",
  par: "está paralizado. ¡Quizás no pueda moverse!",
  psn: "fue envenenado",
  frz: "fue congelado",
};

// ---------- Utilidades ----------

export function activeOf(player: PlayerState): BattlePokemon {
  return player.team[player.active];
}

function displayName(pokemon: BattlePokemon): string {
  return formatName(pokemon.name);
}

function hasReserves(player: PlayerState): boolean {
  return player.team.some((p, i) => i !== player.active && p.hp > 0);
}

function stageMultiplier(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

function effectiveSpeed(pokemon: BattlePokemon): number {
  const speed = pokemon.stats.spe * stageMultiplier(pokemon.stages.spe);
  return pokemon.status === "par" ? speed / 2 : speed;
}

function critChance(stage: number): number {
  return [100 / 24, 100 / 8, 50, 100][Math.min(stage, 3)];
}

function snapshotOf(player: PlayerState | null): SideSnapshot | null {
  if (!player) return null;
  return {
    active: player.active,
    hp: player.team.map((p) => p.hp),
    status: player.team.map((p) => p.status),
  };
}

/** Acumula eventos con una foto del estado visible después de cada uno. */
class EventLog {
  readonly events: BattleEvent[] = [];
  constructor(private readonly state: BattleState) {}

  push(kind: EventKind, text: string, side?: Side) {
    this.events.push({
      kind,
      text,
      side,
      snapshot: {
        host: snapshotOf(this.state.players.host),
        guest: snapshotOf(this.state.players.guest),
      },
    });
  }
}

// ---------- Fases ----------

/** Qué lados deben enviar una acción en la fase actual. */
export function requiredSides(state: BattleState): Side[] {
  if (state.phase === "choose") return ["host", "guest"];
  if (state.phase === "switch") {
    return (["host", "guest"] as Side[]).filter((side) => state.players[side]?.mustSwitch);
  }
  return [];
}

/** Devuelve un mensaje de error si la acción no es válida, o null. */
export function validateAction(state: BattleState, side: Side, action: BattleAction): string | null {
  const player = state.players[side];
  if (!player) return "La batalla aún no ha comenzado.";
  if (!requiredSides(state).includes(side)) return "No es tu turno de elegir.";

  if (action.kind === "move") {
    if (state.phase === "switch") return "Debes elegir un Pokémon para continuar.";
    if (!Number.isInteger(action.index) || !activeOf(player).moves[action.index]) {
      return "Movimiento no válido.";
    }
    return null;
  }

  const target = player.team[action.slot];
  if (!Number.isInteger(action.slot) || !target) return "Pokémon no válido.";
  if (action.slot === player.active) return "Ese Pokémon ya está en combate.";
  if (target.hp <= 0) return "Ese Pokémon está debilitado.";
  return null;
}

/** Arranca la batalla cuando el segundo jugador se une. */
export function startBattle(state: BattleState): BattleState {
  const next = structuredClone(state);
  const { host, guest } = next.players;
  if (!guest) return next;

  const log = new EventLog(next);
  next.phase = "choose";
  next.turn = 1;
  log.push("info", `¡${guest.name} desafió a ${host.name}!`);
  log.push("switch", `${host.name} envió a ${displayName(activeOf(host))}.`, "host");
  log.push("switch", `${guest.name} envió a ${displayName(activeOf(guest))}.`, "guest");
  next.log.push({ turn: 0, events: log.events });
  return next;
}

/** Resuelve la fase actual cuando ya están todas las acciones requeridas. */
export function resolve(state: BattleState, actions: Partial<Record<Side, BattleAction>>): BattleState {
  return state.phase === "switch" ? resolveForcedSwitches(state, actions) : resolveTurn(state, actions);
}

function resolveForcedSwitches(state: BattleState, actions: Partial<Record<Side, BattleAction>>) {
  const next = structuredClone(state);
  const log = new EventLog(next);

  for (const side of ["host", "guest"] as Side[]) {
    const action = actions[side];
    const player = next.players[side];
    if (!player?.mustSwitch || action?.kind !== "switch") continue;
    switchIn(player, action.slot);
    player.mustSwitch = false;
    log.push("switch", `${player.name} envió a ${displayName(activeOf(player))}.`, side);
  }

  next.phase = "choose";
  next.log.push({ turn: next.turn, events: log.events });
  return next;
}

function switchIn(player: PlayerState, slot: number) {
  // Al salir del combate se pierden los cambios de estadísticas.
  activeOf(player).stages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  player.active = slot;
}

function resolveTurn(state: BattleState, actions: Partial<Record<Side, BattleAction>>): BattleState {
  const next = structuredClone(state);
  const rng = new Rng(next.rng);
  const log = new EventLog(next);
  const players = next.players as Record<Side, PlayerState>;
  const flinched: Partial<Record<Side, boolean>> = {};
  const moved: Partial<Record<Side, boolean>> = {};

  // 1. Los cambios de Pokémon van siempre primero.
  for (const side of ["host", "guest"] as Side[]) {
    const action = actions[side];
    if (action?.kind !== "switch") continue;
    const player = players[side];
    const leaving = displayName(activeOf(player));
    switchIn(player, action.slot);
    log.push("switch", `${player.name} retiró a ${leaving} y envió a ${displayName(activeOf(player))}.`, side);
  }

  // 2. Orden de los ataques: prioridad, luego velocidad, luego azar.
  const attackers = (["host", "guest"] as Side[])
    .filter((side) => actions[side]?.kind === "move")
    .map((side) => {
      const action = actions[side] as { kind: "move"; index: number };
      const pokemon = activeOf(players[side]);
      return { side, move: pokemon.moves[action.index], speed: effectiveSpeed(pokemon), tie: rng.next() };
    })
    .sort((a, b) => b.move.priority - a.move.priority || b.speed - a.speed || a.tie - b.tie);

  for (const { side, move } of attackers) {
    const attacker = activeOf(players[side]);
    const defender = activeOf(players[OTHER[side]]);
    // Si alguno ya se debilitó este turno, el ataque pendiente no se ejecuta.
    if (attacker.hp <= 0 || defender.hp <= 0) continue;
    performMove({ side, attacker, defender, move, rng, log, flinched, moved });
    moved[side] = true;
    if (attacker.hp <= 0) log.push("faint", `¡${displayName(attacker)} se debilitó!`, side);
  }

  // 3. Daño residual de los estados al final del turno.
  for (const side of ["host", "guest"] as Side[]) {
    const pokemon = activeOf(players[side]);
    if (pokemon.hp <= 0) continue;
    const fraction = pokemon.status === "brn" ? 16 : pokemon.status === "psn" ? 8 : 0;
    if (!fraction) continue;
    pokemon.hp = Math.max(0, pokemon.hp - Math.max(1, Math.floor(pokemon.stats.hp / fraction)));
    log.push(
      "hit",
      `${displayName(pokemon)} ${pokemon.status === "brn" ? "se resiente de la quemadura" : "sufre por el veneno"}.`,
      side,
    );
    if (pokemon.hp <= 0) log.push("faint", `¡${displayName(pokemon)} se debilitó!`, side);
  }

  // 4. Debilitados: cambio obligatorio o fin de la batalla.
  const defeated = (["host", "guest"] as Side[]).filter((side) => {
    const player = players[side];
    if (activeOf(player).hp > 0) return false;
    if (hasReserves(player)) {
      player.mustSwitch = true;
      return false;
    }
    return true;
  });

  if (defeated.length === 2) {
    next.winner = "draw";
  } else if (defeated.length === 1) {
    next.winner = OTHER[defeated[0]];
  }

  if (next.winner) {
    next.phase = "finished";
    log.push(
      "info",
      next.winner === "draw" ? "¡La batalla terminó en empate!" : `¡${players[next.winner].name} ganó la batalla!`,
    );
  } else {
    next.phase = players.host.mustSwitch || players.guest.mustSwitch ? "switch" : "choose";
  }

  next.log.push({ turn: next.turn, events: log.events });
  next.turn += 1;
  next.rng = rng.state;
  return next;
}

// ---------- Ataques ----------

interface MoveContext {
  side: Side;
  attacker: BattlePokemon;
  defender: BattlePokemon;
  move: BattleMove;
  rng: Rng;
  log: EventLog;
  flinched: Partial<Record<Side, boolean>>;
  moved: Partial<Record<Side, boolean>>;
}

function performMove(ctx: MoveContext) {
  const { side, attacker, defender, move, rng, log, flinched, moved } = ctx;
  const name = displayName(attacker);
  const target = OTHER[side];

  if (attacker.status === "frz") {
    if (rng.chance(20)) {
      attacker.status = null;
      log.push("status", `¡${name} se descongeló!`, side);
    } else {
      log.push("status", `${name} está congelado. ¡No puede moverse!`, side);
      return;
    }
  }
  if (flinched[side]) {
    log.push("status", `¡${name} retrocedió y no pudo moverse!`, side);
    return;
  }
  if (attacker.status === "par" && rng.chance(25)) {
    log.push("status", `¡${name} está paralizado y no puede moverse!`, side);
    return;
  }

  log.push("move", `¡${name} usó ${move.label}!`, side);

  if (move.accuracy !== null && !rng.chance(move.accuracy)) {
    log.push("miss", `¡El ataque de ${name} falló!`, side);
    return;
  }

  const effectiveness = typeEffectiveness(move.type, defender.types);
  if (effectiveness === 0) {
    log.push("miss", `No afecta a ${displayName(defender)}…`, target);
    return;
  }

  const hits = move.maxHits > 1 ? rng.int(move.minHits, move.maxHits) : 1;
  let total = 0;
  let landed = 0;
  for (let i = 0; i < hits && defender.hp > 0; i++) {
    const crit = rng.chance(critChance(move.critStage));
    const damage = calculateDamage(attacker, defender, move, effectiveness, crit, rng);
    defender.hp = Math.max(0, defender.hp - damage);
    total += damage;
    landed += 1;

    const notes = [crit ? "¡Un golpe crítico!" : null];
    if (i === 0 || hits === 1) {
      notes.push(effectiveness > 1 ? "¡Es muy eficaz!" : effectiveness < 1 ? "No es muy eficaz…" : null);
    }
    const text = notes.filter(Boolean).join(" ");
    const percent = Math.max(1, Math.round((damage / defender.stats.hp) * 100));
    log.push("hit", text || `${displayName(defender)} perdió un ${percent} % de sus PS.`, target);
  }
  if (landed > 1) log.push("info", `¡Golpeó ${landed} veces!`);

  if (move.drain > 0 && attacker.hp > 0 && attacker.hp < attacker.stats.hp) {
    attacker.hp = Math.min(attacker.stats.hp, attacker.hp + Math.max(1, Math.floor((total * move.drain) / 100)));
    log.push("heal", `¡${displayName(defender)} ha perdido energía!`, side);
  } else if (move.drain < 0) {
    attacker.hp = Math.max(0, attacker.hp - Math.max(1, Math.floor((total * -move.drain) / 100)));
    log.push("hit", `${name} también se ha hecho daño.`, side);
  }

  if (defender.hp <= 0) {
    log.push("faint", `¡${displayName(defender)} se debilitó!`, target);
    return;
  }

  applySecondaryEffects(ctx, target);
  if (!moved[target] && move.flinchChance > 0 && rng.chance(move.flinchChance)) {
    flinched[target] = true;
  }
}

function calculateDamage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: BattleMove,
  effectiveness: number,
  crit: boolean,
  rng: Rng,
): number {
  const physical = move.category === "physical";
  let attackStage = attacker.stages[physical ? "atk" : "spa"];
  let defenseStage = defender.stages[physical ? "def" : "spd"];
  if (crit) {
    // Un crítico ignora las bajadas propias y las subidas del rival.
    attackStage = Math.max(0, attackStage);
    defenseStage = Math.min(0, defenseStage);
  }
  const attack = attacker.stats[physical ? "atk" : "spa"] * stageMultiplier(attackStage);
  const defense = defender.stats[physical ? "def" : "spd"] * stageMultiplier(defenseStage);

  const base = Math.floor(
    Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * attack) / defense) / 50,
  ) + 2;

  const modifier =
    (crit ? 1.5 : 1) *
    (rng.int(85, 100) / 100) *
    (attacker.types.includes(move.type) ? 1.5 : 1) *
    effectiveness *
    (physical && attacker.status === "brn" ? 0.5 : 1);

  return Math.max(1, Math.floor(base * modifier));
}

function applySecondaryEffects(ctx: MoveContext, target: Side) {
  const { side, attacker, defender, move, rng, log } = ctx;

  if (
    move.ailment &&
    defender.status === null &&
    !defender.types.some((t) => STATUS_IMMUNITY[move.ailment as Exclude<Status, null>].includes(t)) &&
    rng.chance(move.ailmentChance || 100)
  ) {
    defender.status = move.ailment;
    log.push("status", `¡${displayName(defender)} ${STATUS_APPLIED[move.ailment]}!`, target);
  }

  if (move.statChanges.length > 0 && rng.chance(move.statChance || 100)) {
    const [pokemon, who] = move.statTarget === "self" ? [attacker, side] : [defender, target];
    for (const { stat, change } of move.statChanges) {
      const before = pokemon.stages[stat];
      pokemon.stages[stat] = Math.max(-6, Math.min(6, before + change));
      if (pokemon.stages[stat] === before) {
        log.push("stat", `¡La ${STAT_LABELS[stat]} de ${displayName(pokemon)} no puede ${change > 0 ? "subir" : "bajar"} más!`, who);
      } else {
        const amount = Math.abs(change) > 1 ? " mucho" : "";
        log.push(
          "stat",
          `¡La ${STAT_LABELS[stat]} de ${displayName(pokemon)} ${change > 0 ? "subió" : "bajó"}${amount}!`,
          who,
        );
      }
    }
  }
}
