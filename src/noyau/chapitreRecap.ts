/**
 * CADRE DE CAMPAGNE (#717) — la borne d'ouverture d'un chapitre et la DÉRIVATION de son récap.
 *
 * Rien n'est archivé au fil du jeu : le récap se déduit d'un INSTANTANÉ pris à l'acquittement de
 * l'ouverture (`chapitreDepuis`) et des objectifs soldés (`objectifsSoldes`, poussés par l'Effet
 * `clearObjective`). La dérivation est PURE et testable hors store ; seul `armChapterRecapIfDue`
 * touche l'état, depuis la couture UNIQUE de fin d'application d'effets (`applyEffects`).
 */
import type { Combatant } from '../engine/types';
import { evalCondition } from '../engine/flowCore';
import type { RecapLine } from './recapLine';
import type { ClotureBlock } from '../data/schemas/defs-scenes/narratif';
import type { Get, Set as SetFn } from './flowTypes';
import type { Objective } from './etat';
import { condCtx } from './bourseFlow';
import { visiblePlaces } from './worldMap';
import type { SortiesDeFenetre } from './sortieDeFenetre';
import type { ValidationsDeFenetre } from './validationDeFenetre';
import { ouvrirLaFinDeSeance, terminerLaSeance } from './partyFlow';
import { nomDe } from '../engine/nom';

/** Borne d'ouverture du chapitre courant (#717) — instantané pris quand le joueur prend la route :
 *  le récap DÉRIVE de la différence, il n'écrit aucun événement au fil du jeu. */
export interface ChapitreDepuis {
  /** PX DISPONIBLES par héros à la borne (`Combatant.xp`) — le delta compte donc le gagné NET du
   *  chapitre : ce qui a été dépensé en Augmentations entre-temps n'est plus à répartir. */
  xpParHeros: Record<string, number>;
  /** Ids des héros VIVANTS à la borne — un mort d'AVANT n'est pas « tombé en chemin ». */
  vivants: string[];
  gameTime: number;
}

/** Le récap d'un chapitre CLOS (#717) — donnée d'affichage, dérivée, jamais persistée à part. */
export interface ChapterRecap {
  titre: string;
  sousTitre?: string;
  /** PX gagnés pendant le chapitre (somme des deltas de `Combatant.xp`). */
  px: number;
  /** Chronique du chapitre — vocabulaire PARTAGÉ des récaps (`RecapLine`, rendu `RecapLineSections`). */
  chronique: RecapLine[];
  /** Héros tombés PENDANT le chapitre (vivants à la borne, morts à la clôture). */
  tombes: { id: string; label: string }[];
  /** Libellés des lieux VISIBLES de la carte à la clôture (gating narratif `MapPlace.when`). */
  lieux: string[];
}

/** Instantané de borne pris à l'acquittement de l'ouverture (et re-pris à la clôture de séance). */
export function snapshotChapitre(party: Combatant[], gameTime: number): ChapitreDepuis {
  const xpParHeros: Record<string, number> = {};
  for (const h of party) xpParHeros[h.id] = h.xp ?? 0;
  return { xpParHeros, vivants: party.filter((h) => !h.dead).map((h) => h.id), gameTime };
}

/** Dérive le récap du chapitre — PURE (aucun accès au store). */
export function deriveChapterRecap(args: {
  cloture: ClotureBlock;
  depuis: ChapitreDepuis | null;
  objectifsSoldes: Objective[];
  party: Combatant[];
  lieux: string[];
}): ChapterRecap {
  const { cloture, depuis, objectifsSoldes, party, lieux } = args;
  const px = party.reduce((n, h) => n + ((h.xp ?? 0) - (depuis?.xpParHeros[h.id] ?? h.xp ?? 0)), 0);
  const tombes = party
    .filter((h) => h.dead && (depuis == null || depuis.vivants.includes(h.id)))
    .map((h) => ({ id: h.id, label: nomDe(h) }));
  const chronique: RecapLine[] = [
    ...objectifsSoldes.map((o): RecapLine => ({ text: o.text, icon: 'outil-de-carte/depart', tone: 'reussite', paquet: true })),
    ...tombes.map((t): RecapLine => ({ text: t.label, icon: 'interface/fermer', tone: 'echec' })),
  ];
  return { titre: cloture.titre, sousTitre: cloture.sousTitre?.texte, px, chronique, tombes, lieux };
}

/**
 * Arme le récap si la CLÔTURE authorée est vraie — couture UNIQUE, appelée à la fin de chaque lot
 * d'effets appliqué (`applyEffects`). Idempotente (un récap déjà armé ne se re-dérive pas) et
 * neutre hors campagne à `cloture`. Une CASCADE active (jour de voyage, psychologie…) tient l'écran :
 * le récap attend le lot d'effets suivant plutôt que de s'ouvrir par-dessus elle.
 *
 * Une clôture CONSOMMÉE (`clotureConsommee`, posé par la validation du récap, `fenetreValider('finDeChapitre')`) n'arme plus rien : la Condition
 * reste vraie après la séance close, si bien que sans ce fait le lot d'effets suivant — et chacun de
 * ceux d'après — rouvrirait un récap VIDE (archive vidée, borne re-posée : 0 PX, chronique vide).
 */
export function armChapterRecapIfDue(get: Get, set: SetFn): void {
  const s = get();
  const cloture = s.campaignNarratif?.cloture;
  if (!cloture || s.pendingChapterRecap || s.pendingOuverture || s.pendingCascade) return;
  if (s.clotureConsommee) return;
  if (!evalCondition(cloture.when, condCtx(get))) return;
  const lieux = s.worldMap ? visiblePlaces(s.worldMap, condCtx(get)).map((p) => p.label) : [];
  ouvrirLaFinDeSeance(set);
  set({
    pendingChapterRecap: deriveChapterRecap({
      cloture,
      depuis: s.chapitreDepuis,
      objectifsSoldes: s.objectifsSoldes,
      party: s.party,
      lieux,
    }),
  });
}

/** Les validations du cadre de campagne, gestes de l'HÔTE (`validation: 'hote'`, #717) : « Prendre la route » ferme
 *  l'ouverture et BORNE le chapitre (instantané PX/vivants/date) ; « Terminer la séance » termine la séance que le récap
 *  a ouverte (`terminerLaSeance`), ferme le récap, consomme la clôture et re-borne le chapitre suivant. */
export function validationsDuChapitre(get: Get, set: SetFn) {
  return {
    ouverture: () => set((s) => ({ pendingOuverture: null, chapitreDepuis: snapshotChapitre(s.party, s.gameTime) })),
    finDeChapitre: () => {
      terminerLaSeance(get, set);
      set((s) => ({ pendingChapterRecap: null, objectifsSoldes: [], chapitreDepuis: snapshotChapitre(s.party, s.gameTime), clotureConsommee: true }));
    },
  } satisfies Partial<ValidationsDeFenetre>;
}

/** AJOURNE le récap (Échap / « Plus tard ») et sa fin de séance : le chapitre reste clos en donnée, donc le récap se
 *  re-pose au prochain lot d'effets — rien n'est appliqué, rien n'est forcé. Sortie de l'hôte (`HORS_MODAL.finDeChapitre`). */
export function sortiesDuChapitre(_get: Get, set: SetFn) {
  return { finDeChapitre: () => set({ pendingChapterRecap: null, finDeSeance: null }) } satisfies Partial<SortiesDeFenetre>;
}
