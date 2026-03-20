import React, { useState, useEffect } from 'react';
import { TransportationExpenses } from './components/TransportationExpenses';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkApproval(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkApproval(session.user.id);
      else {
        setIsApproved(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkApproval = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const userEmail = user?.email?.toLowerCase();

    const { data, error } = await supabase
      .from('profiles')
      .select('is_approved, role')
      .eq('id', userId)
      .single();
    
    // あなたのアドレス、またはroleがadmin/管理者なら承認済みとする
    if (userEmail === 'silensu0325@gmail.com') {
      setIsApproved(true);
    } else if (!error && data) {
      setIsApproved(data.is_approved || data.role === 'admin' || data.role === '管理者');
    } else {
      setIsApproved(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-indigo-600 font-black animate-pulse text-2xl tracking-tighter">
          LOADING...
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  if (isApproved !== true) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl p-8 border border-indigo-100 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-600">
            <span className="text-4xl">⏳</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">承認待ちです</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            アカウントの作成ありがとうございます。<br />
            現在、管理者の承認をお待ちしております。<br />
            承認されるまでしばらくお待ちください。
          </p>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition"
          >
            ログアウト
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <TransportationExpenses user={session.user} />
      </main>
    </div>
  );
}

export default App;
