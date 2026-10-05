interface PageHeaderProps {
  titulo: string;
  descricao: string;
  /** Botões à direita do título (ex.: Exportar CSV). Empilham abaixo em telas pequenas. */
  acoes?: React.ReactNode;
  /** Texto curto de atualização, ex.: "Atualizado às 14:32" ou "Dados até 04/10/2026". */
  atualizadoEm?: string;
}

/** Cabeçalho padrão de toda página do app: único lugar com <h1>. */
export function PageHeader({ titulo, descricao, acoes, atualizadoEm }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
        {atualizadoEm && <p className="mt-1 text-xs text-muted-foreground">{atualizadoEm}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap gap-2">{acoes}</div>}
    </header>
  );
}
