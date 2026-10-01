import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { TeamPicker } from "@/components/battle/team-picker";
import { getQueryClient } from "@/lib/query/get-query-client";
import { pokemonQueries } from "@/lib/query/pokemon-queries";

export const metadata: Metadata = {
  title: "Batalla",
  description: "Arma tu equipo y reta a otra persona a una batalla Pokémon en vivo.",
};

export default async function NewBattlePage() {
  const queryClient = getQueryClient();
  // El índice de 1025 Pokémon se carga en el servidor y se hidrata en el buscador.
  await queryClient.prefetchQuery(pokemonQueries.index());

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Batalla Pokémon en vivo</h1>
        <p className="max-w-3xl text-slate-600 dark:text-slate-400">
          Elige 1, 3 o 6 Pokémon y crea una sala. Te daremos un enlace para compartir: tu rival
          arma un equipo del mismo tamaño y combaten turno a turno, al mismo tiempo, cada uno desde
          su navegador. Todos los Pokémon luchan a nivel 50 con sus estadísticas reales y cuatro
          ataques que aprenden por nivel.
        </p>
      </section>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <TeamPicker mode="create" />
      </HydrationBoundary>
    </div>
  );
}
