/**
 * Registre des POSSESSIONS (#615, SOCLE POSSESSIONS T1-c1) — plomberie pure `(get, set)`, même
 * patron que `merchantFlow`/`bourseFlow`. Le registre
 * `Jeu.possessions` est le SEUL foyer d'existence des possessions (bêtes/serviteurs/véhicules/
 * navires/immeubles) : aucun mirroir, aucune copie par kind.
 */
import type { Possession, PossessionLocation, PossessionInput } from '../engine/possession';
import { refusDEmbarquer, possessionLabel, type RefusDEmbarquement } from '../engine/possession';
import { possessionGrantsFromRefs } from '../engine/possessionGrants';
import { resolveTrappingChoices } from '../engine/trappingChoices';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import { currentPlaceId } from './worldMap';
import { refuserGeste } from './refusVisible';
import { t } from '../i18n';
import { makeRNG, hashSeed } from '../engine/dice';
import type { ActionsDuNoyau } from './actionsDuNoyau';


/** Sème les Possessions de dotation (`{creatureId}`/`{vehicleId}` des dotations de Classe/Carrière,
 *  #617/#618 SOCLE POSSESSIONS Lot 1) pour CHAQUE héros du groupe courant — SEAM = `noyau/entreeEnScene.ts`
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

/** Geste de LOCALISATION d'une possession (registre `PossessionsScreen`, hôte texte, invité). */
export type GesteDePossession =
  | { kind: 'laisser' }
  | { kind: 'reprendre' }
  | { kind: 'debarquer' }
  | { kind: 'abandonner' }
  | { kind: 'embarquer'; hostUid: string };

/** Tranche d'état que lit le verdict : le registre, le groupe (propriétaires) et le lieu courant. */
export type EtatDesPossessions = Pick<Jeu, 'party' | 'possessions' | 'worldMap' | 'scene'>;

const texteDEmbarquement = (child: Possession, host: Possession, r: RefusDEmbarquement): string =>
  r.motif === 'nature'
    ? t('pos.embarkNatureRefused', { childNature: child.nature, hostNature: host.nature })
    : t('pos.embarkCapacityRefused', { used: r.used, capacity: r.capacity });

type Condition<G extends GesteDePossession> = (p: Possession, s: EtatDesPossessions, geste: G) => string | null;

/** Règle d'un geste : sa condition propre (forme de la localisation), et l'AUTRE BOUT du déplacement entre
 *  le groupe et une possession — la chose qui revient au groupe (`reprendre`), l'hôte qu'on quitte
 *  (`debarquer`) ou qu'on rejoint (`embarquer`). Cet autre bout doit être là où est le groupe (`refusDAcces`). */
interface RegleDeGeste<G extends GesteDePossession> {
  condition: Condition<G>;
  autreBout?: (p: Possession, s: EtatDesPossessions, geste: G) => Possession | undefined;
}

function hoteDe(p: Possession, s: EtatDesPossessions): Possession | undefined {
  const l = p.location;
  return l.kind === 'embarquee' ? s.possessions.find((h) => h.uid === l.hostUid && !h.destroyed) : undefined;
}

/** Une règle par geste. */
const REGLES: { [K in GesteDePossession['kind']]: RegleDeGeste<Extract<GesteDePossession, { kind: K }>> } = {
  laisser: {
    condition: (p, s) =>
      p.location.kind !== 'avec-le-groupe' ? t('pos.pasAvecLeGroupe') : currentPlaceId(s) == null ? t('pos.aucunLieu') : null,
  },
  reprendre: {
    condition: (p) => {
      if (p.nature === 'immeuble') return t('pos.immeubleImmobile');
      if (p.location.kind === 'au-lieu') return null;
      return p.location.kind === 'avec-le-groupe' ? t('pos.dejaAvecLeGroupe') : t('pos.reprendreEmbarquee');
    },
    autreBout: (p) => p,
  },
  debarquer: {
    condition: (p) =>
      p.location.kind === 'embarquee' ? null : p.location.kind === 'avec-le-groupe' ? t('pos.dejaAvecLeGroupe') : t('pos.pasEmbarquee'),
    autreBout: hoteDe,
  },
  abandonner: { condition: () => null },
  embarquer: {
    condition: (p, s, { hostUid }) => {
      if (p.location.kind !== 'avec-le-groupe') return t('pos.embarquerPasAvecLeGroupe');
      const host = s.possessions.find((h) => h.uid === hostUid && !h.destroyed);
      if (!host) return t('pos.embarkNotFound');
      const r = refusDEmbarquer(p, host, s.possessions);
      return r ? texteDEmbarquement(p, host, r) : null;
    },
    autreBout: (_p, s, { hostUid }) => s.possessions.find((h) => h.uid === hostUid && !h.destroyed),
  },
};

/** La possession `chose` est-elle là où est le groupe ? Avec le groupe, au lieu courant, ou embarquée sur un
 *  hôte qui l'est lui-même. `null` = oui ; sinon la raison. Condition PARTAGÉE de tout geste qui déplace
 *  une possession entre le groupe et un autre endroit. */
function refusDAcces(s: EtatDesPossessions, chose: Possession | undefined, vus: ReadonlySet<string> = new Set()): string | null {
  if (!chose) return t('pos.introuvable');
  if (vus.has(chose.uid)) return t('pos.ailleurs', { chose: possessionLabel(chose) });
  const ici = chose.location.kind === 'avec-le-groupe'
    || (chose.location.kind === 'au-lieu' && chose.location.placeId === currentPlaceId(s));
  if (ici) return null;
  if (chose.location.kind === 'embarquee') {
    const hote = hoteDe(chose, s);
    return hote ? refusDAcces(s, hote, new Set([...vus, chose.uid])) : t('pos.introuvable');
  }
  return t('pos.ailleurs', { chose: possessionLabel(chose) });
}

/** Refus d'un geste de localisation sur la possession `uid` : la raison affichée, ou `null`. Verdict
 *  UNIQUE des cinq gestes ci-dessous et du registre `PossessionsScreen`. */
export function refusGestePossession(s: EtatDesPossessions, uid: string, geste: GesteDePossession): string | null {
  const p = s.possessions.find((x) => x.uid === uid);
  const regle = REGLES[geste.kind] as RegleDeGeste<GesteDePossession>;
  return refusDeDetention(s, p)
    ?? regle.condition(p!, s, geste)
    ?? (regle.autreBout ? refusDAcces(s, regle.autreBout(p!, s, geste)) : null);
}

/** Refus commun à tout geste : la possession existe, n'est pas abandonnée, et appartient au groupe. */
function refusDeDetention(s: EtatDesPossessions, p: Possession | undefined): string | null {
  if (!p) return t('pos.introuvable');
  if (p.destroyed) return t('pos.dejaAbandonnee');
  return s.party.some((h) => h.id === p.ownerId) ? null : t('pos.horsDuGroupe');
}

/** Navires qui accueillent `uid` MAINTENANT (le joueur CHOISIT sa cale), et la raison quand il n'y en a
 *  aucun. */
export function ciblesDEmbarquement(s: EtatDesPossessions, uid: string): { cibles: Possession[]; refus: string | null } {
  const navires = s.possessions.filter((h) => h.nature === 'navire' && !h.destroyed && refusDAcces(s, h) == null);
  const cibles = navires.filter((h) => refusGestePossession(s, uid, { kind: 'embarquer', hostUid: h.uid }) == null);
  if (cibles.length) return { cibles, refus: null };
  const p = s.possessions.find((x) => x.uid === uid);
  const refus = refusDeDetention(s, p)
    ?? (p!.location.kind !== 'avec-le-groupe' ? t('pos.embarquerPasAvecLeGroupe') : navires.length === 0 ? t('pos.aucunNavire') : t('pos.calesPleines'));
  return { cibles, refus };
}

/** Applique `geste` s'il n'est pas refusé — sinon le refus se DIT (`refuserGeste`). */
function gesteDePossession(get: Get, set: Set, uid: string, geste: GesteDePossession, location: () => PossessionLocation): void {
  const refus = refusGestePossession(get(), uid, geste);
  if (refus) return void refuserGeste(get, set, refus);
  setLocation(set, uid, location());
}

/** Dépose la possession au lieu courant du groupe (auberge, écurie…). */
export function stablePossession(get: Get, set: Set, uid: string): void {
  gesteDePossession(get, set, uid, { kind: 'laisser' }, () => ({ kind: 'au-lieu', placeId: currentPlaceId(get())! }));
}

/** Reprend une possession déposée — elle voyage de nouveau avec le groupe. */
export function retrievePossession(get: Get, set: Set, uid: string): void {
  gesteDePossession(get, set, uid, { kind: 'reprendre' }, () => ({ kind: 'avec-le-groupe' }));
}

/** Embarque la possession sur un hôte (navire — `hostUid` d'une autre possession du registre) : nature ET
 *  capacité libre (`refusDEmbarquer`), hôte avec le groupe. */
export function embark(get: Get, set: Set, uid: string, hostUid: string): void {
  gesteDePossession(get, set, uid, { kind: 'embarquer', hostUid }, () => ({ kind: 'embarquee', hostUid }));
}

/** Débarque — la possession voyage de nouveau avec le groupe. */
export function disembark(get: Get, set: Set, uid: string): void {
  gesteDePossession(get, set, uid, { kind: 'debarquer' }, () => ({ kind: 'avec-le-groupe' }));
}

/** Abandon (§6, décision №4) — pose `destroyed`, la CONFIRMATION reste côté appelant/UI. */
export function abandonPossession(get: Get, set: Set, uid: string): void {
  const refus = refusGestePossession(get(), uid, { kind: 'abandonner' });
  if (refus) return void refuserGeste(get, set, refus);
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

export function creerActionsDesPossessions(get: Get, set: Set) {
  return {
    addPossession: (p) => addPossession(get, set, p),
    renamePossession: (uid, label) => renamePossession(get, set, uid, label),
    transferPossession: (uid, newOwnerId) => transferPossession(get, set, uid, newOwnerId),
    stablePossession: (uid) => stablePossession(get, set, uid),
    retrievePossession: (uid) => retrievePossession(get, set, uid),
    embark: (uid, hostUid) => embark(get, set, uid, hostUid),
    disembark: (uid) => disembark(get, set, uid),
    abandonPossession: (uid) => abandonPossession(get, set, uid),
    learnPossessionTrait: (uid, traitId) => learnPossessionTrait(get, set, uid, traitId),
  } satisfies Partial<ActionsDuNoyau>;
}
