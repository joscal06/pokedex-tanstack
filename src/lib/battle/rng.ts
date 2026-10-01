/**
 * Generador pseudoaleatorio con semilla (mulberry32). Su estado es un solo
 * número que se guarda con la batalla, así cada turno es reproducible.
 */
export class Rng {
  constructor(public state: number) {}

  /** Número en [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Verdadero con probabilidad `percent` (0–100). */
  chance(percent: number): boolean {
    return this.next() * 100 < percent;
  }

  /** Entero en [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
}

export function randomSeed(): number {
  return (Math.random() * 2 ** 32) | 0;
}
