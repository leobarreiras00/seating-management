"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, AlertTriangle, Mail, Lock, CheckCircle2, ChevronLeft } from "lucide-react";

export default function LoginScreen() {
  const router = useRouter();

  // Estados do Formulário Base
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Estados de Vista
  const [currentView, setCurrentView] = useState<"login" | "firstLoginReset" | "forgotPassword">("login");

  // Estados para Primeiro Login (Opção B)
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Estados para Esqueci-me da Palavra-passe
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // Se a API devolver 403 e a flag estiver ativa, entramos na Opção B
        if (res.status === 403 && data?.requiresPasswordReset) {
          setCurrentView("firstLoginReset");
          return;
        }
        throw new Error(data?.message || "Credenciais inválidas.");
      }

      if (data.role !== "SuperAdmin") {
        throw new Error("Acesso Negado. Apenas a administração central pode aceder ao Backoffice.");
      }

      localStorage.setItem("token", data.token);
      router.push("/dashboard");
      
    } catch (err: any) {
      if (err.message.includes("Failed to fetch")) {
        setError("A API não está a responder. Verifica a tua ligação.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstLoginReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/first-login-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: email, 
          temporaryPassword: password, 
          newPassword: newPassword 
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.message || "Erro ao definir a nova palavra-passe.");

      if (data.role !== "SuperAdmin") {
        throw new Error("Acesso Negado. Apenas a administração central pode aceder ao Backoffice.");
      }

      // Login automático após reset bem sucedido
      localStorage.setItem("token", data.token);
      router.push("/dashboard");

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setResetSuccessMessage("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.message || "Erro ao solicitar a recuperação.");

      setResetSuccessMessage(data?.message || "Se o e-mail existir, enviámos as instruções de recuperação.");
      setTimeout(() => {
        setCurrentView("login");
        setResetSuccessMessage("");
        setResetEmail("");
      }, 4000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-slate-300 via-slate-100 to-slate-200 p-4 sm:p-6 md:p-8 text-slate-900 relative overflow-hidden">
      
      {/* Background Decorativo Suave */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-400/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="flex-1"></div>

      <div className="w-full max-w-[440px] bg-white/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(168,85,247,0.25)] border border-white/60 transition-all z-10 relative overflow-hidden">
        
        {/* --- VISTA: LOGIN NORMAL --- */}
        {currentView === "login" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="mb-6 flex justify-center">
                <Image src="/seatly_wrt.png" alt="Seatly Logo" width={160} height={55} className="object-contain w-32 sm:w-40 h-auto" priority />
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Bem-vindo de volta</h2>
              <p className="text-slate-500 text-xs sm:text-sm font-medium">Insere o teu e-mail para aceder ao sistema.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-slate-400" /></div>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-5 py-3.5 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 text-slate-800 text-sm font-medium placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300" placeholder="admin@seatly.com" required />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5 ml-1 mr-1">
                  <label className="block text-sm font-bold text-slate-700">Palavra-passe</label>
                  <button type="button" onClick={() => { setCurrentView("forgotPassword"); setError(""); }} className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors">Esqueceu-se?</button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-400" /></div>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-5 py-3.5 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 text-slate-800 text-sm font-medium placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300" placeholder="••••••••" required />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50/90 text-red-600 text-sm font-semibold rounded-2xl border border-red-100 flex items-start gap-3 animate-in fade-in">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={isLoading || !email || !password} className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 mt-2 flex justify-center items-center active:scale-[0.98] disabled:opacity-70">
                {isLoading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" /> A verificar...</span> : "ENTRAR NO SISTEMA"}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-200/60 flex items-center justify-center gap-2 text-slate-600">
              <Lock className="w-4 h-4 text-purple-500" />
              <span className="text-xs font-semibold uppercase tracking-wider">Acesso Restrito · Encriptação E2E</span>
            </div>
          </div>
        )}

        {/* --- VISTA: PRIMEIRO LOGIN (OPÇÃO B) --- */}
        {currentView === "firstLoginReset" && (
          <div className="animate-in slide-in-from-right-8 fade-in duration-500">
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                <Lock className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Segurança em 1º Lugar</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Bem-vindo ao Seatly! Estás a usar uma palavra-passe temporária. Para tua segurança, define agora a tua palavra-passe definitiva.
              </p>
            </div>

            <form onSubmit={handleFirstLoginReset} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Nova Palavra-passe</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-slate-800 font-bold placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none" placeholder="Mínimo 6 caracteres" required />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Confirmar Nova Palavra-passe</label>
                <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className={`w-full px-5 py-3.5 bg-slate-50/80 rounded-2xl border font-bold placeholder-slate-400 focus:bg-white outline-none transition-all ${confirmNewPassword && newPassword !== confirmNewPassword ? 'border-red-400 focus:ring-2 focus:ring-red-500 text-red-600' : 'border-slate-200/80 text-slate-800 focus:ring-2 focus:ring-purple-500'}`} placeholder="Repete a palavra-passe" required />
              </div>

              {error && (
                <div className="p-3 bg-red-50/90 text-red-600 text-sm font-semibold rounded-2xl border border-red-100 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={isLoading || newPassword.length < 6 || newPassword !== confirmNewPassword} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-lg mt-4 flex justify-center items-center disabled:opacity-50">
                {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Guardar e Entrar no Dashboard"}
              </button>
            </form>
          </div>
        )}

        {/* --- VISTA: ESQUECI-ME DA PALAVRA-PASSE --- */}
        {currentView === "forgotPassword" && (
          <div className="animate-in slide-in-from-left-8 fade-in duration-500">
            <button onClick={() => { setCurrentView("login"); setError(""); setResetSuccessMessage(""); }} className="flex items-center text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors mb-6">
              <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Login
            </button>
            
            <div className="flex flex-col mb-6 text-left">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Recuperar Acesso</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Insere o e-mail associado à tua conta. Iremos enviar-te um link seguro para redefinir a tua palavra-passe.
              </p>
            </div>

            {resetSuccessMessage ? (
              <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex flex-col items-center text-center animate-in zoom-in-95">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
                <p className="text-emerald-800 font-bold text-sm leading-relaxed">{resetSuccessMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">O teu E-mail</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-slate-400" /></div>
                    <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} className="w-full pl-11 pr-5 py-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 text-slate-800 font-medium focus:bg-white focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="exemplo@empresa.com" required />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50/90 text-red-600 text-sm font-semibold rounded-2xl border border-red-100 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /> <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={isLoading || !resetEmail} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-lg mt-4 flex justify-center items-center disabled:opacity-50">
                  {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Enviar Link de Recuperação"}
                </button>
              </form>
            )}
          </div>
        )}

      </div>

      <div className="flex-1 flex items-end pb-2 sm:pb-6">
        <div className="text-slate-500 text-xs sm:text-sm font-medium mt-8">
          Copyright © Seatly {new Date().getFullYear()}.
        </div>
      </div>

    </div>
  );
}