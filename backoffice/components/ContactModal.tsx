"use client";

import { useState } from "react";
import { Send, Mail, MessageSquare, Loader2, CheckCircle2, AlertTriangle, LifeBuoy } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { getErrorMessage } from "@/lib/errors";

/**
 * ContactModal — formulário de contacto com o suporte (POST /api/Auth/contact).
 * Usado no login e nas páginas legais. Só o aspeto mudou: o envio é o original.
 */
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
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(getErrorMessage(err));
    }
  };

  return (
    <Modal title="Contactar Suporte" subtitle="Envia uma mensagem direta para a equipa técnica." icon={<LifeBuoy className="w-5 h-5" />} size="md" tone="blue" onClose={onClose}>
      {status === "success" ? (
        <div className="flex flex-col items-center justify-center py-6">
          <div className="dialog-icon dialog-icon-success mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <p className="text-emerald-800 font-semibold text-center">Mensagem enviada com sucesso!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="field-label">O teu E-mail</label>
            <div className="input-wrap">
              <Mail className="input-icon" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="input input-with-icon" placeholder="nome@empresa.com" />
            </div>
          </div>

          <div>
            <label className="field-label">Mensagem</label>
            <div className="input-wrap">
              <MessageSquare className="input-icon !top-4 !translate-y-0" />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={4} className="input input-with-icon resize-none" placeholder="Descreve o teu problema..." />
            </div>
          </div>

          {status === "error" && (
            <div className="notice notice-error" role="alert">
              <AlertTriangle className="h-4 w-4" /> {errorMsg}
            </div>
          )}

          <button type="submit" disabled={status === "loading" || !email || !message} className="btn btn-primary btn-lg btn-block">
            {status === "loading" ? <Loader2 className="animate-spin h-5 w-5" /> : <><Send className="w-4 h-4" /> Enviar Mensagem</>}
          </button>
        </form>
      )}
    </Modal>
  );
}
