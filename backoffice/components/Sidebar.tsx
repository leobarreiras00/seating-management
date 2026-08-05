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
    <div className="w-full lg:w-[280px] bg-slate-900/80 backdrop-blur-3xl text-slate-300 flex flex-col lg:h-full rounded-3xl lg:rounded-[2.5rem] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/20 shrink-0 relative overflow-hidden">
      
      {/* Brilho de fundo (Glow effect) para acentuar o estilo moderno */}
      <div className="absolute top-[-20%] left-[-10%] w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] pointer-events-none"></div>

      {/* Topo expandido para albergar o zoom da imagem */}
      <div className="flex items-center justify-between lg:justify-start h-24 lg:h-36 px-6 lg:px-8 border-b border-white/10 shrink-0 z-10">
        <div className="flex items-center">
          <div className="relative w-16 h-16 lg:w-24 lg:h-24 mr-2 lg:mr-4 shrink-0 flex items-center justify-center">
            <Image 
              src="/seatly_icon.png" 
              alt="Seatly Logo" 
              fill
              sizes="(max-width: 768px) 64px, 96px"
              priority
              className="object-contain drop-shadow-2xl scale-[1.6] lg:scale-[2.0]" 
            />
          </div>
          <span className="text-white font-black text-3xl lg:text-4xl tracking-wide">Seatly</span>
        </div>

        <button onClick={handleLogout} className="lg:hidden p-2 text-slate-400 hover:text-red-400 hover:bg-white/10 backdrop-blur-md rounded-2xl transition-all z-10 relative">
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex lg:flex-1 lg:flex-col px-2 lg:px-5 py-2 lg:py-8 gap-1 lg:gap-3 overflow-x-auto shrink-0 z-10">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 lg:px-5 py-3 lg:py-4 rounded-2xl lg:rounded-[1.25rem] transition-all duration-300 font-medium whitespace-nowrap ${
                isActive 
                  ? "bg-purple-500/90 text-white shadow-lg shadow-purple-500/25 backdrop-blur-md border border-purple-400/50" 
                  : "hover:bg-white/10 hover:text-white border border-transparent"
              }`}
            >
              <Icon className="w-5 h-5 lg:w-6 lg:h-6 mr-3 lg:mr-4 shrink-0" />
              <span className="text-base lg:text-lg">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Desktop */}
      <div className="hidden lg:block p-5 border-t border-white/10 mb-2 z-10">
        <button onClick={handleLogout} className="flex items-center w-full px-5 py-4 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/30 border border-transparent backdrop-blur-md rounded-[1.25rem] transition-all duration-300 font-medium text-lg group">
          <LogOut className="w-5 h-5 mr-4 shrink-0 group-hover:scale-110 transition-transform" />
          Terminar Sessão
        </button>
      </div>
    </div>
  );
}