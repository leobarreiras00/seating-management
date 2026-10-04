"use client";

/**
 * CountUp — número que "sobe" de 0 até ao valor (usado nos KPIs).
 * Respeita `prefers-reduced-motion`: nesse caso mostra logo o valor final.
 * Só anima quando o valor muda (ex.: chegada de dados novos por MQTT).
 */
import { useEffect, useRef, useState } from "react";

export default function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === value) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span className="tabular">{shown.toLocaleString("pt-PT")}</span>;
}
