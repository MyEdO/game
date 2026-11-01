/**
 * États (conditions) — Livre de base, chapitre « États ».
 * Gestion minimale pour le combat tactique : ajout, empilement, retrait.
 */
import { Combatant, ActiveEffect, ConditionInstance, effectRef, type ModLine, type ConditionEmit, type ConditionLocks, type Difficulty } from './types';
import { evalCondition, walkFlow } from './flowCore';
import { conditionLockCtx } from './actorView';
import { tickRound, type Duration } from './duration';
import { conditionIds, conditionLabel, findConditionById, findPsychologyById, findSpellById, refLabel, skills } from '../data';
import { indexParId } from '../data/versionDataset';
import { t } from '../i18n';
import { rule } from './policy';
import { groupAdvantage } from './advantagePool';
import { bonus, effectiveChar, effectPool, retenirParPool, blessuresReconciliees } from './characteristics';
import { d100, RNG } from './dice';
import { passiveMods, passiveGlobalTestParts, settleHealedCriticals } from './trauma';
import { memeSource } from './suspension';
import type { GameOp, PairedSense } from './ops';
import type { CodexTarget } from './ruleRefs';
import { rollTest, isDoubleRoll, DIFFICULTY_LADDER, type TestResult } from './tests';
import { dropExpiredGrantedPsych, dropExpiredGrantedTraits } from './grantedTraits';
import { dropExpiredGrantedResources } from './grantedResources';
import { dropExpiredGrantedWeapons } from './conjuredWeapons';
import { dropExpiredGrantedMutations } from './corruption';
import { recomputeLoadout } from './items';
import { restoreSuppressedPsych } from './psychology';
import { hasActiveFlag } from './activeFlags';
import { isVehicle } from './coque';
import { applyOps, resolveWindowDuration } from './ops'; // cycle runtime (ops→conditions) : appelés au tick/à la dépense, jamais à l'init du module
import { cappedHealAmount } from './healing'; // cycle runtime (healing→conditions) : appelé à la dépense, jamais à l'init
import { isInanimate } from './structures'; // cycle runtime (structures→capabilities→disease→conditions) : appelés à la lecture d'un combattant, jamais à l'init
import { hasTalent } from './magic'; // cycle runtime (magic→combat→conditions) : appelé à la lecture de la Mort subite, jamais à l'init
import { aaDeathByCriticalCount } from './critical'; // cycle runtime (critical→combat→conditions) : appelé seulement dans inDeathCondition, jamais à l'init

/** Les 12 États CANONIQUES (LDB 16) à comportement moteur, par `id` STABLE (slug d'etats.json). Le
 *  moteur (pénalités, fin de Round, récupération) les référence via ces constantes — JAMAIS de chaîne
 *  magique. `ConditionInstance.name` reste OUVERT (string) : le Codex peut créer d'AUTRES États (posés/
 *  affichés ; leur mécanique RAW serait à câbler). Garde-fou de synchro `COND`⇄etats.json : `conditions.test`. */
export const COND = {
  assourdi: 'assourdi', aTerre: 'a-terre', aveugle: 'aveugle', brise: 'brise',
  empetre: 'empetre', empoisonne: 'empoisonne', enFlammes: 'en-flammes', extenue: 'extenue',
  hemorragique: 'hemorragique', inconscient: 'inconscient', sonne: 'sonne', surpris: 'surpris',
} as const;

/** Nombre de pions (cumul) d'un État donné. */
export const stacks = (c: Combatant, name: string) => { etatExige(name); return c.conditions.find((x) => x.id === name)?.value ?? 0; };

/** Cet État ne porte-t-il JAMAIS plus d'un pion ? Drapeau de DONNÉE (`etats.json`, `nonCumulable`),
 *  porté par les trois États que le RAW dit non cumulables — LDB 16 l.115 (Inconscient : « L'État
 *  *Inconscient* ne se cumule pas – soit vous êtes *Inconscient*, soit vous ne l'êtes pas. »), l.37
 *  (À Terre), l.137 (Surpris). SOURCE UNIQUE du plafond, lue par la pose NATIVE (`addCondition`) comme
 *  par la réconciliation des États DÉRIVÉS : deux causes, un seul pion. */
export function etatNonCumulable(id: string): boolean {
  etatExige(id);
  return findConditionById(id)?.nonCumulable === true;
}

/** Marqueurs NARRATIFS hors LDB 16 (PAS des États `etats.json`, cf. `data-wellformed.test`) : Pétrifié
 *  (LDB 85), sans entrée catalogue — REGISTRE UNIQUE de l'exception (libellé, sévérité, icone) : le
 *  résolveur `etatConnu` et le nom scanné dans le journal (`conditionIdInText`) le COMPOSENT, aucun
 *  n'en garde de copie. */
export const NARRATIVE_MARKERS: readonly { id: string; label: string; severity: number; icon: string }[] = [
  { id: 'petrifie', label: 'Pétrifié', severity: 95, icon: 'condition/petrified' },
];

const marqueurParId = indexParId('etats', NARRATIVE_MARKERS);

/** État RÉSOLU par son id STABLE : catalogue VIVANT (`etats.json`) ∪ marqueurs narratifs
 *  (`NARRATIVE_MARKERS`), `undefined` hors des deux. SOURCE UNIQUE du jeu d'ids d'État connus : le
 *  prédicat d'une frontière (`!!etatConnu(id)` : console `devtools.condition`, garde FK
 *  `refs-migrated.test`), la sévérité (`conditionSeverity`) et l'icone
 *  (`gameIso/effectIcons.conditionMeta`) le composent. */
export function etatConnu(id: string): { label: string; severity?: number; icon?: string } | undefined {
  return findConditionById(id) ?? marqueurParId(id);
}

/** L'État `id` que `etatConnu` résout ; un id hors des deux LÈVE (#1463 LD.1, #2995). */
export function etatExige(id: string): { label: string; severity?: number; icon?: string } {
  const etat = etatConnu(id);
  if (!etat) throw new Error(t('etats.inconnu', { id }));
  return etat;
}

/** Les ids d'État hors de `etatConnu` que portent des combattants PERSISTÉS (sauvegarde, roster, export de
 *  héros), lus tels qu'ils arrivent du stockage : `[]` = le document se charge (#1463 LD.1). */
export function etatsPortesInconnus(porteurs: unknown): string[] {
  if (!Array.isArray(porteurs)) return [];
  return porteurs.flatMap((c: Partial<Pick<Combatant, 'conditions'>> | null) => (Array.isArray(c?.conditions) ? c.conditions : []).map((x) => x.id).filter((id) => !etatConnu(id)));
}

/** Ids que `etatConnu` résout, catalogue vivant puis marqueurs — la liste rendue par un refus. */
export const etatIdsConnus = (): string[] => [...conditionIds(), ...NARRATIVE_MARKERS.map((m) => m.id)];

/** id de l'État NOMMÉ dans un texte de journal (jeu de noms FERMÉ : catalogue VIVANT + marqueurs
 *  narratifs), `undefined` sinon — la logique reste keyée par ID, le libellé n'est que le motif
 *  cherché dans un texte FRANÇAIS. SOURCE UNIQUE du scan, partagée par l'importance d'un évènement
 *  (`noyau/combatLog`) et son icone (`gameIso/combatNarration`) ; meurt avec le journal STRUCTURÉ (#1330). */
export function conditionIdInText(text: string): string | undefined {
  for (const id of conditionIds()) if (text.includes(conditionLabel(id))) return id;
  for (const marqueur of NARRATIVE_MARKERS) if (text.includes(marqueur.label)) return marqueur.id;
  return undefined;
}

/** Sévérité d'un État par son id (`etats.json` : `severity`, sinon marqueur narratif) ; défaut 10 pour un État
 *  CONNU qui n'en déclare pas, un id hors registre LÈVE (`etatExige`). SOURCE UNIQUE partagée par l'icône
 *  (`gameIso/effectIcons.conditionMeta`, `important` = sévérité ≥ 50) ET l'importance d'un évènement de
 *  combat pour le bandeau/la cadence (`noyau/combatLog.isImportantEvent`). */
export function conditionSeverity(id: string): number {
  return etatExige(id).severity ?? 10;
}

/**
 * Hook injecté (inversion de dépendance) appelé quand `c` GAGNE un État (nouveau ou empilé) — le
 * moteur reste PUR (il ne connaît ni le store, ni les triggers). Le noyau le pose (`brancherLeJeu`)
 * pour câbler le déclencheur `onGainCondition` (Mâchoires d'acier : « chaque fois que vous gagnez un
 * État Sonné »). Absent ⇒ aucune réaction (création de perso, effets hors combat, tests purs).
 */
let onConditionGained: ((c: Combatant, name: string) => void) | undefined;
/** Pose le hook et REND le précédent : un poseur temporaire (sonde, jeu de test) peut ainsi le remettre
 *  à l'identique au lieu de l'éteindre — le câblage du store est un GLOBAL de module, l'effacer laisse
 *  le combat sans déclencheur `onGainCondition` pour tout ce qui tourne ensuite dans le même worker. */
export function setConditionGainedHook(fn: ((c: Combatant, name: string) => void) | undefined): ((c: Combatant, name: string) => void) | undefined {
  const precedent = onConditionGained;
  onConditionGained = fn;
  return precedent;
}

/** Retrait d'États « 1 + DR » borné au nombre de pions présents (LDB 16 : Empêtré l.61,
 *  En flammes l.77, Empoisonné l.70, Sonné l.125, arrêt d'Hémorragie l.107). Un Test raté n'en retire aucun. */
export function recoveredStacks(dr: number, stacks: number, success: boolean): number {
  if (!success || stacks <= 0) return 0;
  return Math.min(stacks, 1 + Math.max(0, dr));
}

/** EMPILEMENT d'une pose sur un pion DÉJÀ PORTÉ — SOURCE UNIQUE des poseurs (`addCondition`,
 *  `addTimedCondition`, `addClockCondition` ; le cycle quotidien des maladies passe par le premier).
 *  Un État `nonCumulable` (LDB 16 l.115/l.37/l.137) n'empile
 *  RIEN : la pose PREND POSSESSION du pion déjà là (la contribution DÉRIVÉE tombe à 0, le marquage —
 *  la source affichée — reste), de sorte que le fait passif qui retombe n'emporte plus le pion de
 *  l'autre cause. */
function empileSurPionExistant(existing: ConditionInstance, value: number): void {
  if (!etatNonCumulable(existing.id)) { existing.value += value; return; }
  if (existing.derivedFrom) existing.derivedFrom = { ...existing.derivedFrom, stacks: 0 };
}

/** Mort subite (LDB 18 l.44, l.46) : l'issue du coup qui dépasse les Blessures d'un figurant (#2654). */
export function appliquerMortSubite(target: Combatant, log: string[]): void {
  target.wounds.current = 0;
  if (!target.conditions.some((c) => c.id === COND.inconscient)) addCondition(target, COND.inconscient);
  log.push(t('cf.collapse', { name: target.label }));
}

/** La Difficulté du Test qui retire l'État `id` quand sa pose n'en dicte aucune : le défaut de son Test
 *  `argDifficulty` (`etats.json`). LDB 16 l.70 ; LDB 85 l.425 */
function difficulteParDefaut(id: string): Difficulty | undefined {
  let defaut: Difficulty | undefined;
  for (const e of findConditionById(id)?.effects ?? []) {
    walkFlow(e.flow, (n) => { if (!defaut && n.kind === 'test' && n.test.argDifficulty) defaut = n.test.difficulty; });
  }
  return defaut;
}

/** Des poisons de Difficultés différentes : l'État garde la plus dure, une pose sans Difficulté valant le
 *  défaut de son Test (`difficulteParDefaut`). LDB 16 l.70 ; #3060 */
function durcirDifficulte(existing: ConditionInstance, difficulte: Difficulty | undefined): void {
  const defaut = difficulteParDefaut(existing.id);
  const rang = (d: Difficulty | undefined) => { const eff = d ?? defaut; return eff ? DIFFICULTY_LADDER.indexOf(eff) : -1; };
  if (rang(difficulte) <= rang(existing.difficulte)) return;
  if (difficulte) existing.difficulte = difficulte;
  else delete existing.difficulte;
}

export function addCondition(c: Combatant, name: string, value = 1, escapeStrength?: number, escapeThreshold?: number, entangleOnFail?: boolean, struggleDamage?: number, locks?: ConditionLocks, difficulte?: Difficulty): void {
  etatExige(name);
  const { lockedUntil, unlockBy } = locks ?? {};
  if (!groupAdvantage()) c.advantage = 0; // « Si vous subissez un État quel qu'il soit, vous perdez immédiatement tout Avantage » (LDB 16 l.7) — pas de perte per-combattant en mode « Avantage de groupe » (la réserve du camp ne change pas)
  const existing = c.conditions.find((x) => x.id === name);
  if (existing) {
    empileSurPionExistant(existing, value);
    // Force d'évasion (Empêtré « se libérer » — LDB 16 l.66) : sur ré-application, on garde la PLUS
    // CONTRAIGNANTE (max), pour qu'un Enchevêtrement ne soit pas affaibli par un État Empêtré « banal »
    // qui s'empile par-dessus (et inversement, un sort plus fort durcit l'évasion).
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    if (escapeThreshold != null) existing.escapeThreshold = Math.max(existing.escapeThreshold ?? 0, escapeThreshold);
    if (entangleOnFail) existing.entangleOnFail = true;
    if (struggleDamage != null) existing.struggleDamage = Math.max(existing.struggleDamage ?? 0, struggleDamage);
    durcirDifficulte(existing, difficulte);
    if (lockedUntil != null) existing.lockedUntil = lockedUntil; // un Critique re-verrouille l'État déjà porté
    if (unlockBy != null) existing.unlockBy = unlockBy; // un Critique re-verrouille l'État déjà porté (acte de soin, LDB 18)
    // Un ajout NON temporisé sur un État à durée : la durée saute (l'État redevient régi
    // par ses règles normales — on n'écourte jamais un État au prétexte qu'un sort expirait).
    delete existing.roundsLeft;
  } else {
    c.conditions.push({ id: name, value, ...(escapeStrength != null ? { escapeStrength } : {}), ...(escapeThreshold != null ? { escapeThreshold } : {}), ...(entangleOnFail ? { entangleOnFail } : {}), ...(struggleDamage != null ? { struggleDamage } : {}), ...(difficulte ? { difficulte } : {}), ...(lockedUntil != null ? { lockedUntil } : {}), ...(unlockBy != null ? { unlockBy } : {}) });
  }
  // L'État vient d'être GAGNÉ (nouveau ou empilé) → déclenche `onGainCondition` (Mâchoires d'acier).
  onConditionGained?.(c, name);
}

/** Ajout d'un État À DURÉE (posé par un sort : « 1 État Sonné qui dure N Rounds », LDB).
 *  Sur un État déjà porté : temporisé → durée max conservée ; NON temporisé → inchangé
 *  (la durée du sort ne raccourcit pas un État permanent). */
export function addTimedCondition(c: Combatant, name: string, value: number, rounds: number, escapeStrength?: number, escapeThreshold?: number, entangleOnFail?: boolean, struggleDamage?: number, difficulte?: Difficulty): void {
  etatExige(name);
  const existing = c.conditions.find((x) => x.id === name);
  if (existing) {
    if (!groupAdvantage()) c.advantage = 0;
    empileSurPionExistant(existing, value);
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    if (escapeThreshold != null) existing.escapeThreshold = Math.max(existing.escapeThreshold ?? 0, escapeThreshold);
    if (entangleOnFail) existing.entangleOnFail = true;
    if (struggleDamage != null) existing.struggleDamage = Math.max(existing.struggleDamage ?? 0, struggleDamage);
    durcirDifficulte(existing, difficulte);
    if (existing.roundsLeft != null) existing.roundsLeft = Math.max(existing.roundsLeft, rounds);
    // sinon : instance non temporisée — elle le reste.
    onConditionGained?.(c, name); // État empilé (gagné) → déclenche `onGainCondition`
  } else {
    addCondition(c, name, value, escapeStrength, escapeThreshold, entangleOnFail, struggleDamage, undefined, difficulte); // (déclenche déjà `onGainCondition`)
    c.conditions.find((x) => x.id === name)!.roundsLeft = rounds;
  }
}

/** Ajout d'un État à durée d'HORLOGE (`until` = minute `gameTime` d'échéance) — Belladone : « Un sommeil
 *  induit par la belladone dure 1d10 + 4 heures » (LDB 72 l.18), Fleur de lune (LDB 71 l.29). Purgé par
 *  `purgeClockEffects` (upkeep), même patron que `castPenalties.untilTime`. Sur un État déjà porté :
 *  temporisé-horloge → échéance MAX conservée ; NON temporisé → inchangé (on n'écourte jamais un État
 *  permanent au prétexte qu'une drogue expirait). */
export function addClockCondition(c: Combatant, name: string, value: number, until: number, escapeStrength?: number, escapeThreshold?: number, entangleOnFail?: boolean, struggleDamage?: number, difficulte?: Difficulty): void {
  etatExige(name);
  const existing = c.conditions.find((x) => x.id === name);
  if (existing) {
    if (!groupAdvantage()) c.advantage = 0; // Perte d'Avantage sur État (LDB 16 l.7) — inerte en mode « Avantage de groupe »
    empileSurPionExistant(existing, value);
    if (escapeStrength != null) existing.escapeStrength = Math.max(existing.escapeStrength ?? 0, escapeStrength);
    if (escapeThreshold != null) existing.escapeThreshold = Math.max(existing.escapeThreshold ?? 0, escapeThreshold);
    if (entangleOnFail) existing.entangleOnFail = true;
    if (struggleDamage != null) existing.struggleDamage = Math.max(existing.struggleDamage ?? 0, struggleDamage);
    durcirDifficulte(existing, difficulte);
    if (existing.untilTime != null) existing.untilTime = Math.max(existing.untilTime, until);
    // sinon : instance non temporisée — elle le reste.
    onConditionGained?.(c, name); // État empilé (gagné) → déclenche `onGainCondition`
  } else {
    addCondition(c, name, value, escapeStrength, escapeThreshold, entangleOnFail, struggleDamage, undefined, difficulte); // (déclenche déjà `onGainCondition`)
    c.conditions.find((x) => x.id === name)!.untilTime = until;
  }
}

/** Un État est-il VERROUILLÉ ? Trois formes, d'un même verdict :
 *  - `unlockBy` (acte de soin, LDB 18) : l'acte NOMMÉ le lève, via `releaseConditionLocks` ;
 *  - `lockedUntil` de l'INSTANCE (LDB 18) : prédicat posé par le Critique qui a posé l'État ;
 *  - `lockedUntil` du TYPE (`etats.json`) : prédicat vrai de TOUTE instance de cet État, quelle que soit
 *    son origine — À Terre à 0 Blessure, LDB 18 l.15.
 *  Le prédicat s'évalue contre la vue du porteur (`conditionLockCtx`) ; les sujets hors de cette vue sont
 *  refusés AU PARSE. Tant qu'un verrou tient, `removeCondition` est inerte sur cet État. */
export function isConditionLocked(inst: ConditionInstance, c: Combatant): boolean {
  return raisonVerrouEtat(inst, c) !== undefined;
}

/** Les actes de soin qui lèvent un verrou d'État (LDB 18), en français — source unique du libellé,
 *  partagée par le refus d'un remède et l'éditeur d'op. */
export const ACTE_DE_DEVERROUILLAGE: Record<import('./types').ConditionUnlock, string> = {
  medicalAid: 'Aide Médicale',
  surgery: 'Chirurgie',
  magic: 'Soin magique',
};

/** POURQUOI cet État ne se lève pas maintenant — la raison DU VERROU QUI TIENT, `undefined` si aucun.
 *  Les trois formes sont évaluées séparément, chacune avec SA raison : l'acte de soin attendu
 *  (`unlockBy`), le prédicat posé par le Critique (`lockedUntil` d'instance), puis celui du TYPE
 *  (`EtatData.lockedUntil`, dont la raison est la donnée `lockedReason`). `isConditionLocked` lit ce
 *  même verdict : une seule évaluation, jamais deux copies du OU. */
export function raisonVerrouEtat(inst: ConditionInstance, c: Combatant): string | undefined {
  if (inst.unlockBy != null) return t('cond.lockedByAct', { acte: ACTE_DE_DEVERROUILLAGE[inst.unlockBy] });
  const type = findConditionById(inst.id);
  if (!inst.lockedUntil && !type?.lockedUntil) return undefined; // aucun prédicat : rien à projeter
  const vue = conditionLockCtx(c);
  if (inst.lockedUntil && !evalCondition(inst.lockedUntil, vue)) return t('cond.locked');
  if (type?.lockedUntil && !evalCondition(type.lockedUntil, vue)) return type.lockedReason ?? t('cond.locked');
  return undefined;
}

/** Blessures que la dépense d'un point de Détermination REND en retirant cet État (`EtatData.resolveHeals`,
 *  LDB 17 l.61) — EFFECTIVES : même plafond que le soin lui-même (`cappedHealAmount`, LDB 62 l.250). */
export function soinDeDetermination(c: Combatant, conditionId: string): number {
  etatExige(conditionId);
  return cappedHealAmount(c, findConditionById(conditionId)?.resolveHeals ?? 0);
}

/** Un acte `act` LÈVE-t-il un verrou d'État `unlockBy` (LDB 18) ? Le soin magique compte AUSSI comme Aide
 *  Médicale (LDB 18 l.311) → `magic` lève `medicalAid` ET `magic` ; sinon l'acte ne lève que son homonyme
 *  (Aide Médicale ne lève pas un verrou de Chirurgie ; la Chirurgie ne lève pas un verrou magique). */
function actLifts(unlockBy: import('./types').ConditionUnlock, act: import('./types').ConditionUnlock): boolean {
  return unlockBy === act || (act === 'magic' && unlockBy === 'medicalAid');
}

/** Applique un acte de soin `act` : RETIRE tout État dont le verrou `unlockBy` est levé par cet acte (LDB 18 :
 *  « ne peut être retiré QUE par [acte] » ⇒ l'acte est ce qui le soigne). SOURCE UNIQUE appelée à chaque point
 *  de soin (`receiveMedicalAid`/soin magique → medicalAid/magic ; fin de Chirurgie → surgery). Pur ; renvoie le journal. */
export function releaseConditionLocks(c: Combatant, act: import('./types').ConditionUnlock, emit?: ConditionEmit): string[] {
  const log: string[] = [];
  for (const inst of [...c.conditions]) {
    if (inst.unlockBy == null || !actLifts(inst.unlockBy, act)) continue;
    delete inst.unlockBy; // le verrou tombe → removeCondition n'est plus inerte
    removeCondition(c, inst.id, inst.value); // l'acte SOIGNE l'État (LDB 18 : retiré par cet acte)
    log.push(t('cond.lockReleased', { name: c.label, cond: conditionLabel(inst.id) }));
    emit?.({ stateId: inst.id, change: 'loss', targetId: c.id });
  }
  return log;
}

/** Le porteur a-t-il un État dont le retrait est VERROUILLÉ par la Chirurgie (LDB 18 : Hémorragie interne) ?
 *  Rend la Chirurgie proposable/soignante à l'Infirmerie même sans Blessure Critique chirurgicale porteuse. */
export function hasSurgeryLockedCondition(c: Combatant): boolean {
  return (c.conditions ?? []).some((x) => x.unlockBy === 'surgery');
}

/**
 * RETRAIT d'État — `porSaSource` réservé à la réconciliation des États DÉRIVÉS : elle EST la source du
 * pion marqué, elle seule peut donc l'emporter. Tout autre retrait (sommeil, soin, Détermination,
 * dissipation) s'arrête à la part NATIVE du pion : un État qu'un fait passif toujours vivant porte ne
 * se retire pas à la main (`LDB 20 l.188` ; le fait le reposerait de toute façon à la réconciliation).
 * Le VERROU (LDB 18) ne protège que des retraits NATIFS : un pion part avec sa source, verrouillé ou
 * non (#1695) — sinon il survivrait au fait qui le porte.
 */
/** Pions de l'État `name` qu'un retrait peut ôter à `c` : aucun si l'État est absent ou verrouillé (LDB 18),
 *  hors pions qu'un canal passif porte ; tous par sa source (`parSaSource`). */
export function pionsRetirables(c: Combatant, name: string, parSaSource = false): number {
  etatExige(name);
  const existing = c.conditions.find((x) => x.id === name);
  if (!existing || (!parSaSource && isConditionLocked(existing, c))) return 0;
  return Math.max(0, existing.value - (parSaSource ? 0 : existing.derivedFrom?.stacks ?? 0));
}

function retireEtat(c: Combatant, name: string, value: number, parSaSource: boolean): void {
  const existing = c.conditions.find((x) => x.id === name);
  const n = Math.min(value, pionsRetirables(c, name, parSaSource));
  if (!existing || n <= 0) return;
  existing.value -= n;
  if (existing.value <= 0) c.conditions = c.conditions.filter((x) => x.id !== name);
  // Main ensanglantée (AA 07 l.117) : le Test de Dextérité par Action tient « tant que vous êtes sous
  // l'effet de cet État » → l'Hémorragique épuisé (instance retirée) lève TOUS les gates de main (op
  // `handGate`). LEVER machinerie UNIQUE de la durée du marqueur (l'Hémorragique ne s'empile qu'en 1 instance).
  if (name === COND.hemorragique && existing.value <= 0) delete c.handGates;
  // POINT UNIQUE de retrait d'État → une Blessure critique dont tous les États associés sont tombés
  // est GUÉRIE (LDB 18 l.304) : octroie la cicatrice post-guérison (Blessure spectaculaire / Nez cassé, l.61/72).
  settleHealedCriticals(c);
}

export function removeCondition(c: Combatant, name: string, value = 1): void {
  retireEtat(c, name, value, false);
}

export function hasCondition(c: Combatant, name: string): boolean {
  etatExige(name);
  return c.conditions.some((x) => x.id === name);
}

/** Pions de l'État `name` POSÉS par la réconciliation d'un canal passif (`ConditionInstance.derivedFrom`).
 *  Lu par les sites qui doivent laisser ces pions-là en place (le sommeil ne dissipe pas un Exténué que
 *  le Malaise porte, LDB 20 l.188 : « dont vous ne pourrez vous défaire qu'une fois votre maladie guérie »). */
export function derivedStacks(c: Combatant, name: string): number {
  etatExige(name);
  return c.conditions.find((x) => x.id === name)?.derivedFrom?.stacks ?? 0;
}

/** L'op `condition` PASSIVE qui porte l'État `conditionId` chez `c` — retrouvée dans le MÊME
 *  collecteur que la réconciliation (`passiveMods`), par l'identité de source MÉMORISÉE sur le pion
 *  (`derivedFrom.src`). Aucun lookup de catalogue : le porteur peut être de N'IMPORTE quelle
 *  famille (symptôme, État, mutation, trait, objet, talent). */
function opPorteuseDEtat(c: Combatant, conditionId: string): Extract<GameOp, { op: 'condition' }> | undefined {
  const src = c.conditions.find((x) => x.id === conditionId)?.derivedFrom?.src;
  if (!src) return undefined;
  for (const m of passiveMods(c)) {
    if (m.op.op !== 'condition' || m.op.id !== conditionId) continue;
    if (memeSource(m.src, src)) return m.op;
  }
  return undefined;
}

/**
 * FENÊTRE ouverte par un Point de Détermination sur l'État `conditionId` — `undefined` = REFUS.
 * SOURCE UNIQUE, PURE (`now` injecté), lue par le store (`spendResolveCondition`) et par la raison
 * ci-dessous. La fenêtre est celle que l'op PORTEUSE déclare (`ResolveWindow`), quel que soit le type
 * de son porteur : rien ici ne nomme une famille d'entité.
 */
export function fenetreDetermination(c: Combatant, conditionId: string, now: number, rng: RNG): Duration | undefined {
  return resolveWindowDuration(opPorteuseDEtat(c, conditionId)?.resolveWindow, c, now, rng);
}

/**
 * RAISON pour laquelle un Point de Détermination ne peut RIEN sur cet État — `undefined` = la dépense
 * est ouverte. Consommée par le store ET par l'UI (l'affordance porte sa raison au survol, jamais un
 * bouton muet). Le refus est en DONNÉE : l'op porteuse déclare une fenêtre `'none'` (LDB 20 l.188).
 * Partout ailleurs la dépense passe : État non dérivé → retrait d'un pion (LDB 17 l.61) ; État dérivé
 * → la source est SUSPENDUE le temps de la fenêtre, et la cause qui tient repose l'État à l'échéance
 * (LDB 16 l.117).
 */
export function raisonRefusDetermination(c: Combatant, conditionId: string): string | undefined {
  const inst = c.conditions.find((x) => x.id === conditionId);
  // La dépense REND d'abord les Blessures que l'État déclare (LDB 17 l.61) : le verrou s'évalue sur le
  // porteur TEL QU'IL SERA. Ce qui refuse encore refuserait aussi après le soin (LDB 18).
  if (inst) {
    const soin = soinDeDetermination(c, conditionId);
    const apres = soin > 0 ? { ...c, wounds: { ...c.wounds, current: c.wounds.current + soin } } : c;
    const verrou = raisonVerrouEtat(inst, apres);
    if (verrou) return verrou;
  }
  const src = inst?.derivedFrom?.src;
  if (!src || opPorteuseDEtat(c, conditionId)?.resolveWindow !== 'none') return undefined;
  return t('cond.refusDeterminationVerrou', { cond: conditionLabel(conditionId), src: refLabel(src.category, { id: src.id }) });
}

/** RE-ENTRANCE : la pose d'un État déclenche `onGainCondition` (store), qui peut appliquer des ops — dont
 *  la fin re-appelle la réconciliation. Elle ne se rejoue pas SUR ELLE-MÊME : l'appel externe voit l'état
 *  final, un appel imbriqué rendrait un journal en double. Le verrou est PAR PORTEUR (identité du
 *  Combattant) : un déclencheur qui applique des ops à B pendant la réconciliation de A doit voir B
 *  réconcilié — un drapeau de module l'aurait rendu inerte, et B n'aurait jamais reçu son État. */
const reconciliationEnCours = new WeakSet<Combatant>();

/**
 * RÉCONCILIATION des États PORTÉS par un canal PASSIF — SOCLE UNIQUE (#1599).
 *
 * FAIT SOURCE : les op `condition` que `passiveMods(c)` émet (donc TOUT porteur passif — symptôme,
 * État, mutation, trait, objet —, et déjà filtré par les annulateurs `PASSIVE_CANCELLERS`/`modSurvives`
 * et par la suspension de symptôme `suppressSymptom` : le fait cesse, l'État dérivé part avec lui).
 * CIBLE : un multiset par id d'État. L'écart avec les pions DÉJÀ dérivés (`derivedFrom.stacks`) est
 * comblé par `addCondition` / `removeCondition` — jamais par une pose en aveugle.
 *
 * Ce que la réconciliation NE touche PAS : les pions NON marqués (un Inconscient de KO à 0 PB, LDB 16
 * l.94, coexiste avec celui d'une Fièvre (Grave), LDB 20 l.170 — la fièvre qui redescend n'emporte que
 * le sien). Un pion VERROUILLÉ (LDB 18) ne lui résiste PAS : le verrou arrête les retraits natifs, pas
 * la source qui l'a posé (#1695).
 *
 * IDEMPOTENTE : rejouée sans changement du fait source, elle n'écrit rien et rend un journal vide.
 * Mute `c`, renvoie le journal ; `emit` reçoit l'appariement ligne↔id (`ConditionChange`).
 */
export function syncDerivedConditions(c: Combatant, emit?: ConditionEmit): string[] {
  if (reconciliationEnCours.has(c)) return [];
  reconciliationEnCours.add(c);
  try {
    return reconcilierEtatsDerives(c, emit);
  } finally {
    reconciliationEnCours.delete(c);
  }
}

function reconcilierEtatsDerives(c: Combatant, emit?: ConditionEmit): string[] {
  const cible = new Map<string, { stacks: number; src?: CodexTarget }>();
  for (const m of passiveMods(c)) {
    if (m.op.op !== 'condition') continue;
    const n = typeof m.op.value === 'number' ? m.op.value : 1;
    const e = cible.get(m.op.id);
    if (e) e.stacks += n;
    else cible.set(m.op.id, { stacks: n, ...(m.src ? { src: m.src } : {}) });
  }
  const log: string[] = [];
  // `?? []` : un porteur FORGÉ (coque de navire, sonde de test) peut n'avoir aucune liste d'États — la
  // réconciliation reste inerte sur lui, elle ne lève pas.
  const portees = c.conditions ?? [];
  const ids = new Set([...cible.keys(), ...portees.filter((x) => x.derivedFrom).map((x) => x.id)]);
  for (const id of ids) {
    const voulu = cible.get(id);
    const inst = portees.find((x) => x.id === id);
    const porte = inst?.derivedFrom;
    const porteN = porte?.stacks ?? 0;
    // LDB 16 l.115 (l.37/l.137) : un État `nonCumulable` ne porte qu'UN pion. Le fait passif n'en pose
    // donc qu'un — et AUCUN si un pion NATIF (KO à 0 PB) occupe déjà la place : les deux causes
    // partagent le pion, chacune le tient à son tour sans jamais en ajouter un second.
    let cibleN = voulu?.stacks ?? 0;
    if (cibleN > 0 && etatNonCumulable(id)) cibleN = (inst?.value ?? 0) - porteN > 0 ? 0 : 1;
    if (cibleN === porteN) {
      // Rien à poser ni à retirer, mais le MARQUAGE dit qui porte le fait : le pion natif partagé
      // reste nommé par le fait tant qu'il dure, et redevient anonyme quand le fait cesse.
      if (voulu && inst && cibleN === 0 && !porte) inst.derivedFrom = { stacks: 0, ...(voulu.src ? { src: voulu.src } : {}) };
      else if (!voulu && inst?.derivedFrom) inst.derivedFrom = undefined;
      continue;
    }
    // Le porteur du NOM à l'écran : l'émetteur courant s'il y en a un (pose), sinon celui MÉMORISÉ par
    // l'instance (retrait — le fait vient de disparaître, il ne peut plus se nommer lui-même).
    const src = voulu?.src ?? porte?.src;
    const source = src ? refLabel(src.category, { id: src.id }) : t('cond.derivedSrcFallback');
    if (cibleN > porteN) {
      c.conditions = portees; // la liste EXISTE dès qu'on y pose (porteur forgé sans `conditions`)
      addCondition(c, id, cibleN - porteN);
      c.conditions.find((x) => x.id === id)!.derivedFrom = { stacks: cibleN, ...(src ? { src } : {}) };
      log.push(t('cond.derivedGain', { name: c.label, cond: conditionLabel(id), src: source }));
      emit?.({ stateId: id, change: 'gain', targetId: c.id });
      continue;
    }
    retireEtat(c, id, porteN - cibleN, true); // la réconciliation EST la source du pion marqué : rien ne l'arrête
    const apres = c.conditions.find((x) => x.id === id);
    if (apres) apres.derivedFrom = cibleN > 0 ? { stacks: cibleN, ...(src ? { src } : {}) } : undefined;
    log.push(t('cond.derivedLoss', { name: c.label, cond: conditionLabel(id), src: source }));
    emit?.({ stateId: id, change: 'loss', targetId: c.id });
  }
  return log;
}

/** Sommeil MAGIQUE (sort Sommeil → Inconscient À DURÉE ; Belladone/Fleur de lune → Inconscient d'horloge) :
 *  le dormeur est Inconscient MAIS a des PB (≠ un KO à 0 PB). On le distingue par la présence d'une durée
 *  d'État (`roundsLeft`/`untilTime`) sur son Inconscient ET `wounds.current > 0`. Lu par le modifier de
 *  réveil-à-l'attaque (« bruits/bousculade la réveillent », sort Sommeil) — sans MJ, le moteur applique la règle. */
export function isMagicallyAsleep(c: Combatant): boolean {
  const inc = c.conditions.find((x) => x.id === COND.inconscient);
  return !!inc && (inc.roundsLeft != null || inc.untilTime != null) && c.wounds.current > 0;
}

/** Réveille un dormeur magique : retire son Inconscient de sommeil. Le dormeur, éveillé, encaisse
 *  l'attaque qui l'a réveillé (il n'a pas pu la défendre — il dormait). */
export function wakeSleeper(c: Combatant): void {
  const inc = c.conditions.find((x) => x.id === COND.inconscient);
  if (inc) removeCondition(c, COND.inconscient, inc.value);
}

/** Le `testMod` GLOBAL porté par UN effet actif — CRITÈRE UNIQUE. EXCLUT les mods char-QUALIFIÉS
 *  (`testModChar` — Mystracine ±10 par Caractéristique), lus par `testValue` pour la seule carac visée. */
function effectGlobalTestMod(e: ActiveEffect): number {
  return e.testModChar == null ? (e.testMod ?? 0) : 0;
}

/** Lignes des `testMod` GLOBAUX d'effets actifs, partagées par les deux détails nommés : les Sorts
 *  entre eux (LDB 46 l.119) et une même Prière (LDB 40 l.19) gardent meilleur bonus et pire pénalité
 *  (`retenirParPool`) ; le reste se somme (LDB 14 l.95). Hors du pool des États (LDB 16 l.13) et
 *  du gate `ignoreStatePenalties`. */
function effectGlobalTestLines(c: Combatant): ModLine[] {
  const lignes: (ModLine & { pool?: string })[] = (c.activeEffects ?? []).map((e) => ({ label: e.label, value: effectGlobalTestMod(e), famille: 'jet', ref: effectRef(e), pool: effectPool(e) }));
  return retenirParPool(lignes).map(({ pool: _pool, ...ligne }) => ligne);
}

/** Les `testMod` portés par les États du combattant (kind `etat`), déjà ×pions (perStack) par le
 *  collecteur, AVEC l'identité Codex de l'État/état psy qui les porte (`PassiveMod.src`). Lus en
 *  « PIRE seul » par combatTestPenaltyParts/testStatePenalty (non-cumul, LDB 16 l.13). */
function etatTestMods(c: Combatant): { op: Extract<GameOp, { op: 'testMod' }>; src?: CodexTarget }[] {
  const out: { op: Extract<GameOp, { op: 'testMod' }>; src?: CodexTarget }[] = [];
  for (const m of passiveMods(c)) if (m.kind === 'etat' && m.op.op === 'testMod') out.push({ op: m.op, src: m.src });
  return out;
}

/** Nombre d'États dont les pénalités de Test sont IGNORÉES (op `ignoreStatePenalties{count}` — « Les dames
 *  de L'Anguille », MDG 09 l.244 : « peut ignorer un État », UN seul au choix). Σ des effets actifs porteurs. */
function ignoredStatesCount(c: Combatant): number {
  return (c.activeEffects ?? []).reduce((s, e) => s + (e.ignoreStatesCount ?? 0), 0);
}

/** Un candidat du POOL non-cumul (LDB 16 l.13), avec l'identité de ce qui l'octroie. `nature` = la
 *  FAMILLE du candidat (État, aura de trait…), servie à l'affichage quand `src` manque : un candidat
 *  non identifié ne doit pas emprunter le nom d'une AUTRE famille (une aura n'est pas un État). */
interface PoolCandidate { amount: number; nature: string; src?: CodexTarget }

/** Retire les N PIRES candidats (les plus négatifs) du pool de pénalités d'État — « ignorer UN État » :
 *  le pool non-cumul (le pire seul s'applique, LDB 16 l.13) rend rationnel d'ignorer le pire d'abord.
 *  L'ORDRE DE COLLECTE des survivants est préservé (il départage les ex æquo, cf. `poolWinner`). */
function dropWorst(cand: PoolCandidate[], n: number): PoolCandidate[] {
  if (n <= 0) return cand;
  const dropped = new Set([...cand.keys()].sort((a, b) => cand[a].amount - cand[b].amount).slice(0, n));
  return cand.filter((_, i) => !dropped.has(i));
}

/** Le gagnant du POOL (LDB 16 l.13). Deux candidats de même magnitude portent la MÊME pénalité : seule
 *  la SOURCE affichée les distingue, celle du PREMIER dans l'ordre de collecte (États dans l'ordre de
 *  `Combatant.conditions`, puis états psychologiques, puis auras projetées) — comparaison STRICTE, un
 *  ex æquo ne détrône pas le tenant. */
function poolWinner(cand: PoolCandidate[]): PoolCandidate | undefined {
  return cand.reduce<PoolCandidate | undefined>((best, x) => (best == null || x.amount < best.amount ? x : best), undefined);
}

/** Nom d'AFFICHAGE d'un candidat du POOL. RÈGLE GÉNÉRALE (#1153) : une composante se nomme par son
 *  OCTROYEUR, jamais par sa famille — tous les émetteurs d'État/symptôme posent leur `src`, ce chemin
 *  passe donc toujours par `refLabel`. Le repli `nature` ne subsiste que pour la SEULE famille sans
 *  entité identifiable : l'aura PROJETÉE par un tiers (`Combatant.auraMods`, dont le hook d'arène ne
 *  propage pas toujours le trait émetteur) — « Aura » y est un nom de famille assumé, verrouillé par
 *  `etat-test-penalty.test.ts`. Ajouter une famille ici = un ARBITRAGE, pas un défaut technique. */
function srcLabel(src: CodexTarget | undefined, nature: string): string {
  return src ? refLabel(src.category, { id: src.id }) : nature;
}

// Le convertisseur UNIQUE `PassiveMod` → composante nommée (`passivePartLine`) vit dans `trauma.ts`,
// avec le collecteur qui produit ces `PassiveMod` : les DEUX canaux (`skillMod`/`testMod` ici,
// `charMod` là-bas) le lisent sans cycle d'import. Ré-exporté pour ses consommateurs.
import { passivePartLine } from './trauma';
export { passivePartLine };

// `effectRef` (couture UNIQUE effet→fiche Codex) vit dans `types.ts`, à côté de la table
// `CATEGORY_BY_SOURCE_KIND` qu'elle indexe : les DEUX collecteurs la lisent sans cycle d'import.
// Ré-exportée ici pour ses consommateurs historiques — UNE définition, deux chemins d'import.
export { effectRef } from './types';

/**
 * Pénalité aux Tests de COMBAT (LDB 16), DÉCOMPOSÉE en lignes nommées — SOURCE UNIQUE du calcul ET
 * de son affichage. Trois familles, jamais fondues sous un même intitulé :
 *  1. le POOL des États (LDB 16 l.13) — États et états psychologiques : UNE ligne, celle du gagnant,
 *     au nom de SON entité (« −30 Brisé ») avec son renvoi Codex ;
 *  2. le POOL des auras de trait (LDB 85 l.262, « une seule fois ») : UNE ligne, la pire ;
 *  3. les effets ACTIFS à `testMod` global (`effectGlobalTestLines`) ;
 *  4. les `testMod` globaux de symptôme (Crampes abdominales, MSRC 16 l.152) : une ligne PAR symptôme.
 * Les familles se SOMMENT entre elles (LDB 14 l.95).
 */
export function combatTestPenaltyParts(c: Combatant, ctx: EtatTestCtx = {}): ModLine[] {
  let cand: PoolCandidate[] = [];
  // Endurance de l'anachorète (LDB 42) : « ne subit aucune pénalité causée par les États » —
  // n'efface QUE les pénalités d'État (l'aura Perturbante est un trait, pas un État).
  if (!hasActiveFlag(c, 'ignoreStatePenalties')) {
    for (const m of etatTestMods(c)) {
      if (m.op.movementOnly && !impliqueDeplacement(ctx)) continue; // LDB 16 l.35, l.64
      if (!etatScopeApplies(m.op, ctx)) continue;
      cand.push({ amount: m.op.amount, nature: t('cond.natureEtat'), src: m.src }); // magnitude/portée en données (etats.json) ; déjà ×pions (Exténué)
    }
    cand = dropWorst(cand, ignoredStatesCount(c)); // « peut ignorer un État » (MDG 09 l.244)
  }
  // Auras de combat (`auraMods`, hook `recompute-auras`) : un TRAIT, pas un État — hors du gate
  // `ignoreStatePenalties` (LDB 42) et dans leur PROPRE pool (LDB 85 l.262).
  const auras: PoolCandidate[] = [];
  for (const m of c.auraMods ?? []) if (m.op.op === 'testMod' && m.op.char == null) auras.push({ amount: m.op.amount, nature: t('cond.natureAura'), src: m.src });
  const out: ModLine[] = [];
  for (const best of [poolWinner(cand), poolWinner(auras)]) {
    if (best?.amount) out.push({ label: srcLabel(best.src, best.nature), value: best.amount, famille: 'jet', ref: best.src });
  }
  out.push(...effectGlobalTestLines(c));
  for (const m of passiveGlobalTestParts(c)) {
    const { amount } = m.op as Extract<GameOp, { op: 'testMod' }>;
    if (amount) out.push(passivePartLine(m, amount)); // nommé par le SYMPTÔME émetteur (`src`), jamais « Symptôme »
  }
  return out;
}

/** Σ de `combatTestPenaltyParts` — la VALEUR que roule le résolveur (l'affichage et le jet ne peuvent
 *  pas diverger : ils lisent les mêmes composantes). */
export function combatTestPenalty(c: Combatant, ctx: EtatTestCtx = {}): number {
  return combatTestPenaltyParts(c, ctx).reduce((s, p) => s + p.value, 0);
}

// Tests « impliquant un déplacement » (LDB 16 l.35/l.64) — classification DÉRIVÉE de la donnée
// (`SkillData.movement`, éditable au Codex), jamais une liste d'ids en dur. Acrobaties (spé de
// Représentation) non classables à l'id de base → non couvertes.
const competenceParId = indexParId('skills', skills);
/** Le Test `skill` est-il classé « déplacement » (`SkillData.movement`) ? Réutilisée par #193
 *  (Épaule luxée/Genou démis : `testMod.movementOnly` = MÊME catégorie que l'État À Terre/Empêtré). */
export function isMovementSkill(skill?: string): boolean {
  return !!competenceParId(skill)?.movement;
}

/** CONTEXTE d'un Test lu par le pool d'États (LDB 16 l.13) : Compétence testée, sens sollicité,
 *  maladie à laquelle le Test résiste, déplacement déclaré. */
export interface EtatTestCtx { skill?: string; sense?: PairedSense; disease?: string; movement?: boolean }

/** Le Test implique-t-il un déplacement (LDB 16 l.35, l.64) ? Compétence classée `movement`, ou Test que
 *  l'appelant déclare tel (`movement` — l'Empoignade, LDB 16 l.64). */
function impliqueDeplacement(ctx: EtatTestCtx): boolean {
  return !!ctx.movement || isMovementSkill(ctx.skill);
}

/** Une pénalité d'État RESTREINTE pèse-t-elle sur ce Test ? Sens (LDB 16 l.29, l.45) : la Compétence
 *  l'implique (`SkillData.senses`) et le Test, s'il nomme son sens, nomme celui-là. Maladie
 *  (LDB 16 l.105) : le Test résiste à l'une des maladies visées. */
function etatScopeApplies(op: Extract<GameOp, { op: 'testMod' }>, ctx: EtatTestCtx): boolean {
  if (op.sense && !(competenceParId(ctx.skill)?.senses?.includes(op.sense) && (ctx.sense == null || ctx.sense === op.sense))) return false;
  return !op.diseases || (ctx.disease != null && op.diseases.includes(ctx.disease));
}

/** Σ des `testMod` char-QUALIFIÉS ACTIFS (op `testMod{char}` exécutée, #193) pour la Caractéristique
 *  `ck` — POINT UNIQUE partagé par `testValue` (Tests hors-combat), `combatValue`/`defenseValue`
 *  parade (Tests d'arme, `weaponHand` gaté) et `defenseValue` Esquive (`movement:true`). `weaponHand`/
 *  `movement` : contexte du Test COURANT, opposé aux gates portés par l'effet (`testModHand`/
 *  `testModMovementOnly`) — absents des DEUX côtés = mod global (comportement historique). */
export function activeCharTestModParts(c: Combatant, ck: import('./types').CharKey, ctx: { weaponHand?: 'main' | 'off'; movement?: boolean } = {}): ModLine[] {
  const out: ModLine[] = [];
  for (const e of c.activeEffects ?? []) {
    if (e.testModChar !== ck) continue;
    if (e.testModHand != null && e.testModHand !== ctx.weaponHand) continue;
    if (e.testModMovementOnly && !ctx.movement) continue;
    if (e.testMod) out.push({ label: e.label, value: e.testMod, famille: 'jet', ref: effectRef(e) });
  }
  return out;
}

/** Σ de `activeCharTestModParts` — SOURCE UNIQUE (l'affichage et le jet lisent les mêmes composantes). */
export function activeCharTestMod(c: Combatant, ck: import('./types').CharKey, ctx: { weaponHand?: 'main' | 'off'; movement?: boolean } = {}): number {
  return activeCharTestModParts(c, ck, ctx).reduce((s, p) => s + p.value, 0);
}
/**
 * Pénalité d'États aux Tests HORS COMBAT (LDB 16), DÉCOMPOSÉE en lignes nommées — JUMELLE exacte de
 * `combatTestPenaltyParts` pour les Tests « dans le monde », mêmes familles hors auras (pool des États
 * LDB 16 l.13, effets ACTIFS à `testMod` global, `testMod` globaux de symptôme) et même provenance de LIBELLÉ : le
 * `src` que le collecteur `passiveMods` porte sur chaque `PassiveMod` (donnée `etats.json` →
 * `refLabel`), JAMAIS un branchement par nom d'entité. SOURCE UNIQUE du calcul ET de son affichage :
 * `testStatePenalty` en est seulement la somme.
 * Magnitudes/portées en DONNÉES (`etats.json` passive `testMod` : `movementOnly`/`sense`/`diseases`/
 * `exceptSkills`), portées lues contre le CONTEXTE du Test (`etatScopeApplies`).
 */
export function testStatePenaltyParts(c: Combatant, skill?: string, ctx: Omit<EtatTestCtx, 'skill'> = {}): ModLine[] {
  const out: ModLine[] = [];
  let cand: PoolCandidate[] = [];
  // Endurance de l'anachorète (LDB 42) : aucune pénalité d'État pour la durée (les modificateurs de
  // Sort/symptôme restent). Pas d'État du tout : rien à mettre au pool non plus.
  if (c.conditions?.length && !hasActiveFlag(c, 'ignoreStatePenalties')) {
    for (const m of etatTestMods(c)) {
      if (m.op.movementOnly && !impliqueDeplacement({ ...ctx, skill })) continue; // LDB 16 l.35, l.64
      if (!etatScopeApplies(m.op, { ...ctx, skill })) continue;
      if (m.op.exceptSkills?.some((r) => r.id === skill)) continue; // LDB 16 l.52
      cand.push({ amount: m.op.amount, nature: t('cond.natureEtat'), src: m.src });
    }
    cand = dropWorst(cand, ignoredStatesCount(c)); // « peut ignorer un État » (MDG 09 l.244)
  }
  const best = poolWinner(cand);
  if (best?.amount) out.push({ label: srcLabel(best.src, best.nature), value: best.amount, famille: 'jet', ref: best.src });
  out.push(...effectGlobalTestLines(c));
  for (const m of passiveGlobalTestParts(c)) {
    const { amount } = m.op as Extract<GameOp, { op: 'testMod' }>;
    if (amount) out.push(passivePartLine(m, amount)); // nommé par le SYMPTÔME émetteur (`src`), jamais « Symptôme »
  }
  return out;
}

/** Σ de `testStatePenaltyParts` — la VALEUR que roule `testValue` (l'affichage et le jet ne peuvent
 *  pas diverger : ils lisent les mêmes composantes), miroir de `combatTestPenalty`. */
export function testStatePenalty(c: Combatant, skill?: string, ctx: Omit<EtatTestCtx, 'skill'> = {}): number {
  return testStatePenaltyParts(c, skill, ctx).reduce((s, p) => s + p.value, 0);
}

/**
 * Bonus pour TOUCHER en mêlée une cible affectée, en lignes NOMMÉES par l'État qui les octroie —
 * SOURCE UNIQUE de la somme (`meleeAttackerBonus`) et de son affichage (chip « +20 À Terre »).
 * Lues en DONNÉES (`incomingAttackMod` des `passive` d'État, kind `etat`). Deux familles :
 *  - INCONDITIONNELS (À Terre/Surpris +20, Aveuglé +10 — `LDB 16 l.35/l.135/l.45`) : le MEILLEUR
 *    seul. `LDB 16 l.13`, `l.37`, `l.137` ; non-cumul sans source : #1138.
 *  - flanc/derrière (Assourdi +10, `flankRear:true`, `LDB 16 l.29`) : bonus SUPPLÉMENTAIRE ADDITIF,
 *    appliqué SEULEMENT si `opts.flankRear` (l'appelant a établi l'angle via le facing) ; « ce bonus
 *    n'est pas augmenté avec de multiples États *Assourdi* » (l.29) → max entre entrées flankRear.
 * Ex æquo : le PREMIER dans l'ordre de collecte l'emporte (comparaison stricte), comme `poolWinner`.
 * L'état de l'adversaire est SITUATIONNEL pour qui le frappe : `famille: 'circonstance'` (partition
 * de `combineMods`, `LDB 14 l.48` et `l.96`), donc plafonné avec les autres circonstances.
 */
export function meleeAttackerBonusLines(target: Combatant, opts?: { flankRear?: boolean }): ModLine[] {
  let best: PoolCandidate | undefined;  // pool non-cumul des bonus inconditionnels
  let flank: PoolCandidate | undefined; // bonus flanc/dos ADDITIF (« supplémentaire »)
  for (const m of passiveMods(target)) {
    if (m.kind !== 'etat' || m.op.op !== 'incomingAttackMod') continue;
    if (m.op.mode !== 'melee' && m.op.mode !== 'all') continue;
    const cand: PoolCandidate = { amount: m.op.amount, nature: t('cond.natureEtat'), src: m.src };
    if (m.op.flankRear) { if (opts?.flankRear && cand.amount > (flank?.amount ?? 0)) flank = cand; }
    else if (cand.amount > (best?.amount ?? 0)) best = cand;
  }
  return [best, flank]
    .filter((c): c is PoolCandidate => !!c?.amount)
    .map((c) => ({ label: srcLabel(c.src, c.nature), value: c.amount, famille: 'circonstance' as const, ref: c.src }));
}

/** Σ de `meleeAttackerBonusLines` — la VALEUR que le jet applique (l'affichage et le jet lisent les
 *  mêmes composantes). */
export function meleeAttackerBonus(target: Combatant, opts?: { flankRear?: boolean }): number {
  return meleeAttackerBonusLines(target, opts).reduce((s, l) => s + l.value, 0);
}

/**
 * Avantage(s) GAGNÉ(s) par l'assaillant qui frappe `target` en mêlée — lu en DONNÉES (`passive`
 * `incomingAdvantage` melee/all, kind `etat`). Sonné : « +1 Avantage avant l'attaque » (LDB 16 l.125).
 * Non-cumul : le MEILLEUR seul (comme `meleeAttackerBonus`). ≠ bonus de TOUCHE (`meleeAttackerBonus`).
 */
export function incomingMeleeAdvantage(target: Combatant): number {
  let best = 0;
  for (const m of passiveMods(target)) {
    if (m.kind === 'etat' && m.op.op === 'incomingAdvantage' && (m.op.mode === 'melee' || m.op.mode === 'all')) {
      best = Math.max(best, m.op.amount);
    }
  }
  return best;
}

/** Restrictions d'Action/Mouvement/défense imposées par les STATUTS portés (États ET Psychologie) —
 *  lues en DONNÉES (`StatusData.gating`, etats.json/psychology.json), JAMAIS par-nom : un nouvel État/
 *  trait psy déclare son blocage dans le JSON et le moteur l'applique. Agrégation : `action:'none'` et
 *  `cannotDefend` sont des OU (un seul statut bloquant suffit) ; le Mouvement prend le PIRE
 *  (`none` > `crawl` > `half` > normal). `crawl` (LDB 16 l.35) est une moitié de Mouvement (`effectiveMovement`)
 *  qui ferme en plus la Course (`refusDeCourse`). « Etat comme Psy » : `PsychologyData extends StatusData`. */
export type MouvementDuStatut = 'normal' | 'half' | 'crawl' | 'none';
const RANG_DU_MOUVEMENT: Record<MouvementDuStatut, number> = { normal: 0, half: 1, crawl: 2, none: 3 };
export function conditionGating(c: Combatant): { noAction: boolean; cannotDefend: boolean; movement: MouvementDuStatut } {
  let noAction = false; let cannotDefend = false; let movement: MouvementDuStatut = 'normal';
  const apply = (g?: { action?: 'none'; movement?: Exclude<MouvementDuStatut, 'normal'>; cannotDefend?: true }): void => {
    if (!g) return;
    if (g.action === 'none') noAction = true;
    if (g.cannotDefend) cannotDefend = true;
    if (g.movement && RANG_DU_MOUVEMENT[g.movement] > RANG_DU_MOUVEMENT[movement]) movement = g.movement;
  };
  for (const cond of c.conditions ?? []) apply(findConditionById(cond.id)?.gating);
  for (const p of c.psychState ?? []) apply(findPsychologyById(p.type)?.gating);
  return { noAction, cannotDefend, movement };
}

/** Ne peut pas se défendre lors d'un Test opposé (Surpris LDB 16 l.135 / Inconscient l.113 « rien faire
 *  de votre tour ») — lu du `gating.cannotDefend` des statuts portés (données, jamais une liste par-nom). */
export function cannotDefend(c: Combatant): boolean {
  return conditionGating(c).cannotDefend;
}

/** Le combattant peut-il effectuer son Action ce tour ? Faux si un statut porté déclare `gating.action:
 *  'none'` (Sonné « incapable d'effectuer votre Action », LDB 16 l.125 ; Surpris/Inconscient). Données. */
export function canTakeAction(c: Combatant): boolean {
  return !conditionGating(c).noAction;
}

/** États portés par `c` dont la DONNÉE déclare `restrictsAction` (Brisé : Mouvement + Action verrouillés
 *  pour fuir/se cacher, LDB 16 l.52) — lus en DONNÉES (etats.json), JAMAIS par-nom. `stacks` = pions portés. */
export function restrictingConditions(c: Combatant): { id: string; stacks: number }[] {
  const out: { id: string; stacks: number }[] = [];
  for (const cond of c.conditions ?? []) {
    if (findConditionById(cond.id)?.restrictsAction) out.push({ id: cond.id, stacks: cond.value });
  }
  return out;
}

/** Refus de l'État qui verrouille l'Action et le Mouvement du porteur (`restrictsAction`), nommé depuis la
 *  donnée ; `null` s'il est libre. Lu par le gate `hors-verrou-d-etat` et par le clic d'attaque. `LDB 16 l.52`. */
export function refusVerrouDAction(c: Combatant): string | null {
  const verrou = restrictingConditions(c)[0];
  if (!verrou) return null;
  return t('cs.stateLockFlee', { name: c.label, etat: findConditionById(verrou.id)?.label ?? verrou.id });
}

/** Le combattant porte-t-il un État qui VERROUILLE son Action (`restrictsAction`) ? Une seule vérité de
 *  données partagée par le gate de hotbar (`battleSelectAction`) ET l'IA (`planProactiveSpend`). */
export function isActionLocked(c: Combatant): boolean {
  return restrictingConditions(c).length > 0;
}

/**
 * Fin de Round : dégâts périodiques (Hémorragique/Empoisonné/En flammes) et
 * dissipation des États temporaires (LDB 16). Retourne un journal.
 *
 * `opts.skipPoisonResist` : NE roule PAS le Test de Résistance d'Empoisonné (les DÉGÂTS sont
 * appliqués quand même). Posé par le hook `end-of-round` pour un HÉROS → le Test devient une étape
 * de cascade influençable (cf. `collectHeroRoundEndUpkeep`). Les DÉGÂTS restent ici pour tous ; seul
 * le Test est différé. ENNEMIS : `opts` absent → comportement (et ORDRE RNG) inchangé.
 */
export function endOfRound(c: Combatant, rng: RNG, emit?: ConditionEmit): string[] {
  const log: string[] = [];
  // Hémorragique : dégâts par-round (« 1 Blessure par pion, en ignorant les modificateurs », l.104) MIGRÉS
  // en données — etats.json hemorragique `effects: onRoundEnd → wounds {stacks:'self'}` (défaut : ignore
  // BE+PA), avec `stacksReducedBy:'bleedIgnore'` pour l'Endurci (LDB 10), joué par fireConditionEffects.
  // Le jet de MORT par hémorragie (d100 ≤ 10×pions, coagulation) reste `bleedDeathRoll` (règle de mort).
  // Empoisonné : dégâts par-round (« 1 PB/pion, en ignorant les modificateurs ») MIGRÉS en DONNÉES —
  // `etats.json` empoisonne `effects: onRoundEnd → wounds {stacks:'self'}` (le défaut de `wounds` ignore
  // BE+PA), joués par `fireConditionEffects` au hook order-10. Le Test de Résistance qui élimine l'État
  // reste le hook `poison-resist` (cadence-aware).
  // En Flammes : dégâts par-round MIGRÉS en données (etats.json `effects: onRoundEnd → wounds`,
  // amount {sum:[1d10, pions, −1]} − BE − PA de la Localisation la moins protégée, min 1 ; LDB 16 l.84),
  // joués par fireConditionEffects.
  // Sonné : Test de Résistance Intermédiaire (+0) en fin de Round (retire 1+DR ; vidé → 1 Exténué « si pas
  // déjà », LDB 16 l.125-129) MIGRÉ en DONNÉES — `etats.json` sonne `effects: onRoundEnd → {test → removeCondition
  // 1+DR, `if` sonne∧extenue vidés → condition extenue}`, résolu par le DISPATCHER UNIQUE (cadence-aware en
  // combat, inline hors-combat). Le −10 du Sonné s'applique au jet via `combatTestPenalty` (rawCombatTestBase).
  // Auto-dissipation en fin de Round (Aveuglé l.47 / Assourdi l.29 / Surpris l.139) MIGRÉE en données :
  // `effects: [{trigger:'onRoundEnd', flow:…removeCondition}]` dans etats.json, jouée par fireConditionEffects.
  // Effets RÉCURRENTS portés par un effet actif de sort (op `perRound`) — re-joués tant que l'effet
  // dure (AVANT le décrément : il agit aussi son dernier Round). 1 État X/Round, 1 Ration de
  // « Récolte de Rhya »/Round… Le nombre de répétitions suit roundsLeft (Surincantation de Durée
  // comprise). Snapshot de la liste : les ops récurrentes n'ajoutent pas d'effet actif (cas littéraux).
  for (const e of [...(c.activeEffects ?? [])]) {
    if (!e.opsPerRound || (e.duration.scale === 'rounds' && e.duration.left <= 0)) continue;
    // L'ancrage du re-jeu est celui MEMORISE sur l'effet a sa pose (`applyOps` l'y stampe) : il se relaie,
    // il ne se reconstruit pas.
    applyOps(c, e.opsPerRound, {
      label: e.label, rng, source: e.source, sourceSpellId: e.sourceSpellId, effectId: e.effectId, onCondition: emit,
      rejeuRecurrent: true, // SEUL site qui pose le drapeau : ce qui suit est une RE-pose (`LDB 16 l.117`)
    }).forEach((l) => log.push(l));
  }
  // Décrément des durées (effets/États de sort/contrecoups) — SOURCE UNIQUE extraite, même emplacement
  // qu'avant (fin d'`endOfRound`, après les ops récurrentes). RNG-free.
  tickDurations(c, emit).forEach((l) => log.push(l));
  return log;
}

/** Retire d'un combattant les ActiveEffect satisfaisant `pred`, en RÉVERSANT proprement leurs octrois
 *  (traits/ressources/armes accordés, Traits psy suspendus) — EXACTEMENT comme l'expiration naturelle.
 *  SOURCE UNIQUE du retrait d'effets actifs : expiration en Rounds (`tickDurations`), horloge, et
 *  DISSIPATION (LDB 46 l.158-162, `engine/dispel`). Renvoie les effets retirés (pour le journal).
 *  Un effet retiré emporte les États qu'il PORTAIT (`ActiveEffect.passive`, #1695, LDB 48 l.495) : la
 *  réconciliation clôt donc CE point unique, jamais chaque appelant. `emit`/`log` recueillent ce
 *  qu'elle dit — un appelant qui n'a pas de journal les omet (l'État part quand même). */
export function removeActiveEffects(c: Combatant, pred: (e: ActiveEffect) => boolean, emit?: ConditionEmit, log?: string[]): ActiveEffect[] {
  if (!c.activeEffects?.length) return [];
  const removed = c.activeEffects.filter(pred);
  if (!removed.length) return [];
  c.activeEffects = c.activeEffects.filter((e) => !pred(e));
  dropExpiredGrantedTraits(c, removed); // traits accordés (op grantTrait) retirés avec leur effet
  dropExpiredGrantedResources(c, removed); // Chance/Destin accordés (gainResource) non dépensés
  dropExpiredGrantedWeapons(c, removed); // armes invoquées/naturelles accordées : loadout recomposé
  if (dropExpiredGrantedMutations(c, removed)) recomputeLoadout(c); // mutation TEMPORISÉE (op rollMutation) détachée → loadout recomposé
  restoreSuppressedPsych(c, removed); // Traits psy suspendus (Baume, LDB 43 l.70) restitués
  dropExpiredGrantedPsych(c, removed); // Traits psy accordés (op grantPsychTrait à durée) retirés APRÈS la restitution : un Trait échu pendant une suspension n'est pas rendu
  // États PORTÉS par l'effet (#1695) : ils partent au MÊME geste. IDEMPOTENTE. La réconciliation est
  // INCONDITIONNELLE — un `log?.push(...sync())` l'aurait court-circuitée chez tout appelant sans journal.
  const portes = syncDerivedConditions(c, emit);
  log?.push(...portes);
  c.wounds = blessuresReconciliees(c);
  return removed;
}

/** Le SORT source d'un effet actif porte-t-il le marqueur « + » de fin de Durée (LDB 47 l.311) ? Lookup
 *  PUR par `spell.spellId`/`sourceSpellId` (posés à l'incantation, cf. `OpsCtx.sourceSpell`/`sourceSpellId`).
 *  Sans sort source (effet non-magique) ou sort introuvable/sans marqueur → false. */
export function spellDurationPlusSource(e: ActiveEffect): boolean {
  const spellId = e.spell?.spellId ?? e.sourceSpellId;
  if (!spellId) return false;
  const d = findSpellById(spellId)?.duration;
  return d?.kind === 'rounds' && d.plus === true;
}

/** Effets d'un combattant en attente d'une offre de prolongation (`awaitingExtension`, LDB 47 l.311) —
 *  requête PURE pour le state layer (collecte de cascade héros / résolution PNJ). */
export function pendingPlusExtensions(c: Combatant): ActiveEffect[] {
  return (c.activeEffects ?? []).filter((e) => e.awaitingExtension);
}

/** Résout l'offre de prolongation (LDB 47 l.311) d'UN effet GELÉ (`awaitingExtension`) : succès (Test de
 *  Force Mentale réussi) → +1 Round, effet dégelé ; refus/échec → expiration NORMALE (mêmes réversions
 *  que `removeActiveEffects` — traits/armes/ressources accordés repris). Fonction PARTAGÉE par la
 *  résolution PNJ (inline, hook `end-of-round`) et l'applier de cascade héros (`spellPlusTest`). */
export function resolvePlusExtension(c: Combatant, e: ActiveEffect, extended: boolean): string[] {
  if (extended) {
    e.awaitingExtension = undefined;
    e.duration = { scale: 'rounds', left: 1 };
    return [t('cond.effectExtended', { name: c.label, label: e.label })];
  }
  const porte: string[] = []; // États PORTÉS par l'effet gelé (#1695) : leur départ se dit au même journal
  const removed = removeActiveEffects(c, (x) => x === e, undefined, porte);
  return [...removed.map((x) => t('cond.effectExpire', { name: c.label, label: x.label })), ...porte];
}

/**
 * Décrément des DURÉES à la frontière de Round — SOURCE UNIQUE (effets magiques temporisés, États de
 * sort, contrecoups d'incantation en Rounds) : un SEUL point décrémente les
 * `roundsLeft`, branché par le hook `tick-durations` (order 15.5, après les dégâts périodiques).
 * RNG-FREE (décrément + filtre + retraits) → n'altère pas le flux déterministe.
 * Rejoué hors combat par `outOfCombatUpkeep` (les durées en Rounds tickent aussi à l'horloge).
 */
export function tickDurations(c: Combatant, emit?: ConditionEmit): string[] {
  const log: string[] = [];
  // Effets magiques temporisés (Bénédictions, Sorts de bonus) : décrément des durées en Rounds.
  // `tickRound` n'agit que sur l'échelle `rounds` ; les durées d'horloge/permanentes sont inertes ici
  // (les premières sont purgées par l'horloge `purgeClockEffects`).
  if (c.activeEffects?.length) {
    for (const e of c.activeEffects) if (!e.awaitingExtension) e.duration = tickRound(e.duration);
    // Durée « + » (LDB 47 l.311) : un effet dont le SORT source porte le marqueur est GELÉ à l'expiration
    // au lieu d'être retiré — l'offre de prolongation (Test de Force Mentale) est résolue par l'appelant
    // (hors moteur pur : cadence-aware, cf. `resolvePlusExtension`). Répétable : une prolongation réussie
    // ramène l'effet à 1 Round → la PROCHAINE expiration re-propose naturellement (aucun compteur dédié).
    for (const e of c.activeEffects) {
      if (e.duration.scale === 'rounds' && e.duration.left <= 0 && !e.awaitingExtension && spellDurationPlusSource(e)) e.awaitingExtension = true;
    }
    const porte: string[] = []; // l'effet se dissipe D'ABORD au journal, les États qu'il portait partent ENSUITE (#1695)
    const expired = removeActiveEffects(c, (e) => e.duration.scale === 'rounds' && e.duration.left <= 0 && !e.awaitingExtension, emit, porte);
    for (const e of expired) log.push(t('cond.effectExpire', { name: c.label, label: e.label }));
    log.push(...porte);
  }
  // États à DURÉE posés par un sort (« qui dure N Rounds ») : décrément, dissipation à 0.
  if (c.conditions.some((x) => x.roundsLeft != null)) {
    for (const x of c.conditions) if (x.roundsLeft != null) x.roundsLeft -= 1;
    const done = c.conditions.filter((x) => x.roundsLeft != null && x.roundsLeft <= 0);
    for (const x of done) { log.push(t('cond.spellCondExpire', { name: c.label, cond: conditionLabel(x.id) })); emit?.({ stateId: x.id, change: 'loss', targetId: c.id }); }
    c.conditions = c.conditions.filter((x) => !(x.roundsLeft != null && x.roundsLeft <= 0));
  }
  // Contrecoups d'incantation à durée en Rounds (tables d'Imparfaites/Colère, LDB 46/40).
  if (c.castPenalties?.some((p) => p.roundsLeft != null)) {
    for (const p of c.castPenalties) if (p.roundsLeft != null) p.roundsLeft -= 1;
    const done = c.castPenalties.filter((p) => p.roundsLeft != null && p.roundsLeft <= 0);
    for (const p of done) log.push(t('cond.effectExpire', { name: c.label, label: p.label }));
    c.castPenalties = c.castPenalties.filter((p) => !(p.roundsLeft != null && p.roundsLeft <= 0));
  }
  // Un effet qui vient d'EXPIRER peut avoir porté (ou levé) un fait source d'État dérivé : la fenêtre de
  // Détermination de LDB 20 l.170 se referme ici, et l'État repart. Point d'appel de la frontière de
  // Round (`endOfRound` chaîne ici) ET de toute expiration en Rounds — jamais une copie de la logique.
  syncDerivedConditions(c, emit).forEach((l) => log.push(l));
  return log;
}

/**
 * Cauchemars (trauma psychologique, LDB 21 l.95) : chaque nuit, un Personnage marqué effectue un
 * Test de **Calme Facile (+40)** ; sur un échec, il est en proie à de terribles cauchemars et gagne
 * un État **Exténué**. Pur ; mute `c`, renvoie le journal.
 *
 * `calme` = la valeur de la PORTE (`testValue(c, 'calme')`), passée par l'appelant : `testValue` vit
 * dans `skills.ts`, qui importe CE module — le cycle interdit de la lire ici (#1657 B3-3).
 */
export function nightmareCheck(c: Combatant, calme: number, rng: RNG, out?: { base: number; result: TestResult }[]): string[] {
  const res = rollTest(calme, 'facile', rng); // Calme Facile (+40), palier canonique
  out?.push({ base: calme, result: res });
  if (res.success) return [t('cond.nightmareNone', { name: c.label })];
  addCondition(c, COND.extenue);
  return [t('cond.nightmare', { name: c.label })];
}

/**
 * Mort par Hémorragique (LDB 16 l.105) : « À la fin du Round, vous avez 10 % de chance de mourir
 * par État Hémorragique que vous possédez » (3 pions → mort sur 1-30). « Si vous faites un double sur ce
 * jet, vos blessures coagulent un peu et vous perdez 1 État Hémorragique » — le double prime (pas de mort,
 * mais coagulation). Pur ; renvoie `died` (la finalisation — sauvetage par Destin — revient à l'appelant).
 */
export function bleedDeathRoll(c: Combatant, rng: RNG): { died: boolean; log: string[] } {
  const n = stacks(c, COND.hemorragique);
  const eligible = !c.dead && !c.outOfRencontre && n > 0 && hasCondition(c, COND.inconscient); // AA 07 l.7 ; LDB 16 l.105 ; #2915
  if (!eligible) return { died: false, log: [] };
  const r = d100(rng);
  if (isDoubleRoll(r)) {
    removeCondition(c, COND.hemorragique, 1); // coagulation (le double prime sur la mort)
    const log = [t('cond.coagulate', { name: c.label, roll: r === 100 ? '00' : r })];
    if (!hasCondition(c, COND.hemorragique)) { addCondition(c, COND.extenue); log.push(t('cond.lastWoundExhausted', { name: c.label })); } // tous retirés → 1 Exténué
    return { died: false, log };
  }
  if (r <= 10 * n) return { died: true, log: [t('cond.bleedDeath', { name: c.label, roll: r, threshold: 10 * n })] };
  return { died: false, log: [t('cond.bleedSurvive', { name: c.label, roll: r, threshold: 10 * n })] };
}

/** Mort Subite : LDB 18 l.42-46 ; variante `combat-aa-blessures: 'aa'` : AA 07 l.65-67 (AA 06 l.556).
 *  Portée réglable (`combat-sudden-death`) — JAMAIS les PJ : 'figurants' (défaut) = hors PNJ importants
 *  (`ldb`) ou hors PNJ à Talent Chanceux (`aa`) ; 'tous' = tout PNJ ; 'off' = personne. Jamais un objet
 *  inanimé : AA 10 l.114, MDG 13 l.656, MSRC 07 l.74, EDOC 07 l.334. SOURCE UNIQUE (consommée par
 *  `isOutOfAction`, `endState` et la résolution de Blessure critique). */
export function usesSuddenDeath(c: Combatant): boolean {
  if (c.kind === 'hero') return false; // LDB 18 l.46 ; AA 07 l.67
  if (isInanimate(c)) return false;
  const mode = rule('combat-sudden-death');
  if (mode === 'off') return false;
  if (mode === 'tous') return true;
  return rule('combat-aa-blessures') === 'aa' ? !hasTalent(c, 'chanceux') : !c.important; // AA 07 l.67 ; LDB 18 l.46
}

/** Mort subite qui met hors de combat à 0 Blessure, sans Inconscient : `aa` seulement (AA 07 l.65). En
 *  `ldb`, la sortie passe par le dépassement (LDB 18 l.46), qui pose l'Inconscient. */
function horsDeCombatParMortSubite(c: Combatant): boolean {
  return rule('combat-aa-blessures') === 'aa' && usesSuddenDeath(c) && !!c.wounds && c.wounds.current <= 0;
}

/** Hors de combat : mort, ou Inconscient, ou figurant sorti par la Mort Subite, ou COQUE coulée. Un héros
 *  à 0 PB reste actif (À Terre) — pas hors de combat (LDB 18 l.15). Une Structure ou une coque à 0 reste
 *  en jeu (AA 10 l.114, MDG 13 l.656, MSRC 07 l.74). */
export function isOutOfAction(c: Combatant): boolean {
  // Un OBJET INERTE servi (affût d'artillerie) n'est jamais une PERTE par Blessures (il en a 0, immune) :
  // « hors de combat » seulement s'il est explicitement retiré (détruit hors-combat / éjecté de la rencontre).
  if (c.inert) return c.dead === true || c.outOfRencontre === true;
  if (isVehicle(c)) return c.dead === true || c.outOfRencontre === true || hasCondition(c, 'naufrage'); // MDG 13 l.674
  return c.dead === true || c.outOfRencontre === true || hasCondition(c, COND.inconscient) || horsDeCombatParMortSubite(c);
}

/** Catégorie d'état de FIN d'un combattant, pour l'AFFICHAGE (#237). */
export type EndState = 'mort' | 'inconscient' | 'rendu' | 'hors-combat';

/** État de FIN d'un combattant pour le RENDU (#237) — SOURCE UNIQUE consommée par les trois surfaces
 *  (token iso, portrait, frise d'initiative) ; distinct de `isOutOfAction` (booléen de règle), il
 *  renvoie la CATÉGORIE lisible. `mort` (définitif) → `rendu` (reddition #215 / coque amenée, pavillon
 *  baissé) → `hors-combat` (éjecté vivant : Destin, naufrage, Mort Subite d'un figurant, coque coulée)
 *  → `inconscient` (KO conscient perdu). `rendu` vs `hors-combat` repose sur `exitReason` (seul champ
 *  qui les distingue). `null` = en état de se battre (un héros à 0 PB reste À Terre, PAS un état de fin).
 *  Un OBJET INERTE (affût servi, 0 PB permanent immune) n'a jamais d'état de fin. */
export function endState(c: Combatant): EndState | null {
  if (c.inert) return null;
  if (c.dead) return 'mort';
  if (c.outOfRencontre) return c.exitReason === 'reddition' || c.exitReason === 'prise' ? 'rendu' : 'hors-combat';
  if (isVehicle(c)) return isOutOfAction(c) ? 'hors-combat' : null; // MDG 13 l.674
  if (horsDeCombatParMortSubite(c)) return 'hors-combat'; // AA 07 l.65
  if (!c.dead && hasCondition(c, COND.inconscient)) return 'inconscient'; // vivant mais KO (même gate de cycle de vie qu'isOutOfAction)
  return null;
}

/** Condition de mort lente (LDB 18 l.34) : Inconscient + 0 PB + (Blessures
 *  critiques > Bonus d'Endurance), et pas déjà mort/éjecté. Suffocation (LDB 18 l.346) :
 *  « au bout d'un nombre de Rounds égal à votre BE, vous mourez » — compteur à 0 = mort
 *  (même canal → un héros à Destin est suspendu, pendingFateSave). */
export function inDeathCondition(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  if (c.suffocationCountdown != null && c.suffocationCountdown <= 0) return true;
  const be = bonus(effectiveChar(c, 'endurance'));
  // Variante Aux Armes (l.73) : mort par accumulation de Blessures Critiques. Même formule et même clause
  // « sauf s'il est soigné d'une Blessure Critique » que le LDB 18 l.34 (les Critiques « T » n'ont pas
  // incrémenté le compteur, cf. applyCriticalToTarget) → on route la clause de compte par la primitive AA dédiée.
  if (rule('combat-aa-blessures') === 'aa')
    return aaDeathByCriticalCount(hasCondition(c, COND.inconscient), c.wounds.current, c.criticalWounds ?? 0, be);
  return hasCondition(c, COND.inconscient) && c.wounds.current <= 0 && (c.criticalWounds ?? 0) > be;
}

/** À 0 PB : gagne l'État À Terre (LDB 18 l.15) ; porteur d'Hémorragique, l'Inconscient (LDB 16 l.105),
 *  sauf en variante Aux Armes, qui le soumet à un Test (AA 07 l.5, hook `aa-bleed-unconscious`).
 *  Un objet inanimé (Structure, coque, affût) ne tombe jamais À Terre : AA 10 l.114, MDG 13 l.656. */
export function applyZeroWounds(c: Combatant): void {
  if (isInanimate(c)) return;
  if (c.wounds.current <= 0 && !hasCondition(c, COND.aTerre)) addCondition(c, COND.aTerre);
  if (c.wounds.current <= 0 && stacks(c, COND.hemorragique) > 0 && rule('combat-aa-blessures') !== 'aa') poserInconscientDeSaignement(c);
}

/** Reprendre connaissance (LDB 18 l.15) : retire l'Inconscient, sauf verrou (LDB 16 l.105). Vrai si le porteur
 *  s'est réveillé. SOURCE UNIQUE du réveil par les PB (soin `applyHealWounds`, repos `restDay`). */
export function reprendreConnaissance(c: Combatant): boolean {
  const inc = c.conditions.find((x) => x.id === COND.inconscient);
  if (!inc || isConditionLocked(inc, c)) return false;
  removeCondition(c, COND.inconscient, inc.value);
  return true;
}

/** Verrou de l'Inconscient d'un porteur d'Hémorragique : LDB 16 l.105 ; AA 07 l.7. */
const VERROU_DU_SAIGNEMENT: ConditionLocks = { lockedUntil: { kind: 'compare', subject: { who: 'target', condition: COND.hemorragique }, op: '==', value: 0 } };

/** Inconscient par la perte de sang, verrouillé tant qu'un État Hémorragique reste : LDB 16 l.105 ; AA 07 l.5, l.7.
 *  Partagé par la pose à 0 PB (`applyZeroWounds`) et l'échec du Test d'AA (`aa-bleed-unconscious`). */
export function poserInconscientDeSaignement(c: Combatant): void {
  addCondition(c, COND.inconscient, 1, undefined, undefined, undefined, undefined, VERROU_DU_SAIGNEMENT);
}

/**
 * Perte de Blessures CENTRALISÉE avec ses conséquences RAW — à utiliser partout où l'on retire des PB
 * (hors flux d'attaque principal, qui gère déjà l'Avantage et la nuance Critique pour l'À Terre) :
 *  - perdre ≥1 PB → on perd TOUT l'Avantage (LDB 14 l.219) ;
 *  - tomber à 0 PB → État À Terre (LDB 18 l.15), sauf déjà Inconscient/mort.
 * Retourne le nombre de PB réellement perdus.
 */
export function loseWounds(c: Combatant, amount: number): number {
  if (amount <= 0 || c.wounds.current <= 0) return 0;
  const lost = Math.min(amount, c.wounds.current);
  c.wounds.current -= lost;
  if (!groupAdvantage()) c.advantage = 0; // perdre une Blessure → perdre tout l'Avantage (LDB 14 l.219) — inerte en mode « Avantage de groupe »
  if (c.wounds.current <= 0 && !c.dead && !hasCondition(c, COND.inconscient)) applyZeroWounds(c);
  return lost;
}

/** Upkeep de mort en fin de Round : LDB 18 l.15 ; MDG 13 l.656, l.674. Retourne le journal. */
export function tickDeath(c: Combatant): string[] {
  const log: string[] = [];
  if (c.dead || c.outOfRencontre || isInanimate(c)) return log; // #1595 c.6219992594 (S1) ; MDG 13 l.656, l.674
  if (c.wounds.current > 0) {
    c.roundsAtZero = 0;
    return log;
  }
  c.roundsAtZero = (c.roundsAtZero ?? 0) + 1;
  if (c.roundsAtZero > bonus(effectiveChar(c, 'endurance')) && !hasCondition(c, COND.inconscient)) {
    addCondition(c, COND.inconscient);
    log.push(t('cond.unconscious', { name: c.label, rounds: c.roundsAtZero }));
  }
  return log; // la mort (dead) est finalisée par le store (avec sauvetage par Destin)
}
