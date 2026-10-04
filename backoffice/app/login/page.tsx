"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, AlertTriangle, Mail, Lock, CheckCircle2, ChevronLeft } from "lucide-react";
import ContactModal from "@/components/ContactModal";
import SeatMap from "@/components/SeatMap";

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

    if (password.length < 6) {
      setError("A palavra-passe deve ter pelo menos 6 caracteres.");
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

  // Só visual: quais lugares da ilustração aparecem acesos (mais à frente, menos atrás)
  const isSeatLit = (row: number, col: number) =>
    ((row * 131 + col * 71 + row * col * 17) % 97) / 97 < 0.8 - row * 0.05;

  const inputBase =
    "w-full h-12 rounded-xl border bg-white text-slate-900 text-[15px] placeholder-slate-400 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-0";
  const inputOk = "border-slate-300 hover:border-slate-400 focus:border-purple-500";
  const inputBad = "border-red-300 focus:ring-red-500 focus:border-red-500";
  const labelCls = "block text-sm font-semibold text-slate-700 mb-1.5";
  const primaryBtn =
    "w-full h-12 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors flex justify-center items-center active:translate-y-px disabled:opacity-50 disabled:hover:bg-purple-600";

  const errorLine = error && (
    <p className="text-red-600 text-sm font-medium mt-2 flex items-start gap-1.5 animate-in">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-[2px]" /> <span>{error}</span>
    </p>
  );

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1.05fr_0.95fr]">

      {/* --- PAINEL VISUAL: a sala, com os lugares a acender --- */}
      <aside className="hidden lg:flex relative flex-col justify-between overflow-hidden bg-purple-900 text-white px-14 py-14">
        <p className="font-display text-lg text-purple-200">Administração central</p>

        <div className="flex flex-col items-center my-auto py-10">
          <div className="w-72 h-1.5 rounded-full bg-white/35 mb-2" />
          <p className="text-xs text-purple-300 mb-8">Palco</p>
          <SeatMap
            rows={10}
            cols={18}
            aisleEvery={9}
            size={15}
            gap={5}
            reveal
            filled={isSeatLit}
            style={{ ["--seat-off" as string]: "rgba(255,255,255,0.13)", ["--seat-on" as string]: "#3ecf9a" }}
          />
        </div>

        <div>
          <h2 className="font-display text-4xl xl:text-5xl font-semibold leading-[1.05] max-w-md">
            Cada convidado no seu lugar.
          </h2>
          <p className="mt-4 text-purple-200 text-base max-w-sm leading-relaxed">
            Empresas, eventos e entradas validadas, num só painel.
          </p>
        </div>
      </aside>

      {/* --- FORMULÁRIO --- */}
      <div className="flex flex-col min-h-screen px-6 sm:px-12 py-8">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[400px]">

            <Image src="/seatly_wrt.png" alt="Seatly" width={160} height={55} className="object-contain w-28 h-auto -ml-2 mb-8" priority />

            {/* --- VISTA: LOGIN NORMAL --- */}
            {currentView === "login" && (
              <div className="animate-in">
                <h1 className="text-3xl text-slate-900 mb-2">Entrar</h1>
                <p className="text-slate-500 text-[15px] mb-8">Acede ao painel de administração do Seatly.</p>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label htmlFor="login-email" className={labelCls}>E-mail</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="h-[18px] w-[18px] text-slate-400" /></div>
                      <input
                        id="login-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail((e.target.value || "").toLowerCase())}
                        className={`${inputBase} ${inputOk} pl-11 pr-4`}
                        placeholder="admin@seatly.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">Palavra-passe</label>
                      <button type="button" onClick={() => { setCurrentView("forgotPassword"); setError(""); }} className="text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors rounded">Esqueceu-se?</button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Lock className="h-[18px] w-[18px] text-slate-400" /></div>
                      <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputBase} ${error ? inputBad : inputOk} pl-11 pr-4`} placeholder="••••••••" required />
                    </div>
                    {errorLine}
                  </div>

                  <button type="submit" disabled={isLoading || !email || !password} className={`${primaryBtn} mt-1`}>
                    {isLoading ? <span className="flex items-center gap-2"><Loader2 className="animate-spin h-5 w-5" /> A verificar...</span> : "Entrar"}
                  </button>
                </form>
              </div>
            )}

            {/* --- VISTA: PRIMEIRO LOGIN (OPÇÃO B) --- */}
            {currentView === "firstLoginReset" && (
              <div className="animate-in">
                <h1 className="text-3xl text-slate-900 mb-2">Define a tua palavra-passe</h1>
                <p className="text-slate-500 text-[15px] leading-relaxed mb-8">
                  Bem-vindo ao Seatly! Estás a usar uma palavra-passe temporária. Para tua segurança, define agora a tua palavra-passe definitiva.
                </p>

                <form onSubmit={handleFirstLoginReset} className="space-y-5">
                  <div>
                    <label htmlFor="new-password" className={labelCls}>Nova palavra-passe</label>
                    <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${inputBase} ${inputOk} px-4`} placeholder="Mínimo 6 caracteres" required />
                  </div>
                  <div>
                    <label htmlFor="confirm-new-password" className={labelCls}>Confirmar nova palavra-passe</label>
                    <input id="confirm-new-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} className={`${inputBase} px-4 ${confirmNewPassword && newPassword !== confirmNewPassword ? inputBad + " text-red-600" : inputOk}`} placeholder="Repete a palavra-passe" required />
                    {errorLine}
                  </div>

                  <button type="submit" disabled={isLoading || newPassword.length < 6 || newPassword !== confirmNewPassword} className={`${primaryBtn} mt-1`}>
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Guardar e entrar no dashboard"}
                  </button>
                </form>
              </div>
            )}

            {/* --- VISTA: ESQUECI-ME DA PALAVRA-PASSE --- */}
            {currentView === "forgotPassword" && (
              <div className="animate-in">
                <button onClick={() => { setCurrentView("login"); setError(""); setResetSuccessMessage(""); }} className="flex items-center text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors mb-6 -ml-1 rounded">
                  <ChevronLeft className="w-4 h-4 mr-0.5" /> Voltar ao login
                </button>

                <h1 className="text-3xl text-slate-900 mb-2">Recuperar acesso</h1>
                <p className="text-slate-500 text-[15px] leading-relaxed mb-8">
                  Insere o e-mail associado à tua conta. Iremos enviar-te um link seguro para redefinir a tua palavra-passe.
                </p>

                {resetSuccessMessage ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-xl flex items-start gap-3 animate-in" role="status">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <p className="text-emerald-800 font-medium text-sm leading-relaxed">{resetSuccessMessage}</p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-5">
                    <div>
                      <label htmlFor="reset-email" className={labelCls}>O teu e-mail</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="h-[18px] w-[18px] text-slate-400" /></div>
                        <input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail((e.target.value || "").toLowerCase())}
                          className={`${inputBase} ${error ? inputBad : inputOk} pl-11 pr-4`}
                          placeholder="exemplo@empresa.com"
                          required
                        />
                      </div>
                      {errorLine}
                    </div>

                    <button type="submit" disabled={isLoading || !resetEmail} className={`${primaryBtn} mt-1`}>
                      {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Enviar link de recuperação"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* --- RODAPÉ: links legais e direitos --- */}
        <footer className="w-full max-w-[400px] mx-auto pt-8 text-sm text-slate-500">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-medium">
            <button onClick={() => setIsContactModalOpen(true)} className="hover:text-purple-700 transition-colors rounded">
              Contactar suporte
            </button>
            <Link href="/privacy" className="hover:text-purple-700 transition-colors rounded">
              Política de privacidade
            </Link>
            <Link href="/terms" className="hover:text-purple-700 transition-colors rounded">
              Termos de serviço
            </Link>
          </div>
          <p className="mt-4 text-slate-400">Acesso restrito à administração central. © Seatly {new Date().getFullYear()}</p>
        </footer>
      </div>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
}
