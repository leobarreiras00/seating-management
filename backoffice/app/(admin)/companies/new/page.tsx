"use client";

/**
 * Nova Empresa (/companies/new).
 *
 *   - Cria a empresa (POST /api/Company) e, se houver ficheiro, envia o logótipo
 *     (PUT /api/Company/{id}/logo em FormData). No fim volta a /companies.
 *   - Visual: formulário em vidro à esquerda e, em ecrãs largos, um cartão de
 *     pré-visualização à direita que mostra o nome e o logótipo escolhidos.
 *   - Lógica (estado, validação, fetch) intocada: só o JSX foi redesenhado.
 */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Upload, Building2, ImageIcon, Sparkles } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";

export default function NewCompanyPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Sessão expirada.");

      const createRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name, logoUrl: "" }),
      });

      if (!createRes.ok) throw new Error("Erro ao criar a empresa.");
      const createData = await createRes.json();
      const companyId = createData.companyId;

      if (file && companyId) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/Company/${companyId}/logo`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("A empresa foi criada, mas falhou o upload do logótipo.");
      }

      router.push("/companies");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-10">
      {/* VOLTAR */}
      <Link href="/companies" className="btn btn-ghost btn-sm mb-4 -ml-2">
        <ChevronLeft className="w-4 h-4" /> Voltar para Empresas
      </Link>

      <PageHeader
        title="Adicionar Nova Empresa"
        description="Cria uma nova instância para um cliente."
        icon={<Building2 className="w-6 h-6" />}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-5 lg:gap-6 items-start">
        {/* FORMULÁRIO */}
        <form onSubmit={handleSubmit} className="reveal card-main p-5 lg:p-8 space-y-6 lg:space-y-8" style={{ ["--i" as string]: 1 }}>
          {/* Nome */}
          <div>
            <label className="field-label">
              Nome da Empresa / Cliente <span className="text-red-500">*</span>
            </label>
            <div className="input-wrap">
              <Building2 className="input-icon" />
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="input input-with-icon" placeholder="Ex: Acme Corp" />
            </div>
          </div>

          {/* Logótipo */}
          <div>
            <label className="field-label">Logótipo da Marca</label>
            <div onClick={() => fileInputRef.current?.click()} className="flex justify-center px-4 py-6 lg:px-6 lg:py-8 border-2 border-dashed border-purple-200 rounded-3xl bg-purple-50/40 hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer group">
              <div className="space-y-2 text-center">
                {preview && preview.startsWith("blob:") ? (
                {/* Segurança: só mostramos URLs "blob:" criados por createObjectURL (evita XSS via DOM) */}
                  <div className="mx-auto w-20 h-20 lg:w-24 lg:h-24 rounded-3xl overflow-hidden shadow-lg border-4 border-white mb-3 lg:mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="mx-auto w-12 h-12 lg:w-14 lg:h-14 bg-[linear-gradient(135deg,#a78bfa,#7c3aed)] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:scale-110 transition-transform mb-2 lg:mb-3">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                <div className="text-xs lg:text-sm text-slate-600"><span className="font-bold text-purple-600">Clica para selecionar</span> ou arrasta</div>
                <p className="text-[11px] lg:text-xs text-slate-500">SVG, PNG, JPG até 5MB</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
            </div>
          </div>

          {error && <div className="notice notice-error">{error}</div>}

          {/* AÇÕES */}
          <div className="pt-5 flex flex-col-reverse sm:flex-row justify-end gap-2 lg:gap-3 border-t border-[var(--line)]">
            <Link href="/companies" className="btn btn-white">
              Cancelar
            </Link>
            <button type="submit" disabled={isLoading || !name} className="btn btn-primary">
              {isLoading ? <div className="spinner !w-4 !h-4 !border-2 !border-white/40 !border-t-white"></div> : <Upload className="w-4 h-4" />}
              {isLoading ? "A Criar..." : "Criar Empresa"}
            </button>
          </div>
        </form>

        {/* PRÉ-VISUALIZAÇÃO (só decorativa: reflete o que está escrito/escolhido) */}
        <aside className="reveal hidden lg:block card-nested-pop overflow-hidden" style={{ ["--i" as string]: 2 }} aria-label="Pré-visualização">
          <div className="h-20 relative overflow-hidden bg-[linear-gradient(135deg,#6d28d9_0%,#7c3aed_45%,#2563eb_100%)]">
            <div aria-hidden className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/25 blur-2xl" />
            <span className="badge absolute top-3 left-4 bg-white/20 text-white border-white/30"><Sparkles className="w-3.5 h-3.5" /> Pré-visualização</span>
          </div>
          <div className="px-6 pb-6">
            <div className="relative z-10 -mt-10 mb-4 w-20 h-20 rounded-3xl bg-white border-4 border-white shadow-lg overflow-hidden flex items-center justify-center">
              {preview && preview.startsWith("blob:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-8 h-8 text-purple-300" />
              )}
            </div>
            <p className="text-lg font-bold text-slate-900 break-words">{name || "Nome da empresa"}</p>
            <p className="text-xs text-slate-500 mt-1">É assim que o cliente aparece na lista de empresas.</p>
            {file && <p className="badge badge-green mt-4 max-w-full"><span className="truncate">{file.name}</span></p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
