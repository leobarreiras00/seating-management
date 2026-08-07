"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, AlertTriangle, Lock, CheckCircle2, ArrowRight } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("O link de recuperação é inválido ou está incompleto. Por favor, verifica o e-mail que recebeste.");
    }
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.message || "Erro ao redefinir a palavra-passe.");

      setIsSuccess(true);
      
      // Redireciona para o login após 3 segundos
      setTimeout(() => {
        router.push("/login");
      }, 3000);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-500">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Palavra-passe Redefinida!</h2>
        <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">
          A tua nova palavra-passe foi guardada com sucesso. Já podes aceder à tua conta de forma segura.
        </p>
        <button onClick={() => router.push("/login")} className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-lg">
          Ir para o Login <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="mb-6 flex justify-center">
          <Image src="/seatly_wrt.png" alt="Seatly Logo" width={160} height={55} className="object-contain w-32 sm:w-40 h-auto" priority />
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-1">Escolhe a nova palavra-passe</h2>
        <p className="text-slate-500 text-xs sm:text-sm font-medium">Cria uma palavra-passe forte e segura para a tua conta.</p>
      </div>

      <form onSubmit={handleReset} className="space-y-4 sm:space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Nova Palavra-passe</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-400" /></div>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={!token} className="w-full pl-11 pr-5 py-3.5 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 text-slate-800 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300" placeholder="Mínimo 6 caracteres" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Confirmar Nova Palavra-passe</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-slate-400" /></div>
            <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={!token} className={`w-full pl-11 pr-5 py-3.5 bg-slate-50/80 backdrop-blur-sm rounded-2xl border text-sm font-medium focus:bg-white focus:outline-none transition-all duration-300 ${confirmNewPassword && newPassword !== confirmNewPassword ? 'border-red-400 text-red-600 focus:ring-2 focus:ring-red-500' : 'border-slate-200/80 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent'}`} placeholder="Repete a palavra-passe" required />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50/90 text-red-600 text-sm font-semibold rounded-2xl border border-red-100 flex items-start gap-3 animate-in fade-in">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={isLoading || !token || newPassword.length < 6 || newPassword !== confirmNewPassword} className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 mt-2 flex justify-center items-center active:scale-[0.98] disabled:opacity-70">
          {isLoading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" /> A Guardar...</span> : "Guardar Palavra-passe"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordScreen() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-slate-300 via-slate-100 to-slate-200 p-4 sm:p-6 md:p-8 text-slate-900 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-400/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-emerald-400/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="flex-1"></div>

      <div className="w-full max-w-[440px] bg-white/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(168,85,247,0.25)] border border-white/60 transition-all z-10 relative overflow-hidden">
        {/* Next.js 13+ requer que componentes com useSearchParams() estejam envolvidos num Suspense Boundary */}
        <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-purple-500" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>

      <div className="flex-1 flex items-end pb-2 sm:pb-6">
        <div className="text-slate-500 text-xs sm:text-sm font-medium mt-8">
          Copyright © Seatly {new Date().getFullYear()}.
        </div>
      </div>
    </div>
  );
}