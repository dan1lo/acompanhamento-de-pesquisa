"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface TopbarHeaderProps {
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  role?: "PROFESSOR" | "ALUNO" | "COORIENTADOR";
}

const PROFESSOR_LINKS_PRINCIPAIS = [
  { href: "/painel", label: "Painel" },
  { href: "/fila", label: "Quem contatar hoje" },
  { href: "/alertas", label: "Alertas" },
  { href: "/buscar", label: "Buscar" },
  { href: "/alunos/novo", label: "Novo aluno" },
  { href: "/horarios", label: "Horários" },
];

const PROFESSOR_LINKS_CONFIG = [
  { href: "/configuracoes/google", label: "Google Calendar" },
  { href: "/configuracoes/alertas", label: "Config. alertas" },
  { href: "/coorientadores", label: "Coorientadores" },
];

const ALUNO_LINKS_PRINCIPAIS = [
  { href: "/inicio", label: "Início" },
  { href: "/agendar", label: "Agendar reunião" },
  { href: "/reunioes", label: "Minhas reuniões" },
  { href: "/entregas", label: "Entregas" },
  { href: "/producao", label: "Produção científica" },
];

const ALUNO_LINKS_CONFIG = [
  { href: "/privacidade", label: "Privacidade e Dados" },
];

export function TopbarHeader({
  userName,
  userEmail,
  userImage,
  role = "PROFESSOR",
}: TopbarHeaderProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const isAluno = role === "ALUNO";
  const homeHref = isAluno ? "/inicio" : "/painel";
  const linksPrincipais = isAluno ? ALUNO_LINKS_PRINCIPAIS : PROFESSOR_LINKS_PRINCIPAIS;
  const linksConfig = isAluno ? ALUNO_LINKS_CONFIG : PROFESSOR_LINKS_CONFIG;

  // Fechar sidebar com ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Bloquear rolagem do body quando sidebar estiver aberta
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [sidebarOpen]);

  return (
    <>
      {/* Topbar com fundo verde escuro (#133C1B), altura h-16 e texto branco */}
      <header className="sticky top-0 z-30 w-full border-b border-black/10 bg-[#133C1B] text-white shadow-sm">
        <div className="flex h-16 w-full items-center justify-between px-4 sm:px-6">
          {/* Canto esquerdo: ícone para abrir a sidebar + SCHOLAB em Caps Lock */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-white transition-colors hover:bg-white/10 active:scale-95 focus:outline-none focus:ring-2 focus:ring-white/30 cursor-pointer"
              aria-label="Abrir menu de navegação"
              title="Abrir menu"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link
              href={homeHref}
              className="text-lg font-bold tracking-wider text-white hover:opacity-90 font-karla transition-opacity"
            >
              SCHOLAB
            </Link>
          </div>

          {/* Canto direito: Notificações (Sino) + Foto de perfil / Avatar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Ícone de sino com popup hover de notificações */}
            <div className="relative group">
              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 active:scale-95 focus:outline-none cursor-pointer"
                aria-label="Notificações"
                title="Notificações"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              </button>

              {/* Popup de notificações no hover */}
              <div className="absolute right-0 top-full pt-2 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-all duration-200 z-50">
                <div className="w-72 rounded-xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-xl ring-1 ring-black/5">
                  <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
                    <h3 className="font-karla text-xs font-semibold uppercase tracking-wider text-zinc-900">
                      Notificações
                    </h3>
                  </div>
                  <div className="py-3 text-center">
                    <p className="text-xs text-zinc-600">
                      Você não possui nenhuma notificação no momento
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Canto direito: foto de perfil / ícone redondo com menu hover */}
            <div className="relative group">
              <Link
                href="/perfil"
                className="flex items-center justify-center rounded-full focus:outline-none transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Meu Perfil"
                title="Meu Perfil"
              >
                {userImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userImage}
                    alt={userName ?? "Foto de perfil"}
                    className="h-10 w-10 rounded-full object-cover ring-2 ring-white/50 transition-all group-hover:ring-white shadow-sm"
                  />
                ) : (
                  /* Ícone padrão de perfil redondo se não houver foto */
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white ring-2 ring-white/50 transition-all group-hover:bg-white/30 group-hover:ring-white shadow-sm">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  </div>
                )}
              </Link>

              {/* Menu suspenso no hover com: Perfil/Privacidade e Sair */}
              <div className="absolute right-0 top-full pt-2 opacity-0 invisible pointer-events-none group-hover:opacity-100 group-hover:visible group-hover:pointer-events-auto transition-all duration-200 z-50">
                <div className="w-56 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-900 shadow-xl ring-1 ring-black/5">
                  <div className="border-b border-zinc-100 px-3 py-2 mb-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-semibold text-zinc-900 font-karla">
                        {userName || "Usuário"}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#133C1B]/10 text-[#133C1B] border border-[#133C1B]/15 font-karla">
                        {isAluno ? "Aluno" : "Orientador"}
                      </span>
                    </div>
                  </div>

                  {/* Perfil */}
                  <Link
                    href="/perfil"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <svg
                      className="h-4 w-4 text-zinc-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                    Perfil
                  </Link>

                  {/* Configurações */}
                  <Link
                    href={isAluno ? "/privacidade" : "/configuracoes/alertas"}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                  >
                    <svg
                      className="h-4 w-4 text-zinc-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Configurações
                  </Link>

                  <div className="my-1 border-t border-zinc-100" />

                  {/* Sair */}
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <svg
                      className="h-4 w-4 text-red-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                      />
                    </svg>
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-xs transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar 100% verde (#133C1B), sem divisão de barra no topo */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#133C1B] text-white shadow-2xl transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Topo da sidebar integrado */}
        <div className="flex h-16 items-center justify-between px-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70 font-karla">
            Menu do {isAluno ? "Aluno" : "Orientador"}
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none cursor-pointer"
            aria-label="Fechar menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-3 text-sm">
          <div>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50 font-karla">
              {isAluno ? "Navegação" : "Menu Principal"}
            </div>
            <div className="space-y-1">
              {linksPrincipais.map((item) => {
                const ativo = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors font-karla ${
                      ativo
                        ? "bg-white/20 text-white font-semibold shadow-xs"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/50 font-karla">
              {isAluno ? "Opções" : "Configurações"}
            </div>
            <div className="space-y-1">
              {linksConfig.map((item) => {
                const ativo = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors font-karla ${
                      ativo
                        ? "bg-white/20 text-white font-semibold shadow-xs"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>
    </>
  );
}
