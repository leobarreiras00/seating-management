"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, History, CalendarDays, ChevronRight, X, User, Activity, Database, CheckCircle, XCircle, Trash2, UploadCloud, Download, Loader2, ArrowDown, Filter, FileJson } from "lucide-react";
import mqtt from "mqtt";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

  const getActionStyles = (actionType: string) => {
    switch (actionType) {
      case "IMPORT_CSV": return { color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-200", icon: <UploadCloud className="w-4 h-4" /> };
      case "VALIDATE_SEAT":
      case "QR_VALIDATE": return { color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-200", icon: <CheckCircle className="w-4 h-4" /> };
      case "UNVALIDATE_SEAT": return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-200", icon: <XCircle className="w-4 h-4" /> };
      case "BULK_UPDATE": return { color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-200", icon: <Database className="w-4 h-4" /> };
      case "CLEAR_DB":
      case "DELETE_GUEST": return { color: "text-red-600", bg: "bg-red-500/10", border: "border-red-200", icon: <Trash2 className="w-4 h-4" /> };
      case "CREATE_GUEST": return { color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-200", icon: <User className="w-4 h-4" /> };
      case "UPDATE_GUEST": return { color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-200", icon: <Activity className="w-4 h-4" /> };
      default: return { color: "text-slate-600", bg: "bg-slate-500/10", border: "border-slate-200", icon: <Activity className="w-4 h-4" /> };
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

  const renderJsonDiff = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      if (data.Before || data.After) {
        return (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
              <h4 className="text-xs font-black text-red-600 uppercase mb-2 border-b border-red-100 pb-2">Estado Anterior</h4>
              <pre className="text-[11px] text-red-800 font-mono whitespace-pre-wrap">{JSON.stringify(data.Before, null, 2)}</pre>
            </div>
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
              <h4 className="text-xs font-black text-emerald-600 uppercase mb-2 border-b border-emerald-100 pb-2">Novo Estado</h4>
              <pre className="text-[11px] text-emerald-800 font-mono whitespace-pre-wrap">{JSON.stringify(data.After, null, 2)}</pre>
            </div>
          </div>
        );
      }
      return <pre className="text-[11px] text-slate-700 bg-slate-100 p-4 rounded-xl font-mono whitespace-pre-wrap mt-2">{JSON.stringify(data, null, 2)}</pre>;
    } catch (e) {
      return <p className="text-sm text-slate-500 italic mt-2">Nenhum dado estruturado disponível.</p>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pb-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <History className="w-8 h-8 text-purple-600" /> Auditoria de Eventos
        </h1>
        <p className="text-slate-500 mt-2 font-medium">Acompanha e monitoriza todas as ações executadas na base de dados de cada evento em tempo real.</p>
      </div>

      <div className="card-main p-4 flex items-center gap-3 mb-8">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Pesquisar por evento ou empresa..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:ring-0 text-slate-900 w-full placeholder:text-slate-400 font-medium"
        />
      </div>

      <div className="card-main p-6 sm:p-8 min-h-[50vh]">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Nenhum evento encontrado</h3>
            <p className="text-slate-500 mt-1">Ainda não existem eventos com registos de auditoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map(event => {
              const hasActivity = event.lastActivity && !event.lastActivity.startsWith("0001-01-01");

              return (
                /* ACESSIBILIDADE: Alterado de <div> para <button> para funcionar via TAB e ENTER */
                <button
                  type="button"
                  key={event.id}
                  onClick={() => openEventLogs(event)}
                  className="text-left w-full card-nested-pop hover:border-purple-300 hover:-translate-y-1 cursor-pointer group flex flex-col justify-between"
                >
                  <div className="p-6 w-full">
                    <div className="flex justify-end items-start mb-2">
                      <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1 line-clamp-1">{event.name}</h3>
                    <p className="text-sm font-semibold text-purple-600 mb-4">{event.companyName}</p>
                    <div className="space-y-2">
                      <div className="flex items-center text-sm text-slate-500">
                        <CalendarDays className="w-4 h-4 mr-2 shrink-0" />
                        {event.startDate ? new Date(event.startDate).toLocaleDateString('pt-PT') : "Sem data"}
                      </div>
                      <div className="flex items-center text-sm text-slate-500">
                        <Activity className="w-4 h-4 mr-2 shrink-0" />
                        {hasActivity 
                          ? `Última ação: ${new Date(event.lastActivity!).toLocaleDateString('pt-PT')}` 
                          : "Sem ações registadas"}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-slate-50/50 backdrop-blur-sm px-6 py-4 border-t border-slate-100 rounded-b-[1.5rem] flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-600">Total de Registos</span>
                    <span className="bg-purple-100 text-purple-700 py-1 px-3 rounded-xl text-sm font-extrabold">{event.totalLogs}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md">
          <div className="card-nested-pop w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200/50 flex justify-between items-center shrink-0 rounded-t-[1.5rem]">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Registos: {selectedEvent.name}</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">{selectedEvent.companyName}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportToPDF}
                  disabled={eventLogs.length === 0 || isLoadingLogs || isExporting}
                  className="flex items-center gap-2 bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isExporting ? 'A Gerar...' : 'Exportar PDF'}</span>
                </button>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-sm bg-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-slate-50 border-b border-slate-200/50 p-4 flex flex-wrap gap-4 shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-600">Filtros:</span>
              </div>
              <select 
                value={filterAction} 
                onChange={(e) => setFilterAction(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
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
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
              >
                <option value="ALL">Todos os Cargos</option>
                <option value="SuperAdmin">SuperAdmins</option>
                <option value="Gestor">Gestores</option>
                <option value="Utilizador">Staff / Validadores</option>
                <option value="Sistema">Ações de Sistema</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 rounded-b-[1.5rem]">
              {isLoadingLogs ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              ) : displayedLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <History className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium text-slate-500">Nenhum registo corresponde aos filtros aplicados.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200/60 ml-4 space-y-6 pb-4">
                  {displayedLogs.map((log) => {
                    const style = getActionStyles(log.actionType);
                    const logDate = new Date(log.timestamp);
                    const isUpdatable = log.actionType.includes("UPDATE");

                    return (
                      <div key={log.id} className="relative pl-6 group">
                        <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-slate-50 ${style.bg} ${style.color} flex items-center justify-center shadow-sm`}>
                          {style.icon}
                        </div>
                        
                        {/* ACESSIBILIDADE: Alterado de <div> para <button> para funcionar via TAB e ENTER */}
                        <button
                          type="button"
                          onClick={() => isUpdatable ? setSelectedLogDetails(log) : null}
                          disabled={!isUpdatable}
                          className={`text-left w-full bg-white p-5 rounded-[1.5rem] border border-slate-200/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all ${isUpdatable ? 'cursor-pointer hover:border-purple-300 hover:shadow-md' : 'cursor-default'}`}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <span className={`text-[11px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-xl border ${style.bg} ${style.color} ${style.border}`}>
                              {log.actionType.replace("_", " ")}
                            </span>
                            <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-xl">
                              {logDate.toLocaleDateString('pt-PT')} às {logDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          
                          <p className="text-slate-700 text-sm font-medium leading-relaxed my-3">
                            {log.description}
                          </p>

                          <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-3 border-t border-slate-50">
                            <div className="flex items-center">
                              <User className="w-4 h-4 mr-1.5" />
                              Por: <span className="text-slate-900 ml-1 bg-slate-100 px-2 py-0.5 rounded-lg">{log.performedBy}</span>
                              <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-black border ${
                                log.performedRole === 'SuperAdmin' ? 'bg-red-500/10 text-red-600 border-red-200' :
                                log.performedRole === 'Gestor' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                                log.performedRole === 'Utilizador' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                                'bg-slate-500/10 text-slate-600 border-slate-200'
                              }`}>
                                {log.performedRole || 'Sistema'}
                              </span>
                            </div>
                            
                            {isUpdatable && (
                              <span className="flex items-center gap-1 text-purple-600 bg-purple-50 px-2 py-1 rounded-lg">
                                <FileJson className="w-3.5 h-3.5" /> Ver Detalhes
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                  {hasMore && displayedLogs.length > 0 && (
                    <div className="pt-6 pb-2 flex justify-center pl-6">
                      <button
                        type="button"
                        onClick={loadMoreLogs}
                        disabled={isLoadingMore}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-slate-600 hover:text-purple-600 rounded-2xl font-bold text-sm shadow-sm transition-all"
                      >
                        {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
                        {isLoadingMore ? 'A Carregar...' : 'Ver Registos Anteriores'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedLogDetails && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="card-nested-pop w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0 rounded-t-[1.5rem]">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <FileJson className="w-5 h-5 text-purple-600" /> Detalhes da Alteração (Diff)
              </h3>
              <button
                type="button"
                onClick={() => setSelectedLogDetails(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white shadow-sm transition-colors border border-transparent hover:border-slate-200 bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-white flex-1 rounded-b-[1.5rem]">
              <p className="text-sm font-medium text-slate-600 mb-4">{selectedLogDetails.description}</p>
              
              {selectedLogDetails.payloadJson ? (
                renderJsonDiff(selectedLogDetails.payloadJson)
              ) : (
                <p className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  Nenhum dado estruturado guardado para este registo.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}