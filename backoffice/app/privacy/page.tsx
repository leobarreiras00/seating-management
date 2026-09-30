import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-6 md:p-12 font-sans selection:bg-purple-200">
      <div className="max-w-3xl mx-auto bg-white p-8 md:p-12 rounded-[2rem] shadow-sm border border-slate-200">
        <Link href="/login" className="inline-flex items-center text-sm font-bold text-purple-600 hover:text-purple-800 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4 mr-1" /> Back to Login
        </Link>

        <h1 className="text-3xl font-black text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm font-medium text-slate-500 mb-8">Last Updated: September 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">1. Introduction: Our Role and Your Data</h2>
            <p>
              The Seatly platform is provided by Leonardo Barreiras ("Data Processor") on behalf of the specific event organizer, promoter, or venue that provided your access credentials ("Data Controller"). Under the General Data Protection Regulation (GDPR), your event organizer is responsible for determining how and why your personal data is processed. Seatly acts solely as a technical service provider, securely storing and managing this data strictly according to the organizer's instructions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">2. Information We Collect</h2>
            <p className="mb-2">To facilitate event capacity and access management, Seatly collects:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>From Staff (Users & Managers):</strong> Personal identification (name, email address), cryptographic credentials, and audit logs of system actions (e.g., ticket validations).</li>
              <li><strong>From Guests (Via CSV Import):</strong> Guest names, seating assignments, and ticket validation status. <em>Seatly does not process payment information or sensitive personal data.</em></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">3. Data Storage, Location, and Security</h2>
            <p>
              <strong>European Hosting:</strong> All personal data is stored securely on Render (Frankfurt, Germany) and Neon PostgreSQL cloud infrastructure. Data remains strictly within the European Economic Area (EEA), ensuring full GDPR compliance.
            </p>
            <p className="mt-2">
              <strong>Security Measures:</strong> Seatly implements End-to-End JWT Bearer validation, Role-Based Access Control (RBAC), and database-level multi-tenant isolation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900 mb-3">4. Contact Us</h2>
            <p>For technical issues regarding the platform, please contact Seatly Support at: <strong>leo.gbarreiras@gmail.com</strong>.</p>
            <p className="mt-2">To exercise your GDPR rights (Access, Erasure, Portability), please contact the administration of your specific Event Organizer directly, as they hold the legal authority over your data.</p>
          </section>
        </div>
      </div>
    </div>
  );
}