"use client";

/**
 * Dashboard — visão geral.
 *   - Dados: GET /api/Analytics/dashboard, atualizado em tempo real quando chega
 *     qualquer mensagem MQTT em `seating/events/#` (lógica original).
 *   - Visual: herói com o mapa de lugares, 4 KPIs coloridos com contagem animada
 *     e dois gráficos (recharts) com cores da marca.
 */

import { useEffect, useState, useCallback } from "react";
import { Building2, CalendarDays, Users, TicketCheck, Activity, Sparkles } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import mqtt from "mqtt";
import SeatMap from "@/components/SeatMap";
import CountUp from "@/components/ui/CountUp";
import PageHeader from "@/components/ui/PageHeader";

interface DashboardData {
  stats: {
    companies: number;
    events: number;
    seats: number;
    validatedSeats: number;
  };
  timeline: { time: string; validations: number }[];
  eventsProgress: { name: string; total: number; validated: number; remaining: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Analytics/dashboard?t=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store'
      });
      if (res.ok) {
        setData(await res.json());
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas do dashboard", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();

    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL as string, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME as string,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD as string,
    });
    client.on("connect", () => {
      client.subscribe("seating/events/#");
    });

    client.on("message", () => {
      fetchDashboardData();
    });

    return () => { client.end(); };
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-20" role="status" aria-label="A carregar">
        <div className="spinner" />
      </div>
    );
  }

  // Obter o número de eventos para o título e garantir que não excede os 10 visualmente descritos
  const activeEventsCount = data?.eventsProgress ? Math.min(data.eventsProgress.length, 10) : 0;

  // Só apresentação: rácio de lugares validados para desenhar o mapa
  const totalSeats = data?.stats.seats || 0;
  const validatedSeats = data?.stats.validatedSeats || 0;
  const validatedRatio = totalSeats > 0 ? validatedSeats / totalSeats : 0;
  const MAP_ROWS = 8;
  const MAP_COLS = 24;
  const mapFilled = Math.round(validatedRatio * MAP_ROWS * MAP_COLS);
  const percentLabel = `${Math.round(validatedRatio * 100)}%`;

  // Estilo comum dos tooltips dos gráficos
  const tooltipStyle = {
    borderRadius: "16px",
    border: "1px solid rgba(139,92,246,0.18)",
    backgroundColor: "rgba(255,255,255,0.96)",
    boxShadow: "0 18px 40px -16px rgba(76,29,149,0.35)",
    fontWeight: 600,
  } as const;

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      <PageHeader
        title="Visão Geral"
        description="Bem-vindo ao centro de comando analítico do Seatly."
        icon={<Sparkles className="w-6 h-6" />}
      />

      {/* DESTAQUE: lugares validados, desenhados como uma sala */}
      <section
        aria-label="Lugares validados"
        className="reveal card-main overflow-hidden mb-4 xl:mb-6 grid lg:grid-cols-[minmax(0,340px)_1fr] !p-0"
        style={{ ["--i" as string]: 1 }}
      >
        <div className="p-6 lg:p-8 flex flex-col justify-between gap-8 text-white relative overflow-hidden bg-[linear-gradient(145deg,#6d28d9_0%,#7c3aed_45%,#2563eb_100%)]">
          <div aria-hidden className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/20 blur-2xl" />
          <div className="relative flex items-center gap-2 text-white/90 text-sm font-bold">
            <TicketCheck className="w-[18px] h-[18px]" /> Lugares Validados
          </div>
          <div className="relative">
            <p className="font-display text-6xl lg:text-7xl font-bold leading-none">
              <CountUp value={validatedSeats} />
            </p>
            <p className="mt-3 text-white/85 text-[15px] tabular">
              de {totalSeats.toLocaleString("pt-PT")} lugares · <span className="font-bold text-emerald-200">{percentLabel}</span> validados
            </p>
            <div className="bar mt-5 !bg-white/25">
              <div className="bar-fill !bg-white" style={{ width: percentLabel }} />
            </div>
          </div>
        </div>
        <div className="p-6 lg:p-8 bg-white/60 flex items-center justify-center overflow-hidden">
          {/* Ecrã largo: 8 filas de 24. Telemóvel: 16 filas de 12 (mesmo nº de lugares, cabe no ecrã) */}
          <div className="hidden sm:block">
            <SeatMap
              rows={MAP_ROWS}
              cols={MAP_COLS}
              aisleEvery={12}
              size={14}
              gap={5}
              reveal
              filled={mapFilled}
              label={`${validatedSeats} de ${totalSeats} lugares validados`}
            />
          </div>
          <div className="sm:hidden">
            <SeatMap rows={MAP_ROWS * 2} cols={MAP_COLS / 2} size={14} gap={5} reveal filled={mapFilled} />
          </div>
        </div>
      </section>

      {/* GRELHA DE ESTATÍSTICAS (cada KPI tem a sua cor) */}
      <div className="stagger grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-4 xl:mb-6">
        <StatCard title="Empresas Ativas" value={data?.stats.companies || 0} icon={Building2} tone="blue" />
        <StatCard title="Total de Eventos" value={data?.stats.events || 0} icon={CalendarDays} tone="purple" />
        <StatCard title="Lugares Globais" value={data?.stats.seats || 0} icon={Users} tone="amber" />
      </div>

      {/* ÁREA DE GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-6">

        {/* Gráfico 1: Ritmo de Entradas */}
        {/* ACESSIBILIDADE: tabIndex e focus-visible para navegação por teclado */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Gráfico de Ritmo de Validações"
          className={`reveal card-main p-5 sm:p-6 lg:p-8 outline-none ${activeEventsCount > 0 ? "lg:col-span-2" : "lg:col-span-3"}`}
          style={{ ["--i" as string]: 3 }}
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Ritmo de Validações</h2>
            <p className="text-slate-500 text-sm mt-1">Volume de entradas nas últimas 12 horas</p>
          </div>
          <div className="h-[300px] w-full">
            {data?.timeline && data.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValidations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="strokeValidations" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="rgba(139,92,246,0.16)" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#6f6a85', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6f6a85', fontSize: 12}} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#6f6a85', marginBottom: '4px' }} />
                  <Area type="monotone" dataKey="validations" name="Validações" stroke="url(#strokeValidations)" strokeWidth={3.5} fillOpacity={1} fill="url(#colorValidations)" animationDuration={1400} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Activity className="w-10 h-10 mb-2 opacity-40 float-slow" />
                <p className="text-sm font-medium">Sem atividade nas últimas 12h</p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Progresso dos Eventos (Ocultado se não houver eventos ativos) */}
        {activeEventsCount > 0 && (
          <div
            tabIndex={0}
            role="region"
            aria-label="Progresso dos eventos ativos"
            className="reveal card-main p-5 sm:p-6 lg:p-8 outline-none"
            style={{ ["--i" as string]: 4 }}
          >
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">Progresso</h2>
              <p className="text-slate-500 text-sm mt-1">
                {activeEventsCount === 1 ? "1 evento ativo" : `Top ${activeEventsCount} eventos ativos`}
              </p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.eventsProgress} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }} stackOffset="expand">
                  <CartesianGrid strokeDasharray="3 5" horizontal={true} vertical={false} stroke="rgba(139,92,246,0.16)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#3e3a57', fontSize: 12, fontWeight: 600}} width={100} />
                  <Tooltip
                    cursor={{fill: 'rgba(139, 92, 246, 0.08)'}}
                    contentStyle={tooltipStyle}
                    formatter={(value: any, name: any) => [value, name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#6f6a85', paddingTop: '20px' }} />
                  <Bar dataKey="validated" name="Validados" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={22} />
                  <Bar dataKey="remaining" name="Restantes" stackId="a" fill="#ddd6fe" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

/**
 * StatCard — cartão de KPI. `tone` escolhe o gradiente do ícone e o brilho ao passar o rato.
 * Para um novo KPI basta usar <StatCard title value icon tone />.
 */
const STAT_TONES = {
  blue: "bg-[linear-gradient(135deg,#60a5fa,#2563eb)] shadow-[0_12px_26px_-10px_rgba(37,99,235,0.7)]",
  purple: "bg-[linear-gradient(135deg,#a78bfa,#7c3aed)] shadow-[0_12px_26px_-10px_rgba(124,58,237,0.7)]",
  amber: "bg-[linear-gradient(135deg,#fbbf24,#f97316)] shadow-[0_12px_26px_-10px_rgba(249,115,22,0.7)]",
  emerald: "bg-[linear-gradient(135deg,#34d399,#059669)] shadow-[0_12px_26px_-10px_rgba(5,150,105,0.7)]",
} as const;

function StatCard({ title, value, icon: Icon, tone }: { title: string; value: number; icon: React.ComponentType<{ className?: string }>; tone: keyof typeof STAT_TONES }) {
  return (
    /* ACESSIBILIDADE: tabIndex para interatividade de teclado */
    <div
      tabIndex={0}
      role="article"
      aria-label={`${title}: ${value}`}
      className="card-main card-lift p-5 xl:p-6 outline-none"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-500">{title}</p>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white ${STAT_TONES[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="font-display text-4xl font-bold text-slate-900 mt-4 break-words">
        <CountUp value={value} />
      </p>
    </div>
  );
}
