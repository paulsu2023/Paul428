'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/config';
import { useRouter } from 'next/navigation';
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight, User, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const supabase = isDemoMode ? null : createClient();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (!supabase) {
        router.push('/app');
        return;
      }

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/app');
        router.refresh();
      } else if (mode === 'register') {
        if (password.length < 8) throw new Error('密码至少需要 8 位字符');
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { display_name: displayName || email.split('@')[0] } }
        });
        if (error) throw error;
        setMessage({ type: 'success', text: '注册成功！请查收邮件验证账号，然后登录。' });
        setMode('login');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/app`,
        });
        if (error) throw error;
        setMessage({ type: 'success', text: '重置密码邮件已发送，请查收。' });
      }
    } catch (error: any) {
      const msgMap: Record<string, string> = {
        'Invalid login credentials': '邮箱或密码错误',
        'Email not confirmed': '请先验证邮箱',
        'User already registered': '该邮箱已注册，请直接登录',
      };
      setMessage({ type: 'error', text: msgMap[error.message] || error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      {/* Background gradient effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-gradient-to-br from-violet-600 to-blue-600 p-3 rounded-2xl shadow-lg shadow-violet-900/40 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">TikTok AI Creator</h1>
          <p className="text-slate-400 text-sm mt-1">智能带货视频创作平台</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          {isDemoMode && (
            <div className="bg-amber-950/40 border border-amber-800/40 text-amber-200 rounded-xl p-4 mb-6 text-sm">
              当前为本地演示模式，认证已跳过。你可以直接进入创作台。
              <button
                type="button"
                onClick={() => router.push('/app')}
                className="mt-3 w-full py-2.5 rounded-lg bg-amber-500 text-slate-950 font-bold"
              >
                直接进入
              </button>
            </div>
          )}

          {/* Mode tabs */}
          <div className="flex gap-1 bg-slate-950 p-1 rounded-xl mb-8">
            <button
              onClick={() => { setMode('login'); setMessage(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'login' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >登录</button>
            <button
              onClick={() => { setMode('register'); setMessage(null); }}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${mode === 'register' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
            >注册</button>
          </div>

          {message && (
            <div className={`flex items-start gap-3 p-4 rounded-xl mb-6 text-sm ${message.type === 'error' ? 'bg-red-950/50 border border-red-800/50 text-red-300' : 'bg-green-950/50 border border-green-800/50 text-green-300'}`}>
              {message.type === 'error' ? <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /> : <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />}
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-4 top-3.5 text-slate-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="昵称（可选）"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-slate-200 text-sm placeholder-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-3.5 text-slate-500 w-4 h-4" />
              <input
                type="email"
                placeholder="邮箱地址"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-4 text-slate-200 text-sm placeholder-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
              />
            </div>

            {mode !== 'forgot' && (
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 text-slate-500 w-4 h-4" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={mode === 'register' ? '密码（至少 8 位）' : '密码'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-11 pr-12 text-slate-200 text-sm placeholder-slate-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            {mode === 'login' && (
              <div className="text-right">
                <button type="button" onClick={() => { setMode('forgot'); setMessage(null); }} className="text-xs text-slate-500 hover:text-violet-400 transition-colors">
                  忘记密码？
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? '登录' : mode === 'register' ? '注册账号' : '发送重置邮件'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {mode === 'forgot' && (
            <button onClick={() => { setMode('login'); setMessage(null); }} className="mt-4 w-full text-center text-sm text-slate-500 hover:text-slate-300 transition-colors">
              ← 返回登录
            </button>
          )}

          {mode === 'register' && (
            <p className="mt-6 text-xs text-slate-500 text-center leading-relaxed">
              注册即表示同意服务条款和隐私政策<br />
              新用户注册赠送 <span className="text-violet-400 font-semibold">10 点</span>免费额度
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
