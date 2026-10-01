import type {
  ChainLink,
  EvolutionChainResponse,
  EvolutionNode,
  NamedAPIResource,
  PaginatedResponse,
  PokemonDetail,
  PokemonPage,
  PokemonResponse,
  PokemonSpeciesResponse,
  PokemonSprite,
  PokemonSummary,
} from "./types";

export const API_URL = "https://pokeapi.co/api/v2";
const ARTWORK_URL =
  "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork";

/** Pokédex nacional (sin formas alternativas, que empiezan en el id 10001). */
export const TOTAL_POKEMON = 1025;
export const PAGE_SIZE = 50;
export const TOTAL_PAGES = Math.ceil(TOTAL_POKEMON / PAGE_SIZE);

/** Segundos que Next.js guarda las respuestas de PokéAPI en su Data Cache (servidor). */
const SERVER_REVALIDATE_SECONDS = 60 * 60 * 24;

export class PokeApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PokeApiError";
  }
}

/**
 * fetch compartido por servidor y cliente. En el servidor la opción `next`
 * activa la Data Cache de Next.js; en el navegador se ignora.
 */
export async function request<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    next: { revalidate: SERVER_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new PokeApiError(
      response.status === 404
        ? "No se encontró el recurso solicitado en PokéAPI."
        : `PokéAPI respondió con el estado ${response.status}.`,
      response.status,
    );
  }

  return response.json() as Promise<T>;
}

export function idFromUrl(url: string): number {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

export function artworkUrl(id: number): string {
  return `${ARTWORK_URL}/${id}.png`;
}

// ---------- Lista paginada ----------

export async function getPokemonPage(
  page: number,
  signal?: AbortSignal,
): Promise<PokemonPage> {
  const offset = (page - 1) * PAGE_SIZE;
  const limit = Math.max(0, Math.min(PAGE_SIZE, TOTAL_POKEMON - offset));

  const data = await request<PaginatedResponse<NamedAPIResource>>(
    `${API_URL}/pokemon?limit=${limit}&offset=${offset}`,
    signal,
  );

  return {
    page,
    totalPages: TOTAL_PAGES,
    total: TOTAL_POKEMON,
    results: data.results.map(({ name, url }) => {
      const id = idFromUrl(url);
      return { id, name, image: artworkUrl(id) };
    }),
  };
}

/** Los 1025 Pokémon (solo nombre e id), para el buscador del minijuego. */
export async function getAllPokemon(signal?: AbortSignal): Promise<PokemonSummary[]> {
  const data = await request<PaginatedResponse<NamedAPIResource>>(
    `${API_URL}/pokemon?limit=${TOTAL_POKEMON}&offset=0`,
    signal,
  );
  return data.results.map(({ name, url }) => {
    const id = idFromUrl(url);
    return { id, name, image: spriteUrl(id) };
  });
}

/** Sprite pequeño (96 px) de los juegos, ideal para listas compactas. */
export function spriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

// ---------- Detalle ----------

function pickSpanish<T extends { language: NamedAPIResource }>(
  entries: T[],
): T | undefined {
  return (
    entries.find((entry) => entry.language.name === "es") ??
    entries.find((entry) => entry.language.name === "en")
  );
}

const TRIGGER_LABELS: Record<string, string> = {
  "level-up": "Subir de nivel",
  trade: "Intercambio",
  "use-item": "Usar objeto",
  shed: "Muda",
};

function describeEvolution(link: ChainLink): string | null {
  const detail = link.evolution_details[0];
  if (!detail) return null;
  if (detail.min_level) return `Nivel ${detail.min_level}`;
  if (detail.item) return `Usar ${detail.item.name.replace(/-/g, " ")}`;
  return (
    TRIGGER_LABELS[detail.trigger.name] ??
    detail.trigger.name.replace(/-/g, " ")
  );
}

/** Recorre el árbol de evolución por niveles (BFS) para soportar ramificaciones. */
function flattenChain(root: ChainLink): EvolutionNode[][] {
  const stages: EvolutionNode[][] = [];
  let current: ChainLink[] = [root];

  while (current.length > 0) {
    stages.push(
      current.map((link) => {
        const id = idFromUrl(link.species.url);
        return {
          id,
          name: link.species.name,
          image: artworkUrl(id),
          condition: describeEvolution(link),
        };
      }),
    );
    current = current.flatMap((link) => link.evolves_to);
  }

  return stages;
}

function collectSprites(pokemon: PokemonResponse): PokemonSprite[] {
  const { sprites } = pokemon;
  const candidates: Array<[string, string | null | undefined]> = [
    ["Arte oficial", sprites.other?.["official-artwork"]?.front_default],
    ["Arte oficial shiny", sprites.other?.["official-artwork"]?.front_shiny],
    ["HOME", sprites.other?.home?.front_default],
    ["HOME shiny", sprites.other?.home?.front_shiny],
    ["Frente", sprites.front_default],
    ["Espalda", sprites.back_default],
    ["Frente shiny", sprites.front_shiny],
    ["Espalda shiny", sprites.back_shiny],
  ];

  return candidates
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, url]) => ({ label, url }));
}

/**
 * Combina /pokemon, /pokemon-species y /evolution-chain en un único modelo,
 * de modo que una sola entrada de caché contiene todo lo que muestra el detalle.
 */
export async function getPokemonDetail(
  name: string,
  signal?: AbortSignal,
): Promise<PokemonDetail> {
  const pokemon = await request<PokemonResponse>(
    `${API_URL}/pokemon/${encodeURIComponent(name.toLowerCase())}`,
    signal,
  );

  const species = await request<PokemonSpeciesResponse>(
    pokemon.species.url,
    signal,
  );

  const chain = species.evolution_chain
    ? await request<EvolutionChainResponse>(species.evolution_chain.url, signal)
    : null;

  const flavor = pickSpanish(species.flavor_text_entries);
  const genus = pickSpanish(species.genera);

  return {
    id: pokemon.id,
    name: pokemon.name,
    genus: genus?.genus ?? null,
    description: flavor
      ? flavor.flavor_text.replace(/[\f\n\r­]+/g, " ")
      : null,
    height: pokemon.height / 10,
    weight: pokemon.weight / 10,
    baseExperience: pokemon.base_experience,
    types: [...pokemon.types]
      .sort((a, b) => a.slot - b.slot)
      .map(({ type }) => type.name),
    abilities: pokemon.abilities.map(({ ability, is_hidden }) => ({
      name: ability.name,
      isHidden: is_hidden,
    })),
    stats: pokemon.stats.map(({ stat, base_stat }) => ({
      name: stat.name,
      value: base_stat,
    })),
    image:
      pokemon.sprites.other?.["official-artwork"]?.front_default ??
      artworkUrl(pokemon.id),
    sprites: collectSprites(pokemon),
    evolutionStages: chain ? flattenChain(chain.chain) : [],
  };
}
