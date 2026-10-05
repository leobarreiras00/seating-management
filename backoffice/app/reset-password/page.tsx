"use client";

/**
 * Redefinir palavra-passe (página pública, aberta pelo link enviado por e-mail).
 *   - Lógica inalterada: valida o token do URL, confirma as duas palavras-passe,
 *     chama POST /api/Auth/reset-password e redireciona para o login ao fim de 3 s.
 *   - Visual: cartão de vidro sobre o fundo aurora (como o login), título com
 *     degradê, campos .input com ícone e botões vivos.
 */

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, AlertTriangle, Lock, ArrowRight, ChevronLeft } from "lucide-react";
import { isStrongPassword, PASSWORD_ERROR, PASSWORD_HINT } from "@/lib/passwordPolicy";
import { getErrorMessage } from "@/lib/errors";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitError, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const error = !token
    ? "O link de recuperação é inválido ou está incompleto. Por favor, verifica o e-mail que recebeste."
    : submitError;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword !== confirmNewPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }
    if (!isStrongPassword(newPassword)) {
      setError(PASSWORD_ERROR);
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

    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // --- ECRÃ DE SUCESSO ---
  if (isSuccess) {
    return (
      <div className="flex flex-col items-center text-center animate-in">
        <div className="dialog-icon dialog-icon-success mb-6 !w-20 !h-20">
          <svg viewBox="0 0 24 24" className="w-10 h-10 draw-check" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-gradient tracking-tight mb-2">Palavra-passe Redefinida!</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-8">
          A tua nova palavra-passe foi guardada com sucesso. Já podes aceder à tua conta de forma segura.
        </p>
        <button onClick={() => router.push("/login")} className="btn btn-success btn-lg btn-block">
          Ir para o Login <ArrowRight className="w-4 h-4" />
        </button>
        <p className="text-xs text-slate-400 mt-4">Serás redirecionado automaticamente em instantes.</p>
      </div>
    );
  }

  // --- FORMULÁRIO ---
  return (
    <div className="animate-in">
      <div className="flex flex-col items-center mb-8 text-center">
        <div className="mb-6 flex justify-center">
          <Image src="/seatly_wrt.png" alt="Seatly Logo" width={160} height={55} className="object-contain w-32 sm:w-40 h-auto" priority />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gradient tracking-tight mb-1.5">Escolhe a nova palavra-passe</h1>
        <p className="text-slate-500 text-sm">Cria uma palavra-passe forte e segura para a tua conta.</p>
      </div>

      <form onSubmit={handleReset} className="space-y-4 sm:space-y-5">
        <div>
          <label htmlFor="rp-new" className="field-label">Nova Palavra-passe</label>
          <div className="input-wrap">
            <Lock className="input-icon" />
            <input id="rp-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={!token} className="input input-with-icon" placeholder={PASSWORD_HINT} required />
          </div>
        </div>

        <div>
          <label htmlFor="rp-confirm" className="field-label">Confirmar Nova Palavra-passe</label>
          <div className="input-wrap">
            <Lock className="input-icon" />
            <input id="rp-confirm" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={!token} className={`input input-with-icon ${confirmNewPassword && newPassword !== confirmNewPassword ? 'input-invalid' : ''}`} placeholder="Repete a palavra-passe" required />
          </div>
        </div>

        {error && (
          <div className="notice notice-error">
            <AlertTriangle className="h-5 w-5" /> <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={isLoading || !token || !isStrongPassword(newPassword) || newPassword !== confirmNewPassword} className="btn btn-primary btn-lg btn-block mt-1">
          {isLoading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" /> A Guardar...</span> : "Guardar Palavra-passe"}
        </button>

        <Link href="/login" className="btn btn-ghost btn-block">
          <ChevronLeft className="w-4 h-4" /> Voltar ao Login
        </Link>
      </form>
    </div>
  );
}

export default function ResetPasswordScreen() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4 sm:p-6 md:p-8 text-slate-900 relative overflow-hidden">

      <div className="flex-1"></div>

      {/* Cartão de vidro sobre o fundo aurora (igual ao login) */}
      <div className="w-full max-w-[440px] card-main !p-7 sm:!p-10 z-10 relative reveal">
        {/* Next.js 13+ requer que componentes com useSearchParams() estejam envolvidos num Suspense Boundary */}
        <Suspense fallback={<div className="flex justify-center py-10"><div className="spinner" /></div>}>
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
