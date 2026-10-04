"use client";

/**
 * ConfirmDialog — confirmação para ações destrutivas (eliminar, remover acesso…).
 * Mesma API que o bloco inline antigo: `onConfirm` executa a ação, `onCancel` fecha.
 * A página continua responsável por limpar o seu estado dentro desses callbacks.
 */
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";

interface ConfirmDialogProps {
  title: string;
  message: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
}: ConfirmDialogProps) {
  return (
    <Modal bare size="sm" tone="red" layer="dialog" onClose={onCancel}>
      <div className="p-7 text-center">
        <div className="dialog-icon dialog-icon-warning mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-1.5">{title}</h3>
        <p className="text-sm text-slate-500 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button type="button" autoFocus onClick={onCancel} className="btn btn-white">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn btn-danger">
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
