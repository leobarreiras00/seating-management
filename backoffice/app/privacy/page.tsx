/**
 * Política de Privacidade (página pública, só conteúdo estático).
 * Visual: cartão de vidro sobre o fundo aurora, título com degradê e secções
 * numeradas com marcadores coloridos. O texto legal não foi alterado.
 */
import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
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
            <div className="modal-title-icon !w-14 !h-14 !rounded-2xl shrink-0"><ShieldCheck className="w-7 h-7" /></div>
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-4xl font-bold text-gradient tracking-tight">Política de Privacidade</h1>
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
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Introdução: O Nosso Papel e os Seus Dados</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p>
              A plataforma Seatly é fornecida por Leonardo Barreiras ("Processador de Dados") em nome do organizador do evento, promotor ou recinto específico que forneceu as suas credenciais de acesso ("Controlador de Dados"). Ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD), o organizador do evento é responsável por determinar como e porquê os seus dados pessoais são processados. O Seatly atua exclusivamente como um prestador de serviços técnicos, armazenando e gerindo estes dados de forma segura e estritamente de acordo com as instruções do organizador.
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
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Informação que Recolhemos</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p className="mb-2">Para facilitar a gestão de capacidade e acesso aos eventos, o Seatly recolhe:</p>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-purple-400">
              <li><strong className="text-slate-800">Do Staff (Utilizadores e Gestores):</strong> Identificação pessoal (nome, endereço de e-mail), credenciais criptográficas e registos de auditoria das ações no sistema (ex: validações de bilhetes).</li>
              <li><strong className="text-slate-800">Dos Convidados (Via Importação CSV):</strong> Nomes dos convidados, atribuição de lugares e estado de validação do bilhete. <em>O Seatly não processa informações de pagamento nem dados pessoais sensíveis.</em></li>
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
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Armazenamento, Localização e Segurança dos Dados</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p>
              <strong className="text-slate-800">Alojamento Europeu:</strong> Todos os dados pessoais são armazenados de forma segura na infraestrutura cloud do Render (Frankfurt, Alemanha) e Neon PostgreSQL. Os dados permanecem estritamente dentro do Espaço Económico Europeu (EEE), garantindo total conformidade com as exigências do RGPD.
            </p>
            <p className="mt-2">
              <strong className="text-slate-800">Medidas de Segurança:</strong> O Seatly implementa validação End-to-End JWT Bearer, Controlo de Acesso Baseado em Funções (RBAC) e isolamento multi-tenant ao nível da base de dados.
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
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-3 pt-1.5">Contacte-nos</h2>
                <div className="text-[15px] leading-relaxed text-slate-600 [&_p]:break-words">            <p>Para questões técnicas relativas à plataforma, por favor contacte o Suporte Seatly em: <strong className="text-slate-800">leo.gbarreiras@gmail.com</strong>.</p>
            <p className="mt-2">Para exercer os seus direitos RGPD (Acesso, Apagamento, Portabilidade), por favor contacte diretamente a administração do Organizador do seu Evento, uma vez que estes detêm a autoridade legal sobre os seus dados.</p>
          
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
