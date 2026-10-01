import {
  defaultShouldDehydrateQuery,
  isServer,
  QueryClient,
} from "@tanstack/react-query";
import { PokeApiError } from "@/lib/pokeapi/api";

/** Los datos de PokéAPI prácticamente no cambian: se consideran frescos 24 h. */
export const STALE_TIME = 24 * 60 * 60 * 1000;

/**
 * Tiempo que una consulta sin observadores (p. ej. un prefetch por hover de un
 * Pokémon que aún no se visitó) permanece en memoria antes de ser recolectada.
 * Se iguala a staleTime para no descartar datos que todavía son frescos.
 */
export const GC_TIME = 24 * 60 * 60 * 1000;

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
        refetchOnWindowFocus: false,
        // Un 404 no se arregla reintentando; otros errores se reintentan 2 veces.
        retry: (failureCount, error) =>
          !(error instanceof PokeApiError && error.status === 404) &&
          failureCount < 2,
      },
      dehydrate: {
        // Incluye también las consultas pendientes para poder hacer streaming
        // de prefetches que el servidor no esperó con await.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        // Next.js necesita los errores reales para detectar rutas dinámicas.
        shouldRedactErrors: () => false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * En el servidor se crea un QueryClient nuevo por petición (aislamiento entre
 * usuarios); en el navegador se reutiliza uno solo para conservar la caché.
 */
export function getQueryClient() {
  if (isServer) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  // Convención de la extensión TanStack Query DevTools para inspeccionar la caché.
  (
    window as unknown as { __TANSTACK_QUERY_CLIENT__: QueryClient }
  ).__TANSTACK_QUERY_CLIENT__ = browserQueryClient;
  return browserQueryClient;
}
