"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, AlertTriangle, Mail, Lock, CheckCircle2, ChevronLeft } from "lucide-react";
import ContactModal from "@/components/ContactModal";
import SeatMap from "@/components/SeatMap";
import { isStrongPassword, PASSWORD_ERROR, PASSWORD_HINT } from "@/lib/passwordPolicy";
import { getErrorMessage } from "@/lib/errors";

export default function LoginScreen() {
  const router = useRouter();

  // Estados do Formulário Base
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Estados de Vista
  const [currentView, setCurrentView] = useState<"login" | "firstLoginReset" | "forgotPassword">("login");
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Estados para Primeiro Login (Opção B)
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Estados para Esqueci-me da Palavra-passe
  const [resetEmail, setResetEmail] = useState("");
  const [resetSuccessMessage, setResetSuccessMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      setError("Introduz a palavra-passe.");
      return;
    }

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
      
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      if (message.includes("Failed to fetch")) {
        setError("A API não está a responder. Verifica a tua ligação.");
      } else {
        setError(message);
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
    if (!isStrongPassword(newPassword)) {
      setError(PASSWORD_ERROR);
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

      localStorage.setItem("token", data.token);
      router.push("/dashboard");

    } catch (err: unknown) {
      setError(getErrorMessage(err));
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

    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Só visual: quais lugares da ilustração aparecem acesos (mais à frente, menos atrás)
  const isSeatLit = (row: number, col: number) =>
    ((row * 131 + col * 71 + row * col * 17) % 97) / 97 < 0.8 - row * 0.05;

  // Linha de erro partilhada pelas três vistas (usa a classe .notice do globals.css)
  const errorLine = error && (
    <p className="notice notice-error mt-3" role="alert">
      <AlertTriangle className="w-4 h-4" /> <span>{error}</span>
    </p>
  );

  // Links legais: ficam colados ao botão principal de cada vista (pedido de design)
  const legalLinks = (
    <nav aria-label="Links legais" className="mt-5 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 text-xs font-semibold text-slate-500 whitespace-nowrap">
      <button type="button" onClick={() => setIsContactModalOpen(true)} className="hover:text-purple-700 transition-colors rounded">
        Contactar suporte
      </button>
      <span aria-hidden className="w-1 h-1 rounded-full bg-purple-300" />
      <Link href="/privacy" className="hover:text-purple-700 transition-colors rounded">
        Política de privacidade
      </Link>
      <span aria-hidden className="w-1 h-1 rounded-full bg-purple-300" />
      <Link href="/terms" className="hover:text-purple-700 transition-colors rounded">
        Termos de serviço
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_0.95fr]">

      {/* --- PAINEL VISUAL: a sala, com os lugares a acender --- */}
      <aside className="hidden lg:flex relative flex-col justify-between overflow-hidden text-white px-14 py-14 bg-[linear-gradient(155deg,#2e1065_0%,#4c1d95_45%,#1e3a8a_100%)]">
        {/* Halos de cor atrás da ilustração */}
        <div aria-hidden className="absolute -top-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/30 blur-3xl float-slow" />
        <div aria-hidden className="absolute -bottom-40 -left-24 w-[30rem] h-[30rem] rounded-full bg-blue-500/30 blur-3xl float-slow" style={{ animationDelay: "-6s" }} />

        <p className="relative font-display text-lg text-purple-200 reveal">Administração central</p>

        <div className="relative flex flex-col items-center my-auto py-10 reveal" style={{ ["--i" as string]: 2 }}>
          <div className="w-72 h-2 rounded-full bg-gradient-to-r from-fuchsia-300/60 via-white/70 to-blue-300/60 shadow-[0_0_40px_rgba(196,181,253,0.7)] mb-2" />
          <p className="text-xs text-purple-200 mb-8 tracking-widest uppercase">Palco</p>
          <SeatMap
            rows={10}
            cols={18}
            aisleEvery={9}
            size={15}
            gap={5}
            reveal
            filled={isSeatLit}
            style={{ ["--seat-off" as string]: "rgba(255,255,255,0.14)", ["--seat-on" as string]: "#34d399" }}
          />
        </div>

        <div className="relative reveal" style={{ ["--i" as string]: 4 }}>
          <h2 className="font-display text-4xl xl:text-5xl font-bold leading-[1.05] max-w-md">
            Cada convidado no <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">seu lugar.</span>
          </h2>
          <p className="mt-4 text-purple-100/90 text-base max-w-sm leading-relaxed">
            Empresas, eventos e entradas validadas, num só painel.
          </p>
        </div>
      </aside>

      {/* --- FORMULÁRIO (cartão de vidro sobre a aurora) --- */}
      <div className="flex flex-col min-h-screen px-5 sm:px-12 py-8">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[420px] card-main !p-7 sm:!p-9 reveal">

            <Image src="/seatly_wrt.png" alt="Seatly" width={160} height={55} className="object-contain w-28 h-auto -ml-2 mb-7" priority />

            {/* --- VISTA: LOGIN NORMAL --- */}
            {currentView === "login" && (
              <div className="animate-in">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Entrar</h1>
                <p className="text-slate-500 text-[15px] mb-7">Acede ao painel de administração do Seatly.</p>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label htmlFor="login-email" className="field-label">E-mail</label>
                    <div className="input-wrap">
                      <Mail className="input-icon" />
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail((e.target.value || "").toLowerCase())}
                        className="input input-with-icon"
                        placeholder="admin@seatly.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="login-password" className="field-label !mb-0">Palavra-passe</label>
                      <button type="button" onClick={() => { setCurrentView("forgotPassword"); setError(""); }} className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors rounded">Esqueceu-se?</button>
                    </div>
                    <div className="input-wrap">
                      <Lock className="input-icon" />
                      <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`input input-with-icon ${error ? "input-invalid" : ""}`} placeholder="••••••••" required />
                    </div>
                    {errorLine}
                  </div>

                  <button type="submit" disabled={isLoading || !email || !password} className="btn btn-primary btn-lg btn-block mt-1">
                    {isLoading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" /> A verificar...</span> : "Entrar"}
                  </button>
                </form>

                {legalLinks}
              </div>
            )}

            {/* --- VISTA: PRIMEIRO LOGIN (OPÇÃO B) --- */}
            {currentView === "firstLoginReset" && (
              <div className="animate-in">
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Define a tua palavra-passe</h1>
                <p className="text-slate-500 text-[15px] leading-relaxed mb-7">
                  Bem-vindo ao Seatly! Estás a usar uma palavra-passe temporária. Para tua segurança, define agora a tua palavra-passe definitiva.
                </p>

                <form onSubmit={handleFirstLoginReset} className="space-y-5">
                  <div>
                    <label htmlFor="new-password" className="field-label">Nova palavra-passe</label>
                    <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input" placeholder={PASSWORD_HINT} required />
                  </div>
                  <div>
                    <label htmlFor="confirm-new-password" className="field-label">Confirmar nova palavra-passe</label>
                    <input id="confirm-new-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className={`input ${confirmNewPassword && newPassword !== confirmNewPassword ? "input-invalid" : ""}`} placeholder="Repete a palavra-passe" required />
                    {errorLine}
                  </div>

                  <button type="submit" disabled={isLoading || !isStrongPassword(newPassword) || newPassword !== confirmNewPassword} className="btn btn-primary btn-lg btn-block mt-1">
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Guardar e entrar no dashboard"}
                  </button>
                </form>

                {legalLinks}
              </div>
            )}

            {/* --- VISTA: ESQUECI-ME DA PALAVRA-PASSE --- */}
            {currentView === "forgotPassword" && (
              <div className="animate-in">
                <button onClick={() => { setCurrentView("login"); setError(""); setResetSuccessMessage(""); }} className="flex items-center text-sm font-semibold text-slate-500 hover:text-purple-700 transition-colors mb-5 -ml-1 rounded">
                  <ChevronLeft className="w-4 h-4 mr-0.5" /> Voltar ao login
                </button>

                <h1 className="text-3xl font-bold text-slate-900 mb-2">Recuperar acesso</h1>
                <p className="text-slate-500 text-[15px] leading-relaxed mb-7">
                  Insere o e-mail associado à tua conta. Iremos enviar-te um link seguro para redefinir a tua palavra-passe.
                </p>

                {resetSuccessMessage ? (
                  <div className="notice notice-success !p-5 animate-in" role="status">
                    <CheckCircle2 className="w-6 h-6" />
                    <p className="font-medium text-sm leading-relaxed">{resetSuccessMessage}</p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div>
                      <label htmlFor="reset-email" className="field-label">O teu e-mail</label>
                      <div className="input-wrap">
                        <Mail className="input-icon" />
                        <input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail((e.target.value || "").toLowerCase())}
                          className={`input input-with-icon ${error ? "input-invalid" : ""}`}
                          placeholder="exemplo@empresa.com"
                          required
                        />
                      </div>
                      {errorLine}
                    </div>

                    <button type="submit" disabled={isLoading || !resetEmail} className="btn btn-primary btn-lg btn-block mt-1">
                      {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Enviar link de recuperação"}
                    </button>
                  </form>
                )}

                {legalLinks}
              </div>
            )}
          </div>
        </div>

        <p className="pt-6 text-center text-xs text-slate-400">Acesso restrito à administração central. © Seatly {new Date().getFullYear()}</p>
      </div>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
}
