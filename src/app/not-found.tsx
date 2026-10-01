import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm dark:bg-slate-900">
      <p className="text-5xl">🔍</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">No encontramos esta página</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Puede que el enlace esté mal escrito o que la sala de batalla ya no exista.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700">
          Ir a la Pokédex
        </Link>
        <Link
          href="/batalla"
          className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Nueva batalla
        </Link>
      </div>
    </div>
  );
}
