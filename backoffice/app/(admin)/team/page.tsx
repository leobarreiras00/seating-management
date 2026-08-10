"use client";

import { useEffect, useState, useMemo } from "react";
import { Users, Search, Shield, User, Key, Trash2, X, Building2, Loader2, CheckCircle2, CalendarDays, Camera, Mail, AlertTriangle, Info, Plus, Lock } from "lucide-react";

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
    fetchUsers();
  }, []);

  // --- NOVA LÓGICA DE CRIAÇÃO (SUPER ADMIN) ---
  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true); 
    setCreateError("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // Enviamos para a Empresa de ID 1 (Seatly Admin) por defeito
        body: JSON.stringify({ email: newEmail, name: newName, role: "SuperAdmin", companyId: 1 }),
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.Message || "Erro ao criar SuperAdmin.");
      
      setShowCreateAdminModal(false); 
      setNewName(""); setNewEmail("");
      setAlertDialog({ isOpen: true, title: "Conta Criada", message: "O novo SuperAdmin foi criado. Foi enviado um e-mail com a palavra-passe temporária.", type: 'success' });
      fetchUsers();
    } catch (err: any) { 
      setCreateError(err.message); 
    } finally { 
      setIsCreating(false); 
    }
  };

  // --- NOVA LÓGICA DE RECUPERAÇÃO DE PASSWORD ---
  const promptSendResetEmail = (email: string, name: string) => {
    setConfirmDialog({
      isOpen: true, 
      title: "Recuperar Acesso", 
      message: `Queres enviar um e-mail de recuperação de palavra-passe para o SuperAdmin "${name}" (${email})?`,
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

  const promptDeleteUser = (userId: number, username: string) => {
    setConfirmDialog({
      isOpen: true, title: "Apagar Conta", message: `Tens a certeza que queres apagar permanentemente o utilizador "${username}"?`,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          setDetailsModalOpen(null);
          fetchUsers();
        } catch (error) { setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao tentar apagar a conta.", type: 'error' }); }
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !detailsModalOpen) return;

    setIsUploadingAvatar(true);
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${detailsModalOpen.id}/avatar`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ avatarBase64: base64String })
        });

        if (res.ok) {
          setDetailsModalOpen({ ...detailsModalOpen, avatarUrl: base64String });
          fetchUsers();
        }
      } catch (error) {
        console.error("Falha ao fazer upload da imagem", error);
      } finally {
        setIsUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const groupedUsers = useMemo(() => {
    const filtered = users.filter(u =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const groups: Record<string, {
      companyLogo?: string,
      superAdmins: UserData[],
      events: Record<string, { gestores: UserData[], utilizadores: UserData[] }>,
      unassigned: { gestores: UserData[], utilizadores: UserData[] }
    }> = {};
    filtered.forEach(u => {
      if (!groups[u.companyName]) {
        groups[u.companyName] = { companyLogo: u.companyLogo, superAdmins: [], events: {}, unassigned: { gestores: [], utilizadores: [] } };
      }
      const comp = groups[u.companyName];

      if (u.role === "SuperAdmin") {
        comp.superAdmins.push(u);
      } else if (u.events.length === 0) {
        if (u.role === "Gestor") comp.unassigned.gestores.push(u);
        else comp.unassigned.utilizadores.push(u);
      } else {
        u.events.forEach(ev => {
          if (!comp.events[ev.name]) {
            comp.events[ev.name] = { gestores: [], utilizadores: [] };
          }
          if (u.role === "Gestor") comp.events[ev.name].gestores.push(u);
          else comp.events[ev.name].utilizadores.push(u);
        });
      }
    });

    return groups;
  }, [users, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto pb-10 px-2 sm:px-4 lg:px-8">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-600" /> Gestão de Equipa
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Administração centralizada de acessos e contas.</p>
        </div>
        
        {/* NOVO: Botão Criar SuperAdmin */}
        {currentUserRole === "SuperAdmin" && (
          <button onClick={() => setShowCreateAdminModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20">
            <Plus className="w-5 h-5" /> Novo SuperAdmin
          </button>
        )}
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-4 rounded-[2rem] border border-white/50 shadow-sm flex items-center gap-3 mb-8">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Pesquisar por nome, e-mail ou empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:ring-0 text-slate-900 w-full placeholder:text-slate-400 font-medium"
        />
      </div>

      {Object.keys(groupedUsers).length === 0 ? (
        <div className="text-center py-20 bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Nenhum utilizador encontrado</h3>
        </div>
      ) : (
        Object.entries(groupedUsers).map(([companyName, data]) => (
          <div key={companyName} className="mb-14">
            <div className="flex items-center gap-4 mb-8">
              <SafeCompanyLogo logoUrl={data.companyLogo} companyName={companyName} className="w-14 h-14" fallbackSize="w-7 h-7" />
              <h2 className="text-2xl font-black text-slate-900">{companyName}</h2>
            </div>

            <div className="space-y-10 pl-6 border-l-2 border-slate-100/80 ml-5">
              {data.superAdmins.length > 0 && (
                <div className="relative">
                  <div className="absolute -left-[27px] top-2 w-3 h-3 bg-red-400 rounded-full border-2 border-slate-100"></div>
                  <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-4">Administração Central</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.superAdmins.map(user =>
                      <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: any) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: any) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />
                    )}
                  </div>
                </div>
              )}

              {Object.entries(data.events).map(([eventName, roles]) => (
                <div key={eventName} className="relative bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                  <div className="absolute -left-[27px] top-8 w-3 h-3 bg-purple-500 rounded-full border-2 border-slate-100 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>
                  <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-purple-500" /> Evento: {eventName}
                  </h3>
                  <div className="space-y-6">
                    {roles.gestores.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3">Gestores de Evento</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {roles.gestores.map(user => <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: any) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: any) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />)}
                        </div>
                      </div>
                    )}
                    {roles.utilizadores.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3">Validadores (Staff)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {roles.utilizadores.map(user => <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: any) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: any) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {(data.unassigned.gestores.length > 0 || data.unassigned.utilizadores.length > 0) && (
                <div className="relative">
                  <div className="absolute -left-[27px] top-2 w-3 h-3 bg-slate-300 rounded-full border-2 border-slate-100"></div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Sem Evento Atribuído</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.unassigned.gestores.map(user => <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: any) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: any) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />)}
                    {data.unassigned.utilizadores.map(user => <UserCard key={user.id} user={user} currentUserRole={currentUserRole} onClick={() => setDetailsModalOpen(user)} onDelete={(e: any) => { e.stopPropagation(); promptDeleteUser(user.id, user.username); }} onReset={(e: any) => { e.stopPropagation(); promptSendResetEmail(user.email, user.username); }} />)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      {/* --- MODAL: CRIAR NOVO SUPER ADMIN --- */}
      {showCreateAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2"><Shield className="w-5 h-5 text-red-500" /> Novo SuperAdmin</h3>
              <button onClick={() => setShowCreateAdminModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreateSuperAdmin} className="p-6 space-y-5">
              <p className="text-sm text-slate-500">A palavra-passe será gerada automaticamente e enviada para o e-mail inserido.</p>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Nome Completo</label>
                <input type="text" required value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="Ex: Maria Santos" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Endereço de E-mail</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-slate-400" /></div>
                  <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="maria@seatly.com" />
                </div>
              </div>
              {createError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" /> {createError}</div>}
              
              <button type="submit" disabled={isCreating || !newName || !newEmail} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all mt-2 flex justify-center items-center shadow-lg shadow-slate-900/20 disabled:opacity-70">
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Criar Administrador"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Detalhes do Perfil */}
      {detailsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 relative border border-white/50">
            <button onClick={() => setDetailsModalOpen(null)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center mb-8 mt-4">
              <div className="relative group cursor-pointer w-24 h-24 rounded-[1.5rem] overflow-hidden mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border-4 border-white transition-transform hover:scale-105">
                <input type="file" accept="image/*" className="hidden" id="avatarUpload" onChange={handleImageUpload} disabled={isUploadingAvatar} />
                <label htmlFor="avatarUpload" className="w-full h-full flex items-center justify-center cursor-pointer relative">
                  <div className={`w-full h-full flex items-center justify-center ${
                    detailsModalOpen.role === "SuperAdmin" ? "bg-red-50 text-red-600" :
                    detailsModalOpen.role === "Gestor" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                  }`}>
                    <SafeAvatar user={detailsModalOpen} iconSize="w-10 h-10" />
                  </div>
                  <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    {isUploadingAvatar ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white mb-1" />}
                    {!isUploadingAvatar && <span className="text-[9px] font-bold text-white uppercase tracking-wider">Alterar</span>}
                  </div>
                </label>
              </div>

              <h2 className="text-2xl font-black text-slate-900 text-center mb-1">{detailsModalOpen.username}</h2>
              <p className="text-slate-500 text-sm flex items-center gap-1 mb-2 font-medium"><Mail className="w-3.5 h-3.5" /> {detailsModalOpen.email}</p>
              <p className="text-slate-400 font-bold uppercase tracking-wider text-xs mb-3">{detailsModalOpen.role}</p>
              <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                <SafeCompanyLogo logoUrl={detailsModalOpen.companyLogo} companyName={detailsModalOpen.companyName} className="w-5 h-5 bg-transparent border-none shadow-none" fallbackSize="w-3.5 h-3.5" />
                <span className="text-slate-600 text-xs font-bold">
                  {detailsModalOpen.companyName}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-[1.5rem] p-5">
              <h3 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-purple-500" /> Eventos Atribuídos
              </h3>
              {detailsModalOpen.events.length === 0 ? (
                <p className="text-sm text-slate-500 font-medium">Este utilizador não tem nenhum evento atribuído.</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2">
                  {detailsModalOpen.events.map(ev => (
                    <div key={ev.id} className="bg-white border border-slate-200 px-4 py-2.5 rounded-xl shadow-sm flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></div>
                      <span className="font-bold text-slate-700 text-sm truncate">{ev.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL GLOBAL DE CONFIRMAÇÃO (Liquid Glass) */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-white/50 zoom-in-95 animate-in flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-5 shadow-inner"><AlertTriangle className="w-8 h-8" /></div>
            <h2 className="text-2xl font-black text-slate-900 text-center mb-2">{confirmDialog.title}</h2>
            <p className="text-slate-500 text-center font-medium mb-8 leading-relaxed">{confirmDialog.message}</p>
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
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border border-white/50 zoom-in-95 animate-in flex flex-col items-center text-center">
            {alertDialog.type === 'error' && <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-5 shadow-inner"><AlertTriangle className="w-8 h-8" /></div>}
            {alertDialog.type === 'success' && <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-5 shadow-inner"><CheckCircle2 className="w-8 h-8" /></div>}
            {alertDialog.type === 'info' && <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-5 shadow-inner"><Info className="w-8 h-8" /></div>}
            <h2 className="text-2xl font-black text-slate-900 mb-2">{alertDialog.title}</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">{alertDialog.message}</p>
            <button onClick={() => setAlertDialog(null)} className="w-full px-4 py-3.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-lg">OK, Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SafeAvatar({ user, iconSize = "w-6 h-6" }: any) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [user?.avatarUrl]);
  if (!user) return null;
  if (user.avatarUrl && !error) return <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" onError={() => setError(true)} />;
  if (user.role === "SuperAdmin") return <img src="/superadmin_default.png" alt="SuperAdmin" className="w-full h-full object-cover" />;
  const Icon = user.role === "SuperAdmin" ? Shield : User;
  return <Icon className={iconSize} />;
}

function SafeCompanyLogo({ logoUrl, companyName, className, fallbackSize = "w-6 h-6" }: any) {
  const [error, setError] = useState(false);
  useEffect(() => { setError(false); }, [logoUrl]);
  if (companyName?.toLowerCase().includes("seatly admin") || companyName?.toLowerCase().includes("seatly")) return <div className={`relative bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm shrink-0 flex items-center justify-center ${className}`}><img src="/seatly_icon.png" alt="Seatly Admin" className="w-full h-full object-cover" /></div>;
  if (!logoUrl || error) return <div className={`flex items-center justify-center bg-slate-100 border border-slate-200 rounded-2xl shrink-0 ${className}`}><Building2 className={`${fallbackSize} text-slate-400`} /></div>;
  const src = logoUrl.startsWith('http') ? logoUrl : `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}`;
  return <div className={`relative bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm shrink-0 flex items-center justify-center ${className}`}><img src={src} alt={companyName} className="w-full h-full object-cover" onError={() => setError(true)} /></div>;
}

// Componente Cartão de Utilizador Atualizado
function UserCard({ user, currentUserRole, onClick, onDelete, onReset }: any) {
  const isSuperAdmin = user.role === "SuperAdmin";
  const isGestor = user.role === "Gestor";
  const colorClass = isSuperAdmin ? "bg-red-50 text-red-600 border-red-100" : isGestor ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-emerald-50 text-emerald-600 border-emerald-100";
  const canResetPassword = currentUserRole === "SuperAdmin";
  
  return (
    <div onClick={onClick} className="bg-white/80 backdrop-blur-xl p-4 rounded-[1.25rem] border border-white/60 shadow-sm hover:border-purple-200 hover:shadow-md hover:-translate-y-1 transition-all group flex items-center justify-between cursor-pointer">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center shrink-0 border overflow-hidden relative shadow-sm ${colorClass}`}>
          <SafeAvatar user={user} iconSize="w-6 h-6" />
        </div>
        <div className="flex flex-col">
          <h4 className="font-extrabold text-slate-900 line-clamp-1">{user.username}</h4>
          <span className="text-[10px] font-medium text-slate-500 truncate mt-0.5">{user.email}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canResetPassword && (
          <button onClick={onReset} title="Enviar Link de Recuperação" className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors">
            <Lock className="w-4 h-4" />
          </button>
        )}
        <button onClick={onDelete} title="Apagar Conta" className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}