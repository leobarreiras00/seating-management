import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-12 font-sans selection:bg-purple-200">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
        <Link href="/login" className="inline-flex items-center text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Login
        </Link>

        <h1 className="text-3xl font-semibold text-slate-900 mb-2">Termos de Serviço</h1>
        <p className="text-sm font-medium text-slate-500 mb-8">Última Atualização: Setembro de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Aceitação dos Termos</h2>
            <p>
              Ao aceder e utilizar o Backoffice Web ou a Aplicação Mobile do Seatly, concorda em ficar vinculado a estes Termos de Serviço. A plataforma Seatly é desenvolvida por Leonardo Barreiras ("Seatly") e é-lhe fornecida em nome do organizador do seu evento.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. Uso Permitido</h2>
            <p className="mb-2">A plataforma Seatly destina-se estritamente a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gestão e planeamento da capacidade de eventos.</li>
              <li>Importação de listas de convidados autorizadas via upload de ficheiros CSV.</li>
              <li>Validação da entrada de convidados nas portas do recinto.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. Contas de Utilizador e Responsabilidades</h2>
            <p>
              É responsável por manter a confidencialidade das credenciais da sua conta (palavra-passe e PIN mobile de 4 dígitos). Concorda em não partilhar as suas credenciais nem tentar contornar as medidas de segurança de Controlo de Acesso Baseado em Funções (RBAC) da plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Limitação de Responsabilidade</h2>
            <p>
              O Seatly fornece a plataforma "tal como está" e "conforme disponível", sem garantias de qualquer tipo. O Seatly é uma plataforma tecnológica, não uma empresa de produção de eventos. Não nos responsabilizamos por interrupções de eventos, violações da capacidade física do recinto ou por entradas de dados imprecisos carregados pelos gestores.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Lei Aplicável</h2>
            <p>
              Estes Termos de Serviço serão regidos e interpretados de acordo com as leis de Portugal. Quaisquer litígios decorrentes destes termos estarão sujeitos à jurisdição exclusiva dos tribunais portugueses.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}