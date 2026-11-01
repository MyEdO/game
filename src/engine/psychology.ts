/**
 * Psychologie WFRP4 (Livre de base `21 - Psychologie.md`). Cœur PUR : déclenchement et résolution
 * des Tests de Calme / Psychologie. Jeu sans MJ → difficulté par défaut **Intermédiaire (+0)** (les
 * exemples du livre l'utilisent). P1 = Peur (Indice) / Terreur (Indice). Cf. spec :
 * docs/superpowers/specs/2026-06-07-psychologie-design.md
 */
import { Combatant, type Difficulty, type EffectSource } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { t } from '../i18n';
import { RNG } from './dice';
import { rollTest, evaluateTest, extendedTestStep, jetPose, type JetPose } from './tests';
import { rule } from './policy';
import { bonus, effectiveChar } from './characteristics';
import { testValue } from './skills';
import { findGroupById, findPsychologyById, psychologyLabel, refLabel, talents } from '../data';
import type { Relatif } from '../data/schemas/defs/groups';
import { isEngagedWith } from './engagement';
import type { PlayerText } from '../i18n/playerText';
import { ciblePsyLue, estCibleType, identiteDeCiblage, selonCible, varianteDe, type CiblePsy } from './psych/ciblage';
import { opPsy } from './psych/opsPsy';
import { SizeCategory, sizeGap } from './size';
import { isOutOfAction, removeActiveEffects } from './conditions';
import { groupMatch, groupesDe, groupesPercus, racesDe } from './groups';
import { campOf, relationBetween } from './relations';
import { bellicosePsychImmune, traitCapability } from './traits/dispatch';
import { featuresOf } from './combatFeatures/dispatch';
import { diseasePsychTraits } from './disease';
import { applyActiveEffect, type GameOp } from './ops';
import type { Flow } from './flowCore';

export type PsychType =
  | 'peur'
  | 'terreur'
  | 'frenesie'
  | 'animosite'
  | 'haine'
  | 'prejuge'
  | 'amour'
  | 'camaraderie'
  | 'phobie'
  | 'trauma';

/** Trait psychologique POSSÉDÉ (Animosité(Elfes), Phobie(Serpents), capacité de Frénésie…). */
export interface PsychTrait {
  type: PsychType;
  cible?: CiblePsy;
  indice?: number;
  /** PROVENANCE d'un Trait ACCORDÉ (`grantPsychTrait`) — absente sur un Trait natif. */
  src?: EffectSource;
}

/** Affliction psychologique ACTIVE en combat, posée après un Test de Psychologie raté. Conservée
 *  pour la rencontre (évite le re-déclenchement) ; « sous Peur » : `sousPeur`. */
export interface PsychAffliction {
  type: PsychType;
  /** Créature source (Peur/Terreur) ou groupe ciblé. */
  sourceId?: string;
  cible?: CiblePsy;
  /** Indice de Peur à surmonter (Test étendu de Calme), lu par `indiceDePeur`. */
  indice?: number;
  /** DR cumulé du Test ÉTENDU de Calme (Peur), vers l'Indice. */
  calmeDR?: number;
  /** Peur SURMONTÉE : le Test étendu a atteint l'Indice, ou Sans Peur (Ennemi) l'a ignorée. LDB 21 l.25 ;
   *  LDB 10 l.1051. Lu par `sousPeur`. */
  surmontee?: boolean;
  /** N° de Round du dernier Test de Calme (le Test étendu est UNE fois par Round). */
  lastTestRound?: number;
  /** Trait CIBLÉ (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie) : `true` = affliction non résistée
   *  (effets actifs, re-testable pour y mettre fin) ; `false` = testé et résisté (marqueur inerte
   *  empêchant le re-déclenchement ce rencontre). */
  active?: boolean;
  /** Instance NÉE d'un Test de Psychologie (posée par `psychBranchOps`, l'une ou l'autre branche) — par
   *  opposition à une pose AUTHORÉE (op `beginPsych` d'un effet). Seules les premières sont bornées à leur
   *  rencontre (`endEncounterPsych`, LDB 21 l.9). La Peur HÉRITÉE d'une Terreur ne le porte pas : elle est
   *  la mémoire « déjà affrontée » (l.54), pas l'affliction du Test. */
  fromTest?: boolean;
}

/** Libellés (icône + nom) des Traits psy ciblés — DÉRIVÉS de `psychology.json` (SOURCE UNIQUE, comme
 *  `etats.json` pour les États — même champ `icon` du registre `<Icon>`, id `famille/nom`). Partagé
 *  par les modales psy (combat + rencontre) et la narration. */
export const cibleLabel = (type: string): { icon: string; label: string } | undefined => {
  const p = findPsychologyById(type);
  return p?.cibles ? { icon: p.icon ?? '', label: p.label } : undefined;
};

/** Ce qui peut déclencher, ou subir, un Trait psy ciblé : un combattant, ou l'interlocuteur d'un Test social
 *  décrit par ses Groupes (`FlowTest.vsGroups`). */
export type SourcePsy =
  | { genre: 'combattant'; c: Combatant }
  | { genre: 'interlocuteur'; groups: readonly string[] };

/** Ce qu'un lecteur regarde de la source : ce qu'elle EST (`groupesDe`), ou ce que l'observateur en
 *  PERÇOIT (`groupesPercus`). #3045 */
type Lecture = 'appartenance' | 'percu';

/** Les Groupes de la source selon la `lecture` ; un interlocuteur n'a que ceux que le Test lui décrit. */
const groupesLus = (s: SourcePsy, lecture: Lecture): readonly string[] =>
  s.genre === 'interlocuteur' ? s.groups : lecture === 'appartenance' ? groupesDe(s.c) : groupesPercus(s.c);

/** La source est-elle le porteur lui-même ? */
const estLePorteur = (s: SourcePsy, porteur: Combatant): boolean => s.genre === 'combattant' && s.c.id === porteur.id;

/** La source est-elle visée par un lien du porteur, un Trait qui le fait venir en aide à sa Cible menacée
 *  (`triggerOn: 'threatened'`) ? Un lien à Cible relative ne compte pas. LDB 21 l.75, l.81 ; #3045 */
const lieAuPorteur = (s: SourcePsy, porteur: Combatant, lecture: Lecture): boolean =>
  effectivePsychTraits(porteur).some((t) => t.cible !== undefined && findPsychologyById(t.type)?.triggerOn === 'threatened' && viseSelon(t.cible, s, lecture, porteur, false));

/** La lecture de chaque Groupe relatif (`GroupData.relatif`), rapportée au porteur. #3045 */
const RELATIFS: Record<Relatif, (s: SourcePsy, porteur: Combatant, lecture: Lecture) => boolean> = {
  // LDB 85 l.282 ; Q12 B, #3045
  engagesAvecPorteur: (s, porteur) => s.genre === 'combattant' && isEngagedWith(porteur, s.c.id),
  // Q15 A, #3045
  etrangersAuPorteur: (s, porteur, lecture) =>
    !lieAuPorteur(s, porteur, lecture) &&
    (s.genre === 'interlocuteur' || relationBetween({ id: s.c.id, camp: campOf(s.c) }, { id: porteur.id, camp: campOf(porteur) }) === 'opponent'),
  // LDB 19 l.152 ; EDOC 12 l.219 ; #3045
  autresRacesQueLePorteur: (s, porteur, lecture) => {
    const siennes = racesDe(groupesDe(porteur));
    return !estLePorteur(s, porteur) && !racesDe(groupesLus(s, lecture)).some((r) => siennes.includes(r));
  },
};

/** `vise`, les Groupes relatifs lus ou non (`relatifs`). */
function viseSelon(cible: CiblePsy, s: SourcePsy, lecture: Lecture, porteur: Combatant, relatifs: boolean): boolean {
  return selonCible(cible, {
    groupe: (id) => {
      const relatif = findGroupById(id)?.relatif;
      return relatif ? relatifs && RELATIFS[relatif](s, porteur, lecture) : groupMatch(id, groupesLus(s, lecture));
    },
    individu: (id) => s.genre === 'combattant' && s.c.id === id,
  });
}

/** La Cible `cible` d'un Trait psy de `porteur` vise-t-elle la source `s`, selon la `lecture` du lecteur ?
 *  Seul prédicat de ciblage d'un Trait psy : les jokers se résolvent par `groupMatch`, les Groupes relatifs
 *  par rapport au porteur (`RELATIFS`), un individu par l'id du combattant. #3045 */
export function vise(cible: CiblePsy, s: SourcePsy, lecture: Lecture, porteur: Combatant): boolean {
  return viseSelon(cible, s, lecture, porteur, true);
}

/** Sujet à la Peur. LDB 21 l.25 */
export function sousPeur(p: PsychAffliction): boolean {
  return p.type === 'peur' && !p.surmontee;
}

/** L'Indice d'une Peur portée, seul lecteur du champ. Une pose authorée peut l'omettre (`GameOpEditor`,
 *  op `beginPsych`) : Peur 0, le plancher du Test étendu (`extendedTestStep`). */
export function indiceDePeur(p: PsychAffliction): number {
  return p.indice ?? 0;
}

/** « Si la créature est considérée comme AGRESSIVE » (LDB 85 l.383) : porte de la Peur/Terreur de
 *  TAILLE, lue ENVERS `cible`. Deux ADVERSAIRES DÉCLARÉS (camps opposés dont aucun n'est neutre) le
 *  sont par défaut. Dès qu'un NEUTRE est en jeu, le camp ne dit rien : seul le COMPORTEMENT tranche,
 *  comme entre membres d'un même camp — le lien Engagé, posé par la résolution d'une attaque de mêlée
 *  et SYMÉTRIQUE (LDB 13 l.169-171), ou la trace ORIENTÉE d'une attaque portée ce Round
 *  (`attackedThisRound`, `markAttacked`) : hors mêlée aucun texte ne pose de réciprocité, la victime
 *  d'un tir n'est donc pas rendue agressive envers son tireur.
 *  Pur : ne lit que les camps, l'Engagement et les attaques du Round. */
export function agressifEnvers(
  source: Pick<Combatant, 'id' | 'kind' | 'engagedWith' | 'attackedThisRound'>,
  cible: Pick<Combatant, 'id' | 'kind' | 'engagedWith'>,
): boolean {
  if (source.id === cible.id) return false;
  const [cs, cc] = [campOf(source), campOf(cible)];
  if (cs !== 'neutral' && cc !== 'neutral' && relationBetween({ id: source.id, camp: cs }, { id: cible.id, camp: cc }) === 'opponent') return true;
  return !!source.engagedWith?.includes(cible.id)
    || !!cible.engagedWith?.includes(source.id)
    || !!source.attackedThisRound?.includes(cible.id);
}

/** Source de Peur/Terreur que `foe` représente pour `self` — TROIS portes distinctes : la Taille (LDB 85
 *  l.381-383), l'Indice inspiré au statbloc (`causesPeur`/`causesTerreur`, Trait « Peur (Indice) » LDB 85
 *  l.264-266 : « engendre de la Peur surnaturelle chez les autres créatures »), et le Trait psy CIBLÉ de
 *  `self` déclaré `targetCauses` (Phobie, LDB 21 l.87). Elles DIFFÈRENT : le Trait de statbloc ne connaît ni
 *  camp ni condition, la Taille passe par `agressifEnvers`, la Phobie vit sur l'OBSERVATEUR et matche le
 *  Groupe de `foe`. Terreur prime ; sinon le plus haut Indice. Pur.
 *  NB : « Sans Peur (Ennemi) » (LDB 10 l.1051) ne supprime PLUS la source ici (ce n'était pas RAW : le
 *  talent n'accorde pas l'immunité automatique mais « un seul Test de Calme Accessible (+20) » pour
 *  l'ignorer) — la source est donc détectée, et le porteur la teste à +20 (cf. `sansPeurVs`). */
export function fearSourceFor(self: Combatant, foe: Combatant, selfSizeForSize?: SizeCategory): { kind: 'peur' | 'terreur'; indice: number } | null {
  const cands: { kind: 'peur' | 'terreur'; indice: number }[] = [];
  // Cavalier émérite (AA 13 l.25) : la Taille prise en compte pour la Peur/Terreur causée UNIQUEMENT par la
  // Taille de l'adversaire est celle de la MONTURE (`selfSizeForSize`, fourni par l'appelant qui connaît la
  // bataille) — les Indices `causesPeur`/`causesTerreur` du statbloc (démon/mort-vivant) restent inchangés.
  const size = agressifEnvers(foe, self) ? peurTerreurFromSize(foe.size, selfSizeForSize ?? self.size) : null;
  if (size) cands.push(size);
  if (foe.causesTerreur) cands.push({ kind: 'terreur', indice: foe.causesTerreur });
  if (foe.causesPeur) cands.push({ kind: 'peur', indice: foe.causesPeur });
  // Phobie (LDB 21 l.87) : la TROISIÈME porte, portée par l'OBSERVATEUR — l'objet du Trait est traité comme
  // causant la Peur de son Indice, donc tout le régime de la Peur (Test étendu, −1 DR, approche) s'applique.
  cands.push(...targetCausedSourcesFor(self, foe));
  if (!cands.length) return null;
  const terr = cands.filter((c) => c.kind === 'terreur');
  const best = (terr.length ? terr : cands).reduce((a, b) => (b.indice > a.indice ? b : a));
  if (best.kind === 'peur' && psychImmuneToFrom(self, foe, 'peur')) return null; // LDB 21 l.41/l.75
  return best;
}

/** Mode de RÉSOLUTION d'un état psy + ses conséquences d'échec, lus en DONNÉES (`psychology.json`) — SOURCE
 *  UNIQUE de l'applier `combatPsych` et du picker de Round : plus de `kind === 'terreur'` codé par-nom. */
export function psychResolution(kind: PsychType): { mode?: 'extended' | 'terreur' | 'binary'; failCondition?: string; failAmount?: { base?: 'indice' | number; perDegreeOfFailure?: number }; becomes?: PsychType } {
  const d = findPsychologyById(kind);
  return { mode: d?.resolution, failCondition: d?.failCondition, failAmount: d?.failAmount, becomes: d?.becomes as PsychType | undefined };
}

/** Le Test de Psychologie d'un état, lu en DONNÉES (`psychology.json` `test`) — SOURCE UNIQUE du Test de
 *  combat, de la bande de rencontre, de l'IA et de la puce d'état ; défauts : en-tête de ce module.
 *  `sansPeur` : Accessible. LDB 10 l.1051 */
export function psychTest(kind: PsychType, sansPeur = false): { skill: RefDesignee; difficulty: Difficulty } {
  const td = findPsychologyById(kind)?.test;
  return { skill: td?.skill ?? { id: 'calme' }, difficulty: sansPeur ? 'accessible' : td?.difficulty ?? 'intermediaire' };
}

/** Une affliction psy est-elle ACTIVE ? Ciblé : drapeau `active` ; sinon `sousPeur`. */
export function isAfflictionActive(p: PsychAffliction): boolean {
  if (estCibleType(p.type)) return p.active === true;
  return sousPeur(p);
}

/** Une affliction psy (`PsychAffliction`) PÈSE-t-elle sur le héros ? `isAfflictionActive`, Frénésie
 *  comprise (`isFrenzied`). LDB 21 l.33 */
export function isPsychAfflictionActive(p: PsychAffliction): boolean {
  return p.type === 'frenesie' || isAfflictionActive(p);
}

/** SIÈGE UNIQUE des immunités psy portées par une affliction ACTIVE de `self`, pour un CANAL donné —
 *  LDB 21 l.41 (Haine, `immuneToFromTarget` : seulement contre un membre de sa Cible, « mais pas
 *  Terreur ») et l.75 (Amour, `immuneWhileActive`, hors-groupe). Pour ce second canal, « tant que vous
 *  défendez les êtres aimés » est PORTÉ PAR `active` : `refreshDefendedPsych` (seul détenteur du
 *  roster) l'éteint dès qu'aucun aimé n'est présent et en état d'être défendu. Aucun roster n'est donc
 *  requis ICI — les 3 résolutions d'attaque (`combineOpposed`/`resolveMeleePassive`/`resolveRanged`)
 *  n'en ont aucun en portée et lisent pourtant le MÊME verdict que `fearSourceFor`/`encounterPsych`.
 *  Data-driven : aucune entité nommée, aucun canal codé. */
export function psychImmuneToFrom(self: Combatant, foe: Combatant, channel: string): boolean {
  for (const p of self.psychState ?? []) {
    if (p.active !== true) continue;
    const d = findPsychologyById(p.type);
    if (d?.immuneWhileActive?.includes(channel)) return true;
    if (d?.immuneToFromTarget?.includes(channel) && p.cible && vise(p.cible, { genre: 'combattant', c: foe }, 'appartenance', self)) return true;
  }
  return false;
}

/** LDB 21 l.75 — « tant que vous DÉFENDEZ les êtres aimés » : une affliction déclarée `immuneWhileActive`
 *  (Amour) cesse d'être ACTIVE dès qu'aucun membre de sa Cible n'est PRÉSENT et en état d'être défendu
 *  (ni mort ni hors de combat : on ne défend pas un cadavre). Cette fonction n'ÉTEINT que : l'allumage
 *  reste l'exclusivité de la branche d'ÉCHEC du Test de Psychologie — rallumer ici ressusciterait le
 *  marqueur d'un Test RÉUSSI (`active:false`), qui partage la même entrée (upsert type+cible).
 *  Appelée par les détenteurs du roster (ouverture de Round, purge de mort, ouverture de rencontre) pour
 *  que `active` porte le fait, et que tous les consommateurs purs le lisent sans le recalculer. Mute `c`,
 *  rend `true` si le verdict a changé. Data-driven : aucune entité nommée. */
export function refreshDefendedPsych(c: Combatant, present: Combatant[]): boolean {
  let changed = false;
  for (const p of c.psychState ?? []) {
    if (p.active !== true || !p.cible || !findPsychologyById(p.type)?.immuneWhileActive) continue;
    const defendable = present.some((v) => v.id !== c.id && !v.dead && !isOutOfAction(v) && vise(p.cible!, { genre: 'combattant', c: v }, 'appartenance', c));
    if (!defendable) { p.active = false; changed = true; }
  }
  return changed;
}

/** Les Cibles des afflictions ACTIVES de `porteur` à pulsion d'attaque (`attackDR.vs: 'group'` : Animosité,
 *  Haine), que son vivier d'attaque vise en priorité. LDB 21 l.21, l.41 ; #3045 */
export function ciblesAPulsion(porteur: Pick<Combatant, 'psychState'>): CiblePsy[] {
  return (porteur.psychState ?? []).flatMap((p) => (p.active && p.cible !== undefined && findPsychologyById(p.type)?.attackDR?.vs === 'group' ? [p.cible] : []));
}

/** Les combattants en action, de TOUT `kind`, que vise en appartenance une Cible à pulsion de `porteur`
 *  (`ciblesAPulsion`) : son vivier d'attaque s'étend à eux, alliés compris. LDB 21 l.21, l.41 ; #3045 */
export function ciblesDePulsion(porteur: Combatant, combattants: readonly Combatant[]): Combatant[] {
  const cibles = ciblesAPulsion(porteur);
  if (!cibles.length) return [];
  return combattants.filter((c) => c.id !== porteur.id && !c.dead && !isOutOfAction(c) && cibles.some((cb) => vise(cb, { genre: 'combattant', c }, 'appartenance', porteur)));
}

/** `refreshDefendedPsych` pour TOUT un roster (chacun mesuré contre l'ensemble) — forme appelée par les
 *  détenteurs du roster : ouverture de Round, purge de mort/hors-combat, ouverture de rencontre. */
export function refreshAllDefendedPsych(all: Combatant[]): boolean {
  let changed = false;
  for (const c of all) if (refreshDefendedPsych(c, all)) changed = true;
  return changed;
}

/** BORNE DE RENCONTRE (LDB 21 l.9, verbatim) : « Sur un succès, les effets sont annulés jusqu'à la fin de
 *  la rencontre, même si d'autres Tests peuvent être nécessaires si les circonstances changent. » — les
 *  afflictions NÉES D'UN TEST (`fromTest`, marqué à l'INSTANCE par `psychBranchOps`) sont bornées à LEUR
 *  rencontre : ni l'affliction subie, ni le marqueur de Test réussi ne survivent à la suivante, où la même
 *  source se re-teste. Ne sont PAS balayés : les Traits POSSÉDÉS (`psychTraits`), les poses AUTHORÉES
 *  (op `beginPsych` d'un effet — elles suivent leur propre règle), et la Peur HÉRITÉE d'une Terreur, qui
 *  porte la mémoire « déjà affrontée » lue par `collectHeroRoundStartPsych` (LDB 21 l.54 : « pour la
 *  première fois », pas « une fois par scène »). Mute `c`, rend `true` s'il y avait quelque chose à clore.
 *  (En combat, la borne existe déjà : `carryOverState` ne reporte pas `psychState`.) */
export function endEncounterPsych(c: Combatant): boolean {
  if (!c.psychState?.length) return false;
  const kept = c.psychState.filter((p) => !p.fromTest);
  if (kept.length === c.psychState.length) return false;
  c.psychState = kept;
  return true;
}

/** Les Traits psy CIBLÉS de `self` déclarés `targetCauses`, résolus en Cible + régime + Indice ; l'Indice
 *  de l'instance possédée l'emporte sur le défaut de la donnée. LDB 21 l.87 ; LDB 85 l.122 ; #3045 */
function targetCausesEntries(self: Combatant): { cible: CiblePsy; kind: 'peur' | 'terreur'; indice: number }[] {
  const out: { cible: CiblePsy; kind: 'peur' | 'terreur'; indice: number }[] = [];
  for (const tr of effectivePsychTraits(self)) {
    const tc = findPsychologyById(tr.type)?.targetCauses;
    if (!tc || !tr.cible) continue;
    const indice = tr.indice ?? tc.indice;
    if (indice >= 0) out.push({ cible: tr.cible, kind: tc.kind as 'peur' | 'terreur', indice });
  }
  return out;
}

/** Les sources de Peur/Terreur que `foe` représente pour `self` du seul fait de ses Traits `targetCauses`
 *  (LDB 21 l.87). Consommé par `fearSourceFor` (combat). Data-driven, pur. */
export function targetCausedSourcesFor(self: Combatant, foe: Combatant): { kind: 'peur' | 'terreur'; indice: number }[] {
  return targetCausesEntries(self)
    .filter((e) => vise(e.cible, { genre: 'combattant', c: foe }, 'percu', self))
    .map((e) => ({ kind: e.kind, indice: e.indice }));
}

/** Premier Test dû à `self` du fait d'un Trait `targetCauses` face aux entités `visible` (LDB 21 l.87) —
 *  MÊME forme de retour que `targetedTrigger`, pour la porte HORS COMBAT (`encounterPsych`) : l'objet de
 *  la Phobie ouvre la bande du régime qu'il CAUSE (Peur), pas un Test propre. Une source déjà affrontée
 *  (affliction portant son `sourceId`) ne se re-déclenche pas, et les immunités du canal s'appliquent
 *  ICI aussi — MÊME verdict que `fearSourceFor` sur la même situation (l.41/l.75). Pur. */
export function targetCausedTrigger(self: Combatant, visible: Combatant[]): { kind: 'peur' | 'terreur'; indice: number; sourceId: string; cible: CiblePsy } | null {
  for (const e of targetCausesEntries(self)) {
    const m = visible.find(
      (v) =>
        v.id !== self.id &&
        !(self.psychState ?? []).some((p) => p.type === e.kind && p.sourceId === v.id) &&
        (e.kind !== 'peur' || !psychImmuneToFrom(self, v, 'peur')) &&
        vise(e.cible, { genre: 'combattant', c: v }, 'percu', self),
    );
    if (m) return { kind: e.kind, indice: e.indice, sourceId: m.id, cible: e.cible };
  }
  return null;
}

/** RAW LDB 21 : les Traits CIBLÉS `endedByOtherPsych` (Animosité, Préjugé) cessent dès que leur porteur
 *  tombe sous un AUTRE effet psychologique DOMINANT actif (Peur/Terreur/Haine — soit toute affliction
 *  active qui n'est PAS elle-même `endedByOtherPsych`). Mute `psychState` (désactive), renvoie les types
 *  désactivés (narration). Data-driven, générique : aucune entité nommée. */
export function suppressSupersededPsych(c: Combatant): PsychType[] {
  const dominant = (c.psychState ?? []).filter((o) => isAfflictionActive(o) && !findPsychologyById(o.type)?.endedByOtherPsych);
  const out: PsychType[] = [];
  for (const p of c.psychState ?? []) {
    if (p.active !== true || !findPsychologyById(p.type)?.endedByOtherPsych) continue;
    if (dominant.some((o) => o !== p)) { p.active = false; out.push(p.type); }
  }
  return out;
}

/** Les afflictions ÉCLIPSÉES par un effet dominant, SUPPRIMÉES puis NOMMÉES (`LDB 21 l.21`) — SOURCE
 *  UNIQUE de la queue partagée par les deux résolutions de Test psy (combat et rencontre) : elles
 *  suppriment et journalisent d'un seul geste au lieu de recomposer la même phrase chacune. */
export function supersededLines(c: Combatant, name: string): string[] {
  return suppressSupersededPsych(c).map((tp) => t('turn.psychSuperseded', { name, psych: psychologyLabel(tp) }));
}

/** `self` porte-t-il « Sans Peur » (possédé, ou accordé sans spécialisation) contre l'ennemi `foe` qu'il
 *  RENCONTRE ? Éligibilité au Test allégé, jamais une immunité. LDB 10 l.1051 ; #3045 */
export function sansPeurVs(self: Combatant, foe: Combatant): boolean {
  return featuresOf(self).some(({ def, ctx }) => {
    if (!def.fearImmune) return false;
    if (ctx.spec == null) return true;
    const cible = ciblePsyLue(ctx.spec);
    return cible !== undefined && varianteDe(cible) === 'groupe' && vise(cible, { genre: 'combattant', c: foe }, 'percu', self);
  });
}

/** `sansPeurVs` face à une source NOUVELLE de Peur/Terreur (`kind` non ciblé, aucune Peur déjà posée par
 *  `foe`) : le Test allégé de la rencontre, pour les deux portes héros (combat, rencontre). LDB 10 l.1051 */
export function sansPeurFace(self: Combatant, kind: PsychType, foe: Combatant | undefined): boolean {
  if (!foe || estCibleType(kind)) return false;
  return !(self.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === foe.id) && sansPeurVs(self, foe);
}

/** Psychologie DATA-DRIVEN (Peur/Terreur/Immunité + ciblés Animosité/Haine/Préjugé/Amour/Camaraderie/
 *  Phobie/Effrayé) : `parsePsychTraits` lit `TraitData.capabilities` (`psychType`/`psychImmune`/
 *  `psychIndice` de `traits.json`) + l'instance structurée. SOURCE UNIQUE = la DONNÉE (éditable au
 *  Codex) ; plus aucun fichier de code par trait. */
export { parsePsychTraits } from './psych/registry';

/** Baume pour un esprit blessé (LDB 43 l.70) : « Tous les Traits Psychologiques sont retirés pour la
 *  durée du Miracle » — les Traits psy de `c` sont DÉPLACÉS hors de la fiche (à porter par
 *  l'ActiveEffect `suppressedPsych`) ; les afflictions actives (`psychState`), dérivées des
 *  Traits, sont apaisées avec eux. Retourne les Traits suspendus, ou null s'il n'y en a aucun. */
export function suppressPsychTraits(c: Combatant): PsychTrait[] | null {
  const traits = c.psychTraits ?? [];
  if (!traits.length) return null;
  c.psychTraits = [];
  c.psychState = [];
  return traits;
}

/** Restitue les Traits psy suspendus par les effets EXPIRÉS (fin de Round OU échéance d'horloge). */
export function restoreSuppressedPsych(c: Combatant, expired: { suppressedPsych?: PsychTrait[] }[]): void {
  for (const e of expired) {
    if (e.suppressedPsych?.length) c.psychTraits = [...(c.psychTraits ?? []), ...e.suppressedPsych];
  }
}

/** Peur/Terreur inspirée par la Taille (LDB 85 l.381-383), du point de vue de `self` face à `foe` :
 *  écart ≥ 1 cat. → Peur (Indice = écart) ; ≥ 2 → Terreur. `foe` plus petit/égal → rien. */
export function peurTerreurFromSize(foe?: SizeCategory, self?: SizeCategory): { kind: 'peur' | 'terreur'; indice: number } | null {
  const gap = sizeGap(foe, self); // > 0 si `foe` est plus grand
  if (gap >= 2) return { kind: 'terreur', indice: gap };
  if (gap >= 1) return { kind: 'peur', indice: gap };
  return null;
}

/**
 * Immunité à la Psychologie — PRÉDICAT CENTRAL (toute source d'immunité passe par ici) :
 * - trait « Immunité (Psychologie) » (`psychImmune`, LDB 85 l.143-144) ;
 * - Frénésie active (LDB 21 l.33) ;
 * - Détermination « immunisé à Psychologie jusqu'à la fin du prochain Round » (LDB 17 l.59), via le
 *   compteur `psychImmuneRoundsLeft` (décrémenté au passage de Round) → l'immunité ne fait que RETARDER :
 *   à expiration, les déclencheurs/effets reprennent (sauf si la source est morte entre-temps).
 * Round-indépendant : utilisable autant dans les déclencheurs (collectHeroRoundStart/EndPsych…) que
 * dans les modificateurs purs (attackModifiers). Futurs Talents/effets d'immunité psy : ajouter ICI.
 */
export function isPsychImmune(c: Combatant, foesMaxAdvantage?: number): boolean {
  // Belliqueux (LDB 85 l.49) : « Tant qu'elle a plus d'Avantages que son adversaire, elle gagne
  // Immunité Psychologique » — `foesMaxAdvantage` = le meilleur Avantage de ses adversaires ENGAGÉS
  // (fourni par les appelants qui ont le contexte de bataille ; absent ⇒ trait inerte).
  if (foesMaxAdvantage != null && bellicosePsychImmune(c, foesMaxAdvantage)) return true;
  // Immunité par DONNÉE : trait « Immunité (Psychologie) » (`c.psychImmune`), Détermination temporaire
  // (`ActiveEffect.psychImmune`), OU un état psy porté qui l'accorde (Frénésie → `psychology.json`
  // `psychImmune:true`, LDB 21 l.33) — lu GÉNÉRIQUEMENT, jamais par-nom.
  return !!c.psychImmune
    || (c.activeEffects ?? []).some((e) => e.psychImmune)
    || (c.psychState ?? []).some((p) => findPsychologyById(p.type)?.psychImmune);
}

/** À sang-froid (LDB 85 l.13) : « Elle peut inverser tous ses Tests de Force Mentale échoués » —
 *  un jet RATÉ est relu avec ses chiffres inversés (91 → 19) si cela le rend réussi. Pur. */
export function coldBloodedAdjust(
  t: { roll: number; target: number; success: boolean; sl: number },
  coldBlooded: boolean,
): { roll: number; target: number; success: boolean; sl: number } {
  if (!coldBlooded || t.success) return t;
  const rev = t.roll === 100 ? 100 : (t.roll % 10) * 10 + Math.floor(t.roll / 10) || 100; // 30 → 3 ; « 00 » inchangé
  const e = evaluateTest(rev, t.target);
  return e.success ? { roll: e.roll, target: e.target, success: e.success, sl: e.sl } : t;
}

const EFFET_IMMUNITE_PSY = 'determination-psych';

/** Détermination (LDB 17 l.59) : immunité à la Psychologie jusqu'à la fin du prochain Round. Portée par un
 *  `ActiveEffect` à durée 2 Rounds (système de Durée unifié : décrémenté/expiré au passage de Round). */
export function spendResolveForPsychImmunity(c: Combatant): string | null {
  if ((c.resolve ?? 0) <= 0) return null;
  c.resolve = (c.resolve ?? 0) - 1;
  removeActiveEffects(c, (e) => e.effectId === EFFET_IMMUNITE_PSY);
  applyActiveEffect(c, { label: 'Détermination (immunité psy)', effectId: EFFET_IMMUNITE_PSY, bonus: 0, duration: { scale: 'rounds', left: 2 }, psychImmune: true });
  return t('psy.determinationImmune', { name: c.label });
}

/** Retire de TOUS les combattants les afflictions psychologiques (Peur/Terreur/traits ciblés)
 *  générées par la créature `deadId` — LDB : les effets psy d'une créature prennent fin à sa mort.
 *  Mute `psychState`. (Les États génériques déjà acquis, ex. Brisé, restent — ils ont leur propre
 *  récupération ; seul le lien Peur↔source disparaît, donc plus de re-Test ni de −1 DR vs la source.)
 *  EXCEPTION : une affliction dont la porte est le GROUPE `cible`, pas l'individu (`immuneWhileActive` —
 *  Amour, LDB 21 l.75 : « les êtres aimés », au pluriel), ne s'arbitre PAS ici — la chute d'UN aimé ne la
 *  clôt pas tant qu'un autre est défendable. Son verdict est celui de `refreshDefendedPsych`, que les
 *  appelants enchaînent avec le roster en main. */
export function clearPsychOf(all: Combatant[], deadId: string): void {
  for (const c of all) {
    if (!c.psychState?.length) continue;
    c.psychState = c.psychState.filter((p) => p.sourceId !== deadId || !!findPsychologyById(p.type)?.immuneWhileActive);
  }
}

/** Le combattant peut-il entrer en Frénésie (LDB 21 l.31) ? Trait de créature, Talent « Frénésie »,
 *  OU Trait psy 'frenesie' OCTROYÉ (mutation / maladie active — ex. Rage meurtrière), lu via
 *  `effectivePsychTraits` (seul point de lecture des psychTraits, dérivés-maladie compris). */
export function isFrenzyCapable(c: Combatant): boolean {
  return traitCapability(c.traits, 'frenzyCapable')
    || (c.talents ?? []).some((t) => t.talentId === 'frenesie')
    || effectivePsychTraits(c).some((p) => p.type === 'frenesie');
}

/** Le combattant est-il EN Frénésie (LDB 21 l.33) ? État psychologique porté `frenesie` (`psychState`,
 *  posé par l'entrée — Action héros / décision IA / Rage).
 *  Lu par le combat (charge, gating, +1 BF via données, immunité psy, attaque libre). */
export function isFrenzied(c: Combatant): boolean {
  return (c.psychState ?? []).some((p) => p.type === 'frenesie');
}

/** Test de Force Mentale pour entrer en Frénésie (LDB 21 l.31). Succès → on entre. */
export function resolveFrenzyEntry(fm: number, rng: RNG): JetPose {
  return jetPose(rollTest(fm, 'intermediaire', rng));
}

/** Valeur de Test de Calme (`testValue`, États compris, LDB 16 l.125). */
export function calmeValue(c: Combatant): number {
  return testValue(c, 'calme');
}

/** Un pas du Test ÉTENDU de Calme contre la Peur, depuis le DR cumulé `prevDR`. LDB 21 l.25 ;
 *  LDB 10 l.1051. Seule arithmétique de la Peur, partagée par l'IA (`resolvePeurTest`) et la bande des
 *  héros (`resolveCombatPsychRow`). */
export function pasDePeur(
  prevDR: number,
  r: { success: boolean; sl: number },
  indice: number,
  sansPeur = false,
): { calmeDR: number; surmontee: boolean } {
  if (sansPeur && r.success) return { calmeDR: Math.max(prevDR, indice), surmontee: true };
  const step = extendedTestStep(prevDR, r, indice, !!rule('test-extended-min-sl'));
  return { calmeDR: step.total, surmontee: step.done };
}

/** Un Round de Test ÉTENDU de Calme contre la Peur (LDB 21 l.25) : jette le Test, puis `pasDePeur`.
 *  `sansPeur` : Test Accessible (+20). LDB 10 l.1051 */
export function resolvePeurTest(
  calme: number,
  indice: number,
  prevDR: number,
  rng: RNG,
  coldBlooded = false, // À sang-froid (LDB 85 l.13) : inverse un Test de FM raté
  sansPeur = false,
): { dr: number; calmeDR: number; surmontee: boolean; roll: number; target: number; sl: number; success: boolean } {
  const t = coldBloodedAdjust(rollTest(calme, psychTest('peur', sansPeur).difficulty, rng), coldBlooded);
  const pas = pasDePeur(prevDR, t, indice, sansPeur);
  return { dr: pas.calmeDR - prevDR, calmeDR: pas.calmeDR, surmontee: pas.surmontee, roll: t.roll, target: t.target, sl: t.sl, success: t.success };
}

/** Issue d'un pas de Peur, pour les deux camps : tenue, ignorée par Sans Peur réussi, ou surmontée par le
 *  Test étendu. LDB 21 l.25 ; LDB 10 l.1051 */
export function issueDePeur(r: { success: boolean; surmontee: boolean }, sansPeur: boolean): 'tient' | 'ignoree' | 'surmontee' {
  if (!r.surmontee) return 'tient';
  return sansPeur && r.success ? 'ignoree' : 'surmontee';
}

/** Libellé du Talent qui porte `fearImmune` (Sans Peur). LDB 10 l.1051 ; fiche `user-doctrine-ids-stables-labels-affichage` */
export function sansPeurLabel(): PlayerText {
  const talent = talents.find((x) => x.combat?.fearImmune);
  if (!talent) throw new Error('sansPeurLabel : aucun Talent ne porte `combat.fearImmune`');
  return refLabel('talents', { id: talent.id });
}

/** La Peur héritée d'une Terreur naît-elle surmontée ? LDB 21 l.56 ; LDB 10 l.1051. Une seule règle
 *  pour les héros (`psychBranchOps`) et l'IA (`resolveTerreurTest`). */
function peurHeriteeSurmontee(r: { success: boolean; sansPeur?: boolean }): boolean {
  return !!r.sansPeur && r.success;
}

/** Traits psychologiques EFFECTIFS de `c` : ceux STOCKÉS (`c.psychTraits` — natifs, mutations, sorts
 *  accordés) PLUS ceux DÉRIVÉS des maladies ACTIVES (symptômes manifestés portant `grantPsychTrait` — Rage
 *  meurtrière → Haine + Frénésie). POINT DE LECTURE UNIQUE des Traits psy possédés : un symptôme actif rend
 *  son porteur sujet au Trait tant que la maladie dure et le perd à la guérison, SANS attache/détache (re-
 *  dérivé à chaque lecture, comme les pénalités continues `diseasePassiveOps`). Lu par les déclencheurs
 *  (`targetedTrigger`) et la pénalité sociale (`skills.containedSocialPenalty`). Les manipulations qui
 *  ÉCRIVENT la donnée persistée (acquisition `animositeOrHaine`, suppression « Baume », sérialisation)
 *  restent sur `c.psychTraits` brut — un Trait transitoire de maladie ne s'acquiert ni ne se suspend.
 *
 *  « Vous êtes mon meilleur ami ! » (Ivresse 3-4, LDB 09 l.480) : « Ignorez tous vos Préjugés et
 *  toutes vos Animosités existants » — un porteur d'`ActiveEffect.ignoreAnimosity` (op générique
 *  `ignoreAnimosity`, kind-agnostique) ne possède plus les Traits `animosite`/`prejuge` tant que
 *  l'effet dure : ni nouveau déclenchement (`targetedTrigger`), ni malus social contenu
 *  (`skills.containedSocialPenalty`/`socialPsychMod`). */
export function effectivePsychTraits(c: Combatant): PsychTrait[] {
  const derived = diseasePsychTraits(c);
  const all = derived.length ? [...(c.psychTraits ?? []), ...derived] : (c.psychTraits ?? []);
  if ((c.activeEffects ?? []).some((e) => e.ignoreAnimosity)) {
    return all.filter((p) => p.type !== 'animosite' && p.type !== 'prejuge');
  }
  return all;
}

/** Premier Trait psy CIBLÉ de `self` déclenché ce Round : un membre du groupe `cible` est VISIBLE dans la
 *  SITUATION que l'entrée déclare (`triggerOn`, `psychology.json`) et le trait n'est pas déjà en affliction
 *  active. Aucun filtre de CAMP : les textes ne parlent que du Groupe-Cible (Animosité LDB 21 l.19 « un
 *  groupe de personnes ou de créatures », Haine l.39, Préjugé l.45, Amour l.75, Camaraderie l.81).
 *  `triggerOn:'threatened'` (Amour l.75 « Vous devez venir en aide à quelqu'un que vous aimez s'il se
 *  retrouve menacé », Camaraderie l.81) exige en plus qu'un TIERS visible soit agressif envers ce membre —
 *  jamais `self` : on ne se porte pas au secours contre soi-même. La menace se mesure par `agressifEnvers`,
 *  donc un membre NEUTRE de la Cible n'est « menacé » que par un comportement constaté (Engagement ou
 *  attaque du Round), là où un membre du camp joueur l'est déjà par la présence d'un hostile déclaré.
 *  `visible` = combattants en Ligne de Vue (filtrée par l'appelant, couche state). Une Cible indéfinie
 *  (« un au choix ») est inerte. Pur.
 *  Un Trait déclaré `targetCauses` (Phobie, LDB 21 l.87) n'a PAS de Test propre : son objet est une source
 *  de Peur (`fearSourceFor`), et c'est le régime de la Peur qui l'ouvre — jamais une seconde bande. */
export function targetedTrigger(self: Combatant, visible: Combatant[]): { type: PsychType; cible: CiblePsy; sourceId: string; indice?: number } | null {
  for (const tr of effectivePsychTraits(self)) {
    if (!tr.cible) continue; // « un au choix » → inerte
    const d = findPsychologyById(tr.type);
    if (d?.targetCauses) continue; // résolu par le régime de la Peur
    const identite = identiteDeCiblage(tr.type, tr.cible);
    if ((self.psychState ?? []).some((p) => identiteDeCiblage(p.type, p.cible) === identite)) continue; // déjà testé/actif
    const needsThreat = d?.triggerOn === 'threatened';
    const m = visible.find(
      (v) =>
        v.id !== self.id &&
        vise(tr.cible!, { genre: 'combattant', c: v }, 'percu', self) &&
        (!needsThreat || visible.some((a) => a.id !== self.id && agressifEnvers(a, v))),
    );
    if (m) return { type: tr.type, cible: tr.cible, sourceId: m.id, indice: tr.indice };
  }
  return null;
}

/** Test de Psychologie SIMPLE (Calme, Intermédiaire +0) d'un trait ciblé (LDB 21) : succès = résisté.
 *  Binaire (pas de Test étendu) — contrairement à la Peur. */
export function resolveCalmeSimple(calme: number, rng: RNG): { success: boolean; roll: number; sl: number; target: number } {
  const t = rollTest(calme, 'intermediaire', rng);
  return { success: t.success, roll: t.roll, sl: t.sl, target: t.target };
}

/** Quantité d'état infligée par un Test BINAIRE raté (résolution `'terreur'`), EN DONNÉES (`failAmount`) :
 *  `base` (l'Indice de l'affliction via `'indice'`, ou un nombre FIXE) + `perDegreeOfFailure` × DR négatifs.
 *  Défauts `{ base:'indice', perDegreeOfFailure:1 }` = la règle Terreur (Indice + |DR|, LDB 21 l.54) — un
 *  nouvel État/Psy peut infliger une quantité propre (fixe, ou par DR seul) sans code. L'appelant n'invoque
 *  ce calcul que sur un ÉCHEC (le succès n'inflige rien) : SOURCE UNIQUE. */
export function failConditionAmount(
  spec: { base?: 'indice' | number; perDegreeOfFailure?: number } | undefined,
  indice: number,
  sl: number,
): number {
  const { base, perDeg } = failAmountSpec(spec, indice);
  return base + perDeg * Math.max(0, -sl);
}

/** Les deux termes de `failAmount` résolus pour un Indice donné : la part FIXE et la part PAR DEGRÉ
 *  d'échec. Mutualisée par le calcul direct (`failConditionAmount`) et par la dérivation en ops
 *  (`psychBranchOps`, où la part par degré devient `valuePerSL{onFailure}`) — une seule lecture de la
 *  donnée, donc aucune dérive possible entre le nombre appliqué et le nombre annoncé. */
function failAmountSpec(
  spec: { base?: 'indice' | number; perDegreeOfFailure?: number } | undefined,
  indice: number,
): { base: number; perDeg: number } {
  return {
    base: spec?.base === undefined || spec.base === 'indice' ? indice : spec.base,
    perDeg: spec?.perDegreeOfFailure ?? 1,
  };
}

/** L'entrée de Psychologie MISE EN JEU par un Test, telle que la déclarent les deux sites (bande de
 *  rencontre `encounterPsych`, bande de combat `combatPsych`) : l'entrée affrontée, sa source, sa
 *  Cible et son Indice. */
export interface PsychStake {
  kind: PsychType;
  sourceId?: string;
  cible?: CiblePsy;
  indice: number;
}

/**
 * CONSÉQUENCES d'un Test de Psychologie, en `GameOp[]` — SOURCE UNIQUE des deux appliers (rencontre
 * et combat) ET de l'annonce d'issues (#1117 : `meta.onSuccess`/`onFail` → `branchCertainOps` → chips
 * codex-liées). DÉRIVÉE de l'entrée `psychology.json` (`resolution`/`failCondition`/`failAmount`/
 * `becomes`) : aucune conséquence n'est rédigée par entrée.
 *
 * · résolution `'terreur'` (LDB 21 l.54-56) — échec : `failCondition` à la quantité déclarée (part
 *   fixe en `value`, part par degré d'échec en `valuePerSL{onFailure}` — résolue par `applyOps` avec
 *   le DR du jet) ; PUIS l'entrée `becomes` posée à PLEIN Indice, quel que soit le résultat (#1190),
 *   surmontée d'emblée si `sansPeur` a réussi (`peurHeriteeSurmontee`).
 * · Traits CIBLÉS — l'entrée est posée `active` selon l'issue : subie sur un échec, marqueur inerte
 *   (non re-déclenchable) sur une réussite.
 * · Peur (Test ÉTENDU, l.25) — l'entrée porte son Indice ; `calmeDR` et `surmontee` n'existent qu'à la
 *   RÉSOLUTION (le site les calcule, `pasDePeur` en combat, et les passe ici) ; l'op qui les omet les fait
 *   retomber (upsert de `beginPsych`, `ops.ts`).
 *
 * `round` : n° de Round du Test (combat), absent hors combat. PURE.
 */
export function psychBranchOps(
  stake: PsychStake,
  outcome: { success: boolean; calmeDR?: number; surmontee?: boolean; sansPeur?: boolean; round?: number },
): GameOp[] {
  const res = psychResolution(stake.kind);
  const anchor = {
    ...(stake.sourceId != null ? { sourceId: stake.sourceId } : {}),
    ...(outcome.round != null ? { lastTestRound: outcome.round } : {}),
  };
  if (res.mode === 'terreur') {
    const ops: GameOp[] = [];
    const { base, perDeg } = failAmountSpec(res.failAmount, stake.indice);
    if (!outcome.success && res.failCondition && (base > 0 || perDeg > 0)) {
      ops.push({
        op: 'condition', id: res.failCondition, value: base,
        ...(perDeg ? { valuePerSL: { every: 1, amount: perDeg, onFailure: true } } : {}),
      });
    }
    // `becomes` SANS `fromTest` : la Peur héritée n'est pas l'affliction du Test, c'est la mémoire
    // « cette créature a déjà inspiré sa Terreur » (l.54) — elle traverse la borne de rencontre.
    if (res.becomes) {
      ops.push(opPsy.pose(res.becomes, { indice: stake.indice, calmeDR: 0, surmontee: peurHeriteeSurmontee(outcome), ...anchor }));
    }
    return ops;
  }
  if (estCibleType(stake.kind)) {
    return [opPsy.pose(stake.kind, {
      active: !outcome.success, fromTest: true, ...(stake.cible != null ? { cible: stake.cible } : {}), ...anchor,
    })];
  }
  return [opPsy.pose(stake.kind, {
    indice: stake.indice, fromTest: true,
    ...(outcome.calmeDR != null ? { calmeDR: outcome.calmeDR } : {}),
    ...(outcome.surmontee != null ? { surmontee: outcome.surmontee } : {}), ...anchor,
  })];
}

/** Les MÊMES conséquences, en branche de Flow — ce que l'étape SÉRIALISE dans son `meta`
 *  (`onSuccess`/`onFail`) pour que la surface de jet dérive ses issues des ops effectives
 *  (`branchCertainOps` → chips codex-liées, #1117), avant comme après le jet. Ce que seule la
 *  résolution connaît (DR cumulé du Test étendu, n° de Round) en est absent : l'annonce ne porte
 *  que ce qui est certain. */
export function psychBranchFlow(stake: PsychStake, success: boolean): Flow {
  return { kind: 'do', effect: { type: 'ops', on: 'target', ops: psychBranchOps(stake, { success }) } };
}

// ---------------------------------------------------------------------------
// Acquisition de Traits psychologiques (ADE II 09), règle optionnelle `psych-acquisition-optional` :
// fonctions PURES qui DÉCIDENT du Trait à poser ; sa pose et son déclenchement vivent dans `noyau/`.
// ---------------------------------------------------------------------------

/** Phobie du noir (ADE II 09 l.9, LDB 21 l.85-87) : la Phobie à POSER (+ `resetCounter`), `null` sous le seuil, règle
 *  éteinte ou `cause` absente. `cause` : id de Groupe de la source de la Terreur. PUR ; compteur et
 *  pose à l'appelant. */
export function gainPhobieIfThreshold(
  c: Combatant,
  cumulativeBriseFromTerreur: number,
  cause: CiblePsy | undefined,
): { phobie: PsychTrait & { cible: CiblePsy }; resetCounter: true } | null {
  if (!cause || !rule('psych-acquisition-optional')) return null;
  if (cumulativeBriseFromTerreur < bonus(effectiveChar(c, 'force-mentale'))) return null;
  return { phobie: { type: 'phobie', cible: cause, indice: 1 }, resetCounter: true };
}

/** Animosité & Haine (ADE II 09 l.15 ; Cible : ADE II (VO) 09 l.14) : Test de Calme Intermédiaire (+0) seedé, et le Trait à poser sur un
 *  échec (`haine` REMPLACE l'Animosité de même Cible, `replacesAnimosite`). `cible` : id de Groupe
 *  de l'adversaire ; `null` si la règle est éteinte ou `cible` absente. PUR. */
export function animositeOrHaine(
  c: Combatant,
  cible: CiblePsy | undefined,
  rng: RNG,
): { test: { success: boolean; roll: number; sl: number; target: number }; trait?: PsychTrait & { cible: CiblePsy }; replacesAnimosite?: boolean } | null {
  if (!cible || !rule('psych-acquisition-optional')) return null;
  const test = resolveCalmeSimple(calmeValue(c), rng); // Calme Intermédiaire (+0)
  if (test.success) return { test };
  const animosite = identiteDeCiblage('animosite', cible);
  const hasAnimosite = (c.psychTraits ?? []).some((p) => identiteDeCiblage(p.type, p.cible) === animosite);
  return hasAnimosite
    ? { test, trait: { type: 'haine', cible }, replacesAnimosite: true }
    : { test, trait: { type: 'animosite', cible }, replacesAnimosite: false };
}

/** Un porteur PERSISTÉ, tel qu'il arrive du stockage : ses Traits psy, ceux que suspendent ses effets, ses
 *  afflictions. */
type PorteurDeCiblesPsy = {
  psychTraits?: readonly { cible?: unknown }[];
  psychState?: readonly { cible?: unknown }[];
  activeEffects?: readonly { suppressedPsych?: readonly { cible?: unknown }[] }[];
};

/** La Cible de `p` est une chaîne qu'aucune Cible ne lit (`ciblePsyLue` : ni Groupe de `groups.json` ni
 *  individu, la chaîne vide comprise) ; une Cible absente n'est pas jugée. */
const cibleInconnue = (p: { cible?: unknown } | null | undefined): boolean => typeof p?.cible === 'string' && ciblePsyLue(p.cible) === undefined;

/** `v` s'il est une liste, `[]` sinon : un champ persisté se lit sans être présumé. */
const liste = <T,>(v: readonly T[] | undefined): readonly T[] => (Array.isArray(v) ? v : []);

/** Les Traits psy que porte `c` (Traits, Traits suspendus d'un effet, afflictions), entrées `null` comprises. */
const traitsPsyPortes = (c: PorteurDeCiblesPsy | null | undefined) =>
  [...liste(c?.psychTraits), ...liste(c?.psychState), ...liste(c?.activeEffects).flatMap((e) => liste(e?.suppressedPsych))];

/** Les Cibles inconnues (`cibleInconnue`) que nomment les Traits psy de combattants PERSISTÉS (sauvegarde, roster, export
 *  de héros), lus tels qu'ils arrivent du stockage : `[]` = rien à nommer (#1463 LD.1, LDB 21 l.17-21). Une Cible
 *  vide se retire sans se nommer. */
export function ciblesPsyInconnues(porteurs: unknown): string[] {
  if (!Array.isArray(porteurs)) return [];
  return porteurs.flatMap((c: PorteurDeCiblesPsy | null) => traitsPsyPortes(c).filter(cibleInconnue).map((p) => p!.cible as string).filter((id) => id !== ''));
}

/** `p` sans ses Traits psy (Traits, Traits suspendus d'un effet, afflictions) à Cible inconnue, retirés
 *  ENTIERS (LDB 21 l.17-21), lu tel qu'il arrive du stockage ; `p` lui-même s'il n'en porte aucun. */
export function sansCiblesPsyInconnues<P extends PorteurDeCiblesPsy>(p: P): P {
  if (!traitsPsyPortes(p).some(cibleInconnue)) return p;
  const garder = <T extends { cible?: unknown }>(v: readonly T[]) => v.filter((x) => !cibleInconnue(x));
  return {
    ...p,
    ...(Array.isArray(p.psychTraits) ? { psychTraits: garder(p.psychTraits) } : {}),
    ...(Array.isArray(p.psychState) ? { psychState: garder(p.psychState) } : {}),
    ...(Array.isArray(p.activeEffects)
      ? { activeEffects: p.activeEffects.map((e) => (Array.isArray(e?.suppressedPsych) ? { ...e, suppressedPsych: garder(e.suppressedPsych) } : e)) }
      : {}),
  };
}

/** Trauma (ADE II Annexe I) : « Si un Personnage est témoin d'un événement qui rend l'une de ses Ambitions
 *  complètement irréalisable, il doit effectuer un Test de Calme Accessible (+20). En cas d'échec, il
 *  développe un Trauma Psychologique. » PUR / seedé : lance le Test de Calme Accessible et renvoie sa
 *  résolution + le Trait `trauma` à poser sur un échec. Réussite (ou règle éteinte) → aucun Trait. */
export function traumaOnImpossibleAmbition(
  c: Combatant,
  rng: RNG,
): { test: { success: boolean; roll: number; sl: number; target: number }; trait?: PsychTrait } | null {
  if (!rule('psych-acquisition-optional')) return null;
  const t = rollTest(calmeValue(c), 'accessible', rng); // Calme Accessible (+20)
  const test = { success: t.success, roll: t.roll, sl: t.sl, target: t.target };
  return t.success ? { test } : { test, trait: { type: 'trauma' } };
}

/** Test de Terreur à la 1ʳᵉ rencontre (LDB 21 l.54-56) : échec → Brisé = Indice + |DR négatifs| ;
 *  ensuite la créature cause une Peur de même Indice, quel que soit le résultat (`becomes`).
 *  `sansPeur` : Test Accessible (+20), et `peurSurmontee` (`peurHeriteeSurmontee`). LDB 10 l.1051 */
export function resolveTerreurTest(
  calme: number,
  indice: number,
  rng: RNG,
  coldBlooded = false, // À sang-froid (LDB 85 l.13) : inverse un Test de FM raté
  sansPeur = false,
): { success: boolean; brise: number; peurSurmontee: boolean; roll: number; target: number; sl: number } {
  const t = coldBloodedAdjust(rollTest(calme, psychTest('terreur', sansPeur).difficulty, rng), coldBlooded);
  const brise = t.success ? 0 : failConditionAmount(psychResolution('terreur').failAmount, indice, t.sl);
  return { success: t.success, brise, peurSurmontee: peurHeriteeSurmontee({ success: t.success, sansPeur }), roll: t.roll, target: t.target, sl: t.sl };
}
