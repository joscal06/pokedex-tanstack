"use client";

import Image from "next/image";
import Link from "next/link";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { EvolutionNode, PokemonDetail } from "@/lib/pokeapi/types";
import { pokemonQueries } from "@/lib/query/pokemon-queries";
import { formatId, formatName, STAT_LABELS, TYPE_COLORS } from "@/lib/format";
import { TypeBadge } from "./type-badge";

const MAX_STAT = 255;

export function PokemonDetailView({ name }: { name: string }) {
  // Si el usuario pasó el mouse por la tarjeta, la consulta ya está en caché y
  // se renderiza al instante; si no, suspende hasta que llegue el streaming
  // del prefetch iniciado en el servidor.
  const { data: pokemon } = useSuspenseQuery(pokemonQueries.detail(name));
  const accent = TYPE_COLORS[pokemon.types[0]] ?? "#e11d48";

  return (
    <article className="space-y-6">
      <section
        className="grid gap-6 overflow-hidden rounded-3xl bg-white p-6 shadow-sm md:grid-cols-2 dark:bg-slate-900"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 40%, ${accent}33, transparent 60%)`,
        }}
      >
        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <Image
            src={pokemon.image}
            alt={formatName(pokemon.name)}
            fill
            preload
            sizes="(max-width: 768px) 90vw, 384px"
            className="object-contain drop-shadow-xl"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="font-mono text-sm text-slate-400">
              {formatId(pokemon.id)}
            </p>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
              {formatName(pokemon.name)}
            </h1>
            {pokemon.genus && (
              <p className="text-slate-500 dark:text-slate-400">{pokemon.genus}</p>
            )}
          </div>

          <div className="flex gap-2">
            {pokemon.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>

          {pokemon.description && (
            <p className="leading-relaxed text-slate-700 dark:text-slate-300">
              {pokemon.description}
            </p>
          )}

          <dl className="grid grid-cols-3 gap-3 text-center">
            <Fact label="Altura" value={`${pokemon.height} m`} />
            <Fact label="Peso" value={`${pokemon.weight} kg`} />
            <Fact label="Exp. base" value={pokemon.baseExperience ?? "—"} />
          </dl>

          <Abilities pokemon={pokemon} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Stats pokemon={pokemon} accent={accent} />
        <Sprites pokemon={pokemon} />
      </div>

      <Evolutions stages={pokemon.evolutionStages} currentId={pokemon.id} />
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800/70">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-lg font-semibold text-slate-800 dark:text-slate-100">
        {value}
      </dd>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-900">
      <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Abilities({ pokemon }: { pokemon: PokemonDetail }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
        Habilidades
      </h2>
      <ul className="flex flex-wrap gap-2">
        {pokemon.abilities.map((ability) => (
          <li
            key={ability.name}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200"
          >
            {formatName(ability.name)}
            {ability.isHidden && (
              <span className="ml-1 text-xs text-slate-400">(oculta)</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stats({ pokemon, accent }: { pokemon: PokemonDetail; accent: string }) {
  const total = pokemon.stats.reduce((sum, stat) => sum + stat.value, 0);

  return (
    <Panel title="Estadísticas base">
      <ul className="space-y-3">
        {pokemon.stats.map((stat) => (
          <li key={stat.name} className="grid grid-cols-[6rem_2.5rem_1fr] items-center gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {STAT_LABELS[stat.name] ?? stat.name}
            </span>
            <span className="text-right font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
              {stat.value}
            </span>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (stat.value / MAX_STAT) * 100)}%`,
                  backgroundColor: accent,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-right text-sm text-slate-500 dark:text-slate-400">
        Total: <span className="font-semibold text-slate-800 dark:text-slate-100">{total}</span>
      </p>
    </Panel>
  );
}

function Sprites({ pokemon }: { pokemon: PokemonDetail }) {
  return (
    <Panel title="Sprites">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {pokemon.sprites.map((sprite) => (
          <li
            key={sprite.label}
            className="flex flex-col items-center rounded-2xl bg-slate-50 p-2 dark:bg-slate-800/70"
          >
            <div className="relative aspect-square w-full">
              <Image
                src={sprite.url}
                alt={`${formatName(pokemon.name)} – ${sprite.label}`}
                fill
                sizes="120px"
                className="object-contain [image-rendering:pixelated]"
                unoptimized={sprite.url.endsWith(".gif")}
              />
            </div>
            <span className="mt-1 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {sprite.label}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Evolutions({
  stages,
  currentId,
}: {
  stages: EvolutionNode[][];
  currentId: number;
}) {
  const queryClient = useQueryClient();

  if (stages.length <= 1) {
    return (
      <Panel title="Cadena evolutiva">
        <p className="text-slate-500 dark:text-slate-400">
          Este Pokémon no evoluciona.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Cadena evolutiva">
      <div className="flex flex-col items-center gap-4 md:flex-row md:justify-center">
        {stages.map((stage, index) => (
          <div key={index} className="flex flex-col items-center gap-4 md:flex-row">
            {index > 0 && (
              <span className="text-2xl text-slate-300 md:rotate-0 dark:text-slate-600" aria-hidden>
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </span>
            )}
            <ul className="flex flex-wrap justify-center gap-3">
              {stage.map((node) => (
                <li key={node.id}>
                  <Link
                    href={`/pokemon/${node.name}`}
                    onMouseEnter={() =>
                      void queryClient.prefetchQuery(pokemonQueries.detail(node.name))
                    }
                    className={`flex w-32 flex-col items-center rounded-2xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      node.id === currentId
                        ? "bg-red-50 ring-2 ring-red-400 dark:bg-red-950/40"
                        : ""
                    }`}
                  >
                    <div className="relative size-24">
                      <Image
                        src={node.image}
                        alt={formatName(node.name)}
                        fill
                        sizes="96px"
                        className="object-contain"
                      />
                    </div>
                    <span className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {formatName(node.name)}
                    </span>
                    {node.condition && (
                      <span className="text-center text-xs text-slate-500 dark:text-slate-400">
                        {node.condition}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Panel>
  );
}
