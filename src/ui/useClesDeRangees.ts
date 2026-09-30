import { useState } from 'react';

/**
 * CLÉS DE RANGÉE d'une liste éditable — primitive PARTAGÉE (#1993). Une rangée qui compose un champ
 * à ÉTAT (brouillon de `SourceRefField`, texte de `JsonField`, `<details>` ouvert…) garde sa clé tant
 * qu'elle existe : retirée, déplacée ou éditée, jamais son état ne passe à une voisine. La clé sert à
 * la fois de `key` React et de segment d'`identite`/`chemin` ; une rangée neuve en reçoit une jamais
 * servie.
 *
 * La liste reste CONTRÔLÉE par son porteur : les rangées se reconnaissent d'un rendu à l'autre par
 * RÉFÉRENCE (un retrait ou un déplacement garde les autres objets tels quels). Celles qui ne se
 * reconnaissent pas sont les rangées ÉDITÉES quand elles sont aussi nombreuses des deux côtés (elles
 * reprennent alors les clés libérées, dans l'ordre) ; sinon ce sont des rangées neuves.
 */
type Suivi = { liste: readonly unknown[]; cles: readonly number[]; prochaine: number };

const memesRangees = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length && a.every((x, i) => Object.is(x, b[i]));

function rapprocher(avant: Suivi, liste: readonly unknown[]): Suivi {
  const prises = avant.liste.map(() => false);
  const reconnues = liste.map((x) => {
    const j = avant.liste.findIndex((y, k) => !prises[k] && Object.is(x, y));
    if (j < 0) return undefined;
    prises[j] = true;
    return avant.cles[j];
  });
  const liberees = avant.cles.filter((_, k) => !prises[k]);
  const reprises = reconnues.filter((c) => c === undefined).length === liberees.length ? [...liberees] : [];
  let prochaine = avant.prochaine;
  const cles = reconnues.map((c) => c ?? reprises.shift() ?? prochaine++);
  return { liste, cles, prochaine };
}

export function useClesDeRangees(liste: readonly unknown[] | undefined): readonly number[] {
  const courante = liste ?? [];
  const [suivi, setSuivi] = useState<Suivi>(() => ({ liste: courante, cles: courante.map((_, i) => i), prochaine: courante.length }));
  if (memesRangees(suivi.liste, courante)) return suivi.cles;
  const suivant = rapprocher(suivi, courante);
  setSuivi(suivant);
  return suivant.cles;
}
