# Pokédex · TanStack Query + Next.js 16

Pokédex construida con **Next.js 16 (App Router)**, **React Server Components** y **TanStack Query v5** para practicar la optimización de la transferencia de datos: renderizado en el servidor, *hydration*, *prefetching* al pasar el mouse y una estrategia de caché de 24 horas. Los datos provienen de [PokéAPI](https://pokeapi.co/).

**Demo en línea:** <https://pokedex-tanstack-beta.vercel.app/>  (despliegue continuo en Vercel desde la rama `main`).

## Funcionalidades

| Requisito | Implementación |
| --- | --- |
| Lista en el servidor | `src/app/(home)/page.tsx` es un Server Component: obtiene 50 Pokémon por página en el servidor y los envía al cliente ya renderizados. Muestra nombre, número e imagen oficial. |
| Paginación | 21 páginas (`/?page=N`) para los 1025 Pokémon de la Pokédex nacional. `Pagination` es un Server Component sin JavaScript en el cliente. |
| Prefetch en hover | `PokemonCard` llama a `queryClient.prefetchQuery()` en `onMouseEnter` (y en `onFocus` para teclado) y precarga stats, tipos, habilidades, cadena evolutiva y sprites. Un punto verde en la tarjeta y el contador «detalles en caché» del encabezado muestran lo que ya está en caché. |
| HydrationBoundary | El servidor llena un `QueryClient` por petición, lo serializa con `dehydrate()` y lo entrega a `<HydrationBoundary>`; el cliente arranca con la caché ya llena y no repite la petición. |
| Página de detalle | `/pokemon/[name]` muestra stats, tipos, habilidades (incluida la oculta), descripción y categoría en español, altura/peso, cadena evolutiva (con ramificaciones, p. ej. Eevee) y 8 sprites. |
| Carga instantánea | Si el Pokémon se precargó con hover, el detalle se pinta desde la caché sin skeleton ni nuevas peticiones a PokéAPI. |
| Carga y errores | Skeletons (`loading.tsx` y `<Suspense>`), `error.tsx` por segmento con botón *Reintentar* que también reinicia el estado de error de TanStack, y sin reintentos para respuestas 404. |

## Estrategia de caché

La aplicación usa **tres capas de caché**, cada una con un propósito:

### 1. TanStack Query (navegador)

Configurada en `src/lib/query/get-query-client.ts`:

```ts
staleTime: 24 * 60 * 60 * 1000, // 24 h
gcTime:    24 * 60 * 60 * 1000, // 24 h
refetchOnWindowFocus: false,
retry: (failureCount, error) => !(es404(error)) && failureCount < 2,
```

- **`staleTime` = 24 h.** Los datos de PokéAPI (stats, tipos, evoluciones) prácticamente nunca cambian, así que se consideran *frescos* durante un día. Mientras estén frescos, TanStack Query **no vuelve a pedirlos**: ni al montar el componente, ni al reconectar, ni al hidratar. Gracias a esto `prefetchQuery` en el hover no repite la petición si el usuario pasa el mouse varias veces sobre la misma tarjeta.
- **`gcTime` = 24 h.** `gcTime` controla cuánto tiempo sigue en memoria una consulta **sin observadores** (por ejemplo, un Pokémon precargado con hover cuya página aún no se abrió, o una página de la lista que ya se dejó). Se igualó a `staleTime` porque, si fuera menor, el recolector borraría datos que todavía son frescos y se perdería el beneficio del prefetch. No se puso un valor mayor porque cada detalle ocupa pocos KB y un día de sesión cubre el uso real; más allá de eso los datos se consideran viejos de todas formas.
- **`refetchOnWindowFocus: false`.** No tiene sentido volver a consultar datos estáticos cada vez que el usuario cambia de pestaña.
- **Reintentos.** Un 404 (Pokémon inexistente) no se reintenta; otros errores de red se reintentan hasta 2 veces.

### 2. Data Cache de Next.js (servidor)

`src/lib/pokeapi/api.ts` hace todas las peticiones con `fetch(url, { next: { revalidate: 86400 } })`. En el servidor, Next.js guarda cada respuesta de PokéAPI durante 24 h, de modo que distintos usuarios que piden el mismo Pokémon no generan nuevas llamadas a PokéAPI. En el navegador esa opción simplemente se ignora, por eso la misma función sirve en los dos entornos.

### 3. Hydration: del servidor al cliente

```
Servidor (RSC)                                    Cliente
──────────────                                    ───────
getQueryClient()  → QueryClient nuevo por petición
prefetchQuery()   → llena la caché del servidor
dehydrate()       → serializa la caché  ───────▶  <HydrationBoundary> la hidrata
                                                  useQuery / useSuspenseQuery leen
                                                  la caché: 0 peticiones extra
```

- **Lista (`/`)**: el prefetch se espera con `await` porque la lista es el contenido principal y debe venir en el HTML inicial.
- **Detalle (`/pokemon/[name]`)**: el prefetch **no** se espera. La consulta se deshidrata en estado *pending* (`shouldDehydrateQuery` incluye `status === "pending"`) y el resultado llega por *streaming*. Así el servidor responde de inmediato; si el usuario ya precargó ese Pokémon con hover, `useSuspenseQuery` encuentra los datos en la caché del navegador y renderiza sin esperar el streaming.
- En el servidor se crea un `QueryClient` por petición (para no mezclar datos entre usuarios) y en el navegador se reutiliza uno solo (singleton) para conservar la caché entre navegaciones.
- Las claves y opciones de las consultas están centralizadas en `src/lib/query/pokemon-queries.ts` (`queryOptions`), de modo que servidor y cliente usan exactamente la misma clave (`["pokemon", "detail", name]`, `["pokemon", "list", page]`).
- Las tarjetas muestran si su detalle ya está en caché mediante `useCachedQuery` (`src/lib/query/use-cached-query.ts`), que **lee** la caché sin crear entradas. Con `useQuery({ enabled: false })` cada tarjeta registraría una consulta vacía; al abrir el detalle, `HydrationBoundary` vería que la entrada ya existe, aplazaría la hidratación y el cliente volvería a pedir los datos a PokéAPI en lugar de usar los que envía el servidor.

### Por qué el detalle no tiene `loading.tsx`

Un `loading.tsx` a nivel de ruta se muestra en **toda** navegación, aunque los datos ya estén en caché, y React lo mantiene visible un mínimo de ~300 ms. Por eso el skeleton del detalle vive en un `<Suspense>` dentro de la página: solo aparece cuando de verdad faltan los datos. El skeleton de la lista está en el grupo de rutas `(home)` para que no afecte a `/pokemon/*`.

### Resultados medidos (Chrome headless)

| Escenario | Build local | Vercel | Skeleton | Peticiones del navegador a PokéAPI |
| --- | --- | --- | --- | --- |
| Carga inicial de la lista | — | — | No | 0 (datos hidratados desde el servidor) |
| Hover sobre una tarjeta | — | — | — | 3 (pokemon, species, evolution-chain), una sola vez |
| Clic en un Pokémon precargado | ≈ 60–140 ms | ≈ 270 ms | No | 0 |
| Clic en un Pokémon sin precargar | ≈ 420–480 ms | ≈ 500 ms | Sí | 0 (llega por streaming desde el servidor) |

En Vercel la diferencia restante en el caso precargado es solo la ida y vuelta de la navegación al servidor (región de la función); los datos ya no se esperan.

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx               # Layout raíz + Providers + encabezado
│   ├── error.tsx                # Error boundary global
│   ├── (home)/
│   │   ├── page.tsx             # RSC: lista paginada + prefetch + HydrationBoundary
│   │   └── loading.tsx          # Skeleton de la lista
│   └── pokemon/[name]/
│       ├── page.tsx             # RSC: prefetch en streaming + HydrationBoundary
│       └── error.tsx            # Error boundary del detalle
├── components/
│   ├── providers.tsx            # QueryClientProvider + Devtools (cliente)
│   ├── pokemon-grid.tsx         # Lista (cliente, useQuery)
│   ├── pokemon-card.tsx         # Tarjeta con prefetch en hover (cliente)
│   ├── pokemon-detail-view.tsx  # Detalle (cliente, useSuspenseQuery)
│   ├── pagination.tsx           # Paginación (servidor)
│   ├── cache-indicator.tsx      # Contador de detalles en caché (cliente)
│   ├── error-panel.tsx          # UI de error con reinicio de consultas
│   ├── skeletons.tsx            # Estados de carga
│   └── type-badge.tsx
└── lib/
    ├── pokeapi/
    │   ├── types.ts             # Tipos de las respuestas de PokéAPI y modelos de la app
    │   └── api.ts               # Funciones de acceso a PokéAPI (servidor y cliente)
    ├── query/
    │   ├── get-query-client.ts  # QueryClient: staleTime, gcTime, dehydrate
    │   ├── pokemon-queries.ts   # queryOptions y claves compartidas
    │   └── use-cached-query.ts  # Lectura de la caché sin crear consultas
    └── format.ts                # Nombres, colores y etiquetas en español
```

**Server Components:** `layout.tsx`, `(home)/page.tsx`, `pokemon/[name]/page.tsx`, `Pagination`, `TypeBadge`, skeletons.
**Client Components (`"use client"`):** todo lo que usa hooks de TanStack Query o eventos del navegador (`Providers`, `PokemonGrid`, `PokemonCard`, `PokemonDetailView`, `CacheIndicator`, `ErrorPanel`, `error.tsx`).

## Minijuego: batalla Pokémon en vivo (`/batalla`)

Extra opcional, fuera de los requisitos de la actividad. Dos personas combaten turno a turno, cada una desde su navegador:

1. El anfitrión elige el tamaño (1, 3 o 6 Pokémon), arma su equipo y crea una sala.
2. Recibe un enlace `/batalla/<código>` para compartir (botón copiar o compartir).
3. Quien abre el enlace ve el desafío y arma un equipo del mismo tamaño.
4. La batalla empieza en ambas pantallas sin recargar. Cada turno los dos eligen un ataque o un cambio de Pokémon y el servidor resuelve el turno cuando ambos eligieron. Cualquier otra persona que abra el enlace la ve como espectador.

### Mecánicas

- Todos los Pokémon luchan a **nivel 50** con sus estadísticas base reales (IV 31, sin EV, naturaleza neutra).
- Cada uno lleva **4 ataques reales** que aprende por nivel según PokéAPI: el mejor de cada tipo propio (STAB) y luego ataques de otros tipos para tener cobertura.
- **Fórmula de daño oficial**, STAB ×1,5, **tabla de 18 tipos**, golpes críticos (×1,5), variación aleatoria del 85 al 100 %, precisión, prioridad y velocidad.
- Golpes múltiples, drenaje y retroceso, retroceso por miedo, subidas y bajadas de estadísticas (−6 a +6) y los estados **quemado, paralizado, envenenado y congelado**.
- No se modelan habilidades, objetos ni ataques de estado puro.

`npm run simulate` ejecuta 500 batallas aleatorias contra el motor (`src/lib/battle/engine.ts`) y verifica que siempre terminen, que los PS nunca salgan de rango y que no haya mensajes inválidos.

### Arquitectura

```
Navegador A ─┐                                    ┌─ Navegador B
             │  Server Action (cookie httpOnly)   │
             ├──────────────▶ Next.js ◀───────────┤
             │                  │ motor de batalla│
             │                  ▼ (autoridad)     │
             │          Supabase: battles (privada)
             │                   battle_signals (pública, solo versión)
             │                  │ Realtime        │
             └────── invalidateQueries ◀──────────┘
                        └▶ GET /api/batallas/[id] → vista sin secretos
```

- **El servidor es la única autoridad.** Los navegadores solo envían "uso el ataque 2" o "cambio al Pokémon 3". Las estadísticas, el daño y el azar (generador con semilla) se calculan en el servidor, así que nadie puede hacer trampa desde la consola.
- **Identidad sin cuentas:** al crear o unirse a una sala, el servidor guarda un token aleatorio en una cookie `httpOnly` exclusiva de esa sala.
- **Información oculta:** la acción del rival no se revela hasta que se resuelve el turno, y la vista que recibe cada jugador no incluye los ataques del rival.
- **Concurrencia:** cada escritura usa control optimista por `version`. Si los dos jugadores eligen en el mismo instante, uno reintenta sobre el estado actualizado.
- **Tiempo real con TanStack Query:** `useBattleRealtime` escucha `battle_signals` por WebSocket y llama a `invalidateQueries`. Para estos datos la estrategia de caché es la opuesta a la de PokéAPI: `staleTime: 0`, con un sondeo de respaldo de 15 s (o de 1,5 s si Realtime no está configurado).
- **Animación:** cada evento del turno trae una foto del estado de ambos lados, y el cliente los reproduce en orden: barras de PS, sacudidas al recibir daño, debilitados y cambios.

### Configuración (Supabase)

1. Crear un proyecto en [Supabase](https://supabase.com) y ejecutar [`supabase/schema.sql`](supabase/schema.sql) en el SQL Editor.
2. Copiar `.env.example` como `.env.local` y completar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY` (Project Settings → API Keys).
3. En Vercel, agregar las mismas tres variables en Settings → Environment Variables y volver a desplegar.

Sin estas variables, en `npm run dev` las salas se guardan en memoria (sirve para probar en local con dos navegadores). En producción se muestra un aviso de configuración pendiente.

## Instalación

Requisitos: Node.js 20.9 o superior.

```bash
git clone https://github.com/joscal06/pokedex-tanstack.git
cd pokedex-tanstack
npm install
npm run dev
```

Abrir <http://localhost:3000>. La Pokédex no necesita variables de entorno, porque PokéAPI es pública. Solo el minijuego usa Supabase (ver arriba).

Build de producción:

```bash
npm run build
npm start
```

En desarrollo aparece el botón de **React Query Devtools** (esquina inferior derecha) para inspeccionar la caché, el estado de cada consulta y sus tiempos `staleTime`/`gcTime`.
