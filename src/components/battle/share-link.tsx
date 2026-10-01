"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ShareLink({ id, hostName }: { id: string; hostName: string }) {
  // La URL depende del dominio actual; en el servidor se muestra solo la ruta.
  const url = useSyncExternalStore(
    subscribe,
    () => `${window.location.origin}/batalla/${id}`,
    () => `/batalla/${id}`,
  );
  const canShare = useSyncExternalStore(
    subscribe,
    () => typeof navigator.share === "function",
    () => false,
  );
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const share = () =>
    navigator
      .share({ title: "Batalla Pokémon", text: `¡${hostName} te reta a una batalla Pokémon!`, url })
      .catch(() => {});

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          aria-label="Enlace de la sala"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 font-mono text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
        <button
          onClick={copy}
          className="rounded-xl bg-red-600 px-5 py-2 font-semibold text-white hover:bg-red-700"
        >
          {copied ? "¡Copiado!" : "Copiar enlace"}
        </button>
        {canShare && (
          <button
            onClick={share}
            className="rounded-xl border border-slate-300 px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Compartir
          </button>
        )}
      </div>
    </div>
  );
}
