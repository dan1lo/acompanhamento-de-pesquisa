import type { Metadata } from "next";
import { Karla, Spectral } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Scholab — Gestão de Orientandos",
  description: "Plataforma para acompanhamento de orientandos de TCC, mestrado e doutorado",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${karla.variable} ${spectral.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 font-spectral">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
