/**
 * Tipos de las respuestas crudas de PokéAPI (solo los campos que usa la app)
 * y de los modelos ya transformados que consume la interfaz.
 */

// ---------- Respuestas crudas de la API ----------

export interface NamedAPIResource {
  name: string;
  url: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PokemonTypeSlot {
  slot: number;
  type: NamedAPIResource;
}

export interface PokemonAbilitySlot {
  ability: NamedAPIResource;
  is_hidden: boolean;
  slot: number;
}

export interface PokemonStatEntry {
  base_stat: number;
  effort: number;
  stat: NamedAPIResource;
}

export interface PokemonSpritesResponse {
  front_default: string | null;
  back_default: string | null;
  front_shiny: string | null;
  back_shiny: string | null;
  other?: {
    "official-artwork"?: {
      front_default: string | null;
      front_shiny: string | null;
    };
    home?: {
      front_default: string | null;
      front_shiny: string | null;
    };
  };
}

export interface PokemonResponse {
  id: number;
  name: string;
  height: number; // decímetros
  weight: number; // hectogramos
  base_experience: number | null;
  types: PokemonTypeSlot[];
  abilities: PokemonAbilitySlot[];
  stats: PokemonStatEntry[];
  sprites: PokemonSpritesResponse;
  species: NamedAPIResource;
}

export interface FlavorTextEntry {
  flavor_text: string;
  language: NamedAPIResource;
  version: NamedAPIResource;
}

export interface Genus {
  genus: string;
  language: NamedAPIResource;
}

export interface PokemonSpeciesResponse {
  id: number;
  name: string;
  evolution_chain: { url: string } | null;
  flavor_text_entries: FlavorTextEntry[];
  genera: Genus[];
}

export interface EvolutionDetail {
  min_level: number | null;
  trigger: NamedAPIResource;
  item: NamedAPIResource | null;
}

export interface ChainLink {
  species: NamedAPIResource;
  evolution_details: EvolutionDetail[];
  evolves_to: ChainLink[];
}

export interface EvolutionChainResponse {
  id: number;
  chain: ChainLink;
}

// ---------- Modelos de la aplicación ----------

export interface PokemonSummary {
  id: number;
  name: string;
  image: string;
}

export interface PokemonPage {
  page: number;
  totalPages: number;
  total: number;
  results: PokemonSummary[];
}

export interface PokemonStat {
  name: string;
  value: number;
}

export interface PokemonAbility {
  name: string;
  isHidden: boolean;
}

export interface PokemonSprite {
  label: string;
  url: string;
}

export interface EvolutionNode {
  id: number;
  name: string;
  image: string;
  /** Condición para evolucionar a esta especie (null en la forma base). */
  condition: string | null;
}

export interface PokemonDetail {
  id: number;
  name: string;
  genus: string | null;
  description: string | null;
  height: number; // metros
  weight: number; // kilogramos
  baseExperience: number | null;
  types: string[];
  abilities: PokemonAbility[];
  stats: PokemonStat[];
  image: string;
  sprites: PokemonSprite[];
  /** Cada etapa puede tener varias ramas (p. ej. Eevee). */
  evolutionStages: EvolutionNode[][];
}
