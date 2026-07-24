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
    // 👇 Mudou de h-screen para h-[100dvh] e reduziu margens (p-2 em mobile) 👇
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-slate-100 p-2 lg:p-4 gap-2 lg:gap-4 overflow-hidden">
      
      <Sidebar />
      
      {/* 👇 Reduziu o arredondamento e o padding interno no mobile 👇 */}
      <main className="flex-1 bg-white rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-10 min-h-full">
          {children}
        </div>
      </main>
      
    </div>
  );
}