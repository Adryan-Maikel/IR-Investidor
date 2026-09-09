import React, { useState } from 'react';
import {
  BarChart3,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  PlusCircle,
  ShieldCheck,
  TrendingUp,
  User,
} from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function AuthView({ onLoginSuccess, setToast, theme, onToggleTheme }) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Ocorreu um erro. Verifique suas credenciais.');
      }

      if (isLogin) {
        localStorage.setItem('token', data.access_token);
        setToast?.({ message: 'Bem-vindo de volta! Sessão iniciada.', type: 'success' });
        onLoginSuccess();
      } else {
        setToast?.({ message: 'Conta criada com sucesso! Você já pode entrar.', type: 'success' });
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      setError(err.message);
      setToast?.({ message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const selectMode = (loginMode) => {
    setIsLogin(loginMode);
    setError('');
  };

  return (
    <div className="theme-shell min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-sm animate-fade-in">
        <div className="mb-5 flex justify-end">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-sm font-black text-indigo-300">
              D
            </div>
            <div>
              <p className="text-sm font-extrabold text-white">DeclarAtivo</p>
              <p className="text-[11px] text-zinc-500">Gestão tributária para investidores</p>
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight text-white">
            {isLogin ? 'Acesse sua carteira' : 'Crie sua conta'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Controle de posições, preço médio e informações para declaração em um único lugar.
          </p>
        </div>

        <div className="surface-panel rounded-2xl p-6 sm:p-7">
          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
            <button
              type="button"
              onClick={() => selectMode(true)}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-bold cursor-pointer ${
                isLogin ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              Entrar
            </button>
            <button
              type="button"
              onClick={() => selectMode(false)}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2.5 text-xs font-bold cursor-pointer ${
                !isLogin ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Cadastrar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                E-mail ou usuário
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu_usuario ou email@exemplo.com"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-4 text-sm font-medium text-white placeholder-zinc-600 outline-none focus:border-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                Senha de acesso
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-3 pl-10 pr-11 text-sm font-medium text-white placeholder-zinc-600 outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-300 cursor-pointer"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="theme-control-accent mt-2 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : isLogin ? (
                'Acessar painel'
              ) : (
                'Criar conta'
              )}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-2 border-t border-zinc-800 pt-5 text-[11px] text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>Seus dados permanecem protegidos.</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 divide-x divide-zinc-800 border-y border-zinc-800 py-4 text-center">
          <div className="px-2">
            <BarChart3 className="mx-auto mb-1.5 h-4 w-4 text-zinc-500" />
            <span className="text-[10px] font-medium text-zinc-500">Preço médio</span>
          </div>
          <div className="px-2">
            <TrendingUp className="mx-auto mb-1.5 h-4 w-4 text-zinc-500" />
            <span className="text-[10px] font-medium text-zinc-500">DARF</span>
          </div>
          <div className="px-2">
            <ShieldCheck className="mx-auto mb-1.5 h-4 w-4 text-zinc-500" />
            <span className="text-[10px] font-medium text-zinc-500">IRPF</span>
          </div>
        </div>
      </div>
    </div>
  );
}
