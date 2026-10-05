"use client";

/**
 * Detalhe da Empresa (/companies/[id]).
 *
 *   - Dados: empresa, gestores, utilizadores e eventos (GET /api/Company/...),
 *     atualizados em tempo real por MQTT (`seating/events/#` e `seating/backoffice/companies`).
 *   - Separadores (query `?tab=`): gestores | utilizadores | eventos.
 *   - Ações: criar contas (Gestor/Utilizador), recuperar palavra-passe, apagar acesso,
 *     criar/editar/apagar eventos, atribuir/remover acessos a eventos e
 *     importar/exportar a lista de convidados em CSV (com relatório de erros de validação).
 *   - Visual: herói da empresa com métricas, separadores em pílula, cartões de evento
 *     em estilo "bilhete" com anel de progresso, modais via <Modal>/<AlertDialog>/<ConfirmDialog>.
 *   - Lógica (estado, fetch, MQTT, validações, ordenação) intocada: só o JSX foi redesenhado.
 */

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Users, User, CalendarDays, UserPlus, CalendarPlus, X, KeyRound, Trash2, Edit2, UploadCloud, FileText, Lock, AlertTriangle, Download, Loader2, Mail, Building2, Ticket, Check } from "lucide-react";
import mqtt from "mqtt";
import Modal from "@/components/ui/Modal";
import AlertDialog from "@/components/ui/AlertDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import ProgressRing from "@/components/ui/ProgressRing";
import CountUp from "@/components/ui/CountUp";
import { getErrorMessage } from "@/lib/errors";

// Resposta crua da API (a API pode devolver PascalCase ou camelCase)
interface RawGuest {
  seatNumber?: string; SeatNumber?: string;
  assignedTo?: string; AssignedTo?: string;
  eventName?: string; EventName?: string;
  status?: number; Status?: number;
}

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial no mount; o setState só corre depois do await
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
    } catch (err: unknown) { 
      setCreateAccountError(getErrorMessage(err)); 
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
        } catch { 
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
        } catch { setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao tentar apagar o acesso.", type: 'error' }); }
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
    } catch (err: unknown) { setEventError(getErrorMessage(err)); } finally { setIsCreatingEvent(false); }
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
    } catch (err: unknown) { setEditEventError(getErrorMessage(err)); } finally { setIsEditingEvent(false); }
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
        } catch { setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao tentar apagar o evento.", type: 'error' }); }
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
    } catch {
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
        } catch { setAlertDialog({ isOpen: true, title: "Erro", message: "Falha ao remover o acesso do utilizador.", type: 'error' }); }
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
    } catch (err: unknown) { setUploadError(getErrorMessage(err)); } finally { setIsUploading(false); }
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
      
      const mappedGuests: RawGuest[] = Array.isArray(data) ? data : [];
      mappedGuests.forEach((g: RawGuest) => {
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
    } catch {
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

  // Lista de contas (gestores ou utilizadores) com cabeçalho, botão de criar e estado vazio.
  const renderAccountList = (list: AccountUser[], title: string, roleType: "Gestor" | "Utilizador", emptyMsg: string) => (
    <div>
      {/* Cabeçalho da secção */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <span className={`badge ${roleType === "Gestor" ? "badge-blue" : "badge-green"}`}>{list.length}</span>
        </div>
        <button type="button" onClick={() => openCreateAccountModal(roleType)} className="btn btn-primary w-full sm:w-auto">
          <UserPlus className="w-4 h-4" /> Criar {roleType}
        </button>
      </div>
      {list.length === 0 ? (
        <EmptyState title={emptyMsg} description="Usa o botão acima para criar a primeira conta." />
      ) : (
        <div className="stagger grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {list.map(account => (
            <div key={account.id}>
              <div className="card-nested-pop card-lift p-4 flex items-center justify-between gap-2 h-full">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg uppercase shrink-0 shadow-lg ${roleType === "Gestor" ? "bg-[linear-gradient(135deg,#60a5fa,#2563eb)] shadow-blue-500/30" : "bg-[linear-gradient(135deg,#34d399,#059669)] shadow-emerald-500/30"}`}>{account.username.charAt(0)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{account.username}</p>
                      <span className={`badge hidden sm:inline-flex ${roleType === "Gestor" ? "badge-blue" : "badge-green"}`}>{account.role}</span>
                    </div>
                    <p className="text-xs font-medium text-slate-500 flex items-center gap-1 mt-0.5 truncate"><Mail className="w-3 h-3 shrink-0"/> <span className="truncate">{account.email}</span></p>
                  </div>
                </div>
                {/* Ações da linha */}
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => promptSendResetEmail(account.email, account.username)} className="icon-btn icon-btn-amber" title="Enviar Link de Recuperação" aria-label="Enviar Link de Recuperação">
                    <Lock className="w-[18px] h-[18px]" />
                  </button>
                  <button type="button" onClick={() => promptDeleteUser(account.id, account.username, account.role)} className="icon-btn icon-btn-red" title={`Apagar ${account.role}`} aria-label={`Apagar ${account.role}`}>
                    <Trash2 className="w-[18px] h-[18px]" />
                  </button>
                </div>
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

  if (isLoading) return <div className="flex justify-center p-20" role="status" aria-label="A carregar"><div className="spinner" /></div>;
  if (!company) return <div className="max-w-xl mx-auto pt-10"><EmptyState title="Empresa não encontrada" description="Esta empresa não existe ou já foi removida." action={<button type="button" onClick={() => router.push("/companies")} className="btn btn-primary">Voltar</button>} /></div>;

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
    <div className="w-full max-w-7xl mx-auto relative pb-10">
      {/* VOLTAR */}
      <Link href="/companies" className="btn btn-ghost btn-sm mb-4 -ml-2">
        <ChevronLeft className="w-4 h-4" /> Voltar para Empresas
      </Link>

      {/* HERÓI DA EMPRESA: faixa em degradê, logótipo sobreposto e métricas */}
      <section className="reveal card-main overflow-hidden mb-6 lg:mb-8" style={{ ["--i" as string]: 1 }}>
        <div className="h-28 sm:h-32 relative overflow-hidden bg-[linear-gradient(145deg,#6d28d9_0%,#7c3aed_45%,#2563eb_100%)]">
          <div aria-hidden className="absolute -right-10 -top-12 w-56 h-56 rounded-full bg-white/20 blur-2xl" />
          <div aria-hidden className="absolute left-1/3 -bottom-16 w-48 h-48 rounded-full bg-emerald-300/25 blur-3xl" />
        </div>
        <div className="px-5 sm:px-8 pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-6 relative z-10 -mt-12 sm:-mt-14">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-white border-4 border-white shadow-xl flex items-center justify-center p-2 shrink-0">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logótipo dinâmico (URL da API ou data URI), next/image não aplicável
                <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-gradient font-display font-bold text-4xl">{company.name.charAt(0)}</span>
              )}
            </div>
            <div className="min-w-0 sm:pb-2">
              <span className="badge badge-purple mb-2"><Building2 className="w-3.5 h-3.5" /> Empresa cliente</span>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 break-words">{company.name}</h1>
            </div>
          </div>

          {/* Métricas rápidas (só leitura, derivadas dos dados já carregados) */}
          <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <div>
              <div className="card-nested-flat p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 bg-[linear-gradient(135deg,#60a5fa,#2563eb)]"><Users className="w-5 h-5" /></div>
                <div className="min-w-0"><p className="font-display text-2xl font-bold text-slate-900 leading-none"><CountUp value={managers.length} /></p><p className="text-xs font-bold text-slate-500 mt-1 truncate">Gestores</p></div>
              </div>
            </div>
            <div>
              <div className="card-nested-flat p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 bg-[linear-gradient(135deg,#34d399,#059669)]"><User className="w-5 h-5" /></div>
                <div className="min-w-0"><p className="font-display text-2xl font-bold text-slate-900 leading-none"><CountUp value={companyUsers.length} /></p><p className="text-xs font-bold text-slate-500 mt-1 truncate">Utilizadores</p></div>
              </div>
            </div>
            <div>
              <div className="card-nested-flat p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 bg-[linear-gradient(135deg,#a78bfa,#7c3aed)]"><CalendarDays className="w-5 h-5" /></div>
                <div className="min-w-0"><p className="font-display text-2xl font-bold text-slate-900 leading-none"><CountUp value={events.length} /></p><p className="text-xs font-bold text-slate-500 mt-1 truncate">Eventos</p></div>
              </div>
            </div>
            <div>
              <div className="card-nested-flat p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0 bg-[linear-gradient(135deg,#fbbf24,#f97316)]"><Ticket className="w-5 h-5" /></div>
                <div className="min-w-0"><p className="font-display text-2xl font-bold text-slate-900 leading-none"><CountUp value={events.reduce((sum, ev) => sum + ev.totalSeats, 0)} /></p><p className="text-xs font-bold text-slate-500 mt-1 truncate">Lugares</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SEPARADORES EM PÍLULA */}
      <div className="reveal mb-6 max-w-full" style={{ ["--i" as string]: 2 }}>
        <div className="tab-bar" role="tablist" aria-label="Secções da empresa">
          <button type="button" role="tab" aria-selected={activeTab === "gestores"} onClick={() => setActiveTab("gestores")} className="tab">
            <Users className="w-[18px] h-[18px]" /> Gestores <span className="opacity-80">({managers.length})</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "utilizadores"} onClick={() => setActiveTab("utilizadores")} className="tab">
            <User className="w-[18px] h-[18px]" /> Utilizadores <span className="opacity-80">({companyUsers.length})</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === "eventos"} onClick={() => setActiveTab("eventos")} className="tab">
            <CalendarDays className="w-[18px] h-[18px]" /> Eventos <span className="opacity-80">({events.length})</span>
          </button>
        </div>
      </div>

      {/* CONTEÚDO DO SEPARADOR ATIVO */}
      <div className="reveal card-main p-5 sm:p-6 lg:p-8 min-h-[400px]" style={{ ["--i" as string]: 3 }}>
        {activeTab === "gestores" && renderAccountList(managers, "Gestores de Conta", "Gestor", "Ainda não existem gestores atribuídos a esta empresa.")}
        {activeTab === "utilizadores" && renderAccountList(companyUsers, "Utilizadores de Conta", "Utilizador", "Ainda não existem utilizadores atribuídos a esta empresa.")}

        {activeTab === "eventos" && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-900">Eventos da Empresa</h2>
                <span className="badge badge-purple">{events.length}</span>
              </div>
              <button type="button" onClick={() => setShowEventModal(true)} className="btn btn-primary w-full sm:w-auto">
                <CalendarPlus className="w-4 h-4" /> Criar Evento
              </button>
            </div>
            {sortedEvents.length === 0 ? (
              <EmptyState title="Esta empresa ainda não tem eventos criados." description="Cria o primeiro evento para começar a gerir convidados." />
            ) : (
              <div className="stagger grid grid-cols-1 xl:grid-cols-2 gap-5 sm:gap-6">
                {sortedEvents.map(event => {
                  const progress = event.totalSeats > 0 ? Math.round((event.treatedSeats / event.totalSeats) * 100) : 0;
                  const isOneDayEvent = event.startDate && event.endDate && new Date(event.startDate).toLocaleDateString('pt-PT') === new Date(event.endDate).toLocaleDateString('pt-PT');

                  return (
                    <div key={event.id}>
                      {/* CARTÃO DE EVENTO em estilo bilhete: corpo + linha picotada + ações */}
                      <div className="card-nested-pop card-lift h-full flex flex-col outline-none focus-visible:ring-2 focus-visible:ring-purple-500" tabIndex={0}>
                        <div className="p-5 pb-4 flex-1">
                          {/* Título, datas e ações do evento */}
                          <div className="flex justify-between items-start gap-3 mb-4">
                            <div className="min-w-0">
                              <span className="badge badge-purple mb-2"><CalendarDays className="w-3.5 h-3.5" /> Evento</span>
                              <h3 className="font-bold text-slate-900 text-lg leading-snug truncate" title={event.name}>{event.name}</h3>
                              <div className="flex flex-col gap-0.5 mt-1.5">
                                {isOneDayEvent ? (
                                  <span className="text-sm text-slate-500"><strong className="font-bold text-slate-600">Data:</strong> {new Date(event.startDate).toLocaleDateString('pt-PT')}</span>
                                ) : (
                                  <>
                                    <span className="text-sm text-slate-500"><strong className="font-bold text-slate-600">Início:</strong> {event.startDate ? new Date(event.startDate).toLocaleDateString('pt-PT') : "N/D"}</span>
                                    <span className="text-sm text-slate-500"><strong className="font-bold text-slate-600">Fim:</strong> {event.endDate ? new Date(event.endDate).toLocaleDateString('pt-PT') : "N/D"}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button type="button" onClick={() => openEditEventModal(event)} className="icon-btn icon-btn-blue" title="Editar evento" aria-label="Editar evento"><Edit2 className="w-[18px] h-[18px]" /></button>
                              <button type="button" onClick={() => promptDeleteEvent(event.id, event.name)} className="icon-btn icon-btn-red" title="Apagar evento" aria-label="Apagar evento"><Trash2 className="w-[18px] h-[18px]" /></button>
                            </div>
                          </div>

                          {/* Progresso: anel + números */}
                          <div className="flex items-center gap-4 p-3 rounded-3xl bg-white/60 border border-[var(--line)]">
                            <ProgressRing percent={progress} size={68} stroke={8} />
                            <div className="grid grid-cols-2 gap-3 flex-1 min-w-0">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-500">Capacidade</p>
                                <p className="font-display text-xl font-bold text-slate-900 tabular">{event.totalSeats}</p>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-500">Tratados</p>
                                <p className="font-display text-xl font-bold text-emerald-600 tabular">{event.treatedSeats}</p>
                              </div>
                            </div>
                          </div>

                          {/* Acessos atribuídos */}
                          {event.assignedUsers && event.assignedUsers.length > 0 && (
                            <div className="mt-4">
                              <p className="text-xs font-bold text-slate-500 mb-2">Acessos Atribuídos</p>
                              <div className="flex flex-wrap gap-2">
                                {event.assignedUsers.map(au => (
                                  <span key={au.id} className="badge badge-purple !text-[13px] !pr-1.5">
                                    {au.username}
                                    <button type="button" onClick={() => promptRemoveAccess(event.id, au.id, au.username, event.name)} className="hover:bg-purple-200 p-0.5 rounded-full transition-colors" aria-label={`Remover acesso de ${au.username}`}><X className="w-3.5 h-3.5" /></button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Linha picotada com os dois "dentes" do bilhete */}
                        <div className="relative" aria-hidden>
                          <div className="ticket-cut" />
                          <span className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-[var(--background)] shadow-[inset_0_0_0_1px_var(--line)]" />
                          <span className="absolute -right-[9px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full bg-[var(--background)] shadow-[inset_0_0_0_1px_var(--line)]" />
                        </div>

                        {/* Ações do evento */}
                        <div className="p-4 grid grid-cols-3 gap-2">
                          <Link href={`/events/${event.id}/guests?companyId=${id}`} className="btn btn-info btn-sm !px-2 flex-col sm:flex-row !gap-1 sm:!gap-1.5 !text-[12px] sm:!text-[13px]">
                            <Users className="w-4 h-4" /> Convidados
                          </Link>
                          <button type="button" onClick={() => setFilesModalEvent(event)} className="btn btn-success btn-sm !px-2 flex-col sm:flex-row !gap-1 sm:!gap-1.5 !text-[12px] sm:!text-[13px]">
                            <FileText className="w-4 h-4" /> Ficheiros
                          </button>
                          <button type="button" onClick={() => openAssignModal(event)} className="btn btn-soft btn-sm !px-2 flex-col sm:flex-row !gap-1 sm:!gap-1.5 !text-[12px] sm:!text-[13px]">
                            <KeyRound className="w-4 h-4" /> Acessos
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: FICHEIROS DO EVENTO (escolher importar ou exportar CSV) */}
      {filesModalEvent && (
        <Modal
          onClose={() => setFilesModalEvent(null)}
          title="Ficheiros do Evento"
          subtitle={filesModalEvent.name}
          icon={<FileText className="w-5 h-5" />}
          tone="emerald"
          size="md"
          closeOnBackdrop={false}
        >
          <p className="text-sm text-slate-500 mb-5">Escolhe a operação que pretendes realizar para a lista de convidados do evento <strong className="text-slate-700">{filesModalEvent.name}</strong>.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => { openUploadModal(filesModalEvent.id); setFilesModalEvent(null); }}
              className="card-nested-pop card-lift flex flex-col items-center justify-center p-6 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(135deg,#34d399,#059669)] text-white flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform"><UploadCloud className="w-7 h-7" /></div>
              <span className="font-bold text-slate-900 group-hover:text-emerald-700">Importar CSV</span>
              <span className="text-xs text-slate-500 mt-1">Carregar nova lista</span>
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => handleExportCsv(filesModalEvent.id, filesModalEvent.name)}
              className="card-nested-pop card-lift flex flex-col items-center justify-center p-6 group disabled:opacity-50"
            >
              <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(135deg,#60a5fa,#2563eb)] text-white flex items-center justify-center mb-3 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform">
                {isExporting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Download className="w-7 h-7" />}
              </div>
              <span className="font-bold text-slate-900 group-hover:text-blue-700">Exportar CSV</span>
              <span className="text-xs text-slate-500 mt-1">Descarregar dados</span>
            </button>
          </div>
        </Modal>
      )}

      {/* MODAL: CRIAR CONTA (gestor ou utilizador) */}
      {showCreateAccountModal && (
        <Modal
          onClose={() => setShowCreateAccountModal(false)}
          title={<>Novo {newAccountRole}</>}
          subtitle="A palavra-passe é gerada e enviada por e-mail"
          icon={<UserPlus className="w-5 h-5" />}
          tone={newAccountRole === "Gestor" ? "blue" : "emerald"}
          size="md"
          closeOnBackdrop={false}
          footer={
            <button type="submit" form="create-account-form" disabled={isCreatingAccount || !newName || !newEmail} className={`btn btn-block ${newAccountRole === "Gestor" ? "btn-info" : "btn-success"}`}>
              {isCreatingAccount ? <Loader2 className="w-5 h-5 animate-spin" /> : `Criar ${newAccountRole} e Enviar E-mail`}
            </button>
          }
        >
          <form id="create-account-form" onSubmit={handleCreateAccount} className="space-y-5">
            <p className="notice notice-info !font-medium">A palavra-passe será gerada automaticamente e enviada para o e-mail inserido.</p>
            <div>
              <label className="field-label">Nome Completo</label>
              <div className="input-wrap">
                <User className="input-icon" />
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} className="input input-with-icon" placeholder="Ex: João Silva" />
              </div>
            </div>
            <div>
              <label className="field-label">Endereço de E-mail</label>
              <div className="input-wrap">
                <Mail className="input-icon" />
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="input input-with-icon" placeholder="joao@empresa.com" />
              </div>
            </div>
            {createAccountError && <div className="notice notice-error"><AlertTriangle className="w-5 h-5" /> {createAccountError}</div>}
          </form>
        </Modal>
      )}

      {/* MODAL: ATRIBUIR ACESSOS DE EQUIPA A UM EVENTO */}
      {showAssignModal && assignEvent && (
        <Modal
          onClose={() => setShowAssignModal(false)}
          title="Atribuir Acessos"
          subtitle={assignEvent.name}
          icon={<KeyRound className="w-5 h-5" />}
          size="lg"
          closeOnBackdrop={false}
          footer={
            <div>
              {assignError && <div className="notice notice-error mb-4">{assignError}</div>}
              <button
                type="button"
                onClick={handleAssignAccess}
                disabled={isAssigning || selectedUserIds.length === 0}
                className="btn btn-primary btn-block"
              >
                {isAssigning ? <Loader2 className="w-5 h-5 animate-spin" /> : `Atribuir Acesso (${selectedUserIds.length} selecionados)`}
              </button>
            </div>
          }
        >
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Seleciona a equipa que queres atribuir ao evento <strong className="text-slate-800">{assignEvent.name}</strong>.
          </p>
          <div className="space-y-6">
            {/* Gestores */}
            <div>
              <h4 className="mb-3"><span className="badge badge-blue"><Users className="w-3.5 h-3.5" /> Gestores Disponíveis</span></h4>
              {availableManagers.length === 0 ? (
                <p className="notice notice-info !justify-center !font-medium">Todos os gestores já têm acesso.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableManagers.map(m => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => toggleUserSelection(m.id)}
                      className={`w-full text-left p-3 rounded-2xl border-2 flex flex-col transition-all ${selectedUserIds.includes(m.id) ? 'bg-blue-50 border-blue-400 shadow-md shadow-blue-500/10' : 'bg-white/80 border-slate-200 hover:border-blue-300'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <input type="checkbox" readOnly checked={selectedUserIds.includes(m.id)} className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none accent-blue-600" />
                        <span className={`text-sm font-bold truncate ${selectedUserIds.includes(m.id) ? 'text-blue-700' : 'text-slate-700'}`}>{m.username}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate pl-6">{m.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Staff / validadores */}
            <div>
              <h4 className="mb-3"><span className="badge badge-green"><User className="w-3.5 h-3.5" /> Staff / Validadores Disponíveis</span></h4>
              {availableUsers.length === 0 ? (
                <p className="notice notice-success !justify-center !font-medium">Todos os utilizadores já têm acesso.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableUsers.map(u => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => toggleUserSelection(u.id)}
                      className={`w-full text-left p-3 rounded-2xl border-2 flex flex-col transition-all ${selectedUserIds.includes(u.id) ? 'bg-emerald-50 border-emerald-400 shadow-md shadow-emerald-500/10' : 'bg-white/80 border-slate-200 hover:border-emerald-300'}`}
                    >
                      <div className="flex items-center gap-2 mb-1 min-w-0">
                        <input type="checkbox" readOnly checked={selectedUserIds.includes(u.id)} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 pointer-events-none accent-emerald-600" />
                        <span className={`text-sm font-bold truncate ${selectedUserIds.includes(u.id) ? 'text-emerald-700' : 'text-slate-700'}`}>{u.username}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate pl-6">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: CRIAR EVENTO */}
      {showEventModal && (
        <Modal
          onClose={() => setShowEventModal(false)}
          title="Novo Evento"
          subtitle="Define o nome e as datas"
          icon={<CalendarPlus className="w-5 h-5" />}
          size="md"
          closeOnBackdrop={false}
          footer={
            <button type="submit" form="create-event-form" disabled={isCreatingEvent} className="btn btn-primary btn-block">{isCreatingEvent ? "A Criar..." : "Criar Evento"}</button>
          }
        >
          <form id="create-event-form" onSubmit={handleCreateEvent} className="space-y-5">
            <div>
              <label className="field-label">Nome do Evento</label>
              <input type="text" required value={eventName} onChange={(e) => setEventName(e.target.value)} className="input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Data de Início</label>
                <input type="date" required value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="field-label">Data de Fim</label>
                <input type="date" required min={eventStartDate} value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="input" />
              </div>
            </div>
            {eventError && <div className="notice notice-error"><AlertTriangle className="w-4 h-4" />{eventError}</div>}
          </form>
        </Modal>
      )}

      {/* MODAL: EDITAR EVENTO */}
      {showEditEventModal && (
        <Modal
          onClose={() => setShowEditEventModal(false)}
          title="Editar Evento"
          subtitle="Altera o nome ou as datas"
          icon={<Edit2 className="w-5 h-5" />}
          size="md"
          closeOnBackdrop={false}
          footer={
            <button type="submit" form="edit-event-form" disabled={isEditingEvent} className="btn btn-primary btn-block">{isEditingEvent ? "A Guardar..." : "Guardar Alterações"}</button>
          }
        >
          <form id="edit-event-form" onSubmit={handleUpdateEvent} className="space-y-5">
            <div>
              <label className="field-label">Nome do Evento</label>
              <input type="text" required value={editEventName} onChange={(e) => setEditEventName(e.target.value)} className="input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="field-label">Data de Início</label>
                <input type="date" required value={editEventStartDate} onChange={(e) => setEditEventStartDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="field-label">Data de Fim</label>
                <input type="date" required min={editEventStartDate} value={editEventEndDate} onChange={(e) => setEditEventEndDate(e.target.value)} className="input" />
              </div>
            </div>
            {editEventError && <div className="notice notice-error"><AlertTriangle className="w-4 h-4" />{editEventError}</div>}
          </form>
        </Modal>
      )}

      {/* MODAL: IMPORTAR CSV (3 estados: sucesso | erros de validação | formulário) */}
      {showUploadModal && (
        <Modal
          onClose={() => setShowUploadModal(false)}
          title="Importar CSV"
          subtitle="Lista de convidados do evento"
          icon={<UploadCloud className="w-5 h-5" />}
          tone="emerald"
          size="lg"
          closeOnBackdrop={false}
        >
          {uploadSuccess ? (
            /* Estado: importação concluída */
            <div className="flex flex-col items-center text-center py-2">
              <div className="dialog-icon dialog-icon-success"><FileText className="w-8 h-8" /></div>
              <h4 className="text-xl font-bold text-emerald-800 mb-1">Importação Concluída</h4>
              <p className="text-sm text-emerald-700 font-medium">{uploadSuccess}</p>
              <button type="button" onClick={() => setShowUploadModal(false)} className="btn btn-success btn-block mt-6"><Check className="w-4 h-4" /> Fechar</button>
            </div>
          ) : validationErrors && validationErrors.length > 0 ? (
            /* Estado: importação recusada, erros agrupados por tipo */
            <div className="animate-in">
              <div className="notice notice-error mb-6 !items-start">
                <AlertTriangle className="w-6 h-6" />
                <div>
                  <h4 className="font-bold text-base mb-0.5">Importação Recusada</h4>
                  <p className="text-sm font-medium">Foram encontrados {validationErrors.length} erros em {totalValidationRows} linhas. Corrige o ficheiro e tenta novamente.</p>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto custom-scrollbar mb-6 pr-1">
                {Object.entries(groupedErrors).map(([type, lines]) => (
                  <details key={type} className="mb-2 bg-white/80 rounded-2xl border border-red-100 overflow-hidden group">
                    <summary className="px-4 py-3.5 font-bold text-slate-800 cursor-pointer hover:bg-red-50 flex items-center justify-between gap-2 transition-colors list-none [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 min-w-0"><ChevronRight className="w-4 h-4 text-red-400 shrink-0 transition-transform group-open:rotate-90" /> <span className="truncate">{type}</span></span>
                      <span className="badge badge-red">{lines.length} ocorrências</span>
                    </summary>
                    <div className="p-4 pt-3 text-sm text-slate-600 border-t border-red-50 bg-red-50/30"><span className="font-bold text-slate-700 mb-1 block">Linhas afetadas:</span>{lines.map(l => l === 0 ? "Geral" : l).join(", ")}</div>
                  </details>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button type="button" onClick={() => setValidationErrors(null)} className="btn btn-white">Tentar Novamente</button>
                <button type="button" onClick={handleExportErrors} className="btn btn-primary"><Download className="w-4 h-4" /> Exportar Relatório</button>
              </div>
            </div>
          ) : (
            /* Estado: formulário de upload */
            <form onSubmit={handleUploadCsv} className="space-y-5">
              <div>
                <label className="field-label">Ficheiro de Convidados</label>
                <div className="flex justify-center px-6 py-6 border-2 border-dashed border-emerald-200 rounded-3xl bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-400 transition-colors">
                  <div className="space-y-1.5 text-center min-w-0 max-w-full">
                    <div className="mx-auto w-12 h-12 rounded-2xl bg-[linear-gradient(135deg,#34d399,#059669)] text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"><FileText className="h-6 w-6" /></div>
                    <div className="flex text-sm text-slate-600 justify-center mt-2">
                      <label htmlFor="csv-upload" className="relative cursor-pointer rounded-md font-bold text-emerald-600 hover:text-emerald-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2">
                        <span>Procurar ficheiro .csv</span>
                        <input id="csv-upload" name="csv-upload" type="file" accept=".csv" className="sr-only" onChange={(e) => { if (e.target.files && e.target.files.length > 0) setUploadFile(e.target.files[0]); }} />
                      </label>
                    </div>
                    {uploadFile ? <p className="badge badge-green mt-2 max-w-full"><span className="truncate">{uploadFile.name}</span></p> : <p className="text-xs text-slate-500 mt-2">Colunas: MESA;LUGAR;CATEGORIA;NOME</p>}
                  </div>
                </div>
              </div>
              <div>
                <label className="field-label">Método de Importação</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setUploadMode("replace")} className={`py-3 px-4 rounded-2xl border-2 text-sm font-bold flex flex-col items-center justify-center transition-all ${uploadMode === 'replace' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-500/10' : 'border-slate-200 bg-white/80 text-slate-500 hover:border-emerald-300'}`}>
                    <Trash2 className={`w-5 h-5 mb-1 ${uploadMode === 'replace' ? 'text-emerald-600' : 'text-slate-400'}`} /> Substituir Lista
                  </button>
                  <button type="button" onClick={() => setUploadMode("append")} className={`py-3 px-4 rounded-2xl border-2 text-sm font-bold flex flex-col items-center justify-center transition-all ${uploadMode === 'append' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-500/10' : 'border-slate-200 bg-white/80 text-slate-500 hover:border-emerald-300'}`}>
                    <CalendarPlus className={`w-5 h-5 mb-1 ${uploadMode === 'append' ? 'text-emerald-600' : 'text-slate-400'}`} /> Adicionar à Lista
                  </button>
                </div>
              </div>
              {uploadError && (
                <div className="notice notice-error !items-start">
                  <AlertTriangle className="w-5 h-5" />
                  <div><h4 className="font-bold text-sm">Falha na Leitura</h4><p className="text-sm font-medium mt-0.5">{uploadError}</p></div>
                </div>
              )}
              <button type="submit" disabled={isUploading || !uploadFile} className="btn btn-success btn-block">
                {isUploading ? <div className="flex items-center gap-2"><div className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white"></div> A Processar...</div> : "Iniciar Importação"}
              </button>
            </form>
          )}
        </Modal>
      )}

      {/* DIÁLOGO GLOBAL DE CONFIRMAÇÃO (apagar, remover acesso, recuperar palavra-passe) */}
      {confirmDialog && confirmDialog.isOpen && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* DIÁLOGO GLOBAL DE AVISOS (sucesso / erro / info) */}
      {alertDialog && alertDialog.isOpen && (
        <AlertDialog
          title={alertDialog.title}
          message={alertDialog.message}
          type={alertDialog.type}
          onClose={() => setAlertDialog(null)}
        />
      )}

    </div>
  );
}

/** Wrapper com Suspense: useSearchParams exige-o no App Router. */
export default function CompanyDetailsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20" role="status" aria-label="A carregar"><div className="spinner" /></div>}>
      <CompanyDetailsContent />
    </Suspense>
  );
}
