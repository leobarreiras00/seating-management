"use client";

/**
 * Gestão de Equipa — lista de todas as contas do backoffice.
 *
 * Estrutura da página:
 *   1. Cabeçalho (PageHeader) + botão "Nova Conta Seatly" (só SuperAdmin).
 *   2. Barra de pesquisa (filtra por nome, e-mail ou empresa).
 *   3. "Administração Central": cartões dos SuperAdmins.
 *   4. Um cartão por empresa, com os Gestores e os Validadores (Staff)
 *      agrupados por evento numa linha temporal colorida.
 *   5. Modais: criar SuperAdmin, detalhes do utilizador (com upload de avatar)
 *      e os diálogos de confirmação / aviso.
 *
 * Nota: toda a lógica (fetch, filtros, agrupamento, upload) é a original;
 * este ficheiro só mudou o aspeto (JSX + classes).
 */

import { useEffect, useState, useMemo } from "react";
import { Users, Shield, User, Trash2, Building2, Loader2, CalendarDays, Camera, Mail, AlertTriangle, Plus, Lock, Search, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import AlertDialog from "@/components/ui/AlertDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { fileToAvatarDataUri } from "@/lib/avatar";
import { getErrorMessage } from "@/lib/errors";

interface UserData {
  id: number;
  email: string;
  username: string;
  role: string;
  companyName: string;
  companyLogo?: string;
  avatarUrl?: string;
  events: { id: number; name: string }[];
}

export default function TeamPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [detailsModalOpen, setDetailsModalOpen] = useState<UserData | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Sistema de Diálogos (Liquid Glass)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean, title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);

  // Modal de Criação de SuperAdmin
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const payload = JSON.parse(atob(token.split('.')[1]));
      setCurrentUserRole(payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/users?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) setUsers(await res.json());
    } catch (error) {
      console.error("Erro ao carregar utilizadores", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial no mount; o setState só corre depois do await
    fetchUsers();
  }, []);

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true); 
    setCreateError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, name: newName, role: "SuperAdmin", companyId: 1 }),
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.Message || "Erro ao criar SuperAdmin.");
      
      setShowCreateAdminModal(false); 
      setNewName(""); setNewEmail("");
      setAlertDialog({ isOpen: true, title: "Conta Criada", message: "O novo SuperAdmin foi criado. Foi enviado um e-mail com a palavra-passe temporária.", type: 'success' });
      fetchUsers();
    } catch (err: unknown) { 
      setCreateError(getErrorMessage(err)); 
    } finally { 
      setIsCreating(false); 
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

  const promptDeleteUser = (userId: number, username: string) => {
    setConfirmDialog({
      isOpen: true, title: "Apagar Conta", message: `Tens a certeza que queres apagar permanentemente o utilizador "${username}"?`,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          setDetailsModalOpen(null);
          fetchUsers();
        } catch { setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao tentar apagar a conta.", type: 'error' }); }
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detailsModalOpen) return;

    setIsUploadingAvatar(true);
    try {
      const base64String = await fileToAvatarDataUri(file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${detailsModalOpen.id}/avatar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ avatarBase64: base64String })
      });

      if (res.ok) {
        setDetailsModalOpen({ ...detailsModalOpen, avatarUrl: base64String });
        fetchUsers();
      } else {
        alert("Não foi possível atualizar a fotografia. Tenta com outra imagem.");
      }
    } catch (error) {
      console.error("Falha ao fazer upload da imagem", error);
      alert(error instanceof Error ? error.message : "Falha ao fazer upload da imagem.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const { superAdmins, companyGroups } = useMemo(() => {
    const filtered = users.filter(u =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sAdmins: UserData[] = [];
    const groups: Record<string, {
      companyLogo?: string,
      gestores: Record<string, UserData[]>,
      utilizadores: Record<string, UserData[]>,
      unassigned: UserData[]
    }> = {};

    filtered.forEach(u => {
      const isSeatlyAdminComp = u.companyName.toLowerCase().includes("seatly admin") || u.companyName.toLowerCase().includes("seatly");

      if (u.role === "SuperAdmin" || isSeatlyAdminComp) {
        sAdmins.push(u);
        return;
      }

      if (!groups[u.companyName]) {
        groups[u.companyName] = { companyLogo: u.companyLogo, gestores: {}, utilizadores: {}, unassigned: [] };
      }
      const comp = groups[u.companyName];

      if (u.events.length === 0) {
        comp.unassigned.push(u);
      } else {
        u.events.forEach(ev => {
          if (u.role === "Gestor") {
            if (!comp.gestores[ev.name]) comp.gestores[ev.name] = [];
            comp.gestores[ev.name].push(u);
          } else {
            if (!comp.utilizadores[ev.name]) comp.utilizadores[ev.name] = [];
            comp.utilizadores[ev.name].push(u);
          }
        });
      }
    });

    return { superAdmins: sAdmins, companyGroups: groups };
  }, [users, searchQuery]);

  // ───────────── Estado de carregamento ─────────────
  if (isLoading) {
    return (
      <div className="flex justify-center p-20" role="status" aria-label="A carregar">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      {/* ───────────── Cabeçalho da página ───────────── */}
      <PageHeader
        icon={<Users className="w-6 h-6" />}
        title="Gestão de Equipa"
        description="Administração centralizada de acessos e contas."
        actions={
          currentUserRole === "SuperAdmin" ? (
            <button type="button" onClick={() => setShowCreateAdminModal(true)} className="btn btn-primary">
              <Plus className="w-5 h-5" /> Nova Conta Seatly
            </button>
          ) : undefined
        }
      />

      {/* ───────────── Pesquisa ───────────── */}
      <div className="reveal search-bar mb-6 lg:mb-8" style={{ "--i": 1 } as React.CSSProperties}>
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Pesquisar por nome, e-mail ou empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Pesquisar utilizadores"
        />
      </div>

      {superAdmins.length === 0 && Object.keys(companyGroups).length === 0 ? (
        /* Lista vazia */
        <EmptyState title="Nenhum utilizador encontrado" description="Experimenta outro termo de pesquisa." />
      ) : (
        <div className="stagger space-y-6 sm:space-y-8">
          {/* ───────────── Administração Central (SuperAdmins) ───────────── */}
          {superAdmins.length > 0 && (
            <section className="card-main overflow-hidden">
              <div className="flex items-center gap-3 px-6 sm:px-8 py-4 bg-[image:var(--grad-red)] text-white">
                <Shield className="w-5 h-5" />
                <h3 className="text-sm font-bold tracking-wide">Administração Central</h3>
                <span className="ml-auto badge bg-white/25 text-white border-white/30">{superAdmins.length}</span>
              </div>
              <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 p-5 sm:p-8">
                {superAdmins.map(user =>
                  <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: React.MouseEvent) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: React.MouseEvent) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />
                )}
              </div>
            </section>
          )}

          {/* ───────────── Uma secção por empresa ───────────── */}
          {Object.entries(companyGroups).map(([companyName, data]) => (
            <section key={companyName} className="card-main p-5 sm:p-8">
              {/* Cabeçalho da empresa */}
              <div className="flex items-center gap-4 mb-8">
                <SafeCompanyLogo logoUrl={data.companyLogo} companyName={companyName} className="w-14 h-14" fallbackSize="w-6 h-6" />
                <h2 className="text-2xl font-bold text-slate-900 min-w-0 break-words">{companyName}</h2>
              </div>

              {/* Gestores (azul), agrupados por evento */}
              {Object.keys(data.gestores).length > 0 && (
                <div className="mb-10">
                  <h3 className="badge badge-blue !text-sm !px-3.5 !py-1.5 mb-5">
                    <User className="w-4 h-4" /> Gestores da Empresa
                  </h3>
                  <div className="pl-4 sm:pl-6 border-l-2 border-blue-200 ml-2 space-y-7">
                    {Object.entries(data.gestores).map(([eventName, usersList]) => (
                      <div key={eventName} className="relative">
                        <div className="absolute -left-[23px] sm:-left-[31px] top-1 w-3 h-3 rounded-full bg-[image:var(--grad-blue)] ring-4 ring-white shadow"></div>
                        <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-blue-500" /> {eventName}
                        </h4>
                        <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {usersList.map(user => <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: React.MouseEvent) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: React.MouseEvent) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validadores / Staff (verde), agrupados por evento */}
              {Object.keys(data.utilizadores).length > 0 && (
                <div className="mb-10">
                  <h3 className="badge badge-green !text-sm !px-3.5 !py-1.5 mb-5">
                    <Users className="w-4 h-4" /> Validadores (Staff)
                  </h3>
                  <div className="pl-4 sm:pl-6 border-l-2 border-emerald-200 ml-2 space-y-7">
                    {Object.entries(data.utilizadores).map(([eventName, usersList]) => (
                      <div key={eventName} className="relative">
                        <div className="absolute -left-[23px] sm:-left-[31px] top-1 w-3 h-3 rounded-full bg-[image:var(--grad-emerald)] ring-4 ring-white shadow"></div>
                        <h4 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-emerald-500" /> {eventName}
                        </h4>
                        <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {usersList.map(user => <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: React.MouseEvent) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: React.MouseEvent) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Utilizadores sem evento atribuído */}
              {data.unassigned.length > 0 && (
                <div className="pt-6 border-t border-dashed border-slate-300/70 mt-4">
                  <h3 className="badge badge-slate !text-sm !px-3.5 !py-1.5 mb-4">
                    Sem Evento Atribuído
                  </h3>
                  <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.unassigned.map(user => <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: React.MouseEvent) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: React.MouseEvent) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />)}
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {/* ───────────── Modal: criar conta SuperAdmin ───────────── */}
      {showCreateAdminModal && (
        <Modal
          onClose={() => setShowCreateAdminModal(false)}
          title="Nova Conta Seatly"
          subtitle="Administrador com acesso total"
          icon={<Shield className="w-5 h-5" />}
          tone="red"
          size="md"
          footer={
            <button type="submit" form="create-admin-form" disabled={isCreating || !newName || !newEmail} className="btn btn-primary btn-lg btn-block">
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar Administrador"}
            </button>
          }
        >
          <form id="create-admin-form" onSubmit={handleCreateSuperAdmin} className="space-y-5">
            <div className="notice notice-info">
              <Mail className="w-4 h-4" />
              <span>A palavra-passe será gerada automaticamente e enviada para o e-mail inserido.</span>
            </div>
            <div>
              <label className="field-label">Nome Completo</label>
              <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} className="input" placeholder="Ex: Maria Santos" />
            </div>
            <div>
              <label className="field-label">Endereço de E-mail</label>
              <div className="input-wrap">
                <Mail className="input-icon" />
                <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="input input-with-icon" placeholder="maria@seatly.com" />
              </div>
            </div>
            {createError && <div className="notice notice-error"><AlertTriangle className="w-5 h-5" /> {createError}</div>}
          </form>
        </Modal>
      )}

      {/* ───────────── Modal: detalhes do utilizador (avatar editável) ───────────── */}
      {detailsModalOpen && (
        <Modal bare size="md" onClose={() => setDetailsModalOpen(null)} tone={detailsModalOpen.role === "SuperAdmin" ? "red" : detailsModalOpen.role === "Gestor" ? "blue" : "emerald"}>
          <div className="overflow-y-auto custom-scrollbar">
            {/* Faixa colorida do papel + botão fechar */}
            <div className={`relative h-28 ${
              detailsModalOpen.role === "SuperAdmin" ? "bg-[image:var(--grad-red)]" :
              detailsModalOpen.role === "Gestor" ? "bg-[image:var(--grad-blue)]" : "bg-[image:var(--grad-emerald)]"
            }`}>
              <div aria-hidden className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-white/25 blur-2xl" />
              <button type="button" onClick={() => setDetailsModalOpen(null)} aria-label="Fechar" className="absolute top-5 right-5 modal-close !bg-white/25 !text-white hover:!bg-white/40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 sm:px-8 pb-8 -mt-14 relative z-10">
              <div className="flex flex-col items-center mb-6">
                {/* Avatar: clicar abre o seletor de ficheiros */}
                <div className="relative group cursor-pointer w-28 h-28 rounded-3xl overflow-hidden mb-4 shadow-xl ring-4 ring-white transition-transform hover:scale-105">
                  <input type="file" accept="image/*" className="hidden" id="avatarUpload" onChange={handleImageUpload} disabled={isUploadingAvatar} />
                  <label htmlFor="avatarUpload" className="w-full h-full flex items-center justify-center cursor-pointer relative outline-none focus-within:ring-2 focus-within:ring-purple-500">
                    <div className={`w-full h-full flex items-center justify-center ${
                      detailsModalOpen.role === "SuperAdmin" ? "bg-red-50 text-red-600" :
                      detailsModalOpen.role === "Gestor" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                    }`}>
                      <SafeAvatar user={detailsModalOpen} iconSize="w-10 h-10" />
                    </div>
                    <div className="absolute inset-0 bg-purple-950/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isUploadingAvatar ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white mb-1" />}
                      {!isUploadingAvatar && <span className="text-[11px] font-semibold text-white">Alterar</span>}
                    </div>
                  </label>
                </div>

                <h2 className="text-2xl font-bold text-slate-900 text-center mb-1 break-words max-w-full">{detailsModalOpen.username}</h2>
                <p className="text-slate-500 text-sm flex items-center gap-1 mb-3 font-medium max-w-full"><Mail className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{detailsModalOpen.email}</span></p>
                <span className={`badge mb-3 ${
                  detailsModalOpen.role === "SuperAdmin" ? "badge-red" :
                  detailsModalOpen.role === "Gestor" ? "badge-blue" : "badge-green"
                }`}>{detailsModalOpen.role}</span>

                {detailsModalOpen.role !== "SuperAdmin" && (
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-sm">
                    <SafeCompanyLogo logoUrl={detailsModalOpen.companyLogo} companyName={detailsModalOpen.companyName} className="w-5 h-5 bg-transparent border-none shadow-none" fallbackSize="w-3.5 h-3.5" />
                    <span className="text-slate-600 text-xs font-semibold">{detailsModalOpen.companyName}</span>
                  </div>
                )}
              </div>

              {/* Eventos atribuídos */}
              {detailsModalOpen.role !== "SuperAdmin" && (
                <div className="card-nested-flat p-5">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-purple-500" /> Eventos Atribuídos
                  </h3>
                  {detailsModalOpen.events.length === 0 ? (
                    <p className="text-sm text-slate-500 font-medium">Este utilizador não tem nenhum evento atribuído.</p>
                  ) : (
                    <div className="stagger flex flex-col gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                      {detailsModalOpen.events.map(ev => (
                        <div key={ev.id} className="bg-white border border-purple-100 px-4 py-2.5 rounded-2xl shadow-sm flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full bg-[image:var(--grad-brand)] shrink-0"></div>
                          <span className="font-semibold text-slate-700 text-sm truncate">{ev.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ───────────── Diálogo de confirmação ───────────── */}
      {confirmDialog && confirmDialog.isOpen && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* ───────────── Diálogo de aviso (erro / sucesso / info) ───────────── */}
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

/**
 * SafeAvatar — mostra o avatar do utilizador; se a imagem falhar (ou não existir)
 * cai para a imagem por defeito do SuperAdmin ou para um ícone.
 */
function SafeAvatar({ user, iconSize = "w-6 h-6" }: { user?: UserData | null; iconSize?: string }) {
  // Guarda o URL que falhou; muda automaticamente quando o avatarUrl muda (sem efeito).
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const error = failedUrl !== null && failedUrl === (user?.avatarUrl ?? null);
  if (!user) return null;
  if (user.avatarUrl && !error) {
    const avatarUrl = user.avatarUrl;
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar/logótipo dinâmico (data URI ou URL da API), next/image não aplicável */}
        <img src={avatarUrl} alt={user.username} className="w-full h-full object-cover" onError={() => setFailedUrl(avatarUrl)} />
      </>
    );
  }
  if (user.role === "SuperAdmin") {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar/logótipo dinâmico (data URI ou URL da API), next/image não aplicável */}
        <img src="/superadmin_default.png" alt="SuperAdmin" className="w-full h-full object-cover" />
      </>
    );
  }
  const Icon = user.role === "SuperAdmin" ? Shield : User;
  return <Icon className={iconSize} />;
}

/**
 * SafeCompanyLogo — logótipo da empresa com fallback para um ícone de edifício.
 * Empresas "Seatly" usam sempre o ícone da marca.
 */
function SafeCompanyLogo({ logoUrl, companyName, className, fallbackSize = "w-6 h-6" }: { logoUrl?: string | null; companyName?: string | null; className?: string; fallbackSize?: string }) {
  // Guarda o URL que falhou; muda automaticamente quando o logoUrl muda (sem efeito).
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const error = failedUrl !== null && failedUrl === (logoUrl ?? null);
  if (companyName?.toLowerCase().includes("seatly admin") || companyName?.toLowerCase().includes("seatly")) {
    return (
      <div className={`relative bg-white border border-white rounded-2xl overflow-hidden shadow-md ring-1 ring-purple-200 shrink-0 flex items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar/logótipo dinâmico (data URI ou URL da API), next/image não aplicável */}
        <img src="/seatly_icon.png" alt="Seatly Admin" className="w-full h-full object-cover" />
      </div>
    );
  }
  if (!logoUrl || error) return <div className={`flex items-center justify-center bg-[image:var(--grad-brand-soft)] border border-purple-100 rounded-2xl shrink-0 ${className}`}><Building2 className={`${fallbackSize} text-purple-400`} /></div>;

  const src = logoUrl.startsWith('http') || logoUrl.startsWith('data:image') ? logoUrl : `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}`;
  return (
    <div className={`relative bg-white border border-white rounded-2xl overflow-hidden shadow-md ring-1 ring-purple-200 shrink-0 flex items-center justify-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- avatar/logótipo dinâmico (data URI ou URL da API), next/image não aplicável */}
      <img src={src} alt={companyName ?? undefined} className="w-full h-full object-cover" onError={() => setFailedUrl(logoUrl)} />
    </div>
  );
}

/**
 * UserCard — cartão de um utilizador: avatar com anel na cor do papel,
 * nome, e-mail, etiqueta do papel e ações (recuperar acesso / apagar).
 * Cores: SuperAdmin = vermelho, Gestor = azul, restantes = verde.
 */
// ACESSIBILIDADE CORRIGIDA (DIV para navegação com teclado no cartão)
interface UserCardProps {
  user: UserData;
  currentUserRole: string | null;
  onClick: (e: React.SyntheticEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onReset: (e: React.MouseEvent) => void;
}

function UserCard({ user, currentUserRole, onClick, onDelete, onReset }: UserCardProps) {
  const isSuperAdmin = user.role === "SuperAdmin";
  const isGestor = user.role === "Gestor";
  const colorClass = isSuperAdmin ? "bg-red-50 text-red-600 border-red-100" : isGestor ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100";
  const canResetPassword = currentUserRole === "SuperAdmin";
  // Anel do avatar e etiqueta do papel
  const ringClass = isSuperAdmin ? "ring-red-300" : isGestor ? "ring-blue-300" : "ring-emerald-300";
  const badgeClass = isSuperAdmin ? "badge-red" : isGestor ? "badge-blue" : "badge-green";
  
  return (
    <div 
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      }}
      className="card-nested-pop card-lift p-4 group flex items-center justify-between cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2"
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2">
        {/* Avatar com anel colorido */}
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border overflow-hidden relative shadow-md ring-2 ring-offset-2 ring-offset-white ${ringClass} ${colorClass}`}>
          <SafeAvatar user={user} iconSize="w-6 h-6" />
        </div>
        <div className="flex flex-col min-w-0 gap-1">
          <h4 className="font-bold text-slate-900 truncate" title={user.username}>{user.username}</h4>
          <span className="text-[11px] font-medium text-slate-500 truncate">{user.email}</span>
          <span className={`badge ${badgeClass} self-start !py-0.5 !text-[10px]`}>{user.role}</span>
        </div>
      </div>
      
      {/* ACESSIBILIDADE: focus-within inserido para tornar os botões visíveis no TAB */}
      <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
        {canResetPassword && (
          <button 
            type="button" 
            onClick={(e) => { e.stopPropagation(); onReset(e); }} 
            onKeyDown={(e) => e.stopPropagation()} // Previne que o ENTER ative o cartão principal
            title="Enviar Link de Recuperação" 
            className="icon-btn icon-btn-amber !w-9 !h-9"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}
        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); onDelete(e); }} 
          onKeyDown={(e) => e.stopPropagation()} // Previne que o ENTER ative o cartão principal
          title="Apagar Conta" 
          className="icon-btn icon-btn-red !w-9 !h-9"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
