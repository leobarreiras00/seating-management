import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-12 font-sans selection:bg-purple-200">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200">
        <Link href="/login" className="inline-flex items-center text-sm font-semibold text-purple-600 hover:text-purple-800 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Login
        </Link>

        <h1 className="text-3xl font-semibold text-slate-900 mb-2">Política de Privacidade</h1>
        <p className="text-sm font-medium text-slate-500 mb-8">Última Atualização: Setembro de 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Introdução: O Nosso Papel e os Seus Dados</h2>
            <p>
              A plataforma Seatly é fornecida por Leonardo Barreiras ("Processador de Dados") em nome do organizador do evento, promotor ou recinto específico que forneceu as suas credenciais de acesso ("Controlador de Dados"). Ao abrigo do Regulamento Geral sobre a Proteção de Dados (RGPD), o organizador do evento é responsável por determinar como e porquê os seus dados pessoais são processados. O Seatly atua exclusivamente como um prestador de serviços técnicos, armazenando e gerindo estes dados de forma segura e estritamente de acordo com as instruções do organizador.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. Informação que Recolhemos</h2>
            <p className="mb-2">Para facilitar a gestão de capacidade e acesso aos eventos, o Seatly recolhe:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Do Staff (Utilizadores e Gestores):</strong> Identificação pessoal (nome, endereço de e-mail), credenciais criptográficas e registos de auditoria das ações no sistema (ex: validações de bilhetes).</li>
              <li><strong>Dos Convidados (Via Importação CSV):</strong> Nomes dos convidados, atribuição de lugares e estado de validação do bilhete. <em>O Seatly não processa informações de pagamento nem dados pessoais sensíveis.</em></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. Armazenamento, Localização e Segurança dos Dados</h2>
            <p>
              <strong>Alojamento Europeu:</strong> Todos os dados pessoais são armazenados de forma segura na infraestrutura cloud do Render (Frankfurt, Alemanha) e Neon PostgreSQL. Os dados permanecem estritamente dentro do Espaço Económico Europeu (EEE), garantindo total conformidade com as exigências do RGPD.
            </p>
            <p className="mt-2">
              <strong>Medidas de Segurança:</strong> O Seatly implementa validação End-to-End JWT Bearer, Controlo de Acesso Baseado em Funções (RBAC) e isolamento multi-tenant ao nível da base de dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Contacte-nos</h2>
            <p>Para questões técnicas relativas à plataforma, por favor contacte o Suporte Seatly em: <strong>leo.gbarreiras@gmail.com</strong>.</p>
            <p className="mt-2">Para exercer os seus direitos RGPD (Acesso, Apagamento, Portabilidade), por favor contacte diretamente a administração do Organizador do seu Evento, uma vez que estes detêm a autoridade legal sobre os seus dados.</p>
          </section>
        </div>
      </div>
    </div>
  );
}