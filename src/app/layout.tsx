import type { Metadata } from "next";
import { Karla, Spectral } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { DynamicFavicon } from "@/components/dynamic-favicon";
import { execSync } from "child_process";

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
      className={`${karla.variable} ${spectral.variable} h-full antialiased`}
    >
      <head>
        <link
          id="app-favicon"
          rel="icon"
          href={initialFavicon}
          type="image/png"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                  var fav = document.getElementById('app-favicon');
                  if (fav && isDark) {
                    fav.href = '/icon-dark.png?v=dark';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900 font-spectral">
        <DynamicFavicon />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
