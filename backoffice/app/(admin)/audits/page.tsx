"use client";

/**
 * Auditoria de Eventos — histórico de ações feitas na base de dados de cada evento.
 *
 * Estrutura da página:
 *   1. Cabeçalho (PageHeader) e pesquisa por evento / empresa.
 *   2. Grelha de "bilhetes": um cartão por evento (cor rotativa), com o total de registos
 *      na ponta picotada.
 *   3. Modal de registos do evento: filtros (ação / cargo), linha temporal com pontos
 *      coloridos por tipo de ação, paginação ("Ver Registos Anteriores") e exportação PDF.
 *   4. Modal de detalhes (diff antes/depois) para registos do tipo UPDATE.
 *
 * Dados: GET /api/Audit/events-overview e GET /api/Audit/event/{id} → { logs, totalLogs }.
 * Em tempo real: qualquer mensagem MQTT em `seating/events/#` ou `seating/backoffice/#`
 * volta a carregar os dados. Toda esta lógica é a original; só o aspeto mudou.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, History, CalendarDays, ChevronRight, User, Activity, Database, CheckCircle, XCircle, Trash2, UploadCloud, Download, Loader2, ArrowDown, Filter, FileJson, Minus, Plus } from "lucide-react";
import mqtt from "mqtt";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

// Cores rotativas das faixas dos bilhetes de evento (escolhidas por id do evento)
const EVENT_TONES = [
  "bg-[image:var(--grad-brand)]",
  "bg-[image:var(--grad-blue)]",
  "bg-[image:var(--grad-emerald)]",
  "bg-[image:var(--grad-amber)]",
];

interface EventOverview {
  id: number;
  name: string;
  companyName: string;
  companyLogo?: string;
  startDate: string | null;
  totalLogs: number;
  lastActivity: string | null;
}

interface AuditLog {
  id: number;
  eventId: number | null;
  actionType: string;
  description: string;
  performedBy: string;
  performedRole: string;
  timestamp: string;
  payloadJson?: string | null; 
}

export default function AuditsPage() {
  const [events, setEvents] = useState<EventOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<EventOverview | null>(null);
  const [eventLogs, setEventLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const selectedEventIdRef = useRef<number | null>(null);

  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [filterRole, setFilterRole] = useState<string>("ALL");

  const [selectedLogDetails, setSelectedLogDetails] = useState<AuditLog | null>(null);

  useEffect(() => {
    selectedEventIdRef.current = selectedEvent?.id || null;
  }, [selectedEvent]);

  const fetchEventsOverview = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Audit/events-overview?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store'
      });

      if (res.ok) {
        setEvents(await res.json());
      }
    } catch (error) {
      console.error("Erro ao carregar a overview de auditoria:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEventLogs = async (eventId: number, pageNumber = 1) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Audit/event/${eventId}?page=${pageNumber}&pageSize=50&t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        if (pageNumber === 1) {
          setEventLogs(data.logs);
        } else {
          setEventLogs(prev => [...prev, ...data.logs]);
        }
        setHasMore(data.totalLogs > data.logs.length + (pageNumber - 1) * 50);
        setPage(pageNumber);
      }
    } catch (error) {
      console.error("Erro ao carregar logs do evento:", error);
    }
  };

  useEffect(() => {
    fetchEventsOverview();

    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL as string, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME as string,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD as string,
    });

    client.on("connect", () => {
      client.subscribe("seating/events/#");
      client.subscribe("seating/backoffice/#");
    });

    client.on("message", () => {
      fetchEventsOverview();
      if (selectedEventIdRef.current) {
        fetchEventLogs(selectedEventIdRef.current, 1);
      }
    });

    return () => { client.end(); };
  }, [fetchEventsOverview]);

  const openEventLogs = async (event: EventOverview) => {
    setSelectedEvent(event);
    setFilterAction("ALL");
    setFilterRole("ALL");
    setIsLoadingLogs(true);
    setEventLogs([]);
    await fetchEventLogs(event.id, 1);
    setIsLoadingLogs(false);
  };

  const loadMoreLogs = async () => {
    if (!selectedEvent) return;
    setIsLoadingMore(true);
    await fetchEventLogs(selectedEvent.id, page + 1);
    setIsLoadingMore(false);
  };

  const getBase64ImageFromURL = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      fetch(url, { cache: 'no-cache' })
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      })
      .catch(reject);
    });
  };

  const exportToPDF = async () => {
    if (!selectedEvent) return;
    setIsExporting(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Audit/event/${selectedEvent.id}?page=1&pageSize=100000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      const logsToExport = data.logs;

      if(logsToExport.length === 0) {
        setIsExporting(false);
        return;
      }

      const doc = new jsPDF();
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, 15, 182, 30, 5, 5, 'F');
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(14, 14, 182, 30, 5, 5, 'FD');

      let logoDrawn = false;
      if (selectedEvent.companyLogo) {
        try {
          const logoUrl = selectedEvent.companyLogo.startsWith('http')
            ? selectedEvent.companyLogo
            : `${process.env.NEXT_PUBLIC_API_URL}${selectedEvent.companyLogo}`;
          const base64Img = await getBase64ImageFromURL(logoUrl);
          doc.addImage(base64Img, "PNG", 18, 18, 22, 22);
          logoDrawn = true;
        } catch (e) {
          console.warn("Falha ao converter logótipo.", e);
        }
      }

      if (!logoDrawn) {
        const initials = selectedEvent.companyName
          .split(' ')
          .map(n => n[0])
          .join('')
          .substring(0, 2)
          .toUpperCase();
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(18, 18, 22, 22, 4, 4, 'F');
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        doc.text(initials, 29, 30.5, { align: "center" });
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("Seatly • Relatório de Auditoria", 46, 25);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Empresa: ${selectedEvent.companyName} | Evento: ${selectedEvent.name} (ID #${selectedEvent.id})`, 46, 31);
      doc.text(`Registos: ${logsToExport.length} | Emitido a: ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT', {hour: '2-digit', minute: '2-digit'})}`, 46, 36.5);

      const tableColumn = ["Data e Hora", "Ação", "Descrição", "Utilizador", "Cargo"];
      const tableRows = logsToExport.map((log: any) => {
        const date = new Date(log.timestamp);
        return [
          `${date.toLocaleDateString('pt-PT')}\n${date.toLocaleTimeString('pt-PT')}`,
          log.actionType.replace("_", " "),
          log.description,
          log.performedBy,
          log.performedRole || "Sistema"
        ];
      });

      autoTable(doc, {
        startY: 52,
        head: [tableColumn],
        body: tableRows,
        theme: 'plain',
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'left',
          valign: 'middle',
          cellPadding: 5
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [51, 65, 85],
          cellPadding: 5,
          lineColor: [241, 245, 249],
          lineWidth: { bottom: 0.5 },
          halign: 'left',
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 35 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 28 },
          4: { cellWidth: 22 },
        },
        alternateRowStyles: { fillColor: [255, 255, 255] }
      });

      const fileName = `Auditoria_${selectedEvent.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Erro a gerar o PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Estilos por tipo de ação (vivos: pílula e ponto em degradê com texto branco).
  // create = verde, update = âmbar, delete = vermelho, import = azul, bulk = roxo.
  const getActionStyles = (actionType: string) => {
    switch (actionType) {
      case "IMPORT_CSV": return { color: "text-white", bg: "bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/40", border: "border-blue-300", icon: <UploadCloud className="w-4 h-4" /> };
      case "VALIDATE_SEAT":
      case "QR_VALIDATE": return { color: "text-white", bg: "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/40", border: "border-emerald-300", icon: <CheckCircle className="w-4 h-4" /> };
      case "UNVALIDATE_SEAT": return { color: "text-white", bg: "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/40", border: "border-rose-300", icon: <XCircle className="w-4 h-4" /> };
      case "BULK_UPDATE": return { color: "text-white", bg: "bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/40", border: "border-purple-300", icon: <Database className="w-4 h-4" /> };
      case "CLEAR_DB":
      case "DELETE_GUEST": return { color: "text-white", bg: "bg-gradient-to-br from-red-500 to-red-700 shadow-red-500/40", border: "border-red-300", icon: <Trash2 className="w-4 h-4" /> };
      case "CREATE_GUEST": return { color: "text-white", bg: "bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/40", border: "border-emerald-300", icon: <User className="w-4 h-4" /> };
      case "UPDATE_GUEST": return { color: "text-white", bg: "bg-gradient-to-br from-amber-400 to-orange-500 shadow-amber-500/40", border: "border-amber-300", icon: <Activity className="w-4 h-4" /> };
      default: return { color: "text-white", bg: "bg-gradient-to-br from-slate-400 to-slate-600 shadow-slate-500/30", border: "border-slate-300", icon: <Activity className="w-4 h-4" /> };
    }
  };

  const filteredEvents = events.filter(e =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayedLogs = eventLogs.filter(log => {
    const matchAction = filterAction === "ALL" || log.actionType.includes(filterAction);
    const matchRole = filterRole === "ALL" || log.performedRole === filterRole;
    return matchAction && matchRole;
  });

  // Renderiza o diff antes/depois: bloco vermelho (anterior) e verde (novo).
  const renderJsonDiff = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.Before || data.After) {
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 min-w-0">
              <h4 className="text-xs font-bold text-red-600 mb-3 pb-2 border-b border-red-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-[image:var(--grad-red)] text-white flex items-center justify-center"><Minus className="w-3 h-3" /></span> Estado Anterior
              </h4>
              <pre className="text-[11px] text-red-800 font-mono whitespace-pre-wrap break-words">{JSON.stringify(data.Before, null, 2)}</pre>
            </div>
            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 min-w-0">
              <h4 className="text-xs font-bold text-emerald-600 mb-3 pb-2 border-b border-emerald-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-lg bg-[image:var(--grad-emerald)] text-white flex items-center justify-center"><Plus className="w-3 h-3" /></span> Novo Estado
              </h4>
              <pre className="text-[11px] text-emerald-800 font-mono whitespace-pre-wrap break-words">{JSON.stringify(data.After, null, 2)}</pre>
            </div>
          </div>
        );
      }
      return <pre className="text-[11px] text-slate-700 bg-slate-100 border border-slate-200 p-4 rounded-2xl font-mono whitespace-pre-wrap break-words mt-2">{JSON.stringify(data, null, 2)}</pre>;
    } catch (e) {
      return <p className="text-sm text-slate-500 italic mt-2">Nenhum dado estruturado disponível.</p>;
    }
  };

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
        icon={<History className="w-6 h-6" />}
        title="Auditoria de Eventos"
        description="Acompanha e monitoriza todas as ações executadas na base de dados de cada evento em tempo real."
      />

      {/* ───────────── Pesquisa ───────────── */}
      <div className="reveal search-bar mb-6 lg:mb-8" style={{ "--i": 1 } as React.CSSProperties}>
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Pesquisar por evento ou empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Pesquisar eventos"
        />
      </div>

      {/* ───────────── Grelha de bilhetes (um por evento) ───────────── */}
      {filteredEvents.length === 0 ? (
        <EmptyState title="Nenhum evento encontrado" description="Ainda não existem eventos com registos de auditoria." />
      ) : (
        <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {filteredEvents.map(event => {
            const hasActivity = event.lastActivity && !event.lastActivity.startsWith("0001-01-01");
            const tone = EVENT_TONES[event.id % EVENT_TONES.length];

            return (
              /* ACESSIBILIDADE: Alterado de <div> para <button> para funcionar via TAB e ENTER */
              <button
                type="button"
                key={event.id}
                onClick={() => openEventLogs(event)}
                // A linha picotada fica 4.25rem acima da base (altura fixa do "talão")
                style={{ "--ticket-cut": "calc(100% - 4.25rem)" } as React.CSSProperties}
                className="ticket card-nested-pop card-lift text-left w-full cursor-pointer group flex flex-col"
              >
                {/* Faixa colorida: empresa + seta */}
                <div className={`relative overflow-hidden rounded-t-[1.5rem] px-5 py-3.5 flex items-center justify-between gap-3 text-white ${tone}`}>
                  <div aria-hidden className="absolute -right-6 -top-8 w-24 h-24 rounded-full bg-white/25 blur-xl" />
                  <p className="relative text-sm font-bold truncate">{event.companyName}</p>
                  <ChevronRight className="relative w-5 h-5 shrink-0 text-white/80 group-hover:translate-x-1 transition-transform" />
                </div>

                {/* Corpo: nome, data e última ação */}
                <div className="p-5 pb-4 w-full flex-1">
                  <h3 className="text-xl font-bold text-slate-900 mb-3 line-clamp-1">{event.name}</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-slate-500">
                      <CalendarDays className="w-4 h-4 mr-2 shrink-0 text-purple-500" />
                      {event.startDate ? new Date(event.startDate).toLocaleDateString('pt-PT') : "Sem data"}
                    </div>
                    <div className="flex items-center text-sm text-slate-500">
                      <Activity className="w-4 h-4 mr-2 shrink-0 text-emerald-500" />
                      {hasActivity 
                        ? `Última ação: ${new Date(event.lastActivity!).toLocaleDateString('pt-PT')}` 
                        : "Sem ações registadas"}
                    </div>
                  </div>
                </div>

                {/* Linha picotada + talão com o total de registos */}
                <div className="ticket-cut" />
                <div className="w-full h-[4.25rem] px-5 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600">Total de Registos</span>
                  <span className="badge badge-purple !text-sm !px-3.5 tabular">{event.totalLogs}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ───────────── Modal: registos do evento (filtros + linha temporal) ───────────── */}
      {selectedEvent && (
        <Modal
          onClose={() => setSelectedEvent(null)}
          title={`Registos: ${selectedEvent.name}`}
          subtitle={selectedEvent.companyName}
          icon={<History className="w-5 h-5" />}
          size="2xl"
          footer={
            <div className="flex items-center justify-between gap-3">
              <span className="badge badge-purple">{displayedLogs.length} registos</span>
              <button
                type="button"
                onClick={exportToPDF}
                disabled={eventLogs.length === 0 || isLoadingLogs || isExporting}
                className="btn btn-primary"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{isExporting ? 'A Gerar...' : 'Exportar PDF'}</span>
              </button>
            </div>
          }
        >
          {/* Filtros (fixos no topo da área com scroll) */}
          <div className="sticky top-0 z-10 -mx-6 -mt-6 mb-6 px-6 py-4 bg-white/90 backdrop-blur border-b border-[var(--line)] flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-bold text-slate-600">Filtros:</span>
            </div>
            <select 
              value={filterAction} 
              onChange={(e) => setFilterAction(e.target.value)}
              className="input !w-auto !py-2 !text-sm"
              aria-label="Filtrar por ação"
            >
              <option value="ALL">Todas as Ações</option>
              <option value="VALIDATE">Validações</option>
              <option value="IMPORT">Importações</option>
              <option value="UPDATE">Atualizações</option>
              <option value="CREATE">Criações</option>
              <option value="DELETE">Remoções</option>
            </select>

            <select 
              value={filterRole} 
              onChange={(e) => setFilterRole(e.target.value)}
              className="input !w-auto !py-2 !text-sm"
              aria-label="Filtrar por cargo"
            >
              <option value="ALL">Todos os Cargos</option>
              <option value="SuperAdmin">SuperAdmins</option>
              <option value="Gestor">Gestores</option>
              <option value="Utilizador">Staff / Validadores</option>
              <option value="Sistema">Ações de Sistema</option>
            </select>
          </div>

          {isLoadingLogs ? (
            <div className="flex justify-center items-center py-20" role="status" aria-label="A carregar">
              <div className="spinner" />
            </div>
          ) : displayedLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History className="w-12 h-12 mb-3 text-purple-300 float-slow" />
              <p className="font-medium text-slate-500">Nenhum registo corresponde aos filtros aplicados.</p>
            </div>
          ) : (
            /* Linha temporal: trilho à esquerda, um ponto colorido por registo */
            <div className="stagger relative border-l-2 border-purple-200 ml-4 space-y-5 pb-2">
              {displayedLogs.map((log) => {
                const style = getActionStyles(log.actionType);
                const logDate = new Date(log.timestamp);
                const isUpdatable = log.actionType.includes("UPDATE");

                return (
                  <div key={log.id} className="relative pl-7 group">
                    {/* Ponto da linha temporal (cor do tipo de ação) */}
                    <div className={`absolute -left-[19px] top-1 w-9 h-9 rounded-full ring-4 ring-white ${style.bg} ${style.color} flex items-center justify-center shadow-lg`}>
                      {style.icon}
                    </div>
                    
                    {/* ACESSIBILIDADE: Alterado de <div> para <button> para funcionar via TAB e ENTER */}
                    <button
                      type="button"
                      onClick={() => isUpdatable ? setSelectedLogDetails(log) : null}
                      disabled={!isUpdatable}
                      className={`card-nested-pop relative overflow-hidden text-left w-full p-4 sm:p-5 pl-5 sm:pl-6 ${isUpdatable ? 'card-lift cursor-pointer' : 'cursor-default'}`}
                    >
                      {/* Barra de cor do tipo de ação */}
                      <span aria-hidden className={`absolute left-0 inset-y-0 w-1.5 ${style.bg}`} />

                      <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full border shadow-md ${style.bg} ${style.color} ${style.border}`}>
                          {log.actionType.replace("_", " ")}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full tabular">
                          {logDate.toLocaleDateString('pt-PT')} às {logDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      
                      <p className="text-slate-700 text-sm font-medium leading-relaxed my-3 break-words">
                        {log.description}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500 pt-3 border-t border-slate-100">
                        <div className="flex flex-wrap items-center gap-y-1.5">
                          <User className="w-4 h-4 mr-1.5" />
                          Por: <span className="text-slate-900 ml-1 bg-slate-100 px-2 py-0.5 rounded-lg">{log.performedBy}</span>
                          <span className={`badge ml-2 !py-0.5 !text-[11px] ${
                            log.performedRole === 'SuperAdmin' ? 'badge-red' :
                            log.performedRole === 'Gestor' ? 'badge-blue' :
                            log.performedRole === 'Utilizador' ? 'badge-green' :
                            'badge-slate'
                          }`}>
                            {log.performedRole || 'Sistema'}
                          </span>
                        </div>
                        
                        {isUpdatable && (
                          <span className="badge badge-purple">
                            <FileJson className="w-3.5 h-3.5" /> Ver Detalhes
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
              {hasMore && displayedLogs.length > 0 && (
                <div className="pt-4 pb-2 flex justify-center pl-6">
                  <button
                    type="button"
                    onClick={loadMoreLogs}
                    disabled={isLoadingMore}
                    className="btn btn-soft"
                  >
                    {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
                    {isLoadingMore ? 'A Carregar...' : 'Ver Registos Anteriores'}
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ───────────── Modal: detalhes da alteração (diff) ───────────── */}
      {selectedLogDetails && (
        <Modal
          onClose={() => setSelectedLogDetails(null)}
          title="Detalhes da Alteração (Diff)"
          subtitle={selectedLogDetails.actionType.replace("_", " ")}
          icon={<FileJson className="w-5 h-5" />}
          tone="blue"
          size="xl"
          layer="dialog"
        >
          <p className="notice notice-info mb-4">{selectedLogDetails.description}</p>
          
          {selectedLogDetails.payloadJson ? (
            renderJsonDiff(selectedLogDetails.payloadJson)
          ) : (
            <p className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-2xl text-center border border-slate-100">
              Nenhum dado estruturado guardado para este registo.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
