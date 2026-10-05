"use client";

/**
 * Gestão de Convidados de um evento.
 *   - Dados/lógica: inalterados (fetch /api/Seat/{eventId}, MQTT em tempo real,
 *     ordenação, pesquisa, CRUD de walk-ins e exportação CSV).
 *   - Visual: cabeçalho com ligação de volta e chips de estatística, tabela de
 *     vidro com cabeçalho fixo, etiquetas de estado e botões de ícone,
 *     modais/diálogos através dos componentes de `components/ui`.
 */

import { useEffect, useState, useCallback, useMemo, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Search, Edit2, Trash2, AlertTriangle, CheckCircle2, Info, Users, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Download, Clock3, Ticket } from "lucide-react";
import mqtt from "mqtt";
import Modal from "@/components/ui/Modal";
import AlertDialog from "@/components/ui/AlertDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

interface Guest {
  id: number;
  guestName: string;
  category: string;
  tableName: string;
  seatNumber: string;
  status: number;
}

type SortColumn = "guestName" | "category" | "tableName" | "status";
type SortDirection = "asc" | "desc";

function ManageGuestsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const eventId = params.eventId as string;
  const companyId = searchParams.get("companyId");

  const [guests, setGuests] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // States de ordenação
  const [sortColumn, setSortColumn] = useState<SortColumn>("guestName");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Liquid Glass Dialogs
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean, title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);

  // Modals for CRUD
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({ guestName: "", category: "", tableName: "", seatNumber: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchGuests = useCallback(async () => {
    if (!eventId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Seat/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Falha ao carregar a lista de convidados.");
      
      const data = await res.json();

      const mappedGuests = Array.isArray(data) ? data.map((g: any) => {
        const seatNumFull = g.seatNumber || g.SeatNumber || "";
        const [table, seat] = seatNumFull.includes('-') ? seatNumFull.split('-') : [seatNumFull, ""];

        return {
          id: g.id || g.Id,
          guestName: g.assignedTo || g.AssignedTo || "Sem Nome",
          category: g.eventName || g.EventName || "",
          tableName: table,
          seatNumber: seat,
          status: g.status !== undefined ? g.status : (g.Status !== undefined ? g.Status : 0)
        };
      }) : [];

      setGuests(mappedGuests);
    } catch (error: any) {
      console.error("Erro no fetchGuests:", error);
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => { fetchGuests(); }, [fetchGuests]);

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

  // Handle Sort Click
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Render Sort Icon
  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 ml-1.5" />;
    return sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 text-purple-600 ml-1.5" /> : <ArrowDown className="w-3.5 h-3.5 text-purple-600 ml-1.5" />;
  };

  // Filter and Sort Data
  const processedGuests = useMemo(() => {
    let filtered = guests.filter(g => 
      g.guestName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      g.tableName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return filtered.sort((a, b) => {
      let valueA: string | number = a[sortColumn];
      let valueB: string | number = b[sortColumn];

      if (typeof valueA === "string") valueA = valueA.toLowerCase();
      if (typeof valueB === "string") valueB = valueB.toLowerCase();

      if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
      if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [guests, searchQuery, sortColumn, sortDirection]);

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
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/Seat/event/${eventId}/walkin` 
        : `${process.env.NEXT_PUBLIC_API_URL}/api/Seat/${editingGuestId}/edit`;
      const method = modalMode === "add" ? "POST" : "PUT";

      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData)
      });
      
      const responseData = await res.json().catch(() => null);
      if (!res.ok) throw new Error(responseData?.Message || responseData?.message || `Erro ao ${modalMode === "add" ? "adicionar" : "atualizar"} convidado.`);
      
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
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Seat/${guestId}`, {
            method: "DELETE", headers: { Authorization: `Bearer ${token}` }
          });
          
          if (!res.ok) throw new Error("Erro ao apagar");
          
          fetchGuests();
        } catch (error) { 
          setAlertDialog({ isOpen: true, title: "Erro", message: "Ocorreu um erro ao apagar o convidado.", type: 'error' }); 
        }
      }
    });
  };

  const handleExportCsv = () => {
    if (guests.length === 0) {
      setAlertDialog({ isOpen: true, title: "Lista Vazia", message: "Não existem convidados para exportar.", type: 'info' });
      return;
    }

    let csvContent = "MESA;LUGAR;CATEGORIA;NOME;ESTADO\n";
    guests.forEach((g) => {
      const status = g.status === 1 ? "Validado" : "Pendente";
      csvContent += `"${g.tableName}";"${g.seatNumber}";"${g.category}";"${g.guestName}";"${status}"\n`;
    });

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Lista_Convidados_Evento_${eventId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGoBack = () => {
    if (companyId) {
      router.push(`/companies/${companyId}?tab=eventos`);
    } else {
      router.back();
    }
  };

  // Ecrã de carregamento
  if (isLoading) return <div className="flex justify-center p-20"><div className="spinner"></div></div>;

  // Cabeçalhos de coluna ordenáveis (cada um chama o mesmo handleSort)
  const thSort = "py-3.5 px-4 sm:px-6 font-bold cursor-pointer hover:bg-purple-100/60 hover:text-purple-700 transition-colors whitespace-nowrap";

  return (
    <div className="w-full max-w-7xl mx-auto relative px-4 sm:px-6 lg:px-8 pb-10">
      {/* --- LIGAÇÃO DE VOLTA --- */}
      <button onClick={handleGoBack} className="reveal btn btn-ghost btn-sm mb-5 -ml-2">
        <ChevronLeft className="w-4 h-4" /> Voltar ao Evento
      </button>

      {/* --- CABEÇALHO DA PÁGINA --- */}
      <PageHeader
        icon={<Users className="w-6 h-6" />}
        title={<span className="text-gradient">Gestão de Convidados</span>}
        description="Gere individualmente a lista de convidados e adiciona walk-ins."
        actions={
          <>
            <button onClick={handleExportCsv} className="btn btn-white">
              <Download className="w-4 h-4" /> Exportar CSV
            </button>
            <button onClick={openAddModal} className="btn btn-primary">
              <UserPlus className="w-4 h-4" /> Adicionar Walk-in
            </button>
          </>
        }
      />

      {/* --- CHIPS DE ESTATÍSTICA (derivados da lista já carregada) --- */}
      <div className="stagger grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="card-nested-pop card-lift flex items-center gap-4 p-4">
          <div className="w-11 h-11 rounded-2xl bg-[image:var(--grad-brand)] text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30"><Ticket className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-900 tabular leading-none">{guests.length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Convidados</p>
          </div>
        </div>
        <div className="card-nested-pop card-lift flex items-center gap-4 p-4">
          <div className="w-11 h-11 rounded-2xl bg-[image:var(--grad-emerald)] text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30"><CheckCircle2 className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-900 tabular leading-none">{guests.filter(g => g.status === 1).length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Validados</p>
          </div>
        </div>
        <div className="card-nested-pop card-lift flex items-center gap-4 p-4">
          <div className="w-11 h-11 rounded-2xl bg-[image:var(--grad-amber)] text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/30"><Clock3 className="w-5 h-5" /></div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-900 tabular leading-none">{guests.length - guests.filter(g => g.status === 1).length}</p>
            <p className="text-xs font-semibold text-slate-500 mt-1">Pendentes</p>
          </div>
        </div>
      </div>

      {/* --- PESQUISA --- */}
      <div className="reveal search-bar max-w-xl mb-5" style={{ ["--i" as string]: 2 }}>
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input type="text" placeholder="Pesquisar por nome, mesa ou categoria..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {/* --- TABELA DE CONVIDADOS (vidro, cabeçalho fixo, scroll interno em ecrãs pequenos) --- */}
      {processedGuests.length === 0 ? (
        <EmptyState
          title="Nenhum convidado encontrado."
          description="Ajusta a pesquisa ou adiciona um walk-in à lista."
          action={<button onClick={openAddModal} className="btn btn-primary btn-sm"><UserPlus className="w-4 h-4" /> Adicionar Walk-in</button>}
        />
      ) : (
      <div className="reveal card-main overflow-hidden" style={{ ["--i" as string]: 3 }}>
        <div className="overflow-auto max-h-[65vh] custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[720px]">
            <thead className="sticky top-0 z-10">
              <tr className="text-slate-500 text-xs uppercase tracking-wider select-none [&>th]:bg-purple-50/95 [&>th]:backdrop-blur [&>th]:border-b [&>th]:border-purple-100">
                <th onClick={() => handleSort("guestName")} className={thSort}>
                  <div className="flex items-center">Nome do Convidado {renderSortIcon("guestName")}</div>
                </th>
                <th onClick={() => handleSort("category")} className={thSort}>
                  <div className="flex items-center">Categoria {renderSortIcon("category")}</div>
                </th>
                <th onClick={() => handleSort("tableName")} className={thSort}>
                  <div className="flex items-center">Mesa / Lugar {renderSortIcon("tableName")}</div>
                </th>
                <th onClick={() => handleSort("status")} className={thSort}>
                  <div className="flex items-center">Estado {renderSortIcon("status")}</div>
                </th>
                <th className="py-3.5 px-4 sm:px-6 font-bold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {processedGuests.map(guest => (
                  <tr key={guest.id} className="hover:bg-purple-50/70 transition-colors border-b border-purple-100/60 last:border-0">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-slate-900">{guest.guestName}</td>
                    <td className="py-3.5 px-4 sm:px-6"><span className="badge badge-purple">{guest.category}</span></td>
                    <td className="py-3.5 px-4 sm:px-6 text-slate-600 font-semibold tabular whitespace-nowrap">{guest.tableName} <span className="text-purple-300">/</span> {guest.seatNumber}</td>
                    <td className="py-3.5 px-4 sm:px-6">
                      {guest.status === 1
                        ? <span className="badge badge-green"><CheckCircle2 className="w-3.5 h-3.5"/> Validado</span>
                        : <span className="badge badge-amber"><Info className="w-3.5 h-3.5"/> Pendente</span>}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openEditModal(guest)} className="icon-btn icon-btn-blue" aria-label={`Editar ${guest.guestName}`}><Edit2 className="w-4 h-4" /></button>
                        <button type="button" onClick={() => promptDeleteGuest(guest.id, guest.guestName)} className="icon-btn icon-btn-red" aria-label={`Remover ${guest.guestName}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* --- MODAL: ADICIONAR / EDITAR CONVIDADO --- */}
      {showModal && (
        <Modal
          onClose={() => setShowModal(false)}
          title={modalMode === "add" ? "Adicionar Walk-in" : "Editar Convidado"}
          subtitle="Preenche os dados do convidado e do lugar"
          icon={modalMode === "add" ? <UserPlus className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
          size="md"
          tone={modalMode === "add" ? "emerald" : "blue"}
          footer={
            <button type="submit" form="guest-form" disabled={isSubmitting} className="btn btn-primary btn-lg btn-block">{isSubmitting ? "A Guardar..." : "Guardar Convidado"}</button>
          }
        >
          <form id="guest-form" onSubmit={handleSubmit} className="space-y-4">
            <div><label className="field-label">Nome Completo</label><input type="text" required value={formData.guestName} onChange={e => setFormData({...formData, guestName: e.target.value})} className="input" /></div>
            <div><label className="field-label">Categoria</label><input type="text" required value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="input" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="field-label">Mesa / Fila</label><input type="text" required value={formData.tableName} onChange={e => setFormData({...formData, tableName: e.target.value})} className="input" /></div>
              <div><label className="field-label">Lugar</label><input type="text" required value={formData.seatNumber} onChange={e => setFormData({...formData, seatNumber: e.target.value})} className="input" /></div>
            </div>
            {formError && <div className="notice notice-error"><AlertTriangle className="w-5 h-5" /> <span>{formError}</span></div>}
          </form>
        </Modal>
      )}

      {/* --- DIÁLOGOS GLOBAIS (confirmação e aviso) --- */}
      {confirmDialog && confirmDialog.isOpen && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
        />
      )}

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

export default function ManageGuestsPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><div className="spinner"></div></div>}>
      <ManageGuestsContent />
    </Suspense>
  );
}
