"use client";

import { useQuery } from "@tanstack/react-query";
import { pokemonQueries } from "@/lib/query/pokemon-queries";
import { PokemonCard } from "./pokemon-card";
import { GridSkeleton } from "./skeletons";

export function PokemonGrid({ page }: { page: number }) {
  // Los datos llegan hidratados desde el servidor, así que en el primer render
  // ya están en caché y no se hace ninguna petición desde el navegador.
  const { data, isPending, isError, error, refetch } = useQuery(
    pokemonQueries.list(page),
  );

  if (isPending) return <GridSkeleton />;

  if (isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        <p className="font-semibold">No se pudo cargar la lista de Pokémon.</p>
        <p className="mt-1 text-sm">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-4 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {data.results.map((pokemon, index) => (
        <li key={pokemon.id}>
          <PokemonCard pokemon={pokemon} priority={index < 10} />
        </li>
      ))}
    </ul>
  );
}
