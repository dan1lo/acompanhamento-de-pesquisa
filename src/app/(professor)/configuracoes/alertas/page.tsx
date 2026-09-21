import { requireProfessor } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { LIMITES_PADRAO } from "@/lib/status";
import { salvarConfiguracaoAlerta } from "@/lib/actions/configuracoes";
import { FormErrorBanner } from "@/components/form-error-banner";
import { SubmitButton } from "@/components/submit-button";

const NIVEIS = ["TCC", "MESTRADO", "DOUTORADO"] as const;

export default async function ConfiguracaoAlertasPage() {
  const professor = await requireProfessor();

  const configs = await prisma.configuracaoAlerta.findMany({ where: { professorId: professor.id } });
  const porNivel = new Map(configs.map((c) => [c.nivel, c]));

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-lg font-semibold">Limites de alerta por nível</h1>
      <p className="text-sm text-zinc-500">
        Dias sem reunião até o status mudar para &quot;atenção&quot; e &quot;crítico&quot;.
      </p>

      <div className="space-y-4">
        {NIVEIS.map((nivel) => {
          const config = porNivel.get(nivel) ?? LIMITES_PADRAO[nivel];
          return (
            <FormErrorBanner
              key={nivel}
              action={salvarConfiguracaoAlerta}
              className="flex items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4"
            >
              <input type="hidden" name="nivel" value={nivel} />
              <div className="flex-1">
                <p className="text-sm font-medium">{nivel}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Atenção (dias)</label>
                <input
                  name="diasAtencao"
                  type="number"
                  min={1}
                  defaultValue={"atencao" in config ? config.atencao : config.diasAtencao}
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Crítico (dias)</label>
                <input
                  name="diasCritico"
                  type="number"
                  min={1}
                  defaultValue={"critico" in config ? config.critico : config.diasCritico}
                  className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
              </div>
              <SubmitButton className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white">
                Salvar
              </SubmitButton>
            </FormErrorBanner>
          );
        })}
      </div>
    </div>
  );
}
