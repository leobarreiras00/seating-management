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
    // 👇 O DESIGN APPLE GLASS FLUTUANTE 👇
    <div className="w-[280px] bg-slate-900/85 backdrop-blur-2xl text-slate-300 flex flex-col h-full rounded-[2.5rem] shadow-2xl border border-white/10 overflow-hidden relative">
      
      {/* Logótipo / Branding */}
      <div className="h-28 flex items-center px-8 border-b border-white/10 mt-2">
        <div className="w-12 h-12 bg-white rounded-[14px] flex items-center justify-center mr-4 shadow-lg overflow-hidden border border-white/20">
          <Image src="/seatly_icon.png" alt="Seatly Logo" width={48} height={48} className="object-cover" />
        </div>
        <span className="text-white font-extrabold text-2xl tracking-wide">Seatly</span>
      </div>

      {/* Navegação */}
      <nav className="flex-1 px-5 py-8 space-y-3">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-5 py-4 rounded-2xl transition-all font-medium ${
                isActive 
                  ? "bg-purple-500/90 text-white shadow-lg shadow-purple-500/20 backdrop-blur-sm" 
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5 mr-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-5 border-t border-white/10 mb-2">
        <button
          onClick={handleLogout}
          className="flex items-center w-full px-5 py-4 text-slate-400 hover:text-red-400 hover:bg-white/5 rounded-2xl transition-all font-medium"
        >
          <LogOut className="w-5 h-5 mr-4" />
          Terminar Sessão
        </button>
      </div>
    </div>
  );
}