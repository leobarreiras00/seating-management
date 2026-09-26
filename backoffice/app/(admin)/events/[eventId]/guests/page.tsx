"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Search, Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle2, Info, Users, UserPlus } from "lucide-react";
import mqtt from "mqtt";

interface Guest {
  id: number;
  guestName: string;
  category: string;
  tableName: string;
  seatNumber: string;
  status: number;
}

export default function ManageGuestsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [guests, setGuests] = useState<Guest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Liquid Glass Dialogs
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean, title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);

  // Modals for CRUD
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  
  // Form State (Categoria agora começa vazia)
  const [formData, setFormData] = useState({ guestName: "", category: "", tableName: "", seatNumber: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchGuests = useCallback(async () => {
    if (!eventId) return;
    try {
      const token = localStorage.getItem("token");
      
      // NOTA: Se o teu endpoint não for este, altera a linha abaixo (Ex: /api/Seat/event/${eventId})
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Event/${eventId}/seats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Falha ao carregar a lista de convidados.");
      
      const data = await res.json();
      console.log("Resposta da API (Convidados):", data); // Ajuda no debug

      // Mapeamento seguro para lidar com PascalCase do .NET (GuestName vs guestName)
      const mappedGuests = Array.isArray(data) ? data.map((g: any) => ({
        id: g.id || g.Id,
        guestName: g.guestName || g.GuestName || g.name || g.Name || "Sem Nome",
        category: g.category || g.Category || "",
        tableName: g.tableName || g.TableName || "",
        seatNumber: g.seatNumber || g.SeatNumber || "",
        status: g.status !== undefined ? g.status : (g.Status !== undefined ? g.Status : 0)
      })) : [];

      setGuests(mappedGuests);
      setFilteredGuests(mappedGuests);
    } catch (error: any) {
      console.error("Erro no fetchGuests:", error);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

  // Real-time updates via MQTT
  useEffect(() => {
    if (!eventId) return;
    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL as string, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME as string,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD as string,
    });
    client.on("connect", () => { client.subscribe(`seating/events/${eventId}/#`); });
    client.on("message", () => fetchGuests());
    return () => { client.end(); };
  }, [eventId, fetchGuests]);

  // Search Filter
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    setFilteredGuests(guests.filter(g => 
      g.guestName.toLowerCase().includes(query) || 
      g.tableName.toLowerCase().includes(query) ||
      g.category.toLowerCase().includes(query)
    ));
  }, [searchQuery, guests]);

  const openAddModal = () => {
    setModalMode("add");
    setFormData({ guestName: "", category: "", tableName: "", seatNumber: "" });
    setFormError(""); setShowModal(true);
  };

  const openEditModal = (guest: Guest) => {
    setModalMode("edit"); setEditingGuestId(guest.id);
    setFormData({ guestName: guest.guestName, category: guest.category, tableName: guest.tableName, seatNumber: guest.seatNumber });
    setFormError(""); setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true); setFormError("");
    try {
      const token = localStorage.getItem("token");
      const url = modalMode === "add" 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/Event/${eventId}/seats` 
        : `${process.env.NEXT_PUBLIC_API_URL}/api/Seat/${editingGuestId}`;
      const method = modalMode === "add" ? "POST" : "PUT";

      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error(`Erro ao ${modalMode === "add" ? "adicionar" : "atualizar"} convidado.`);
      
      setShowModal(false);
      setAlertDialog({ isOpen: true, title: "Sucesso", message: `Convidado ${modalMode === "add" ? "adicionado" : "atualizado"} com sucesso!`, type: 'success' });
      fetchGuests();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const promptDeleteGuest = (guestId: number, name: string) => {
    setConfirmDialog({
      isOpen: true, title: "Remover Convidado", message: `Tens a certeza que queres remover "${name}" da lista? Esta ação eliminará o bilhete permanentemente.`,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Seat/${guestId}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${token}` }
          });
          fetchGuests();
        } catch (error) { setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao apagar o convidado.", type: 'error' }); }
      }
    });
  };

  if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="w-full max-w-7xl mx-auto relative px-2 sm:px-4 lg:px-8">
      <button onClick={() => router.back()} className="inline-flex items-center text-slate-500 hover:text-purple-600 font-medium mb-8 transition-colors">
        <ChevronLeft className="w-5 h-5 mr-1" /> Voltar ao Evento
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3"><Users className="w-8 h-8 text-purple-600" /> Gestão de Convidados</h1>
          <p className="text-slate-500 mt-1">Gere individualmente a lista de convidados e adiciona walk-ins.</p>
        </div>
        <button onClick={openAddModal} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-purple-600/20">
          <UserPlus className="w-5 h-5" /> Adicionar Walk-in
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center bg-slate-50/50">
          <div className="relative w-full max-w-md">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Pesquisar por nome, mesa ou categoria..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500 outline-none transition-all" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-100 text-slate-500 text-sm">
                <th className="py-4 px-6 font-bold uppercase tracking-wider">Nome do Convidado</th>
                <th className="py-4 px-6 font-bold uppercase tracking-wider">Categoria</th>
                <th className="py-4 px-6 font-bold uppercase tracking-wider">Mesa / Lugar</th>
                <th className="py-4 px-6 font-bold uppercase tracking-wider">Estado</th>
                <th className="py-4 px-6 font-bold uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredGuests.length === 0 ? (
                <tr><td colSpan={5} className="py-12 text-center text-slate-500">Nenhum convidado encontrado.</td></tr>
              ) : (
                filteredGuests.map(guest => (
                  <tr key={guest.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900">{guest.guestName}</td>
                    <td className="py-4 px-6"><span className="inline-flex items-center px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-wider">{guest.category}</span></td>
                    <td className="py-4 px-6 text-slate-600 font-medium">{guest.tableName} <span className="text-slate-400">/</span> {guest.seatNumber}</td>
                    <td className="py-4 px-6">
                      {guest.status === 1 
                        ? <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md text-xs font-bold"><CheckCircle2 className="w-3.5 h-3.5"/> Validado</span> 
                        : <span className="inline-flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md text-xs font-bold"><Info className="w-3.5 h-3.5"/> Pendente</span>}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(guest)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => promptDeleteGuest(guest.id, guest.guestName)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">{modalMode === "add" ? "Adicionar Walk-in" : "Editar Convidado"}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 bg-white rounded-full p-1 shadow-sm"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div><label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo</label><input type="text" required value={formData.guestName} onChange={e => setFormData({...formData, guestName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" /></div>
              
              {/* Rótulo corrigido: Apenas "Categoria" */}
              <div><label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label><input type="text" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" /></div>
              
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Mesa / Fila</label><input type="text" required value={formData.tableName} onChange={e => setFormData({...formData, tableName: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" /></div>
                <div><label className="block text-sm font-bold text-slate-700 mb-1">Lugar</label><input type="text" required value={formData.seatNumber} onChange={e => setFormData({...formData, seatNumber: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 focus:ring-2 focus:ring-purple-500" /></div>
              </div>
              {formError && <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-xl flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0" /> {formError}</div>}
              <button type="submit" disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-all mt-4">{isSubmitting ? "A Guardar..." : "Guardar Convidado"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Global Dialogs */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl border border-white/50">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5"><AlertTriangle className="w-8 h-8" /></div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">{confirmDialog.title}</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3"><button onClick={() => setConfirmDialog(null)} className="flex-1 px-4 py-3.5 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200">Cancelar</button><button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }} className="flex-1 px-4 py-3.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800">Confirmar</button></div>
          </div>
        </div>
      )}
      
      {alertDialog && alertDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white/90 backdrop-blur-2xl rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl border border-white/50">
            {alertDialog.type === 'error' && <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex mx-auto items-center justify-center mb-5"><AlertTriangle className="w-8 h-8" /></div>}
            {alertDialog.type === 'success' && <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex mx-auto items-center justify-center mb-5"><CheckCircle2 className="w-8 h-8" /></div>}
            <h2 className="text-2xl font-black text-slate-900 mb-2">{alertDialog.title}</h2>
            <p className="text-slate-500 font-medium mb-8 leading-relaxed">{alertDialog.message}</p>
            <button onClick={() => setAlertDialog(null)} className="w-full px-4 py-3.5 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800">OK, Entendido</button>
          </div>
        </div>
      )}
    </div>
  );
}