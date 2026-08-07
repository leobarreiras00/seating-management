"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Building2, LogOut, History, Users } from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const menuItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Empresas", href: "/companies", icon: Building2 },
    { name: "Auditoria", href: "/audits", icon: History },
    { name: "Equipa", href: "/team", icon: Users },
  ];

  return (
    <div className="w-full lg:w-[260px] bg-white/70 backdrop-blur-2xl text-slate-600 flex flex-col lg:h-full rounded-3xl lg:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(168,85,247,0.15)] border border-white/60 shrink-0 relative overflow-hidden">
      
      <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-purple-400/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Topo com Logo Centrado e Altura Reduzida no Mobile */}
      <div className="flex items-center justify-center h-16 lg:h-32 px-6 lg:px-8 shrink-0 z-10 pt-2 lg:pt-4">
        <div className="flex items-center justify-center w-full">
          <Image 
            src="/seatly_wrt.png" 
            alt="Seatly Logo" 
            width={140}
            height={45}
            priority
            className="object-contain" 
          />
        </div>
      </div>

      {/* Navegação Horizontal (Mobile) / Vertical (Desktop) */}
      <nav className="flex lg:flex-1 lg:flex-col px-3 lg:px-5 py-2 lg:py-4 gap-1 lg:gap-2 overflow-x-auto shrink-0 z-10 mt-1 lg:mt-2">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 lg:px-4 py-3 lg:py-3.5 rounded-2xl transition-all duration-300 font-semibold whitespace-nowrap ${
                isActive 
                  ? "bg-[#8B5CF6] text-white shadow-lg shadow-purple-500/30 border border-purple-400/50" 
                  : "hover:bg-white/60 text-slate-500 hover:text-purple-700 border border-transparent"
              }`}
            >
              <Icon className={`w-5 h-5 lg:w-[22px] lg:h-[22px] mr-3 lg:mr-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-purple-600'}`} />
              <span className="text-[15px] lg:text-base">{item.name}</span>
            </Link>
          );
        })}
        
        {/* Botão de Logout apenas para Mobile (inserido no scroll horizontal) */}
        <button onClick={handleLogout} className="lg:hidden flex items-center px-4 py-3 rounded-2xl transition-all duration-300 font-semibold whitespace-nowrap text-slate-500 hover:bg-red-50 hover:text-red-600 border border-transparent">
          <LogOut className="w-5 h-5 mr-2 shrink-0" />
          <span className="text-[15px]">Terminar Sessão</span>
        </button>
      </nav>

      {/* Logout Desktop (Fixo no fundo) */}
      <div className="hidden lg:block p-5 mb-2 z-10">
        <button onClick={handleLogout} className="flex items-center justify-center w-full px-5 py-3.5 text-slate-500 hover:text-red-600 hover:bg-red-50/80 hover:border-red-100 border border-transparent backdrop-blur-md rounded-2xl transition-all duration-300 font-semibold text-[15px] group">
          <LogOut className="w-5 h-5 mr-3 shrink-0 group-hover:scale-110 transition-transform" />
          Terminar Sessão
        </button>
      </div>
    </div>
  );
}