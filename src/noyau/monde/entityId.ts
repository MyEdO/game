/**
 * Id d'entité STABLE et UNIQUE : `${kind}-${n}` (n base36, plus petit entier libre absent de
 * `taken`). Remplace `${kind}-${Date.now().toString(36)}` (collisions même-ms / duplication / import). PUR.
 */
export function nextEntityId(kind: string, taken: Iterable<string>): string {
  const set = taken instanceof Set ? taken : new Set(taken);
  let n = 0;
  let id = `${kind}-0`;
  while (set.has(id)) id = `${kind}-${(++n).toString(36)}`;
  return id;
}
