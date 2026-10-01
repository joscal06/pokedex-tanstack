import { queryOptions } from "@tanstack/react-query";
import { getAllPokemon, getPokemonDetail, getPokemonPage } from "@/lib/pokeapi/api";

/**
 * Contrato de caché compartido por Server y Client Components:
 * ambos lados usan exactamente las mismas claves y opciones.
 */
export const pokemonKeys = {
  all: ["pokemon"] as const,
  lists: () => [...pokemonKeys.all, "list"] as const,
  index: () => [...pokemonKeys.all, "index"] as const,
  list: (page: number) => [...pokemonKeys.lists(), page] as const,
  details: () => [...pokemonKeys.all, "detail"] as const,
  detail: (name: string) => [...pokemonKeys.details(), name] as const,
};

export const pokemonQueries = {
  list: (page: number) =>
    queryOptions({
      queryKey: pokemonKeys.list(page),
      queryFn: ({ signal }) => getPokemonPage(page, signal),
    }),
  /** Índice completo (1025 nombres) para el selector de equipo. */
  index: () =>
    queryOptions({
      queryKey: pokemonKeys.index(),
      queryFn: ({ signal }) => getAllPokemon(signal),
    }),
  detail: (name: string) =>
    queryOptions({
      queryKey: pokemonKeys.detail(name.toLowerCase()),
      queryFn: ({ signal }) => getPokemonDetail(name, signal),
    }),
};
