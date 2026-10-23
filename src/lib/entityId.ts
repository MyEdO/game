/**
 * FABRIQUE D'IDS NEUFS (#2907) : `idNeuf(genre)` rend une identité qui CIRCULE (uid d'objet, id de héros, objet
 * invoqué, nonce de refus) — distincte de tout id de l'état où elle naît ET de tout id qui le rejoindra
 * (sauvegarde chargée, autre onglet, autre siège). Elle n'a pas de défaut : l'hôte la fournit à la partie
 * (`EntreesDeLaPartie.idNeuf`, `src/noyau/plateforme.ts`), qui la passe au moteur comme le `RNG`. `genre`
 * préfixe l'id (`it`, `hero`, `conjure`, `refus`) ; aucun lecteur n'en déduit rien.
 */
export type FabriqueDId = (genre: string) => string;

/** Une fabrique EN SÉQUENCE : `genre-n`, `n` compté depuis 1 par fabrique. Ses ids ne sont distincts que de ceux
 *  d'un état qui n'en porte aucun de cette forme : l'appelant le garantit (partie d'hôte ouverte sur
 *  `etatInitialDuJeu()`, banc de test). Deux fabriques fabriquent les mêmes ids. */
export function fabriqueEnSequence(): FabriqueDId {
  let n = 0;
  return (genre) => `${genre}-${++n}`;
}

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
