import { getBattleView } from "@/lib/battle/service";
import { readPlayerToken } from "@/lib/battle/session";
import { BattleConfigError } from "@/lib/battle/store";

/** Vista de la sala para el jugador que la pide (según su cookie). */
export async function GET(_request: Request, { params }: RouteContext<"/api/batallas/[id]">) {
  const { id } = await params;
  try {
    const view = await getBattleView(id, await readPlayerToken(id));
    if (!view) return Response.json({ error: "La sala no existe." }, { status: 404 });
    return Response.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BattleConfigError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
}
