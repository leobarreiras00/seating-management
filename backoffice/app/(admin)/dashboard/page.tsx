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
  // 👇 A interface agora espera a propriedade "remaining" 👇
  eventsProgress: { name: string; total: number; validated: number; remaining: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`http://localhost:5162/api/Analytics/dashboard?t=${Date.now()}`, {
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

    const client = mqtt.connect("ws://localhost:9001"); 
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
    <div className="max-w-6xl mx-auto pb-10">
      <header className="mb-8 lg:mb-10">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 flex items-center gap-3">
          <Activity className="w-8 h-8 text-purple-600" /> Visão Geral
        </h1>
        <p className="text-slate-500 mt-2 font-medium text-base">Bem-vindo ao centro de comando analítico do Seatly.</p>
      </header>

      {/* GRELHA DE ESTATÍSTICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <StatCard title="Empresas Ativas" value={data?.stats.companies || 0} icon={Building2} color="bg-blue-500" lightColor="bg-blue-500/10" textColor="text-blue-600" />
        <StatCard title="Total de Eventos" value={data?.stats.events || 0} icon={CalendarDays} color="bg-purple-500" lightColor="bg-purple-500/10" textColor="text-purple-600" />
        <StatCard title="Lugares Globais" value={data?.stats.seats || 0} icon={Users} color="bg-emerald-500" lightColor="bg-emerald-500/10" textColor="text-emerald-600" />
        <StatCard title="Lugares Validados" value={data?.stats.validatedSeats || 0} icon={TicketCheck} color="bg-amber-500" lightColor="bg-amber-500/10" textColor="text-amber-600" />
      </div>

      {/* ÁREA DE GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Gráfico 1: Ritmo de Entradas (Timeline) */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl p-6 lg:p-8 rounded-[2.5rem] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
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
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
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

        {/* Gráfico 2: Progresso dos Eventos (Barras) */}
        <div className="bg-white/80 backdrop-blur-xl p-6 lg:p-8 rounded-[2.5rem] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="mb-6">
            <h2 className="text-xl font-extrabold text-slate-900">Progresso</h2>
            <p className="text-slate-500 text-sm font-medium mt-1">Top 4 eventos ativos</p>
          </div>
          
          <div className="h-[300px] w-full">
            {data?.eventsProgress && data.eventsProgress.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.eventsProgress} layout="vertical" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#475569', fontSize: 12, fontWeight: 600}} width={100} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: 600, color: '#64748b', paddingTop: '20px' }} />
                  <Bar dataKey="validated" name="Validados" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} barSize={24} />
                  {/* 👇 CORREÇÃO: A barra cinzenta agora lê os 'remaining' (Restantes) em vez do 'total' 👇 */}
                  <Bar dataKey="remaining" name="Restantes" stackId="a" fill="#e2e8f0" radius={[0, 8, 8, 0]} barSize={24} />
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

function StatCard({ title, value, icon: Icon, color, lightColor, textColor }: any) {
  return (
    <div className="bg-white/80 backdrop-blur-xl p-5 lg:p-6 rounded-[2rem] border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:-translate-y-1 transition-transform group flex items-center overflow-hidden relative">
      <div className={`absolute -right-6 -top-6 w-24 h-24 ${lightColor} rounded-full blur-2xl group-hover:scale-150 transition-transform pointer-events-none`}></div>
      
      <div className={`w-14 h-14 lg:w-16 lg:h-16 ${lightColor} ${textColor} rounded-[1.25rem] flex items-center justify-center mr-4 lg:mr-5 shrink-0 relative z-10`}>
        <Icon className="w-7 h-7 lg:w-8 lg:h-8" />
      </div>
      
      <div className="min-w-0 flex-1 relative z-10">
        <p className="text-slate-500 text-xs lg:text-sm font-bold mb-1 truncate uppercase tracking-wider">{title}</p>
        <p className="text-slate-900 text-2xl lg:text-3xl font-black truncate">{value}</p>
      </div>
    </div>
  );
}