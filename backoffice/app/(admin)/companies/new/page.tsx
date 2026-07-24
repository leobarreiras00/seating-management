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

  // Função para lidar com a seleção da imagem
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // Cria um preview local da imagem antes de fazer upload
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

      // 1. Criar a Empresa (Apenas Nome)
      const createRes = await fetch("http://localhost:5162/api/Company", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name, logoUrl: "" }), // Logo inicial vazio
      });

      if (!createRes.ok) throw new Error("Erro ao criar a empresa.");
      
      const createData = await createRes.json();
      const companyId = createData.companyId;

      // 2. Se houver imagem, fazemos o upload para a nova empresa
      if (file && companyId) {
        const formData = new FormData();
        formData.append("file", file);

        const uploadRes = await fetch(`http://localhost:5162/api/Company/${companyId}/logo`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            // NOTA: Não enviamos 'Content-Type', o browser define automaticamente como 'multipart/form-data'
          },
          body: formData,
        });

        if (!uploadRes.ok) throw new Error("A empresa foi criada, mas falhou o upload do logótipo.");
      }

      // Sucesso! Volta para a listagem de empresas
      router.push("/companies");
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Botão de Voltar */}
      <Link 
        href="/companies"
        className="inline-flex items-center text-slate-500 hover:text-purple-600 font-medium mb-6 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 mr-1" />
        Voltar para Empresas
      </Link>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
        {/* Cabeçalho do Card */}
        <div className="px-10 py-8 border-b border-slate-100 bg-slate-50/50">
          <h1 className="text-2xl font-extrabold text-slate-900">Adicionar Nova Empresa</h1>
          <p className="text-slate-500 mt-1 text-sm">Cria uma nova instância para um cliente.</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          
          {/* Nome da Empresa */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Nome da Empresa / Cliente <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Building2 className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all bg-slate-50 focus:bg-white"
                placeholder="Ex: Acme Corp"
              />
            </div>
          </div>

          {/* Upload de Logótipo */}
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Logótipo da Marca
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-2xl hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer group"
            >
              <div className="space-y-2 text-center">
                {preview ? (
                  <div className="mx-auto w-24 h-24 rounded-xl overflow-hidden shadow-sm border border-slate-200 mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="mx-auto w-12 h-12 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors mb-3">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                )}
                
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-purple-600 hover:text-purple-500">
                    Clica para selecionar
                  </span>{" "}
                  ou arrasta um ficheiro
                </div>
                <p className="text-xs text-slate-500">SVG, PNG, JPG até 5MB</p>
              </div>
              
              {/* Input escondido */}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg, image/svg+xml"
                className="hidden" 
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 font-medium text-sm">
              {error}
            </div>
          )}

          {/* Botões */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Link 
              href="/companies"
              className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isLoading || !name}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50 disabled:shadow-none flex items-center"
            >
              {isLoading ? (
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
              ) : (
                <Upload className="w-5 h-5 mr-2" />
              )}
              {isLoading ? "A Criar..." : "Criar Empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}