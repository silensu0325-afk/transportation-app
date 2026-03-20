-- 交通費データテーブルに自由入力用の氏名カラムを追加
alter table public.transportation_expenses add column if not exists person_name text;

-- user_id を任意（null許容）に変更（自由入力のみでも保存できるようにするため）
alter table public.transportation_expenses alter column user_id drop not null;
