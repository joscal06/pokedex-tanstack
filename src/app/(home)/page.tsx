import {
  dehydrate,
  HydrationBoundary,
} from "@tanstack/react-query";
import { PokemonGrid } from "@/components/pokemon-grid";
import { Pagination } from "@/components/pagination";
import { TOTAL_PAGES, TOTAL_POKEMON } from "@/lib/pokeapi/api";
import { getQueryClient } from "@/lib/query/get-query-client";
import { pokemonQueries } from "@/lib/query/pokemon-queries";

function parsePage(value: string | string[] | undefined): number {
  const page = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, TOTAL_PAGES);
}

/**
 * Server Component: obtiene la página de Pokémon en el servidor, la guarda en
 * un QueryClient por petición y la transfiere al cliente con HydrationBoundary.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const page = parsePage((await searchParams).page);
  const queryClient = getQueryClient();

  // Se espera (await) porque la lista es el contenido principal de la página y
  // debe venir incluida en el HTML inicial.
  await queryClient.prefetchQuery(pokemonQueries.list(page));

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          Pokédex nacional
        </h1>
        <p className="max-w-2xl text-slate-600 dark:text-slate-400">
          {TOTAL_POKEMON} Pokémon, 50 por página. Pasa el mouse sobre una
          tarjeta para precargar su detalle: el punto verde indica que ya está
          en caché y la página de detalle abrirá al instante.
        </p>
      </section>

      <Pagination page={page} totalPages={TOTAL_PAGES} />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <PokemonGrid page={page} />
      </HydrationBoundary>

      <Pagination page={page} totalPages={TOTAL_PAGES} />
    </div>
  );
}
