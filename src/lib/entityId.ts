/**
 * Id d'entité STABLE et UNIQUE : `${kind}-${n}` (n base36, plus petit entier libre absent de
 * `taken`). PUR.
 */
export function nextEntityId(kind: string, taken: Iterable<string>): string {
  const set = taken instanceof Set ? taken : new Set(taken);
  let n = 0;
  let id = `${kind}-0`;
  while (set.has(id)) id = `${kind}-${(++n).toString(36)}`;
  return id;
}

const PREFIXE_ETIQUETTE_D_OBJET = 'psy-objet:';

export function idDEtiquetteDObjet(porteur: string, uid: string): string {
  return PREFIXE_ETIQUETTE_D_OBJET + JSON.stringify([porteur, uid]);
}

export function estIdDEtiquetteDObjet(id: string): boolean {
  return id.startsWith(PREFIXE_ETIQUETTE_D_OBJET);
}
