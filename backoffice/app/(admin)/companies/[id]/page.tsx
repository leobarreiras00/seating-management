"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users, CalendarDays, UserPlus, X } from "lucide-react";

interface Company { id: number; name: string; logoUrl: string | null; }
interface Manager { id: number; username: string; role: string; }
interface EventStats { id: number; name: string; startDate: string; totalSeats: number; treatedSeats: number; }

export default function CompanyDetailsPage() {
  const params = useParams();
  const id = params.id;

  const [company, setCompany] = useState<Company | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [events, setEvents] = useState<EventStats[]>([]);
  
  const [activeTab, setActiveTab] = useState<"gestores" | "eventos">("gestores");
  const [isLoading, setIsLoading] = useState(true);

  // Estados do Modal
  const [showModal, setShowModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [managerError, setManagerError] = useState("");

  const fetchCompanyData = async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const compRes = await fetch("http://localhost:5162/api/Company", { headers });
      const compData: Company[] = await compRes.json();
      const currentComp = compData.find((c) => c.id === Number(id));
      if (currentComp) setCompany(currentComp);

      const manRes = await fetch(`http://localhost:5162/api/Company/${id}/managers`, { headers });
      if (manRes.ok) setManagers(await manRes.json());

      const evRes = await fetch(`http://localhost:5162/api/Company/${id}/events`, { headers });
      if (evRes.ok) setEvents(await evRes.json());
    } catch (error) {
      console.error("Erro ao carregar os dados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchCompanyData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Função que comunica com a API para criar o Gestor
  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingManager(true);
    setManagerError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5162/api/Auth/register", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: "Gestor",
          companyId: Number(id)
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.Message || "Erro ao criar o gestor. O nome de utilizador pode já existir.");
      }

      // Sucesso! Limpa o form, fecha o modal e recarrega os dados silenciosamente
      setNewUsername("");
      setNewPassword("");
      setShowModal(false);
      fetchCompanyData(); 
      
    } catch (err: any) {
      setManagerError(err.message);
    } finally {
      setIsCreatingManager(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div></div>;
  if (!company) return <div className="p-10 text-center"><h2 className="text-2xl font-bold text-slate-900">Empresa não encontrada</h2><Link href="/companies" className="text-purple-600 mt-4 inline-block">Voltar</Link></div>;

  return (
    <div className="max-w-6xl mx-auto relative">
      <Link href="/companies" className="inline-flex items-center text-slate-500 hover:text-purple-600 font-medium mb-8 transition-colors">
        <ChevronLeft className="w-5 h-5 mr-1" /> Voltar para Empresas
      </Link>

      <div className="flex items-center gap-6 mb-10 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="w-24 h-24 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 shrink-0 shadow-inner">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-slate-400 font-bold text-xl">{company.name.charAt(0)}</span>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">{company.name}</h1>
          <p className="text-slate-500 mt-1 font-medium">ID da Instância: #{company.id}</p>
        </div>
      </div>

      <div className="flex border-b border-slate-200 mb-8 gap-8">
        <button onClick={() => setActiveTab("gestores")} className={`pb-4 text-base font-bold transition-colors relative ${activeTab === "gestores" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
          <div className="flex items-center gap-2"><Users className="w-5 h-5" /> Gestores ({managers.length})</div>
          {activeTab === "gestores" && <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 rounded-t-full"></div>}
        </button>
        <button onClick={() => setActiveTab("eventos")} className={`pb-4 text-base font-bold transition-colors relative ${activeTab === "eventos" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
          <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Eventos ({events.length})</div>
          {activeTab === "eventos" && <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 rounded-t-full"></div>}
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 min-h-[400px]">
        {activeTab === "gestores" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Gestores de Conta</h2>
              <button 
                onClick={() => setShowModal(true)}
                className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" /> Criar Gestor
              </button>
            </div>
            
            {managers.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Ainda não existem gestores atribuídos a esta empresa.</div>
            ) : (
              <div className="space-y-3">
                {managers.map(manager => (
                  <div key={manager.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-purple-200 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 font-bold uppercase">
                        {manager.username.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{manager.username}</p>
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">{manager.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "eventos" && (
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-6">Eventos da Empresa</h2>
            {events.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Esta empresa ainda não tem eventos criados.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {events.map(event => {
                  const progress = event.totalSeats > 0 ? Math.round((event.treatedSeats / event.totalSeats) * 100) : 0;
                  return (
                    <div key={event.id} className="p-5 rounded-2xl border border-slate-100 hover:border-purple-200 transition-colors">
                      <h3 className="font-bold text-slate-900 text-lg">{event.name}</h3>
                      <p className="text-sm text-slate-500 mb-4">{new Date(event.startDate).toLocaleDateString('pt-PT')}</p>
                      <div className="flex justify-between text-sm mb-2"><span className="font-medium text-slate-600">Progresso</span><span className="font-bold text-purple-600">{progress}%</span></div>
                      <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-purple-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
                      <div className="flex justify-between mt-4 pt-4 border-t border-slate-50 text-sm"><span className="text-slate-500">Total: <strong className="text-slate-900">{event.totalSeats}</strong></span><span className="text-slate-500">Tratados: <strong className="text-emerald-600">{event.treatedSeats}</strong></span></div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL DE CRIAÇÃO DE GESTOR */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Novo Gestor de Conta</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateManager} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Utilizador</label>
                <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Ex: joao_calibri" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Palavra-passe</label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="••••••••" />
              </div>
              {managerError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{managerError}</div>}
              <button type="submit" disabled={isCreatingManager} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2 flex justify-center items-center shadow-lg shadow-purple-600/20">
                {isCreatingManager ? "A Criar..." : "Criar Acesso"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}