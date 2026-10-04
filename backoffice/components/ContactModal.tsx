"use client";

import { useState } from "react";
import { X, Send, Mail, MessageSquare, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export default function ContactModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");

    try {
      // Apontar diretamente para a API .NET existente
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });

      if (!res.ok) throw new Error("Falha ao enviar a mensagem. Tenta novamente.");
      
      setStatus("success");
      setTimeout(() => {
        onClose();
        setStatus("idle");
        setMessage("");
      }, 3000);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[400px] rounded-3xl shadow-xl border border-slate-200 p-6 sm:p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-semibold text-slate-900 mb-1 mt-2">Contactar Suporte</h3>
        <p className="text-slate-500 text-sm font-medium mb-6">Envia uma mensagem direta para a equipa técnica.</p>

        {status === "success" ? (
          <div className="flex flex-col items-center justify-center py-6 animate-in zoom-in-95">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <p className="text-emerald-800 font-semibold text-center">Mensagem enviada com sucesso!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">O teu E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-slate-400" /></div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full pl-11 pr-5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none" placeholder="nome@empresa.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Mensagem</label>
              <div className="relative">
                <div className="absolute top-3 left-0 pl-4 pointer-events-none"><MessageSquare className="h-5 w-5 text-slate-400" /></div>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="w-full pl-11 pr-5 py-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500 outline-none resize-none" placeholder="Descreve o teu problema..." />
              </div>
            </div>

            {status === "error" && (
              <div className="p-3 bg-red-50 text-red-600 text-xs font-semibold rounded-xl flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {errorMsg}
              </div>
            )}

            <button type="submit" disabled={status === "loading" || !email || !message} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md flex justify-center items-center gap-2 disabled:opacity-50">
              {status === "loading" ? <Loader2 className="animate-spin h-5 w-5" /> : <><Send className="w-4 h-4" /> Enviar Mensagem</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}