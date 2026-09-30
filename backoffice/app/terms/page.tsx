import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-12 font-sans selection:bg-purple-200">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-200">
        <Link href="/login" className="inline-flex items-center text-sm font-bold text-purple-600 hover:text-purple-800 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Login
        </Link>

        <h1 className="text-3xl font-black text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm font-medium text-slate-500 mb-8">Last Updated: September 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Seatly Web Backoffice or Mobile Application, you agree to be bound by these Terms of Service. The Seatly platform is developed by Leonardo Barreiras ("Seatly") and is provided to you on behalf of your event organizer.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Permitted Use</h2>
            <p className="mb-2">The Seatly platform is strictly intended for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Event capacity management and planning.</li>
              <li>Ingesting authorized guest lists via CSV upload.</li>
              <li>Validating guest entry at venue doors.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. User Accounts and Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials (password and 4-digit mobile PIN). You agree not to share your credentials or attempt to bypass the platform's Role-Based Access Control (RBAC) security measures.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">4. Limitation of Liability</h2>
            <p>
              Seatly provides the platform on an "as is" and "as available" basis without warranties of any kind. Seatly is a technology platform, not an event production company. We are not liable for event disruptions, physical venue capacity violations, or inaccurate data entry uploaded by facility managers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">5. Governing Law</h2>
            <p>
              These Terms of Service shall be governed by and construed in accordance with the laws of Portugal. Any disputes arising from these terms shall be subject to the exclusive jurisdiction of the Portuguese courts.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}