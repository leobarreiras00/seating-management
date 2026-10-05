"use client";

/**
 * Empresas Clientes — listagem (/companies).
 *
 *   - Dados: GET /api/Company, atualizado em tempo real por MQTT
 *     (`seating/backoffice/companies`). Esconde a empresa interna "Seatly Admin".
 *   - Ações: editar nome/logótipo (modal), apagar (confirmação) e ir para o detalhe.
 *   - Visual: cabeçalho com ação principal, grelha de cartões com faixa de cor,
 *     skeletons enquanto carrega e EmptyState quando não há empresas.
 *   - Lógica (estado, fetch, MQTT, handlers) intocada: só o JSX foi redesenhado.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Building2, Plus, ChevronRight, Edit2, Trash2, Upload, FileImage } from "lucide-react";
import mqtt from "mqtt";
import Modal from "@/components/ui/Modal";
import AlertDialog from "@/components/ui/AlertDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { getErrorMessage } from "@/lib/errors";
import { fileToLogoDataUri } from "@/lib/avatar";

interface Company {
  id: number;
  name: string;
  logoUrl: string | null;
}

// Só apresentação: cada cartão ganha uma faixa de cor (rotação pelo id da empresa).
const CARD_BANNERS = [
  "bg-[linear-gradient(135deg,#a78bfa,#7c3aed)]",
  "bg-[linear-gradient(135deg,#60a5fa,#2563eb)]",
  "bg-[linear-gradient(135deg,#34d399,#059669)]",
  "bg-[linear-gradient(135deg,#fbbf24,#f97316)]",
];


export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editCompanyId, setEditCompanyId] = useState<number | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyLogo, setEditCompanyLogo] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState("");

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void } | null>(null);
  const [alertDialog, setAlertDialog] = useState<{ isOpen: boolean, title: string, message: string, type: 'error' | 'success' | 'info' } | null>(null);

  const fetchCompanies = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Falha ao carregar as empresas.");
      const data = await res.json();
      setCompanies(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch inicial no mount; o setState só corre depois do await
    fetchCompanies();
    const client = mqtt.connect(process.env.NEXT_PUBLIC_MQTT_URL as string, {
      username: process.env.NEXT_PUBLIC_MQTT_USERNAME as string,
      password: process.env.NEXT_PUBLIC_MQTT_PASSWORD as string,
    });
    client.on("connect", () => { client.subscribe("seating/backoffice/companies"); });
    client.on("message", () => { fetchCompanies(); });
    return () => { client.end(); };
  }, [fetchCompanies]);

  const promptDeleteCompany = (id: number, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Apagar Empresa",
      message: `Tens a certeza que queres apagar a empresa "${name}"? Esta ação é irreversível. Garante que apagaste primeiro os Gestores e Eventos associados.`,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem("token");
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.Message || "Erro ao apagar a empresa. Verifica se ainda existem dependências.");
          }
          setCompanies(companies.filter(c => c.id !== id));
        } catch (err: unknown) {
          setAlertDialog({ isOpen: true, title: "Erro de Exclusão", message: getErrorMessage(err), type: 'error' });
        }
      }
    });
  };

  const openEditModal = (company: Company) => {
    setEditCompanyId(company.id); setEditCompanyName(company.name); setEditCompanyLogo(null); setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompanyId) return;
    setIsEditing(true); setEditError("");
    try {
      const token = localStorage.getItem("token");
      const currentCompany = companies.find(c => c.id === editCompanyId);
      
      const resName = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${editCompanyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editCompanyName, logoUrl: currentCompany?.logoUrl }),
      });
      if (!resName.ok) throw new Error("Erro ao atualizar o nome da empresa.");

      // Envio em formato Base64 JSON em vez de FormData
      if (editCompanyLogo) {
        const base64String = await fileToLogoDataUri(editCompanyLogo);

        const resLogo = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${editCompanyId}/logo`, { 
          method: "PUT", 
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
          }, 
          body: JSON.stringify({ logoBase64: base64String }) 
        });
        if (!resLogo.ok) throw new Error("O nome foi atualizado, mas ocorreu um erro no upload do novo logótipo.");
      }
      setShowEditModal(false); fetchCompanies();
    } catch (err: unknown) { setEditError(getErrorMessage(err)); } finally { setIsEditing(false); }
  };

  const filteredCompanies = companies.filter(c => c.name.toLowerCase() !== "seatly admin");

  return (
    <div className="w-full max-w-7xl mx-auto pb-10">
      {/* CABEÇALHO: título + ação principal */}
      <PageHeader
        title="Empresas Clientes"
        description="Gere as instâncias e acessos dos teus clientes."
        icon={<Building2 className="w-6 h-6" />}
        actions={
          <Link href="/companies/new" className="btn btn-primary btn-lg w-full sm:w-auto">
            <Plus className="w-5 h-5" /> Nova Empresa
          </Link>
        }
      />

      <div className="min-h-[50vh]">
        {/* ESTADO: A CARREGAR (esqueletos com o formato dos cartões) */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6" role="status" aria-label="A carregar">
            {[0, 1, 2].map((n) => (
              <div key={n} className="skeleton h-44" />
            ))}
          </div>
        )}

        {/* ESTADO: ERRO */}
        {error && <div className="notice notice-error mb-5">{error}</div>}

        {!isLoading && !error && filteredCompanies.length === 0 ? (
          /* ESTADO: SEM EMPRESAS */
          <EmptyState
            title="Sem empresas ativas"
            description="Ainda não tens nenhum cliente registado na plataforma. Cria a tua primeira empresa para começar."
            action={
              <Link href="/companies/new" className="btn btn-primary">
                <Plus className="w-4 h-4" /> Criar primeira empresa
              </Link>
            }
          />
        ) : (
          /* GRELHA DE EMPRESAS */
          <div className="stagger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredCompanies.map((company) => (
              <div key={company.id} className="relative group">
                <Link
                  href={`/companies/${company.id}`}
                  className="block card-nested-pop card-lift h-full flex flex-col overflow-hidden outline-none"
                >
                  {/* Faixa de cor decorativa */}
                  <div aria-hidden className={`h-16 relative overflow-hidden ${CARD_BANNERS[company.id % CARD_BANNERS.length]}`}>
                    <div className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/25 blur-xl" />
                  </div>
                  <div className="px-6 pb-5 flex flex-col flex-1">
                    <div className="relative z-10 -mt-9 mb-4">
                      <SafeCompanyLogo logoUrl={company.logoUrl} companyName={company.name} className="w-[4.5rem] h-[4.5rem] !border-4 !border-white shadow-lg" fallbackSize="w-7 h-7" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 truncate" title={company.name}>{company.name}</h3>
                    <div className="mt-auto pt-5 flex items-center justify-between text-sm font-bold text-purple-600 group-hover:text-purple-700">
                      Gerir Empresa <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>

                {/* Ações rápidas (sempre visíveis em toque; no hover em desktop) */}
                <div className="absolute top-3 right-3 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button type="button" aria-label={`Editar ${company.name}`} title="Editar" onClick={(e) => { e.preventDefault(); openEditModal(company); }} className="icon-btn icon-btn-blue !w-9 !h-9 shadow-md"><Edit2 className="w-4 h-4" /></button>
                  <button type="button" aria-label={`Apagar ${company.name}`} title="Apagar" onClick={(e) => { e.preventDefault(); promptDeleteCompany(company.id, company.name); }} className="icon-btn icon-btn-red !w-9 !h-9 shadow-md"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: EDITAR EMPRESA (nome + novo logótipo opcional) */}
      {showEditModal && (
        <Modal
          onClose={() => setShowEditModal(false)}
          title="Editar Empresa"
          subtitle="Altera o nome ou substitui o logótipo"
          icon={<Edit2 className="w-5 h-5" />}
          size="md"
          closeOnBackdrop={false}
          footer={
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-white">Cancelar</button>
              <button type="submit" form="edit-company-form" disabled={isEditing} className="btn btn-primary">{isEditing ? "A Guardar..." : "Guardar Alterações"}</button>
            </div>
          }
        >
          <form id="edit-company-form" onSubmit={handleEditSubmit} className="space-y-5">
            <div>
              <label className="field-label">Nome da Empresa</label>
              <div className="input-wrap">
                <Building2 className="input-icon" />
                <input type="text" required value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} className="input input-with-icon" />
              </div>
            </div>
            <div>
              <label className="field-label">Novo Logótipo (Opcional)</label>
              <div className="flex justify-center px-6 py-6 border-2 border-dashed border-purple-200 rounded-3xl bg-purple-50/40 hover:bg-purple-50 hover:border-purple-400 transition-colors">
                <div className="space-y-1.5 text-center min-w-0">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-[linear-gradient(135deg,#a78bfa,#7c3aed)] text-white flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label htmlFor="file-upload-edit" className="relative cursor-pointer rounded-md font-bold text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-500 focus-within:ring-offset-2">
                      <span>Carregar novo ficheiro</span>
                      <input id="file-upload-edit" name="file-upload-edit" type="file" className="sr-only" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => { if (e.target.files && e.target.files.length > 0) setEditCompanyLogo(e.target.files[0]); }} />
                    </label>
                  </div>
                  {editCompanyLogo ? <p className="badge badge-green max-w-full truncate"><FileImage className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{editCompanyLogo.name}</span></p> : <p className="text-xs text-slate-500">PNG, JPG, SVG até 5MB</p>}
                </div>
              </div>
            </div>
            {editError && <div className="notice notice-error">{editError}</div>}
          </form>
        </Modal>
      )}

      {/* CONFIRMAÇÃO (apagar empresa) */}
      {confirmDialog && confirmDialog.isOpen && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Eliminar"
          onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {/* AVISO (erro de exclusão) */}
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
 * Logótipo da empresa com fallback: imagem (URL ou base64) -> ícone Seatly -> ícone genérico.
 * Se a imagem falhar a carregar (onError) cai para o fallback.
 */
interface SafeCompanyLogoProps {
  logoUrl?: string | null;
  companyName?: string | null;
  className?: string;
  fallbackSize?: string;
}

function SafeCompanyLogo({ logoUrl, companyName, className, fallbackSize = "w-6 h-6" }: SafeCompanyLogoProps) {
  // Guarda o URL que falhou; muda automaticamente quando o logoUrl muda (sem efeito).
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const error = failedUrl === (logoUrl ?? null);
  if (logoUrl && !error) {
    // Permite renderizar strings em base64 diretamente (data:image) além de URLs completos
    const src = logoUrl.startsWith('http') || logoUrl.startsWith('data:image') ? logoUrl : `${process.env.NEXT_PUBLIC_API_URL}${logoUrl}`;
    return (
      <div className={`relative bg-white border border-purple-100 rounded-3xl overflow-hidden shrink-0 flex items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logótipo dinâmico (URL da API ou data URI), next/image não aplicável */}
        <img src={src} alt={companyName ?? undefined} className="w-full h-full object-cover" onError={() => setFailedUrl(logoUrl)} />
      </div>
    );
  }
  if (companyName?.toLowerCase().includes("seatly admin") || companyName?.toLowerCase().includes("seatly")) {
    return (
      <div className={`relative bg-white border border-purple-100 rounded-3xl overflow-hidden shrink-0 flex items-center justify-center shadow-sm ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logótipo dinâmico (URL da API ou data URI), next/image não aplicável */}
        <img src="/seatly_icon.png" alt="Seatly" className="w-full h-full object-cover" />
      </div>
    );
  }
  return <div className={`flex items-center justify-center bg-white border border-purple-100 rounded-3xl shadow-sm shrink-0 ${className}`}><Building2 className={`${fallbackSize} text-purple-300`} /></div>;
}
