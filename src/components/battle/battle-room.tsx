"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { submitBattleAction } from "@/app/batalla/actions";
import { OTHER, requiredSides } from "@/lib/battle/engine";
import { typeEffectiveness } from "@/lib/battle/type-chart";
import type {
  BattleAction,
  BattleEvent,
  BattleMove,
  BattlePokemon,
  BattleView,
  Side,
  SideSnapshot,
  Status,
} from "@/lib/battle/types";
import { useBattleRealtime } from "@/lib/battle/use-battle-realtime";
import { battleKeys, battleQueries } from "@/lib/query/battle-queries";
import { formatName, TYPE_COLORS, TYPE_LABELS } from "@/lib/format";
import { ShareLink } from "./share-link";
import { TeamPicker } from "./team-picker";
import { TypeBadge } from "../type-badge";

const EVENT_DELAY_MS = 950;

const STATUS_BADGES: Record<Exclude<Status, null>, { label: string; color: string }> = {
  brn: { label: "QUE", color: "#e62829" },
  par: { label: "PAR", color: "#e0ac00" },
  psn: { label: "ENV", color: "#9141cb" },
  frz: { label: "CON", color: "#3dcef3" },
};

export function BattleRoom({ id }: { id: string }) {
  const { data: view, error } = useQuery(battleQueries.view(id));
  useBattleRealtime(id, Boolean(view?.realtime));

  if (!view) {
    return (
      <p className="rounded-2xl bg-red-50 p-6 text-center text-red-700 dark:bg-red-950/40 dark:text-red-300">
        {error?.message ?? "Cargando la sala…"}
      </p>
    );
  }

  const { state, role } = view;

  if (state.phase === "waiting") {
    if (role === "host") {
      return (
        <section className="mx-auto max-w-2xl space-y-5 rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
          <p className="text-5xl">⏳</p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Esperando a tu rival</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Comparte este enlace. Cuando tu rival elija sus {state.size} Pokémon, la batalla empezará
            aquí mismo, sin recargar la página.
          </p>
          <ShareLink id={id} hostName={state.players.host.name} />
          <TeamStrip team={state.players.host.team} />
        </section>
      );
    }
    return (
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-red-600 to-orange-500 p-6 text-white shadow">
          <p className="text-sm uppercase tracking-wide opacity-80">Desafío recibido</p>
          <h1 className="text-2xl font-bold">¡{state.players.host.name} te reta a una batalla Pokémon!</h1>
          <p className="mt-1 opacity-90">Elige {state.size} Pokémon para aceptar.</p>
        </section>
        <TeamPicker mode="join" battleId={id} size={state.size} hostName={state.players.host.name} />
      </div>
    );
  }

  return <BattleScreen view={view} />;
}

// ---------- Pantalla de batalla ----------

function BattleScreen({ view }: { view: BattleView }) {
  const { state, role } = view;
  const me: Side = role === "guest" ? "guest" : "host";
  const opponent = OTHER[me];

  const events = useMemo(() => state.log.flatMap((turn) => turn.events), [state.log]);
  // Al abrir la sala no se repite lo que ya pasó; solo se animan los eventos nuevos.
  const [cursor, setCursor] = useState(events.length);
  const animating = cursor < events.length;

  useEffect(() => {
    if (cursor >= events.length) return;
    const timer = setTimeout(() => setCursor((c) => c + 1), cursor === 0 ? 300 : EVENT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [cursor, events.length]);

  const current: BattleEvent | undefined = cursor > 0 ? events[cursor - 1] : undefined;
  const snapshot = current?.snapshot;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>
          {state.players.host.name} vs {state.players.guest?.name} · {state.size} vs {state.size}
        </span>
        <span>{role === "spectator" ? "👀 Modo espectador" : `Turno ${Math.max(1, state.turn)}`}</span>
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-sky-200 via-sky-100 to-lime-200 p-4 shadow-inner sm:p-6 dark:from-slate-800 dark:via-slate-800 dark:to-emerald-950">
        <div className="grid grid-cols-2 items-end gap-4">
          <InfoBox view={view} side={opponent} snapshot={snapshot?.[opponent]} />
          <Field view={view} side={opponent} snapshot={snapshot?.[opponent]} current={current} cursor={cursor} back={false} />
          <Field view={view} side={me} snapshot={snapshot?.[me]} current={current} cursor={cursor} back />
          <InfoBox view={view} side={me} snapshot={snapshot?.[me]} showNumbers={role !== "spectator"} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <p className="min-h-16 rounded-2xl border-4 border-slate-700 bg-white px-5 py-4 text-lg font-semibold text-slate-800 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100">
            {animating || state.phase === "finished"
              ? (current?.text ?? "…")
              : promptFor(view, me)}
          </p>
          <ActionPanel view={view} me={me} animating={animating} />
        </div>
        <BattleLog events={events.slice(0, cursor)} />
      </div>
    </div>
  );
}

function promptFor(view: BattleView, me: Side): string {
  const player = view.state.players[me];
  if (view.role === "spectator" || !player) return "Observando la batalla…";
  if (player.mustSwitch) return "¡Tu Pokémon se debilitó! Elige al siguiente.";
  return `¿Qué debería hacer ${formatName(player.team[player.active].name)}?`;
}

function liveSnapshot(view: BattleView, side: Side): SideSnapshot | null {
  const player = view.state.players[side];
  if (!player) return null;
  return { active: player.active, hp: player.team.map((p) => p.hp), status: player.team.map((p) => p.status) };
}

function Field({
  view,
  side,
  snapshot,
  current,
  cursor,
  back,
}: {
  view: BattleView;
  side: Side;
  snapshot: SideSnapshot | null | undefined;
  current: BattleEvent | undefined;
  cursor: number;
  back: boolean;
}) {
  const player = view.state.players[side];
  const snap = snapshot ?? liveSnapshot(view, side);
  if (!player || !snap) return <div />;

  const pokemon = player.team[snap.active];
  const fainted = snap.hp[snap.active] <= 0;
  const involved = current?.side === side;
  const animation =
    involved && current?.kind === "hit"
      ? "animate-[battle-shake_0.45s_ease-in-out]"
      : involved && current?.kind === "move"
        ? back
          ? "animate-[battle-lunge-up_0.45s_ease-out]"
          : "animate-[battle-lunge-down_0.45s_ease-out]"
        : involved && current?.kind === "switch"
          ? "animate-[battle-enter_0.5s_ease-out]"
          : "";

  return (
    <div className={`flex ${back ? "justify-start" : "justify-end"}`}>
      <div className="relative flex h-32 w-40 items-end justify-center sm:h-44 sm:w-56">
        <div className="absolute bottom-0 h-6 w-36 rounded-[50%] bg-black/10 sm:w-48 dark:bg-white/10" />
        <div
          key={`${side}-${cursor}`}
          className={`relative transition-all duration-500 ${animation} ${fainted ? "translate-y-6 opacity-0" : ""}`}
        >
          <Image
            src={back ? pokemon.backSprite : pokemon.sprite}
            alt={formatName(pokemon.name)}
            width={back ? 140 : 120}
            height={back ? 140 : 120}
            unoptimized
            className="h-auto max-h-24 w-auto object-contain [image-rendering:pixelated] sm:max-h-32"
            style={{ transform: `scale(${back ? 1.4 : 1.3})`, transformOrigin: "bottom center" }}
          />
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  view,
  side,
  snapshot,
  showNumbers = false,
}: {
  view: BattleView;
  side: Side;
  snapshot: SideSnapshot | null | undefined;
  showNumbers?: boolean;
}) {
  const player = view.state.players[side];
  const snap = snapshot ?? liveSnapshot(view, side);
  if (!player || !snap) return <div />;

  const pokemon = player.team[snap.active];
  const hp = snap.hp[snap.active];
  const status = snap.status[snap.active];
  const ratio = hp / pokemon.stats.hp;
  const color = ratio > 0.5 ? "bg-emerald-500" : ratio > 0.2 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className="self-center rounded-2xl border-2 border-slate-700 bg-white/90 px-3 py-2 shadow sm:px-4 dark:border-slate-500 dark:bg-slate-900/90">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-bold text-slate-900 dark:text-white">{formatName(pokemon.name)}</span>
        <span className="text-xs font-semibold text-slate-500">Nv. {pokemon.level}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[10px] font-bold text-amber-600">PS</span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          {status && (
            <span
              className="rounded px-1.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: STATUS_BADGES[status].color }}
            >
              {STATUS_BADGES[status].label}
            </span>
          )}
          <span className="text-[11px] text-slate-500">{player.name}</span>
        </div>
        {showNumbers && (
          <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
            {hp}/{pokemon.stats.hp}
          </span>
        )}
      </div>
      <TeamBalls hp={snap.hp} />
    </div>
  );
}

function TeamBalls({ hp }: { hp: number[] }) {
  if (hp.length <= 1) return null;
  return (
    <div className="mt-1 flex gap-1" aria-label={`${hp.filter((h) => h > 0).length} Pokémon en pie`}>
      {hp.map((value, i) => (
        <span
          key={i}
          className={`size-2.5 rounded-full border border-slate-700 ${value > 0 ? "bg-red-500" : "bg-slate-300 dark:bg-slate-600"}`}
        />
      ))}
    </div>
  );
}

// ---------- Acciones ----------

function ActionPanel({ view, me, animating }: { view: BattleView; me: Side; animating: boolean }) {
  const { state, role, submitted } = view;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [isSending, startTransition] = useTransition();

  // El resultado y los botones esperan a que termine la animación del turno.
  if (animating) return null;
  if (state.phase === "finished") return <Result view={view} me={me} />;
  if (role === "spectator") {
    return <Notice>Estás viendo esta batalla como espectador.</Notice>;
  }

  const player = state.players[me]!;
  const rival = state.players[OTHER[me]]!;
  const mustAct = requiredSides(state).includes(me);

  if (!mustAct) return <Notice>Esperando a que {rival.name} elija a su siguiente Pokémon…</Notice>;
  if (submitted[me]) {
    return (
      <Notice>
        Esperando a {rival.name}…{" "}
        {submitted[OTHER[me]] ? "" : <span className="opacity-70">(todavía está eligiendo)</span>}
      </Notice>
    );
  }

  const send = (action: BattleAction) => {
    setError(null);
    startTransition(async () => {
      const result = await submitBattleAction(state.id, action);
      if (result?.error) setError(result.error);
      await queryClient.invalidateQueries({ queryKey: battleKeys.view(state.id) });
    });
  };

  const active = player.team[player.active];
  const rivalActive = rival.team[rival.active];
  const bench = player.team.filter((p) => p.slot !== player.active);

  return (
    <div className="space-y-3">
      {state.phase === "choose" && (
        <div className="grid grid-cols-2 gap-2">
          {active.moves.map((move, index) => (
            <MoveButton
              key={move.id}
              move={move}
              target={rivalActive}
              disabled={isSending}
              onClick={() => send({ kind: "move", index })}
            />
          ))}
        </div>
      )}

      {bench.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            {player.mustSwitch ? "Elige a tu siguiente Pokémon" : "Cambiar de Pokémon"}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {bench.map((pokemon) => (
              <button
                key={pokemon.slot}
                disabled={isSending || pokemon.hp <= 0}
                onClick={() => send({ kind: "switch", slot: pokemon.slot })}
                className="flex items-center gap-2 rounded-xl bg-white p-2 text-left shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-900 dark:hover:bg-red-950/40"
              >
                <Image src={pokemon.sprite} alt="" width={40} height={40} unoptimized className="[image-rendering:pixelated]" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {formatName(pokemon.name)}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {pokemon.hp > 0 ? `${pokemon.hp}/${pokemon.stats.hp}` : "Debilitado"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function MoveButton({
  move,
  target,
  disabled,
  onClick,
}: {
  move: BattleMove;
  target: BattlePokemon;
  disabled: boolean;
  onClick: () => void;
}) {
  const effectiveness = typeEffectiveness(move.type, target.types);
  const hint =
    effectiveness === 0 ? "No afecta" : effectiveness > 1 ? "Muy eficaz" : effectiveness < 1 ? "Poco eficaz" : null;
  const color = TYPE_COLORS[move.type] ?? "#68a090";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="rounded-2xl border-b-4 px-4 py-3 text-left text-white shadow transition hover:brightness-110 active:translate-y-0.5 disabled:opacity-50"
      style={{ backgroundColor: color, borderColor: "rgb(0 0 0 / 0.25)" }}
    >
      <span className="block font-bold drop-shadow">{move.label}</span>
      <span className="flex flex-wrap items-center gap-x-2 text-[11px] opacity-90">
        <span>{TYPE_LABELS[move.type] ?? "Sin tipo"}</span>
        <span>· {move.category === "physical" ? "Físico" : "Especial"}</span>
        <span>· Pot. {move.power}</span>
        <span>· Prec. {move.accuracy ?? "—"}</span>
        {hint && <span className="rounded bg-black/25 px-1 font-semibold">{hint}</span>}
      </span>
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl bg-white p-4 text-center text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
      {children}
    </p>
  );
}

function Result({ view, me }: { view: BattleView; me: Side }) {
  const { winner, players } = view.state;
  const title =
    winner === "draw"
      ? "¡Empate!"
      : view.role === "spectator"
        ? `¡${players[winner as Side]?.name} ganó!`
        : winner === me
          ? "¡Ganaste la batalla! 🏆"
          : "Perdiste esta vez…";

  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-sm dark:bg-slate-900">
      <p className="text-2xl font-bold text-slate-900 dark:text-white">{title}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href="/batalla" className="rounded-full bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700">
          Nueva batalla
        </Link>
        <Link
          href="/"
          className="rounded-full border border-slate-300 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Volver a la Pokédex
        </Link>
      </div>
    </div>
  );
}

// ---------- Registro y equipo ----------

function BattleLog({ events }: { events: BattleEvent[] }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  return (
    <aside className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <h2 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">Registro de la batalla</h2>
      <ol ref={ref} className="max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
        {events.map((event, i) => (
          <li
            key={i}
            className={`${
              event.kind === "move"
                ? "font-semibold text-slate-800 dark:text-slate-100"
                : event.kind === "faint"
                  ? "font-semibold text-red-600"
                  : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {event.text}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function TeamStrip({ team }: { team: BattlePokemon[] }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-500">Tu equipo</p>
      <ul className="flex flex-wrap justify-center gap-3">
        {team.map((pokemon) => (
          <li key={pokemon.slot} className="flex flex-col items-center rounded-2xl bg-slate-50 p-2 dark:bg-slate-800">
            <Image src={pokemon.sprite} alt="" width={56} height={56} unoptimized className="[image-rendering:pixelated]" />
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{formatName(pokemon.name)}</span>
            <span className="mt-1 flex gap-1">
              {pokemon.types.map((type) => (
                <TypeBadge key={type} type={type} size="sm" />
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
