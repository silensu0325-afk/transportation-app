-- ==========================================
-- 交通費精算システム スタンドアロン版 セットアップSQL
-- ==========================================

-- 1. 交通費データテーブルの作成
create table if not exists public.transportation_expenses (
  id uuid default gen_random_uuid() primary key,
  person_name text not null, -- 入力者の氏名（自由入力）
  user_id uuid,               -- (オプション) 既存のシステムと連携する場合用
  date date not null,
  destination text not null,
  route text,
  section_from text,
  section_to text,
  distance numeric default 0,
  is_round_trip boolean default false,
  amount integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. お気に入り行先テーブルの作成
create table if not exists public.favorite_destinations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  destination text not null,
  route text,
  section_from text,
  section_to text,
  distance numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. セキュリティ設定 (RLS) の有効化
alter table public.transportation_expenses enable row level security;
alter table public.favorite_destinations enable row level security;

-- 4. 誰でも読み書き可能にするポリシーの作成
-- 注意: 本番環境では認証済みのユーザーのみに変更することを推奨します
drop policy if exists "Allow all actions on transportation_expenses" on public.transportation_expenses;
create policy "Allow all actions on transportation_expenses" on public.transportation_expenses for all using (true) with check (true);

drop policy if exists "Allow all actions on favorite_destinations" on public.favorite_destinations;
create policy "Allow all actions on favorite_destinations" on public.favorite_destinations for all using (true) with check (true);
