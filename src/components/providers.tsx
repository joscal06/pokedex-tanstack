"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "@/lib/query/get-query-client";

export function Providers({ children }: { children: ReactNode }) {
  // No usar useState aquí: si React suspende el primer render se perdería el
  // cliente. getQueryClient() ya devuelve un singleton en el navegador.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
    </QueryClientProvider>
  );
}
