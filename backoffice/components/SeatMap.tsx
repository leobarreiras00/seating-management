import type { CSSProperties } from "react";

/**
 * Mapa de lugares: a peça gráfica da marca. Só apresentação, sem lógica de negócio.
 *
 * - `filled` como número: pinta esse número de lugares, da frente para trás (dados reais).
 * - `filled` como função: decide lugar a lugar (usado na ilustração do login).
 */
type SeatMapProps = {
  rows: number;
  cols: number;
  filled: number | ((row: number, col: number) => boolean);
  /** Tamanho do lugar em px */
  size?: number;
  /** Espaço entre lugares em px */
  gap?: number;
  /** Corredor depois de cada N colunas (0 = sem corredores) */
  aisleEvery?: number;
  /** Acende os lugares um a um quando a página abre */
  reveal?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Se omitido, o mapa é decorativo e fica escondido dos leitores de ecrã */
  label?: string;
};

export default function SeatMap({
  rows,
  cols,
  filled,
  size = 12,
  gap = 4,
  aisleEvery = 0,
  reveal = false,
  className = "",
  style,
  label,
}: SeatMapProps) {
  const total = rows * cols;
  const rowIndexes = Array.from({ length: rows }, (_, r) => r);
  const colIndexes = Array.from({ length: cols }, (_, c) => c);

  const isOn = (r: number, c: number) =>
    typeof filled === "function" ? filled(r, c) : r * cols + c < Math.min(filled, total);

  return (
    <div
      className={`flex flex-col items-center ${className}`}
      style={{ gap, ["--seat-size" as string]: `${size}px`, ...style }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {rowIndexes.map((r) => (
        <div key={r} className="flex" style={{ gap }}>
          {colIndexes.map((c) => (
            <span key={c} className="contents">
              {aisleEvery > 0 && c > 0 && c % aisleEvery === 0 && (
                <span style={{ width: size }} className="shrink-0" />
              )}
              <span
                className={`seat shrink-0 ${reveal ? "seat-reveal" : ""}`}
                data-on={isOn(r, c)}
                style={{ ["--i" as string]: r * cols + c }}
              />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
