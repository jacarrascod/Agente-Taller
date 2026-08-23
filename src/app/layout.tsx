import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Archivo, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { BarraEstado } from "@/components/layout/BarraEstado";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { agente } from "@/lib/agente";

// Tipografía — SPEC.md §13.1. Archivo se diseñó para impresión de alto
// rendimiento e IBM Plex nació como tipografía corporativa de ingeniería:
// las dos traen la procedencia correcta para un catálogo técnico.
const display = Archivo({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--fuente-display",
  display: "swap",
});

const texto = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--fuente-texto",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Toyota Taller Perú — Repuestos y mantenimiento",
  description: `Catálogo de repuestos Toyota con stock real, agenda de mantenimiento y ${agente.nombre}, ${agente.rol}. Proyecto académico de demostración.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="es-PE"
      className={`h-full antialiased ${display.variable} ${texto.variable} ${mono.variable}`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-tinta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        >
          Saltar al contenido
        </a>
        <BarraEstado />
        <Header />
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}
