import { PageHeader } from "@/components/layout/PageHeader";
import { GLOSSARIO } from "@/lib/glossario";

export default function GlossarioPage() {
  return (
    <div>
      <PageHeader titulo="Glossário" descricao="O que significa cada termo usado nas ferramentas." />

      <dl className="max-w-3xl divide-y divide-border rounded-xl border border-border bg-card">
        {GLOSSARIO.map((t) => (
          <div key={t.id} id={t.id} className="scroll-mt-24 px-5 py-4 target:bg-brand/10">
            <dt className="font-semibold text-foreground">{t.termo}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.definicao}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
