/** Extrai a mensagem de um valor apanhado num catch (unknown). */
export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
