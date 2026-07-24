"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Building2, LogOut } from "lucide-react";

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
  ];

  return (
    <div className="w-full lg:w-[280px] bg-slate-900/85 backdrop-blur-2xl text-slate-300 flex flex-col lg:h-full rounded-3xl lg:rounded-[2.5rem] shadow-2xl border border-white/10 shrink-0">
      
      {/* Topo expandido para albergar o zoom da imagem */}
      <div className="flex items-center justify-between lg:justify-start h-24 lg:h-36 px-6 lg:px-8 border-b border-white/10 shrink-0 overflow-hidden">
        <div className="flex items-center">
          
          {/* 👇 A MAGIA DO ZOOM: relative + fill + scale agressivo 👇 */}
          <div className="relative w-16 h-16 lg:w-24 lg:h-24 mr-2 lg:mr-4 shrink-0 flex items-center justify-center">
            <Image 
              src="/seatly_icon.png" 
              alt="Seatly Logo" 
              fill
              priority
              className="object-contain drop-shadow-2xl scale-[1.6] lg:scale-[2.0]" 
            />
          </div>
          
          <span className="text-white font-black text-3xl lg:text-4xl tracking-wide z-10">Seatly</span>
        </div>

        <button onClick={handleLogout} className="lg:hidden p-2 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all z-10 relative">
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex lg:flex-1 lg:flex-col px-2 lg:px-5 py-2 lg:py-8 gap-1 lg:gap-3 overflow-x-auto shrink-0">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-4 lg:px-5 py-3 lg:py-4 rounded-xl lg:rounded-2xl transition-all font-medium whitespace-nowrap ${
                isActive 
                  ? "bg-purple-500/90 text-white shadow-lg shadow-purple-500/20 backdrop-blur-sm" 
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 lg:w-6 lg:h-6 mr-3 lg:mr-4 shrink-0" />
              <span className="text-base lg:text-lg">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout Desktop */}
      <div className="hidden lg:block p-5 border-t border-white/10 mb-2">
        <button onClick={handleLogout} className="flex items-center w-full px-5 py-4 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-2xl transition-all font-medium text-lg">
          <LogOut className="w-5 h-5 mr-4 shrink-0" />
          Terminar Sessão
        </button>
      </div>
    </div>
  );
}