import { PAGE_SIZE } from "@/lib/pokeapi/api";

export function GridSkeleton() {
  return (
    <ul
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      aria-label="Cargando Pokémon"
    >
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <li
          key={i}
          className="flex h-60 animate-pulse flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="h-3 w-10 self-start rounded bg-slate-200 dark:bg-slate-800" />
          <div className="my-3 aspect-square w-full max-w-36 rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="h-4 w-24 rounded bg-slate-200 dark:bg-slate-800" />
        </li>
      ))}
    </ul>
  );
}

export function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Cargando detalle">
      <div className="grid gap-6 rounded-3xl bg-white p-6 md:grid-cols-2 dark:bg-slate-900">
        <div className="mx-auto aspect-square w-full max-w-sm rounded-full bg-slate-100 dark:bg-slate-800" />
        <div className="space-y-4">
          <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-9 w-56 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-20 w-full rounded bg-slate-100 dark:bg-slate-800" />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      </div>
      <div className="h-48 rounded-3xl bg-white dark:bg-slate-900" />
    </div>
  );
}
