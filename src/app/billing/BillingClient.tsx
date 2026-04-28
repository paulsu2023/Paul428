'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/config';
import { useRouter } from 'next/navigation';
import { Sparkles, Zap, Crown, Star, CreditCard, History, LogOut, ArrowRight, CheckCircle, AlertCircle, Coins } from 'lucide-react';
import { CREDIT_PACKAGES } from '@/constants';

interface Props {
  profile: { credits: number; email: string; display_name: string; plan: string };
  isDemoMode?: boolean;
}

export default function BillingPage({ profile, isDemoMode: pageDemoMode = false }: Props) {
  const router = useRouter();
  const supabase = isDemoMode ? null : createClient();
  const activeDemoMode = isDemoMode || pageDemoMode;
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handlePurchase = async (packageId: string) => {
    if (activeDemoMode) {
      setMessage('本地演示模式未接入 Stripe，支付已禁用。');
      return;
    }

    setLoading(packageId);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e: any) {
      setMessage(e.message);
      setLoading(null);
    }
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/login');
      return;
    }

    router.push('/app');
  };

  const packageIcons: Record<string, React.ReactNode> = {
    starter: <Zap className="text-yellow-400" size={24} />,
    standard: <Star className="text-violet-400" size={24} />,
    pro: <Crown className="text-amber-400" size={24} />,
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-violet-600 to-blue-600 p-2 rounded-xl">
              <Sparkles className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white">我的账户</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors">
            <LogOut size={16} /> 退出登录
          </button>
        </div>

        {/* User info & credits */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="w-16 h-16 bg-gradient-to-br from-violet-600 to-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold text-white">
              {profile.display_name?.[0]?.toUpperCase() || profile.email?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-lg">{profile.display_name || '用户'}</h2>
              <p className="text-slate-400 text-sm">{profile.email}</p>
              <span className="text-xs bg-violet-900/50 text-violet-300 px-2 py-0.5 rounded mt-1 inline-block border border-violet-700/50 capitalize">{profile.plan} 计划</span>
            </div>
            <div className="flex flex-col items-center bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[140px]">
              <Coins className="text-amber-400 mb-1" size={28} />
              <span className="text-3xl font-bold text-white">{profile.credits}</span>
              <span className="text-slate-400 text-xs mt-1">剩余点数</span>
            </div>
          </div>
        </div>

        {/* Credit cost reference */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { op: '产品分析', cost: 5, icon: '🧠' },
            { op: '生成一帧图', cost: 2, icon: '🖼️' },
            { op: '直接生成视频', cost: 6, icon: '🎬' },
            { op: '生成语音', cost: 1, icon: '🎙️' },
          ].map(item => (
            <div key={item.op} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
              <span className="text-2xl">{item.icon}</span>
              <p className="text-xs text-slate-400 mt-1">{item.op}</p>
              <p className="text-sm font-bold text-violet-400 mt-0.5">{item.cost} 点</p>
            </div>
          ))}
        </div>

        {/* Packages */}
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CreditCard className="text-violet-400" size={20} /> 充值点数
        </h2>

        {message && (
          <div className="bg-red-950/50 border border-red-800/50 text-red-300 p-4 rounded-xl mb-6 flex items-center gap-2">
            <AlertCircle size={16} /> {message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {CREDIT_PACKAGES.map(pkg => (
            <div key={pkg.id} className={`relative bg-slate-900 border rounded-2xl p-6 flex flex-col transition-all hover:border-violet-500/50 ${pkg.popular ? 'border-violet-500 shadow-lg shadow-violet-900/20' : 'border-slate-800'}`}>
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                  最受欢迎
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                {packageIcons[pkg.id]}
                <h3 className="text-white font-bold">{pkg.name}</h3>
              </div>
              <div className="mb-2">
                <span className="text-3xl font-bold text-white">¥{pkg.price / 100}</span>
              </div>
              <p className="text-violet-400 font-semibold mb-1">{pkg.credits} 点数</p>
              <p className="text-slate-400 text-xs mb-6 flex-1">{pkg.description}</p>
              <button
                onClick={() => handlePurchase(pkg.id)}
                disabled={loading === pkg.id || activeDemoMode}
                className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${pkg.popular ? 'bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'} disabled:opacity-60`}
              >
                {loading === pkg.id ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRight size={14} /> {activeDemoMode ? '演示模式' : '立即购买'}</>}
              </button>
            </div>
          ))}
        </div>

        <div className={`flex items-center gap-2 p-4 rounded-xl text-sm ${activeDemoMode ? 'bg-amber-950/30 border border-amber-800/30 text-amber-300' : 'bg-green-950/30 border border-green-800/30 text-green-400'}`}>
          <CheckCircle size={16} className="flex-shrink-0" />
          {activeDemoMode ? '当前为本地演示模式：认证、计费、Stripe 已绕过，仅保留创作流程验证。' : '支付由 Stripe 安全处理，支持全球主流信用卡。充值后点数即时到账。'}
        </div>

        <div className="mt-6 text-center">
          <a href="/app" className="text-slate-400 hover:text-white text-sm transition-colors">← 返回创作界面</a>
        </div>
      </div>
    </div>
  );
}
