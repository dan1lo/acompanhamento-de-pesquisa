"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gerarResumoComIA } from "@/lib/actions/reunioes";

export function GerarResumoButton({ reuniaoId }: { reuniaoId: string }) {
  const router = useRouter();
  const [mascarar, setMascarar] = useState(false);
  const [nomes, setNomes] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    try {
      await gerarResumoComIA(reuniaoId, mascarar, nomes);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar resumo");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={mascarar} onChange={(e) => setMascarar(e.target.checked)} />
          Mascarar nomes de terceiros
        </label>
        {mascarar && (
          <input
            value={nomes}
            onChange={(e) => setNomes(e.target.value)}
            placeholder="nomes separados por vírgula"
            className="rounded border border-zinc-300 px-2 py-1"
          />
        )}
      </div>
      <button
        onClick={gerar}
        disabled={carregando}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {carregando ? "Gerando..." : "Gerar rascunho com IA"}
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
