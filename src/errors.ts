export function saveErrorMessage(error: unknown): string {
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  if (
    code === "42501" ||
    code === "PGRST301" ||
    /JWT expired|permission denied|row-level security/i.test(message)
  )
    return "Sua sessão não tem permissão para salvar. Entre novamente e confirme o autenticador. Se continuar, confira a autorização da carteira.";
  if (/outra (aba|sessão)|atualizada|versão/i.test(message))
    return "A carteira mudou em outra sessão. Seus dados não foram sobrescritos. Atualize a carteira e refaça esta alteração.";
  if (code === "23514" || /Dados inválidos|42702|ambiguous/i.test(message))
    return "O banco recusou os dados. Aplique a correção do validador de investimentos no Supabase e tente novamente. Se já aplicou, confira os campos informados.";
  if (/fetch|network|Failed to|conexão/i.test(message))
    return "Não foi possível conectar ao servidor. Confira sua conexão e tente salvar novamente; o formulário foi mantido.";
  return (
    message ||
    "Não foi possível salvar. Tente novamente. O formulário foi mantido."
  );
}
