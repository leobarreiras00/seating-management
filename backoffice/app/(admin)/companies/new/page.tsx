"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Upload, Building2, ImageIcon } from "lucide-react";

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
    <div className="max-w-3xl mx-auto">
      <Link href="/companies" className="inline-flex items-center text-slate-500 hover:text-purple-600 font-medium mb-4 lg:mb-6 transition-colors text-sm lg:text-base">
        <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5 mr-1" /> Voltar para Empresas
      </Link>

      <div className="bg-white rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        {/* 👇 Espaçamento reduzido no mobile (px-5 py-5 em vez de p-10) 👇 */}
        <div className="px-5 py-5 lg:px-10 lg:py-8 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-xl lg:text-2xl font-extrabold text-slate-900">Adicionar Nova Empresa</h1>
          <p className="text-slate-500 mt-1 text-xs lg:text-sm">Cria uma nova instância para um cliente.</p>
        </div>

        {/* 👇 Formulário também com p-5 no mobile 👇 */}
        <form onSubmit={handleSubmit} className="p-5 lg:p-10 space-y-6 lg:space-y-8">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Nome da Empresa / Cliente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2 className="h-5 w-5 text-slate-400" />
              </div>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white" placeholder="Ex: Acme Corp" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Logótipo da Marca</label>
            <div onClick={() => fileInputRef.current?.click()} className="mt-1 flex justify-center px-4 py-4 lg:px-6 lg:pt-5 lg:pb-6 border-2 border-slate-200 border-dashed rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer group">
              <div className="space-y-2 text-center">
                {preview ? (
                  <div className="mx-auto w-20 h-20 lg:w-24 lg:h-24 rounded-xl overflow-hidden shadow-sm border border-slate-200 mb-3 lg:mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="mx-auto w-10 h-10 lg:w-12 lg:h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors mb-2 lg:mb-3">
                    <ImageIcon className="w-5 h-5 lg:w-6 lg:h-6" />
                  </div>
                )}
                <div className="text-xs lg:text-sm text-slate-600"><span className="font-semibold text-purple-600">Clica para selecionar</span> ou arrasta</div>
                <p className="text-[10px] lg:text-xs text-slate-500">SVG, PNG, JPG até 5MB</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
            </div>
          </div>

          {error && <div className="p-3 lg:p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 font-medium text-xs lg:text-sm">{error}</div>}

          <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2 lg:gap-3 border-t border-slate-100">
            <Link href="/companies" className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors text-center text-sm lg:text-base">
              Cancelar
            </Link>
            <button type="submit" disabled={isLoading || !name} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-xl transition-all flex items-center justify-center text-sm lg:text-base">
              {isLoading ? <div className="animate-spin w-4 h-4 lg:w-5 lg:h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div> : <Upload className="w-4 h-4 lg:w-5 lg:h-5 mr-2" />}
              {isLoading ? "A Criar..." : "Criar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}