import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
}

/** Server Component: solo genera enlaces, no necesita JavaScript en el cliente. */
export function Pagination({ page, totalPages }: PaginationProps) {
  const pages = visiblePages(page, totalPages);
  const href = (p: number) => (p === 1 ? "/" : `/?page=${p}`);

  const base =
    "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-medium transition";
  const idle =
    "bg-white text-slate-700 shadow-sm hover:bg-red-50 hover:text-red-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-red-950/50";
  const disabled = "pointer-events-none opacity-40";

  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <Link
        href={href(page - 1)}
        aria-label="Página anterior"
        aria-disabled={page === 1}
        className={`${base} ${idle} ${page === 1 ? disabled : ""}`}
      >
        ←<span className="hidden sm:inline"> Anterior</span>
      </Link>

      {pages.map((p, i) =>
        p === null ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={href(p)}
            aria-current={p === page ? "page" : undefined}
            className={`${base} ${
              p === page ? "bg-red-600 text-white shadow" : idle
            }`}
          >
            {p}
          </Link>
        ),
      )}

      <Link
        href={href(page + 1)}
        aria-label="Página siguiente"
        aria-disabled={page === totalPages}
        className={`${base} ${idle} ${page === totalPages ? disabled : ""}`}
      >
        <span className="hidden sm:inline">Siguiente </span>→
      </Link>
    </nav>
  );
}

function visiblePages(page: number, total: number): Array<number | null> {
  const set = new Set([1, total, page - 1, page, page + 1]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: Array<number | null> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push(null);
    result.push(p);
  });
  return result;
}
