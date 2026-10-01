import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { PokemonDetailView } from "@/components/pokemon-detail-view";
import { DetailSkeleton } from "@/components/skeletons";
import { formatName } from "@/lib/format";
import { getQueryClient } from "@/lib/query/get-query-client";
import { pokemonQueries } from "@/lib/query/pokemon-queries";

export async function generateMetadata({
  params,
}: PageProps<"/pokemon/[name]">): Promise<Metadata> {
  const { name } = await params;
  return { title: formatName(decodeURIComponent(name)) };
}

/**
 * Server Component de detalle. El prefetch NO se espera: la consulta se
 * deshidrata en estado "pending" y su resultado llega al cliente por streaming.
 * Así el servidor responde de inmediato y, si el usuario ya precargó el
 * Pokémon con hover, el cliente lo pinta desde su caché sin esperar a nadie.
 */
export default async function PokemonPage({
  params,
}: PageProps<"/pokemon/[name]">) {
  const name = decodeURIComponent((await params).name).toLowerCase();
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(pokemonQueries.detail(name));

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-red-600 dark:text-slate-400"
      >
        ← Volver a la Pokédex
      </Link>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<DetailSkeleton />}>
          <PokemonDetailView name={name} />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
}
