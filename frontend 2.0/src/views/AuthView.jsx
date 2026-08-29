import React, { useState } from 'react';
import { Lock, User, PlusCircle, LogIn, Sparkles, Eye, EyeOff, ShieldCheck, TrendingUp, BarChart3 } from 'lucide-react';

export default function AuthView({ onLoginSuccess, setToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsLoading(true);
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Ocorreu um erro. Verifique suas credenciais.');
      }

      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        if (setToast) {
          setToast({ message: `Bem-vindo de volta! Sessão iniciada.`, type: 'success' });
        }
        onLoginSuccess();
      } else {
        if (setToast) {
          setToast({ message: 'Conta criada com sucesso! Você já pode entrar.', type: 'success' });
        }
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
      if (setToast) {
        setToast({ message: err.message, type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#07070d] relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[520px] h-[520px] bg-violet-600/12 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/5 rounded-full blur-[160px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-4 tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>DeclarAtivo 2.0</span>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Gestão & Imposto de Renda
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            Controle de carteira, preço médio e apuração inteligente para Investidores
          </p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {/* Subtle top card glow */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Mode Switch Tabs */}
          <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5 mb-6">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                isLogin
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
                !isLogin
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Cadastrar
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                E-mail ou Usuário
              </label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu_usuario ou email@exemplo.com"
                  className="w-full pl-10 pr-4 py-3 bg-black/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Senha de Acesso
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 bg-black/50 border border-white/10 rounded-2xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2 animate-fade-in">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 rounded-2xl font-black text-sm tracking-wide text-white transition-all shadow-xl flex items-center justify-center gap-2 mt-2 ${
                isLogin
                  ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-indigo-600/25 active:scale-[0.99]'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 hover:from-emerald-500 hover:to-teal-400 shadow-emerald-600/25 active:scale-[0.99]'
              } disabled:opacity-50 disabled:pointer-events-none cursor-pointer`}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isLogin ? (
                'Acessar Painel 2.0'
              ) : (
                'Criar Minha Conta'
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-6 pt-5 border-t border-white/5 flex items-center justify-center gap-2 text-zinc-500 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
            <span>Dados protegidos com criptografia ponta a ponta</span>
          </div>
        </div>

        {/* Features preview footer */}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <BarChart3 className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
            <span className="text-[10px] text-zinc-400 font-medium">Preço Médio</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <span className="text-[10px] text-zinc-400 font-medium">DARF Automático</span>
          </div>
          <div className="p-2.5 rounded-2xl bg-white/[0.02] border border-white/5">
            <ShieldCheck className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <span className="text-[10px] text-zinc-400 font-medium">Bens & Direitos</span>
          </div>
        </div>
      </div>
    </div>
  );
}
