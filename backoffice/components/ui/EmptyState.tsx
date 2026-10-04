import SeatMap from "../SeatMap";

/**
 * EmptyState — ecrã de "sem resultados" com um mini mapa de lugares vazio
 * (o motivo gráfico da marca) em vez de um ícone genérico.
 */
export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="reveal card-main flex flex-col items-center text-center px-6 py-14">
      <SeatMap rows={3} cols={7} filled={(r, c) => (r + c) % 4 === 0} size={14} gap={5} className="mb-6 opacity-80 float-slow" />
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      {description && <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
