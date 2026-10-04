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
    <aside className="w-full lg:w-[248px] bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-row lg:flex-col items-center lg:items-stretch shrink-0 lg:h-full px-3 lg:px-4 py-2 lg:py-6 gap-2 lg:gap-0">

      {/* TOPO: logótipo */}
      <div className="flex items-center shrink-0 lg:px-3 lg:pb-8">
        <Image
          src="/seatly_wrt.png"
          alt="Seatly"
          width={120}
          height={40}
          priority
          className="object-contain w-20 sm:w-24 lg:w-[116px] h-auto"
        />
      </div>

      {/* NAVEGAÇÃO: em linha no telemóvel (só ícones), em coluna no ecrã largo */}
      <nav aria-label="Principal" className="flex flex-1 lg:flex-col gap-1 overflow-x-auto scrollbar-hide justify-center lg:justify-start">
        {menuItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              aria-label={item.name}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-[15px] font-semibold whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-purple-50 text-purple-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {isActive && <span className="hidden lg:block absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-purple-600" />}
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-purple-600" : "text-slate-400"}`} />
              <span className="hidden lg:block">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* TERMINAR SESSÃO */}
      <button
        onClick={handleLogout}
        title="Terminar sessão"
        aria-label="Terminar sessão"
        className="shrink-0 flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl text-[15px] font-semibold text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
      >
        <LogOut className="w-5 h-5 shrink-0" />
        <span className="hidden lg:block">Terminar sessão</span>
      </button>
    </aside>
  );
}
