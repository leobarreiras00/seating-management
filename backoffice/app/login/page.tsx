"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        throw new Error("Credenciais inválidas.");
      }

      const data = await res.json();

      if (data.role !== "SuperAdmin") {
        throw new Error("Acesso Negado. Apenas o SuperAdmin pode aceder ao Backoffice.");
      }

      localStorage.setItem("token", data.token);
      router.push("/dashboard");
      
    } catch (err: any) {
      if (err.message.includes("Failed to fetch")) {
        setError("A API não está a responder (Verifica se o CORS está ativo e a API ligada).");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    /* Wrapper Principal - Novo fundo gradiente prateado/cinzento */
    <div className="flex flex-col min-h-screen items-center justify-center bg-gradient-to-br from-slate-300 via-slate-100 to-slate-200 p-4 sm:p-6 md:p-8 text-slate-900">
      
      {/* Spacer invisível para ajudar a centrar o card ignorando o footer */}
      <div className="flex-1"></div>

      {/* Card Central - Efeito Liquid Glass aprimorado (bg-white/70, blur-2xl, border-white/60) */}
      <div className="w-full max-w-[440px] bg-white/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(168,85,247,0.25)] border border-white/60 transition-all">
        
        {/* Cabeçalho / Branding */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="mb-6 flex justify-center">
            {/* Imagem responsiva via Next.js */}
            <Image 
              src="/seatly_wrt.png" 
              alt="Seatly Logo" 
              width={160} 
              height={55} 
              className="object-contain w-32 sm:w-40 h-auto"
              priority
            />
          </div>
          
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mb-1">
            Bem-vindo de volta
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            Insere as tuas credenciais para aceder ao sistema.
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Utilizador</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 text-slate-800 text-sm sm:text-base font-medium placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              placeholder="Ex: admin"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1.5 ml-1">Palavra-passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 sm:px-5 py-3 sm:py-3.5 bg-slate-50/80 backdrop-blur-sm rounded-2xl border border-slate-200/80 text-slate-800 text-sm sm:text-base font-medium placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-300"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Mensagem de Erro */}
          {error && (
            <div className="p-3 sm:p-4 bg-red-50/90 text-red-600 text-xs sm:text-sm font-semibold rounded-2xl border border-red-100 flex items-start gap-2 sm:gap-3 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Botão de Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-bold py-3.5 sm:py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 mt-2 flex justify-center items-center active:scale-[0.98] text-sm sm:text-base"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                A verificar...
              </span>
            ) : (
              "ENTRAR NO SISTEMA"
            )}
          </button>
        </form>

        {/* Indicadores de Segurança */}
        <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-slate-200/60 flex flex-col gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 text-slate-600">
            <div className="bg-purple-100 p-1 sm:p-1.5 rounded-full text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <span className="text-[11px] sm:text-xs font-medium">Acesso restrito a SuperAdmins</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-slate-600">
            <div className="bg-purple-100 p-1 sm:p-1.5 rounded-full text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-[11px] sm:text-xs font-medium">Ligação encriptada de ponta-a-ponta</span>
          </div>
        </div>

      </div>

      {/* Footer dinâmico na base */}
      <div className="flex-1 flex items-end pb-2 sm:pb-6">
        <div className="text-slate-500 text-xs sm:text-sm font-medium mt-8">
          Copyright © Seatly 2026.
        </div>
      </div>

    </div>
  );
}