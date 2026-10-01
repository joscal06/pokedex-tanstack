/** Tabla de tipos (generación 6 en adelante): multiplicadores del atacante. */
const CHART: Record<string, { x2: string[]; half: string[]; zero: string[] }> = {
  normal: { x2: [], half: ["rock", "steel"], zero: ["ghost"] },
  fire: { x2: ["grass", "ice", "bug", "steel"], half: ["fire", "water", "rock", "dragon"], zero: [] },
  water: { x2: ["fire", "ground", "rock"], half: ["water", "grass", "dragon"], zero: [] },
  electric: { x2: ["water", "flying"], half: ["electric", "grass", "dragon"], zero: ["ground"] },
  grass: {
    x2: ["water", "ground", "rock"],
    half: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"],
    zero: [],
  },
  ice: { x2: ["grass", "ground", "flying", "dragon"], half: ["fire", "water", "ice", "steel"], zero: [] },
  fighting: {
    x2: ["normal", "ice", "rock", "dark", "steel"],
    half: ["poison", "flying", "psychic", "bug", "fairy"],
    zero: ["ghost"],
  },
  poison: { x2: ["grass", "fairy"], half: ["poison", "ground", "rock", "ghost"], zero: ["steel"] },
  ground: { x2: ["fire", "electric", "poison", "rock", "steel"], half: ["grass", "bug"], zero: ["flying"] },
  flying: { x2: ["grass", "fighting", "bug"], half: ["electric", "rock", "steel"], zero: [] },
  psychic: { x2: ["fighting", "poison"], half: ["psychic", "steel"], zero: ["dark"] },
  bug: {
    x2: ["grass", "psychic", "dark"],
    half: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"],
    zero: [],
  },
  rock: { x2: ["fire", "ice", "flying", "bug"], half: ["fighting", "ground", "steel"], zero: [] },
  ghost: { x2: ["psychic", "ghost"], half: ["dark"], zero: ["normal"] },
  dragon: { x2: ["dragon"], half: ["steel"], zero: ["fairy"] },
  dark: { x2: ["psychic", "ghost"], half: ["fighting", "dark", "fairy"], zero: [] },
  steel: { x2: ["ice", "rock", "fairy"], half: ["fire", "water", "electric", "steel"], zero: [] },
  fairy: { x2: ["fighting", "dragon", "dark"], half: ["fire", "poison", "steel"], zero: [] },
};

/** Multiplicador de un ataque de `attackType` contra un Pokémon de `defenderTypes`. */
export function typeEffectiveness(attackType: string, defenderTypes: string[]): number {
  const row = CHART[attackType];
  if (!row) return 1; // "typeless" (Forcejeo) o tipos desconocidos

  return defenderTypes.reduce((multiplier, type) => {
    if (row.zero.includes(type)) return 0;
    if (row.x2.includes(type)) return multiplier * 2;
    if (row.half.includes(type)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}
