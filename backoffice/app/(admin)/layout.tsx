"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  if (!isAuthorized) return null;

  return (
    // 👇 O FUNDO GERAL COM ESPAÇAMENTO P/ O EFEITO FLUTUANTE 👇
    <div className="flex h-screen bg-slate-100 p-4 gap-4 overflow-hidden">
      
      <Sidebar />
      
      {/* O QUADRO BRANCO PRINCIPAL TAMBÉM EM SQUIRCLE */}
      <main className="flex-1 bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-y-auto">
        <div className="p-10 min-h-full">
          {children}
        </div>
      </main>
      
    </div>
  );
}