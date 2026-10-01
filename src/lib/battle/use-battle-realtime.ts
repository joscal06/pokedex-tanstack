"use client";

import { useEffect } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { battleKeys } from "@/lib/query/battle-queries";

// Next.js inserta estos valores en el bundle del navegador al compilar.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let client: SupabaseClient | undefined;
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  return client;
}

/**
 * Escucha por WebSocket los cambios de `battle_signals` para esta sala y, en
 * cuanto el rival actúa, invalida la consulta de TanStack Query para que se
 * vuelva a pedir la vista. Si Realtime no está disponible, el sondeo de
 * respaldo de battleQueries mantiene la sala actualizada.
 */
export function useBattleRealtime(id: string, enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = enabled ? getClient() : null;
    if (!supabase) return;

    const channel = supabase
      .channel(`battle:${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "battle_signals", filter: `battle_id=eq.${id}` },
        () => void queryClient.invalidateQueries({ queryKey: battleKeys.view(id) }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, enabled, queryClient]);
}
