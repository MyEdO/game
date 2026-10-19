// Adaptateur `wfrpPont` du prototype #2793 : contrat `poc/godot/pont/CONTRAT.md`.
// `store` évalué avant `combatManeuvers` : sinon `combatEffects.ts:738` est lu avant son initialisation
// (combatManeuvers → triggeredEffects → combatEffects → campaignData → store.ts:1816 → registerCloture).
import '../../../src/state/store';
import { findCreatureById, testSkillLabel } from '../../../src/data';
import { makePregens } from '../../../src/data/pregens';
import { consumeActiveFlag, hasActiveFlag } from '../../../src/engine/activeFlags';
import { gainAdvantage } from '../../../src/engine/advantage';
import { groupAdvantage } from '../../../src/engine/advantagePool';
import { bonus, effectiveChar } from '../../../src/engine/characteristics';
import {
  assertAttackWeapon, attackModifiers, attackTestOf, compteDuCoup, finishMelee, frozenDifficulty, initiativeOrder, issueAuJet,
  rederivePassiveAttack, resolveMelee, type AttackResult, type CompteDuCoup, type RollBreakdown,
} from '../../../src/engine/combat';
import { hasCritRollTwiceTalent } from '../../../src/engine/combatFeatures/dispatch';
import { addCondition, appliquerMortSubite, applyZeroWounds, cannotDefend, COND, hasCondition, isOutOfAction } from '../../../src/engine/conditions';
import { critiqueTriviale, jeuDeCritique, porteurDeCritique, regimeDePorteur, resolveCritique, type CriticalResolved } from '../../../src/engine/critical';
import { makeRNG, type RNG } from '../../../src/engine/dice';
import { effectiveMovement } from '../../../src/engine/encumbrance';
import { applyOps } from '../../../src/engine/ops';
import { isInanimate } from '../../../src/engine/structures';
import { bumpSL, hydrateTR, type TestResult } from '../../../src/engine/tests';
import { consolidateAmputations, reinjuryBleed } from '../../../src/engine/trauma';
import { locationLabel, type Combatant, type HitLocation, type ModLine, type Weapon } from '../../../src/engine/types';
import { effectiveWeaponDamage } from '../../../src/engine/weaponDamage';
import { t } from '../../../src/i18n';
import { previewDefense } from '../../../src/state/combatFlow';
import { bestDefenseMode } from '../../../src/state/combatManeuvers';
import { actorInfluenceView, rerollAvailable } from '../../../src/state/rollFlowFactory';
import { composeRollLabel, rollLine } from '../../../src/state/rollSeam';
import { creatureToCombatant } from '../../../src/state/spawn';
import { difficultyText } from '../../../src/ui/difficultyText';

export const VERSION_DU_PONT = 1;
const LIGNES_DE_JOURNAL = 20;
const ADVERSAIRE = 'brigand';
const NOMBRE_DE_HEROS = 4;
const NOMBRE_D_ADVERSAIRES = 2;

export type NatureDErreur = 'refus' | 'entree' | 'etat' | 'exception';

export type Erreur = {
  nature: NatureDErreur;
  action: { methode: string; entree: unknown };
  message: string;
  pile?: string;
  partiels?: unknown;
};

export type CombattantVu = {
  id: string; libelle: string; camp: 'heros' | 'adversaires';
  blessures: number; blessuresMax: number;
  avantage: number;
  etats: { id: string; valeur: number }[];
  mouvement: number;
  aDeplace: boolean; aAttaque: boolean;
  horsDeCombat: boolean;
};

export type Vue = {
  pont: 1;
  round: number;
  actif: string | null;
  ordre: string[];
  combattants: CombattantVu[];
  journal: string[];
  issue: null | 'victoire' | 'defaite';
};

export type Resultat = {
  touche: boolean;
  jetAttaque: number; cibleAttaque?: number; drAttaque?: number;
  jetDefense?: number; cibleDefense?: number; drDefense?: number;
  drNet: number; localisation?: string; degats?: number; blessuresPerdues?: number; critique: boolean;
  critiques: { libelle: string; localisation: string; mortel: boolean }[];
  mortSubite: boolean;
  journal: string;
};

export type Mod = { libelle: string; valeur: number };
export type LigneAvant = { competence: string; base: number; cible: number; difficulte: string; mods: Mod[] };
type Portrait = { id: string; libelle: string; blessures: number; blessuresMax: number };
export type Apercu = {
  titre: string;
  sousTitre: string;
  attaquant: Portrait;
  cible: Portrait;
  arme: string;
  degats: number;
  localisations: { id: string | null; libelle: string }[];
  localisation: string | null;
  attaque: LigneAvant;
  defense: { competence: string; mods: Mod[] } | null;
};
export type LigneApres = { competence: string; jet: number; cible: number; reussite: boolean; dr: number; mods: Mod[] };
export type Jet = {
  attaque: LigneApres;
  defense: LigneApres | null;
  gagnant: 'attaquant' | 'defenseur';
  drNet: number;
  phrase: string;
  critique: boolean;
  influences: {
    relancer: { possible: boolean; restants: number };
    plusUnDR: { possible: boolean; restants: number };
  };
};

export type Pont = {
  version(): string;
  demarrer(entree?: string): string;
  vue(): string;
  deplacer(entree?: string): string;
  attaquer(entree?: string): string;
  finDeTour(): string;
  simulerAttaque(entree?: string): string;
  apercuAttaque(entree?: string): string;
  lancerAttaque(): string;
  relancerAttaque(): string;
  chancePlusUnDR(): string;
  appliquerAttaque(): string;
  annulerAttaque(): string;
  erreursGlobales(): string;
  sondeExceptionNue(): never;
};

type Partie = {
  combattants: Combatant[];
  ordre: string[];
  tour: number;
  round: number;
  rng: RNG;
  aDeplace: Set<string>;
  aAttaque: Set<string>;
  journal: string[];
};

/** Échec attendu d'une méthode : porte sa nature, l'enveloppe le rend en `{ ok:false }`. */
class EchecDuPont extends Error {
  constructor(readonly nature: Exclude<NatureDErreur, 'exception'>, message: string) {
    super(message);
  }
}

/** Ce qu'une méthode a calculé avant d'échouer, relayé par l'enveloppe en `partiels`. */
type Noter = (partiels: unknown) => void;

/** Les combattants de la rencontre du prototype, neufs : 4 premiers pré-tirés, 2 `brigand`. */
export function combattantsDeLaRencontre(): Combatant[] {
  const heros = makePregens().slice(0, NOMBRE_DE_HEROS);
  const creature = findCreatureById(ADVERSAIRE);
  if (!creature) throw new Error(`créature « ${ADVERSAIRE} » absente du bestiaire`);
  const adversaires = Array.from({ length: NOMBRE_D_ADVERSAIRES }, (_, i) => creatureToCombatant(creature, `${ADVERSAIRE}-${i + 1}`, { x: 0, y: i }));
  return [...heros, ...adversaires];
}

const campDe = (c: Combatant): CombattantVu['camp'] => (c.kind === 'hero' ? 'heros' : 'adversaires');

/** Ce que l'encaissement du coup a fait à la cible. */
export type Encaissement = { blessuresPerdues: number; critiques: CriticalResolved[]; mortSubite: boolean };

/** L'AttackResult projeté dans la forme du contrat, et son encaissement quand il a eu lieu. */
export function resultatDe(res: AttackResult, encaissement?: Encaissement): Resultat {
  const a = res.attackerDetail;
  const d = res.defenderDetail;
  return {
    touche: res.hit,
    jetAttaque: res.attackerRoll,
    ...(a ? { cibleAttaque: a.target, drAttaque: a.sl } : {}),
    ...(d ? { jetDefense: d.roll, cibleDefense: d.target, drDefense: d.sl } : res.defenderRoll != null ? { jetDefense: res.defenderRoll } : {}),
    drNet: res.netSL,
    ...(res.location ? { localisation: res.location } : {}),
    ...(res.damage != null ? { degats: res.damage } : {}),
    ...(encaissement ? { blessuresPerdues: encaissement.blessuresPerdues } : {}),
    critique: res.critical,
    critiques: (encaissement?.critiques ?? []).map((c) => ({ libelle: c.label, localisation: c.location, mortel: c.lethal })),
    mortSubite: encaissement?.mortSubite ?? false,
    journal: res.log,
  };
}

/** combatFlow.ts:178 */
const critiquesTireesDeuxFois = (c: Combatant): boolean => hasActiveFlag(c, 'critRollTwice') || hasCritRollTwiceTalent(c);

/** Une Blessure critique de Personnage appliquée : combatFlow.ts:1756, branche `personnage` (:1792-1869). */
function appliquerLaCritique(cible: Combatant, lieu: HitLocation, overkill: number, twice: boolean, rng: RNG, log: string[]): CriticalResolved {
  const jeu = jeuDeCritique(twice);
  const crit = resolveCritique(jeu, cible, lieu, rng, { overkill, twice });
  if (!(jeu === 'aa' && critiqueTriviale('aa', crit.location, crit.roll))) cible.criticalWounds = (cible.criticalWounds ?? 0) + 1;
  cible.tookCriticalThisFight = true;
  cible.critEntriesSuffered = [...(cible.critEntriesSuffered ?? []), crit.entryId];
  log.push(crit.log);
  if (crit.traumas.length) {
    cible.traumas = [...(cible.traumas ?? []), ...crit.traumas];
    for (const s of crit.traumas) log.push(`  ↳ ${s.label} (${locationLabel(s.location, cible.bodyShape)}).`);
    for (const l of consolidateAmputations(cible)) log.push(`  ↳ ${l}`);
  }
  if (crit.lethal) {
    cible.dead = true; // combatFlow.ts:1654
    return crit;
  }
  for (const l of applyOps(cible, crit.ops, { rng, location: lieu })) log.push(`  ↳ ${l}`);
  if (crit.desc) log.push(`  ↳ ${crit.desc}`);
  return crit;
}

/** Les Blessures du coup, puis sa Mort subite et ses Blessures critiques, toutes subies : combatFlow.ts:2520,
 *  :2471, :2543. */
function encaisserLeCoup(cible: Combatant, coup: CompteDuCoup, twice: boolean, rng: RNG, log: string[]): Encaissement {
  const porteur = porteurDeCritique(cible);
  if (porteur !== 'personnage') throw new Error(`porteur « ${porteur} » de ${cible.label} : seul le Personnage est encaissé par le prototype`);
  const { lieu, compte } = coup;
  const currentBefore = cible.wounds.current;
  cible.wounds.current = Math.max(0, currentBefore - compte.blessures);
  const blessuresPerdues = currentBefore - cible.wounds.current;
  if (!isInanimate(cible)) {
    const reinj = reinjuryBleed(cible, lieu);
    if (reinj > 0) {
      addCondition(cible, COND.hemorragique, reinj);
      log.push(t('cf.reinjuryBleed', { name: cible.label, n: reinj, loc: locationLabel(lieu, cible.bodyShape) }));
    }
  }
  if (compte.mortSubite) appliquerMortSubite(cible, log);
  const critiques: CriticalResolved[] = [];
  for (const entree of compte.critiques) {
    const crit = appliquerLaCritique(cible, lieu, entree.overkill, twice, rng, log);
    critiques.push(crit);
    if (crit.lethal) break; // combatFlow.ts:2483
  }
  if (regimeDePorteur(cible).clore && cible.wounds.current <= 0 && !cible.dead && !hasCondition(cible, COND.inconscient)) applyZeroWounds(cible); // combatFlow.ts:2543
  return { blessuresPerdues, critiques, mortSubite: compte.mortSubite };
}

/** Une attaque de mêlée résolue, pas encore appliquée. */
export type Coup = { arme: Weapon; res: AttackResult };

/** Résout une attaque de mêlée (aucune mutation des combattants) ; `lieu` = Localisation visée. */
export function resoudre(attaquant: Combatant, cible: Combatant, rng: RNG, lieu?: HitLocation): Coup {
  const arme = assertAttackWeapon(attaquant.weapons, true);
  return { arme, res: resolveMelee(attaquant, cible, arme, rng, { defense: bestDefenseMode(cible), ...(lieu ? { location: lieu } : {}) }) };
}

/** Applique un coup résolu comme combatFlow.ts:2721-2879, par les primitives de `src/engine`. Mute
 *  `attaquant` et `cible` ; pousse les lignes de l'encaissement dans `log`. */
export function appliquer(attaquant: Combatant, cible: Combatant, { arme, res }: Coup, rng: RNG, log: string[], noter: Noter = () => {}): Resultat {
  noter(resultatDe(res));
  const twice = critiquesTireesDeuxFois(attaquant);
  const coup = compteDuCoup(res, arme, attaquant, cible, 0);
  if (res.advantageTo === 'attacker') gainAdvantage(attaquant, 1);
  const { compte, lieu, coupCritique } = coup;
  let encaissement: Encaissement | undefined;
  if (res.hit && (compte.blessures || compte.critiques.length || compte.mortSubite || coupCritique)) {
    if (compte.relance) { res.location = lieu; res.localisationRelancee = true; }
    res.woundsLost = compte.blessures;
    encaissement = encaisserLeCoup(cible, coup, twice, rng, log);
  }
  if (res.advantageTo === 'defender') {
    gainAdvantage(cible, 1);
    if (!groupAdvantage()) attaquant.advantage = 0; // combatFlow.ts:2877
  }
  if (res.hit && res.woundsLost && !groupAdvantage()) cible.advantage = 0; // combatFlow.ts:2879
  return resultatDe(res, encaissement);
}

/** useAttackJetProps.tsx:83 */
const INTITULE = 'Attaque';
/** useAttackJetProps.tsx:35 */
const LIEUX: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

const modDe = (m: ModLine): Mod => ({ libelle: m.label, valeur: m.value });
const portraitDe = (c: Combatant): Portrait => ({ id: c.id, libelle: c.label, blessures: c.wounds.current, blessuresMax: c.wounds.max });

/** L'aperçu avant le jet : previewAttack (combatFlow.ts:944) et previewDefense (combatFlow.ts:1025), sans
 *  scène ni géométrie, comme la résolution du pont. */
export function apercuDe(attaquant: Combatant, cible: Combatant, lieu: HitLocation | null): Apercu {
  const arme = assertAttackWeapon(attaquant.weapons, true);
  const test = attackTestOf(attaquant, arme, 'melee');
  const mods = attackModifiers(attaquant, cible, arme, { kind: 'melee', location: lieu, env: [] });
  const ligne = rollLine({ actor: attaquant, difficulty: 'intermediaire', combat: { kind: 'melee', weapon: arme }, surLaCible: mods, plafond: 'difficultes' }); // LDB 13 l.118
  const defense = cannotDefend(cible) || isInanimate(cible) ? null : previewDefense(cible, { vsWeapon: arme, dodgeMods: [] });
  return {
    titre: INTITULE,
    sousTitre: composeRollLabel(attaquant, INTITULE, test),
    attaquant: portraitDe(attaquant),
    cible: portraitDe(cible),
    arme: arme.label,
    degats: effectiveWeaponDamage(arme, bonus(effectiveChar(attaquant, 'force'))),
    localisations: [
      { id: null, libelle: 'Au hasard' },
      ...LIEUX.map((l) => ({ id: l, libelle: `${locationLabel(l, cible.bodyShape)} (−20)` })), // LDB 14 l.73
    ],
    localisation: lieu,
    attaque: {
      competence: testSkillLabel(test),
      base: ligne.base,
      cible: Math.max(0, Math.min(100, ligne.target)),
      difficulte: difficultyText(ligne.difficulty, ligne.difficultyCombined),
      mods: ligne.mods.map(modDe),
    },
    defense: defense && { competence: defense.label, mods: defense.mods.map(modDe) },
  };
}

const ligneApres = (d: RollBreakdown): LigneApres => ({
  competence: d.label, jet: d.roll, cible: d.target, reussite: d.success, dr: d.sl, mods: (d.mods ?? []).map(modDe),
});

function detailDAttaque(res: AttackResult): RollBreakdown {
  if (!res.attackerDetail) throw new Error('attaque résolue sans détail de jet de l’attaquant');
  return res.attackerDetail;
}

/** La fenêtre de la relance : rollFlowFactory.ts:91, l'échec jugé sur le jet propre (rollFlowSpecs.ts:569). */
const relanceOuverte = (attaquant: Combatant, res: AttackResult, relancee: boolean): boolean =>
  rerollAvailable(actorInfluenceView(attaquant), { rolled: true, failed: !detailDAttaque(res).success, rerolled: relancee });

/** Le jet résolu tel que la modale le montre ; la phrase est celle d'issueAuJet. */
export function jetDe(attaquant: Combatant, cible: Combatant, { arme, res }: Coup, relancee: boolean): Jet {
  const restants = attaquant.fortune ?? 0;
  return {
    attaque: ligneApres(detailDAttaque(res)),
    defense: res.defenderDetail ? ligneApres(res.defenderDetail) : null,
    gagnant: res.hit ? 'attaquant' : 'defenseur',
    drNet: res.netSL,
    phrase: issueAuJet(cible, res, arme, attaquant).ligne,
    critique: res.critical,
    influences: {
      relancer: { possible: relanceOuverte(attaquant, res, relancee), restants },
      plusUnDR: { possible: restants > 0, restants }, // rollFlowFactory.ts:446 ; LDB 17 l.24
    },
  };
}

/** Le coup re-dérivé d'un jet d'attaquant modifié, la défense et la Difficulté figées : rollFlowSpecs.ts:72-101,
 *  branche mêlée. */
function rederiver(attaquant: Combatant, cible: Combatant, { arme, res }: Coup, lieu: HitLocation | null, atk: TestResult, rng: RNG): Coup {
  const compo = frozenDifficulty(res.attackerDetail);
  const tirage = { rng, fige: res.critLocation };
  const dd = res.defenderDetail;
  const loc = lieu ?? undefined;
  return {
    arme,
    res: dd
      ? finishMelee(attaquant, cible, arme, atk, hydrateTR(dd), dd.mode ?? bestDefenseMode(cible), tirage, loc, [], [], undefined, res.parryWeapon, false, undefined, compo)
      : rederivePassiveAttack(attaquant, cible, arme, atk, 'melee', tirage, loc, false, compo),
  };
}

function issueDe(combattants: Combatant[]): Vue['issue'] {
  const debout = (camp: CombattantVu['camp']) => combattants.some((c) => campDe(c) === camp && !isOutOfAction(c));
  if (!debout('heros')) return 'defaite';
  if (!debout('adversaires')) return 'victoire';
  return null;
}

function actifDe(p: Partie): Combatant | undefined {
  const id = p.ordre[p.tour];
  return p.combattants.find((c) => c.id === id);
}

function vueDe(p: Partie): Vue {
  const actif = actifDe(p);
  const issue = issueDe(p.combattants);
  return {
    pont: VERSION_DU_PONT,
    round: p.round,
    actif: issue || !actif || isOutOfAction(actif) ? null : actif.id,
    ordre: [...p.ordre],
    combattants: p.combattants.map((c) => ({
      id: c.id,
      libelle: c.label,
      camp: campDe(c),
      blessures: c.wounds.current,
      blessuresMax: c.wounds.max,
      avantage: c.advantage,
      etats: c.conditions.map((e) => ({ id: e.id, valeur: e.value })),
      mouvement: effectiveMovement(c),
      aDeplace: p.aDeplace.has(c.id),
      aAttaque: p.aAttaque.has(c.id),
      horsDeCombat: isOutOfAction(c),
    })),
    journal: p.journal.slice(-LIGNES_DE_JOURNAL),
    issue,
  };
}

function objetDEntree(entree: unknown): Record<string, unknown> {
  if (typeof entree !== 'object' || entree === null || Array.isArray(entree)) throw new EchecDuPont('entree', 'entrée attendue : un objet JSON');
  return entree as Record<string, unknown>;
}

function chaine(e: Record<string, unknown>, cle: string): string {
  const v = e[cle];
  if (typeof v !== 'string' || v === '') throw new EchecDuPont('entree', `« ${cle} » attendu : une chaîne non vide`);
  return v;
}

function entier(e: Record<string, unknown>, cle: string): number {
  const v = e[cle];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) throw new EchecDuPont('entree', `« ${cle} » attendu : un entier positif ou nul`);
  return v;
}

function combattant(p: Partie, id: string): Combatant {
  const c = p.combattants.find((x) => x.id === id);
  if (!c) throw new EchecDuPont('entree', `combattant inconnu : « ${id} »`);
  return c;
}

/** Le combattant qui agit : connu, en état de combattre, dont c'est le tour. */
function agissant(p: Partie, id: string): Combatant {
  const c = combattant(p, id);
  if (isOutOfAction(c)) throw new EchecDuPont('etat', `${c.label} est hors de combat`);
  if (issueDe(p.combattants)) throw new EchecDuPont('etat', 'la rencontre est terminée');
  if (actifDe(p)?.id !== c.id) throw new EchecDuPont('refus', `ce n'est pas le tour de ${c.label}`);
  return c;
}

/** La cible d'une attaque : connue, en état de combattre, du camp adverse. */
function cibleValide(p: Partie, attaquant: Combatant, id: string): Combatant {
  const cible = combattant(p, id);
  if (isOutOfAction(cible)) throw new EchecDuPont('refus', `${cible.label} est hors de combat`);
  if (campDe(cible) === campDe(attaquant)) throw new EchecDuPont('refus', `${cible.label} est du même camp que ${attaquant.label}`);
  return cible;
}

/** L'attaquant et la cible d'une attaque permise : mêmes refus pour `attaquer` et la modale. */
function opposants(p: Partie, idAttaquant: string, idCible: string): { attaquant: Combatant; defenseur: Combatant } {
  const attaquant = agissant(p, idAttaquant);
  const defenseur = cibleValide(p, attaquant, idCible);
  if (p.aAttaque.has(attaquant.id)) throw new EchecDuPont('refus', `${attaquant.label} a déjà attaqué ce tour`);
  return { attaquant, defenseur };
}

/** La Localisation visée lue de l'entrée : absente ou `null` = au hasard. */
function lieuDe(e: Record<string, unknown>): HitLocation | null {
  const v = e.localisation;
  if (v === undefined || v === null) return null;
  const lieu = LIEUX.find((l) => l === v);
  if (!lieu) throw new EchecDuPont('entree', `« localisation » attendue : null ou l'une de ${LIEUX.join(', ')}`);
  return lieu;
}

/** L'attaque de la modale : ouverte par `apercuAttaque`, son coup posé par `lancerAttaque`. */
type AttaqueEnCours = { attaquant: string; cible: string; lieu: HitLocation | null; coup: Coup | null; relancee: boolean };

type Corps = (entree: unknown, noter: Noter) => Record<string, unknown>;

export function creerPont(): Pont {
  let partie: Partie | null = null;
  let enCours: AttaqueEnCours | null = null;
  const erreurs: { message: string; source?: string }[] = [];

  const demarree = (): Partie => {
    if (!partie) throw new EchecDuPont('etat', 'partie non démarrée : appeler demarrer');
    return partie;
  };

  /** L'application commune à `attaquer` et `appliquerAttaque`. */
  const conclure = (p: Partie, attaquant: Combatant, defenseur: Combatant, coup: Coup, noter: Noter) => {
    const lignes: string[] = [];
    const resultat = appliquer(attaquant, defenseur, coup, p.rng, lignes, noter);
    p.aAttaque.add(attaquant.id);
    p.journal.push(resultat.journal, ...lignes);
    if (isOutOfAction(defenseur)) p.journal.push(`${defenseur.label} est hors de combat.`);
    return { vue: vueDe(p), resultat };
  };

  /** L'attaque en cours, ses combattants revalidés. */
  const ouverte = () => {
    const p = demarree();
    const o = enCours;
    if (!o) throw new EchecDuPont('etat', 'aucune attaque en cours : appeler apercuAttaque');
    return { p, o, ...opposants(p, o.attaquant, o.cible) };
  };

  /** L'attaque en cours dont le jet est posé. */
  const lancee = () => {
    const r = ouverte();
    if (!r.o.coup) throw new EchecDuPont('refus', 'le jet n’est pas lancé : appeler lancerAttaque');
    return { ...r, coup: r.o.coup };
  };

  /** L'attaque en cours dont le jet n'est pas posé. */
  const avantLeJet = () => {
    const r = ouverte();
    if (r.o.coup) throw new EchecDuPont('refus', 'le jet est déjà lancé');
    return r;
  };

  /** L'enveloppe unique : décode l'entrée, ne lève jamais, rend une chaîne JSON. */
  const envelopper = (methode: string, corps: Corps) => (json?: string): string => {
    let entree: unknown = json;
    let partiels: unknown;
    try {
      if (json !== undefined) {
        try {
          entree = JSON.parse(json);
        } catch {
          throw new EchecDuPont('entree', 'JSON invalide');
        }
      }
      return JSON.stringify({ ok: true, ...corps(entree, (p) => { partiels = p; }) });
    } catch (e) {
      const erreur: Erreur = e instanceof EchecDuPont
        ? { nature: e.nature, action: { methode, entree }, message: e.message }
        : {
          nature: 'exception',
          action: { methode, entree },
          message: e instanceof Error ? e.message : String(e),
          ...(e instanceof Error && e.stack ? { pile: e.stack } : {}),
          ...(partiels !== undefined ? { partiels } : {}),
        };
      return JSON.stringify({ ok: false, erreur });
    }
  };

  const cible = globalThis as { addEventListener?: (type: string, f: (ev: unknown) => void) => void };
  cible.addEventListener?.('error', (ev) => {
    const e = ev as { message?: string; filename?: string; lineno?: number };
    erreurs.push({ message: e.message ?? String(ev), ...(e.filename ? { source: `${e.filename}:${e.lineno ?? 0}` } : {}) });
  });
  cible.addEventListener?.('unhandledrejection', (ev) => {
    const raison = (ev as { reason?: unknown }).reason;
    erreurs.push({ message: raison instanceof Error ? raison.message : String(raison), source: 'unhandledrejection' });
  });

  return {
    version: envelopper('version', () => ({ pont: VERSION_DU_PONT })),
    demarrer: envelopper('demarrer', (entree) => {
      const graine = entier(objetDEntree(entree), 'graine');
      const rng = makeRNG(graine);
      const combattants = combattantsDeLaRencontre();
      const ordre = initiativeOrder(combattants, rng).map((c) => c.id);
      partie = { combattants, ordre, tour: 0, round: 1, rng, aDeplace: new Set(), aAttaque: new Set(), journal: [] };
      enCours = null;
      return { vue: vueDe(partie) };
    }),
    vue: envelopper('vue', () => ({ vue: vueDe(demarree()) })),
    deplacer: envelopper('deplacer', (entree) => {
      const p = demarree();
      const e = objetDEntree(entree);
      const c = agissant(p, chaine(e, 'id'));
      const cases = entier(e, 'cases');
      if (p.aDeplace.has(c.id)) throw new EchecDuPont('refus', `${c.label} s'est déjà déplacé ce tour`);
      const mouvement = effectiveMovement(c);
      if (cases > mouvement) throw new EchecDuPont('refus', `${c.label} ne peut parcourir que ${mouvement} cases`);
      p.aDeplace.add(c.id);
      p.journal.push(`${c.label} se déplace de ${cases} cases.`);
      return { vue: vueDe(p) };
    }),
    attaquer: envelopper('attaquer', (entree, noter) => {
      const p = demarree();
      const e = objetDEntree(entree);
      const { attaquant, defenseur } = opposants(p, chaine(e, 'attaquant'), chaine(e, 'cible'));
      return conclure(p, attaquant, defenseur, resoudre(attaquant, defenseur, p.rng), noter);
    }),
    finDeTour: envelopper('finDeTour', () => {
      const p = demarree();
      if (issueDe(p.combattants)) throw new EchecDuPont('etat', 'la rencontre est terminée');
      enCours = null;
      for (let pas = 1; pas <= p.ordre.length; pas++) {
        const suivant = (p.tour + pas) % p.ordre.length;
        if (suivant === 0) p.round += 1;
        const c = combattant(p, p.ordre[suivant]);
        if (isOutOfAction(c)) continue;
        p.tour = suivant;
        p.aDeplace.delete(c.id);
        p.aAttaque.delete(c.id);
        return { vue: vueDe(p) };
      }
      throw new Error('finDeTour : aucun combattant en état de combattre sans issue de rencontre');
    }),
    simulerAttaque: envelopper('simulerAttaque', (entree, noter) => {
      const p = demarree();
      const e = objetDEntree(entree);
      const attaquant = combattant(p, chaine(e, 'attaquant'));
      const defenseur = combattant(p, chaine(e, 'cible'));
      const graine = entier(e, 'graine');
      const a = structuredClone(attaquant);
      const c = structuredClone(defenseur);
      const rng = makeRNG(graine);
      const resultat = appliquer(a, c, resoudre(a, c, rng), rng, [], noter);
      return { resultat };
    }),
    apercuAttaque: envelopper('apercuAttaque', (entree) => {
      const p = demarree();
      const e = objetDEntree(entree);
      const { attaquant, defenseur } = opposants(p, chaine(e, 'attaquant'), chaine(e, 'cible'));
      if (attaquant.kind !== 'hero') throw new EchecDuPont('refus', `${attaquant.label} n'est pas un héros`);
      const lieu = lieuDe(e);
      if (enCours?.coup && enCours.attaquant === attaquant.id) throw new EchecDuPont('refus', 'le jet est déjà lancé');
      enCours = { attaquant: attaquant.id, cible: defenseur.id, lieu, coup: null, relancee: false };
      return { apercu: apercuDe(attaquant, defenseur, lieu) };
    }),
    lancerAttaque: envelopper('lancerAttaque', () => {
      const { p, o, attaquant, defenseur } = avantLeJet();
      o.coup = resoudre(attaquant, defenseur, p.rng, o.lieu ?? undefined);
      return { jet: jetDe(attaquant, defenseur, o.coup, o.relancee) };
    }),
    relancerAttaque: envelopper('relancerAttaque', () => {
      const { p, o, attaquant, defenseur, coup } = lancee();
      if (!relanceOuverte(attaquant, coup.res, o.relancee)) {
        throw new EchecDuPont('refus', o.relancee ? 'le jet a déjà été relancé' : coup.res.attackerDetail?.success ? 'le jet de l’attaquant est réussi' : `${attaquant.label} n'a plus de Point de Chance`); // LDB 12 l.40 ; LDB 17 l.23
      }
      // rollFlowFactory.ts:427-438 ; rollFlowSpecs.ts:561
      o.coup = resoudre(attaquant, defenseur, p.rng, o.lieu ?? undefined);
      if (hasActiveFlag(attaquant, 'freeReroll')) {
        const source = consumeActiveFlag(attaquant, 'freeReroll');
        p.journal.push(t('roll.freeReroll', { name: attaquant.label, src: source ?? t('roll.blessingFallback') }));
      } else {
        attaquant.fortune = (attaquant.fortune ?? 0) - 1;
      }
      o.relancee = true;
      return { jet: jetDe(attaquant, defenseur, o.coup, o.relancee) };
    }),
    chancePlusUnDR: envelopper('chancePlusUnDR', () => {
      const { p, o, attaquant, defenseur, coup } = lancee();
      if ((attaquant.fortune ?? 0) <= 0) throw new EchecDuPont('refus', `${attaquant.label} n'a plus de Point de Chance`); // LDB 17 l.24
      // rollFlowFactory.ts:446-450 ; rollFlowSpecs.ts:572-577
      o.coup = rederiver(attaquant, defenseur, coup, o.lieu, bumpSL(hydrateTR(detailDAttaque(coup.res))), p.rng);
      attaquant.fortune = (attaquant.fortune ?? 0) - 1;
      return { jet: jetDe(attaquant, defenseur, o.coup, o.relancee) };
    }),
    appliquerAttaque: envelopper('appliquerAttaque', (_entree, noter) => {
      const { p, attaquant, defenseur, coup } = lancee();
      enCours = null;
      return conclure(p, attaquant, defenseur, coup, noter);
    }),
    annulerAttaque: envelopper('annulerAttaque', () => {
      const { p } = avantLeJet();
      enCours = null;
      return { vue: vueDe(p) };
    }),
    erreursGlobales: envelopper('erreursGlobales', () => ({ erreurs: erreurs.splice(0) })),
    sondeExceptionNue: () => {
      throw new Error('sonde-exception-nue');
    },
  };
}
