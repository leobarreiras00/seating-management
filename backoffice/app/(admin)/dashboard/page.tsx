"use client";

import { useEffect, useState, useCallback } from "react";
import { Building2, CalendarDays, Users, TicketCheck, Activity, Database } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import mqtt from "mqtt";

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
      <div className="flex justify-center p-20">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 px-2 sm:px-4 lg:px-8">
      <header className="mb-8 lg:mb-10 pl-2">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
          Visão Geral
        </h1>
        <p className="text-slate-500 mt-2 font-medium text-base">Bem-vindo ao centro de comando analítico do Seatly.</p>
      </header>

      {/* GRELHA DE ESTATÍSTICAS */}
      {/* Mantém as 4 colunas em ecrãs grandes (lg) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-6 mb-8">
        <StatCard title="Empresas Ativas" value={data?.stats.companies || 0} icon={Building2} color="bg-blue-500" lightColor="bg-blue-500/10" textColor="text-blue-600" />
        <StatCard title="Total de Eventos" value={data?.stats.events || 0} icon={CalendarDays} color="bg-purple-500" lightColor="bg-purple-500/10" textColor="text-purple-600" />
        <StatCard title="Lugares Globais" value={data?.stats.seats || 0} icon={Users} color="bg-emerald-500" lightColor="bg-emerald-500/10" textColor="text-emerald-600" />
        <StatCard title="Lugares Validados" value={data?.stats.validatedSeats || 0} icon={TicketCheck} color="bg-amber-500" lightColor="bg-amber-500/10" textColor="text-amber-600" />
      </div>

      {/* ÁREA DE GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Ritmo de Entradas */}
        <div className="lg:col-span-2 bg-white/70 backdrop-blur-2xl p-6 lg:p-8 rounded-[2.5rem] border border-white/60 shadow-[0_20px_60px_-15px_rgba(168,85,247,0.15)]">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-slate-900">Ritmo de Validações</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Volume de entradas nas últimas 12 horas</p>
          </div>
          <div className="h-[300px] w-full">
            {data?.timeline && data.timeline.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValidations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="validations" name="Validações" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorValidations)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Activity className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm font-medium">Sem atividade nas últimas 12h</p>
              </div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Progresso dos Eventos */}
        <div className="bg-white/70 backdrop-blur-2xl p-6 lg:p-8 rounded-[2.5rem] border border-white/60 shadow-[0_20px_60px_-15px_rgba(168,85,247,0.15)]">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-slate-900">Progresso</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Top 4 eventos ativos</p>
          </div>
          <div className="h-[300px] w-full">
            {data?.eventsProgress && data.eventsProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.eventsProgress} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} width={100} />
                  <Tooltip 
                    cursor={{fill: 'rgba(241, 245, 249, 0.5)'}}
                    contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.6)', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b', paddingTop: '20px' }} />
                  <Bar dataKey="validated" name="Validados" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24} />
                  <Bar dataKey="remaining" name="Restantes" stackId="a" fill="#94a3b8" radius={[0, 8, 8, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Database className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm font-medium">Sem dados de eventos</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// 👇 O Componente de Estatística totalmente revisto 👇
function StatCard({ title, value, icon: Icon, color, lightColor, textColor }: any) {
  return (
    <div className="bg-white/70 backdrop-blur-2xl p-4 xl:p-6 rounded-[2rem] border border-white/60 shadow-[0_20px_60px_-15px_rgba(168,85,247,0.15)] hover:-translate-y-1 transition-transform group flex items-center overflow-hidden relative">
      <div className={`absolute -right-6 -top-6 w-24 h-24 ${lightColor} rounded-full blur-2xl group-hover:scale-150 transition-transform pointer-events-none`}></div>
      <div className={`w-12 h-12 xl:w-16 xl:h-16 ${lightColor} ${textColor} rounded-[1.25rem] flex items-center justify-center mr-3 xl:mr-4 shrink-0 relative z-10`}>
        <Icon className="w-6 h-6 xl:w-8 xl:h-8" />
      </div>
      <div className="min-w-0 flex-1 relative z-10">
        {/* Retirado o truncate; adicionado break-words e leading-tight para permitir várias linhas se necessário */}
        <p className="text-slate-500 text-[10px] xl:text-xs font-bold mb-0.5 uppercase tracking-wide leading-tight break-words">
          {title}
        </p>
        <p className="text-slate-900 text-xl xl:text-2xl font-black break-words">
          {value}
        </p>
      </div>
    </div>
  );
}