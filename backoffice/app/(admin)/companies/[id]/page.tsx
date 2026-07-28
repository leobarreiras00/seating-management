"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users, CalendarDays, UserPlus, CalendarPlus, X, KeyRound, Trash2, Edit2 } from "lucide-react";
import mqtt from "mqtt";

interface Company { id: number; name: string; logoUrl: string | null; }
interface Manager { id: number; username: string; role: string; }
interface AssignedManager { id: number; username: string; }
interface EventStats { 
  id: number; 
  name: string; 
  startDate: string; 
  totalSeats: number; 
  treatedSeats: number; 
  assignedManagers: AssignedManager[]; 
}

export default function CompanyDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [events, setEvents] = useState<EventStats[]>([]);
  
  const [activeTab, setActiveTab] = useState<"gestores" | "eventos">("gestores");
  const [isLoading, setIsLoading] = useState(true);

  // Estados do Modal de Criar Gestor
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [managerError, setManagerError] = useState("");

  // Estados do Modal de Criar Evento
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventSeats, setEventSeats] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventError, setEventError] = useState("");

  // Estados do Modal de Editar Evento
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editEventId, setEditEventId] = useState<number | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventDate, setEditEventDate] = useState("");
  const [editEventSeats, setEditEventSeats] = useState("");
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventError, setEditEventError] = useState("");

  // Estados do Modal de Atribuir Gestor
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEventId, setAssignEventId] = useState<number | null>(null);
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const fetchCompanyData = useCallback(async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token não encontrado.");

      const headers = { Authorization: `Bearer ${token}` };

      const compRes = await fetch(`http://localhost:5162/api/Company`, { headers });
      
      if (!compRes.ok) {
        if (compRes.status === 401) {
          console.error("Sessão expirada. Redirecionamento para login necessário.");
        }
        throw new Error(`Erro na API: ${compRes.status}`);
      }

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
  }, [id]);

  useEffect(() => {
    fetchCompanyData();
  }, [fetchCompanyData]);

  useEffect(() => {
    if (!id) return;
    
    const client = mqtt.connect("ws://localhost:9001"); 

    client.on("connect", () => {
      console.log("Backoffice ligado ao MQTT com sucesso!");
      client.subscribe(`seating/events/#`);
      client.subscribe("seating/backoffice/companies");
    });

    client.on("message", (topic, message) => {
      console.log("Nova atualização MQTT recebida no tópico:", topic);
      fetchCompanyData();
    });

    return () => {
      client.end();
    };
  }, [id, fetchCompanyData]);

  const handleCreateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingManager(true);
    setManagerError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5162/api/Auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: "Gestor", companyId: Number(id) }),
      });
      if (!res.ok) throw new Error("Erro ao criar o gestor.");
      setNewUsername(""); setNewPassword(""); setShowManagerModal(false); fetchCompanyData(); 
    } catch (err: any) { setManagerError(err.message); } finally { setIsCreatingManager(false); }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEvent(true);
    setEventError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5162/api/Company/${id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: eventName, startDate: new Date(eventDate).toISOString(), totalSeats: Number(eventSeats) }),
      });
      if (!res.ok) throw new Error("Erro ao criar o evento.");
      setEventName(""); setEventDate(""); setEventSeats(""); setShowEventModal(false); fetchCompanyData(); 
    } catch (err: any) { setEventError(err.message); } finally { setIsCreatingEvent(false); }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEventId) return;
    setIsEditingEvent(true);
    setEditEventError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5162/api/Event/${editEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editEventName, startDate: new Date(editEventDate).toISOString(), totalSeats: Number(editEventSeats) }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar o evento.");
      setShowEditEventModal(false); 
      fetchCompanyData(); 
    } catch (err: any) { setEditEventError(err.message); } finally { setIsEditingEvent(false); }
  };

  const handleAssignManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignUserId) { setAssignError("Por favor, seleciona um gestor."); return; }
    setIsAssigning(true);
    setAssignError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5162/api/Event/${assignEventId}/assign-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: assignUserId }), 
      });
      if (!res.ok) {
        const errData = await res.json().catch(()=>({}));
        throw new Error(errData.Message || "Erro ao atribuir o gestor.");
      }
      setShowAssignModal(false);
      setAssignUserId("");
      alert("Gestor atribuído com sucesso!");
      fetchCompanyData();
    } catch (err: any) { setAssignError(err.message); } finally { setIsAssigning(false); }
  };

  const handleDeleteEvent = async (eventId: number, evName: string) => {
    if (!window.confirm(`Tens a certeza que queres apagar o evento "${evName}"? Esta ação é irreversível e todos os dados associados serão perdidos.`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5162/api/Event/${eventId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao apagar o evento.");
      fetchCompanyData();
    } catch (error) {
      alert("Ocorreu um erro ao tentar apagar o evento.");
    }
  };

  const handleDeleteManager = async (managerId: number, managerName: string) => {
    if (!window.confirm(`Tens a certeza que queres remover o acesso ao gestor "${managerName}"? Esta ação é irreversível.`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5162/api/Auth/user/${managerId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao apagar o gestor.");
      fetchCompanyData();
    } catch (error) {
      alert("Ocorreu um erro ao tentar apagar o gestor.");
    }
  };

  const handleRemoveAccess = async (eventId: number, userId: number, userName: string, eventNameStr: string) => {
    if (!window.confirm(`Remover acesso de "${userName}" ao evento "${eventNameStr}"?`)) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5162/api/Company/${id}/events/${eventId}/assign/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Erro ao remover o acesso.");
      fetchCompanyData();
    } catch (error) {
      alert("Ocorreu um erro ao tentar remover o acesso.");
    }
  };

  const openEditEventModal = (event: EventStats) => {
    setEditEventId(event.id);
    setEditEventName(event.name);
    // Formata a data para yyyy-MM-dd para encaixar no input type="date"
    setEditEventDate(event.startDate.split('T')[0]);
    setEditEventSeats(event.totalSeats.toString());
    setShowEditEventModal(true);
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
              <button onClick={() => setShowManagerModal(true)} className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2">
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
                      <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 font-bold uppercase">{manager.username.charAt(0)}</div>
                      <div>
                        <p className="font-bold text-slate-900">{manager.username}</p>
                        <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">{manager.role}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteManager(manager.id, manager.username)} 
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                      title="Apagar Gestor"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "eventos" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Eventos da Empresa</h2>
              <button onClick={() => setShowEventModal(true)} className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2">
                <CalendarPlus className="w-4 h-4" /> Criar Evento
              </button>
            </div>
            {events.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Esta empresa ainda não tem eventos criados.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {events.map(event => {
                  const progress = event.totalSeats > 0 ? Math.round((event.treatedSeats / event.totalSeats) * 100) : 0;
                  return (
                    <div key={event.id} className="p-5 rounded-2xl border border-slate-100 hover:border-purple-200 transition-colors flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg">{event.name}</h3>
                            <p className="text-sm text-slate-500 mb-4">{new Date(event.startDate).toLocaleDateString('pt-PT')}</p>
                          </div>
                          
                          {/* Botões de Ação do Evento */}
                          <div className="flex gap-2">
                            <button onClick={() => openEditEventModal(event)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Evento">
                              <Edit2 className="w-5 h-5" />
                            </button>
                            <button onClick={() => handleDeleteEvent(event.id, event.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Apagar Evento">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm mb-2"><span className="font-medium text-slate-600">Progresso</span><span className="font-bold text-purple-600">{progress}%</span></div>
                        <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-purple-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
                        <div className="flex justify-between mt-4 pt-4 border-t border-slate-50 text-sm"><span className="text-slate-500">Total: <strong className="text-slate-900">{event.totalSeats}</strong></span><span className="text-slate-500">Tratados: <strong className="text-emerald-600">{event.treatedSeats}</strong></span></div>
                        
                        {event.assignedManagers && event.assignedManagers.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Gestores Atribuídos</p>
                            <div className="flex flex-wrap gap-2">
                              {event.assignedManagers.map(am => (
                                <span key={am.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 text-sm font-semibold text-purple-700 shadow-sm">
                                  {am.username}
                                  <button onClick={() => handleRemoveAccess(event.id, am.id, am.username, event.name)} className="hover:bg-purple-200 p-0.5 rounded-md transition-colors" title="Remover Acesso">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <button onClick={() => { setAssignEventId(event.id); setShowAssignModal(true); }} className="mt-5 w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors">
                        <KeyRound className="w-4 h-4 text-purple-500" /> Atribuir Gestor
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Criar Gestor */}
      {showManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Novo Gestor de Conta</h3>
              <button onClick={() => setShowManagerModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateManager} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Utilizador</label>
                <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Palavra-passe</label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {managerError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{managerError}</div>}
              <button type="submit" disabled={isCreatingManager} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">{isCreatingManager ? "A Criar..." : "Criar Acesso"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Criar Evento */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Novo Evento</h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Evento</label>
                <input type="text" required value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Data de Início</label>
                <input type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Total de Lugares</label>
                <input type="number" required min="1" value={eventSeats} onChange={(e) => setEventSeats(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {eventError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{eventError}</div>}
              <button type="submit" disabled={isCreatingEvent} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">{isCreatingEvent ? "A Criar..." : "Criar Evento"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Evento */}
      {showEditEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Edit2 className="w-5 h-5 text-purple-600" /> Editar Evento</h3>
              <button onClick={() => setShowEditEventModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateEvent} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome do Evento</label>
                <input type="text" required value={editEventName} onChange={(e) => setEditEventName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Data de Início</label>
                <input type="date" required value={editEventDate} onChange={(e) => setEditEventDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Total de Lugares</label>
                <input type="number" required min="1" value={editEventSeats} onChange={(e) => setEditEventSeats(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {editEventError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{editEventError}</div>}
              <button type="submit" disabled={isEditingEvent} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">
                {isEditingEvent ? "A Guardar..." : "Guardar Alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Atribuir Gestor */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-purple-600" /> Atribuir Acesso</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAssignManager} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Selecionar Gestor</label>
                <select required value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="" disabled>Escolhe um gestor da lista...</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.username} ({m.role})</option>
                  ))}
                </select>
              </div>
              {assignError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{assignError}</div>}
              <button type="submit" disabled={isAssigning} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2 flex justify-center items-center shadow-lg shadow-emerald-600/20">
                {isAssigning ? "A Atribuir..." : "Confirmar Atribuição"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}