"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Plus, ChevronRight, Image as ImageIcon } from "lucide-react";

interface Company {
  id: number;
  name: string;
  logoUrl: string | null;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:5162/api/Company", {
          headers: { 
            Authorization: `Bearer ${token}` 
          },
        });

        if (!res.ok) {
          throw new Error("Falha ao carregar as empresas.");
        }

        const data = await res.json();
        setCompanies(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanies();
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Cabeçalho */}
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Empresas Clientes</h1>
          <p className="text-slate-500 mt-1">Gere as instâncias e acessos dos teus clientes.</p>
        </div>
        
        {/* O botão para criar uma nova empresa (ainda vamos criar esta rota a seguir) */}
        <Link 
          href="/companies/new" 
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20"
        >
          <Plus className="w-5 h-5" />
          Nova Empresa
        </Link>
      </header>

      {/* Estados de Carregamento e Erro */}
      {isLoading && (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-medium">
          {error}
        </div>
      )}

      {/* Grelha de Cartões das Empresas */}
      {!isLoading && !error && companies.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-[2rem] p-16 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-4">
            <Building2 className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">Sem empresas ativas</h3>
          <p className="text-slate-500 max-w-sm mb-6">Ainda não tens nenhum cliente registado na plataforma. Cria a tua primeira empresa para começar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {companies.map((company) => (
            <Link 
              href={`/companies/${company.id}`} 
              key={company.id}
              className="bg-white border border-slate-100 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-500/5 transition-all rounded-3xl p-6 group flex flex-col cursor-pointer"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                  {company.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={company.logoUrl} alt={company.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 truncate">{company.name}</h3>
                  <p className="text-sm text-slate-500">ID: {company.id}</p>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between text-sm font-semibold text-purple-600 group-hover:text-purple-700">
                Gerir Instância
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}