// Origem usada em redirecionamentos de auth. Em produção só vale NEXT_PUBLIC_SITE_URL:
// nunca o header Host da requisição. Retorna null quando não há origem confiável.
export function origemConfiavel(
  origemRequisicao: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const configurada = env.NEXT_PUBLIC_SITE_URL
  if (configurada) return configurada
  if (env.NODE_ENV === 'production') return null
  return origemRequisicao
}
