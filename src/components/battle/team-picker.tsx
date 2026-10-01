"use client";

import { useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createBattleAction, joinBattleAction } from "@/app/batalla/actions";
import { TEAM_SIZES, type TeamSize } from "@/lib/battle/types";
import type { PokemonSummary } from "@/lib/pokeapi/types";
import { battleKeys } from "@/lib/query/battle-queries";
import { pokemonQueries } from "@/lib/query/pokemon-queries";
import { formatId, formatName } from "@/lib/format";

const MAX_RESULTS = 60;

type TeamPickerProps =
  | { mode: "create" }
  | { mode: "join"; battleId: string; size: TeamSize; hostName: string };

export function TeamPicker(props: TeamPickerProps) {
  const queryClient = useQueryClient();
  const { data: index = [], isPending, isError } = useQuery(pokemonQueries.index());

  const [size, setSize] = useState<TeamSize>(props.mode === "join" ? props.size : 3);
  const [team, setTeam] = useState<PokemonSummary[]>([]);
  const [search, setSearch] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startTransition] = useTransition();

  const results = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matches = term
      ? index.filter((p) => p.name.includes(term.replace(/\s+/g, "-")) || String(p.id) === term)
      : index;
    return matches.slice(0, MAX_RESULTS);
  }, [index, search]);

  const toggle = (pokemon: PokemonSummary) => {
    setError(null);
    setTeam((current) => {
      if (current.some((p) => p.id === pokemon.id)) return current.filter((p) => p.id !== pokemon.id);
      if (current.length >= size) return current;
      return [...current, pokemon];
    });
  };

  const changeSize = (next: TeamSize) => {
    setSize(next);
    setTeam((current) => current.slice(0, next));
  };

  const randomTeam = () => {
    const pool = [...index];
    const picked: PokemonSummary[] = [];
    while (picked.length < size && pool.length > 0) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    setTeam(picked);
    setError(null);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const names = team.map((p) => p.name);
      const result =
        props.mode === "create"
          ? await createBattleAction({ size, names, playerName })
          : await joinBattleAction({ id: props.battleId, names, playerName });

      if (result?.error) {
        setError(result.error);
      } else if (props.mode === "join") {
        await queryClient.invalidateQueries({ queryKey: battleKeys.view(props.battleId) });
      }
    });
  };

  const ready = team.length === size;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-3xl bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-900">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tu nombre de entrenador</span>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={20}
            placeholder={props.mode === "create" ? "Jugador 1" : "Jugador 2"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </label>

        <div className="space-y-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Tamaño del equipo</span>
          {props.mode === "create" ? (
            <div className="flex gap-2">
              {TEAM_SIZES.map((option) => (
                <button
                  key={option}
                  onClick={() => changeSize(option)}
                  className={`flex-1 rounded-xl px-4 py-2 font-semibold transition ${
                    size === option
                      ? "bg-red-600 text-white shadow"
                      : "bg-slate-100 text-slate-700 hover:bg-red-50 dark:bg-slate-800 dark:text-slate-200"
                  }`}
                >
                  {option} vs {option}
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-100 px-4 py-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {props.hostName} eligió una batalla de <strong>{size} vs {size}</strong>.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Tu equipo ({team.length}/{size})
          </h2>
          <button
            onClick={randomTeam}
            disabled={isPending}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            🎲 Equipo aleatorio
          </button>
        </div>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {Array.from({ length: size }, (_, i) => team[i]).map((pokemon, i) => (
            <li key={pokemon?.id ?? `empty-${i}`}>
              {pokemon ? (
                <button
                  onClick={() => toggle(pokemon)}
                  title="Quitar del equipo"
                  className="flex w-full flex-col items-center rounded-2xl bg-red-50 p-2 ring-2 ring-red-300 transition hover:bg-red-100 dark:bg-red-950/40 dark:ring-red-800"
                >
                  <Image src={pokemon.image} alt="" width={64} height={64} unoptimized className="[image-rendering:pixelated]" />
                  <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {formatName(pokemon.name)}
                  </span>
                </button>
              ) : (
                <div className="flex h-[92px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-2xl text-slate-300 dark:border-slate-700 dark:text-slate-600">
                  ?
                </div>
              )}
            </li>
          ))}
        </ul>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={!ready || isSubmitting}
          className="mt-4 w-full rounded-full bg-red-600 px-6 py-3 font-bold text-white shadow transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting
            ? "Preparando a tus Pokémon…"
            : props.mode === "create"
              ? "Crear sala de batalla"
              : "¡Aceptar el desafío!"}
        </button>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o número…"
          className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-900 outline-none focus:border-red-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />

        {isPending && <p className="text-slate-500">Cargando Pokémon…</p>}
        {isError && <p className="text-red-600">No se pudo cargar la lista de Pokémon.</p>}

        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {results.map((pokemon) => {
            const selected = team.some((p) => p.id === pokemon.id);
            const full = !selected && team.length >= size;
            return (
              <li key={pokemon.id}>
                <button
                  onClick={() => toggle(pokemon)}
                  disabled={full}
                  aria-pressed={selected}
                  className={`flex w-full flex-col items-center rounded-2xl p-2 transition disabled:opacity-35 ${
                    selected
                      ? "bg-red-50 ring-2 ring-red-400 dark:bg-red-950/40"
                      : "bg-slate-50 hover:bg-red-50 dark:bg-slate-800/70 dark:hover:bg-red-950/40"
                  }`}
                >
                  <Image src={pokemon.image} alt="" width={64} height={64} unoptimized loading="lazy" className="[image-rendering:pixelated]" />
                  <span className="font-mono text-[10px] text-slate-400">{formatId(pokemon.id)}</span>
                  <span className="w-full truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {formatName(pokemon.name)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {!isPending && results.length === 0 && (
          <p className="text-center text-slate-500">No hay Pokémon con ese nombre.</p>
        )}
      </section>
    </div>
  );
}
