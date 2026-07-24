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
      const res = await fetch("http://localhost:5162/api/Auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        throw new Error("Credenciais inválidas ou erro no servidor.");
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Lado Esquerdo - Imagem/Branding */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 flex-col items-center justify-center p-12">
        <div className="w-32 h-32 mb-8 flex items-center justify-center shadow-2xl rounded-3xl overflow-hidden border-4 border-slate-800">
           {/* 👇 LOGOTIPO OFICIAL ATUALIZADO PARA .PNG 👇 */}
           <Image src="/seatly_icon.png" alt="Seatly Logo" width={128} height={128} className="object-cover" />
        </div>
        <h1 className="text-white text-4xl font-bold mb-4">Seatly Backoffice</h1>
        <p className="text-slate-400 text-center max-w-md">
          A plataforma central de administração. Gere os teus clientes, instâncias e acessos num só lugar.
        </p>
      </div>

      {/* Lado Direito - Formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl border border-slate-100">
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2">Bem-vindo de volta</h2>
          
          <p className="text-slate-500 mb-8 text-sm">Insere as tuas credenciais.</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Utilizador</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Palavra-passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl border border-red-100">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-4 flex justify-center items-center"
            >
              {isLoading ? "A verificar..." : "ENTRAR NO SISTEMA"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}