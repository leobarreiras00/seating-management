"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users, User, CalendarDays, UserPlus, CalendarPlus, X, KeyRound, Trash2, Edit2, UploadCloud, FileText, Lock, AlertTriangle, Download } from "lucide-react";
import mqtt from "mqtt";

interface Company { id: number; name: string; logoUrl: string | null; }
interface AccountUser { id: number; username: string; role: string; }
interface AssignedUser { id: number; username: string; }
interface EventStats { 
  id: number; 
  name: string; 
  startDate: string; 
  endDate: string; 
  totalSeats: number; 
  treatedSeats: number; 
  assignedUsers: AssignedUser[]; 
}

interface CsvValidationError {
  line?: number;
  Line?: number;
  errorType?: string;
  ErrorType?: string;
}

export default function CompanyDetailsPage() {
  const params = useParams();
  const id = params.id as string;

  const [company, setCompany] = useState<Company | null>(null);
  const [managers, setManagers] = useState<AccountUser[]>([]);
  const [companyUsers, setCompanyUsers] = useState<AccountUser[]>([]);
  const [events, setEvents] = useState<EventStats[]>([]);
  
  const [activeTab, setActiveTab] = useState<"gestores" | "utilizadores" | "eventos">("gestores");
  const [isLoading, setIsLoading] = useState(true);

  // Modais de Conta
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccountRole, setNewAccountRole] = useState<"Gestor" | "Utilizador">("Gestor");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createAccountError, setCreateAccountError] = useState("");

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetUsername, setResetUsername] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetNewPasswordConfirm, setResetNewPasswordConfirm] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState("");

  // Modais de Evento
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventStartDate, setEventStartDate] = useState(""); 
  const [eventEndDate, setEventEndDate] = useState(""); 
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventError, setEventError] = useState("");

  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [editEventId, setEditEventId] = useState<number | null>(null);
  const [editEventName, setEditEventName] = useState("");
  const [editEventStartDate, setEditEventStartDate] = useState(""); 
  const [editEventEndDate, setEditEventEndDate] = useState(""); 
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editEventError, setEditEventError] = useState("");

  // Modais de Acesso
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEventId, setAssignEventId] = useState<number | null>(null);
  const [assignManagerId, setAssignManagerId] = useState<string>("");
  const [assignUserId, setAssignUserId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  // Modais de Upload CSV
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadEventId, setUploadEventId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"replace" | "append">("replace");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  
  // Estados de Validação Estrutural
  const [validationErrors, setValidationErrors] = useState<CsvValidationError[] | null>(null);
  const [totalValidationRows, setTotalValidationRows] = useState(0);

  const fetchCompanyData = useCallback(async () => {
    if (!id) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Token não encontrado.");

      const headers = { Authorization: `Bearer ${token}` };

      const compRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company`, { headers });
      if (!compRes.ok) throw new Error(`Erro na API: ${compRes.status}`);

      const compData: Company[] = await compRes.json();
      const currentComp = compData.find((c) => c.id === Number(id));
      if (currentComp) setCompany(currentComp);

      const manRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}/managers`, { headers });
      if (manRes.ok) setManagers(await manRes.json());

      const userRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}/users`, { headers });
      if (userRes.ok) setCompanyUsers(await userRes.json());

      const evRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}/events`, { headers });
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
    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL as string, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME as string,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD as string,
    });
    client.on("connect", () => {
      client.subscribe(`seating/events/#`);
      client.subscribe("seating/backoffice/companies");
    });
    client.on("message", () => fetchCompanyData());
    return () => { client.end(); };
  }, [id, fetchCompanyData]);

  const openCreateAccountModal = (role: "Gestor" | "Utilizador") => {
    setNewAccountRole(role);
    setNewUsername("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setCreateAccountError("");
    setShowCreateAccountModal(true);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setCreateAccountError("As palavras-passe não coincidem.");
      return;
    }

    setIsCreatingAccount(true);
    setCreateAccountError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newAccountRole, companyId: Number(id) }),
      });
      if (!res.ok) throw new Error(`Erro ao criar o ${newAccountRole.toLowerCase()}.`);
      setShowCreateAccountModal(false); 
      fetchCompanyData(); 
    } catch (err: any) { 
      setCreateAccountError(err.message); 
    } finally { 
      setIsCreatingAccount(false); 
    }
  };

  const openResetPasswordModal = (userId: number, username: string) => {
    setResetUserId(userId);
    setResetUsername(username);
    setResetNewPassword("");
    setResetNewPasswordConfirm("");
    setResetError("");
    setShowResetModal(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    if (resetNewPassword !== resetNewPasswordConfirm) {
      setResetError("As palavras-passe não coincidem.");
      return;
    }

    setIsResetting(true);
    setResetError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${resetUserId}/reset-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: resetNewPassword }),
      });
      if (!res.ok) throw new Error("Erro ao alterar palavra-passe.");
      setShowResetModal(false);
      alert("Palavra-passe alterada com sucesso!");
    } catch (err: any) { 
      setResetError(err.message); 
    } finally { 
      setIsResetting(false); 
    }
  };

  const handleDeleteUser = async (userId: number, username: string, role: string) => {
    if (!window.confirm(`Tens a certeza que queres remover o acesso do ${role.toLowerCase()} "${username}"? Esta ação é irreversível.`)) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      fetchCompanyData();
    } catch (error) { alert("Ocorreu um erro ao tentar apagar o acesso."); }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEvent(true);
    setEventError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: eventName, startDate: new Date(eventStartDate).toISOString(), endDate: new Date(eventEndDate).toISOString() }),
      });
      if (!res.ok) throw new Error("Erro ao criar o evento.");
      setEventName(""); setEventStartDate(""); setEventEndDate(""); setShowEventModal(false); fetchCompanyData(); 
    } catch (err: any) { setEventError(err.message); } finally { setIsCreatingEvent(false); }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEventId) return;
    setIsEditingEvent(true);
    setEditEventError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${editEventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editEventName, startDate: new Date(editEventStartDate).toISOString(), endDate: new Date(editEventEndDate).toISOString() }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar o evento.");
      setShowEditEventModal(false); fetchCompanyData(); 
    } catch (err: any) { setEditEventError(err.message); } finally { setIsEditingEvent(false); }
  };

  const openEditEventModal = (event: EventStats) => {
    setEditEventId(event.id); setEditEventName(event.name);
    const startStr = event.startDate ? event.startDate.split('T')[0] : "";
    const endStr = event.endDate ? event.endDate.split('T')[0] : startStr;
    setEditEventStartDate(startStr); 
    setEditEventEndDate(endStr);
    setShowEditEventModal(true);
  };

  const handleAssignAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignManagerId && !assignUserId) { 
      setAssignError("Por favor, seleciona pelo menos uma pessoa."); 
      return; 
    }
    
    setIsAssigning(true);
    setAssignError("");
    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

      if (assignManagerId) {
        const resM = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${assignEventId}/assign-user`, {
          method: "POST", headers, body: JSON.stringify({ userId: assignManagerId })
        });
        if (!resM.ok) throw new Error("Erro ao atribuir o gestor.");
      }

      if (assignUserId) {
        const resU = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${assignEventId}/assign-user`, {
          method: "POST", headers, body: JSON.stringify({ userId: assignUserId })
        });
        if (!resU.ok) throw new Error("Erro ao atribuir o utilizador.");
      }

      setShowAssignModal(false);
      setAssignManagerId("");
      setAssignUserId("");
      alert("Acesso atribuído com sucesso!");
      fetchCompanyData();
    } catch (err: any) { 
      setAssignError(err.message); 
    } finally { 
      setIsAssigning(false); 
    }
  };

  const handleDeleteEvent = async (eventId: number, evName: string) => {
    if (!window.confirm(`Tens a certeza que queres apagar o evento "${evName}"? Esta ação é irreversível e todos os dados associados serão perdidos.`)) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${eventId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      fetchCompanyData();
    } catch (error) { alert("Ocorreu um erro ao tentar apagar o evento."); }
  };

  const handleRemoveAccess = async (eventId: number, userId: number, userName: string, eventNameStr: string) => {
    if (!window.confirm(`Remover acesso de "${userName}" ao evento "${eventNameStr}"?`)) return;
    try {
      const token = localStorage.getItem("token");
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}/events/${eventId}/assign/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      fetchCompanyData();
    } catch (error) { alert("Ocorreu um erro ao tentar remover o acesso."); }
  };

  const openUploadModal = (eventId: number) => {
    setUploadEventId(eventId); setUploadFile(null); setUploadMode("replace");
    setUploadError(""); setUploadSuccess(""); setValidationErrors(null); setShowUploadModal(true);
  };

  const handleUploadCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadEventId || !uploadFile) return;
    setIsUploading(true); setUploadError(""); setUploadSuccess(""); setValidationErrors(null);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", uploadFile);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/SeatCsv/import/${uploadEventId}?mode=${uploadMode}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData
      });
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        const apiErrors = data.errors || data.Errors;
        const apiTotalRows = data.totalRows || data.TotalRows || 0;

        if (apiErrors && Array.isArray(apiErrors) && apiErrors.length > 0) {
          setValidationErrors(apiErrors);
          setTotalValidationRows(apiTotalRows);
          setIsUploading(false);
          return; 
        }
        
        throw new Error(data.message || data.Message || "Erro ao importar ficheiro.");
      }

      setUploadSuccess(data.message || data.Message || "Ficheiro importado com sucesso!");
      setUploadFile(null); fetchCompanyData(); 
    } catch (err: any) { 
      setUploadError(err.message); 
    } finally { 
      setIsUploading(false); 
    }
  };

  const handleExportErrors = () => {
    if (!validationErrors) return;
    let csvContent = "Linha;Erro\n";
    validationErrors.forEach(e => { 
      const line = e.line !== undefined ? e.line : (e.Line !== undefined ? e.Line : 0);
      const type = e.errorType || e.ErrorType || "Erro Desconhecido";
      csvContent += `${line === 0 ? 'Geral' : line};${type}\n`; 
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "relatorio_erros.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderAccountList = (list: AccountUser[], title: string, roleType: "Gestor" | "Utilizador", emptyMsg: string) => (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button onClick={() => openCreateAccountModal(roleType)} className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2">
          <UserPlus className="w-4 h-4" /> Criar {roleType}
        </button>
      </div>
      {list.length === 0 ? (
        <div className="text-center py-12 text-slate-500">{emptyMsg}</div>
      ) : (
        <div className="space-y-3">
          {list.map(account => (
            <div key={account.id} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-purple-200 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 font-bold uppercase">{account.username.charAt(0)}</div>
                <div>
                  <p className="font-bold text-slate-900">{account.username}</p>
                  <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">{account.role}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openResetPasswordModal(account.id, account.username)} className="p-2 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Repor Palavra-passe">
                  <Lock className="w-5 h-5" />
                </button>
                <button onClick={() => handleDeleteUser(account.id, account.username, account.role)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title={`Apagar ${account.role}`}>
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const sortedEvents = [...events].sort((a, b) => {
    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return dateB - dateA;
  });

  if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div></div>;
  if (!company) return <div className="p-10 text-center"><h2 className="text-2xl font-bold text-slate-900">Empresa não encontrada</h2><Link href="/companies" className="text-purple-600 mt-4 inline-block">Voltar</Link></div>;

  const groupedErrors = validationErrors ? validationErrors.reduce((acc, err) => {
    const type = err.errorType || err.ErrorType || "Erro Desconhecido";
    const line = err.line !== undefined ? err.line : (err.Line !== undefined ? err.Line : 0);
    
    if (!acc[type]) acc[type] = [];
    acc[type].push(line);
    return acc;
  }, {} as Record<string, number[]>) : {};

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
        <button onClick={() => setActiveTab("utilizadores")} className={`pb-4 text-base font-bold transition-colors relative ${activeTab === "utilizadores" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
          <div className="flex items-center gap-2"><User className="w-5 h-5" /> Utilizadores ({companyUsers.length})</div>
          {activeTab === "utilizadores" && <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 rounded-t-full"></div>}
        </button>
        <button onClick={() => setActiveTab("eventos")} className={`pb-4 text-base font-bold transition-colors relative ${activeTab === "eventos" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
          <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Eventos ({events.length})</div>
          {activeTab === "eventos" && <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 rounded-t-full"></div>}
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 min-h-[400px]">
        {activeTab === "gestores" && renderAccountList(managers, "Gestores de Conta", "Gestor", "Ainda não existem gestores atribuídos a esta empresa.")}
        
        {activeTab === "utilizadores" && renderAccountList(companyUsers, "Utilizadores de Conta", "Utilizador", "Ainda não existem utilizadores atribuídos a esta empresa.")}

        {activeTab === "eventos" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Eventos da Empresa</h2>
              <button onClick={() => setShowEventModal(true)} className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center gap-2">
                <CalendarPlus className="w-4 h-4" /> Criar Evento
              </button>
            </div>
            {sortedEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Esta empresa ainda não tem eventos criados.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {sortedEvents.map(event => {
                  const progress = event.totalSeats > 0 ? Math.round((event.treatedSeats / event.totalSeats) * 100) : 0;
                  return (
                    <div key={event.id} className="p-5 rounded-2xl border border-slate-100 hover:border-purple-200 transition-colors flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-bold text-slate-900 text-lg mb-1">{event.name}</h3>
                            <div className="flex flex-col gap-0.5 mt-1 mb-4">
                              <span className="text-sm text-slate-500">
                                <strong className="font-semibold text-slate-600">Data de Início:</strong> {event.startDate ? new Date(event.startDate).toLocaleDateString('pt-PT') : "N/D"}
                              </span>
                              {event.endDate && event.endDate !== event.startDate && (
                                <span className="text-sm text-slate-500">
                                  <strong className="font-semibold text-slate-600">Data de Fim:</strong> {new Date(event.endDate).toLocaleDateString('pt-PT')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => openUploadModal(event.id)} className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Importar Convidados (CSV)">
                              <UploadCloud className="w-5 h-5" />
                            </button>
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
                        <div className="flex justify-between mt-4 pt-4 border-t border-slate-50 text-sm">
                          <span className="text-slate-500">Capacidade Importada: <strong className="text-slate-900">{event.totalSeats}</strong></span>
                          <span className="text-slate-500">Tratados: <strong className="text-emerald-600">{event.treatedSeats}</strong></span>
                        </div>
                        
                        {event.assignedUsers && event.assignedUsers.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Acessos Atribuídos</p>
                            <div className="flex flex-wrap gap-2">
                              {event.assignedUsers.map(au => (
                                <span key={au.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 text-sm font-semibold text-purple-700 shadow-sm">
                                  {au.username}
                                  <button onClick={() => handleRemoveAccess(event.id, au.id, au.username, event.name)} className="hover:bg-purple-200 p-0.5 rounded-md transition-colors" title="Remover Acesso">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => { setAssignEventId(event.id); setShowAssignModal(true); }} className="mt-5 w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors">
                        <KeyRound className="w-4 h-4 text-purple-500" /> Atribuir Acesso
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">Novo {newAccountRole}</h3>
              <button onClick={() => setShowCreateAccountModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateAccount} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Utilizador</label>
                <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Palavra-passe</label>
                <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Confirmar Palavra-passe</label>
                <input type="password" required value={newPasswordConfirm} onChange={(e) => setNewPasswordConfirm(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {createAccountError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{createAccountError}</div>}
              <button type="submit" disabled={isCreatingAccount} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">
                {isCreatingAccount ? "A Criar..." : `Criar ${newAccountRole}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Lock className="w-5 h-5 text-amber-500" /> Repor Password</h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-5">
              <p className="text-sm text-slate-500">Vais definir uma nova palavra-passe para <strong>{resetUsername}</strong>.</p>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nova Palavra-passe</label>
                <input type="password" required value={resetNewPassword} onChange={(e) => setResetNewPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-amber-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Confirmar Nova Palavra-passe</label>
                <input type="password" required value={resetNewPasswordConfirm} onChange={(e) => setResetNewPasswordConfirm(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-amber-500" />
              </div>
              {resetError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{resetError}</div>}
              <button type="submit" disabled={isResetting} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">
                {isResetting ? "A Repor..." : "Confirmar Alteração"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-purple-600" /> Atribuir Acesso</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAssignAccess} className="p-6 space-y-5">
              <p className="text-sm text-slate-500 mb-2">Seleciona um Gestor ou um Utilizador para dar acesso ao evento.</p>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Selecionar Gestor</label>
                <select value={assignManagerId} onChange={(e) => { setAssignManagerId(e.target.value); setAssignUserId(""); }} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="" disabled={assignUserId !== ""}>Escolhe um gestor...</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.username}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-xs font-bold text-slate-400 uppercase">Ou</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Selecionar Utilizador</label>
                <select value={assignUserId} onChange={(e) => { setAssignUserId(e.target.value); setAssignManagerId(""); }} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white">
                  <option value="" disabled={assignManagerId !== ""}>Escolhe um utilizador...</option>
                  {companyUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
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
                <input type="date" required value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Data de Fim</label>
                <input type="date" required value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {eventError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{eventError}</div>}
              <button type="submit" disabled={isCreatingEvent} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">{isCreatingEvent ? "A Criar..." : "Criar Evento"}</button>
            </form>
          </div>
        </div>
      )}

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
                <input type="date" required value={editEventStartDate} onChange={(e) => setEditEventStartDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Data de Fim</label>
                <input type="date" required value={editEventEndDate} onChange={(e) => setEditEventEndDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {editEventError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{editEventError}</div>}
              <button type="submit" disabled={isEditingEvent} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">
                {isEditingEvent ? "A Guardar..." : "Guardar Alterações"}
              </button>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-emerald-600" /> Importar CSV</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              {uploadSuccess ? (
                <div className="bg-emerald-50 rounded-2xl flex flex-col items-center text-center p-6">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <h4 className="font-bold text-emerald-800 mb-1">Importação Concluída</h4>
                  <p className="text-sm text-emerald-600 font-medium">{uploadSuccess}</p>
                  <button type="button" onClick={() => setShowUploadModal(false)} className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-colors">Fechar</button>
                </div>
              ) : validationErrors && validationErrors.length > 0 ? (
                <div className="animate-in fade-in duration-300">
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 mb-6">
                    <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-red-800 text-base mb-1">Importação Recusada</h4>
                      <p className="text-sm text-red-600 font-medium">Foram encontrados {validationErrors.length} erros em {totalValidationRows} linhas. Corrige o ficheiro e tenta novamente.</p>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto mb-6 pr-2">
                    {Object.entries(groupedErrors).map(([type, lines]) => (
                      <details key={type} className="mb-2 bg-white rounded-xl border border-red-100 overflow-hidden group">
                        <summary className="bg-white px-4 py-3.5 font-semibold text-slate-800 cursor-pointer hover:bg-red-50 flex items-center justify-between transition-colors">
                          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> {type}</span>
                          <span className="bg-red-100 text-red-800 text-xs py-1 px-2.5 rounded-lg font-bold">{lines.length} ocorrências</span>
                        </summary>
                        <div className="p-4 pt-2 text-sm text-slate-600 border-t border-red-50 bg-slate-50/50">
                          <span className="font-semibold text-slate-700 mb-1 block">Linhas afetadas:</span>
                          <br/>
                          {lines.map(l => l === 0 ? "Geral" : l).join(", ")}
                        </div>
                      </details>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setValidationErrors(null)} className="flex-1 py-3.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">Tentar Novamente</button>
                    <button type="button" onClick={handleExportErrors} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg"><Download className="w-4 h-4" /> Exportar Relatório</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleUploadCsv} className="space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Ficheiro de Convidados</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl hover:bg-slate-50 transition-colors bg-white">
                      <div className="space-y-1 text-center">
                        <FileText className="mx-auto h-8 w-8 text-slate-400" />
                        <div className="flex text-sm text-slate-600 justify-center mt-2">
                          <label htmlFor="csv-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none">
                            <span>Procurar ficheiro .csv</span>
                            <input id="csv-upload" name="csv-upload" type="file" accept=".csv" className="sr-only" onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) setUploadFile(e.target.files[0]);
                            }} />
                          </label>
                        </div>
                        {uploadFile ? (
                          <p className="text-xs text-emerald-600 font-bold mt-2 border border-emerald-100 bg-emerald-50 p-2 rounded-lg truncate px-4">{uploadFile.name}</p>
                        ) : (
                          // 👇 TEXTO ATUALIZADO SEM O ;ESTADO 👇
                          <p className="text-xs text-slate-500 mt-2">Colunas: MESA;LUGAR;CATEGORIA;NOME</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Método de Importação</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setUploadMode("replace")} className={`py-3 px-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-colors ${uploadMode === 'replace' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        <Trash2 className={`w-5 h-5 mb-1 ${uploadMode === 'replace' ? 'text-emerald-600' : 'text-slate-400'}`} /> Substituir Lista
                      </button>
                      <button type="button" onClick={() => setUploadMode("append")} className={`py-3 px-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-colors ${uploadMode === 'append' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        <CalendarPlus className={`w-5 h-5 mb-1 ${uploadMode === 'append' ? 'text-emerald-600' : 'text-slate-400'}`} /> Adicionar à Lista
                      </button>
                    </div>
                  </div>
                  
                  {uploadError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 shadow-sm">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-red-800 text-sm">Falha na Leitura</h4>
                        <p className="text-sm text-red-600 font-medium mt-0.5">{uploadError}</p>
                      </div>
                    </div>
                  )}

                  <button type="submit" disabled={isUploading || !uploadFile} className={`w-full text-white font-bold py-3.5 rounded-xl transition-colors mt-2 flex justify-center items-center shadow-lg ${(isUploading || !uploadFile) ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'}`}>
                    {isUploading ? <div className="flex items-center gap-2"><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div> A Processar...</div> : "Iniciar Importação"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}