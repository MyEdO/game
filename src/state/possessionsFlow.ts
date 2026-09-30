/**
 * Registre des POSSESSIONS (#615, SOCLE POSSESSIONS T1-c1) — plomberie pure `(get, set)`, même
 * patron que `merchantFlow`/`bourseFlow`. Le registre
 * `GameState.possessions` est le SEUL foyer d'existence des possessions (bêtes/serviteurs/véhicules/
 * navires/immeubles) : aucun mirroir, aucune copie par kind.
 */
import type { Possession, PossessionLocation, PossessionInput } from '../engine/possession';
import { canEmbark, possessionCapacity, possessionTotalEnc, embarkedEnc } from '../engine/possession';
import { possessionGrantsFromRefs } from '../engine/possessionGrants';
import { resolveTrappingChoices } from '../engine/trappingChoices';
import type { Get, Set } from './flowTypes';
import { t } from '../i18n';
import { makeRNG, hashSeed } from '../engine/dice';

export type { PossessionInput };

/** Sème les Possessions de dotation (`{creatureId}`/`{vehicleId}` des dotations de Classe/Carrière,
 *  #617/#618 SOCLE POSSESSIONS Lot 1) pour CHAQUE héros du groupe courant — SEAM = `store.ts`
 *  `startScene` (démarrage d'une partie neuve, seule couture qui repart d'un registre `possessions`
 *  vidé ; `loadGame`/`transitionTo` ne repassent JAMAIS ici, cf. §3 du brief Lot 1 — le registre
 *  chargé d'une save fait foi, aucun re-semis). Garde anti-double-semis : un héros qui a déjà UNE
 *  possession au registre n'est pas re-semé (défensif — `startScene` vide déjà le registre avant
 *  d'appeler ce seam, mais protège tout appelant futur). */
export function seedStartingPossessions(get: Get, set: Set): void {
  for (const hero of get().party) {
    if (!hero.career) continue;
    if (get().possessions.some((p) => p.ownerId === hero.id)) continue;
    // #2089 « Semis des Possessions : les choix de dotation du créateur sont ignorés »
    const refs = resolveTrappingChoices(hero.career, hero.careerLevel ?? 1, {});
    // RNG dédié au semis (déterministe par héros, `hashSeed`, patron `spawn.ts` mutations) — JAMAIS
    // `battleRng()` : le semis n'est pas du combat (#370 exclusivité seam ; #663, duel-naval — un
    // tirage de semis ne doit PAS consommer le RNG de combat partagé).
    const rng = makeRNG(hashSeed(`possession-seed:${hero.id}`));
    for (const grant of possessionGrantsFromRefs(refs, hero.id, rng)) addPossession(get, set, grant);
  }
}

/** Attribue un `uid` `pos-N` par SCAN du registre (anti-collision — jamais un compteur-module, cf.
 *  `newUid`/`it-N` de `engine/items.ts` qui ne convient qu'aux items). Ajoute au registre, renvoie l'uid. */
export function addPossession(get: Get, set: Set, p: PossessionInput): string {
  const existing = get().possessions;
  const maxN = existing.reduce((max, cur) => {
    const m = /^pos-(\d+)$/.exec(cur.uid);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  const uid = `pos-${maxN + 1}`;
  const full = { ...p, uid } as Possession;
  set((s) => ({ possessions: [...s.possessions, full] }));
  return uid;
}

/** Renomme l'instance (`label` — affichage pur, doctrine id/label). */
export function renamePossession(_get: Get, set: Set, uid: string, label: string): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, label } : p)) }));
}

/** Réaffecte le propriétaire (succession, don, vente). */
export function transferPossession(_get: Get, set: Set, uid: string, newOwnerId: string): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, ownerId: newOwnerId } : p)) }));
}

function setLocation(set: Set, uid: string, location: PossessionLocation): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, location } : p)) }));
}

/** Dépose la possession sur place (auberge, écurie…) — `placeId` omis = reste au lieu courant du
 *  groupe (l'appelant fournit l'id du lieu). */
export function stablePossession(_get: Get, set: Set, uid: string, placeId: string): void {
  setLocation(set, uid, { kind: 'au-lieu', placeId });
}

/** Reprend une possession déposée — elle voyage de nouveau avec le groupe. */
export function retrievePossession(_get: Get, set: Set, uid: string): void {
  setLocation(set, uid, { kind: 'avec-le-groupe' });
}

/** Embarque la possession sur un hôte (véhicule/navire — `hostUid` d'une autre possession du registre).
 *  Garde (§5 spec) : refuse en no-op journalisé si la NATURE est incompatible (`canEmbark`) ou si la
 *  capacité LIBRE de l'hôte (`possessionCapacity` − Σ `possessionTotalEnc` des déjà-embarquées, via
 *  `embarkedEnc` — SOURCE UNIQUE avec la gate `PossessionsScreen`/`canEmbarkNow`, #620 Lot 2) ne
 *  suffit pas au poids total de l'embarquée (`possessionTotalEnc`, contenance récursive). */
export function embark(get: Get, set: Set, uid: string, hostUid: string): void {
  const all = get().possessions;
  const child = all.find((p) => p.uid === uid);
  const host = all.find((p) => p.uid === hostUid);
  if (!child || !host) { get().log(t('pos.embarkNotFound')); return; }
  if (!canEmbark(child, host)) {
    get().log(t('pos.embarkNatureRefused', { childNature: child.nature, hostNature: host.nature }));
    return;
  }
  const capacity = possessionCapacity(host);
  if (capacity != null) {
    const usedEnc = embarkedEnc(hostUid, all);
    const childEnc = possessionTotalEnc(child, all);
    if (usedEnc + childEnc > capacity) {
      get().log(t('pos.embarkCapacityRefused', { used: usedEnc + childEnc, capacity }));
      return;
    }
  }
  setLocation(set, uid, { kind: 'embarquee', hostUid });
}

/** Débarque — la possession voyage de nouveau avec le groupe. */
export function disembark(_get: Get, set: Set, uid: string): void {
  setLocation(set, uid, { kind: 'avec-le-groupe' });
}

/** Abandon (§6, décision №4) — pose `destroyed`, la CONFIRMATION reste côté appelant/UI. */
export function abandonPossession(_get: Get, set: Set, uid: string): void {
  set((s) => ({ possessions: s.possessions.map((p) => (p.uid === uid ? { ...p, destroyed: true } : p)) }));
}

/** Ajoute un trait appris (`learnedTraits`, nature `bete` uniquement — LDB 23 → LDB 85, dresse-*). */
export function learnPossessionTrait(_get: Get, set: Set, uid: string, traitId: string): void {
  set((s) => ({
    possessions: s.possessions.map((p) => {
      if (p.uid !== uid || p.nature !== 'bete') return p;
      const learnedTraits = p.learnedTraits?.includes(traitId) ? p.learnedTraits : [...(p.learnedTraits ?? []), traitId];
      return { ...p, learnedTraits };
    }),
  }));
}

/** Possessions d'un propriétaire — inclut les détruites (l'appelant filtre s'il veut un journal). */
export const ownedPossessions = (possessions: Possession[], ownerId: string): Possession[] =>
  possessions.filter((p) => p.ownerId === ownerId);

export function possessionsByOwner(get: Get, ownerId: string): Possession[] {
  return ownedPossessions(get().possessions, ownerId);
}

/** Possessions par localisation — exclut les détruites (une possession détruite n'est plus « quelque
 *  part », elle est filtrée partout, `engine/possession.ts` PossessionCommon.destroyed). */
export function possessionsByLocation(get: Get, location: PossessionLocation['kind']): Possession[] {
  return get().possessions.filter((p) => !p.destroyed && p.location.kind === location);
}
