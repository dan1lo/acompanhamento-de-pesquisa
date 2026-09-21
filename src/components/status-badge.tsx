const CORES: Record<string, string> = {
  OK: "bg-emerald-100 text-emerald-700",
  ATENCAO: "bg-amber-100 text-amber-700",
  CRITICO: "bg-red-100 text-red-700",
};

const ROTULOS: Record<string, string> = {
  OK: "Ok",
  ATENCAO: "Atenção",
  CRITICO: "Crítico",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CORES[status] ?? "bg-zinc-100 text-zinc-600"}`}>
      {ROTULOS[status] ?? status}
    </span>
  );
}
