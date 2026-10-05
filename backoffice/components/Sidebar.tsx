"use client";

/**
 * Sidebar — navegação principal do backoffice.
 *
 * Desktop (≥ lg): coluna de vidro "flutuante" à esquerda, com margem à volta.
 * Telemóvel: barra horizontal no topo, só com ícones.
 *
 * Aspeto: classe `.nav-item` em globals.css (o item ativo — `aria-current="page"` —
 * fica com a pílula em gradiente). Para adicionar uma página ao menu basta
 * acrescentar uma linha a `menuItems`.
 *
 * Lógica (inalterada): `handleLogout` apaga o token e volta ao /login.
 */
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
    <aside className="glass w-full lg:w-[256px] lg:m-4 lg:mr-0 lg:rounded-[2rem] flex flex-row lg:flex-col items-center lg:items-stretch shrink-0 lg:h-[calc(100%-2rem)] px-3 lg:px-4 py-2 lg:py-6 gap-2 lg:gap-0 z-40">

      {/* TOPO: logótipo */}
      <div className="flex items-center shrink-0 lg:px-3 lg:pb-8">
        <Image
          src="/seatly_wrt.png"
          alt="Seatly"
          width={120}
          height={40}
          priority
          className="object-contain w-20 sm:w-24 lg:w-[124px] h-auto"
        />
      </div>

      {/* NAVEGAÇÃO: em linha no telemóvel (só ícones), em coluna no ecrã largo */}
      <nav aria-label="Principal" className="flex flex-1 lg:flex-col gap-1.5 overflow-x-auto scrollbar-hide justify-center lg:justify-start">
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
              className="nav-item"
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Cartão de marca (só desktop): reforça a identidade e preenche o espaço vazio */}
      <div className="hidden lg:block mx-1 mb-4 rounded-3xl p-4 text-white relative overflow-hidden bg-[linear-gradient(135deg,#7c3aed,#3b82f6)] shadow-[0_14px_30px_-14px_rgba(124,58,237,0.8)]">
        <div aria-hidden className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/20 blur-xl" />
        <p className="relative font-display font-bold leading-tight">Cada convidado no seu lugar.</p>
        <p className="relative text-[11px] text-white/80 mt-1">Seatly · Administração central</p>
      </div>

      {/* TERMINAR SESSÃO */}
      <button
        onClick={handleLogout}
        title="Terminar sessão"
        aria-label="Terminar sessão"
        className="nav-item shrink-0 hover:!bg-red-50 hover:!text-red-600"
      >
        <LogOut className="w-5 h-5 shrink-0" />
        <span className="hidden lg:block">Terminar sessão</span>
      </button>
    </aside>
  );
}
