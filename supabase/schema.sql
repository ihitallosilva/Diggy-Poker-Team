-- Omaha Team Manager schema — execute no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid references public.teams(id) on delete set null,
  display_name text not null default 'Novo jogador',
  role text not null default 'player' check (role in ('owner','manager','player')),
  created_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  app_name text not null check (app_name in ('X-Poker','PPPoker')),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(team_id, app_name, name)
);

create table if not exists public.daily_sessions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.profiles(id) on delete cascade,
  session_date date not null,
  app_name text not null check (app_name in ('X-Poker','PPPoker')),
  club_name text not null,
  starting_balance numeric(14,2) not null check (starting_balance >= 0),
  ending_balance numeric(14,2) not null check (ending_balance >= 0),
  profit_loss numeric(14,2) generated always as (ending_balance - starting_balance) stored,
  rake numeric(14,2) not null default 0 check (rake >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_sessions_team_date_idx on public.daily_sessions(team_id, session_date desc);
create index if not exists daily_sessions_player_date_idx on public.daily_sessions(player_id, session_date desc);

create or replace function public.current_team_id()
returns uuid language sql stable security definer set search_path = public
as $$ select team_id from public.profiles where id = auth.uid() $$;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.daily_sessions enable row level security;

create policy "team members can read their team"
on public.teams for select to authenticated
using (id = public.current_team_id());

create policy "users can read own profile and managers can read team profiles"
on public.profiles for select to authenticated
using (id = auth.uid() or (team_id = public.current_team_id() and public.current_user_role() in ('owner','manager')));

-- Não permita que usuários alterem o próprio team_id ou role pelo cliente.
-- Mudanças de equipe/função devem ser feitas pelo administrador no SQL Editor.

create policy "team members can read clubs"
on public.clubs for select to authenticated
using (team_id = public.current_team_id());

create policy "managers can manage clubs"
on public.clubs for all to authenticated
using (team_id = public.current_team_id() and public.current_user_role() in ('owner','manager'))
with check (team_id = public.current_team_id() and public.current_user_role() in ('owner','manager'));

create policy "players read own sessions and managers read team sessions"
on public.daily_sessions for select to authenticated
using (
  (player_id = auth.uid() and team_id = public.current_team_id())
  or (team_id = public.current_team_id() and public.current_user_role() in ('owner','manager'))
);

create policy "players create own sessions in their team"
on public.daily_sessions for insert to authenticated
with check (player_id = auth.uid() and team_id = public.current_team_id());

create policy "players update own sessions and managers update team sessions"
on public.daily_sessions for update to authenticated
using (
  (player_id = auth.uid() and team_id = public.current_team_id())
  or (team_id = public.current_team_id() and public.current_user_role() in ('owner','manager'))
)
with check (
  (player_id = auth.uid() and team_id = public.current_team_id())
  or (team_id = public.current_team_id() and public.current_user_role() in ('owner','manager'))
);

create policy "players delete own sessions and managers delete team sessions"
on public.daily_sessions for delete to authenticated
using (
  (player_id = auth.uid() and team_id = public.current_team_id())
  or (team_id = public.current_team_id() and public.current_user_role() in ('owner','manager'))
);



-- Cria perfil automaticamente após cadastro no Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(coalesce(new.email,'Jogador'), '@', 1)),
    'player'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Criar usuário no Supabase Auth e depois associar a um time via SQL administrativo.
-- Exemplo de bootstrap (substitua os UUIDs e nomes):
-- insert into public.teams (id, name) values ('UUID-DO-TIME', 'Meu Time');
-- insert into public.profiles (id, team_id, display_name, role)
-- values ('UUID-DO-USUARIO-AUTH', 'UUID-DO-TIME', 'Hitallo', 'owner');


-- Bootstrap do primeiro time (execute depois que o primeiro usuário se cadastrar).
-- 1) Pegue o UUID do usuário em Authentication > Users.
-- 2) Execute os comandos abaixo substituindo os valores:
-- insert into public.teams (name) values ('Meu Time') returning id;
-- update public.profiles
-- set team_id = 'UUID-DO-TIME', role = 'owner', display_name = 'Administrador'
-- where id = 'UUID-DO-USUARIO-AUTH';
-- 3) Cadastre clubes:
-- insert into public.clubs (team_id, app_name, name)
-- values ('UUID-DO-TIME','X-Poker','Clube A'),
--        ('UUID-DO-TIME','X-Poker','Clube B'),
--        ('UUID-DO-TIME','PPPoker','Clube C'),
--        ('UUID-DO-TIME','PPPoker','Clube D');
