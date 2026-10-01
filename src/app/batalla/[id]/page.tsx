import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { BattleRoom } from "@/components/battle/battle-room";
import { getBattleView } from "@/lib/battle/service";
import { readPlayerToken } from "@/lib/battle/session";
import { BattleConfigError } from "@/lib/battle/store";
import { battleKeys } from "@/lib/query/battle-queries";
import { getQueryClient } from "@/lib/query/get-query-client";
import { pokemonQueries } from "@/lib/query/pokemon-queries";

export const metadata: Metadata = {
  title: "Sala de batalla",
  description: "¡Te retaron a una batalla Pokémon! Elige tu equipo y acepta el desafío.",
};

/**
 * La vista se calcula en el servidor con la cookie del jugador y se hidrata
 * en el cliente; desde ahí TanStack Query la mantiene al día (Realtime +
 * sondeo de respaldo).
 */
export default async function BattlePage({ params }: PageProps<"/batalla/[id]">) {
  const { id } = await params;

  let view;
  try {
    view = await getBattleView(id, await readPlayerToken(id));
  } catch (error) {
    if (error instanceof BattleConfigError) {
      return (
        <p className="mx-auto max-w-xl rounded-2xl bg-amber-50 p-6 text-center text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {error.message}
        </p>
      );
    }
    throw error;
  }
  if (!view) notFound();

  const queryClient = getQueryClient();
  queryClient.setQueryData(battleKeys.view(id), view);
  if (view.state.phase === "waiting" && view.role === "spectator") {
    // Quien llega por el enlace necesita el buscador para armar su equipo.
    await queryClient.prefetchQuery(pokemonQueries.index());
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BattleRoom id={id} />
    </HydrationBoundary>
  );
}
