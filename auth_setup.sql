-- 1. プロフィールテーブルの作成
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'staff', -- 'admin' または 'staff'
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLSを有効化
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 自分のプロフィールのみ参照可能
CREATE POLICY "Users can see their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. 交通費テーブルのRLS設定
ALTER TABLE public.transportation_expenses ENABLE ROW LEVEL SECURITY;

-- 古いポリシーがあれば削除（もし存在する場合）
DROP POLICY IF EXISTS "Enable all access for all users" ON public.transportation_expenses;
DROP POLICY IF EXISTS "Users can see own expenses" ON public.transportation_expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.transportation_expenses;
DROP POLICY IF EXISTS "Users can update/delete own expenses" ON public.transportation_expenses;

-- ポリシー：自分のデータまたは管理者が参照可能
CREATE POLICY "Users can see own expenses" ON public.transportation_expenses
  FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ポリシー：自分のデータのみ挿入可能
CREATE POLICY "Users can insert own expenses" ON public.transportation_expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ポリシー：自分のデータまたは管理者が操作可能
CREATE POLICY "Users can update/delete own expenses" ON public.transportation_expenses
  FOR ALL USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. サインアップ時に自動でプロフィールを作成するトリガー
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'staff');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
