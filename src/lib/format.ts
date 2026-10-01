export function formatName(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatId(id: number): string {
  return `#${String(id).padStart(4, "0")}`;
}

export const TYPE_LABELS: Record<string, string> = {
  normal: "Normal",
  fire: "Fuego",
  water: "Agua",
  electric: "Eléctrico",
  grass: "Planta",
  ice: "Hielo",
  fighting: "Lucha",
  poison: "Veneno",
  ground: "Tierra",
  flying: "Volador",
  psychic: "Psíquico",
  bug: "Bicho",
  rock: "Roca",
  ghost: "Fantasma",
  dragon: "Dragón",
  dark: "Siniestro",
  steel: "Acero",
  fairy: "Hada",
  stellar: "Astral",
};

export const TYPE_COLORS: Record<string, string> = {
  normal: "#9fa19f",
  fire: "#e62829",
  water: "#2980ef",
  electric: "#e0ac00",
  grass: "#3fa129",
  ice: "#3dcef3",
  fighting: "#ff8000",
  poison: "#9141cb",
  ground: "#915121",
  flying: "#81b9ef",
  psychic: "#ef4179",
  bug: "#91a119",
  rock: "#afa981",
  ghost: "#704170",
  dragon: "#5060e1",
  dark: "#624d4e",
  steel: "#60a1b8",
  fairy: "#ef70ef",
  stellar: "#40b5a5",
};

export const STAT_LABELS: Record<string, string> = {
  hp: "PS",
  attack: "Ataque",
  defense: "Defensa",
  "special-attack": "At. Esp.",
  "special-defense": "Def. Esp.",
  speed: "Velocidad",
};
