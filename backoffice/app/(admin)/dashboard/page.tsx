"use client";

import { Building2, CalendarDays, Users } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900">Visão Geral</h1>
        <p className="text-slate-500 mt-1">Bem-vindo ao centro de comando do Seatly.</p>
      </header>

      {/* Cartões de Estatísticas (Placeholder por agora) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard title="Empresas Ativas" value="--" icon={Building2} color="bg-blue-500" />
        <StatCard title="Total de Eventos" value="--" icon={CalendarDays} color="bg-purple-500" />
        <StatCard title="Lugares Geridos" value="--" icon={Users} color="bg-emerald-500" />
      </div>

      {/* Área Principal */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Bem-vindo ao teu Backoffice!</h2>
        <p className="text-slate-600 leading-relaxed">
          O teu login funcionou na perfeição, e a proteção de rotas está ativada. A partir deste painel,
          vamos gerir as tabelas de Empresas Clientes, os Eventos deles, e fazer o upload dos logótipos 
          que irão aparecer na App Android.
        </p>
      </div>
    </div>
  );
}

// Sub-componente para os cartões de estatísticas
function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center">
      <div className={`w-14 h-14 ${color} rounded-2xl flex items-center justify-center text-white mr-5 shadow-sm`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-slate-500 text-sm font-semibold mb-1">{title}</p>
        <p className="text-slate-900 text-3xl font-black">{value}</p>
      </div>
    </div>
  );
}