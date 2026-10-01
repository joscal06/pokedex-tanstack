"use server";

import { redirect } from "next/navigation";
import { BattleError, createBattle, joinBattle, submitAction } from "@/lib/battle/service";
import { readPlayerToken, savePlayerToken } from "@/lib/battle/session";
import { BattleConfigError } from "@/lib/battle/store";
import type { BattleAction, TeamSize } from "@/lib/battle/types";

export type ActionResult = { error: string } | undefined;

/** Convierte errores esperados en mensajes para la interfaz. */
async function guard(run: () => Promise<void>): Promise<ActionResult> {
  try {
    await run();
  } catch (error) {
    if (error instanceof BattleError || error instanceof BattleConfigError) return { error: error.message };
    console.error(error);
    return { error: "Ocurrió un error inesperado. Inténtalo de nuevo." };
  }
}

export async function createBattleAction(input: {
  size: TeamSize;
  names: string[];
  playerName: string;
}): Promise<ActionResult> {
  let id = "";
  const result = await guard(async () => {
    const created = await createBattle(input);
    await savePlayerToken(created.id, created.token);
    id = created.id;
  });
  if (result) return result;
  // redirect() lanza una excepción especial: debe ir fuera del try/catch.
  redirect(`/batalla/${id}`);
}

export async function joinBattleAction(input: {
  id: string;
  names: string[];
  playerName: string;
}): Promise<ActionResult> {
  return guard(async () => {
    const { token } = await joinBattle(input);
    await savePlayerToken(input.id, token);
  });
}

export async function submitBattleAction(id: string, action: BattleAction): Promise<ActionResult> {
  return guard(async () => {
    await submitAction({ id, token: await readPlayerToken(id), action });
  });
}
