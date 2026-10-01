"use client";

import { useSyncExternalStore } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Lee una consulta de la caché sin crearla ni dispararla.
 *
 * A diferencia de useQuery({ enabled: false }), no registra una entrada vacía
 * en la caché. Esto importa: si la entrada ya existiera al llegar a la página
 * de detalle, HydrationBoundary aplazaría la hidratación de los datos que
 * envía el servidor y el cliente terminaría pidiéndolos otra vez a PokéAPI.
 */
export function useCachedQuery<T>(queryKey: QueryKey) {
  const cache = useQueryClient().getQueryCache();
  const subscribe = (onChange: () => void) => cache.subscribe(onChange);

  const data = useSyncExternalStore(
    subscribe,
    () => cache.find<T>({ queryKey, exact: true })?.state.data,
    () => undefined,
  );

  const isFetching = useSyncExternalStore(
    subscribe,
    () => cache.find({ queryKey, exact: true })?.state.fetchStatus === "fetching",
    () => false,
  );

  return { data, isFetching };
}
