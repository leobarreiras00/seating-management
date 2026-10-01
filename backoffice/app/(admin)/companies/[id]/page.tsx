"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Users, User, CalendarDays, UserPlus, CalendarPlus, X, KeyRound, Trash2, Edit2, UploadCloud, FileText, Lock, AlertTriangle, Download, CheckCircle2, Info, Loader2, Mail, Building2 } from "lucide-react";
import mqtt from "mqtt";

interface Company { id: number; name: string; logoUrl: string | null; }
interface AccountUser { id: number; email: string; username: string; role: string; }
interface AssignedUser { id: number; username: string; }
interface EventStats {
  id: number; name: string; startDate: string; endDate: string;
  totalSeats: number; treatedSeats: number; assignedUsers: AssignedUser[];
}

interface CsvValidationError { line?: number; Line?: number; errorType?: string; ErrorType?: string; }

function CompanyDetailsContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const initialTab = searchParams.get("tab") as "gestores" | "utilizadores" | "eventos" | null;

  const [company, setCompany] = useState<Company | null>(null);
  const [managers, setManagers] = useState<AccountUser[]>([]);
  const [companyUsers, setCompanyUsers] = useState<AccountUser[]>([]);
  const [events, setEvents] = useState<EventStats[]>([]);
  
  const [activeTab, setActiveTab] = useState<"gestores" | "utilizadores" | "eventos">(
    initialTab === "eventos" || initialTab === "utilizadores" ? initialTab : "gestores"
  );
  
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean, title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);

  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [newAccountRole, setNewAccountRole] = useState<"Gestor" | "Utilizador">("Gestor");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createAccountError, setCreateAccountError] = useState("");

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

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignEvent, setAssignEvent] = useState<EventStats | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const [filesModalEvent, setFilesModalEvent] = useState<EventStats | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadEventId, setUploadEventId] = useState<number | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMode, setUploadMode] = useState<"replace" | "append">("replace");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
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

  useEffect(() => { fetchCompanyData(); }, [fetchCompanyData]);

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
    setNewName(""); 
    setNewEmail(""); 
    setCreateAccountError(""); 
    setShowCreateAccountModal(true);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingAccount(true); 
    setCreateAccountError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, name: newName, role: newAccountRole, companyId: Number(id) }),
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.Message || `Erro ao criar o ${newAccountRole.toLowerCase()}.`);
      
      setShowCreateAccountModal(false); 
      setAlertDialog({ isOpen: true, title: "Conta Criada", message: `O ${newAccountRole.toLowerCase()} foi criado com sucesso. Foi enviado um e-mail com a palavra-passe temporária.`, type: 'success' });
      fetchCompanyData();
    } catch (err: any) { 
      setCreateAccountError(err.message); 
    } finally { 
      setIsCreatingAccount(false); 
    }
  };

  const promptSendResetEmail = (email: string, name: string) => {
    setConfirmDialog({
      isOpen: true, 
      title: "Recuperar Acesso", 
      message: `Queres enviar um e-mail de recuperação de palavra-passe para "${name}" (${email})?`,
      onConfirm: async () => {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/forgot-password`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
          });
          if (!res.ok) throw new Error();
          setAlertDialog({ isOpen: true, title: "E-mail Enviado", message: "As instruções de recuperação foram enviadas para o utilizador.", type: 'success' });
        } catch (error) { 
          setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao enviar o e-mail.", type: 'error' }); 
        }
      }
    });
  };

  const promptDeleteUser = (userId: number, username: string, role: string) => {
    setConfirmDialog({
      isOpen: true, title: "Remover Acesso", message: `Tens a certeza que queres apagar permanentemente o ${role.toLowerCase()} "${username}"?`,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          fetchCompanyData();
        } catch (error) { setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao tentar apagar o acesso.", type: 'error' }); }
      }
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (new Date(eventEndDate) < new Date(eventStartDate)) {
      setEventError("A data de fim não pode ser anterior à data de início do evento.");
      return;
    }
    setIsCreatingEvent(true); setEventError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}/events`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: eventName, startDate: new Date(eventStartDate).toISOString(), endDate: new Date(eventEndDate).toISOString() }),
      });
      if (!res.ok) throw new Error("Erro ao criar o evento.");
      setEventName(""); setEventStartDate(""); setEventEndDate(""); setShowEventModal(false); fetchCompanyData();
    } catch (err: any) { setEventError(err.message); } finally { setIsCreatingEvent(false); }
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEventId) return;
    if (new Date(editEventEndDate) < new Date(editEventStartDate)) {
      setEditEventError("A data de fim não pode ser anterior à data de início do evento.");
      return;
    }
    setIsEditingEvent(true); setEditEventError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${editEventId}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
    setEditEventStartDate(startStr); setEditEventEndDate(endStr); setShowEditEventModal(true);
  };

  const promptDeleteEvent = (eventId: number, evName: string) => {
    setConfirmDialog({
      isOpen: true, title: "Apagar Evento", message: `Tens a certeza que queres apagar o evento "${evName}"? Todos os bilhetes e validações serão permanentemente destruídos.`,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${eventId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          fetchCompanyData();
        } catch (error) { setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao tentar apagar o evento.", type: 'error' }); }
      }
    });
  };

  const openAssignModal = (event: EventStats) => {
    setAssignEvent(event);
    setSelectedUserIds([]);
    setAssignError("");
    setShowAssignModal(true);
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleAssignAccess = async () => {
    if (selectedUserIds.length === 0 || !assignEvent) return;
    setIsAssigning(true); setAssignError("");
    try {
      const token = localStorage.getItem("token");
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const promises = selectedUserIds.map(userId => 
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${assignEvent.id}/assign-user`, { 
          method: "POST", headers, body: JSON.stringify({ userId }) 
        }).then(res => { if (!res.ok) throw new Error("Erro na atribuição"); })
      );
      await Promise.all(promises);
      setShowAssignModal(false);
      setAlertDialog({ isOpen: true, title: "Sucesso", message: "Os acessos foram atribuídos com sucesso à equipa selecionada!", type: 'success' });
      fetchCompanyData();
    } catch (err: any) {
      setAssignError("Alguns acessos podem não ter sido atribuídos corretamente devido a um erro de comunicação.");
    } finally {
      setIsAssigning(false);
    }
  };

  const promptRemoveAccess = (eventId: number, userId: number, userName: string, eventNameStr: string) => {
    setConfirmDialog({
      isOpen: true, title: "Remover Acesso", message: `Queres remover a permissão de "${userName}" para aceder e operar no evento "${eventNameStr}"?`,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}/events/${eventId}/assign/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          fetchCompanyData();
        } catch (error) { setAlertDialog({ isOpen: true, title: "Erro", message: "Falha ao remover o acesso do utilizador.", type: 'error' }); }
      }
    });
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
      const formData = new FormData(); formData.append("file", uploadFile);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/SeatCsv/import/${uploadEventId}?mode=${uploadMode}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiErrors = data.errors || data.Errors;
        const apiTotalRows = data.totalRows || data.TotalRows || 0;
        if (apiErrors && Array.isArray(apiErrors) && apiErrors.length > 0) {
          setValidationErrors(apiErrors); setTotalValidationRows(apiTotalRows); setIsUploading(false); return;
        }
        throw new Error(data.message || data.Message || "Erro ao importar ficheiro.");
      }
      setUploadSuccess(data.message || data.Message || "Ficheiro importado com sucesso!");
      setUploadFile(null); fetchCompanyData();
    } catch (err: any) { setUploadError(err.message); } finally { setIsUploading(false); }
  };

  const handleExportCsv = async (eventId: number, eventName: string) => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Seat/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Falha ao obter os dados para exportação.");
      const data = await res.json();
      
      let csvContent = "MESA;LUGAR;CATEGORIA;NOME;ESTADO\n";
      
      const mappedGuests = Array.isArray(data) ? data : [];
      mappedGuests.forEach((g: any) => {
        const seatNumFull = g.seatNumber || g.SeatNumber || "";
        const [table, seat] = seatNumFull.includes('-') ? seatNumFull.split('-') : [seatNumFull, ""];
        const name = g.assignedTo || g.AssignedTo || "";
        const cat = g.eventName || g.EventName || "";
        const status = g.status === 1 || g.Status === 1 ? "Validado" : "Pendente";
        
        csvContent += `"${table}";"${seat}";"${cat}";"${name}";"${status}"\n`;
      });

      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Convidados_${eventName.replace(/\s+/g, '_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setFilesModalEvent(null);
    } catch (error) {
      setAlertDialog({ isOpen: true, title: "Erro na Exportação", message: "Ocorreu um erro ao gerar o ficheiro.", type: 'error' });
    } finally {
      setIsExporting(false);
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
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.setAttribute("download", "relatorio_erros.csv");
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const renderAccountList = (list: AccountUser[], title: string, roleType: "Gestor" | "Utilizador", emptyMsg: string) => (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <button type="button" onClick={() => openCreateAccountModal(roleType)} className="w-full sm:w-auto bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
          <UserPlus className="w-4 h-4" /> Criar {roleType}
        </button>
      </div>
      {list.length === 0 ? (
        <div className="text-center py-12 text-slate-500">{emptyMsg}</div>
      ) : (
        <div className="space-y-3">
          {list.map(account => (
            <div key={account.id} className="card-nested-pop p-4 flex items-center justify-between hover:border-purple-200 transition-colors">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 font-bold uppercase shrink-0">{account.username.charAt(0)}</div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{account.username}</p>
                  <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5 truncate"><Mail className="w-3 h-3 shrink-0"/> {account.email}</p>
                </div>
              </div>
              <div className="flex gap-1 sm:gap-2 shrink-0">
                <button type="button" onClick={() => promptSendResetEmail(account.email, account.username)} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-amber-500" title="Enviar Link de Recuperação">
                  <Lock className="w-5 h-5" />
                </button>
                <button type="button" onClick={() => promptDeleteUser(account.id, account.username, account.role)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500" title={`Apagar ${account.role}`}>
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
  if (!company) return <div className="p-10 text-center"><h2 className="text-2xl font-bold text-slate-900">Empresa não encontrada</h2><button type="button" onClick={() => router.push("/companies")} className="text-purple-600 mt-4 inline-block font-bold outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">Voltar</button></div>;

  const groupedErrors = validationErrors ? validationErrors.reduce((acc, err) => {
    const type = err.errorType || err.ErrorType || "Erro Desconhecido";
    const line = err.line !== undefined ? err.line : (err.Line !== undefined ? err.Line : 0);
    if (!acc[type]) acc[type] = [];
    acc[type].push(line);
    return acc;
  }, {} as Record<string, number[]>) : {};

  let availableManagers: AccountUser[] = [];
  let availableUsers: AccountUser[] = [];
  if (assignEvent) {
    availableManagers = managers.filter(m => !assignEvent.assignedUsers.some(au => au.id === m.id));
    availableUsers = companyUsers.filter(u => !assignEvent.assignedUsers.some(au => au.id === u.id));
  }

  return (
    <div className="w-full max-w-7xl mx-auto relative px-4 sm:px-6 lg:px-8 pb-10">
      <Link href="/companies" className="inline-flex items-center text-slate-500 hover:text-purple-600 font-medium mb-8 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md">
        <ChevronLeft className="w-5 h-5 mr-1" /> Voltar para Empresas
      </Link>

      <div className="card-main p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start md:items-center gap-5 sm:gap-6 mb-8 text-center sm:text-left">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center p-2 shrink-0 shadow-inner">
          {company.logoUrl ? (
            <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain" />
          ) : (
            <span className="text-slate-400 font-bold text-xl">{company.name.charAt(0)}</span>
          )}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 break-words">{company.name}</h1>
        </div>
      </div>

      <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-200 mb-8 gap-6 sm:gap-8 snap-x">
        <button type="button" onClick={() => setActiveTab("gestores")} className={`snap-start whitespace-nowrap pb-4 text-base font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-t-md relative ${activeTab === "gestores" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
          <div className="flex items-center gap-2"><Users className="w-5 h-5" /> Gestores ({managers.length})</div>
          {activeTab === "gestores" && <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 rounded-t-full"></div>}
        </button>
        <button type="button" onClick={() => setActiveTab("utilizadores")} className={`snap-start whitespace-nowrap pb-4 text-base font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-t-md relative ${activeTab === "utilizadores" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
          <div className="flex items-center gap-2"><User className="w-5 h-5" /> Utilizadores ({companyUsers.length})</div>
          {activeTab === "utilizadores" && <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 rounded-t-full"></div>}
        </button>
        <button type="button" onClick={() => setActiveTab("eventos")} className={`snap-start whitespace-nowrap pb-4 text-base font-bold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-t-md relative ${activeTab === "eventos" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
          <div className="flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Eventos ({events.length})</div>
          {activeTab === "eventos" && <div className="absolute bottom-0 left-0 w-full h-1 bg-purple-600 rounded-t-full"></div>}
        </button>
      </div>

      <div className="card-main p-5 sm:p-6 lg:p-8 min-h-[400px]">
        {activeTab === "gestores" && renderAccountList(managers, "Gestores de Conta", "Gestor", "Ainda não existem gestores atribuídos a esta empresa.")}
        {activeTab === "utilizadores" && renderAccountList(companyUsers, "Utilizadores de Conta", "Utilizador", "Ainda não existem utilizadores atribuídos a esta empresa.")}

        {activeTab === "eventos" && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <h2 className="text-xl font-bold text-slate-900">Eventos da Empresa</h2>
              <button type="button" onClick={() => setShowEventModal(true)} className="w-full sm:w-auto bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold py-2.5 px-5 rounded-xl transition-all flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
                <CalendarPlus className="w-4 h-4" /> Criar Evento
              </button>
            </div>
            {sortedEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-500">Esta empresa ainda não tem eventos criados.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                {sortedEvents.map(event => {
                  const progress = event.totalSeats > 0 ? Math.round((event.treatedSeats / event.totalSeats) * 100) : 0;
                  const isOneDayEvent = event.startDate && event.endDate && new Date(event.startDate).toLocaleDateString('pt-PT') === new Date(event.endDate).toLocaleDateString('pt-PT');
                  
                  return (
                    <div key={event.id} className="card-nested-pop p-5 flex flex-col justify-between outline-none focus-visible:ring-2 focus-visible:ring-purple-500" tabIndex={0}>
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div className="min-w-0 pr-4">
                            <h3 className="font-bold text-slate-900 text-lg mb-1 truncate" title={event.name}>{event.name}</h3>
                            <div className="flex flex-col gap-0.5 mt-1 mb-4">
                              {isOneDayEvent ? (
                                <span className="text-sm text-slate-500"><strong className="font-semibold text-slate-600">Data:</strong> {new Date(event.startDate).toLocaleDateString('pt-PT')}</span>
                              ) : (
                                <>
                                  <span className="text-sm text-slate-500"><strong className="font-semibold text-slate-600">Início:</strong> {event.startDate ? new Date(event.startDate).toLocaleDateString('pt-PT') : "N/D"}</span>
                                  <span className="text-sm text-slate-500"><strong className="font-semibold text-slate-600">Fim:</strong> {event.endDate ? new Date(event.endDate).toLocaleDateString('pt-PT') : "N/D"}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button type="button" onClick={() => openEditEventModal(event)} className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Edit2 className="w-5 h-5" /></button>
                            <button type="button" onClick={() => promptDeleteEvent(event.id, event.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500"><Trash2 className="w-5 h-5" /></button>
                          </div>
                        </div>
                        
                        <div className="flex justify-between text-sm mb-2"><span className="font-medium text-slate-600">Progresso</span><span className="font-bold text-purple-600">{progress}%</span></div>
                        <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-purple-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div></div>
                        
                        <div className="flex justify-between mt-4 pt-4 border-t border-slate-50 text-sm">
                          <span className="text-slate-500">Capacidade: <strong className="text-slate-900">{event.totalSeats}</strong></span>
                          <span className="text-slate-500">Tratados: <strong className="text-emerald-600">{event.treatedSeats}</strong></span>
                        </div>
                        
                        {event.assignedUsers && event.assignedUsers.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-50">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Acessos Atribuídos</p>
                            <div className="flex flex-wrap gap-2">
                              {event.assignedUsers.map(au => (
                                <span key={au.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 text-sm font-semibold text-purple-700 shadow-sm">
                                  {au.username}
                                  <button type="button" onClick={() => promptRemoveAccess(event.id, au.id, au.username, event.name)} className="hover:bg-purple-200 p-0.5 rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-700"><X className="w-3.5 h-3.5" /></button>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Link href={`/events/${event.id}/guests?companyId=${id}`} className="w-full flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-700 font-bold py-2.5 rounded-xl transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          <Users className="w-4 h-4" /> Convidados
                        </Link>
                        <button type="button" onClick={() => setFilesModalEvent(event)} className="w-full flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 font-bold py-2.5 rounded-xl transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                          <FileText className="w-4 h-4" /> Ficheiros
                        </button>
                        <button type="button" onClick={() => openAssignModal(event)} className="w-full flex items-center justify-center gap-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-100 text-purple-700 font-bold py-2.5 rounded-xl transition-colors text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-purple-500">
                          <KeyRound className="w-4 h-4" /> Acessos
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {filesModalEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card-nested-pop w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-[1.5rem]">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-600" /> Ficheiros do Evento</h3>
              <button type="button" onClick={() => setFilesModalEvent(null)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 sm:p-6">
              <p className="text-sm text-slate-500 mb-6">Escolhe a operação que pretendes realizar para a lista de convidados do evento <strong className="text-slate-700">{filesModalEvent.name}</strong>.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => { openUploadModal(filesModalEvent.id); setFilesModalEvent(null); }} 
                  className="flex flex-col items-center justify-center p-6 border border-slate-200 rounded-2xl hover:border-emerald-300 hover:bg-emerald-50 transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-emerald-600 mb-3 transition-colors" />
                  <span className="font-bold text-slate-900 group-hover:text-emerald-700">Importar CSV</span>
                  <span className="text-xs text-slate-500 mt-1">Carregar nova lista</span>
                </button>
                <button 
                  type="button"
                  disabled={isExporting}
                  onClick={() => handleExportCsv(filesModalEvent.id, filesModalEvent.name)} 
                  className="flex flex-col items-center justify-center p-6 border border-slate-200 rounded-2xl hover:border-blue-300 hover:bg-blue-50 transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                >
                  {isExporting ? <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" /> : <Download className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mb-3 transition-colors" />}
                  <span className="font-bold text-slate-900 group-hover:text-blue-700">Exportar CSV</span>
                  <span className="text-xs text-slate-500 mt-1">Descarregar dados</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card-nested-pop w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-[1.5rem]">
              <h3 className="text-xl font-bold text-slate-900">Novo {newAccountRole}</h3>
              <button onClick={() => setShowCreateAccountModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateAccount} className="p-5 sm:p-6 space-y-5">
              <p className="text-sm text-slate-500">A palavra-passe será gerada automaticamente e enviada para o e-mail inserido.</p>
              <div><label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label><input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="Ex: João Silva" /></div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Endereço de E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-slate-400" /></div>
                  <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all" placeholder="joao@empresa.com" />
                </div>
              </div>
              {createAccountError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" /> {createAccountError}</div>}
              <button type="submit" disabled={isCreatingAccount || !newName || !newEmail} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-all mt-2 flex justify-center items-center shadow-lg shadow-purple-600/20 disabled:opacity-70">
                {isCreatingAccount ? <Loader2 className="w-5 h-5 animate-spin" /> : `Criar ${newAccountRole} e Enviar E-mail`}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && assignEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card-nested-pop w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0 rounded-t-[1.5rem]">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><KeyRound className="w-5 h-5 text-purple-600" /> Atribuir Acessos</h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Seleciona a equipa que queres atribuir ao evento <strong className="text-slate-800">{assignEvent.name}</strong>.
              </p>
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-3">Gestores Disponíveis</h4>
                  {availableManagers.length === 0 ? (
                    <p className="text-sm text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">Todos os gestores já têm acesso.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableManagers.map(m => (
                        <button 
                          type="button"
                          key={m.id} 
                          onClick={() => toggleUserSelection(m.id)} 
                          className={`w-full text-left p-3 rounded-xl border flex flex-col transition-all outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1 ${selectedUserIds.includes(m.id) ? 'bg-blue-50 border-blue-300 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-200'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <input type="checkbox" readOnly checked={selectedUserIds.includes(m.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none" />
                            <span className={`text-sm font-bold truncate ${selectedUserIds.includes(m.id) ? 'text-blue-700' : 'text-slate-700'}`}>{m.username}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate pl-6">{m.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-3">Staff / Validadores Disponíveis</h4>
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-slate-400 bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">Todos os utilizadores já têm acesso.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {availableUsers.map(u => (
                        <button 
                          type="button"
                          key={u.id} 
                          onClick={() => toggleUserSelection(u.id)} 
                          className={`w-full text-left p-3 rounded-xl border flex flex-col transition-all outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1 ${selectedUserIds.includes(u.id) ? 'bg-emerald-50 border-emerald-300 shadow-sm' : 'bg-white border-slate-200 hover:border-emerald-200'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <input type="checkbox" readOnly checked={selectedUserIds.includes(u.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 pointer-events-none" />
                            <span className={`text-sm font-bold truncate ${selectedUserIds.includes(u.id) ? 'text-emerald-700' : 'text-slate-700'}`}>{u.username}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 truncate pl-6">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-100 shrink-0 bg-white rounded-b-[1.5rem]">
              {assignError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl">{assignError}</div>}
              <button 
                onClick={handleAssignAccess} 
                disabled={isAssigning || selectedUserIds.length === 0} 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 flex justify-center items-center shadow-lg shadow-purple-600/20"
              >
                {isAssigning ? <Loader2 className="w-5 h-5 animate-spin" /> : `Atribuir Acesso (${selectedUserIds.length} selecionados)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card-nested-pop w-full max-w-md">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-[1.5rem]">
              <h3 className="text-xl font-bold text-slate-900">Novo Evento</h3>
              <button onClick={() => setShowEventModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-5 sm:p-6 space-y-5">
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
                <input type="date" required min={eventStartDate} value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {eventError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{eventError}</div>}
              <button type="submit" disabled={isCreatingEvent} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">{isCreatingEvent ? "A Criar..." : "Criar Evento"}</button>
            </form>
          </div>
        </div>
      )}

      {showEditEventModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card-nested-pop w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-[1.5rem]">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Edit2 className="w-5 h-5 text-purple-600" /> Editar Evento</h3>
              <button onClick={() => setShowEditEventModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdateEvent} className="p-5 sm:p-6 space-y-5">
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
                <input type="date" required min={editEventStartDate} value={editEventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" />
              </div>
              {editEventError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{editEventError}</div>}
              <button type="submit" disabled={isEditingEvent} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-colors mt-2">{isEditingEvent ? "A Guardar..." : "Guardar Alterações"}</button>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="card-nested-pop w-full max-w-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 rounded-t-[1.5rem]">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-emerald-600" /> Importar CSV</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 sm:p-6">
              {uploadSuccess ? (
                <div className="bg-emerald-50 rounded-2xl flex flex-col items-center text-center p-6">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4"><FileText className="w-6 h-6 text-emerald-600" /></div>
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
                        <summary className="bg-white px-4 py-3.5 font-semibold text-slate-800 cursor-pointer hover:bg-red-50 flex items-center justify-between transition-colors outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> {type}</span>
                          <span className="bg-red-100 text-red-800 text-xs py-1 px-2.5 rounded-lg font-bold">{lines.length} ocorrências</span>
                        </summary>
                        <div className="p-4 pt-2 text-sm text-slate-600 border-t border-red-50 bg-slate-50/50"><span className="font-semibold text-slate-700 mb-1 block">Linhas afetadas:</span><br/>{lines.map(l => l === 0 ? "Geral" : l).join(", ")}</div>
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
                          <label htmlFor="csv-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2">
                            <span>Procurar ficheiro .csv</span>
                            <input id="csv-upload" name="csv-upload" type="file" accept=".csv" className="sr-only" onChange={(e) => { if (e.target.files && e.target.files.length > 0) setUploadFile(e.target.files[0]); }} />
                          </label>
                        </div>
                        {uploadFile ? <p className="text-xs text-emerald-600 font-bold mt-2 border border-emerald-100 bg-emerald-50 p-2 rounded-lg truncate px-4">{uploadFile.name}</p> : <p className="text-xs text-slate-500 mt-2">Colunas: MESA;LUGAR;CATEGORIA;NOME</p>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Método de Importação</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => setUploadMode("replace")} className={`py-3 px-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${uploadMode === 'replace' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        <Trash2 className={`w-5 h-5 mb-1 ${uploadMode === 'replace' ? 'text-emerald-600' : 'text-slate-400'}`} /> Substituir Lista
                      </button>
                      <button type="button" onClick={() => setUploadMode("append")} className={`py-3 px-4 rounded-xl border text-sm font-bold flex flex-col items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 ${uploadMode === 'append' ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
                        <CalendarPlus className={`w-5 h-5 mb-1 ${uploadMode === 'append' ? 'text-emerald-600' : 'text-slate-400'}`} /> Adicionar à Lista
                      </button>
                    </div>
                  </div>
                  {uploadError && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3 shadow-sm">
                      <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div><h4 className="font-bold text-red-800 text-sm">Falha na Leitura</h4><p className="text-sm text-red-600 font-medium mt-0.5">{uploadError}</p></div>
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

      {/* MODAL GLOBAL DE CONFIRMAÇÃO (Liquid Glass) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card-nested-pop p-6 sm:p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><AlertTriangle className="w-8 h-8" /></div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{confirmDialog.title}</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDialog(null)} className="flex-1 px-4 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 px-4 py-3.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-lg">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GLOBAL DE ALERTAS (Liquid Glass) */}
      {alertDialog && alertDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card-nested-pop p-6 sm:p-8 w-full max-w-sm text-center">
            {alertDialog.type === 'error' && <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><AlertTriangle className="w-8 h-8" /></div>}
            {alertDialog.type === 'success' && <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><CheckCircle2 className="w-8 h-8" /></div>}
            {alertDialog.type === 'info' && <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner"><Info className="w-8 h-8" /></div>}
            <h2 className="text-2xl font-black text-slate-900 mb-2">{alertDialog.title}</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">{alertDialog.message}</p>
            <button onClick={() => setAlertDialog(null)} className="w-full px-4 py-3.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-lg">OK, Entendido</button>
          </div>
        </div>
      )}

    </div>
  );
}

function SafeCompanyLogo({ logoUrl, companyName, className, fallbackSize = "w-6 h-6" }: any) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [logoUrl]);
  if (logoUrl && !error) {
    const src = logoUrl.startsWith('http') ? logoUrl : `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}`;
    return <div className={`relative bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center ${className}`}><img src={src} alt={companyName} className="w-full h-full object-cover" onError={() => setError(true)} /></div>;
  }
  return <div className={`flex items-center justify-center bg-white border border-slate-100 rounded-2xl shadow-sm shrink-0 ${className}`}><Building2 className={`${fallbackSize} text-slate-300`} /></div>;
}

export default function CompanyDetailsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div></div>}>
      <CompanyDetailsContent />
    </Suspense>
  );
}