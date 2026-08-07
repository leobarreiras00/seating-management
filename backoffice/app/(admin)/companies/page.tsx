"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Building2, Plus, ChevronRight, Edit2, Trash2, X, Upload } from "lucide-react";
import mqtt from "mqtt";

interface Company {
  id: number;
  name: string;
  logoUrl: string | null;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editCompanyId, setEditCompanyId] = useState<number | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyLogo, setEditCompanyLogo] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState("");

  const fetchCompanies = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar as empresas.");
      const data = await res.json();
      setCompanies(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();

    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL as string, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME as string,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD as string,
    });
    client.on("connect", () => {
      client.subscribe("seating/backoffice/companies");
    });

    client.on("message", (topic, message) => {
      fetchCompanies(); 
    });

    return () => {
      client.end();
    };
  }, [fetchCompanies]);

  const handleDeleteCompany = async (id: number, name: string) => {
    if (!window.confirm(`ATENÇÃO: Tens a certeza que queres apagar a empresa "${name}"? Esta ação é irreversível. Garante que apagaste primeiro os Gestores e Eventos associados.`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.Message || "Erro ao apagar a empresa. Verifica se ainda existem dependências.");
      }
      setCompanies(companies.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = (company: Company) => {
    setEditCompanyId(company.id);
    setEditCompanyName(company.name);
    setEditCompanyLogo(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompanyId) return;
    setIsEditing(true);
    setEditError("");
    try {
      const token = localStorage.getItem("token");
      const currentCompany = companies.find(c => c.id === editCompanyId);
      
      const resName = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${editCompanyId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editCompanyName,
          logoUrl: currentCompany?.logoUrl
        }),
      });

      if (!resName.ok) throw new Error("Erro ao atualizar o nome da empresa.");

      if (editCompanyLogo) {
        const formData = new FormData();
        formData.append("file", editCompanyLogo);

        const resLogo = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${editCompanyId}/logo`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (!resLogo.ok) throw new Error("O nome foi atualizado, mas ocorreu um erro no upload do novo logótipo.");
      }
      setShowEditModal(false);
      fetchCompanies();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto relative px-2 sm:px-4 lg:px-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">Empresas Clientes</h1>
          <p className="text-slate-500 mt-1">Gere as instâncias e acessos dos teus clientes.</p>
        </div>
        <Link href="/companies/new" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20">
          <Plus className="w-5 h-5" /> Nova Empresa
        </Link>
      </header>

      {isLoading && (
        <div className="flex items-center justify-center p-20">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
        </div>
      )}

      {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-medium">{error}</div>}

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
            <div key={company.id} className="relative group">
              <Link href={`/companies/${company.id}`} className="block bg-white border border-slate-100 hover:border-purple-200 hover:shadow-xl hover:shadow-purple-500/5 transition-all rounded-3xl p-6 h-full flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                  <SafeCompanyLogo
                    logoUrl={company.logoUrl}
                    companyName={company.name}
                    className="w-16 h-16"
                    fallbackSize="w-6 h-6"
                  />
                  <div className="flex-1 min-w-0 pr-8">
                    {/* ID removido daqui */}
                    <h3 className="text-lg font-bold text-slate-900 truncate">{company.name}</h3>
                  </div>
                </div>
                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between text-sm font-semibold text-purple-600 group-hover:text-purple-700">
                  Gerir Empresa <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
                <button onClick={() => openEditModal(company)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 bg-white shadow-sm border border-slate-100 rounded-lg transition-colors" title="Editar Empresa">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDeleteCompany(company.id, company.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 bg-white shadow-sm border border-slate-100 rounded-lg transition-colors" title="Apagar Empresa">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Edit2 className="w-5 h-5 text-purple-600" /> Editar Empresa</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Novo Logótipo (Opcional)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-8 w-8 text-slate-400" />
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label htmlFor="file-upload-edit" className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500">
                        <span>Carregar novo ficheiro</span>
                        <input id="file-upload-edit" name="file-upload-edit" type="file" className="sr-only" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setEditCompanyLogo(e.target.files[0]);
                          }
                        }} />
                      </label>
                    </div>
                    {editCompanyLogo ? (
                      <p className="text-xs text-emerald-600 font-bold mt-2">Selecionado: {editCompanyLogo.name}</p>
                    ) : (
                      <p className="text-xs text-slate-500">PNG, JPG, SVG até 5MB</p>
                    )}
                  </div>
                </div>
              </div>
              {editError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">
                  {editError}
                </div>
              )}
              <button
                type="submit"
                disabled={isEditing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2"
              >
                {isEditing ? "A Guardar..." : "Guardar Alterações"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SafeCompanyLogo({ logoUrl, companyName, className, fallbackSize = "w-6 h-6" }: any) {
  const [error, setError] = useState(false);
  useEffect(() => {
    setError(false);
  }, [logoUrl]);

  if (logoUrl && !error) {
    const src = logoUrl.startsWith('http') ? logoUrl : `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}`;
    return (
      <div className={`relative bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center ${className}`}>
        <img src={src} alt={companyName} className="w-full h-full object-cover" onError={() => setError(true)} />
      </div>
    );
  }

  if (companyName?.toLowerCase().includes("seatly admin") || companyName?.toLowerCase().includes("seatly")) {
    return (
      <div className={`relative bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center ${className}`}>
        <img src="/seatly_icon.png" alt="Seatly Admin Default" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-slate-50 border border-slate-100 rounded-2xl shrink-0 ${className}`}>
      <Building2 className={`${fallbackSize} text-slate-300`} />
    </div>
  );
}