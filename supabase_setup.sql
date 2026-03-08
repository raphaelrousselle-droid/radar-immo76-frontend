-- Exécuter ce SQL dans l'éditeur SQL de Supabase (SQL Editor)
-- Il crée la table user_data + les policies de sécurité (RLS)

-- Table unique pour stocker toutes les données utilisateur
create table if not exists public.user_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data_key text not null,         -- ex: "projets", "sci_projets", "offres", "photos"
  data_value jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

-- Index pour accès rapide par user + clé
create unique index if not exists idx_user_data_unique on public.user_data(user_id, data_key);
create index if not exists idx_user_data_user on public.user_data(user_id);

-- Activer Row Level Security
alter table public.user_data enable row level security;

-- Chaque utilisateur ne voit/modifie que ses propres données
create policy "Users can read own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update
  using (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.user_data for delete
  using (auth.uid() = user_id);
