"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import {
  Bell, Shield, User as UserIcon, LogOut, ChevronDown, CheckCircle2,
  Settings, Camera, Lock, X, Loader2, AlertTriangle, Info, AlertCircle
} from "lucide-react";
import mqtt from "mqtt";

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
  const [isAuthorized, setIsAuthorized] = useState(false);

  const [userInfo, setUserInfo] = useState<{ username: string, role: string } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showMyAccountModal, setShowMyAccountModal] = useState(false);

  // Alerta customizado (Liquid Glass)
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean, title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

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

        let data: any = { message: payloadStr, title: "Novo Alerta de Sistema" };
        try { data = JSON.parse(payloadStr); } catch (e) { }

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
      } catch (error) {
        console.error("Erro ao processar notificação MQTT:", error);
      }
    });

    return () => { client.end(); };
  }, [router]);

  const fetchMyProfile = async (username: string, token: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/users?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const users = await res.json();
        const me = users.find((u: any) => u.username === username);
        if (me) setCurrentUser(me);
      }
    } catch (e) {
      console.error("Não foi possível carregar o perfil completo.", e);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || newPassword !== confirmPassword) return;
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
        }, 2000);
      } else {
        // 👇 Substituído o alert() pelo novo Modal Liquid Glass 👇
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
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Auth/user/${currentUser.id}/avatar`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ avatarBase64: base64String })
        });

        if (res.ok) {
          setCurrentUser({ ...currentUser, avatarUrl: base64String });
        }
      } catch (error) {
        console.error("Falha ao fazer upload da imagem", error);
      } finally {
        setIsUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  if (!isAuthorized) return null;

  return (
    <div className="flex flex-col lg:flex-row h-[100dvh] bg-slate-100 p-2 lg:p-4 gap-2 lg:gap-4 overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 bg-white rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-y-auto flex flex-col relative">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex justify-end items-center shrink-0">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="relative">
              <button onClick={() => { setShowNotifMenu(!showNotifMenu); setShowProfileMenu(false); }} className={`p-2 rounded-xl transition-all relative ${showNotifMenu ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:text-purple-600 hover:bg-slate-50'}`}>
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
              </button>
              {showNotifMenu && (
                <div className="absolute right-0 mt-3 w-80 bg-white rounded-[1.5rem] shadow-[0_10px_40px_rgb(0,0,0,0.1)] border border-slate-100 p-4 z-50 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center mb-4 px-1">
                    <h4 className="font-extrabold text-slate-900">Notificações</h4>
                    {unreadCount > 0 && <button onClick={markAllAsRead} className="text-[10px] font-bold text-purple-600 hover:text-purple-800 transition-colors">Marcar lidas</button>}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100 flex flex-col items-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                      <p className="text-sm font-bold text-slate-700">Tudo calmo e tranquilo!</p>
                      <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">Não recebeste novos alertas das portas ou do sistema.</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                      {notifications.map(n => (
                        <div key={n.id} className={`p-3 rounded-xl border flex gap-3 transition-colors ${n.read ? 'bg-white border-slate-100' : 'bg-purple-50/50 border-purple-100 shadow-sm'}`}>
                          <div className="shrink-0 mt-0.5">{getNotificationIcon(n.type)}</div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900 mb-0.5">{n.title}</h5>
                            <p className="text-[11px] text-slate-600 leading-tight mb-1">{n.message}</p>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{n.time.toLocaleTimeString('pt-PT')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="h-8 w-px bg-slate-200"></div>

            <div className="relative">
              <button onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifMenu(false); }} className="flex items-center gap-3 cursor-pointer group p-1.5 pr-3 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900 leading-tight group-hover:text-purple-600 transition-colors">{userInfo?.username}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{userInfo?.role}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm transition-transform group-hover:scale-105 overflow-hidden ${userInfo?.role === 'SuperAdmin' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                  {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : userInfo?.role === 'SuperAdmin' ? <img src="/superadmin_default.png" alt="SuperAdmin" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5" />}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-3 w-56 bg-white rounded-[1.5rem] shadow-[0_10px_40px_rgb(0,0,0,0.1)] border border-slate-100 p-2 z-50 animate-in slide-in-from-top-2">
                  <div className="px-4 py-3 border-b border-slate-100 mb-2 sm:hidden">
                    <p className="text-sm font-bold text-slate-900 truncate">{userInfo?.username}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{userInfo?.role}</p>
                  </div>
                  <button onClick={() => { setShowMyAccountModal(true); setShowProfileMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-purple-600 rounded-xl flex items-center gap-3 font-bold transition-colors mb-1">
                    <Settings className="w-4 h-4 text-slate-400" /> A Minha Conta
                  </button>
                  <button onClick={handleLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 font-bold transition-colors">
                    <LogOut className="w-4 h-4" /> Terminar Sessão
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-10 flex-1">{children}</div>
      </main>

      {(showProfileMenu || showNotifMenu) && <div className="fixed inset-0 z-20" onClick={() => { setShowProfileMenu(false); setShowNotifMenu(false); }} />}

      {/* MODAL: A MINHA CONTA */}
      {showMyAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 relative border border-white/50 flex flex-col md:flex-row gap-8">
            <button onClick={() => setShowMyAccountModal(false)} className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors z-10"><X className="w-5 h-5" /></button>
            <div className="flex flex-col items-center md:w-1/3 pt-4">
              <div className="relative group cursor-pointer w-28 h-28 rounded-[1.5rem] overflow-hidden mb-4 shadow-[0_8px_30px_rgb(0,0,0,0.08)] border-4 border-white transition-transform hover:scale-105">
                <input type="file" accept="image/*" className="hidden" id="myAvatarUpload" onChange={handleImageUpload} disabled={isUploadingAvatar || !currentUser} />
                <label htmlFor="myAvatarUpload" className="w-full h-full flex items-center justify-center cursor-pointer relative">
                  {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : userInfo?.role === 'SuperAdmin' ? <img src="/superadmin_default.png" alt="SuperAdmin" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-600"><UserIcon className="w-10 h-10" /></div>}
                  <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    {isUploadingAvatar ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white mb-1" />}
                    {!isUploadingAvatar && <span className="text-[9px] font-bold text-white uppercase tracking-wider">Alterar</span>}
                  </div>
                </label>
              </div>
              <h3 className="text-lg font-black text-slate-900 text-center">{userInfo?.username}</h3>
              <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">{userInfo?.role}</p>
            </div>
            <div className="md:w-2/3 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8">
              <div className="flex items-center gap-2 mb-6 text-slate-800"><Lock className="w-5 h-5 text-purple-500" /><h3 className="text-lg font-black">Alterar Palavra-passe</h3></div>
              {successMessage ? (
                <div className="flex flex-col items-center justify-center py-10 text-emerald-500 animate-in fade-in"><CheckCircle2 className="w-12 h-12 mb-3" /><p className="font-bold text-center">{successMessage}</p></div>
              ) : (
                <div className="space-y-4">
                  <input type="password" placeholder="Palavra-passe Atual" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                  <input type="password" placeholder="Nova Palavra-passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none text-sm" />
                  <input type="password" placeholder="Confirme a Nova Palavra-passe" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`w-full bg-slate-50 border rounded-xl px-4 py-3 font-bold text-slate-900 outline-none text-sm transition-all ${confirmPassword && newPassword !== confirmPassword ? 'border-red-400 focus:ring-red-500 text-red-600' : 'border-slate-200 focus:ring-purple-500'}`} />
                  <button onClick={handleChangePassword} disabled={isProcessing || !oldPassword || newPassword.length < 4 || newPassword !== confirmPassword} className="w-full py-3 mt-2 rounded-xl font-bold text-white bg-slate-900 hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar Segurança'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 👇 MODAL GLOBAL DE ALERTAS (Liquid Glass) 👇 */}
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