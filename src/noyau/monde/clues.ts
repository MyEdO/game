// Mécanique MAISON du carnet d'enquête (#670) — aucune règle RAW : le livre ne définit aucun
// système de carnet, seulement de la prose d'enquête. `Indice`/`Affaire` (données, `campaignNarratif.ts`)
// restent la SOURCE ; ce module ne porte que l'ÉTAT RUNTIME (quel stade est atteint, statut, épingle, nouveauté).
import type { Indice } from './campaignNarratif';

/** État runtime d'un indice révélé au carnet. Absent de `GameState.clues` = indice CACHÉ. */
export interface ClueState {
  /** id du stade actuellement atteint (dernier révélé). */
  stadeCourant: string;
  /** 'révélé' = piste active ; 'réfuté' = fausse piste (barrée mais RELISIBLE au carnet). */
  statut: 'révélé' | 'réfuté';
  /** Suivi joueur (épingle en tête du carnet). */
  épinglé?: boolean;
  /** Progression : un stade franchi + le gameTime (minutes) où il l'a été. Ordre chronologique. */
  historique: { stade: string; at: number }[];
  /** Sièges ayant affiché le DERNIER changement (#2415) : retiré par `revealClue`/`discreditClue`, posé
   *  par `marquerVus`. */
  vuParSiège?: Record<number, true>;
}

/**
 * Révèle/avance/RÉACTIVE un indice au carnet — résulte TOUJOURS en `statut: 'révélé'`. Les stades de
 * `Indice.stades` sont des PALIERS ORDONNÉS : `stadeCourant` est le plus AVANCÉ (rang dans `stades`)
 * entre l'existant et le stade cible, jamais un recul ; `historique` porte AU PLUS UNE entrée par
 * stade (un stade déjà lu n'est pas ré-ajouté), un stade antérieur non lu s'y ajoute sans
 * bouger `stadeCourant`. `stade` omis cible le PREMIER stade si l'indice est absent, sinon le stade
 * courant. Stade inconnu : avertissement + no-op. Seul vrai no-op (même Record) : cible déjà lue,
 * `stadeCourant` inchangé et statut déjà 'révélé'. Renvoie un Record NEUF, jamais de mutation.
 */
export function revealClue(
  clues: Record<string, ClueState>,
  indice: Indice,
  now: number,
  stade?: string,
): Record<string, ClueState> {
  const existing = clues[indice.id];
  let target: string;
  if (stade !== undefined) {
    if (!indice.stades.some((s) => s.id === stade)) {
      console.warn(`revealClue : stade « ${stade} » inconnu de l'indice « ${indice.id} ».`);
      return clues;
    }
    target = stade;
  } else if (!existing) {
    target = indice.stades[0].id;
  } else {
    target = existing.stadeCourant;
  }
  const rang = (id: string) => indice.stades.findIndex((s) => s.id === id);
  const déjàLu = existing?.historique.some((h) => h.stade === target) ?? false;
  const stadeCourant = existing && rang(existing.stadeCourant) >= rang(target) ? existing.stadeCourant : target;
  if (existing && déjàLu && stadeCourant === existing.stadeCourant && existing.statut === 'révélé') return clues;
  const historique = déjàLu ? existing!.historique : [...(existing?.historique ?? []), { stade: target, at: now }];
  return { ...clues, [indice.id]: { stadeCourant, statut: 'révélé', épinglé: existing?.épinglé, historique } };
}

/**
 * Écarte un indice comme fausse piste (`statut: 'réfuté'`) — reste consultable au carnet, barré.
 * Absent → créé d'abord révélé à son premier stade (une fausse piste jamais montrée au joueur avant
 * d'être écartée reste relisible), puis réfuté dans le même appel. Idempotent : indice DÉJÀ réfuté →
 * no-op (Record inchangé, pas de journal de bruit côté handler).
 */
export function discreditClue(
  clues: Record<string, ClueState>,
  indice: Indice,
  now: number,
): Record<string, ClueState> {
  const existing = clues[indice.id];
  if (!existing) {
    const premier = indice.stades[0].id;
    return { ...clues, [indice.id]: { stadeCourant: premier, statut: 'réfuté', historique: [{ stade: premier, at: now }] } };
  }
  if (existing.statut === 'réfuté') return clues;
  const { vuParSiège: _vus, ...réfuté } = existing;
  return { ...clues, [indice.id]: { ...réfuté, statut: 'réfuté' } };
}

/** Épingle/désépingle un indice PRÉSENT au carnet — no-op si l'indice est encore caché. */
export function togglePin(clues: Record<string, ClueState>, indiceId: string): Record<string, ClueState> {
  const existing = clues[indiceId];
  if (!existing) return clues;
  return { ...clues, [indiceId]: { ...existing, épinglé: !existing.épinglé } };
}

/** L'indice porte-t-il un changement que `seat` n'a pas affiché ? Seule définition de la nouveauté (#2415). */
export function estNouveauPour(clue: ClueState, seat: number): boolean {
  return !clue.vuParSiège?.[seat];
}

/** Ce qu'un Carnet a AFFICHÉ d'un indice : la longueur de son `historique`, son `statut` et son
 *  `stadeCourant` (#2415). */
export interface IndiceAffiché {
  id: string;
  étapes: number;
  statut: ClueState['statut'];
  stadeCourant: string;
}

/** L'affichage d'un indice tel qu'il est MAINTENANT — ce que le Carnet envoie à `marquerVus`. */
export function affichageDe(id: string, clue: ClueState): IndiceAffiché {
  return { id, étapes: clue.historique.length, statut: clue.statut, stadeCourant: clue.stadeCourant };
}

/** Marque VUS par `seat` les indices AFFICHÉS au Carnet. Un indice qui a changé depuis son affichage
 *  (`historique`, `statut` ou `stadeCourant` : intent arrivé après un `revealClue`/`discreditClue` de
 *  l'hôte) est ignoré.
 *  Record inchangé (même référence) si aucun n'est à marquer. */
export function marquerVus(clues: Record<string, ClueState>, affichés: readonly IndiceAffiché[], seat: number): Record<string, ClueState> {
  const àMarquer = affichés.filter(({ id, étapes, statut, stadeCourant }) => {
    const clue = clues[id];
    return !!clue && clue.historique.length === étapes && clue.statut === statut && clue.stadeCourant === stadeCourant
      && estNouveauPour(clue, seat);
  });
  if (àMarquer.length === 0) return clues;
  const out = { ...clues };
  for (const { id } of àMarquer) out[id] = { ...out[id], vuParSiège: { ...out[id].vuParSiège, [seat]: true } };
  return out;
}
