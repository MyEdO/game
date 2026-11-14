/**
 * VALEURS NEUVES DE L'ATELIER (#3059) : l'op neuve d'un type (`newOp`), la formule d'une forme
 * (`formulaForShape`, `shapeOf`), l'effet neuf d'un type (`newEffect`), la valeur neuve d'un nœud de schéma
 * (`valeurNeuveDe`) et celle de chaque variante d'une union (`variantesAChoisir`). Fonctions pures, au noyau parce
 * qu'elles lisent le moteur et le modèle du monde
 * (`terrainsElectifs`, `EFFECT_HANDLERS`) : tout hôte crée la même valeur que l'éditeur web.
 */
import type { Formula, GameOp } from '../engine/ops';
import { VIVRES_DE_CALE } from '../engine/seaNavigation';
import type { JsonFormula } from '../engine/miscast';
import { opPsy } from '../engine/psych/opsPsy';
import { OPTIONAL_RULES } from '../engine/policy';
import { memoParVersion } from '../data';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { OP_DEFS, OPS_NON_TYPEES } from '../data/schemas/grammaire/mecanique';
import { classeDeProduit } from '../data/schemas/grammaire/produits';
import { declarationDEnfants, ouverts } from '../data/schemas/grammaire/descente';
import { declarationDeFeuilleDId } from '../data/schemas/grammaire/ref';
import { CONDITION_TOUJOURS, recast } from '../data/valeursNeuves';
import type { Condition } from '../engine/flowCore';
import { terrainsElectifs } from './monde/terrain';
import { EFFECT_HANDLERS } from './combatEffects';
import {
  admetUneListe,
  bornesDuNoeud,
  champsDeclares,
  choixDuNoeud,
  kindDuNoeud,
  recordDuNoeud,
  unionDuNoeud,
  varianteCourante,
  videDuNoeud,
  type UnionDuNoeud,
  type VarianteDuNoeud,
} from './codex/editFields';


/** Règles optionnelles NUMÉRIQUES (`kind: 'param'`) — seules éligibles au terme `{rule}` d'une Formula
 *  (une règle-interrupteur ou un mode n'a pas de valeur à résoudre). Dérivée du registre, jamais listée. */
export const paramsDeRegle = memoParVersion('reglesOptionnelles', () => OPTIONAL_RULES.filter((r) => r.kind === 'param'));

/** Forme de CHAQUE option de la grammaire (`formulaSchema`, `formulaSinSchema` —
 *  `grammaire/valeurs.ts`). La totalité se vérifie par énumération du schéma
 *  (`GameOpEditor.formule-totale.test.tsx`). */
export type FormulaShape =
  | 'lit' | 'bonus' | 'char' | 'dice' | 'times' | 'rolled' | 'indice' | 'pions' | 'ecartAvantage'
  | 'blessuresInfligees' | 'blessuresMax' | 'tailleDuNavire' | 'valeurCargaison' | 'dr' | 'tire' | 'regle' | 'minimum' | 'tranches' | 'somme' | 'peche';

/** Forme d'une `Formula` objet, par la clé qui la porte. */
export const FORME_DE_CLE: Readonly<Record<string, FormulaShape>> = {
  bonusOf: 'bonus', charOf: 'char', dice: 'dice', times: 'times', rolled: 'rolled', indiceOf: 'indice',
  stacks: 'pions', engagedAdvantageGap: 'ecartAvantage', woundsDealt: 'blessuresInfligees', blessuresMax: 'blessuresMax',
  tailleDuNavire: 'tailleDuNavire', valeurCargaison: 'valeurCargaison', sl: 'dr', tire: 'tire',
  rule: 'regle', minimum: 'minimum', parTranche: 'tranches', sum: 'somme', sinPoints: 'peche',
};

/** Termes CONSTANTS : leur forme est leur valeur, sans champ à saisir. */
const TERME_CONSTANT: Partial<Record<FormulaShape, JsonFormula>> = {
  rolled: { rolled: true }, indice: { indiceOf: true }, pions: { stacks: 'self' }, ecartAvantage: { engagedAdvantageGap: true },
  blessuresInfligees: { woundsDealt: true }, blessuresMax: { blessuresMax: true }, tailleDuNavire: { tailleDuNavire: true },
  valeurCargaison: { valeurCargaison: true }, dr: { sl: true }, peche: { sinPoints: true },
};

export const shapeOf = (f: JsonFormula | undefined): FormulaShape => {
  if (typeof f === 'number' || f == null) return 'lit';
  const forme = Object.keys(f).map((k) => FORME_DE_CLE[k]).find((s) => s !== undefined);
  if (forme === undefined) throw new Error(`shapeOf : terme de Formula hors grammaire (${JSON.stringify(f)})`);
  return forme;
};

export const contientLePeche = (f: JsonFormula): boolean =>
  typeof f === 'object' && ('sinPoints' in f || ('sum' in f && f.sum.some(contientLePeche)));

/** Formule par défaut d'une forme — utilisée au CHANGEMENT de forme. Préserve le littéral courant
 *  quand on bascule vers « Nombre » ; ne touche JAMAIS une formule dont la forme est déjà la bonne. */
export function formulaForShape(s: FormulaShape, current: JsonFormula | undefined): JsonFormula {
  if (current != null && s === shapeOf(current)) return current; // déjà la bonne forme → inchangée (pas de clobber)
  // QUITTER la borne basse rend la formule qu'elle enveloppait — symétrique de l'enveloppement
  // ci-dessous : l'aller-retour Minimum → autre forme ne jette pas la quantité éditée.
  if (current != null && typeof current === 'object' && ('minimum' in current || 'parTranche' in current)) return formulaForShape(s, current.of);
  const constant = TERME_CONSTANT[s];
  if (constant !== undefined) return constant;
  // Le terme de Péché n'entre dans aucune composition de `formulaSinSchema` hors de sa somme de tête :
  // une composition neuve part alors d'un dé.
  const enveloppe: Formula = current == null || contientLePeche(current) ? { dice: { n: 1, sides: 10 } } : current as Formula;
  switch (s) {
    case 'lit': return typeof current === 'number' ? current : 1;
    case 'bonus': return { bonusOf: 'force' };
    case 'char': return { charOf: 'force' };
    case 'dice': return { dice: { n: 1, sides: 10 } };
    case 'times': return { times: { of: { dice: { n: 1, sides: 10 } }, factor: 10 } }; // « 1d10 × 10 » (LDB 71)
    case 'regle': return { rule: paramsDeRegle()[0]?.id ?? '' };
    // La valeur liée DÉFINIE tire la formule courante (« Vous perdez 2d10 membres d'équipage », MDG 15 l.245).
    case 'tire': return { tire: 'valeur', de: enveloppe };
    // Le minimum ENVELOPPE la formule courante (« 1d10 – (Bonus d'Endurance) Rounds (minimum de 1) »,
    // AA 07 l.113) : la quantité éditée n'est pas perdue au changement de forme.
    case 'minimum': return { minimum: 1, of: enveloppe };
    // Les tranches ENVELOPPENT la formule courante (« pour chaque tranche de 5 Blessures subies », LDB 85 l.324).
    case 'tranches': return { parTranche: 5, of: enveloppe };
    // Une SOMME neuve part du terme courant + un second terme à éditer (« 1d10 + … », LDB 16 l.84).
    case 'somme': return { sum: [enveloppe, 0] };
    default: throw new Error(`formulaForShape : forme sans terme (${s})`);
  }
}

/**
 * Terrain d'ÉLECTION proposé par défaut à une op `offTerrainMod` : le PREMIER terrain non franchissable
 * à pied parmi les ÉLECTIFS (`noyau/monde/terrain › terrainsElectifs`), dans l'ordre authoré. Un défaut
 * d'éditeur se DÉRIVE de la donnée — le sens de l'op est « la créature se meut dans un élément que le
 * marcheur ne foule pas » ; l'auteur choisit ensuite dans la MÊME liste que celle du `<select>`.
 */
function terrainDElectionParDefaut(): string {
  const t = terrainsElectifs().find((x) => !x.walkable);
  if (!t) throw new Error('`terrains.json` ne porte aucun terrain électif non franchissable : `offTerrainMod` n’a plus de défaut dérivable.');
  return t.id;
}

/** La valeur `valeur` du nœud `noeud`, chaque référence de catalogue (`idDe`) vidée : une op neuve n'élit aucune entrée
 *  à la place de l'auteur. */
function sansReferenceElue(noeud: unknown, valeur: unknown): unknown {
  if (ouverts([noeud]).some((n) => declarationDeFeuilleDId(n) !== undefined)) return '';
  const champs = champsDeclares(noeud);
  if (!champs || valeur === null || typeof valeur !== 'object') return valeur;
  return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => {
    const n = champs.find(([c]) => c === cle)?.[1];
    return [cle, n === undefined ? v : sansReferenceElue(n, v)];
  }));
}

/** L'op NEUVE `op` : celle de sa fabrique ; une op typée qui n'y est pas, la valeur neuve de son payload (`OP_DEFS`), ses
 *  références vides (`sansReferenceElue`) ; une op de `OPS_NON_TYPEES` qui n'y est pas, son seul nom. Lève pour une op
 *  inconnue des deux registres. */
export function newOp(op: GameOp['op'] | string): GameOp {
  switch (op as GameOp['op']) {
    case 'wounds': return { op: 'wounds', amount: 5 };
    case 'heal': return { op: 'heal', amount: 3 };
    case 'healCaster': return { op: 'healCaster', amount: 1 };
    case 'condition': return { op: 'condition', id: { id: '' }, value: 1 };
    case 'removeCondition': return { op: 'removeCondition' };
    case 'endPsych': return opPsy.fin('');
    case 'beginPsych': return opPsy.pose('');
    case 'sbBonus': return { op: 'sbBonus', amount: 1 };
    case 'incomingSpellDRMod': return { op: 'incomingSpellDRMod', amount: -1 };
    case 'charMod': return { op: 'charMod', characteristic: 'force', mod: -10 };
    case 'ap': return { op: 'ap', amount: 1 };
    case 'testMod': return { op: 'testMod', amount: -10 };
    case 'ignoreStatePenalties': return { op: 'ignoreStatePenalties' };
    case 'freeReroll': return { op: 'freeReroll' };
    case 'critTwice': return { op: 'critTwice' };
    case 'gainResource': return { op: 'gainResource', resource: 'fortune', amount: 1 };
    case 'corruption': return { op: 'corruption', amount: 1 };
    case 'sinMod': return { op: 'sinMod', amount: 1 };
    case 'corruptionExposure': return { op: 'corruptionExposure', level: 'mineure' };
    case 'castPenalty': return { op: 'castPenalty', mod: -10 };
    case 'money': return { op: 'money', montant: { brass: 1 } };
    case 'statusMod': return { op: 'statusMod', amount: 1 };
    case 'grantReverseToken': return { op: 'grantReverseToken' };
    case 'castWard': return { op: 'castWard', radius: 5, mod: 0 };
    case 'arrowWard': return { op: 'arrowWard' };
    // L'Indice naît à 1 : le 6 du Dôme est la valeur RAW de CE sort (`LDB 47 l.410`), pas un défaut de
    // l'op — et le Trait `protection` déclare son Indice sans valeur (`traits.json`, `indice.label`).
    // Aucune zone : elle vient de la ligne « Cible » du sort (ZdE), pas de l'op.
    case 'domeWard': return { op: 'domeWard', trait: { id: '', value: 1 } };
    case 'attackWardFM': return { op: 'attackWardFM' };
    case 'grantWeapon': return { op: 'grantWeapon', label: '', damage: { bonusOf: 'force-mentale' } };
    case 'grantNaturalWeapon': return { op: 'grantNaturalWeapon', label: '', damage: 3 };
    case 'grantFreeAttack': return { op: 'grantFreeAttack', weapon: 'held', when: 'immediate', avantageOuMouvement: true };
    case 'grantTrait': return { op: 'grantTrait', trait: { id: '' } };
    case 'removeTrait': return { op: 'removeTrait', trait: { id: '' } };
    case 'grantPsychTrait': return opPsy.octroi('');
    case 'removePsychTrait': return opPsy.retrait();
    case 'grantTalent': return { op: 'grantTalent', talent: { id: '' } };
    case 'suppressTalents': return { op: 'suppressTalents', talents: [{ id: '' }], durationDays: 1 };
    case 'deitySkillMod': return { op: 'deitySkillMod', pick: 'all', mod: -10, durationHours: 1 };
    case 'deityBan': return { op: 'deityBan', durationDays: 1 };
    case 'prayerForAction': return { op: 'prayerForAction', durationRounds: 1 };
    case 'grantCareerSkill': return { op: 'grantCareerSkill', skill: { id: '' } };
    case 'grantCareerTalent': return { op: 'grantCareerTalent', talent: { id: '' } };
    case 'augmentWeapon': return { op: 'augmentWeapon' };
    case 'cureDisease': return { op: 'cureDisease', count: 1 };
    case 'reduceDiseaseDays': return { op: 'reduceDiseaseDays', days: 1 };
    case 'diseaseTestMod': return { op: 'diseaseTestMod', amount: 10 };
    case 'suppressSymptom': return { op: 'suppressSymptom', symptomId: '' };
    case 'aggravateSymptom': return { op: 'aggravateSymptom', disease: '', symptomId: '', severity: 'grave' };
    case 'attenuateSymptom': return { op: 'attenuateSymptom', disease: '', symptomId: '' };
    case 'grantSymptom': return { op: 'grantSymptom', disease: '', symptomId: '' };
    case 'testDAgir': return { op: 'testDAgir', characteristic: 'force-mentale' };
    case 'delayed': return { op: 'delayed', afterHours: 1, ops: [] };
    case 'preventInfection': return { op: 'preventInfection' };
    case 'aideMedicale': return { op: 'aideMedicale' };
    case 'cureCriticalWound': return { op: 'cureCriticalWound', count: 1 };
    case 'amputer': return { op: 'amputer', sequels: [] };
    case 'suppressPsych': return { op: 'suppressPsych' };
    case 'suffocate': return { op: 'suffocate' };
    case 'noBreath': return { op: 'noBreath' };
    case 'noHunger': return { op: 'noHunger' };
    case 'weatherWard': return { op: 'weatherWard' };
    case 'damageArmour': return { op: 'damageArmour', material: 'cuir' };
    case 'damageWornGear': return { op: 'damageWornGear' };
    case 'reduceToZero': return { op: 'reduceToZero' };
    case 'banish': return { op: 'banish' };
    case 'kill': return { op: 'kill' };
    case 'martyr': return { op: 'martyr' };
    case 'giveTrapping': return { op: 'giveTrapping' };
    case 'perRound': return { op: 'perRound', ops: [] };
    case 'summon': return { op: 'summon', ref: '', count: 1, allyOfCaster: true };
    case 'zone': return { op: 'zone', shape: 'disc', radiusMeters: { bonusOf: 'force-mentale' } };
    case 'push': return { op: 'push', meters: { bonusOf: 'force-mentale' } };
    case 'teleport': return { op: 'teleport', meters: { bonusOf: 'force-mentale' } };
    case 'chain': return { op: 'chain', maxBounces: { bonusOf: 'force-mentale' }, hopMeters: { bonusOf: 'force-mentale' } };
    case 'polymorph': return { op: 'polymorph', ref: '' };
    case 'transform': return { op: 'transform', tag: 'forme', ops: [] };
    case 'endTransform': return { op: 'endTransform', tag: 'forme' };
    case 'lifeSteal': return { op: 'lifeSteal', num: 1, den: 2, round: 'floor' };
    case 'light': return { op: 'light', radiusM: 10 };
    case 'skillMod': return { op: 'skillMod', skill: { id: '' }, mod: -10 };
    case 'skillDRBonus': return { op: 'skillDRBonus', skill: { id: '' }, bonus: 1 };
    case 'charDRBonus': return { op: 'charDRBonus', characteristic: 'sociabilite', bonus: 1 };
    case 'crewTestMod': return { op: 'crewTestMod', mod: 10 };
    // Aucun id EN DUR : la table se choisit, comme une table référencée de `rollTable` (`tableId: ''`).
    case 'fall': return { op: 'fall', hauteur: { table: { id: '' } } };
    case 'moveScale': return { op: 'moveScale', num: 1, den: 2 };
    case 'moveMod': return { op: 'moveMod', mod: -1 };
    // Terrain d'ÉLECTION : le SENS de l'op est « hors de l'élément où l'on se meut », donc le premier
    // terrain NON franchissable à pied du registre — dérivé du dataset, jamais un id récité.
    case 'offTerrainMod': return { op: 'offTerrainMod', terrain: { id: terrainDElectionParDefaut() }, mSet: 1, testDR: -2 };
    case 'attrMod': return { op: 'attrMod', attr: 'fortune', mod: 1 };
    case 'maxWeaponHands': return { op: 'maxWeaponHands', hands: 1 };
    case 'disarm': return { op: 'disarm' };
    case 'handGate': return { op: 'handGate' };
    case 'senseLoss': return { op: 'senseLoss', sense: 'vue' };
    case 'loseTurn': return { op: 'loseTurn' };
    case 'removeShipPoste': return { op: 'removeShipPoste' };
    case 'weaponRollMod': return { op: 'weaponRollMod', phase: 'attaque', drMod: -1 };
    case 'weaponDamageMod': return { op: 'weaponDamageMod', mode: 'maxUnits' };
    case 'armourPierce': return { op: 'armourPierce', amount: 1 };
    case 'critOnRoll': return { op: 'critOnRoll', mod: 10, equals: 0 };
    case 'spendAdvantage': return { op: 'spendAdvantage', amount: 1 };
    case 'rollThreshold': return { op: 'rollThreshold', sides: 10, thresholds: [] };
    case 'rollTable': return { op: 'rollTable', die: 'd10', entries: [] };
    case 'rollMutation': return { op: 'rollMutation', table: { id: '' } };
    case 'narrative': return { op: 'narrative', text: '' };
    case 'shipMorale': return { op: 'shipMorale', delta: { sign: 1, dice: { n: 1, sides: 10 } } };
    case 'manann': return { op: 'manann', delta: { sign: 1, dice: { n: 1, sides: 10 } } };
    case 'shipCritical': return { op: 'shipCritical', location: 'aleatoire', count: 1 };
    case 'navireMod': return { op: 'navireMod', m: -1, jusqua: 'carenage' };
    case 'meteoImposee': return { op: 'meteoImposee', jours: { dice: { n: 1, sides: 10 } }, meteo: { vent: 'calme-plat' } };
    case 'cargaison': return { op: 'cargaison', enc: { dice: { n: 1, sides: 100 } } };
    case 'provisions': return { op: 'provisions', jours: { dice: { n: 1, sides: 10 } }, vivre: { id: VIVRES_DE_CALE.vivres[0] } };
    case 'equipage': return { op: 'equipage', delta: 1 };
    case 'perilDeMer': return { op: 'perilDeMer', collision: { id: '' } };
    case 'navireHostile': return { op: 'navireHostile', navire: { id: '' }, equipage: { id: '', nombre: 1 } };
    case 'commission': return { op: 'commission', montant: { brass: 48000 } };
    case 'constructeurDEscale': return { op: 'constructeurDEscale', competence: 68, duree: { dice: { n: 1, sides: 10 } } };
    case 'rationsDEscale': return { op: 'rationsDEscale', montant: { brass: 3 } };
    case 'infestation': return { op: 'infestation', crewTestType: { id: '' }, difficulty: 'intermediaire', drCible: 10, chaqueNuit: { kind: 'sequence', etapes: [] } };
    default: {
      const payload = OP_DEFS[op];
      if (payload) return sansReferenceElue(payload, valeurNeuveDe(payload)) as GameOp;
      if (OPS_NON_TYPEES.includes(op)) return { op } as GameOp;
      throw new Error(`newOp : op inconnue de OP_DEFS et de OPS_NON_TYPEES (${op})`);
    }
  }
}

/** Effet par défaut d'un type — délégué à la FABRIQUE du registre (`EFFECT_HANDLERS[t].make`). */
export function newEffect(type: Effect['type']): Effect {
  return EFFECT_HANDLERS[type].make();
}

/** La valeur NEUVE du nœud de schéma `noeud` : d'un champ à choix, sa première valeur (`choixDuNoeud`) ; d'un objet,
 *  ses seuls champs dont le nœud n'admet pas le retrait (`videDuNoeud`), chacun à sa valeur neuve ; d'une union, celle
 *  de sa première variante (`neuveDeLaVariante`) ; d'un record, {} ; d'un nombre, 0, ou sa borne basse si elle est au-dessus ; d'un
 *  texte, '' ; d'une liste, [] ; `undefined` pour tout autre nœud, qu'un objet neuf ne porte pas. */
export function valeurNeuveDe(noeud: unknown): unknown {
  const choix = choixDuNoeud(noeud);
  if (choix) return choix[0]?.valeur;
  const champs = champsDeclares(noeud);
  if (champs) return Object.fromEntries(champs.flatMap(([cle, n]) => {
    const neuve = videDuNoeud(n) === undefined ? undefined : valeurNeuveDe(n);
    return neuve === undefined ? [] : [[cle, neuve]];
  }));
  const u = unionDuNoeud(noeud);
  if (u) return u.variantes.length ? neuveDeLaVariante(u, u.variantes[0], undefined) : undefined;
  if (recordDuNoeud(noeud)) return {};
  const bornes = bornesDuNoeud(noeud);
  if (bornes) return bornes.min !== null && bornes.min > 0 ? bornes.min : 0;
  const kind = kindDuNoeud('', noeud);
  if (kind === 'text' || kind === 'textarea') return '';
  return admetUneListe(noeud) ? [] : undefined;
}

/** La valeur NEUVE de la variante `v` de l'union `u`, depuis la valeur `actuelle` : d'une op, celle de sa fabrique
 *  (`newOp`) ; d'une Condition, union dont une variante est le produit de la Condition de sa clé, celle de `recast`,
 *  qui enveloppe l'actuelle sous ET, OU, NON ; de toute autre branche, sa valeur neuve, son discriminant posé, sauf pour
 *  la variante qui ne le porte pas (clé vide) et pour une union sans discriminant. */
function neuveDeLaVariante(u: UnionDuNoeud, v: VarianteDuNoeud, actuelle: unknown): unknown {
  if (declarationDEnfants(u.noeud)) return newOp(v.cle);
  if (u.variantes.some((w) => classeDeProduit(w.noeud)?.role === `condition.${w.cle}`)) return recast((actuelle as Condition | undefined) ?? CONDITION_TOUJOURS, v.cle as Condition['kind']);
  const neuve = valeurNeuveDe(v.noeud);
  return v.cle === '' || u.discriminant === '' ? neuve : { ...(neuve as object), [u.discriminant]: v.cle };
}

/** Une valeur du choix de la variante d'une union : la clé et le libellé de la variante, la valeur qu'elle pose, et si
 *  elle est la courante. */
export interface ValeurDeVariante { cle: string; libelle: string; valeur: unknown; courante: boolean }

/** Les variantes à choisir de l'union du nœud (`unionDuNoeud`), de valeur actuelle `actuelle` : la courante
 *  (`varianteCourante`) posant l'actuelle, toute autre sa valeur neuve (`neuveDeLaVariante`) ; `undefined` hors d'une
 *  union dont chaque variante est nommée. */
export function variantesAChoisir(noeud: unknown, actuelle: unknown): ValeurDeVariante[] | undefined {
  const u = unionDuNoeud(noeud);
  if (!u) return undefined;
  const courante = varianteCourante(u, actuelle);
  return u.variantes.map((v) => ({ cle: v.cle, libelle: v.libelle, valeur: v === courante ? actuelle : neuveDeLaVariante(u, v, actuelle), courante: v === courante }));
}

/** Ce que jouent les gestes de la liste `liste`, d'élément neuf `neuve` : « Ajouter », la liste où il s'ajoute en fin
 *  (`null` sans élément neuf, `valeurNeuveDe` n'en bâtissant aucun) ; pour chaque élément, « Retirer », la liste sans
 *  lui, et « Monter », celle où il passe avant le précédent (`null` pour le premier). */
export function gestesDeLaListe(liste: readonly unknown[], neuve: unknown): { ajouter: unknown[] | null; elements: { retirer: unknown[]; monter: unknown[] | null }[] } {
  return {
    ajouter: neuve === undefined ? null : [...liste, neuve],
    elements: liste.map((e, rang) => ({
      retirer: liste.filter((_, i) => i !== rang),
      monter: rang ? [...liste.slice(0, rang - 1), e, liste[rang - 1], ...liste.slice(rang + 1)] : null,
    })),
  };
}
