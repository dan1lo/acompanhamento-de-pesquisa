import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { execSync } from "child_process";

function getInitialTheme(): "dark" | "light" {
  if (process.platform === "win32") {
    try {
      const out = execSync(
        'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize" /v SystemUsesLightTheme',
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      );
      if (out.includes("0x0")) {
        return "dark";
      }
    } catch {
      // ignore
    }
  }
  return "light";
}

export const metadata: Metadata = {
  title: "Scholab — Gestão de Orientandos",
  description: "Plataforma para acompanhamento de orientandos de TCC, mestrado e doutorado",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const initialTheme = getInitialTheme();
  const initialFavicon =
    initialTheme === "dark"
      ? "/icon-dark.png?v=system-dark"
      : "/icon-light.png?v=system-light";

  return (
    <html
      lang="pt-BR"
      className="h-full antialiased"
    >
      <head>
        <link
          id="app-favicon"
          rel="icon"
          href={initialFavicon}
          type="image/png"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,400..800;1,400..800&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 font-spectral">
        <DynamicFavicon />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
