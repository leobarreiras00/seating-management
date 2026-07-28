"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarDays, Users } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({ companies: 0, events: 0, seats: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        const compRes = await fetch("http://localhost:5162/api/Company", { headers });
        const companies = await compRes.json();
        
        let totalEvents = 0;
        let totalSeats = 0;

        const eventPromises = companies.map((c: any) => 
          fetch(`http://localhost:5162/api/Company/${c.id}/events`, { headers }).then(r => r.json())
        );
        
        const allEventsArrays = await Promise.all(eventPromises);

        allEventsArrays.forEach((eventsArr: any) => {
          totalEvents += eventsArr.length;
          eventsArr.forEach((ev: any) => {
            totalSeats += ev.totalSeats;
          });
        });

        setStats({
          companies: companies.length,
          events: totalEvents,
          seats: totalSeats
        });

      } catch (error) {
        console.error("Erro ao carregar estatísticas", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-6 lg:mb-10">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900">Visão Geral</h1>
        <p className="text-slate-500 mt-1 text-sm lg:text-base">Bem-vindo ao centro de comando do Seatly.</p>
      </header>

      {/* 👇 GRELHA RESPONSIVA: 1 coluna no mobile, 2 no tablet/meio-ecrã, 3 no desktop 👇 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6 mb-10">
        <StatCard 
          title="Empresas Ativas" 
          value={isLoading ? "..." : stats.companies} 
          icon={Building2} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Total de Eventos" 
          value={isLoading ? "..." : stats.events} 
          icon={CalendarDays} 
          color="bg-purple-500" 
        />
        <StatCard 
          title="Lugares Geridos" 
          value={isLoading ? "..." : stats.seats} 
          icon={Users} 
          color="bg-emerald-500" 
        />
      </div>

      <div className="bg-white rounded-[2rem] p-6 lg:p-8 border border-slate-100 shadow-sm">
        <h2 className="text-lg lg:text-xl font-bold text-slate-800 mb-4">Bem-vindo ao Backoffice Seatly!</h2>
        <p className="text-slate-600 leading-relaxed text-sm lg:text-base">
          Gestão do Backoffice Seatly.
        </p>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-5 lg:p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center overflow-hidden">
      <div className={`w-12 h-12 lg:w-14 lg:h-14 ${color} rounded-2xl flex items-center justify-center text-white mr-4 lg:mr-5 shadow-sm shrink-0`}>
        <Icon className="w-6 h-6 lg:w-7 lg:h-7" />
      </div>
      {/* 👇 min-w-0 PERMITE QUE O TEXTO ENCOLHA/TRUNCATE SEM PARTIR O ECRÃ 👇 */}
      <div className="min-w-0 flex-1">
        <p className="text-slate-500 text-xs lg:text-sm font-semibold mb-1 truncate">{title}</p>
        <p className="text-slate-900 text-2xl lg:text-3xl font-black truncate">{value}</p>
      </div>
    </div>
  );
}