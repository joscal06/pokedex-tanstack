import { queryOptions } from "@tanstack/react-query";
import type { BattleView } from "@/lib/battle/types";

export const battleKeys = {
  all: ["battle"] as const,
  view: (id: string) => [...battleKeys.all, id] as const,
};

async function fetchBattleView(id: string, signal?: AbortSignal): Promise<BattleView> {
  const response = await fetch(`/api/batallas/${id}`, { signal, cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "No se pudo cargar la batalla.");
  return body as BattleView;
}

/**
 * A diferencia de los datos de PokéAPI (24 h), una batalla cambia en cada
 * turno: staleTime 0 y un sondeo de respaldo. Con Supabase Realtime el
 * sondeo es lento (15 s) porque los cambios llegan por WebSocket; sin
 * Realtime se consulta cada 1,5 s.
 */
export const battleQueries = {
  view: (id: string) =>
    queryOptions({
      queryKey: battleKeys.view(id),
      queryFn: ({ signal }) => fetchBattleView(id, signal),
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      refetchInterval: (query) => {
        const view = query.state.data;
        if (view?.state.phase === "finished") return false;
        return view?.realtime ? 15_000 : 1_500;
      },
      refetchIntervalInBackground: true,
      retry: 1,
    }),
};
