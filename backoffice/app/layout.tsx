import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Seatly Backoffice",
  description: "Plataforma central de administração",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Aplicamos o fundo gradiente prateado/cinzento globalmente a toda a app */}
      <body className="min-h-full flex flex-col bg-gradient-to-br from-slate-300 via-slate-100 to-slate-200 text-slate-900">
        {children}
      </body>
    </html>
  );
}