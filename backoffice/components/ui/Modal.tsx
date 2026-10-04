"use client";

/**
 * Modal — contentor base de TODOS os modais do backoffice.
 *
 * Porquê existir: antes cada página repetia ~15 linhas de markup (backdrop,
 * painel, cabeçalho, botão fechar). Agora o aspeto vive em `globals.css`
 * (classes `.modal-*`) e o comportamento vive aqui:
 *   - fecha com a tecla Escape e ao clicar fora (se `closeOnBackdrop`);
 *   - bloqueia o scroll da página enquanto está aberto;
 *   - devolve o foco ao elemento que o abriu;
 *   - `role="dialog"` + `aria-modal` para leitores de ecrã.
 *
 * Uso:
 *   <Modal title="Editar" icon={<Pencil />} size="lg" onClose={...} footer={<>botões</>}>
 *     ...conteúdo...
 *   </Modal>
 *
 * `tone` muda a cor da barra de topo (roxo por defeito).
 * `layer="dialog"` sobe o z-index (usado por Alert/Confirm, que abrem por cima de outros modais).
 */
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl";
export type ModalTone = "brand" | "emerald" | "blue" | "red" | "amber";

interface ModalProps {
  onClose: () => void;
  title?: React.ReactNode;
  /** Subtítulo pequeno por baixo do título. */
  subtitle?: React.ReactNode;
  /** Ícone mostrado num quadrado em gradiente ao lado do título. */
  icon?: React.ReactNode;
  size?: ModalSize;
  tone?: ModalTone;
  /** Rodapé fixo (normalmente os botões Cancelar / Confirmar). */
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  layer?: "modal" | "dialog";
  /** Sem cabeçalho nem padding no corpo — para conteúdos totalmente custom. */
  bare?: boolean;
  children: React.ReactNode;
}

export default function Modal({
  onClose,
  title,
  subtitle,
  icon,
  size = "md",
  tone = "brand",
  footer,
  closeOnBackdrop = true,
  layer = "modal",
  bare = false,
  children,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  // Guardamos sempre a versão mais recente do onClose sem reinstalar listeners.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);

    // Move o foco para dentro do painel (sem roubar o foco a um input autofocus).
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  // Portal para o <body>: assim o modal fica SEMPRE por cima da sidebar e do cabeçalho,
  // mesmo quando aberto dentro de um elemento com transform/animação (ex.: .page-enter).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="modal-backdrop"
      data-layer={layer === "dialog" ? "dialog" : undefined}
      onMouseDown={(e) => {
        // Só fecha se o clique COMEÇOU no fundo (evita fechar ao largar o rato fora de um input).
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`modal-panel modal-${size} ${tone !== "brand" ? `modal-tone-${tone}` : ""}`}
      >
        {!bare && title && (
          <div className="modal-head">
            {icon && <div className="modal-title-icon">{icon}</div>}
            <div className="min-w-0 flex-1">
              <h3 id={titleId} className="text-lg font-bold text-slate-900 truncate">
                {title}
              </h3>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="modal-close" aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {bare ? children : <div className="modal-body custom-scrollbar">{children}</div>}
        {!bare && footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
