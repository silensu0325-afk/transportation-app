-- 1. profilesテーブルに承認フラグを追加
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

-- 2. 管理者は最初から承認済みに設定（任意。必要ならここで特定のアドレスをtrueに）
UPDATE public.profiles SET is_approved = TRUE WHERE email = 'silensu0325@gmail.com';

-- 3. トリガーの更新（新規ユーザーは未承認状態にする）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 最初の1人目や特定のアドレスを自動承認にするロジックも入れられますが、基本はFALSE
  INSERT INTO public.profiles (id, email, role, is_approved)
  VALUES (new.id, new.email, 'staff', FALSE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 交通費テーブルのRLSを「承認済みユーザーのみ」に制限
DROP POLICY IF EXISTS "Users can see own expenses" ON public.transportation_expenses;
CREATE POLICY "Users can see own expenses" ON public.transportation_expenses
  FOR SELECT USING (
    (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = TRUE)) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = '管理者'))
  );

DROP POLICY IF EXISTS "Users can insert own expenses" ON public.transportation_expenses;
CREATE POLICY "Users can insert own expenses" ON public.transportation_expenses
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = TRUE)
  );

DROP POLICY IF EXISTS "Users can update/delete own expenses" ON public.transportation_expenses;
CREATE POLICY "Users can update/delete own expenses" ON public.transportation_expenses
  FOR ALL USING (
    (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_approved = TRUE)) OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = '管理者'))
  );

-- 5. プロフィールテーブル自体のRLS（管理者は全員分を見れて更新できる）
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by owner and admin" ON public.profiles;
DROP POLICY IF EXISTS "プロファイルは所有者と管理者が閲覧可能" ON public.profiles;

CREATE POLICY "Profiles are viewable by owner and admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = '管理者'))
  );

DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "管理者はプロファイルを更新可能" ON public.profiles;

CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (role = 'admin' OR role = '管理者'))
  );
