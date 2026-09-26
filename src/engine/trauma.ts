/**
 * Traumatismes — Livre de base, « Traumatisme » (LDB 18). Factory unique
 * kind+sévérité+localisation → effets en-combat modélisés, partagée par les Blessures critiques
 * et les Maladresses. On ne modélise que ce qui est quantifié et câblable sans inventer :
 *   - Déchirure musculaire sur Jambe → Mouvement ÷2 (LDB 18 l.220).
 *   - Fracture Torse → Force/Agilité −30 + Mouvement ÷2 (LDB 18 l.200).
 *   - Fracture Jambe → Mouvement ÷2 (règle du Pied, LDB 18 l.285).
 * Fracture/Déchirure de Bras/Tête : latéralité non modélisée (effet journalisé). Amputations de MAIN/DOIGTS :
 * la pénalité (LDB 18 l.251/263) est CONTEXTUELLE À L'ARME — `amputationCombatPenalty`, lue par attack/
 * defenseModifiers — et ne s'applique qu'aux jets d'arme qui IMPLIQUENT la main blessée (jamais un charMod
 * CC/CT global). Le trauma est enregistré (label+note) même sans effet modélisé.
 */
import { Combatant, CharKey, CHAR_LABELS, HitLocation, ItemInstance, Trauma, Difficulty, UpkeepDeferTest, Weapon, effectRef, locationLabel, type BodyShape, type ModFamille } from './types';
import { RNG, defaultRNG } from './dice';
import type { Duration } from './duration';
import type { CritEscalation } from '../data/criticals';
import { poserEnjeu, type FlowTestNode } from './flowCore';
import type { StakeRef } from '../data';
import { isPainless, traitPassiveMods } from './traits/dispatch';
import { findById, findConditionById, findPsychologyById, findTrappingById, refLabel } from '../data';
import type { CodexTarget } from './ruleRefs';
import { talentPassiveMods } from './talentEffects';
import { diseasePassiveOps } from './disease';
import { sourceSuspended } from './suspension';
import { hungerCharPenalties, thirstCharPenalties } from './provisions';
import { drunkCharPenalties } from './drunkenness';
import { hasActiveFlag } from './activeFlags';
import { wornSocialMods, qualityWearMods } from './wearPenalty';
import type { GameOp, PairedSense, PassiveKind, PassiveMod } from './ops';
import { normalizePassiveKind, resolveFormula } from './ops';
import traumasJson from '../data/traumas.json';
import { indexParId, memoParVersion } from '../data/versionDataset';
import { t as tr } from '../i18n'; // alias : `t` est un identifiant local très fréquent ici (la séquelle courante)

export type TraumaKind = 'dechirure' | 'fracture';
export type TraumaSeverity = 'mineur' | 'majeur';

const LEG: HitLocation[] = ['jambeG', 'jambeD'];

/** Texte de la plaie chirurgicale d'une amputation (fiche `amputation-plaie`, LDB 18 l.239, DISPLAY-ONLY) —
 *  SOURCE UNIQUE partagée par l'op `amputer` (ops.ts) et `stampCriticalEscalation` (« Pied écrasé »). */
export function amputationWoundDesc(): string | undefined {
  return traumaFicheById('amputation-plaie').desc;
}

/**
 * Règle de COMPTAGE/AGRÉGATION d'une séquelle CUMULATIVE, déclarée sur SON entrée de `traumas.json` —
 * LDB 18 l.247 (dents), l.251 (doigts), l.273 (œil), l.277 (oreille), l.281 (orteils). Le moteur
 * (`permanentAmputations`, `consolidateAmputations`) applique la règle DÉCLARÉE : il n'énumère aucune
 * séquelle par id.
 */
export interface TraumaCumul {
  /** Regroupement des occurrences : par Localisation (LDB 18 l.251 « cette main », l.281 orteils — le
   *  membre reste identifiable à l'écran) ou sur le PORTEUR (l.247 dents, l.273/277 organes pairés).
   *  La QUANTITÉ perdue, elle, n'est pas ici : elle est portée par la LIGNE de Critique
   *  (`Amputation.unites`, « Perdez 1d10 dents »). */
  portee: 'localisation' | 'porteur';
  /** Ops appliquées PAR PALIER de `taille` unités : leur amplitude (`mod`) est multipliée par le
   *  nombre de paliers atteints (`floor(total / taille)`). */
  parPalier?: { taille: number; ops: GameOp[] };
  /** Seuil au-delà duquel la séquelle `versTraumaId` s'applique — `remplace` (LDB 18 l.251) retire les
   *  occurrences comptées, `ajoute` (l.273/277) les conserve. */
  escalade?: { atLeast: number; versTraumaId: string; mode: 'remplace' | 'ajoute' };
}

/**
 * Routage d'APPARENCE de la séquelle sur le rig (LDB 18 / prothèses LDB 73) — pur affichage, lu par
 * `injuryOverlaysFor` (`gameIso/rig/parts/injuries.ts`) : le rig ne nomme plus aucune séquelle.
 */
export interface TraumaRig {
  /** Os porteur du calque (`BoneId`) ; suffixé `G`/`D` d'après la Localisation si `lateral`. */
  bone: string;
  lateral?: boolean;
  /** Art par défaut (`PROSTHESIS`) ; absent = rien tant qu'aucune prothèse n'est portée. */
  art?: string;
  /** Art substitué quand la prothèse `trappingId` est PORTÉE (première portée gagne). */
  byProsthesis?: { trappingId: string; art: string }[];
  /** Os effacé en plus du calque (même latéralité). */
  hidesBone?: string;
  view?: 'front';
  replace?: boolean;
}

/**
 * Fiche de Traumatisme (registre `traumas.json`, app-owned) : mécanique = `ops` (GameOp[]), `desc` =
 * texte canon LDB 18 VERBATIM (DISPLAY-ONLY, jamais parsé). Couvre déchirures/fractures par localisation
 * et toutes les séquelles permanentes d'amputation (+ Cécité/Surdité agrégées). `kind`/`severity` portés
 * pour la convalescence à étapes ; `prosthesis` = annulateurs (LDB 73).
 */
export interface TraumaFiche {
  id: string;
  type: 'traumas';
  label: string;
  desc: string;
  ops?: GameOp[];
  kind?: TraumaKind;
  severity?: TraumaSeverity;
  prosthesis?: { trappingId: string; cancels: 'all' | 'movement' }[];
  /** Séquelle CUMULATIVE : sa règle de comptage/agrégation, en donnée (LDB 18 l.247/251/273/277/281). */
  cumul?: TraumaCumul;
  /** Routage d'apparence sur le rig (affichage pur). */
  rig?: TraumaRig;
  needsSurgery?: boolean;
  /** Séquelle COSMÉTIQUE (cicatrice) : n'est PAS une Blessure critique comptée (`criticalWounds`) — cf. `Trauma.cosmetic`. */
  cosmetic?: boolean;
  /** Séquelle d'AMPUTATION/perte de membre-organe (LDB 18 l.239-285) — tag STABLE distinguant les
   *  pénalités « qui découlent d'amputations » (LDB 85 l.195, cf. `painlessIgnores`) de toute autre
   *  pénalité de Blessure critique. Porté par la FICHE (`Trauma` n'a pas de champ propre) — relu via
   *  `t.traumaId` par `isAmputationTrauma`. */
  amputation?: boolean;
  /** Surcharge du `kind` passif (défaut : `traumaOpKind`) — cf. `Trauma.passiveKind`. */
  passiveKind?: import('./ops').PassiveKind;
  /** Note MAISON (règle stricte 7) — trace éditable d'un arbitrage d'un point que le RAW laisse au contexte
   *  (« certains Tests sociaux » / « en fonction du contexte »). DISPLAY/DOC only, jamais lu pour la mécanique. */
  maison?: string;
}

const FICHES = traumasJson as TraumaFiche[];
const ficheById = indexParId('traumas', FICHES);

/** Fiche de Traumatisme par id STABLE (`traumas.json`). Lève si l'id est inconnu (réf cassée = bug data). */
export function traumaFicheById(id: string): TraumaFiche {
  const f = ficheById(id);
  if (!f) throw new Error(`Trauma fiche inconnue : ${id}`);
  return f;
}

/** Fiche de Traumatisme, ou `undefined` si l'id n'est plus au catalogue — porte TOLÉRANTE réservée aux
 *  canaux d'AFFICHAGE (rendu de rig, écrans) : une entrée supprimée/renommée au Codex laisse des
 *  `traumaId` orphelins dans les saves, et un écran ne doit pas planter pour un visuel manquant. Toute
 *  lecture MÉCANIQUE passe par `traumaFicheById`, qui lève (une règle silencieusement absente = bug). */
export function findTraumaFiche(id: string | undefined): TraumaFiche | undefined {
  return ficheById(id);
}

/** Ops PASSIVES d'une séquelle (lecteur UNIQUE de `t.ops` — vocab GameOp partagé). */
function traumaOps(t: Trauma): GameOp[] {
  return t.ops ?? [];
}
/** Filtre typé d'une liste d'ops par type d'op (narrowing — `.char`/`.skill`/`.hands` accessibles). */
function opsOfType<K extends GameOp['op']>(ops: GameOp[], op: K): Extract<GameOp, { op: K }>[] {
  return ops.filter((o): o is Extract<GameOp, { op: K }> => o.op === op);
}

/**
 * Durée de convalescence d'un trauma en JOURS (LDB 18) : déchirure mineure 30−BE (l.222) ; déchirure
 * majeure 2×(30−BE), deux périodes (l.231) ; fracture 30+1d10 (l.202), +10 jours si majeure (l.212).
 * `be` = Bonus d'Endurance, `d10` = 1d10 (fractures). Plancher 1 jour.
 */
export function traumaRecoveryDays(kind: TraumaKind, severity: TraumaSeverity, be: number, d10 = 5): number {
  if (kind === 'dechirure') {
    const base = Math.max(1, 30 - be);
    return severity === 'majeur' ? base * 2 : base;
  }
  return 30 + d10 + (severity === 'majeur' ? 10 : 0);
}

/** Résout la fiche de déchirure/fracture (`traumas.json`) pour un `{kind,severity,location}` — utilisé
 *  par `resolveCritique` (refs déjà résolues dans `criticals.json`) et l'éditeur (`inflictTrauma`). */
export function dechirureFractureFicheId(kind: TraumaKind, severity: TraumaSeverity, location: HitLocation): string {
  const onLeg = LEG.includes(location);
  const sevW = severity === 'majeur' ? 'majeure' : 'mineure';
  if (kind === 'dechirure') return onLeg ? `dechirure-jambe-${sevW}` : `dechirure-autre-${sevW}`;
  const zone = location === 'corps' ? 'torse' : onLeg ? 'jambe' : location === 'tete' ? 'tete' : 'bras';
  return `fracture-${zone}-${sevW}`;
}

/** Amplitude d'une op de palier multipliée par le nombre de paliers atteints (`mod` : `charMod`,
 *  `skillMod`, `moveMod`…). Une op sans amplitude chiffrée est émise TELLE QUELLE dès le 1ᵉʳ palier. */
function scalePalierOp(o: GameOp, paliers: number): GameOp {
  return 'mod' in o && typeof o.mod === 'number' ? { ...o, mod: o.mod * paliers } : { ...o };
}

/** Ops d'une séquelle pour `count` unités perdues : ops de base + `cumul.parPalier` mises à l'échelle du
 *  nombre de paliers (`floor(count / taille)`, LDB 18 l.247 « pour chaque paire », l.281 « pour chaque
 *  orteil »). SOURCE UNIQUE lue par `traumaById`, `permanentAmputations` et `consolidateAmputations`. */
export function traumaCumulOps(f: TraumaFiche, count: number): GameOp[] {
  const base = (f.ops ?? []).map((o) => ({ ...o }));
  const p = f.cumul?.parPalier;
  if (!p) return base;
  const paliers = Math.floor(count / Math.max(1, p.taille));
  return paliers <= 0 ? base : [...base, ...p.ops.map((o) => scalePalierOp(o, paliers))];
}

/** Pose `count` unités sur une séquelle cumulative et recalcule ses ops (`traumaCumulOps`). Mute `t`. */
export function setTraumaCount(t: Trauma, f: TraumaFiche, count: number): Trauma {
  t.count = count;
  const ops = traumaCumulOps(f, count);
  if (ops.length) t.ops = ops;
  else delete t.ops;
  return t;
}

/** Instancie un `Trauma` POSÉ depuis une fiche `traumas.json` (mécanique = `ops`, `desc` = canon
 *  DISPLAY-ONLY) à la `location` du coup. `opts.be` (Bonus d'Endurance) + `opts.d10` (1d10 des fractures)
 *  → durée de convalescence `recoveryDays` COMPUTÉE par la formule (jamais stockée). La sévérité est
 *  portée par la fiche (déchirures ET fractures sont désormais des fiches par localisation+sévérité).
 *  Omis (tests/legacy) ⇒ pas de décompte (séquelle permanente jusqu'à traitement explicite). */
export function traumaById(id: string, opts?: { be?: number; d10?: number }, location?: HitLocation): Trauma {
  const f = traumaFicheById(id);
  const out: Trauma = {
    label: f.label,
    traumaId: f.id,
    location: location ?? 'corps',
    desc: f.desc,
    ...(f.ops ? { ops: f.ops.map((o) => ({ ...o })) } : {}),
    ...(f.prosthesis ? { prosthesis: f.prosthesis.map((p) => ({ ...p })) } : {}),
  };
  // Convalescence à étapes (déchirure/fracture seules). Une fracture MAJEURE « fort peu probable qu'il se soigne
  // correctement sans intervention médicale » (l.208) exige la Chirurgie ; la formule garde le 1d10 seedé chez l'appelant.
  if (f.kind) {
    const sev: TraumaSeverity = f.severity ?? 'mineur';
    const recoveryDays = opts?.be == null ? undefined : traumaRecoveryDays(f.kind, sev, opts.be, opts.d10 ?? 5);
    out.kind = f.kind;
    out.severity = sev;
    out.label = `${f.label} (${sev === 'majeur' ? 'Majeure' : 'Mineure'})`; // libellé canon avec sévérité
    if (recoveryDays != null) { out.recoveryDays = recoveryDays; out.recoveryTotal = recoveryDays; }
    if (f.kind === 'fracture' && sev === 'majeur') out.needsSurgery = true;
  }
  if (f.cumul) setTraumaCount(out, f, 1); // séquelle cumulative : UNE unité par défaut (LDB 18 l.251/281)
  if (f.needsSurgery) out.needsSurgery = true;
  if (f.cosmetic) out.cosmetic = true;
  if (f.passiveKind) out.passiveKind = f.passiveKind;
  return out;
}

/** La PLAIE chirurgicale d'une amputation (fiche `amputation-plaie`, LDB 18 l.239) : instanciée INLINE,
 *  donc SANS `traumaId` — au plus UNE par membre. SOURCE UNIQUE du prédicat, partagée par l'op `amputer`
 *  (qui la pose) et par `stampCriticalEscalation` (qui l'échelonne : `perRound`, `amputateAfterDays`). */
export const estPlaieAmputation = (t: Trauma): boolean => !!t.needsSurgery && t.traumaId == null;

/** Libellé d'une fiche de Traumatisme par id, SANS lever si la réf est cassée (contrairement à
 *  `traumaFicheById`) — SOURCE UNIQUE des points d'AFFICHAGE défensifs (Codex, humanisation d'op). */
export function traumaLabelOf(id: string): string {
  try { return traumaFicheById(id).label; } catch { return id; }
}

/**
 * Séquelles PERMANENTES d'une amputation (LDB 18 l.233-286) — distinctes de la plaie chirurgicale : elles
 * survivent à la Chirurgie (le membre reste absent). Instanciées depuis les `sequels` (ids de fiche
 * `traumas.json`) DÉCLARÉS STRUCTURELLEMENT sur le critique (`entry.amputation.sequels`, relayés par l'op
 * `amputer`) — plus aucune lecture du texte. La latéralité (brasG/brasD, jambeG/jambeD) provient de la
 * `location` réelle du coup — hypothèse de jeu : **tout le monde est DROITIER** (main principale = brasD).
 * Une séquelle CUMULATIVE (`TraumaFiche.cumul`) reçoit ici le nombre d'unités que la LIGNE de Critique
 * fait perdre (`units` — « Perdez 1d10 dents », « un orteil par DR en dessous de 0 ») ; une séquelle NON
 * cumulative l'ignore (« perdez votre langue ET 1d10 dents »). L'agrégation et les seuils suivent
 * (`consolidateAmputations`). SOURCE UNIQUE.
 */
export function permanentAmputations(sequels: string[], location: HitLocation, units = 1): Trauma[] {
  return sequels.map((id) => {
    const fiche = traumaFicheById(id);
    const t = traumaById(id, undefined, location);
    if (fiche.cumul) setTraumaCount(t, fiche, units);
    return t;
  });
}

/** Une déchirure musculaire MAJEURE de jambe guérit en DEUX temps (LDB 18 l.231) : après la 1ʳᵉ moitié
 *  (recoveryTotal/2), la pénalité de mobilité passe de −20 à −10 ; la 2ᵉ moitié achève la guérison. */
function downgradeTornMuscle(t: Trauma, leftDays: number, shape?: BodyShape): string | null {
  const esq = opsOfType(t.ops ?? [], 'skillMod').find((o) => o.skill.id === 'esquive');
  if (t.kind !== 'dechirure' || t.severity !== 'majeur' || esq?.mod !== -20 || t.recoveryTotal == null) return null;
  if (leftDays > t.recoveryTotal / 2) return null; // pas encore à la mi-durée
  esq.mod = -10; // rémission partielle (LDB 18 l.231)
  return tr('tra.tornRemission', { loc: locationLabel(t.location ?? 'corps', shape) });
}

/**
 * Séquelle PERMANENTE d'une fracture mal ressoudée (LDB 18 l.202/212) : à la fin de la convalescence, un
 * Test de Résistance raté laisse −5 (mineure) / −10 (majeure) en Agilité (Bras/Jambe/Torse) — la Tête
 * (−5/−10 Langue, compétence) est journalisée sans pénalité chiffrée (hors modèle charPenalty).
 */
function fractureSequela(t: Trauma, shape?: BodyShape): Trauma | null {
  const pen = t.severity === 'majeur' ? -10 : -5;
  if (t.location === 'tete') return { label: tr('tra.fractureSequelaLabel', { loc: locationLabel(t.location ?? 'corps', shape) }), location: t.location, ops: [{ op: 'skillMod', skill: { id: 'langue' }, mod: pen }], desc: traumaFicheById('fracture-mal-ressoudee-tete').desc };
  return { label: tr('tra.fractureSequelaLabel', { loc: locationLabel(t.location ?? 'corps', shape) }), location: t.location, ops: [{ op: 'charMod', char: 'agilite', mod: pen }], desc: traumaFicheById('fracture-mal-ressoudee-membre').desc };
}

/** Difficulté du Test de fin de fracture (LDB 18 l.202/212) selon la sévérité. */
export function fractureEndDifficulty(severity: string): Difficulty {
  return severity === 'majeur' ? 'intermediaire' : 'accessible';
}

/**
 * Applique le RÉSULTAT du Test de fin de fracture (séparé du jet pour différer/influencer en cascade) :
 * un échec laisse une SÉQUELLE permanente (−5/−10 Ag, l.202/212), une réussite ressoude proprement.
 * Mute `c.traumas` (ajoute la séquelle) ; renvoie le journal. La fracture résolue a déjà été retirée
 * (et `criticalWounds` décrémenté) par `tickTraumaRecovery`. Partagé eager ⊥ cascade — zéro duplication.
 */
export function applyFractureEnd(c: Combatant, success: boolean, severity: string, location: string, label: string): string[] {
  if (success) return [tr('tra.fractureHealed', { name: c.label, label })];
  const seq = fractureSequela({ kind: 'fracture', severity, location, label } as Trauma, c.bodyShape);
  if (!seq) return [];
  c.traumas = [...(c.traumas ?? []), seq];
  return [tr('tra.fractureSequela', { name: c.label, label })];
}

/**
 * Convalescence : décompte `days` jours sur chaque trauma à durée. Étapes (LDB 18) :
 *  - déchirure majeure → rémission partielle (−20→−10) au passage de la mi-durée (l.231) ;
 *  - fracture atteignant 0 → Test de Résistance de fin (Accessible mineure / Intermédiaire majeure, l.202/212)
 *    SAUF si la fracture a été « réduite » (bandée, `fractureSet`, l.204) ; un échec laisse une séquelle
 *    permanente (−5/−10 Ag). Sinon le trauma disparaît (pénalités levées) + `criticalWounds`−−.
 * Le Test de fin de fracture n'est PAS roulé ici : il part à la porte (`defer`), qui en calcule la
 * valeur (`testValue` de Résistance, `LDB 18 l.202`) et l'ouvre — #1657 B3-3.
 * Pur ; mute `c`, renvoie le journal.
 */
export function tickTraumaRecovery(c: Combatant, days: number, defer: UpkeepDeferTest): string[] {
  if (!c.traumas?.length || days <= 0) return [];
  const log: string[] = [];
  const remaining: Trauma[] = [];
  const fractureTests: { severity: string; location: string; label: string }[] = [];
  for (const t of c.traumas) {
    // « Pied écrasé » (AA 07 l.180 / LDB) : perte définitive du membre si la Chirurgie de la plaie n'est pas
    // faite dans le délai (1d10 jours). L'opération réussie retire la plaie AVANT l'échéance (removeSurgicalTrauma)
    // → ce trauma n'existe plus ici → membre sauvé. Sinon, à l'échéance, la séquelle permanente est posée.
    if (t.amputateAfterDays != null) {
      const dLeft = t.amputateAfterDays - days;
      if (dLeft > 0) { remaining.push({ ...t, amputateAfterDays: dLeft }); continue; }
      // Délai expiré sans Chirurgie : le membre est perdu (séquelle permanente `amputateSequel`) ; la plaie
      // reste chirurgicale (le moignon exige toujours une opération), débarrassée de son décompte d'escalade.
      remaining.push({ ...t, amputateAfterDays: undefined, amputateSequel: undefined });
      if (t.amputateSequel) remaining.push(traumaById(t.amputateSequel, undefined, t.location));
      log.push(tr('tra.limbLostNoSurgery', { name: c.label, label: t.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape) }));
      continue;
    }
    if (t.recoveryDays == null) { remaining.push(t); continue; }
    const left = t.recoveryDays - days;
    if (left > 0) {
      const next = { ...t, recoveryDays: left };
      const msg = downgradeTornMuscle(next, left, c.bodyShape);
      if (msg) log.push(tr('tra.tornRemissionLine', { name: c.label, msg }));
      remaining.push(next);
      continue;
    }
    // Résolu : la fracture/déchirure est retirée, la Blessure critique décomptée (l.222).
    if (c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1);
    if (t.kind === 'fracture' && !t.fractureSet) fractureTests.push({ severity: t.severity ?? 'mineur', location: t.location ?? '', label: t.label });
    else log.push(tr('tra.recovered', { name: c.label, label: t.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape) }));
  }
  c.traumas = remaining;
  // Test de fin de fracture (l.202/212) : le producteur NOMME ce qui est testé (« Test de Résistance »)
  // et DIFFÈRE — la valeur est celle de la porte (`testValue` : États compris), la conséquence est
  // appliquée par l'applier `traumaFracture` (`applyFractureEnd`). La porte est EXIGÉE au type : il n'y
  // a pas de chemin où cette fracture se résout dans le dos du joueur.
  for (const f of fractureTests) {
    defer({ kind: 'traumaFracture', label: `Convalescence — ${f.label}`, test: { skill: 'resistance' }, difficulty: fractureEndDifficulty(f.severity),
      meta: { severity: f.severity, location: f.location, traumaLabel: f.label } });
  }
  return log;
}

/**
 * Guérison MIRACULEUSE de Blessures critiques (Jalon 2.6 — Larmes de Shallya, LDB 42 : « vous
 * guérissez la cible d'1 Blessure Critique. Pour chaque +2 DR, +1 […] jamais une amputation ») :
 * retire jusqu'à `n` traumas de CONVALESCENCE (déchirures/fractures — `kind` posé ; les
 * amputations et leurs séquelles, sans `kind`, sont exclues) avec leurs pénalités, et décrémente
 * `criticalWounds`. Mute `c`, renvoie le journal.
 */
export function cureCriticalWounds(c: Combatant, n: number): string[] {
  if (!c.traumas?.length || n <= 0) return [];
  const log: string[] = [];
  let left = n;
  const kept: Trauma[] = [];
  for (const t of c.traumas) {
    if (left > 0 && t.kind != null) {
      left -= 1;
      if (c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1);
      log.push(tr('tra.curedMiraculously', { name: c.label, label: t.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape) }));
    } else kept.push(t);
  }
  c.traumas = kept;
  return log;
}

/** Le personnage porte-t-il un trauma exigeant de la Chirurgie (amputation, fracture majeure, l.208/239) ? */
export function hasSurgeryTrauma(c: Combatant): boolean {
  return (c.traumas ?? []).some((t) => t.needsSurgery);
}

/** Une arme IMPLIQUE-t-elle la main `side` (LDB 18) ? Arme à 2 mains → les DEUX ; arme à 1 main → sa main de
 *  tenue seulement (`hand:'off'` = gauche/secondaire, sinon droite/principale). Base de la pénalité d'amputation
 *  CONTEXTUELLE : une amputation ne grève un jet d'arme que si l'arme tient la main blessée. Pur. */
export function weaponUsesHand(weapon: Weapon, side: 'left' | 'right'): boolean {
  if ((weapon.hands ?? 1) >= 2) return true;
  const inLeft = weapon.hand === 'off';
  return side === 'left' ? inLeft : !inLeft;
}

/** Pénalité d'amputation à un JET D'ARME (attaque/parade) — LDB 18 l.251 (Doigts : −5/doigt aux Tests qui
 *  IMPLIQUENT cette main) / l.263 (Main : −20 aux Tests qui UTILISENT cette main ; + −20 additionnel aux Tests
 *  d'Arme de la main SECONDAIRE si la main PRINCIPALE est perdue). Ne s'applique qu'aux mains que `weapon` tient
 *  (`weaponUsesHand`) — hypothèse de jeu DROITIER (main principale = brasD). ≤ 0. Lue par attack/defenseModifiers. */
/** Doigts perdus (trauma `doigt-ampute`) à la Localisation `loc` (brasG/brasD) — comptage cumulé. Source
 *  UNIQUE (#101 l'exposait en closure privée de `amputationCombatPenalty` ; #144 la réutilise pour
 *  l'escalade de Maladresse par doigt perdu, LDB 18 l.251). */
export function fingersLost(c: Combatant, loc: HitLocation): number {
  const traumas = c.traumas ?? [];
  return traumas.filter((t) => t.traumaId === 'doigt-ampute' && t.location === loc).reduce((s, t) => s + (t.count ?? 1), 0);
}

/** Doigts perdus sur la main la PLUS affectée qu'IMPLIQUE `weapon` (`weaponUsesHand`) — 0 si aucune main
 *  impliquée n'a de doigt perdu. Base de l'escalade de Maladresse par doigt perdu (LDB 18 l.251, #144) :
 *  lue par `attackerFumbled`/`defenderFumbled` (combatFlow.ts), jamais un recomptage dupliqué. */
export function maxFingersLostForWeapon(c: Combatant, weapon: Weapon): number {
  let max = 0;
  for (const [side, loc] of [['left', 'brasG'], ['right', 'brasD']] as const) {
    if (weaponUsesHand(weapon, side)) max = Math.max(max, fingersLost(c, loc));
  }
  return max;
}

export function amputationCombatPenalty(c: Combatant, weapon: Weapon): number {
  const traumas = c.traumas ?? [];
  const handAmputated = (loc: HitLocation) => traumas.some((t) => t.traumaId === 'main-bras-ampute' && t.location === loc);
  // Rachat GRADUÉ par prothèse entraînée (LDB 73 l.19) : chaque tranche acquise se SOUSTRAIT de la
  // pénalité de main perdue, jusqu'à l'annuler entièrement (400 PX). Déclaré en donnée, jamais ici.
  const rachat = prosthesisPenaltyBuyback(c);
  const mainPerdue = Math.max(0, 20 - rachat);
  let penalty = 0;
  for (const [side, loc] of [['left', 'brasG'], ['right', 'brasD']] as const) {
    if (!weaponUsesHand(weapon, side)) continue;
    if (handAmputated(loc)) penalty -= mainPerdue;
    else penalty -= 5 * fingersLost(c, loc);
  }
  if (handAmputated('brasD') && weaponUsesHand(weapon, 'left')) penalty -= mainPerdue; // clause l.263 : main principale perdue → main secondaire à −20
  return penalty;
}

/** Fiches à règle de cumul déclarée (`TraumaCumul`) — l'ordre du registre fixe l'ordre de consolidation. */
const cumulFiches = memoParVersion('traumas', () => FICHES.filter((f) => f.cumul));
const IS_CUMUL = (t: Trauma): boolean => cumulFiches().some((f) => f.id === t.traumaId);

/** Séquelle cumulative agrégée : `total` unités à `loc`, ops recalculées ; le libellé porte la
 *  Localisation quand le cumul est PAR LOCALISATION (LDB 18 l.251 « cette main »). */
function aggregateCumul(c: Combatant, f: TraumaFiche, loc: HitLocation, total: number): Trauma {
  const t = setTraumaCount(traumaById(f.id, undefined, loc), f, total);
  if (f.cumul!.portee === 'localisation') t.label = tr('tra.locSuffix', { label: f.label, loc: locationLabel(loc, c.bodyShape) });
  return t;
}

/** Effet JOUEUR d'une séquelle, DÉRIVÉ de ses ops déclarées (jamais une phrase écrite par cas) :
 *  pénalités chiffrées regroupées par valeur (« −30 en Capacité de Combat, Esquive »), puis les effets
 *  structurels (Mouvement, main, sens). Vide si la fiche ne déclare aucun effet. Sert le JOURNAL —
 *  l'affichage riche du Codex reste `opRows`/`GameOpChips` (couche UI). */
function sequelleEffet(f: TraumaFiche): string {
  const parMod = new Map<number, string[]>();
  const autres: string[] = [];
  for (const o of f.ops ?? []) {
    if (o.op === 'charMod') parMod.set(o.mod, [...(parMod.get(o.mod) ?? []), CHAR_LABELS[o.char]]);
    else if (o.op === 'skillMod') parMod.set(o.mod, [...(parMod.get(o.mod) ?? []), refLabel('skills', o.skill)]);
    else if (o.op === 'moveScale') autres.push(tr('tra.effetMouvement'));
    else if (o.op === 'maxWeaponHands') autres.push(tr('tra.effetUneMain'));
    else if (o.op === 'senseLoss') autres.push(tr(o.sense === 'vue' ? 'tra.effetVue' : 'tra.effetOuie'));
  }
  const chiffres = [...parMod].map(([mod, noms]) => tr('tra.effetMod', { sign: mod >= 0 ? '+' : '−', n: Math.abs(mod), noms: noms.join(', ') }));
  return [...chiffres, ...autres].join(' · ');
}

/**
 * Fusionne les séquelles CUMULATIVES par comptage (LDB 18) en UN trauma agrégé par groupe (≠ modèle
 * non-cumul : ici le RAW est explicitement cumulatif). La RÈGLE est portée par l'entrée `traumas.json`
 * (`cumul` : portée, unité, effet par palier, escalade) — ce moteur l'applique sans nommer aucune
 * séquelle. Mute `c.traumas`, renvoie le journal. Idempotent. Appelé après l'ajout d'une séquelle
 * d'amputation (combat) et après chaque escalade. Latéralité portée par `location` ; DROITIER (main
 * principale = brasD). La pénalité −5/doigt (et −20/main) reste CONTEXTUELLE À L'ARME
 * (`amputationCombatPenalty`), jamais un charMod posé ici.
 */
export function consolidateAmputations(c: Combatant): string[] {
  const log: string[] = [];
  const traumas = c.traumas ?? [];
  if (!traumas.some(IS_CUMUL)) return log;
  const kept = traumas.filter((t) => !IS_CUMUL(t));
  for (const f of cumulFiches()) {
    const grp = traumas.filter((t) => t.traumaId === f.id);
    if (!grp.length) continue;
    const cumul = f.cumul!;
    const locs = cumul.portee === 'localisation' ? [...new Set(grp.map((t) => t.location))] : [grp[0].location];
    for (const loc of locs) {
      const groupe = cumul.portee === 'localisation' ? grp.filter((t) => t.location === loc) : grp;
      const total = groupe.reduce((s, t) => s + (t.count ?? 1), 0);
      const esc = cumul.escalade;
      const atteint = !!esc && total >= esc.atLeast;
      if (!atteint || esc!.mode === 'ajoute') kept.push(aggregateCumul(c, f, loc, total));
      if (!atteint) continue;
      const cible = traumaFicheById(esc!.versTraumaId);
      const dejaLa = kept.some((t) => t.traumaId === cible.id && (cumul.portee === 'porteur' || t.location === loc));
      if (dejaLa) continue;
      const posee = traumaById(cible.id, undefined, loc);
      if (cumul.portee === 'localisation') posee.label = tr('tra.locSuffix', { label: cible.label, loc: locationLabel(loc, c.bodyShape) });
      kept.push(posee);
      const effet = sequelleEffet(cible);
      log.push(tr(effet ? 'tra.cumulEscalated' : 'tra.cumulEscalatedPlain', { name: c.label, count: total, source: f.label, label: posee.label, effet }));
    }
  }
  c.traumas = kept;
  return log;
}

/**
 * Aide Médicale reçue (LDB 18 l.307-312 : Compétence Guérison réussie, bandage/cataplasme, ou sort/prière de
 * soin) : lève le drapeau `awaitingMedicalAid` de TOUTES les séquelles en attente — le PREMIER acte de soin des
 * 3 formes stoppe leur aggravation (escalade « 1 doigt de plus par Round » de « Main ouverte », AA 07 l.127 / LDB).
 * Appelé par les 3 formes (ops `heal`/`healCaster`/`preventInfection` ; succès de Guérison en infirmerie). Pur.
 */
export function receiveMedicalAid(c: Combatant): string[] {
  const awaiting = (c.traumas ?? []).filter((t) => t.awaitingMedicalAid);
  if (!awaiting.length) return [];
  for (const t of awaiting) t.awaitingMedicalAid = false;
  return [tr('tra.medicalAid', { name: c.label })];
}

/**
 * Escalade PÉRIODIQUE d'une plaie (« Main ouverte », AA 07 l.127 / LDB) : à CHAQUE fin de Round de combat
 * SANS Aide Médicale (`awaitingMedicalAid`), la plaie ajoute `perRound.unites` unité(s) de la séquelle
 * qu'elle DÉCLARE (`Trauma.perRound`, posée par `stampCriticalEscalation`). `consolidateAmputations`
 * applique ensuite la règle de cumul de cette séquelle (LDB 18 l.251). Mute `c`, renvoie le journal.
 * Appelé par le hook de franchissement de Round (`roundHooks`, machinerie universelle — ne nomme aucune entité).
 */
export function tickTraumaEscalation(c: Combatant, _rng: RNG = defaultRNG): string[] {
  const gated = (c.traumas ?? []).filter((t) => t.perRound && t.awaitingMedicalAid);
  if (!gated.length) return [];
  const log: string[] = [];
  for (const t of gated) {
    const fiche = traumaFicheById(t.perRound!.versTraumaId);
    const ajout = setTraumaCount(traumaById(fiche.id, undefined, t.location), fiche, t.perRound!.unites ?? 1);
    c.traumas = [...(c.traumas ?? []), ajout];
    log.push(tr('tra.escalationTick', { name: c.label, label: fiche.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape) }));
  }
  const cons = consolidateAmputations(c);
  // Seuil d'escalade de la séquelle FRANCHI (« Si vous perdez tous vos doigts, vous perdez votre main ») :
  // la plaie n'a plus de quoi s'aggraver, son escalade s'éteint. Vérifié PAR LOCALISATION — une escalade en
  // cours sur l'AUTRE membre n'est pas coupée par un franchissement voisin.
  for (const t of c.traumas ?? []) {
    const seuil = t.perRound && traumaFicheById(t.perRound.versTraumaId).cumul?.escalade;
    if (seuil && (c.traumas ?? []).some((x) => x.traumaId === seuil.versTraumaId && x.location === t.location)) {
      t.perRound = undefined;
      t.awaitingMedicalAid = false;
    }
  }
  return [...log, ...cons];
}

/**
 * Instancie l'escalade GATÉE d'un critique (`CritEscalation`, LDB / Aux Armes) — SOURCE UNIQUE partagée par
 * `resolveCritique` (les deux jeux) :
 *  - `perRound` (« Main ouverte », l.127) → l'escalade périodique DÉCLARÉE + `awaitingMedicalAid` SUR la
 *    plaie chirurgicale (jouée à chaque fin de Round par `tickTraumaEscalation`) ;
 *  - `apresDelai` (« Pied écrasé », l.180) → `amputateAfterDays` (délai résolu) + `amputateSequel` SUR la
 *    plaie (séquelle posée si pas de Chirurgie à temps ; décompté à l'entretien par `tickTraumaRecovery`) ;
 *  - « Épaule luxée »/« Genou démis » (`medicalAidGate`) → POUSSE une NOUVELLE séquelle « membre désactivé » à
 *    `location` (pas de plaie chirurgicale : le membre n'est pas amputé mais inutilisable), porteuse de
 *    `restoreDR`/`recoveryPenalty`/`awaitingMedicalAid`.
 * Mute `traumas` en place. No-op si l'entrée ne déclare pas d'escalade (ou, pour finger/pied, pas de plaie).
 */
export function stampCriticalEscalation(
  traumas: Trauma[],
  esc: CritEscalation | undefined,
  location: HitLocation,
  ref: Combatant,
  rng: RNG = defaultRNG,
  existing: Trauma[] = [],
  /** ENJEU (#1117) POSÉ sur le nœud `critTrigger` à l'armement — la rangée qui arme EST le foyer, et
   *  seul ce point la connaît (la séquelle, elle, ne porte que son nœud). Il voyage avec le Trauma. */
  enjeu?: StakeRef,
): void {
  if (!esc) return;
  // La PLAIE chirurgicale est le PORTEUR de l'escalade — `perRound` (« Main ouverte », LDB 18 l.122) comme
  // `apresDelai` (« Pied écrasé », l.180) vivent SUR elle. Le nœud d'Amputation la pose à la porte, APRÈS
  // ce point : l'escalade la CRÉE donc elle-même. UNE écriture de cette création, partagée par les deux
  // escalades ; l'op `amputer` dédoublonne par membre (`estPlaieAmputation`), la plaie reste unique.
  let plaie = traumas.find(estPlaieAmputation);
  const plaieOuCreee = (): Trauma => {
    if (!plaie) { plaie = { label: traumaFicheById('amputation-plaie').label, location, needsSurgery: true, desc: amputationWoundDesc() }; traumas.push(plaie); }
    return plaie;
  };
  if (esc.perRound) { const p = plaieOuCreee(); p.perRound = { ...esc.perRound }; p.awaitingMedicalAid = true; }
  if (esc.apresDelai) {
    const p = plaieOuCreee();
    p.amputateAfterDays = resolveFormula(esc.apresDelai.jours, ref, rng); p.amputateSequel = esc.apresDelai.versTraumaId;
  }
  if (esc.medicalAidGate) {
    const g = esc.medicalAidGate;
    traumas.push({
      label: g.label,
      location,
      ops: g.disable.map((o) => ({ ...o })),
      awaitingMedicalAid: true,
      restoreDR: g.restoreDR,
      recoveryPenalty: g.recoveryPenalty.map((o) => ({ ...o })),
    });
  }
  if (esc.bleedOnReinjury) {
    // Plaie « réouverte » (LDB 18 l.101/118/143/145/148/175 ; AA 07 l.119/147/149/152/175) : séquelle
    // chirurgicale portant `bleedOnReinjury` à `location` — la Chirurgie la retire (`needsSurgery`), le
    // déclencheur `reinjuryBleed` la lit au point d'application des Dégâts localisés.
    traumas.push({ label: esc.bleedOnReinjury.label, location, bleedOnReinjury: esc.bleedOnReinjury.amount, needsSurgery: true });
  }
  if (esc.onHealGrant) {
    // « Une fois que la blessure est guérie… » (LDB 18 l.61/72) : marqueur de la Blessure critique EN COURS de
    // guérison, porteur de la cicatrice à octroyer. La guérison (retrait des États `whenClear`) est détectée par
    // `settleHealedCriticals` au point unique de retrait d'État (`removeCondition`).
    traumas.push({ label: tr('tra.healingScar', { label: traumaFicheById(esc.onHealGrant.scar).label }), location, onHealGrant: { scar: esc.onHealGrant.scar, whenClear: [...esc.onHealGrant.whenClear] } });
  }
  if (esc.onNextCritWhileCondition) {
    // « Commotion cérébrale » (LDB 18 l.74) : séquelle porteuse d'un `critTrigger` — tant que le personnage
    // porte `whileCondition`, un critique subséquent à `location` impose le nœud `test`. Dédupliquée (une
    // même Localisation+État n'arme qu'un seul déclencheur : plusieurs commotions ne multiplient pas le Test).
    const n = esc.onNextCritWhileCondition;
    const same = (t: Trauma) => t.critTrigger?.whileCondition === n.whileCondition && t.critTrigger?.location === n.location;
    if (!existing.some(same) && !traumas.some(same)) {
      const noeud = structuredClone(n.test);
      traumas.push({
        label: n.label,
        location,
        critTrigger: { location: n.location, whileCondition: n.whileCondition, test: { ...noeud, test: poserEnjeu(noeud.test, enjeu) } },
      });
    }
  }
}

/**
 * Séquelles POST-guérison (LDB 18 l.61 « Blessure spectaculaire » / l.72 « Nez cassé ») : « Une fois que la
 * blessure est guérie… ». La guérison d'une Blessure critique est définie par le RAW (« Guérir les Blessures
 * critiques », l.304 : « pas guéries tant que tous les États associés n'ont pas été retirés et que tous les
 * modificateurs non permanents n'ont pas été supprimés ») → pour chaque marqueur `onHealGrant` dont AUCUN des
 * États `whenClear` n'est plus porté : retire le marqueur, décompte la Blessure critique (`criticalWounds`) et
 * octroie la cicatrice (fiche `scar`, séquelle PERMANENTE visible/éditable). Appelé au POINT UNIQUE de retrait
 * d'État (`removeCondition`) — l'instant où le dernier État associé tombe. Idempotent (le marqueur retiré ne
 * refait pas feu). Mute `c`, renvoie le journal. */
export function settleHealedCriticals(c: Combatant): string[] {
  const carriers = (c.traumas ?? []).filter((t) => t.onHealGrant);
  if (!carriers.length) return [];
  const log: string[] = [];
  for (const t of carriers) {
    const g = t.onHealGrant!;
    if (g.whenClear.some((name) => (c.conditions ?? []).some((x) => x.id === name))) continue; // LDB 18 l.304 : un État associé encore porté ⇒ Blessure critique non guérie
    c.traumas = (c.traumas ?? []).filter((x) => x !== t);
    if (c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1); // la Blessure critique est guérie (l.304)
    const scar = traumaById(g.scar, undefined, t.location);
    c.traumas.push(scar);
    log.push(tr('tra.scarLeft', { name: c.label, label: scar.label }));
  }
  return log;
}

/** Déclencheurs d'escalade (« Commotion cérébrale » : autre critique à la tête pendant Exténué → Test de
 *  Résistance ou Inconscient, LDB 18 l.74) armés sur `target` (`Trauma.critTrigger`) que le critique COURANT
 *  (à `location`) fait feu : pour chaque signature DISTINCTE dont le personnage porte l'État `whileCondition`
 *  et dont la `location` correspond (ou est absente), le nœud `test` de sauvegarde est RENDU — jamais roulé :
 *  l'appelant `state` l'ouvre par la porte, dans le geste du critique qui l'a fait feu. Lu au point unique de
 *  résolution (`resolveCritique`) ; PUR, aucun RNG. */
export function fireCritTriggers(target: Combatant, location: HitLocation): FlowTestNode[] {
  const out: FlowTestNode[] = [];
  const seen = new Set<string>();
  for (const t of target.traumas ?? []) {
    const trig = t.critTrigger;
    if (!trig) continue;
    if (trig.location && trig.location !== location) continue;
    if (!(target.conditions ?? []).some((c) => c.id === trig.whileCondition)) continue;
    const key = `${trig.location ?? ''}|${trig.whileCondition}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trig.test);
  }
  return out;
}

/** États Hémorragique octroyés par la RÉOUVERTURE des plaies critiques de `c` (LDB 18 / AA 07) lorsqu'il
 *  subit un nouveau Dégât à `location` : somme des `bleedOnReinjury` des plaies encore ouvertes (non
 *  recousues par Chirurgie) À CETTE Localisation. Un Dégât NON localisé (zone, chute) n'en rouvre aucune
 *  (RAW « Dégâts à cette Localisation ») ; plusieurs plaies gatées à la même Localisation CUMULENT (RAW ne
 *  les fusionne pas). Lu au point d'application des Dégâts localisés (`applyAttackResult`/Projectile magique). */
export function reinjuryBleed(c: Combatant, location: HitLocation): number {
  return (c.traumas ?? []).reduce((n, t) => n + (t.location === location ? (t.bleedOnReinjury ?? 0) : 0), 0);
}

/** Séquelles « membre désactivé » (`medicalAidGate`) dont l'Aide Médicale a été reçue et qui attendent le Test
 *  étendu de Guérison de récupération (acte « Guérison » de l'Infirmerie). */
export function recoverableTraumas(c: Combatant): Trauma[] {
  return (c.traumas ?? []).filter((t) => t.restoreDR != null && !t.awaitingMedicalAid);
}
/** Le personnage a-t-il un membre désactivé prêt à récupérer son usage (Aide Médicale reçue) ? */
export function hasRecoverableTrauma(c: Combatant): boolean {
  return recoverableTraumas(c).length > 0;
}
/** Un membre désactivé attend-il ENCORE l'Aide Médicale (le Test de récupération est bloqué tant qu'elle
 *  n'est pas donnée, LDB 18 l.120/179 : « Après application de cette Aide… ») ? */
export function hasLimbAwaitingAid(c: Combatant): boolean {
  return (c.traumas ?? []).some((t) => t.restoreDR != null && t.awaitingMedicalAid);
}
/** Main tenant l'arme concernée par une Localisation de BRAS (convention DROITIER partagée avec `disarm`/
 *  `handGate` : `brasD`→`main`, `brasG`→`off`) ; `undefined` pour toute autre Localisation (jambe/tête/corps,
 *  aucune notion de main). */
function armLocationHand(loc: HitLocation): 'main' | 'off' | undefined {
  return loc === 'brasD' ? 'main' : loc === 'brasG' ? 'off' : undefined;
}

/** Usage du membre RÉCUPÉRÉ (Test étendu de Guérison atteint) : retire la séquelle « membre désactivé »
 *  d'INDICE `idx` parmi `recoverableTraumas` et renvoie ses `recoveryPenalty` (posées par l'appelant via
 *  `applyOps`, avec une durée d'horloge partagée 1d10 jours) + le journal. #193 : un `testMod{char:'CC'}`
 *  de la `recoveryPenalty` (même donnée pour brasD/brasG) est ICI scopé à la main RÉELLE du membre — portée
 *  MEMBRE (« Tests effectués avec ce bras ») au lieu d'un `charMod` global historique. */
export function recoverDisabledLimb(c: Combatant, idx = 0): { penalty: import('./ops').GameOp[]; log: string[] } {
  const pool = recoverableTraumas(c);
  const t = pool[idx] ?? pool[0];
  if (!t) return { penalty: [], log: [tr('tra.noLimbToRehab', { name: c.label })] };
  c.traumas = (c.traumas ?? []).filter((x) => x !== t);
  const hand = armLocationHand(t.location);
  const penalty = (t.recoveryPenalty ?? []).map((o) => (hand && o.op === 'testMod' && o.char === 'capacite-de-combat' ? { ...o, weaponHand: hand } : { ...o }));
  return { penalty, log: [tr('tra.limbRestored', { name: c.label, label: t.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape) })] };
}

/** Le personnage ne peut PAS manier d'arme à deux mains (amputation de main/bras, LDB 18 l.263) — sauf
 *  prothèse qui annule tout (Merveille d'ingénierie, LDB 73). Lu par `recomputeLoadout` via `weaponHands`
 *  — le marqueur « (2M) » de la donnée est UNIFORME mêlée ET distance (Arc/Arbalète/Arquebuse/Tromblon),
 *  donc les armes à distance bimanuelles SONT couvertes. */
export function cannotWieldTwoHanded(c: Combatant): boolean {
  // Crochet PORTÉ et ENTRAÎNÉ (400 PX, LDB 73) : rachète entièrement la pénalité « deux mains ».
  if ((c.items ?? []).some((i) => i.trappingId === 'crochet' && i.equipped && i.prosthesisTrained)) return false;
  return pmods(c, 'maxWeaponHands').some((o) => o.hands < 2);
}

/** La main `hand` est-elle PERDUE (amputation non compensée par une prothèse « tout », Merveille, LDB 73) ?
 *  Convention droitier : main directrice = brasD, secondaire = brasG. Une main perdue ne peut tenir ni arme ni
 *  bouclier → `recomputeLoadout` vide le slot de loadout correspondant. (Un Crochet fournit sa PROPRE arme à
 *  part, dérivée séparément.) */
export function handAmputated(c: Combatant, hand: 'main' | 'off'): boolean {
  const loc = hand === 'main' ? 'brasD' : 'brasG';
  return (c.traumas ?? []).some((t) => t.location === loc && !prosthesisCancels(c, t, 'all') && opsOfType(traumaOps(t), 'maxWeaponHands').some((o) => o.hands < 2));
}

/** Retire un trauma chirurgical (opération réussie) ; décrémente `criticalWounds`. Mute `c`, renvoie le journal.
 *  Les DÉGÂTS de l'opération (1d10 + Hémorragique) et le risque d'Infection sont appliqués par l'appelant
 *  (le store) — ils dépendent de `loseWounds`/`addCondition`, hors de ce module pur (cycle d'import évité). */
/** Les Blessures Critiques d'un personnage qui nécessitent la Chirurgie (amputation, fracture majeure). */
export function surgeryTraumas(c: Combatant): Trauma[] {
  return (c.traumas ?? []).filter((t) => t.needsSurgery);
}

/** Retire le trauma chirurgical d'INDICE `idx` PARMI les blessures chirurgicales (le joueur choisit
 *  quelle Blessure Critique opérer s'il y en a plusieurs ; défaut = la première). */
export function removeSurgicalTrauma(c: Combatant, idx = 0): string[] {
  const surg = surgeryTraumas(c);
  const t = surg[idx] ?? surg[0];
  if (!t) return [tr('tra.noSurgicalWound', { name: c.label })];
  c.traumas = (c.traumas ?? []).filter((x) => x !== t);
  if (!t.cosmetic && c.criticalWounds) c.criticalWounds = Math.max(0, c.criticalWounds - 1); // une cicatrice n'est pas une Blessure critique comptée (déjà décomptée à la guérison)
  return [tr('tra.surgeryDone', { name: c.label, label: t.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape) })];
}

/** Le personnage a-t-il un trauma que la Compétence Guérison peut encore traiter ?
 *  Déchirure ou fracture dans sa fenêtre de pose (l.204), dont le jet unique (l.222) n'a pas été employé. */
export function hasTreatableTrauma(c: Combatant): boolean {
  return (c.traumas ?? []).some(eligibleForHeal);
}

function eligibleForHeal(t: Trauma): boolean {
  // Un seul jet de Guérison par trauma (l.222 : « une seule fois ») — l'échec consomme aussi le jet.
  if (t.recoveryDays == null || t.healAccelerated) return false;
  if (t.kind === 'dechirure') return true;
  // fracture : la pose (bandage) doit intervenir dans la SEMAINE suivant la fracture (l.204).
  return t.kind === 'fracture' && !t.fractureSet && t.recoveryTotal != null && t.recoveryDays > t.recoveryTotal - 7;
}

/**
 * Soin assisté d'un trauma par la Compétence Guérison (LDB 18). Le JET est consommé, réussi ou
 * non (l.222 : « vous ne pouvez obtenir cet avantage qu'une seule fois ») — sans quoi, sans MJ,
 * on relancerait gratuitement jusqu'au succès. Sur un succès :
 *  - déchirure MINEURE (l.222) → raccourcit la convalescence de **1 jour + 1 par DR** ;
 *  - déchirure MAJEURE (l.231 : « n'aura d'autre intérêt que de vous informer que vous ne pourrez pas
 *    utiliser la Localisation touchée tant que la rémission ne sera pas complète ») → AUCUNE accélération ;
 *    la Guérison ne fait que DIAGNOSTIQUER le délai restant (jours avant réutilisation du membre) ;
 *  - fracture dans la semaine (l.204) → « réduite » (bandée) ⟹ pas de Test de Résistance de fin.
 */
export function treatTrauma(c: Combatant, dr: number, success = true): string[] {
  const t = (c.traumas ?? []).find(eligibleForHeal);
  if (!t) return [tr('tra.nothingTreatable', { name: c.label })];
  t.healAccelerated = true; // ce trauma a eu son jet de Guérison (l.222)
  if (!success) return [tr('tra.treatFailed', { name: c.label, label: t.label })];
  if (t.kind === 'fracture') {
    t.fractureSet = true;
    return [tr('tra.fractureSet', { name: c.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape) })];
  }
  if (t.severity === 'majeur') { // déchirure majeure : la Guérison n'accélère rien, elle DIAGNOSTIQUE (l.231)
    return [tr('tra.tornDiagnosed', { name: c.label, loc: locationLabel(t.location ?? 'corps', c.bodyShape), days: t.recoveryDays ?? 0 })];
  }
  const cut = 1 + Math.max(0, dr);
  t.recoveryDays = Math.max(0, (t.recoveryDays ?? 0) - cut);
  return [tr('tra.recoveryShortened', { name: c.label, label: t.label, cut, left: t.recoveryDays })];
}

/** Une prothèse ÉQUIPÉE (portée — `items` avec `equipped`, LDB 73 « Enc 0 quand portées ») annule-t-elle
 *  l'`aspect` de la séquelle `t` ? Une prothèse `cancels:'all'` (Merveille d'ingénierie, Nez doré…) annule
 *  tout dès le PORT, sans entraînement (LDB 73 : « ignorer complètement »). Une prothèse `cancels:'movement'`
 *  (Fausse jambe) est PALIÈRE (l.23) : le simple port ne lève RIEN ici (il n'ignore que 1 PM, restauré
 *  POST-halving par `prosthesisMoveRestore`/`effectiveMovement`) ; il faut l'entraînement 100 PX
 *  (`prosthesisMoveTrained`) pour lever le ÷2, et 200 PX (`prosthesisTrained`) pour lever AUSSI l'Esquive.
 *  La simple POSSESSION (objet au sac, non porté) ne suffit jamais. */
function prosthesisCancels(c: Combatant, t: Trauma, aspect: 'movement' | 'all'): boolean {
  if (!t.prosthesis?.length) return false;
  return t.prosthesis.some((p) => {
    const worn = (c.items ?? []).find((i) => i.trappingId === p.trappingId && i.equipped);
    if (!worn) return false;
    if (p.cancels === 'all') return true;
    if (worn.prosthesisTrained) return true; // 200 PX : mouvement + Esquive (Fausse jambe, LDB 73)
    return aspect === 'movement' && !!worn.prosthesisMoveTrained; // 100 PX : mouvement seul
  });
}

/** Palier d'entraînement d'une prothèse, tel que son entrée de catalogue le DÉCLARE (LDB 73). */
export type ProsthesisTier = NonNullable<import('../data').TrappingData['prosthesisTraining']>[number];

/** Un palier est-il DÉJÀ acquis sur cet objet ? `grants` → son drapeau ; `reduces` seul → la tranche
 *  est comptée dans le total racheté (`prosthesisReduced`), `cumul` étant le total attendu jusqu'ici. */
function tierAcquis(it: ItemInstance, tier: ProsthesisTier, cumul: number): boolean {
  if (tier.grants) return tier.grants === 'movement' ? !!it.prosthesisMoveTrained : !!it.prosthesisTrained;
  return (it.prosthesisReduced ?? 0) >= cumul;
}

/** PROCHAIN palier d'entraînement ACHETABLE d'une prothèse portée (LDB 73) : le premier palier DÉCLARÉ
 *  (`TrappingData.prosthesisTraining`, dans l'ordre) qui reste à acquérir — un aspect à lever (`grants`)
 *  ou une tranche de pénalité à racheter (`reduces`, l.19). `undefined` si l'objet n'est pas une prothèse
 *  entraînable, n'est pas porté, ou est déjà entièrement maîtrisé.
 *  SOURCE UNIQUE partagée par l'écran d'Avancement et `trainProsthesis` (state/partyFlow.ts). */
export function nextProsthesisTier(it: ItemInstance): ProsthesisTier | undefined {
  if (!it.equipped || !it.trappingId) return undefined;
  const tiers = findTrappingById(it.trappingId)?.prosthesisTraining ?? [];
  let cumul = 0;
  for (const tier of tiers) {
    cumul += tier.reduces ?? 0;
    if (!tierAcquis(it, tier, cumul)) return tier;
  }
  return undefined;
}

/** Acquiert un palier sur l'objet (mute) — SOURCE UNIQUE de la projection palier → état de l'objet. */
export function grantProsthesisTier(it: ItemInstance, tier: ProsthesisTier): void {
  if (tier.reduces) it.prosthesisReduced = (it.prosthesisReduced ?? 0) + tier.reduces;
  if (tier.grants === 'movement') it.prosthesisMoveTrained = true;
  else if (tier.grants === 'all') it.prosthesisTrained = true;
}

/** Points de pénalité de combat RACHETÉS par les prothèses PORTÉES (LDB 73 l.19 — Crochet : « racheter
 *  la pénalité de -20 à tous les Tests impliquant deux mains pour 100 PX pour chaque tranche de 5 »).
 *  Somme les tranches acquises ; lu par `amputationCombatPenalty`, qui la soustrait de la pénalité de
 *  main perdue. ANGLE MORT ASSUMÉ : la prothèse n'a pas de Localisation propre — deux mains perdues et
 *  un seul crochet réduiraient les DEUX pénalités. */
export function prosthesisPenaltyBuyback(c: Combatant): number {
  return (c.items ?? []).reduce((s, i) => s + (i.equipped ? (i.prosthesisReduced ?? 0) : 0), 0);
}

/** Fausse jambe (ou faux pied) PORTÉE mais PAS entraînée au Mouvement (100 PX) : le port de BASE (gratuit)
 *  « permet d'ignorer 1 Point de Mouvement perdu par la perte de votre membre » (LDB 73 l.23) — restauré
 *  POST-halving par `effectiveMovement`, puisque le ÷2 de la séquelle SURVIT tant que les 100 PX ne sont
 *  pas dépensés (`prosthesisCancels`). +1 par trauma de jambe concerné (une prothèse par membre perdu). */
export function prosthesisMoveRestore(c: Combatant): number {
  let n = 0;
  for (const t of c.traumas ?? []) {
    if (!t.prosthesis?.length || !traumaOps(t).some((o) => o.op === 'moveScale')) continue;
    if (prosthesisCancels(c, t, 'movement')) continue; // ÷2 déjà levé (100/200 PX) : rien à restaurer en plus
    const worn = t.prosthesis.some((p) => (c.items ?? []).find((i) => i.trappingId === p.trappingId && i.equipped));
    if (worn) n += 1;
  }
  return n;
}


/** La séquelle `t` découle-t-elle d'une AMPUTATION/perte de membre-organe (LDB 18 l.239-285) ? Keyée
 *  par `traumaId` STABLE (`TraumaFiche.amputation` en donnée) — jamais par le `label` d'affichage. */
function isAmputationTrauma(t: Trauma): boolean {
  if (t.traumaId == null) return false;
  return ficheById(t.traumaId)?.amputation === true;
}

/** Insensible à la douleur (LDB 85 l.195) : les pénalités de Blessures Critiques NE DÉCOULANT PAS
 *  d'amputations sont ignorées (les États restent subis). Pur — lit le trait sur `c.traits`. */
function painlessIgnores(c: Combatant, t: Trauma): boolean {
  return isPainless(c.traits) && !isAmputationTrauma(t);
}

/** Quels « annulateurs » neutralisent chaque `kind` d'effet passif — TABLE de la fondation unifiée
 *  (LDB 17 Détermination / 85 Insensible / 73 prothèse). Le `kind` (flag de typage) → ses annulateurs. */
const PASSIVE_CANCELLERS: Record<PassiveKind, ('determination' | 'painless' | 'prosthesis-all' | 'prosthesis-move')[]> = {
  douleur: ['determination', 'painless', 'prosthesis-all'],
  mobilite: ['determination', 'painless', 'prosthesis-move'],
  structurel: ['prosthesis-all'],
  sensoriel: [],
  maladie: [], // LDB 17 l.59-61 n'ouvre la Détermination QUE sur Psychologie / modificateurs de Critique / retrait d'UN État — la fenêtre de conscience de LDB 20 l.170 suspend la SOURCE qui porte l'État (`suspendSource`), pas le canal
  faim: [], // annulé par `noHunger` (flag de sort) — géré à la source Faim (P2), pas par une prothèse de séquelle
  magique: [], // sort actif : rien ne l'annule (il expire), mais il se combine en POOL non-cumul (≠ `intrinseque` additif)
  etat: [], // État (LDB 16) : annulé NON PAS ici mais par le flag de combat `ignoreStatePenalties` (au consommateur) ; pool non-cumul
  ivresse: [], // Ivresse (LDB 09) : gaté à la SOURCE par le flag `drunkIgnore` (Détermination, 1 Round) ; pool non-cumul
  intrinseque: [],
};

/** POSEUR UNIQUE de l'annulateur `determination` de la table ci-dessus (`ActiveEffect.ignoreCritMods`,
 *  LDB 17 l.60 : `{scale:'rounds', left:1}`) — toutes ses dépenses passent par ici, il n'existe donc
 *  jamais deux effets concurrents : le `effectId` `determination-crit` est REMPLACÉ à chaque pose.
 *  Le `label` est celui que le JOURNAL doit lire à la dissipation — l'appelant le nomme. */
export const DETERMINATION_CANCELLER_ID = 'determination-crit';
export function poseDeterminationCanceller(c: Combatant, duration: Duration, label: string): void {
  c.activeEffects = [
    ...(c.activeEffects ?? []).filter((e) => e.effectId !== DETERMINATION_CANCELLER_ID),
    { label, effectId: DETERMINATION_CANCELLER_ID, bonus: 0, duration, ignoreCritMods: true },
  ];
}

/** Le `kind` est-il ADDITIF (sommé dans la base : mutation/qualité, corps/équipement permanent) plutôt que
 *  combiné en POOL non-cumul (trauma/maladie/faim/sort) ? Seuls les `charMod`/`skillMod` distinguent les deux.
 *  L'entrée est NORMALISÉE (`normalizePassiveKind`) : une valeur PERSISTÉE à l'ancien id accentué —
 *  arrivée par une porte NON versionnée (export de roster, document réécrit à la main ; une save
 *  obsolète, elle, est refusée à la lecture) — sortirait sinon de la somme additive pour le pool
 *  non-cumul SANS AUCUN SIGNE. Ce filet ferme ce silence-là. */
function isAdditiveKind(kind: PassiveKind | undefined): boolean {
  return (normalizePassiveKind(kind) ?? 'intrinseque') === 'intrinseque';
}

/** `kind` DÉRIVÉ d'une op de séquelle (P0 : par type d'op ; la donnée pourra le surcharger plus tard). */
function traumaOpKind(op: GameOp): PassiveKind {
  if (op.op === 'maxWeaponHands') return 'structurel';
  if (op.op === 'senseLoss') return 'sensoriel';
  if (op.op === 'moveScale') return 'mobilite';
  return 'douleur'; // charMod / skillMod
}

/** Un effet passif SURVIT-il à l'état du combattant (Détermination/Insensible/prothèse), selon son `kind` ?
 *  `t` (la séquelle porteuse) n'est requis que pour les annulateurs liés au porteur (Insensible/prothèse) ;
 *  les sources SANS séquelle (maladie/faim — gating par Détermination seule) l'omettent. */
function modSurvives(c: Combatant, kind: PassiveKind, t?: Trauma): boolean {
  // `?? []` : la table est TOTALE sur l'union courante — un `kind` d'une autre forme (valeur persistée
  // ancienne arrivée par une porte non migrée) ne doit pas faire LEVER le collecteur passif tout entier.
  for (const canc of PASSIVE_CANCELLERS[normalizePassiveKind(kind) ?? kind] ?? []) {
    if (canc === 'determination' && (c.activeEffects ?? []).some((e) => e.ignoreCritMods)) return false;
    if (canc === 'painless' && t && painlessIgnores(c, t)) return false;
    if (canc === 'prosthesis-all' && t && prosthesisCancels(c, t, 'all')) return false;
    if (canc === 'prosthesis-move' && t && prosthesisCancels(c, t, 'movement')) return false;
  }
  return true;
}

/**
 * Collecteur UNIQUE des ops PASSIVES (`charMod`/`skillMod`/`moveScale`/`maxWeaponHands`/`senseLoss`) de TOUTES
 * les sources — POINT DE LECTURE pour effectiveChar/testValue/defenseValue/effectiveMovement/recomputeLoadout
 * (via les helpers ci-dessous), filtré par type d'op. Gating UNIFORME par `kind` (table `PASSIVE_CANCELLERS`) :
 *  - séquelle : `kind` dérivé du type d'op (`traumaOpKind`) ;
 *  - sort (ActiveEffect) : kind `magique` (expire, non annulable) ;
 *  - à terme trait/mutation/objet : poussent leurs `PassiveMod` (kind explicite) au point d'extension.
 * Le charMod de SORT reste lu par effectiveChar (e.char/e.bonus) → non émis ici (pas de double comptage).
 */
/** Multiplie la magnitude d'une op d'État par le nombre de pions (perStack — Exténué −10/pion). Seul
 *  `testMod` (la pénalité par pion) est concerné aujourd'hui ; les autres ops d'État ne sont pas perStack. */
function scaleEtatOp(op: GameOp, mult: number): GameOp {
  if (mult === 1 || op.op !== 'testMod') return op;
  return { ...op, amount: op.amount * mult };
}

/** Ops PASSIVES des SÉQUELLES seules (`c.traumas`), `kind` résolu (surcharge de fiche > `traumaOpKind`) et
 *  gating `modSurvives` appliqué. Source UNIQUE de la branche trauma de `passiveMods` ET de la source trauma
 *  du collecteur de DR `skillDRBonus` (engine/ops), qui lit les autres sources (traits/auras/effets/objets)
 *  et n'a pas de recouvrement avec celle-ci. */
export function traumaPassiveMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  for (const t of c.traumas ?? []) {
    // `label` = LA séquelle porteuse (« Fracture à la jambe ») : elle porte son nom sur le Combattant,
    // donc une composante de jet issue d'elle n'a jamais à se replier sur sa famille. Aucun `src` : les
    // séquelles ne sont pas une catégorie du Codex — le NOM tient, le LIEN n'existe pas.
    // `normalizePassiveKind` : le `kind` PERSISTÉ de la séquelle est ramené à la forme courante AVANT
    // d'être gaté puis propagé (porte NON versionnée : export de roster, document réécrit à la main).
    for (const o of traumaOps(t)) { const kind = normalizePassiveKind(t.passiveKind) ?? traumaOpKind(o); if (modSurvives(c, kind, t)) out.push({ op: o, kind, label: t.label }); }
  }
  return out;
}

/** Le porteur montre-t-il AU MOINS un passif VISIBLE (`PassiveMod.visible`, posé au site d'émission) ?
 *  DÉRIVÉ du collecteur `passiveMods` — jamais un second balayage des maladies/séquelles : toute source
 *  qui se met à émettre du visible entre ici sans une ligne de plus. Lu par la Condition `visiblePassive`
 *  (apparence qui suscite la sympathie, LDB 09 l.97). PUR. */
export function aPassifVisible(c: Combatant): boolean {
  return passiveMods(c).some((m) => m.visible === true);
}

export function passiveMods(c: Combatant): PassiveMod[] {
  const out: PassiveMod[] = [];
  out.push(...traumaPassiveMods(c));
  // Maladies (kind `maladie`, annulée par Détermination ; passifs des symptômes via `diseasePassiveOps`) +
  // Faim (kind `faim`, non annulée : `noHunger` purge l'état à l'entretien, pas ici). Pénalités de
  // Caractéristique → pool non-cumul. Producteurs SANS cycle (disease/provisions n'importent ni trauma ni
  // characteristics). Gating UNIFORME sans `t` ; sauté en bloc si annulé (perf : pas de boucle par clé).
  if (c.diseases?.length && modSurvives(c, 'maladie')) {
    out.push(...diseasePassiveOps(c)); // déjà kind `maladie` + `src` = le symptôme émetteur
  }
  if (c.hunger && modSurvives(c, 'faim')) {
    for (const key of Object.keys(c.characteristics) as CharKey[]) for (const mod of hungerCharPenalties(c, key)) out.push({ op: { op: 'charMod', char: key, mod }, kind: 'faim' });
  }
  if (c.thirst && modSurvives(c, 'faim')) { // Soif (LDB 18 l.340) : même privation (kind `faim` — « Plus besoin de manger/boire »)
    for (const key of Object.keys(c.characteristics) as CharKey[]) for (const mod of thirstCharPenalties(c, key)) out.push({ op: { op: 'charMod', char: key, mod }, kind: 'faim' });
  }
  // Ivresse (LDB 09 l.475) : −10/échec aux CC/CT/Ag/Dex/Int (pool non-cumul, kind `ivresse`). Gaté à la
  // SOURCE par la Détermination : « ignorer les modificateurs négatifs de l'ivresse » (flag `drunkIgnore`).
  if (c.drunk && !hasActiveFlag(c, 'drunkIgnore')) {
    for (const key of Object.keys(c.characteristics) as CharKey[]) for (const mod of drunkCharPenalties(c, key)) out.push({ op: { op: 'charMod', char: key, mod }, kind: 'ivresse' });
  }
  // États (LDB 16) : leur `passive: GameOp[]` (pénalité de Test → `testMod`, bonus à l'attaquant →
  // `incomingAttackMod`, échelle de Mouvement…) émis kind `etat` (pool NON-CUMUL, le pire seul, LDB 16 l.13).
  // La magnitude d'un `testMod` est multipliée par les pions quand l'entrée porte `perStack` (LDB 16 l.11) ;
  // le gate de combat `ignoreStatePenalties` est appliqué au point de LECTURE (combatTestPenalty).
  for (const cond of c.conditions ?? []) {
    const ed = findConditionById(cond.id);
    if (!ed?.passive?.length) continue;
    const mult = ed.perStack ? Math.max(1, cond.value ?? 1) : 1; // Exténué −10/pion (LDB 16 l.90)
    for (const op of ed.passive) out.push({ op: scaleEtatOp(op, mult), kind: 'etat', src: { category: 'etats', id: cond.id } });
  }
  // États PSYCHOLOGIQUES (LDB 21, `psychology.json`) : leur `passive` (Frénésie → `sbBonus +1`) émis dans le
  // MÊME pool `etat` que les États — MÊME folding générique, zéro chemin parallèle. Inerte sans `passive`.
  for (const p of c.psychState ?? [])
    for (const op of findPsychologyById(p.type)?.passive ?? []) out.push({ op, kind: 'etat', src: { category: 'psychologies', id: p.type } });
  // Mutations de Corruption (LDB 19) : modifs PERMANENTES du corps → leur `passive: GameOp[]` (vocab unifié,
  // `mutations.json`) émis tel quel en kind `intrinseque`, COMME les traits. (L'armure naturelle apAll/
  // apLocations est lue à part par recomputeLoadout.) Lu inline (la donnée `c.mutations` est sur le Combatant).
  // `src` = LA mutation émettrice : c'est elle qui NOMME la chip du jet (« −20 Visage inversé ») et
  // ouvre sa fiche — jamais la famille anonyme (`srcLabel`, patron des États).
  // `label` : une mutation MAISON (hors `mutations.json`) n'a pas de fiche — elle se nomme par son
  // libellé propre plutôt que par son id brut (arbitrage hors-catalogue, cf. `passivePartLine`).
  for (const m of c.mutations ?? []) for (const op of m.passive ?? []) out.push({ op, kind: 'intrinseque', src: { category: 'mutations', id: m.id }, label: m.label });
  // Qualités d'objet équipées (LDB 60), producteurs sans cycle (wearPenalty est une feuille) : objet Laid →
  // −Soc aux Tests sociaux (testMod char-qualifié) ; port d'armure → −N% par compétence (skillMod, intrinsèque).
  out.push(...wornSocialMods(c)); // une entrée PAR qualité émettrice (`src` = la qualité : « −10 Laid »)
  out.push(...qualityWearMods(c));
  // Objets PORTÉS (equipped) ou TENUS (arme du loadout actif `c.weapons`) : leur `passive: GameOp[]`
  // (skillMod des Bésicles…) émis kind 'intrinseque' — comme les mutations. Les objets RANGÉS (inside) ne
  // comptent pas (ni equipped ni tenus). Lu par `passiveSkillSum` → `testValue`.
  for (const it of c.items ?? []) {
    const held = !!it.equipped || (c.weapons ?? []).some((w) => w.uid === it.uid);
    if (!held || !it.trappingId) continue;
    for (const op of findTrappingById(it.trappingId)?.passive ?? []) out.push({ op, kind: 'intrinseque', src: { category: 'trappings', id: it.trappingId }, label: it.label });
  }
  // Traits à modificateur de PROFIL appliqués en DIRECT (LDB 85 : Élite/Coriace/Brutal/Rapide… facultatifs,
  // statbloc d'éditeur, traits accordés) — leurs `PassiveMod` (vocab GameOp unifié, `TraitData.passive`) émis
  // TELS QUELS. Les traits INHÉRENTS d'un profil bestiaire FINAL ne sont PAS dans `liveTraits` (déjà cuits dans
  // `characteristics`/`movement`) → zéro double-compte. Les consommateurs (passiveCharSum/passiveMoveMod) somment.
  if (c.liveTraits?.length) out.push(...traitPassiveMods(c.liveTraits));
  // Talents POSSÉDÉS (LDB 10) : leur `passive: GameOp[]` (Coup puissant, Dur à cuire… ou Frénésie →
  // grantFreeAttack) émis kind `intrinseque`, par niveau — comme les traits. Disjoint → zéro double-compte.
  out.push(...talentPassiveMods(c));
  for (const e of c.activeEffects ?? []) {
    // `src`/`label` = L'EFFET émetteur : un `skillMod` de SORT doit s'annoncer au nom de son sort, pas
    // au repli de famille de son seau (`kind:'magique'` tombe côté pool non-cumul, donc « Séquelle » —
    // un sort temporaire s'y annonçait comme une mutilation permanente).
    // Canal UNIQUE des passifs d'effet (#1695, `ActiveEffect.passive`) : toute op qu'un effet porte
    // s'annonce ICI au nom de l'effet, donc suspendable (`sourceSuspended`). Une op `condition` y devient
    // un pion DÉRIVÉ que la réconciliation pose et retire AVEC l'effet (LDB 48 l.495).
    for (const op of e.passive ?? []) out.push({ op, kind: 'magique', src: effectRef(e), label: e.label });
  }
  // SUSPENSION d'une source (`engine/suspension.ts`) : tout ce qu'une source suspendue émet est écarté
  // ICI, au collecteur unique — aucun consommateur n'a à connaître le mécanisme. Les émetteurs SANS
  // `src` (séquelles, Faim, Soif, Ivresse) ne sont pas suspendables : rien ne les nomme.
  // (#1695) Une fenêtre de Détermination NOMME l'État qu'elle écarte (LDB 17 l.61, « Retirez un État ») :
  // le mod interrogé porte son id quand c'est une op `condition`, et lui seul tombe.
  return out.filter((m) => !sourceSuspended(c, m.src, m.op.op === 'condition' ? m.op.id : undefined));
}

/** Ops PASSIVES de type `op` collectées (kind aplati), filtrées par mode de combinaison quand il importe :
 *  `additive===false` → POOL non-cumul (trauma/maladie/sort) ; `additive===true` → Σ (mutation/qualité) ;
 *  absent → toutes (pour les op-types dont la combinaison ne dépend pas du kind : moveScale/maxWeaponHands). */
function pmodsFull(c: Combatant, op: GameOp['op'], additive?: boolean): PassiveMod[] {
  return passiveMods(c).filter((m) => m.op.op === op && (additive == null || isAdditiveKind(m.kind) === additive));
}

/** Idem, réduit aux OPS seules — pour les lectures qui n'ont que faire de la provenance (`src`). */
function pmods<K extends GameOp['op']>(c: Combatant, op: K, additive?: boolean): Extract<GameOp, { op: K }>[] {
  return pmodsFull(c, op, additive).map((m) => m.op as Extract<GameOp, { op: K }>);
}

/** Le Mouvement est-il réduit de moitié (séquelle de jambe ou autre source `moveScale`) ? Lu par `effectiveMovement`. */
export function traumaMovementHalved(c: Combatant): boolean {
  return pmods(c, 'moveScale').length > 0;
}

/** Σ des modificateurs PASSIFS du Bonus de Force employé aux DÉGÂTS (`sbBonus`) — Frénésie : +1 (LDB 21
 *  l.33). Lu par le calcul des dégâts (`combat.ts`) à l'endroit du `sb`, en remplacement du drapeau
 *  `frenzied ? 1 : 0` codé en dur — la donnée vient de `psychology.json` via `passiveMods`. */
export function damageSBBonus(c: Combatant): number {
  return pmods(c, 'sbBonus').reduce((n, o) => n + o.amount, 0);
}

/** Σ des `charMod` ADDITIFS (mutation/qualité, kind `intrinseque`) pour la Caractéristique `key` — sommés
 *  dans la BASE par `effectiveChar` (un corps transformé n'est pas un bonus magique : hors pool non-cumul). */
export function passiveCharSum(c: Combatant, key: CharKey): number {
  return pmods(c, 'charMod', true).filter((o) => o.char === key).reduce((s, o) => s + o.mod, 0);
}

/** Σ de TOUS les `moveMod` (modif ADDITIVE de Mouvement — mutation `intrinseque` + sort `magique`), additifs
 *  par nature quel que soit le kind. Lu par `effectiveMovement` (sommé avant tout demi-Mouvement). */
export function passiveMoveMod(c: Combatant): number {
  return pmods(c, 'moveMod').reduce((s, o) => s + o.mod, 0);
}

/** Σ des `skillMod` ADDITIFS (mutation/qualité/port d'armure, kind `intrinseque`) s'appliquant au Test `skill`
 *  (skillId STABLE) — match EXACT par id. Lu par `testValue` ; distinct du POOL non-cumul des séquelles
 *  (`traumaSkillPenalty`). */
export function passiveSkillParts(c: Combatant, skill?: string): PassiveMod[] {
  if (!skill) return [];
  return pmodsFull(c, 'skillMod', true).filter((m) => (m.op as Extract<GameOp, { op: 'skillMod' }>).skill.id === skill);
}

/** Σ de `passiveSkillParts` — SOURCE UNIQUE (l'affichage et le jet lisent les mêmes composantes). */
export function passiveSkillSum(c: Combatant, skill?: string): number {
  return passiveSkillParts(c, skill).reduce((s, m) => s + (m.op as Extract<GameOp, { op: 'skillMod' }>).mod, 0);
}

/** Σ des modificateurs de TEST char-qualifiés (`testMod{char}`, kind `intrinseque`) pour la Caractéristique
 *  `charKey` — mutation (Visage inversé −20 Soc) + objet équipé (Laid). N'altère PAS la Caractéristique
 *  (≠ charMod, donc hors stats dérivées) : s'ajoute au seul Test. Lu par `testValue`. */
export function passiveTestModParts(c: Combatant, charKey: CharKey): PassiveMod[] {
  return pmodsFull(c, 'testMod', true).filter((m) => (m.op as Extract<GameOp, { op: 'testMod' }>).char === charKey);
}

/** Σ de `passiveTestModParts` — SOURCE UNIQUE (l'affichage et le jet lisent les mêmes composantes). */
export function passiveTestMod(c: Combatant, charKey: CharKey): number {
  return passiveTestModParts(c, charKey).reduce((s, m) => s + (m.op as Extract<GameOp, { op: 'testMod' }>).amount, 0);
}

/** Les `testMod` GLOBAUX (sans `char`) portés par les MALADIES actives (kind `maladie`), UN PAR
 *  symptôme émetteur — pénalité « −N à TOUS les Tests » (Crampes abdominales −20, MSRC 16 l.152). NON
 *  exprimable en `charMod` (qui fausserait les stats DÉRIVÉES — SB/BE/Mouvement/PB max). Additive et
 *  CUMULATIVE avec les États (les maladies ne sont pas dans le pool non-cumul des États, LDB 16 l.13) ;
 *  annulable par Détermination via le gate `maladie` déjà appliqué en amont dans `passiveMods`.
 *  SOURCE UNIQUE de la Σ (`passiveGlobalTestMod`) ET des lignes NOMMÉES du détail de jet
 *  (`combatTestPenaltyParts`, conditions.ts) : le `src` de chaque `PassiveMod` porte le symptôme. */
export function passiveGlobalTestParts(c: Combatant): PassiveMod[] {
  return passiveMods(c)
    .filter((m) => m.kind === 'maladie' && m.op.op === 'testMod' && (m.op as Extract<GameOp, { op: 'testMod' }>).char == null);
}

/** Σ de `passiveGlobalTestParts`. Consommée par `testStatePenalty`/`combatTestPenalty` (conditions.ts),
 *  à côté des `testMod` GLOBAUX des effets actifs (modificateur de Sort). */
export function passiveGlobalTestMod(c: Combatant): number {
  return passiveGlobalTestParts(c).reduce((s, m) => s + (m.op as Extract<GameOp, { op: 'testMod' }>).amount, 0);
}

/**
 * Un `PassiveMod` du collecteur rendu en composante NOMMÉE — CONVERTISSEUR UNIQUE `PassiveMod` →
 * composante, partagé par TOUS les canaux (`skillMod`/`testMod` → `skills.testValueParts` ;
 * `charMod` → `traumaCharPenaltiesLabeled` → modale d'attaque). Deux provenances DISTINCTES, jamais
 * mêlées (arbitrage utilisateur, #1153) :
 *  - le NOM vient de l'ENTITÉ ATTACHÉE, qui le porte toujours (`Combatant.mutations` stocke l'objet
 *    COMPLET, `ItemInstance` et `Trauma` portent leur `label`…) ; le catalogue n'est interrogé
 *    (`refLabel`) que lorsque l'émetteur n'a fourni QUE son id.
 *  - le LIEN Codex vient du CATALOGUE, qui peut ne pas l'avoir (entrée supprimée depuis une vieille
 *    sauvegarde) : `ref` n'est posée que si l'id RÉSOUT, pour ne jamais offrir une chip morte. Elle
 *    est TOUJOURS déclarée (`undefined` sinon) : le producteur affirme avoir cherché le lien, il ne
 *    l'omet pas en silence (cliquet #1078, `rule-refs.test.ts`).
 * `amount` : la magnitude de l'op, que le lecteur connaît (les op-types la nomment différemment —
 * `mod` pour `skillMod`/`charMod`, `amount` pour `testMod`). Libellé VIDE = l'émetteur n'a ni entité
 * ni id : seul l'appelant sait si sa famille a un sens (cf. `CHAR_PENALTY_KIND_LABEL`).
 */
export function passivePartLine(m: PassiveMod, amount: number): { label: string; value: number; famille: ModFamille; ref?: CodexTarget } {
  const ref = m.src && findById(m.src.category, m.src.id) ? m.src : undefined;
  return { label: m.label ?? (m.src ? refLabel(m.src.category, { id: m.src.id }) : ''), value: amount, famille: 'jet', ref };
}

/** Familles SANS entité émettrice — les SEULES à mériter un repli de famille : la Faim/Soif et
 *  l'Ivresse sont des états du CORPS, aucune fiche ne les octroie (≠ séquelle, maladie, État, qui ont
 *  toutes leur entité et donc leur nom propre, `passivePartLine`). */
const CHAR_PENALTY_KIND_LABEL: Partial<Record<PassiveKind, string>> = {
  faim: tr('tra.kindFaim'), ivresse: tr('tra.kindIvresse'),
};

/** Variante ÉTIQUETÉE de `traumaCharPenalties` : mêmes valeurs, NOMMÉES par leur octroyeur via le
 *  convertisseur UNIQUE `passivePartLine` (une séquelle s'appelle « Fracture », pas « Séquelle » — le
 *  canal `charMod` dit désormais la MÊME chose que le canal `skillMod`, #1153). `ref` accompagne le nom
 *  jusqu'à la modale d'attaque (`volatileCharLines`). Source UNIQUE : `traumaCharPenalties` en dérive. */
export function traumaCharPenaltiesLabeled(c: Combatant, key: CharKey): { kind: PassiveKind; label: string; mod: number; ref?: CodexTarget }[] {
  return passiveMods(c)
    .filter((m) => m.op.op === 'charMod' && !isAdditiveKind(m.kind) && m.op.char === key && m.op.mod < 0)
    .map((m) => {
      const kind = m.kind ?? 'intrinseque';
      const mod = (m.op as Extract<GameOp, { op: 'charMod' }>).mod;
      const part = passivePartLine(m, mod);
      return { kind, label: part.label || (CHAR_PENALTY_KIND_LABEL[kind] ?? kind), mod, ref: part.ref };
    });
}

/** Pénalités de Caractéristique PASSIVES non-`intrinseque` (valeurs négatives, pour le pool « pire pénalité ») :
 *  traumatismes (LDB 18), maladies (LDB 20) et faim (LDB 18 l.342), toutes sources confondues via le collecteur.
 *  Le gating (Détermination/Insensible/prothèse selon le `kind`) est déjà appliqué par `passiveMods`. */
export function traumaCharPenalties(c: Combatant, key: CharKey): number[] {
  return traumaCharPenaltiesLabeled(c, key).map((p) => p.mod);
}

/** Pire pénalité de mobilité/Esquive due aux traumatismes de jambe (≤ 0 ; non-cumul, LDB 16 l.13). Une prothèse
 *  qui annule TOUT (Merveille d'ingénierie, LDB 73) lève aussi l'Esquive ; la Fausse jambe SEULE laisse le
 *  −20 subsister tant qu'elle n'est pas ENTRAÎNÉE (200 PX, `ItemInstance.prosthesisTrained` — `trainProsthesis`,
 *  state/partyFlow.ts) : entraînée, `prosthesisCancels` l'élève à `'all'` et lève aussi l'Esquive. */
export function traumaDodgePenalty(c: Combatant): number {
  const pens = pmods(c, 'skillMod', false)
    .filter((o) => o.skill.id === 'esquive' && o.mod < 0)
    .map((o) => o.mod);
  return pens.length ? Math.min(...pens) : 0;
}

/** Un `skillMod` restreint à un `sense` (Surdité : « Tests de Perception basés sur l'ouïe », LDB 18)
 *  s'applique-t-il à un Test qui sollicite `testSense` ? Sans restriction (`opSense` absent, ex. Cécité —
 *  déjà scopée par compétence nommée) → toujours. Restreint mais le sens du Test COURANT est INCONNU
 *  (`testSense` absent — cas d'un appelant qui ne le précise pas) → s'applique par défaut (le sens précis
 *  d'un Test de Perception est une donnée NARRATIVE que seul l'appelant connaît, cf. Talent Sens aiguisé
 *  `manual:true`). Restreint et CONNU mais différent → exempté (surdité, LDB 18 l.277). */
function senseMatches(opSense: PairedSense | undefined, testSense: PairedSense | undefined): boolean {
  return opSense == null || testSense == null || opSense === testSense;
}

/** Pire pénalité permanente à une Compétence nommée due aux traumatismes (séquelle de fracture, LDB 18
 *  l.202/212 — ex. −5/−10 « Langue » après une fracture à la Tête). `testSense` restreint les `skillMod`
 *  qui portent un `sense` (Surdité, LDB 18 : Perception auditive seulement — `senseMatches`) au Test COURANT ;
 *  transmis par `testValue`. Non-cumul (LDB 16 l.13) ; ≤ 0. */
export function traumaSkillPenaltyParts(c: Combatant, skill?: string, testSense?: PairedSense): PassiveMod[] {
  if (!skill) return [];
  // Esquive est porté par traumaDodgePenalty (defenseValue) → EXCLU ici pour préserver la séparation historique.
  const cand = pmodsFull(c, 'skillMod', false).filter((m) => {
    const o = m.op as Extract<GameOp, { op: 'skillMod' }>;
    return o.skill.id !== 'esquive' && o.skill.id === skill && o.mod < 0 && senseMatches(o.sense, testSense);
  });
  // Non-cumul (LDB 16 l.13) : la PIRE seule — comparaison STRICTE, un ex æquo ne détrône pas le tenant
  // (même arbitrage déterministe que `poolWinner`, conditions.ts).
  const worst = cand.reduce<PassiveMod | undefined>((best, m) => (
    best == null || (m.op as Extract<GameOp, { op: 'skillMod' }>).mod < (best.op as Extract<GameOp, { op: 'skillMod' }>).mod ? m : best), undefined);
  return worst ? [worst] : [];
}

/** Σ de `traumaSkillPenaltyParts` (0 ou 1 entrée : pool non-cumul) — SOURCE UNIQUE. */
export function traumaSkillPenalty(c: Combatant, skill?: string, testSense?: PairedSense): number {
  return traumaSkillPenaltyParts(c, skill, testSense).reduce((s, m) => s + (m.op as Extract<GameOp, { op: 'skillMod' }>).mod, 0);
}
