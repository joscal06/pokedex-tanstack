"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PokemonSummary } from "@/lib/pokeapi/types";
import { pokemonQueries } from "@/lib/query/pokemon-queries";
import { formatId, formatName } from "@/lib/format";
import { TypeBadge } from "./type-badge";

interface PokemonCardProps {
  pokemon: PokemonSummary;
  priority?: boolean;
}

export function PokemonCard({ pokemon, priority = false }: PokemonCardProps) {
  const queryClient = useQueryClient();

  // Solo observa la caché (enabled: false): nunca dispara una petición por sí
  // mismo, pero se actualiza cuando el prefetch por hover termina.
  const { data: detail, isFetching } = useQuery({
    ...pokemonQueries.detail(pokemon.name),
    enabled: false,
  });

  const prefetchDetail = () => {
    // prefetchQuery respeta staleTime: si ya está en caché y fresco, no hace nada.
    void queryClient.prefetchQuery(pokemonQueries.detail(pokemon.name));
  };

  return (
    <Link
      href={`/pokemon/${pokemon.name}`}
      onMouseEnter={prefetchDetail}
      onFocus={prefetchDetail}
      className="group relative flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-red-300 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-red-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-red-500/60"
    >
      <span className="self-start font-mono text-xs text-slate-400">
        {formatId(pokemon.id)}
      </span>

      <span
        className={`absolute top-3 right-3 size-2.5 rounded-full transition ${
          detail
            ? "bg-emerald-500"
            : isFetching
              ? "animate-pulse bg-amber-400"
              : "bg-slate-200 dark:bg-slate-700"
        }`}
        title={
          detail
            ? "Detalle precargado en caché"
            : isFetching
              ? "Precargando detalle…"
              : "Sin precargar"
        }
      />

      <div className="relative my-2 aspect-square w-full max-w-36 rounded-full bg-slate-50 transition group-hover:bg-red-50 dark:bg-slate-800/60 dark:group-hover:bg-red-950/40">
        <Image
          src={pokemon.image}
          alt={formatName(pokemon.name)}
          fill
          sizes="(max-width: 640px) 40vw, 150px"
          className="object-contain p-2 drop-shadow-md transition group-hover:scale-110"
          preload={priority}
        />
      </div>

      <h2 className="text-center font-semibold text-slate-800 capitalize dark:text-slate-100">
        {formatName(pokemon.name)}
      </h2>

      <div className="mt-2 flex h-5 gap-1">
        {detail?.types.map((type) => (
          <TypeBadge key={type} type={type} size="sm" />
        ))}
      </div>
    </Link>
  );
}
