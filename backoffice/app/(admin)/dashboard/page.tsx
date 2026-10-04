"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, CalendarDays, Users, TicketCheck, Activity, Database } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import mqtt from "mqtt";
import SeatMap from "@/components/SeatMap";

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
        <div className="animate-spin w-8 h-8 border-[3px] border-purple-600 border-t-transparent rounded-full"></div>
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

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 px-4 sm:px-6 lg:px-8">
      <header className="mb-8 lg:mb-10">
        <h1 className="text-3xl lg:text-4xl text-slate-900">
          Visão Geral
        </h1>
        <p className="text-slate-500 mt-2 text-base">Bem-vindo ao centro de comando analítico do Seatly.</p>
      </header>

      {/* DESTAQUE: lugares validados, desenhados como uma sala */}
      <section
        aria-label="Lugares validados"
        className="card-main overflow-hidden mb-4 xl:mb-6 grid lg:grid-cols-[minmax(0,320px)_1fr]"
      >
        <div className="p-6 lg:p-8 flex flex-col justify-between gap-8 border-b lg:border-b-0 lg:border-r border-slate-200">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-semibold">
            <TicketCheck className="w-[18px] h-[18px] text-emerald-600" /> Lugares Validados
          </div>
          <div>
            <p className="font-display text-6xl lg:text-7xl font-semibold text-slate-900 leading-none">
              {validatedSeats}
            </p>
            <p className="mt-3 text-slate-500 text-[15px] tabular">
              de {totalSeats} lugares, <span className="font-semibold text-emerald-700">{percentLabel}</span> validados
            </p>
          </div>
        </div>
        <div className="p-6 lg:p-8 bg-slate-50 flex items-center justify-center overflow-hidden">
          {/* Ecrã largo: 8 filas de 24. Telemóvel: 16 filas de 12 (mesmo nº de lugares, cabe no ecrã) */}
          <div className="hidden sm:block">
            <SeatMap
              rows={MAP_ROWS}
              cols={MAP_COLS}
              aisleEvery={12}
              size={14}
              gap={5}
              filled={mapFilled}
              label={`${validatedSeats} de ${totalSeats} lugares validados`}
            />
          </div>
          <div className="sm:hidden">
            <SeatMap rows={MAP_ROWS * 2} cols={MAP_COLS / 2} size={14} gap={5} filled={mapFilled} />
          </div>
        </div>
      </section>

      {/* GRELHA DE ESTATÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6 mb-4 xl:mb-6">
        <StatCard title="Empresas Ativas" value={data?.stats.companies || 0} icon={Building2} />
        <StatCard title="Total de Eventos" value={data?.stats.events || 0} icon={CalendarDays} />
        <StatCard title="Lugares Globais" value={data?.stats.seats || 0} icon={Users} />
      </div>

      {/* ÁREA DE GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-6">

        {/* Gráfico 1: Ritmo de Entradas */}
        {/* ACESSIBILIDADE: Adicionado tabIndex e focus-visible para navegação por teclado */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Gráfico de Ritmo de Validações"
          className={`card-main p-5 sm:p-6 lg:p-8 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 transition-shadow ${activeEventsCount > 0 ? "lg:col-span-2" : "lg:col-span-3"}`}
        >
          <div className="mb-6">
            <h2 className="text-xl text-slate-900">Ritmo de Validações</h2>
            <p className="text-slate-500 text-sm mt-1">Volume de entradas nas últimas 12 horas</p>
          </div>
          <div className="h-[300px] w-full">
            {data?.timeline && data.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValidations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6a2fb0" stopOpacity={0.22}/>
                      <stop offset="95%" stopColor="#6a2fb0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="#e3e0ec" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#6f6a85', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#6f6a85', fontSize: 12}} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e3e0ec', backgroundColor: '#ffffff', boxShadow: '0 8px 24px -12px rgb(27 22 48 / 0.3)', fontWeight: 600 }}
                    labelStyle={{ color: '#6f6a85', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="validations" name="Validações" stroke="#6a2fb0" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValidations)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Activity className="w-10 h-10 mb-2 opacity-30" />
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
            className="card-main p-5 sm:p-6 lg:p-8 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 transition-shadow"
          >
            <div className="mb-6">
              <h2 className="text-xl text-slate-900">Progresso</h2>
              <p className="text-slate-500 text-sm mt-1">
                {activeEventsCount === 1 ? "1 evento ativo" : `Top ${activeEventsCount} eventos ativos`}
              </p>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.eventsProgress} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }} stackOffset="expand">
                  <CartesianGrid strokeDasharray="2 4" horizontal={true} vertical={false} stroke="#e3e0ec" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#3e3a57', fontSize: 12, fontWeight: 600}} width={100} />
                  <Tooltip
                    cursor={{fill: 'rgba(240, 238, 245, 0.7)'}}
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e3e0ec', backgroundColor: '#ffffff', boxShadow: '0 8px 24px -12px rgb(27 22 48 / 0.3)', fontWeight: 600 }}
                    formatter={(value: any, name: any) => [value, name]}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#6f6a85', paddingTop: '20px' }} />
                  <Bar dataKey="validated" name="Validados" stackId="a" fill="#1f9d68" radius={[0, 0, 0, 0]} barSize={22} />
                  <Bar dataKey="remaining" name="Restantes" stackId="a" fill="#cfcbdc" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon }: { title: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    /* ACESSIBILIDADE: Adicionado tabIndex e pseudo-classes focus-visible para interatividade de teclado */
    <div
      tabIndex={0}
      role="article"
      aria-label={`${title}: ${value}`}
      className="card-main p-5 xl:p-6 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 transition-shadow"
    >
      <div className="flex items-center justify-between text-slate-500">
        <p className="text-sm font-semibold">{title}</p>
        <Icon className="w-[18px] h-[18px] text-slate-400" />
      </div>
      <p className="font-display tabular text-4xl font-semibold text-slate-900 mt-4 break-words">
        {value}
      </p>
    </div>
  );
}
