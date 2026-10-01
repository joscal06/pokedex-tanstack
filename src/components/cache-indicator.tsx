"use client";

import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pokemonKeys } from "@/lib/query/pokemon-queries";

/** Muestra cuántos detalles de Pokémon hay ya en la caché del navegador. */
export function CacheIndicator() {
  const queryClient = useQueryClient();
  const cache = queryClient.getQueryCache();

  const cachedDetails = useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () =>
      cache
        .findAll({ queryKey: pokemonKeys.details() })
        .filter((query) => query.state.status === "success").length,
    () => 0,
  );

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
      <span className="size-2 rounded-full bg-emerald-400" />
      {cachedDetails} {cachedDetails === 1 ? "detalle" : "detalles"} en caché
    </span>
  );
}
