import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { CacheIndicator } from "@/components/cache-indicator";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Pokédex · TanStack Query",
    template: "%s · Pokédex",
  },
  description:
    "Pokédex con Next.js App Router, React Server Components y TanStack Query: prefetching en hover, hydration y caché de 24 horas.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-slate-100 dark:bg-slate-950">
        <Providers>
          <header className="bg-red-600 shadow-md">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
              <Link href="/" className="flex items-center gap-3">
                <span className="relative block size-8 rounded-full border-4 border-slate-900 bg-white">
                  <span className="absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-red-500" />
                  <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-slate-900" />
                  <span className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-900 bg-white" />
                </span>
                <span className="text-xl font-bold tracking-tight text-white">
                  Pokédex
                </span>
              </Link>
              <nav className="flex items-center gap-3">
                <Link
                  href="/batalla"
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-bold text-red-600 shadow-sm transition hover:bg-red-50"
                >
                  ⚔️ Batalla
                </Link>
                <CacheIndicator />
              </nav>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>

          <footer className="py-6 text-center text-xs text-slate-500">
            Datos de{" "}
            <a href="https://pokeapi.co" className="underline" target="_blank" rel="noreferrer">
              PokéAPI
            </a>{" "}
            · Next.js 16 + TanStack Query v5
          </footer>
        </Providers>
      </body>
    </html>
  );
}
