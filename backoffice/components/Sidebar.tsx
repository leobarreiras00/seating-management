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
    <div className="w-full lg:w-[260px] bg-white/70 backdrop-blur-2xl text-slate-600 flex flex-col lg:h-full rounded-[1.5rem] lg:rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(168,85,247,0.15)] border border-white/60 shrink-0 relative overflow-hidden">
      
      <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-purple-400/10 rounded-full blur-[80px] pointer-events-none"></div>

      {/* TOPO: Logo reduzido e mais compacto no mobile, volta ao normal em lg */}
      <div className="flex items-center justify-center h-14 sm:h-16 lg:h-32 px-4 lg:px-8 shrink-0 z-10 pt-2 lg:pt-4">
        <div className="flex items-center justify-center w-full">
          <Image 
            src="/seatly_wrt.png" 
            alt="Seatly Logo" 
            width={120} // Ligeiramente menor para mobile
            height={40}
            priority
            className="object-contain w-24 sm:w-28 lg:w-[140px]" 
          />
        </div>
      </div>

      {/* NAVEGAÇÃO: Botões simétricos no horizontal, empilhados no vertical */}
      <nav className="flex lg:flex-1 lg:flex-col px-2 sm:px-4 lg:px-5 pb-3 lg:py-4 gap-1.5 sm:gap-2 lg:gap-2 overflow-x-auto shrink-0 z-10 scrollbar-hide w-full justify-between lg:justify-start">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={`flex-1 lg:flex-none flex items-center justify-center lg:justify-start px-2 lg:px-4 py-2.5 sm:py-3 lg:py-3.5 rounded-xl sm:rounded-2xl transition-all duration-300 font-semibold whitespace-nowrap min-w-[50px] ${
                isActive 
                  ? "bg-[#8B5CF6] text-white shadow-lg shadow-purple-500/30 border border-purple-400/50" 
                  : "bg-slate-100/50 hover:bg-white text-slate-600 hover:text-purple-700 border border-slate-200/50 shadow-sm"
              }`}
            >
              <Icon className={`w-5 h-5 sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px] lg:mr-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-purple-600'}`} />
              <span className="hidden lg:block text-base">{item.name}</span>
            </Link>
          );
        })}
        
        {/* LOGOUT MOBILE: Partilha o mesmo comportamento simétrico (flex-1) */}
        <button 
          onClick={handleLogout} 
          title="Terminar Sessão"
          className="lg:hidden flex-1 flex items-center justify-center py-2.5 sm:py-3 rounded-xl sm:rounded-2xl transition-all duration-300 bg-slate-100/50 hover:bg-red-50 text-slate-500 hover:text-red-600 border border-slate-200/50 shadow-sm shrink-0 min-w-[50px]"
        >
          <LogOut className="w-5 h-5 sm:w-5 sm:h-5" />
        </button>
      </nav>

      {/* LOGOUT DESKTOP */}
      <div className="hidden lg:block p-5 mb-2 z-10">
        <button onClick={handleLogout} className="flex items-center justify-center w-full px-5 py-3.5 text-slate-500 hover:text-red-600 hover:bg-red-50/80 hover:border-red-100 border border-transparent backdrop-blur-md rounded-2xl transition-all duration-300 font-semibold text-[15px] group">
          <LogOut className="w-5 h-5 mr-3 shrink-0 group-hover:scale-110 transition-transform" />
          Terminar Sessão
        </button>
      </div>
    </div>
  );
}