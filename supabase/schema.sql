-- ============================================================
-- TK带货Pro - Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. User Profiles (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  display_name text,
  avatar_url text,
  credits integer not null default 10,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);


-- 2. Projects
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '未命名项目',
  product_data jsonb default '{}',
  analysis_result jsonb,
  storyboard jsonb default '[]',
  settings jsonb default '{}',
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;
create policy "Users can CRUD own projects" on projects
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index projects_user_id_idx on projects(user_id);
create index projects_created_at_idx on projects(created_at desc);


-- 3. Credit Transactions
create table public.credit_transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount integer not null,  -- positive=credit, negative=debit
  balance_after integer not null,
  type text not null check (type in ('purchase', 'analyze', 'image_gen', 'audio_gen', 'bonus', 'refund')),
  description text,
  project_id uuid references public.projects(id),
  stripe_payment_id text,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;
create policy "Users can view own transactions" on credit_transactions
  for select using (auth.uid() = user_id);

create index transactions_user_id_idx on credit_transactions(user_id);


-- 4. Helper: Atomic credit deduction (prevents race conditions)
create or replace function public.deduct_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_description text,
  p_project_id uuid default null
) returns table(success boolean, new_balance integer, error text)
language plpgsql security definer
as $$
declare
  v_current_credits integer;
  v_new_balance integer;
begin
  -- Lock the row to prevent concurrent deductions
  select credits into v_current_credits
  from public.profiles
  where id = p_user_id
  for update;

  if v_current_credits < p_amount then
    return query select false, v_current_credits, '点数不足，请充值后重试。';
    return;
  end if;

  v_new_balance := v_current_credits - p_amount;

  update public.profiles set credits = v_new_balance, updated_at = now() where id = p_user_id;

  insert into public.credit_transactions (user_id, amount, balance_after, type, description, project_id)
  values (p_user_id, -p_amount, v_new_balance, p_type, p_description, p_project_id);

  return query select true, v_new_balance, null::text;
end;
$$;


-- 5. Helper: Add credits after purchase
create or replace function public.add_credits(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_description text,
  p_stripe_payment_id text default null
) returns integer
language plpgsql security definer
as $$
declare
  v_new_balance integer;
begin
  update public.profiles
  set credits = credits + p_amount, updated_at = now()
  where id = p_user_id
  returning credits into v_new_balance;

  insert into public.credit_transactions (user_id, amount, balance_after, type, description, stripe_payment_id)
  values (p_user_id, p_amount, v_new_balance, p_type, p_description, p_stripe_payment_id);

  return v_new_balance;
end;
$$;
