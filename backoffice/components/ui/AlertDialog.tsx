"use client";

/**
 * AlertDialog — substitui os antigos "avisos" (caixas de erro/sucesso/info) que
 * cada página desenhava à mão. Mantém a mesma API: `{ title, message, type, onClose }`.
 *
 * O ícone é animado (ver `.dialog-icon` em globals.css): sucesso desenha o visto,
 * erro treme, info faz "pop".
 */
import { AlertTriangle, Check, Info } from "lucide-react";
import Modal from "./Modal";

export type AlertType = "error" | "success" | "info";

interface AlertDialogProps {
  title: string;
  message: React.ReactNode;
  type?: AlertType;
  onClose: () => void;
}

export default function AlertDialog({ title, message, type = "info", onClose }: AlertDialogProps) {
  const icon =
    type === "success" ? (
      <svg viewBox="0 0 24 24" className="w-8 h-8 draw-check" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
    ) : type === "error" ? (
      <AlertTriangle className="w-8 h-8" />
    ) : (
      <Info className="w-8 h-8" />
    );

  const btn = type === "error" ? "btn-danger" : type === "success" ? "btn-success" : "btn-primary";
  const tone = type === "error" ? "red" : type === "success" ? "emerald" : "blue";

  return (
    <Modal bare size="sm" tone={tone} layer="dialog" onClose={onClose}>
      <div className="p-7 text-center">
        <div className={`dialog-icon dialog-icon-${type} mx-auto mb-4`}>{icon}</div>
        <h3 className="text-xl font-bold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        <button type="button" autoFocus onClick={onClose} className={`btn ${btn} btn-block mt-6`}>
          <Check className="w-4 h-4" /> Entendido
        </button>
      </div>
    </Modal>
  );
}
