"use client";

import Link from "next/link";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";

interface ErrorPanelProps {
  title: string;
  error: Error & { digest?: string };
  retry: () => void;
}

/** UI compartida por los error.tsx de cada segmento. */
export function ErrorPanel({ title, error, retry }: ErrorPanelProps) {
  // Limpia el estado de error de las consultas de TanStack antes de que
  // Next.js vuelva a renderizar el segmento; si no, useSuspenseQuery
  // relanzaría el mismo error inmediatamente.
  const { reset } = useQueryErrorResetBoundary();

  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
      <p className="text-5xl">😵</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
        {title}
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">{error.message}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={() => {
            reset();
            retry();
          }}
          className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Volver a la lista
        </Link>
      </div>
    </div>
  );
}
