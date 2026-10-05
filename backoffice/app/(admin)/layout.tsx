"use client";

/**
 * AdminLayout — "casca" de todas as páginas autenticadas (/dashboard, /companies, …).
 *
 * Responsabilidades (lógica original, não alterar sem testar):
 *   1. Proteger a rota: sem `token` no localStorage → /login.
 *   2. Ler o nome/perfil do JWT e carregar o perfil completo (/api/Auth/users).
 *   3. Ligar ao MQTT e transformar mensagens de `seating/alerts/#` e `seating/audit/#` em notificações.
 *   4. Alterar palavra-passe e avatar ("A Minha Conta").
 *
 * Visual: cabeçalho de vidro flutuante com saudação, sino que "toca" quando há
 * notificações novas, menus de vidro e transição `.page-enter` a cada mudança de rota.
 */

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { 
  Bell, User as UserIcon, LogOut, ChevronDown, CheckCircle2, 
  Settings, Camera, Lock, Loader2, AlertTriangle, Info, AlertCircle, Mail 
} from "lucide-react";
import mqtt from "mqtt";
import Modal from "@/components/ui/Modal";
import AlertDialog from "@/components/ui/AlertDialog";
import { fileToAvatarDataUri } from "@/lib/avatar";

interface CurrentUser {
  id: number;
  username: string;
  email?: string;
  avatarUrl?: string;
}

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'alert' | 'info' | 'success';
  time: Date;
  read: boolean;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); // só para animar a transição entre páginas
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const [userInfo, setUserInfo] = useState<{username: string, role: string} | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showMyAccountModal, setShowMyAccountModal] = useState(false);

  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean, title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchMyProfile = async (username: string, token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/users?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const users = await res.json();
        const me = (users as CurrentUser[]).find((u) => u.username === username);
        if (me) setCurrentUser(me);
      }
    } catch (e) {
      console.error("Não foi possível carregar o perfil completo.", e);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    } 
    
    // eslint-disable-next-line react-hooks/set-state-in-effect -- guarda de autenticação: só corre no cliente (localStorage), não pode ser derivado no render (SSR)
    setIsAuthorized(true);
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const username = payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] || "Utilizador";
      const role = payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] || "Gestor";
      
      setUserInfo({ username, role });
      fetchMyProfile(username, token);
    } catch (error) {
      console.error("Erro ao ler token", error);
    }

    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL as string, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME as string,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD as string,
    });
    
    client.on("connect", () => {
      client.subscribe("seating/alerts/#");
      client.subscribe("seating/audit/#");
    });

    client.on("message", (topic, message) => {
      try {
        const payloadStr = message.toString();
        
        let data: { message?: string; title?: string; type?: AppNotification['type'] } = { message: payloadStr, title: "Novo Alerta de Sistema" };
        try { data = JSON.parse(payloadStr); } catch {}

        let type: AppNotification['type'] = 'info';
        if (topic.includes("security") || topic.includes("fake")) type = 'alert';
        if (topic.includes("capacity")) type = 'warning';
        if (data.type) type = data.type; 

        const newNotif: AppNotification = {
          id: Math.random().toString(36).substr(2, 9),
          title: data.title || "Alerta Operacional",
          message: data.message || payloadStr,
          type: type,
          time: new Date(),
          read: false
        };

        setNotifications(prev => [newNotif, ...prev].slice(0, 50));
      } catch(error) {
        console.error("Erro ao processar notificação MQTT:", error);
      }
    });

    return () => { client.end(); };
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleChangePassword = async () => {
    if (!oldPassword || newPassword.length < 6 || newPassword !== confirmPassword) return;
    setIsProcessing(true);
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/change-password`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword })
      });

      if (res.ok) {
        setSuccessMessage("Palavra-passe atualizada com sucesso!");
        setTimeout(() => {
            setSuccessMessage("");
            setOldPassword(""); setNewPassword(""); setConfirmPassword("");
            setShowMyAccountModal(false);
        }, 2000);
      } else {
        setAlertDialog({ isOpen: true, title: "Erro de Autenticação", message: "A palavra-passe atual que inseriste está incorreta.", type: 'error' });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploadingAvatar(true);
    try {
      const base64String = await fileToAvatarDataUri(file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${currentUser.id}/avatar`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ avatarBase64: base64String })
      });

      if (res.ok) {
        setCurrentUser({ ...currentUser, avatarUrl: base64String });
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

  const getNotificationIcon = (type: string) => {
    switch(type) {
      case 'alert': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  if (!isAuthorized) return null;

  // Saudação consoante a hora (só decorativa)
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 20 ? "Boa tarde" : "Boa noite";

  // Cor do chip de cada tipo de notificação
  const notifTone = (type: string) =>
    type === "alert" ? "bg-red-50 text-red-500" : type === "warning" ? "bg-amber-50 text-amber-500" : type === "success" ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500";

  // Fecha o modal "A Minha Conta" e limpa os campos (comportamento original do botão X)
  const closeMyAccount = () => {
    setShowMyAccountModal(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto flex flex-col relative">
        {/* CABEÇALHO: saudação à esquerda, notificações e perfil à direita */}
        <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 pt-3 lg:pt-4 shrink-0">
          <div className="glass rounded-[1.75rem] px-4 sm:px-5 py-2.5 flex justify-between items-center gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-widest text-purple-500">{greeting}</p>
              <p className="font-display font-bold text-slate-900 truncate leading-tight">{userInfo?.username}</p>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Notificações */}
              <div className="relative">
                <button
                  onClick={() => { setShowNotifMenu(!showNotifMenu); setShowProfileMenu(false); }}
                  aria-label="Notificações"
                  aria-expanded={showNotifMenu}
                  className={`icon-btn relative ${showNotifMenu ? "!bg-purple-50 !text-purple-600" : ""}`}
                >
                  <Bell className={`w-5 h-5 ${unreadCount > 0 ? "bell-ring" : ""}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifMenu && (
                  <div className="glass !bg-white absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-3xl p-4 z-50 animate-in">
                    <div className="flex justify-between items-center mb-3 px-1">
                      <h4 className="font-display font-bold text-slate-900">Notificações</h4>
                      {unreadCount > 0 && <button onClick={markAllAsRead} className="text-[11px] font-bold text-purple-600 hover:text-purple-800 transition-colors">Marcar lidas</button>}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="card-nested-flat p-6 text-center flex flex-col items-center">
                        <div className="dialog-icon dialog-icon-success !w-14 !h-14 mb-3"><CheckCircle2 className="w-7 h-7" /></div>
                        <p className="text-sm font-bold text-slate-700">Tudo calmo e tranquilo!</p>
                        <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Não recebeste novos alertas das portas ou do sistema.</p>
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto pr-1 space-y-2 custom-scrollbar stagger">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-3 rounded-2xl border flex gap-3 transition-colors ${n.read ? "bg-white/70 border-slate-100" : "bg-purple-50/70 border-purple-100 shadow-sm"}`}>
                            <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${notifTone(n.type)}`}>{getNotificationIcon(n.type)}</div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-slate-900 mb-0.5">{n.title}</h5>
                              <p className="text-[11px] text-slate-600 leading-snug mb-1 break-words">{n.message}</p>
                              <span className="text-[11px] font-semibold text-slate-400">{n.time.toLocaleTimeString('pt-PT')}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-8 w-px bg-purple-200/60"></div>

              {/* Perfil */}
              <div className="relative">
                <button onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifMenu(false); }} aria-expanded={showProfileMenu} className="flex items-center gap-3 cursor-pointer group p-1 pr-2 sm:pr-3 rounded-2xl hover:bg-white/70 transition-all">
                  <div className="text-right hidden sm:block">
                    <span className={`badge ${userInfo?.role === "SuperAdmin" ? "badge-red" : "badge-blue"}`}>{userInfo?.role}</span>
                  </div>
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ring-2 ring-white shadow-md transition-transform group-hover:scale-105 overflow-hidden ${userInfo?.role === 'SuperAdmin' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                    {currentUser?.avatarUrl ? <img /* eslint-disable-line @next/next/no-img-element -- avatar dinâmico (data URI ou URL da API) */ src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : userInfo?.role === 'SuperAdmin' ? <img src="/superadmin_default.png" alt="SuperAdmin" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5" />}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {showProfileMenu && (
                  <div className="glass !bg-white absolute right-0 mt-3 w-60 rounded-3xl p-2 z-50 animate-in">
                    <div className="px-4 py-3 border-b border-purple-100 mb-2">
                      <p className="text-sm font-bold text-slate-900 truncate">{userInfo?.username}</p>
                      {currentUser?.email && <p className="text-[11px] text-slate-500 font-medium truncate mb-1">{currentUser.email}</p>}
                      <p className="text-[11px] font-semibold text-slate-400 sm:hidden">{userInfo?.role}</p>
                    </div>
                    <button onClick={() => { setShowMyAccountModal(true); setShowProfileMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 rounded-2xl flex items-center gap-3 font-semibold transition-colors mb-1">
                      <Settings className="w-4 h-4 text-purple-400" /> A Minha Conta
                    </button>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-2xl flex items-center gap-3 font-semibold transition-colors">
                      <LogOut className="w-4 h-4" /> Terminar Sessão
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* CONTEÚDO DA PÁGINA — `key` faz a animação repetir a cada navegação */}
        <div key={pathname} className="page-enter p-4 sm:p-6 lg:p-8 flex-1">{children}</div>
      </main>

      {/* Fundo invisível: clicar fora fecha os menus */}
      {(showProfileMenu || showNotifMenu) && <div className="fixed inset-0 z-20" onClick={() => { setShowProfileMenu(false); setShowNotifMenu(false); }} />}

      {/* MODAL: A MINHA CONTA (avatar à esquerda, alterar palavra-passe à direita) */}
      {showMyAccountModal && (
        <Modal title="A Minha Conta" subtitle="Perfil e segurança" icon={<Settings className="w-5 h-5" />} size="2xl" onClose={closeMyAccount}>
          <div className="flex flex-col md:flex-row gap-8 md:gap-10">
            <div className="flex flex-col items-center md:w-5/12">
              <div className="relative group cursor-pointer w-32 h-32 rounded-[2rem] overflow-hidden mb-5 shadow-[0_14px_34px_-12px_rgba(124,58,237,0.55)] ring-4 ring-white transition-transform hover:scale-105">
                <input type="file" accept="image/*" className="hidden" id="myAvatarUpload" onChange={handleImageUpload} disabled={isUploadingAvatar || !currentUser} />
                <label htmlFor="myAvatarUpload" className="w-full h-full flex items-center justify-center cursor-pointer relative">
                  {currentUser?.avatarUrl ? <img /* eslint-disable-line @next/next/no-img-element -- avatar dinâmico (data URI ou URL da API) */ src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : userInfo?.role === 'SuperAdmin' ? <img src="/superadmin_default.png" alt="SuperAdmin" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600"><UserIcon className="w-10 h-10" /></div>}
                  <div className="absolute inset-0 bg-purple-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {isUploadingAvatar ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white mb-1" />}
                    {!isUploadingAvatar && <span className="text-[11px] font-semibold text-white">Alterar</span>}
                  </div>
                </label>
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-1 break-words w-full px-2 leading-tight">{userInfo?.username}</h3>
              {currentUser?.email && <p className="text-slate-500 text-[12px] font-medium flex items-center justify-center gap-1.5 mb-3 break-words text-center w-full px-2"><Mail className="w-3.5 h-3.5 shrink-0" /> {currentUser.email}</p>}
              <span className={`badge ${userInfo?.role === "SuperAdmin" ? "badge-red" : "badge-blue"}`}>{userInfo?.role}</span>
            </div>

            <div className="md:w-7/12 border-t md:border-t-0 md:border-l border-purple-100 pt-6 md:pt-0 md:pl-10">
              <div className="flex items-center gap-2 mb-5 text-slate-800"><Lock className="w-5 h-5 text-purple-500" /><h3 className="text-lg font-bold">Alterar Palavra-passe</h3></div>
              {successMessage ? (
                <div className="flex flex-col items-center justify-center py-10 animate-in">
                  <div className="dialog-icon dialog-icon-success mb-3"><CheckCircle2 className="w-8 h-8" /></div>
                  <p className="font-bold text-emerald-700 text-center">{successMessage}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <input type="password" placeholder="Palavra-passe Atual" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="input" />

                  <div>
                    <input type="password" placeholder="Nova Palavra-passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`input ${newPassword.length > 0 && newPassword.length < 6 ? 'input-invalid' : ''}`} />
                    {newPassword.length > 0 && newPassword.length < 6 && (
                      <p className="text-red-500 text-[11px] font-semibold mt-1.5 ml-1 animate-in">A palavra-passe deve ter pelo menos 6 caracteres.</p>
                    )}
                  </div>

                  <input type="password" placeholder="Confirme a Nova Palavra-passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`input ${confirmPassword && newPassword !== confirmPassword ? 'input-invalid' : ''}`} />

                  <button
                    onClick={handleChangePassword}
                    disabled={isProcessing || !oldPassword || newPassword.length < 6 || newPassword !== confirmPassword}
                    className="btn btn-primary btn-lg btn-block mt-2">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar Segurança'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ALERTA GLOBAL (erros de autenticação, etc.) */}
      {alertDialog && alertDialog.isOpen && (
        <AlertDialog title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} onClose={() => setAlertDialog(null)} />
      )}
    </div>
  );
}
