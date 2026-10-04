/**
 * PageHeader — cabeçalho padrão de cada página do backoffice:
 * ícone em gradiente + título (fonte display) + descrição + zona de ações à direita.
 * Mantém todas as páginas alinhadas (mesmo espaçamento e animação de entrada).
 */
export default function PageHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="reveal flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 lg:mb-8">
      <div className="flex items-center gap-4 min-w-0">
        {icon && <div className="modal-title-icon !w-12 !h-12 !rounded-2xl shrink-0">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
