import "server-only";

import { cookies } from "next/headers";

/** Cada jugador se identifica con un token secreto en una cookie httpOnly por sala. */
const cookieName = (id: string) => `pb_${id}`;

export async function readPlayerToken(id: string): Promise<string | undefined> {
  return (await cookies()).get(cookieName(id))?.value;
}

export async function savePlayerToken(id: string, token: string) {
  (await cookies()).set(cookieName(id), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 2,
  });
}
