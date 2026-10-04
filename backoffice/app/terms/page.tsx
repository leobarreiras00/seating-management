/**
 * Termos de Serviço (página pública, só conteúdo estático).
 * Visual: cartão de vidro sobre o fundo aurora, título com degradê e secções
 * numeradas com marcadores coloridos. O texto legal não foi alterado.
 */
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 sm:py-12 selection:bg-purple-200">
      <div className="max-w-3xl mx-auto">
        {/* --- LIGAÇÃO DE VOLTA --- */}
        <Link href="/login" className="reveal btn btn-white btn-sm mb-6">
          <ChevronLeft className="w-4 h-4" /> Voltar ao Login
        </Link>

        {/* --- CABEÇALHO (cartão de vidro sobre a aurora) --- */}
        <header className="reveal card-main !p-7 sm:!p-10 mb-5 text-center sm:text-left" style={{ ["--i" as string]: 1 }}>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="modal-title-icon !w-14 !h-14 !rounded-2xl shrink-0"><FileText className="w-7 h-7" /></div>
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-gradient tracking-tight">Termos de Serviço</h1>
              <p className="mt-2"><span className="badge badge-purple">Última Atualização: Setembro de 2026</span></p>
            </div>
          </div>
        </header>

        {/* --- SECÇÕES NUMERADAS --- */}
        <div className="space-y-4">
          {/* Secção 1 */}
          <section className="reveal card-nested-pop p-5 sm:p-7" style={{ ["--i" as string]: 1 }}>
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 shrink-0 rounded-2xl text-white font-display font-bold flex items-center justify-center shadow-lg shadow-purple-500/30" style={{ background: "var(--grad-brand)" }}>1</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Aceitação dos Termos</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p>
              Ao aceder e utilizar o Backoffice Web ou a Aplicação Mobile do Seatly, concorda em ficar vinculado a estes Termos de Serviço. A plataforma Seatly é desenvolvida por Leonardo Barreiras ("Seatly") e é-lhe fornecida em nome do organizador do seu evento.
            </p>
          
                </div>
              </div>
            </div>
          </section>
          {/* Secção 2 */}
          <section className="reveal card-nested-pop p-5 sm:p-7" style={{ ["--i" as string]: 2 }}>
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 shrink-0 rounded-2xl text-white font-display font-bold flex items-center justify-center shadow-lg shadow-blue-500/30" style={{ background: "var(--grad-blue)" }}>2</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Uso Permitido</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p className="mb-2">A plataforma Seatly destina-se estritamente a:</p>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-purple-400">
              <li>Gestão e planeamento da capacidade de eventos.</li>
              <li>Importação de listas de convidados autorizadas via upload de ficheiros CSV.</li>
              <li>Validação da entrada de convidados nas portas do recinto.</li>
            </ul>
          
                </div>
              </div>
            </div>
          </section>
          {/* Secção 3 */}
          <section className="reveal card-nested-pop p-5 sm:p-7" style={{ ["--i" as string]: 3 }}>
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 shrink-0 rounded-2xl text-white font-display font-bold flex items-center justify-center shadow-lg shadow-emerald-500/30" style={{ background: "var(--grad-emerald)" }}>3</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Contas de Utilizador e Responsabilidades</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p>
              É responsável por manter a confidencialidade das credenciais da sua conta (palavra-passe e PIN mobile de 4 dígitos). Concorda em não partilhar as suas credenciais nem tentar contornar as medidas de segurança de Controlo de Acesso Baseado em Funções (RBAC) da plataforma.
            </p>
          
                </div>
              </div>
            </div>
          </section>
          {/* Secção 4 */}
          <section className="reveal card-nested-pop p-5 sm:p-7" style={{ ["--i" as string]: 4 }}>
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 shrink-0 rounded-2xl text-white font-display font-bold flex items-center justify-center shadow-lg shadow-amber-500/30" style={{ background: "var(--grad-amber)" }}>4</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Limitação de Responsabilidade</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p>
              O Seatly fornece a plataforma "tal como está" e "conforme disponível", sem garantias de qualquer tipo. O Seatly é uma plataforma tecnológica, não uma empresa de produção de eventos. Não nos responsabilizamos por interrupções de eventos, violações da capacidade física do recinto ou por entradas de dados imprecisos carregados pelos gestores.
            </p>
          
                </div>
              </div>
            </div>
          </section>
          {/* Secção 5 */}
          <section className="reveal card-nested-pop p-5 sm:p-7" style={{ ["--i" as string]: 5 }}>
            <div className="flex items-start gap-4">
              <span className="w-10 h-10 shrink-0 rounded-2xl text-white font-display font-bold flex items-center justify-center shadow-lg shadow-rose-500/30" style={{ background: "var(--grad-red)" }}>5</span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Lei Aplicável</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p>
              Estes Termos de Serviço serão regidos e interpretados de acordo com as leis de Portugal. Quaisquer litígios decorrentes destes termos estarão sujeitos à jurisdição exclusiva dos tribunais portugueses.
            </p>
          
                </div>
              </div>
            </div>
          </section>
        </div>

        <p className="text-center text-xs sm:text-sm font-medium text-slate-500 mt-8">Copyright © Seatly {new Date().getFullYear()}.</p>
      </div>
    </div>
  );
}
