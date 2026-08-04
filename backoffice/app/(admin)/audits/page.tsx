"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, History, CalendarDays, ChevronRight, X, User, Activity, Database, CheckCircle, XCircle, Trash2, UploadCloud, Download, Loader2 } from "lucide-react";
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
}

export default function AuditsPage() {
  const [events, setEvents] = useState<EventOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedEvent, setSelectedEvent] = useState<EventOverview | null>(null);
  const [eventLogs, setEventLogs] = useState<AuditLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const selectedEventIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedEventIdRef.current = selectedEvent?.id || null;
  }, [selectedEvent]);

  const fetchEventsOverview = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`http://localhost:5162/api/Audit/events-overview?t=${Date.now()}`, {
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

  const fetchEventLogs = async (eventId: number) => {
    try {
      const token = localStorage.getItem("token");
      
      const res = await fetch(`http://localhost:5162/api/Audit/event/${eventId}?t=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        cache: 'no-store'
      });

      if (res.ok) {
        setEventLogs(await res.json());
      }
    } catch (error) {
      console.error("Erro ao carregar logs do evento:", error);
    }
  };

  useEffect(() => {
    fetchEventsOverview();

    const client = mqtt.connect("ws://localhost:9001"); 
    client.on("connect", () => {
      client.subscribe("seating/events/#");
      client.subscribe("seating/backoffice/#");
    });

    client.on("message", () => {
      fetchEventsOverview();
      if (selectedEventIdRef.current) {
        fetchEventLogs(selectedEventIdRef.current);
      }
    });

    return () => { client.end(); };
  }, [fetchEventsOverview]);

  const openEventLogs = async (event: EventOverview) => {
    setSelectedEvent(event);
    setIsLoadingLogs(true);
    setEventLogs([]);
    await fetchEventLogs(event.id);
    setIsLoadingLogs(false);
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
    if (!selectedEvent || eventLogs.length === 0) return;
    setIsExporting(true);

    try {
      const doc = new jsPDF();

      // SOMBRA DO CABEÇALHO (Ilusão de Liquid Glass)
      doc.setFillColor(241, 245, 249); 
      doc.roundedRect(15, 15, 182, 30, 5, 5, 'F'); 

      // CABEÇALHO PRINCIPAL
      doc.setFillColor(255, 255, 255); 
      doc.setDrawColor(226, 232, 240); 
      doc.setLineWidth(0.3);
      doc.roundedRect(14, 14, 182, 30, 5, 5, 'FD'); 

      // LOGÓTIPO OU INICIAIS
      let logoDrawn = false;
      
      if (selectedEvent.companyLogo) {
        try {
          const logoUrl = selectedEvent.companyLogo.startsWith('http')
            ? selectedEvent.companyLogo
            : `http://localhost:5162${selectedEvent.companyLogo}`;

          const base64Img = await getBase64ImageFromURL(logoUrl);
          
          doc.addImage(base64Img, "PNG", 18, 18, 22, 22);
          logoDrawn = true;
        } catch (e) {
          console.warn("Falha ao converter logótipo. A avançar para as iniciais.", e);
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

      // TEXTOS DO CABEÇALHO
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); 
      doc.text("Seatly  •  Relatório de Auditoria", 46, 25);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); 
      doc.text(`Empresa: ${selectedEvent.companyName}   |   Evento: ${selectedEvent.name} (ID #${selectedEvent.id})`, 46, 31);
      doc.text(`Registos: ${eventLogs.length}   |   Emitido a: ${new Date().toLocaleDateString('pt-PT')} às ${new Date().toLocaleTimeString('pt-PT', {hour: '2-digit', minute: '2-digit'})}`, 46, 36.5);

      // TABELA ALINHADA MILIMETRICAMENTE
      const tableColumn = ["Data e Hora", "Ação", "Descrição", "Utilizador", "Cargo"];
      const tableRows = eventLogs.map(log => {
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
          cellPadding: 5 // 👇 ISTO RESOLVE O DESALINHAMENTO COM O CORPO 👇
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
        alternateRowStyles: {
          fillColor: [255, 255, 255]
        },
        willDrawCell: (data) => {
          if (data.section === 'body') {
            
            // Cores das Ações
            if (data.column.index === 1) { 
              const action = data.cell.raw as string;
              
              if (action.includes("UNVALIDATE")) { 
                doc.setTextColor(239, 68, 68); 
                doc.setFont("helvetica", "bold");
              } 
              else if (action.includes("VALIDATE") || action.includes("QR")) {
                doc.setTextColor(16, 185, 129); 
                doc.setFont("helvetica", "bold");
              } 
              else {
                doc.setTextColor(168, 85, 247); 
                doc.setFont("helvetica", "bold");
              }
            }

            // Cores dos Cargos
            if (data.column.index === 4) { 
              const role = data.cell.raw as string;
              if (role === "SuperAdmin") {
                doc.setTextColor(239, 68, 68); 
                doc.setFont("helvetica", "bold");
              } else if (role === "Gestor") {
                doc.setTextColor(59, 130, 246); 
                doc.setFont("helvetica", "bold");
              } else {
                doc.setTextColor(16, 185, 129); 
                doc.setFont("helvetica", "bold");
              }
            }
          }
        }
      });

      const fileName = `Auditoria_${selectedEvent.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error("Erro a gerar o PDF:", err);
    } finally {
      setIsExporting(false);
    }
  };
  // ------------------------------------

  const getActionStyles = (actionType: string) => {
    switch (actionType) {
      case "IMPORT_CSV": return { color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-200", icon: <UploadCloud className="w-4 h-4" /> };
      case "VALIDATE_SEAT":
      case "QR_VALIDATE": return { color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-200", icon: <CheckCircle className="w-4 h-4" /> };
      case "UNVALIDATE_SEAT": return { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-200", icon: <XCircle className="w-4 h-4" /> };
      case "BULK_UPDATE": return { color: "text-purple-600", bg: "bg-purple-500/10", border: "border-purple-200", icon: <Database className="w-4 h-4" /> };
      case "CLEAR_DB": return { color: "text-red-600", bg: "bg-red-500/10", border: "border-red-200", icon: <Trash2 className="w-4 h-4" /> };
      default: return { color: "text-slate-600", bg: "bg-slate-500/10", border: "border-slate-200", icon: <Activity className="w-4 h-4" /> };
    }
  };

  const filteredEvents = events.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
          <History className="w-8 h-8 text-purple-600" /> Auditoria de Eventos
        </h1>
        <p className="text-slate-500 mt-2 font-medium">Acompanha e monitoriza todas as ações executadas na base de dados de cada evento em tempo real.</p>
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-4 rounded-[2rem] border border-white/50 shadow-sm flex items-center gap-3 mb-8">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input 
          type="text" 
          placeholder="Pesquisar por evento ou empresa..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:ring-0 text-slate-900 w-full placeholder:text-slate-400 font-medium"
        />
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-20 bg-white/50 backdrop-blur-md rounded-[2.5rem] border border-white">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900">Nenhum evento encontrado</h3>
          <p className="text-slate-500 mt-1">Ainda não existem eventos com registos de auditoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEvents.map(event => (
            <div 
              key={event.id} 
              onClick={() => openEventLogs(event)}
              className="bg-white/80 backdrop-blur-lg rounded-[2rem] border border-white/60 shadow-sm hover:border-purple-300 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-slate-100/80 text-slate-600 backdrop-blur-sm border border-slate-200/50">
                    ID #{event.id}
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1 line-clamp-1">{event.name}</h3>
                <p className="text-sm font-semibold text-purple-600 mb-4">{event.companyName}</p>
                
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-slate-500">
                    <CalendarDays className="w-4 h-4 mr-2" />
                    {event.startDate ? new Date(event.startDate).toLocaleDateString('pt-PT') : "Sem data"}
                  </div>
                  <div className="flex items-center text-sm text-slate-500">
                    <Activity className="w-4 h-4 mr-2" />
                    Última ação: {event.lastActivity ? new Date(event.lastActivity).toLocaleDateString('pt-PT') : "N/A"}
                  </div>
                </div>
              </div>
              <div className="bg-slate-50/50 backdrop-blur-sm px-6 py-4 border-t border-slate-100 rounded-b-[2rem] flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">Total de Registos</span>
                <span className="bg-purple-100 text-purple-700 py-1 px-3 rounded-xl text-sm font-extrabold">{event.totalLogs}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/20 backdrop-blur-md">
          <div className="bg-white/80 backdrop-blur-2xl rounded-[2.5rem] w-full max-w-3xl h-[85vh] shadow-2xl flex flex-col overflow-hidden border border-white/50 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-slate-200/50 bg-white/50 flex justify-between items-center shrink-0">
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
                  className="bg-white/50 p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-white transition-colors shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
              {isLoadingLogs ? (
                <div className="flex justify-center items-center h-full">
                  <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
                </div>
              ) : eventLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <History className="w-12 h-12 mb-3 opacity-20" />
                  <p className="font-medium text-slate-500">Nenhum registo encontrado para este evento.</p>
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200/60 ml-4 space-y-8 pb-4">
                  {eventLogs.map((log) => {
                    const style = getActionStyles(log.actionType);
                    const logDate = new Date(log.timestamp);
                    return (
                      <div key={log.id} className="relative pl-6">
                        <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white ${style.bg} ${style.color} flex items-center justify-center shadow-sm`}>
                          {style.icon}
                        </div>

                        <div className="bg-white/80 backdrop-blur-xl p-5 rounded-[1.5rem] border border-white shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-3">
                            <span className={`text-[11px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-xl border ${style.bg} ${style.color} ${style.border}`}>
                              {log.actionType.replace("_", " ")}
                            </span>
                            <span className="text-xs font-bold text-slate-400 bg-slate-100/80 backdrop-blur-sm px-2.5 py-1 rounded-xl">
                              {logDate.toLocaleDateString('pt-PT')} às {logDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          
                          <p className="text-slate-700 text-sm font-medium leading-relaxed my-3">
                            {log.description}
                          </p>

                          <div className="flex items-center text-xs font-bold text-slate-500 pt-3 border-t border-slate-100/80">
                            <User className="w-4 h-4 mr-1.5" />
                            Por: <span className="text-slate-900 ml-1 bg-slate-100/80 px-2 py-0.5 rounded-lg">{log.performedBy}</span>
                            
                            <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider font-black border ${
                              log.performedRole === 'SuperAdmin' ? 'bg-red-500/10 text-red-600 border-red-200' :
                              log.performedRole === 'Gestor' ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                              log.performedRole === 'Utilizador' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                              'bg-slate-500/10 text-slate-600 border-slate-200'
                            }`}>
                              {log.performedRole || 'Sistema'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}