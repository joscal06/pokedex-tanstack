-- Esquema del minijuego de batallas en vivo.
-- Ejecutar una vez en Supabase → SQL Editor → New query → Run.

-- Salas de batalla. Contiene el estado completo y los secretos (tokens de los
-- jugadores y acciones aún no reveladas), por eso NO tiene políticas RLS:
-- solo el servidor, con la clave secreta, puede leerla o escribirla.
create table if not exists public.battles (
  id          text primary key,
  state       jsonb       not null,
  secrets     jsonb       not null,
  version     integer     not null default 1,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Señales públicas: solo el número de versión de cada sala. Los navegadores
-- se suscriben a sus cambios por Realtime y, al recibir uno, piden la vista
-- actualizada al servidor.
create table if not exists public.battle_signals (
  battle_id   text primary key references public.battles (id) on delete cascade,
  version     integer     not null,
  updated_at  timestamptz not null default now()
);

create index if not exists battles_updated_at_idx on public.battles (updated_at);

alter table public.battles enable row level security;
alter table public.battle_signals enable row level security;

drop policy if exists "Señales de batalla visibles" on public.battle_signals;
create policy "Señales de batalla visibles"
  on public.battle_signals
  for select
  to anon, authenticated
  using (true);

grant select on public.battle_signals to anon, authenticated;
grant all on public.battles, public.battle_signals to service_role;

-- Activa Realtime (postgres_changes) para las señales.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'battle_signals'
  ) then
    alter publication supabase_realtime add table public.battle_signals;
  end if;
end $$;

-- (Opcional) Borrar salas con más de 7 días sin actividad:
-- delete from public.battles where updated_at < now() - interval '7 days';
