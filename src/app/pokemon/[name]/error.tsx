"use client";

import { ErrorPanel } from "@/components/error-panel";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorPanel title="No se pudo cargar este Pokémon" error={error} retry={retry} />;
}
