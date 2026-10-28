/**
 * ÉDITEUR D'OPS MÉCANIQUES — `GameOp[]` (engine/ops), le vocabulaire PARTAGÉ par les sorts (effets
 * dans le Compendium), les pièges (EffectOp de scène) et les contrecoups. COMPLET : il LIT, MODIFIE et
 * AJOUTE n'importe quelle op du vocabulaire — éditeurs DÉDIÉS pour les ops courantes, repli JSON
 * (`JsonField`) pour tout le reste (round-trip SANS PERTE, champs inconnus préservés).
 *
 * Les quantités à `Formula` (littéral / Bonus de Carac / Valeur de Carac / Dés) passent par
 * `FormulaField` — JAMAIS de coercition en nombre (la régression historique : un `wounds {dice}` lu
 * « 0 » puis écrasé). Un nouveau type d'op = 1 entrée dans `OP_GROUPS` + 1 défaut dans `newOp`.
 */
import { createContext, useContext, useMemo } from 'react';
import { useId } from 'react';
import { ProseField } from '../ProseField';
import { ProvenanceDuTexte } from './ProvenanceDuTexte';
import { tableTotale } from '../../lib/tableTotale';
import { Formula, GameOp, type PerSL, type ResolveWindow } from '../../engine/ops';
import type { JsonFormula } from '../../engine/miscast';
import { defDe, enfantsDe } from '../../data/schemas/grammaire/descente';
import { noeudObjet, payloadDeFamille } from '../../data/schemas/validate';
import { ChaosAlign, ExposureLevel } from '../../engine/corruption';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { chaosAlignSchema, deDeTableSchema, exposureLevelSchema } from '../../data/schemas/grammaire/valeurs';
import { CHAR_LABELS, CharKey, ArmourBypass, type ConditionUnlock } from '../../engine/types';
import { SUJETS_DE_VERROU, CHAMPS_EXCLUS_DE_CARRIED, armourBypassCategorieSchema, gameOpSchema, tablesDeCiblesSchema } from '../../data/schemas/grammaire/mecanique';
import { ConditionEditor } from './ConditionEditor';
import { OP_LABEL, opsMissingRefs } from './refsDOp';
import { opSummary } from './interne/resumeDOp';
import type { Condition } from '../../engine/flowCore';
import { SizeCategory, SIZE_LABEL } from '../../engine/size';
import { etats, effectTables, mutationTables, lightTones, memoParVersion, type TrappingData } from '../../data';
import { fallTables } from '../../data/shipCriticals';
import { terrainsElectifs } from '../../noyau/monde/terrain';
import { RefField } from '../compendium/refField/RefField';
import { ObjetDonneField } from './ObjetDonneField';
import { SaisieEnBrouillon } from '../compendium/refField/SaisieEnBrouillon';
import { formatTrait } from '../../engine/traits/dispatch';
import { relireTraits } from './refFormatLivre';
import type { TraitOctroye, TraitPose } from '../../data/schemas/grammaire/reference';
import { ACTE_DE_DEVERROUILLAGE } from '../../engine/conditions';
import { AddMenu, TypeMenu, pickable, type TypeMenuGroup } from './AddMenu';
import { JsonField } from './JsonField';
import { Icon } from '../Icon';
import { NumberField } from '../NumberField';
import { useClesDeRangees } from '../useClesDeRangees';
import type { IconIdInput } from '../icons';
import { NATURES_D_INFLUENCE, TERMES_DE_JET, admetLePeche, estSansTirage, formuleSansTirageSchema, type NatureDInfluence } from '../../data/schemas/grammaire/valeurs';
import { libelleDeLaNature } from './interne/libelleDeLaNature';
import { OPTIONAL_RULES } from '../../engine/policy';

const SIZES = Object.keys(SIZE_LABEL) as SizeCategory[];

const CHARS = Object.keys(CHAR_LABELS) as CharKey[];

/** Actes de soin qui LÈVENT un verrou d'État (`ConditionUnlock`, LDB 18) — libellés du moteur
 *  (`ACTE_DE_DEVERROUILLAGE`), partagés avec le refus d'un remède sur un État verrouillé. */
const UNLOCK_LABELS = Object.entries(ACTE_DE_DEVERROUILLAGE) as [ConditionUnlock, string][];

// ---------------------------------------------------------------------------
// Vocabulaire COMPLET — libellé + menu groupé par intention
// ---------------------------------------------------------------------------

/** Icône de CHAQUE op (rendue à côté du libellé partout SAUF dans le `<select>`/`<optgroup>` natif,
 *  qui ne peut afficher que du texte) — vocabulaire LARGE : plusieurs ops apparentées partagent
 *  la même icône (cf. defs/mechanic.ts, « pas une métaphore par op individuelle »). */
const OP_ICON: Record<GameOp['op'], IconIdInput> = {
  wounds: 'journal/damage', heal: 'journal/heal', healCaster: 'journal/heal', fall: 'journal/fall',
  condition: 'magic/area', removeCondition: 'magic/gust',
  charMod: 'mechanic/stat-mod', ap: 'mechanic/ward', testMod: 'mechanic/stat-mod',
  skillDRBonus: 'mechanic/stat-mod', charDRBonus: 'mechanic/stat-mod', offTerrainMod: 'mechanic/stat-mod',
  crewTestMod: 'travel/anchor', incomingAttackMod: 'mechanic/ward', incomingAdvantage: 'flag/focus',
  incomingSpellDRMod: 'mechanic/ward',
  sbBonus: 'char/f', endPsych: 'mechanic/mind', beginPsych: 'mechanic/mind', exposeDisease: 'medical/infection', contractDisease: 'medical/infection',
  kill: 'journal/damage',
  removeShipPoste: 'travel/anchor', teamCommander: 'action/lead', attackKeyword: 'item/weapon',
  mitigateIncoming: 'mechanic/ward', ignoreStatePenalties: 'ui/done', freeReroll: 'resource/fortune',
  critTwice: 'journal/critical', gainResource: 'resource/fortune', gainAdvantage: 'flag/focus', topUpAdvantage: 'flag/focus',
  attrMod: 'resource/fortune', corruption: 'nav/mutation', sinMod: 'ui/balance', corruptionExposure: 'nav/mutation',
  castPenalty: 'mechanic/ward', money: 'resource/gold-purse', statusMod: 'ui/balance', grantReverseToken: 'resource/fortune', castWard: 'mechanic/ward', arrowWard: 'mechanic/ward', domeWard: 'mechanic/ward',
  attackWardFM: 'mechanic/ward', grantWeapon: 'mechanic/invoke', grantNaturalWeapon: 'mechanic/invoke',
  grantFreeAttack: 'action/free-attack', interruptFocus: 'mechanic/mind', breakBlade: 'item/weapon',
  push: 'mechanic/chain', teleport: 'mechanic/chain', chain: 'mechanic/chain',
  grantTrait: 'mechanic/invoke', removeTrait: 'magic/gust', grantPsychTrait: 'mechanic/mind', removePsychTrait: 'mechanic/mind',
  grantTalent: 'mechanic/invoke', grantCareerSkill: 'mechanic/invoke', grantCareerTalent: 'mechanic/invoke',
  augmentWeapon: 'item/weapon', cureDisease: 'medical/infection', reduceDiseaseDays: 'medical/infection',
  preventInfection: 'medical/infection', cureCriticalWound: 'medical/crutch', amputer: 'medical/crutch', diseaseTestMod: 'medical/infection',
  suppressSymptom: 'medical/infection', aggravateSymptom: 'medical/infection', attenuateSymptom: 'medical/infection', grantSymptom: 'medical/infection',
  actGate: 'ui/wait', delayed: 'ui/wait', suppressPsych: 'mechanic/mind',
  suffocate: 'mechanic/ward', noBreath: 'mechanic/ward', noHunger: 'mechanic/ward', ignoreAnimosity: 'mechanic/ward', weatherWard: 'mechanic/ward',
  damageArmour: 'item/armour', reduceToZero: 'journal/damage', banish: 'magic/area', martyr: 'action/defend',
  giveTrapping: 'item/misc', perRound: 'ui/wait', summon: 'mechanic/invoke', scheduleRespawn: 'ui/wait',
  zone: 'scenario/trap', polymorph: 'mechanic/invoke', transform: 'mechanic/invoke', endTransform: 'ui/wait',
  lifeSteal: 'condition/bleeding', light: 'fire/flame', skillMod: 'mechanic/stat-mod',
  moveScale: 'resource/movement', moveMod: 'resource/movement', maxWeaponHands: 'item/weapon', disarm: 'item/weapon', handGate: 'condition/bleeding',
  senseLoss: 'ui/eye', loseTurn: 'ui/wait', weaponRollMod: 'item/weapon', weaponDamageMod: 'item/weapon',
  armourPierce: 'item/weapon', critOnRoll: 'journal/critical', spendAdvantage: 'flag/focus', rollThreshold: 'nav/dice',
  rollTable: 'nav/dice', rollMutation: 'nav/mutation', charDamage: 'mechanic/stat-mod',
  intoxicate: 'item/consumable', narrative: 'journal/detail',
};

/** TOUTES les op du vocabulaire, groupées par intention d'auteur. Libellé de groupe = texte SEUL
 *  (titre de rubrique du menu). */
const OP_GROUPS: [string, GameOp['op'][]][] = [
  ['Dégâts & soin', ['wounds', 'heal', 'healCaster', 'fall', 'lifeSteal', 'reduceToZero', 'banish', 'kill']],
  ['États', ['condition', 'removeCondition']],
  ['Buffs & caractéristiques', ['charMod', 'ap', 'testMod', 'skillDRBonus', 'charDRBonus', 'crewTestMod', 'ignoreStatePenalties', 'freeReroll', 'critTwice']],
  ['Ressources', ['gainResource', 'corruption', 'sinMod', 'corruptionExposure']],
  ['Incantation & contrecoup', ['castPenalty', 'castWard', 'arrowWard', 'domeWard', 'attackWardFM']],
  ['Invocation & armes', ['summon', 'polymorph', 'transform', 'endTransform', 'grantWeapon', 'grantNaturalWeapon', 'grantFreeAttack', 'grantTrait', 'removeTrait', 'grantPsychTrait', 'removePsychTrait', 'beginPsych', 'grantTalent', 'augmentWeapon']],
  ['Zones', ['zone']],
  ['Projection & téléportation', ['push', 'teleport', 'chain']],
  ['Soin avancé', ['cureDisease', 'reduceDiseaseDays', 'preventInfection', 'cureCriticalWound', 'diseaseTestMod', 'suppressSymptom', 'aggravateSymptom', 'attenuateSymptom', 'grantSymptom']],
  ['Divers', ['suppressPsych', 'suffocate', 'noBreath', 'noHunger', 'weatherWard', 'damageArmour', 'martyr', 'giveTrapping', 'perRound', 'delayed', 'loseTurn', 'actGate', 'removeShipPoste', 'light']],
  ['Séquelles & mobilité', ['amputer', 'skillMod', 'moveScale', 'moveMod', 'offTerrainMod', 'maxWeaponHands', 'disarm', 'handGate', 'senseLoss']],
  ['Atouts/Défauts d’arme (passifs)', ['weaponRollMod', 'weaponDamageMod', 'armourPierce', 'critOnRoll']],
  ['Contrôle', ['rollThreshold', 'rollTable', 'rollMutation', 'spendAdvantage']],
  ['Création de personnage (Talents)', ['attrMod', 'grantCareerSkill', 'grantCareerTalent']],
  ['Narration', ['narrative']],
];

/** VOCABULAIRE UNIQUE des ops à l'atelier : la rangée de menu (icône + libellé) écrite UNE fois,
 *  partagée par « + Op mécanique » et le changement de type d'une op existante. */
const OP_MENU_GROUPS: TypeMenuGroup[] = OP_GROUPS.map(([g, keys]) => ({
  title: g,
  items: keys.map((k) => ({ key: k, label: <><Icon id={OP_ICON[k]} size="sm" /> {OP_LABEL[k]}</> })),
}));

// ---------------------------------------------------------------------------
// Formules
// ---------------------------------------------------------------------------

/** Règles optionnelles NUMÉRIQUES (`kind: 'param'`) — seules éligibles au terme `{rule}` d'une Formula
 *  (une règle-interrupteur ou un mode n'a pas de valeur à résoudre). Dérivée du registre, jamais listée. */
const paramsDeRegle = memoParVersion('reglesOptionnelles', () => OPTIONAL_RULES.filter((r) => r.kind === 'param'));

/** Forme de CHAQUE option de la grammaire (`formulaSchema`, `formulaSinSchema` —
 *  `grammaire/valeurs.ts`). La totalité se vérifie par énumération du schéma
 *  (`GameOpEditor.formule-totale.test.tsx`). */
export type FormulaShape =
  | 'lit' | 'bonus' | 'char' | 'dice' | 'times' | 'rolled' | 'indice' | 'pions' | 'ecartAvantage'
  | 'blessuresInfligees' | 'dr' | 'regle' | 'minimum' | 'somme' | 'peche';

/** Libellé de chaque forme au sélecteur, dans l'ordre du sélecteur. Termes de contexte : `engine/ops.ts`
 *  (`Formula`) ; Péché : `LDB 40 l.58`. */
export const LIBELLE_DE_FORME: Record<FormulaShape, string> = {
  lit: 'Nombre',
  bonus: 'Bonus de carac.',
  char: 'Valeur de carac.',
  dice: 'Dés',
  times: 'Dés × facteur',
  rolled: 'Dé du jet (paliers)',
  indice: 'Indice de l’attaque naturelle',
  pions: 'Pions de l’État déclencheur',
  ecartAvantage: 'Écart d’Avantage (adversaires engagés)',
  blessuresInfligees: 'Blessures infligées (attaque courante)',
  dr: 'DR du Test',
  regle: 'Règle optionnelle',
  minimum: 'Minimum',
  somme: 'Somme de termes',
  peche: 'Points de Péché',
};

/** Forme d'une `Formula` objet, par la clé qui la porte. */
const FORME_DE_CLE: Readonly<Record<string, FormulaShape>> = {
  bonusOf: 'bonus', charOf: 'char', dice: 'dice', times: 'times', rolled: 'rolled', indiceOf: 'indice',
  stacks: 'pions', engagedAdvantageGap: 'ecartAvantage', woundsDealt: 'blessuresInfligees', sl: 'dr',
  rule: 'regle', minimum: 'minimum', sum: 'somme', sinPoints: 'peche',
};

/** Termes CONSTANTS : leur forme est leur valeur, sans champ à saisir. */
const TERME_CONSTANT: Partial<Record<FormulaShape, JsonFormula>> = {
  rolled: { rolled: true }, indice: { indiceOf: true }, pions: { stacks: 'self' }, ecartAvantage: { engagedAdvantageGap: true },
  blessuresInfligees: { woundsDealt: true }, dr: { sl: true }, peche: { sinPoints: true },
};

/** DIALECTE d'une position de `Formula` : `general` = `formulaSchema` ; `peche` = `formulaSinSchema` ;
 *  `termeDePeche` = terme de la somme de `formulaSinSchema` (formule générale ou Péché) ;
 *  `sansTirage` = `formuleSansTirageSchema`, sans terme de jet. */
export type DialecteDeFormule = 'general' | 'peche' | 'termeDePeche' | 'sansTirage';
/** Dialectes fermés au Péché : leur `FormulaField` n'émet qu'une `Formula` du moteur. */
type DialecteSansPeche = Exclude<DialecteDeFormule, 'peche' | 'termeDePeche'>;

const admetLeTermeDePeche = (d: DialecteDeFormule): boolean => d === 'peche' || d === 'termeDePeche';

/** Formes des termes de jet (`TERMES_DE_JET`), absentes du dialecte `sansTirage`. */
const FORMES_DE_JET: ReadonlySet<FormulaShape> = new Set(TERMES_DE_JET.map((cle) => FORME_DE_CLE[cle]));

/** Dialecte que porte le schéma d'un champ (`estSansTirage`, `admetLePeche`). */
const dialecteDuNoeud = (noeud: unknown): DialecteDeFormule => (estSansTirage(noeud) ? 'sansTirage' : admetLePeche(noeud) ? 'peche' : 'general');

/** Dialecte d'un terme de `sum` : la somme de tête de `formulaSinSchema` admet le Péché. */
const dialecteDesTermes = (d: DialecteDeFormule): DialecteDeFormule => (d === 'sansTirage' ? 'sansTirage' : d === 'peche' ? 'termeDePeche' : 'general');

/** Dialecte d'une sous-formule de `times` ou `minimum`, qu'aucun dialecte n'ouvre au Péché. */
const dialecteDesFacteurs = (d: DialecteDeFormule): DialecteSansPeche => (d === 'sansTirage' ? 'sansTirage' : 'general');

/** Nœud du champ `chemin` (`trait.value`) sous le nœud d'op, à travers ses enveloppes. */
function noeudDuChamp(noeud: unknown, chemin: string): unknown {
  return chemin.split('.').reduce<unknown>((n, cle) => enfantDeCle(n, cle), noeud);
}
function enfantDeCle(noeud: unknown, cle: string): unknown {
  const enfants = enfantsDe(noeud);
  const direct = enfants.find((e) => e.cle === cle);
  if (direct) return direct.noeud;
  for (const e of enfants) {
    if (e.segment !== '') continue;
    const trouve = enfantDeCle(e.noeud, cle);
    if (trouve !== undefined) return trouve;
  }
  return undefined;
}

const ObjetsDOpContext = createContext<readonly TrappingData[]>([]);

/** NŒUD de l'op éditée : la VARIANTE de la liste d'ops (`GameOpEditor.noeud`) dont le champ `op`
 *  accepte cette op. Chaque `FormulaField` d'op y lit le nœud de SON champ (`champ`). */
const NoeudDOpContext = createContext<unknown>(undefined);

const accepteLOp = (noeud: unknown, op: string): boolean => {
  const def = defDe(noeud);
  if (def?.type === 'literal') return Array.isArray(def.values) && def.values.includes(op);
  return def?.type === 'string';
};

const varianteDOp = (noeudListe: unknown, op: string): unknown =>
  payloadDeFamille(noeudListe, op) ?? noeudObjet(noeudListe, (n) => accepteLOp(enfantsDe(n).find((e) => e.cle === 'op')?.noeud, op));

/** Une `Formula` sans terme de Péché est une `Formula` du moteur. */
const estFormuleGenerale = (f: JsonFormula): f is Formula => !contientLePeche(f);

export const shapeOf = (f: JsonFormula | undefined): FormulaShape => {
  if (typeof f === 'number' || f == null) return 'lit';
  const forme = Object.keys(f).map((k) => FORME_DE_CLE[k]).find((s) => s !== undefined);
  if (forme === undefined) throw new Error(`shapeOf : terme de Formula hors grammaire (${JSON.stringify(f)})`);
  return forme;
};

const contientLePeche = (f: JsonFormula): boolean =>
  typeof f === 'object' && ('sinPoints' in f || ('sum' in f && f.sum.some(contientLePeche)));

/** Formule par défaut d'une forme — utilisée au CHANGEMENT de forme. Préserve le littéral courant
 *  quand on bascule vers « Nombre » ; ne touche JAMAIS une formule dont la forme est déjà la bonne. */
export function formulaForShape(s: FormulaShape, current: JsonFormula | undefined): JsonFormula {
  if (current != null && s === shapeOf(current)) return current; // déjà la bonne forme → inchangée (pas de clobber)
  // QUITTER la borne basse rend la formule qu'elle enveloppait — symétrique de l'enveloppement
  // ci-dessous : l'aller-retour Minimum → autre forme ne jette pas la quantité éditée.
  if (current != null && typeof current === 'object' && 'minimum' in current) return formulaForShape(s, current.of);
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
    // Le minimum ENVELOPPE la formule courante (« 1d10 – (Bonus d'Endurance) Rounds (minimum de 1) »,
    // AA 07 l.113) : la quantité éditée n'est pas perdue au changement de forme.
    case 'minimum': return { minimum: 1, of: enveloppe };
    // Une SOMME neuve part du terme courant + un second terme à éditer (« 1d10 + … », LDB 16 l.84).
    case 'somme': return { sum: [enveloppe, 0] };
    default: throw new Error(`formulaForShape : forme sans terme (${s})`);
  }
}

/** CharKey portée par une Formula de carac. (Bonus/Valeur) — défaut F pour le sélecteur. */
const charOfFormula = (f: JsonFormula | undefined): CharKey =>
  f && typeof f === 'object' ? ('bonusOf' in f ? f.bonusOf : 'charOf' in f ? f.charOf : 'force') : 'force';

/** Éditeur RÉUTILISABLE d'une `Formula` : sélecteur de FORME + champs adaptés. AUCUNE forme
 *  existante n'est dégradée — un littéral reste littéral, un `{dice}`/`{charOf}` est édité tel quel.
 *  EXPORTÉ : réutilisé par les éditeurs de champs Formula hors-op (durée d'un consommable, CodexEdit).
 *  Le terme de Péché n'est offert que dans le dialecte qui l'admet : celui du nœud de SON `champ` dans
 *  la variante d'op (`NoeudDOpContext`), ou le `dialecte` d'une position de formule composée. Sans
 *  l'un ni l'autre, le champ est une `Formula` du moteur, et son `onChange` n'en reçoit jamais d'autre. */
type FormulaFieldProps = { label: string; value: JsonFormula | undefined; min?: number } & (
  | { champ?: undefined; dialecte?: undefined; onChange: (f: Formula) => void }
  | { champ: string; dialecte?: undefined; onChange: (f: JsonFormula) => void }
  | { champ?: undefined; dialecte: DialecteSansPeche; onChange: (f: Formula) => void }
  | { champ?: undefined; dialecte: DialecteDeFormule; onChange: (f: JsonFormula) => void }
);

export function FormulaField(props: FormulaFieldProps) {
  const { label, value, min } = props;
  const noeudDOp = useContext(NoeudDOpContext);
  const dialecte: DialecteDeFormule = props.dialecte
    ?? (props.champ !== undefined ? dialecteDuNoeud(noeudDuChamp(noeudDOp, props.champ)) : 'general');
  const onChange = (f: Formula) => props.onChange(f);
  const emet = (f: JsonFormula): void => {
    if (estFormuleGenerale(f)) props.onChange(f);
    else if (props.champ !== undefined) props.onChange(f);
    else if (props.dialecte === 'peche' || props.dialecte === 'termeDePeche') props.onChange(f);
    else throw new Error(`FormulaField : terme de Péché émis hors de son dialecte (${JSON.stringify(f)})`);
  };
  const shape = shapeOf(value);
  const setShape = (s: FormulaShape) => { if (s !== shape) emet(formulaForShape(s, value)); };
  const formes = (Object.keys(LIBELLE_DE_FORME) as FormulaShape[])
    .filter((s) => (s !== 'peche' || admetLeTermeDePeche(dialecte)) && !(dialecte === 'sansTirage' && FORMES_DE_JET.has(s)));
  return (
    <label className="dr fml-field">
      {label}
      <span className="fml-row">
        <select className="fml-shape" value={shape} onChange={(e) => setShape(e.target.value as FormulaShape)}>
          {formes.map((s) => <option key={s} value={s}>{LIBELLE_DE_FORME[s]}</option>)}
        </select>
        {shape === 'regle' && (
          <select aria-label="Règle optionnelle" value={typeof value === 'object' && value != null && 'rule' in value ? value.rule : ''}
            onChange={(e) => onChange({ rule: e.target.value })}>
            {paramsDeRegle().map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        )}
        {shape === 'lit' && (
          <NumberField variant="nu" label={label ? `${label} — nombre` : 'Nombre'} min={min} value={typeof value === 'number' ? value : 0}
            onChange={onChange} />
        )}
        {(shape === 'bonus' || shape === 'char') && (
          <select value={charOfFormula(value)}
            onChange={(e) => onChange(shape === 'bonus' ? { bonusOf: e.target.value as CharKey } : { charOf: e.target.value as CharKey })}>
            {CHARS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
          </select>
        )}
        {shape === 'dice' && typeof value === 'object' && value != null && 'dice' in value && (
          <span className="fml-dice">
            <NumberField variant="nu" label="nombre de dés" title="nombre de dés" min={1} value={value.dice.n}
              onChange={(n) => onChange({ dice: { ...value.dice, n } })} />
            d
            <NumberField variant="nu" label="faces" title="faces" min={1} value={value.dice.sides}
              onChange={(sides) => onChange({ dice: { ...value.dice, sides } })} />
            +
            <NumberField variant="nu" label="offset" title="offset" value={value.dice.plus ?? 0}
              onChange={(p) => onChange({ dice: { ...value.dice, plus: p || undefined } })} />
          </span>
        )}
        {/* `times` = PRODUIT de deux Formules (« (Force Mentale) × 1d10 minutes », VDM 05) : les deux
            facteurs sont édités par le MÊME `FormulaField` (récursif) — aucun des deux n'est un littéral forcé. */}
        {shape === 'times' && typeof value === 'object' && value != null && 'times' in value && (
          <span className="fml-dice">
            <FormulaField label="" dialecte={dialecteDesFacteurs(dialecte)} value={value.times.of} onChange={(of: JsonFormula) => emet({ times: { of, factor: value.times.factor } })} />
            ×
            <FormulaField label="" dialecte={dialecteDesFacteurs(dialecte)} value={value.times.factor} onChange={(factor: JsonFormula) => emet({ times: { of: value.times.of, factor } })} />
          </span>
        )}
        {/* `minimum` = BORNE BASSE de la formule enveloppée (AA 07 l.113) : `of` s'édite par le MÊME
            `FormulaField` (récursif), la borne est un entier ≥ 0 (`formulaSchema`). */}
        {shape === 'minimum' && typeof value === 'object' && value != null && 'minimum' in value && (
          <span className="fml-dice">
            <NumberField variant="nu" label="minimum" title="minimum" min={0} value={value.minimum}
              onChange={(minimum) => onChange({ minimum, of: value.of })} />
            ≤
            <FormulaField label="" dialecte={dialecteDesFacteurs(dialecte)} value={value.of} min={min}
              onChange={(of: Formula) => onChange({ minimum: value.minimum, of })} />
          </span>
        )}
        {/* `sum` = COMPOSITION de termes (« 1d10 + (pions − 1) », LDB 16 l.84) : chaque terme est un
            `FormulaField` récursif, comme les deux facteurs de `times`. */}
        {shape === 'somme' && typeof value === 'object' && value != null && 'sum' in value && (
          <span className="fml-dice">
            {/* Aucun `min` propagé à un TERME : une somme compose des termes NÉGATIFS
                (« 1d10 – (Bonus d'Endurance) », AA 07 l.113) — la borne du champ parent est celle du TOTAL. */}
            {value.sum.map((terme, i) => (
              <span key={i} className="fml-dice">
                {i > 0 && '+'}
                <FormulaField label="" dialecte={dialecteDesTermes(dialecte)} value={terme}
                  onChange={(t: JsonFormula) => emet({ sum: value.sum.map((x, j) => (j === i ? t : x)) })} />
                <button type="button" className="btn small danger" title="retirer ce terme" aria-label="retirer ce terme"
                  onClick={() => emet({ sum: value.sum.filter((_, j) => j !== i) })}>−</button>
              </span>
            ))}
            <button type="button" className="btn small" title="ajouter un terme" aria-label="ajouter un terme"
              onClick={() => emet({ sum: [...value.sum, 0] })}>+</button>
          </span>
        )}
      </span>
    </label>
  );
}

/** FENÊTRE de Détermination (`ResolveWindow`, `engine/ops`) de l'État qu'une op `condition` porte en
 *  canal PASSIF — `LDB 17 l.61`. Quatre formes, toutes AUTHORABLES : défaut absent (`LDB 16 l.117`,
 *  défaut étendu à tout État dérivé), refus (`LDB 20 l.188`), Rounds, minutes d'horloge (`LDB 20 l.170`).
 *  Les deux durées sont des `Formula` éditées par le MÊME `FormulaField` que toute autre quantité —
 *  donc un `{rule}` pour une fenêtre non chiffrée (`LDB 20 l.170` « quelques minutes »). */
export function ResolveWindowField({ value, onChange }: {
  value: ResolveWindow | undefined;
  onChange: (w: ResolveWindow | undefined) => void;
}) {
  const forme = value === undefined ? 'defaut' : value === 'none' ? 'none' : value.scale;
  return (
    <>
      <label className="dr">Détermination
        <select aria-label="Fenêtre de Détermination" value={forme}
          onChange={(e) => {
            const f = e.target.value;
            onChange(f === 'defaut' ? undefined
              : f === 'none' ? 'none'
                : f === 'rounds' ? { scale: 'rounds', left: 1 }
                  : { scale: 'clock', minutes: 5 });
          }}>
          <option value="defaut">— défaut : jusqu’à la fin du Round —</option>
          <option value="none">dépense REFUSÉE (l’État tient tant que sa cause dure)</option>
          <option value="rounds">suspend le fait N Round(s)</option>
          <option value="clock">suspend le fait N minute(s)</option>
        </select>
      </label>
      {typeof value === 'object' && value.scale === 'rounds' && (
        <FormulaField label="Rounds de suspension" min={1} value={value.left} onChange={(left) => onChange({ scale: 'rounds', left })} />
      )}
      {typeof value === 'object' && value.scale === 'clock' && (
        <FormulaField label="Minutes de suspension" min={1} value={value.minutes} onChange={(minutes) => onChange({ scale: 'clock', minutes })} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Défauts — une op MINIMALE VALIDE par type
// ---------------------------------------------------------------------------

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

export function newOp(op: GameOp['op'] | string): GameOp {
  switch (op as GameOp['op']) {
    case 'wounds': return { op: 'wounds', amount: 5 };
    case 'heal': return { op: 'heal', amount: 3 };
    case 'healCaster': return { op: 'healCaster', amount: 1 };
    case 'condition': return { op: 'condition', id: '', value: 1 };
    case 'removeCondition': return { op: 'removeCondition' };
    case 'endPsych': return { op: 'endPsych', type: '' };
    case 'beginPsych': return { op: 'beginPsych', type: '' };
    case 'sbBonus': return { op: 'sbBonus', amount: 1 };
    case 'incomingSpellDRMod': return { op: 'incomingSpellDRMod', amount: -1 };
    case 'charMod': return { op: 'charMod', char: 'force', mod: -10 };
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
    case 'grantFreeAttack': return { op: 'grantFreeAttack', weapon: 'held', when: 'immediate', advantageOrMovement: true };
    case 'grantTrait': return { op: 'grantTrait', trait: { id: '' } };
    case 'removeTrait': return { op: 'removeTrait', trait: { id: '' } };
    case 'grantPsychTrait': return { op: 'grantPsychTrait', psychType: '' };
    case 'removePsychTrait': return { op: 'removePsychTrait' };
    case 'grantTalent': return { op: 'grantTalent', talent: { id: '' } };
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
    case 'actGate': return { op: 'actGate', char: 'force-mentale' };
    case 'delayed': return { op: 'delayed', afterHours: 1, ops: [] };
    case 'preventInfection': return { op: 'preventInfection' };
    case 'cureCriticalWound': return { op: 'cureCriticalWound', count: 1 };
    case 'amputer': return { op: 'amputer', sequels: [] };
    case 'suppressPsych': return { op: 'suppressPsych' };
    case 'suffocate': return { op: 'suffocate' };
    case 'noBreath': return { op: 'noBreath' };
    case 'noHunger': return { op: 'noHunger' };
    case 'weatherWard': return { op: 'weatherWard' };
    case 'damageArmour': return { op: 'damageArmour', material: 'cuir' };
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
    case 'charDRBonus': return { op: 'charDRBonus', char: 'sociabilite', bonus: 1 };
    case 'crewTestMod': return { op: 'crewTestMod', mod: 10 };
    // Aucun id EN DUR : la table se choisit, comme une table référencée de `rollTable` (`tableId: ''`).
    case 'fall': return { op: 'fall', hauteur: { table: { id: '' } } };
    case 'moveScale': return { op: 'moveScale', num: 1, den: 2 };
    case 'moveMod': return { op: 'moveMod', mod: -1 };
    // Terrain d'ÉLECTION : le SENS de l'op est « hors de l'élément où l'on se meut », donc le premier
    // terrain NON franchissable à pied du registre — dérivé du dataset, jamais un id récité.
    case 'offTerrainMod': return { op: 'offTerrainMod', terrain: terrainDElectionParDefaut(), mSet: 1, testDR: -2 };
    case 'attrMod': return { op: 'attrMod', attr: 'fortune', mod: 1 };
    case 'maxWeaponHands': return { op: 'maxWeaponHands', hands: 1 };
    case 'disarm': return { op: 'disarm' };
    case 'handGate': return { op: 'handGate' };
    case 'senseLoss': return { op: 'senseLoss', sense: 'vue' };
    case 'loseTurn': return { op: 'loseTurn' };
    case 'removeShipPoste': return { op: 'removeShipPoste' };
    case 'weaponRollMod': return { op: 'weaponRollMod', phase: 'attack', drMod: -1 };
    case 'weaponDamageMod': return { op: 'weaponDamageMod', mode: 'maxUnits' };
    case 'armourPierce': return { op: 'armourPierce', amount: 1 };
    case 'critOnRoll': return { op: 'critOnRoll', mod: 10, equals: 0 };
    case 'spendAdvantage': return { op: 'spendAdvantage', amount: 1 };
    case 'rollThreshold': return { op: 'rollThreshold', sides: 10, thresholds: [] };
    case 'rollTable': return { op: 'rollTable', die: 'd10', rows: [] };
    case 'rollMutation': return { op: 'rollMutation', table: '' };
    case 'narrative': return { op: 'narrative', text: '' };
    default: return { op: 'wounds', amount: 5 };
  }
}

// ---------------------------------------------------------------------------
// Champs d'édition
// ---------------------------------------------------------------------------

/** Ops avec un éditeur DÉDIÉ ; toute autre op tombe sur le repli JSON (lisible/modifiable sans perte). */
const DEDICATED: ReadonlySet<GameOp['op']> = new Set([
  'wounds', 'heal', 'healCaster', 'condition', 'removeCondition', 'charMod', 'skillMod', 'moveMod', 'ap', 'testMod',
  'corruption', 'sinMod', 'corruptionExposure', 'gainResource', 'grantTrait', 'grantTalent', 'grantNaturalWeapon', 'narrative',
  'summon', 'polymorph', 'lifeSteal', 'push', 'teleport', 'chain', 'rollTable', 'rollMutation', 'armourPierce', 'light',
  'fall', 'domeWard', 'offTerrainMod', 'moveScale', 'maxWeaponHands', 'giveTrapping',
]);

/** Durée PROPRE en Rounds d'une op qui en porte une (`durationFromOp`, engine/ops) : une `Formula`,
 *  donc la borne basse d'une entrée (`{minimum, of}` — AA 07 l.113) s'y édite comme toute autre forme.
 *  ABSENTE = la durée du CONTEXTE (`durationFromCtx`). SOURCE UNIQUE des ops à durée de Rounds SEULE
 *  (`moveScale`, `maxWeaponHands`) ; `condition` et `charMod` portent TROIS échelles (`DureesPropresField`). */
function DureeRoundsField({ value, onChange }: { value: JsonFormula | undefined; onChange: (f: JsonFormula | undefined) => void }) {
  return (
    <>
      <label className="dr"><input type="checkbox" checked={value != null}
        onChange={(e) => onChange(e.target.checked ? 1 : undefined)} /> dure N Rounds</label>
      {value != null && <FormulaField label="Durée (Rounds)" champ="durationRounds" value={value} min={0} onChange={onChange} />}
    </>
  );
}

/** Échelle « par +N DR » (`PerSL`, `perSLSchema`) : palier, quantité par palier, échelle sur l'échec.
 *  SOURCE UNIQUE de la saisie de toute échelle `PerSL` d'une op ; `libelle` nomme la case qui la pose. */
function PerSLField({ libelle, value, onChange }: { libelle: string; value: PerSL | undefined; onChange: (p: PerSL | undefined) => void }) {
  return (
    <>
      <label className="dr"><input type="checkbox" checked={value != null} onChange={(e) => onChange(e.target.checked ? { every: 1, amount: 1 } : undefined)} /> {libelle}</label>
      {value != null && (
        <>
          <label className="dr">tous les<NumberField variant="nu" label="Palier en Degrés de Réussite" title="DR" min={1} value={value.every} onChange={(every) => onChange({ ...value, every })} /> DR</label>
          <label className="dr">+<NumberField variant="nu" label="quantité par palier" title="quantité par palier" value={value.amount} onChange={(amount) => onChange({ ...value, amount })} /></label>
          <label className="dr"><input type="checkbox" checked={!!value.onFailure} onChange={(e) => onChange(sansClesVides({ ...value, onFailure: e.target.checked || undefined }))} /> sur l'échec (niveau d'échec)</label>
        </>
      )}
    </>
  );
}

type DureesPropres = { durationRounds?: JsonFormula; durationMinutes?: JsonFormula; durationHours?: JsonFormula };

/** Durée PROPRE à TROIS échelles EXCLUSIVES entre elles (JSDoc des ops `condition` et `charMod`) : cocher
 *  une échelle efface les deux autres. ABSENTE = la durée du CONTEXTE (`durationFromCtx`). SOURCE UNIQUE
 *  des ops qui les portent ; `minRounds` est la borne basse de la durée en Rounds de l'op. */
function DureesPropresField({ value, minRounds, onChange }: { value: DureesPropres; minRounds: number; onChange: (patch: DureesPropres) => void }) {
  return (
    <>
      <label className="dr"><input type="checkbox" checked={value.durationRounds != null} onChange={(e) => onChange({ durationRounds: e.target.checked ? 1 : undefined, durationMinutes: undefined, durationHours: undefined })} /> dure N Rounds</label>
      {value.durationRounds != null && <FormulaField label="Durée (Rounds)" champ="durationRounds" value={value.durationRounds} min={minRounds} onChange={(durationRounds) => onChange({ durationRounds })} />}
      <label className="dr"><input type="checkbox" checked={value.durationMinutes != null} onChange={(e) => onChange({ durationMinutes: e.target.checked ? 1 : undefined, durationRounds: undefined, durationHours: undefined })} /> dure N minutes</label>
      {value.durationMinutes != null && <FormulaField label="Durée (minutes)" champ="durationMinutes" value={value.durationMinutes} min={1} onChange={(durationMinutes) => onChange({ durationMinutes })} />}
      <label className="dr"><input type="checkbox" checked={value.durationHours != null} onChange={(e) => onChange({ durationHours: e.target.checked ? 1 : undefined, durationRounds: undefined, durationMinutes: undefined })} /> dure N heures</label>
      {value.durationHours != null && <FormulaField label="Durée (heures)" champ="durationHours" value={value.durationHours} min={1} onChange={(durationHours) => onChange({ durationHours })} />}
    </>
  );
}

/** Rangées d'une op `rollTable` (Vers de carie, MSRC 16 l.90) : `[min,max]` (source unique de fourchette,
 *  cf. `OutcomeBandsField`/`MutationRange`) → `ops` de la rangée, éditées par le MÊME `GameOpEditor`
 *  (récursif) que toute autre liste de `GameOp[]` — jamais un widget parallèle. */
function RollTableRowsField({ rows, onChange }: { rows: { min: number; max: number; ops: GameOp[] }[]; onChange: (rows: { min: number; max: number; ops: GameOp[] }[]) => void }) {
  const set = (i: number, patch: Partial<{ min: number; max: number; ops: GameOp[] }>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const cles = useClesDeRangees(rows);
  return (
    <div className="ed-field">
      <span>rangées de la table (fourchette du jet → ops)</span>
      {rows.map((r, i) => (
        <div className="ed-subfield" key={cles[i]}>
          <div className="tf-row">
            <label className="dr">de<NumberField variant="nu" label="Fourchette — borne basse" width={64} value={r.min} onChange={(min) => set(i, { min })} /></label>
            <label className="dr">à<NumberField variant="nu" label="Fourchette — borne haute" width={64} value={r.max} onChange={(max) => set(i, { max })} /></label>
            <button className="btn small" title="Monter" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
            <button className="btn small" title="Descendre" disabled={i === rows.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
            <button className="btn small danger" title="Supprimer la rangée" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</button>
          </div>
          <GameOpEditor ops={r.ops} onChange={(ops) => set(i, { ops })} />
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...rows, { min: 1, max: 1, ops: [] }])}>+ Rangée</button>
    </div>
  );
}

/** Un objet de payload SANS ses clés vides — la même loi que le filtre d'`upd`, applicable à un
 *  SOUS-objet que `upd` ne balaie pas (il ne voit que le premier niveau). */
function sansClesVides<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Traits ajoutés d'une invocation (`summon.addTraits`) en une chaîne « Frénésie, Magique », relue par
 *  `relireTraits` contre les poses courantes ; une liste vidée ôte la clé. */
const traitsAjoutesEnChaine = (v: TraitPose[] | undefined): string => (v ?? []).map(formatTrait).join(', ');
const relireTraitsAjoutes = (texte: string, avant: TraitPose[] | undefined): TraitPose[] | undefined => {
  const a = relireTraits(texte.split(',').map((t) => t.trim()).filter(Boolean), avant ?? []);
  return a.length ? a : undefined;
};

/** Le Trait octroyé d'un `grantTrait` en chaîne de livre (« Haine (Humains) »), relu par `relireTraits`
 *  contre la pose courante ; un Indice formulé (non numérique) se saisit à part (`FormulaField`) et
 *  survit à la relecture d'une chaîne qui n'en porte pas. */
const traitOctroyeEnChaine = (t: TraitOctroye | undefined): string =>
  t?.id ? formatTrait({ ...t, value: typeof t.value === 'number' ? t.value : undefined }) : '';
const relireTraitOctroye = (texte: string, avant: TraitOctroye | undefined): TraitOctroye => {
  const { value, ...pose } = avant ?? { id: '' };
  const indice = typeof value === 'number' ? { value } : {};
  const [relu] = relireTraits(texte.trim() ? [texte.trim()] : [], pose.id ? [{ ...pose, ...indice }] : []);
  if (!relu) return { id: '' } as TraitOctroye;
  return sansClesVides({ ...relu, value: relu.value ?? (typeof value === 'number' ? undefined : value) });
};

/** Le Trait octroyé d'une op (`grantTrait`, `domeWard`) : sa saisie de livre et son Indice formulé, au
 *  dialecte du nœud `trait.value` (`formuleSansTirageSchema`). `indiceRequis` : l'Indice ne se décoche pas. */
function TraitOctroyeFields({ trait, indiceRequis, indiceMin, onChange }: { trait: TraitOctroye; indiceRequis: boolean; indiceMin: number; onChange: (t: TraitOctroye) => void }) {
  const majIndice = (value: TraitOctroye['value']) => onChange(sansClesVides({ ...trait, value }));
  return (
    <>
      <SaisieEnBrouillon
        ariaLabel="Trait octroyé" placeholder="Trait octroyé (ex. Haine (Humains))" value={trait}
        afficher={traitOctroyeEnChaine} relire={relireTraitOctroye} onChange={onChange} />
      {!indiceRequis && (
        <label className="dr"><input type="checkbox" checked={trait.value != null} onChange={(e) => majIndice(e.target.checked ? 1 : undefined)} /> Indice</label>
      )}
      {trait.value != null && (
        <FormulaField label="Indice" champ="trait.value" value={trait.value} min={indiceMin}
          onChange={(value) => majIndice(formuleSansTirageSchema.parse(value))} />
      )}
    </>
  );
}

function OpFields({ op, onChange, noeudListe }: { op: GameOp; onChange: (o: GameOp) => void; noeudListe: unknown }) {
  const objets = useContext(ObjetsDOpContext);
  const identite = useId();
  const noeudDOp = useMemo(() => varianteDOp(noeudListe, op.op), [noeudListe, op.op]);
  const o = op as any;
  // Le payload d'une op est STRICT : un champ VIDÉ ôte sa clé, jamais une clé à `undefined` (une option
  // absente n'est pas une option indéfinie — `'clé' in op` reste le test d'existence, ici comme au moteur).
  // Le filtre ne balaie que le PREMIER niveau du payload : un patch qui écrit un SOUS-objet (`valuePerSL`…)
  // passe par `sansClesVides`, qui y applique la même loi.
  const upd = (patch: any) => onChange(sansClesVides({ ...o, ...patch }) as GameOp);
  return (
    <NoeudDOpContext.Provider value={noeudDOp}>
    <div className="eff-body">
      <TypeMenu
        value={op}
        discriminant="op"
        currentLabel={OP_LABEL[op.op]}
        groups={OP_MENU_GROUPS}
        make={(key) => newOp(key)}
        onChange={onChange}
      />
      <div className="tf-row">
        {op.op === 'giveTrapping' && <>
          <ObjetDonneField objets={objets} value={o} onChange={onChange} />
          <NumberField label="Nombre d’objets" vide value={o.count} onChange={(count) => upd({ count })} />
          <PerSLField libelle="objets en plus par DR" value={o.perSL} onChange={(perSL) => upd({ perSL })} />
        </>}
        {(op.op === 'wounds' || op.op === 'heal' || op.op === 'healCaster') && (
          <FormulaField label="Quantité" champ="amount" value={o.amount} min={0} onChange={(amount) => upd({ amount })} />
        )}
        {/* `ap` : quantité SIGNÉE — un montant négatif RETIRE des PA (VDM 05). Aucun `min` : le borner à 0
            rendrait le retrait insaisissable à l'atelier alors que le moteur le sait appliquer. */}
        {op.op === 'ap' && (
          <FormulaField label="PA (±)" champ="amount" value={o.amount} onChange={(amount) => upd({ amount })} />
        )}
        {op.op === 'sinMod' && (
          <label className="dr">Péché ±<NumberField variant="nu" label="Points de Péché (±)" value={o.amount ?? 1} onChange={(amount) => upd({ amount })} /></label>
        )}
        {op.op === 'corruptionExposure' && (
          <>
            {/* Sens ABRI (VDM 05, Bouclier en acier doré) : `easeSteps` pose une protection en CRANS ;
                le niveau et la nature ne servent qu'au sens POSE. */}
            <label className="dr">Abri (crans)
              <NumberField variant="nu" label="Abri (crans)" min={1} placeholder="—" vide value={typeof o.easeSteps === 'number' ? o.easeSteps : undefined}
                onChange={(n) => upd({ easeSteps: n ?? undefined })} />
            </label>
            {o.easeSteps == null && (
              <>
                <select value={o.level ?? 'mineure'} onChange={(e) => upd({ level: e.target.value as ExposureLevel })}>
                  {Object.entries(valeursDe(exposureLevelSchema) ?? {}).map(([k, l]) => (
                    <option key={k} value={k}>Exposition {l}</option>
                  ))}
                </select>
                {/* Options BORNÉES à `NATURES_D_INFLUENCE` (même alphabet que la porte de document). */}
                <select value={o.nature ?? ''}
                  onChange={(e) => upd({ nature: (e.target.value || undefined) as NatureDInfluence | undefined })}>
                  <option value="">Nature : au choix du joueur</option>
                  {NATURES_D_INFLUENCE.map((n) => (
                    <option key={n} value={n}>{libelleDeLaNature(n)}</option>
                  ))}
                </select>
              </>
            )}
          </>
        )}
        {op.op === 'corruption' && (
          <>
            <label className="dr">Points<NumberField variant="nu" label="Points de Corruption" value={o.amount ?? 1} onChange={(amount) => upd({ amount })} /></label>
            <select value={o.align ?? ''} onChange={(e) => upd({ align: (e.target.value || undefined) as ChaosAlign | undefined })}>
              <option value="">Mutation : règle globale</option>
              {Object.entries(valeursDe(chaosAlignSchema) ?? {}).map(([k, l]) => (
                <option key={k} value={k}>Table EDOC : {l}</option>
              ))}
            </select>
          </>
        )}
        {op.op === 'gainResource' && (
          <>
            <select value={o.resource ?? 'fortune'} onChange={(e) => upd({ resource: e.target.value })}>
              <option value="fortune">Chance</option>
              <option value="fate">Destin</option>
            </select>
            <label className="dr">Points<NumberField variant="nu" label="Points" min={1} value={o.amount ?? 1} onChange={(amount) => upd({ amount })} /></label>
            <label className="dr"><input type="checkbox" checked={!!o.temporary} onChange={(e) => upd({ temporary: e.target.checked || undefined })} /> le temps du Sort</label>
          </>
        )}
        {op.op === 'sbBonus' && (
          <label className="dr">+BF<NumberField variant="nu" label="Bonus de Force (±)" value={o.amount ?? 0} onChange={(amount) => upd({ amount })} /></label>
        )}
        {op.op === 'incomingSpellDRMod' && (
          <label className="dr">DR de Sort / point<NumberField variant="nu" label="Degrés de Réussite de Sort par point" value={typeof o.amount === 'number' ? o.amount : 0} onChange={(amount) => upd({ amount })} /></label>
        )}
        {op.op === 'endPsych' && (
          <label className="dr">Type psy<input value={o.type ?? ''} onChange={(e) => upd({ type: e.target.value })} /></label>
        )}
        {op.op === 'beginPsych' && (
          <>
            <RefField cfg={{ ds: 'psychologies', single: true }} fieldKey="État psychologique"
              value={o.type ?? ''} onChange={(v) => upd({ type: (v as string) ?? '' })} />
            <input placeholder="Cible (Groupe — Animosité, Phobie…)" value={o.cible ?? ''}
              onChange={(e) => upd({ cible: e.target.value || undefined })} />
            <label className="dr"><input type="checkbox" checked={o.indice != null} onChange={(e) => upd({ indice: e.target.checked ? 1 : undefined })} /> Indice</label>
            {o.indice != null && <FormulaField label="Valeur" champ="indice" value={o.indice} min={0} onChange={(indice) => upd({ indice })} />}
          </>
        )}
        {op.op === 'testMod' && (
          <>
            <label className="dr">Modif.<NumberField variant="nu" label="Modificateur de Test" value={o.amount ?? 0} onChange={(amount) => upd({ amount })} /></label>
            <label className="dr">Carac.
              <select value={o.char ?? ''} onChange={(e) => upd({ char: (e.target.value || undefined) as CharKey | undefined })}>
                <option value="">— tous les Tests —</option>
                {CHARS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
              </select>
            </label>
          </>
        )}
        {(op.op === 'condition' || op.op === 'removeCondition') && (
          <>
            <select value={o.id ?? ''} onChange={(e) => upd({ id: e.target.value || undefined })}>
              {op.op === 'removeCondition' && <option value="">— au choix (1er État) —</option>}
              {op.op === 'condition' && !o.id && <option value="">— (choisir un État) —</option>}
              {etats.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <FormulaField label="Intensité" champ="value" value={o.value ?? 1} min={0} onChange={(value) => upd({ value })} />
            {op.op === 'condition' && (
              <>
                <label className="dr"><input type="checkbox" checked={!!o.perRound} onChange={(e) => upd({ perRound: e.target.checked || undefined })} /> chaque Round</label>
                <PerSLField libelle="par DR" value={o.valuePerSL} onChange={(valuePerSL) => upd({ valuePerSL })} />
                {/* Se libérer (LDB 16 l.66 / Filets, Zoo Impérial p.29) — escapeStrength (Test opposé) et
                    escapeThreshold (Test à seuil) sont MUTUELLEMENT EXCLUSIFS (cf. resolveRecoverTest). */}
                <label className="dr"><input type="checkbox" checked={o.escapeStrength != null} onChange={(e) => upd({ escapeStrength: e.target.checked ? { charOf: 'force' } : undefined, escapeThreshold: e.target.checked ? undefined : o.escapeThreshold })} /> Force d'évasion (opposée)</label>
                {o.escapeStrength != null && <FormulaField label="Force" champ="escapeStrength" value={o.escapeStrength} min={0} onChange={(escapeStrength) => upd({ escapeStrength, escapeThreshold: undefined })} />}
                <label className="dr"><input type="checkbox" checked={o.escapeThreshold != null} onChange={(e) => upd({ escapeThreshold: e.target.checked ? 3 : undefined, escapeStrength: e.target.checked ? undefined : o.escapeStrength })} /> Seuil de DR (Test non opposé)</label>
                {o.escapeThreshold != null && <FormulaField label="Seuil (DR)" champ="escapeThreshold" value={o.escapeThreshold} min={0} onChange={(escapeThreshold) => upd({ escapeThreshold, escapeStrength: undefined })} />}
                <label className="dr"><input type="checkbox" checked={!!o.entangleOnFail} onChange={(e) => upd({ entangleOnFail: e.target.checked || undefined })} /> échec → +1 État (Filets, ZI 02 l.176)</label>
                <label className="dr"><input type="checkbox" checked={o.struggleDamage != null} onChange={(e) => upd({ struggleDamage: e.target.checked ? 1 : undefined })} /> Dégâts par tentative (ignore armure)</label>
                {o.struggleDamage != null && <FormulaField label="Dégâts" champ="struggleDamage" value={o.struggleDamage} min={0} onChange={(struggleDamage) => upd({ struggleDamage })} />}
                {/* Ce que la Détermination fait à l'État quand cette op le porte en PASSIF (LDB 17 l.61) :
                    DIT en donnée, jamais déduit du porteur. Inerte hors canal passif. */}
                <ResolveWindowField value={o.resolveWindow} onChange={(resolveWindow) => upd({ resolveWindow })} />
                {/* État PORTÉ (#1695, LDB 48 l.495) : cocher « porté » EFFACE les champs que le canal
                    passif ne transporte pas (même patron d'exclusivité que Force d'évasion / Seuil de DR
                    ci-dessus), depuis la MÊME liste close que le refus au parse (`CHAMPS_EXCLUS_DE_CARRIED`)
                    — la donnée ne peut donc pas naître dans la forme que `refusLoose` refuse. */}
                <label className="dr"><input type="checkbox" checked={!!o.carried} onChange={(e) => upd(e.target.checked
                  ? { carried: true, ...tableTotale(CHAMPS_EXCLUS_DE_CARRIED, () => undefined) }
                  : { carried: undefined })}
                /> porté par la source (durée du Sort)</label>
                {o.carried
                  ? <span className="dr">— la durée et le verrou de l’État sont ceux de l’effet actif de la source : il part avec elle.</span>
                  : (
                    <>
                      <DureesPropresField value={o} minRounds={1} onChange={upd} />
                      {/* VERROUS de Critique (LDB 18) : prédicat d'état (`lockedUntil`) et acte de soin (`unlockBy`). */}
                      <label className="dr"><input type="checkbox" checked={o.lockedUntil != null} onChange={(e) => upd({ lockedUntil: e.target.checked ? { kind: 'always' } : undefined })} /> verrouillé tant que (LDB 18)</label>
                      {o.lockedUntil != null && (
                        // `kinds` = les seuls sujets que le contexte de verrou GARANTIT (`conditionLockCtx`) :
                        // SOURCE UNIQUE partagée avec le refus au parse (`SUJETS_DE_VERROU`, mecanique.ts:159).
                        <ConditionEditor cond={o.lockedUntil as Condition} kinds={SUJETS_DE_VERROU as ReadonlySet<Condition['kind']>} onChange={(lockedUntil) => upd({ lockedUntil })} />
                      )}
                      <label className="dr">Retiré par{/* LDB 18 : « ne peut être retiré que par [acte] » */}
                        <select value={o.unlockBy ?? ''} onChange={(e) => upd({ unlockBy: (e.target.value || undefined) as ConditionUnlock | undefined })}>
                          <option value="">— aucun acte requis —</option>
                          {UNLOCK_LABELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                      </label>
                    </>
                  )}
              </>
            )}
          </>
        )}
        {op.op === 'charMod' && (
          <>
            <select value={o.char} onChange={(e) => upd({ char: e.target.value as CharKey })}>
              {CHARS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
            </select>
            <label className="dr">Modif.<NumberField variant="nu" label="Modificateur de caractéristique" value={o.mod} onChange={(mod) => upd({ mod })} /></label>
            {/* Plancher : champ RÉSERVÉ, offert là seulement où la famille du porteur l'admet (EDO 11 l.190). */}
            {enfantsDe(noeudDOp).some((e) => e.cle === 'min') && (
              <label className="dr">Plancher<NumberField variant="nu" label="Plancher de la perte" placeholder="—" vide value={o.min} onChange={(n) => upd({ min: n ?? undefined })} /></label>
            )}
            <DureesPropresField value={o} minRounds={0} onChange={upd} />
          </>
        )}
        {/* Échelle de Mouvement et plafond de mains d'arme (Séquelles & mobilité) : même contrat de durée
            que `charMod` (Rounds SEULS, sinon celle du contexte) — même champ, jamais une copie. */}
        {op.op === 'moveScale' && (
          <>
            <label className="dr">Numérateur<NumberField variant="nu" label="Numérateur de l’échelle de Mouvement" min={0} value={o.num ?? 1} onChange={(num) => upd({ num })} /></label>
            <label className="dr">Dénominateur<NumberField variant="nu" label="Dénominateur de l’échelle de Mouvement" min={1} value={o.den ?? 2} onChange={(den) => upd({ den })} /></label>
            <DureeRoundsField value={o.durationRounds} onChange={(durationRounds) => upd({ durationRounds })} />
          </>
        )}
        {op.op === 'maxWeaponHands' && (
          <>
            <label className="dr">Mains<NumberField variant="nu" label="Plafond de mains d’arme" min={1} value={o.hands ?? 1} onChange={(hands) => upd({ hands })} /></label>
            <DureeRoundsField value={o.durationRounds} onChange={(durationRounds) => upd({ durationRounds })} />
          </>
        )}
        {op.op === 'skillMod' && (
          <>
            <RefField cfg={{ ds: 'skills', single: true }} fieldKey="Compétence" value={o.skill} onChange={(v) => upd({ skill: (v as string) ?? '' })} />
            <label className="dr">Modif.<NumberField variant="nu" label="Modificateur de Compétence" value={o.mod ?? 0} onChange={(mod) => upd({ mod })} /></label>
            <label className="dr">Sens{/* Surdité, LDB 18 : restreint au Test de Perception basé sur ce sens */}
              <select value={o.sense ?? ''} onChange={(e) => upd({ sense: (e.target.value || undefined) as 'vue' | 'ouie' | undefined })}>
                <option value="">— tous les Tests —</option>
                <option value="vue">Vue</option>
                <option value="ouie">Ouïe</option>
              </select>
            </label>
          </>
        )}
        {op.op === 'moveMod' && (
          <label className="dr">Mouvement (±)<NumberField variant="nu" label="Modificateur de Mouvement" value={o.mod ?? 0} onChange={(mod) => upd({ mod })} /></label>
        )}
        {/* Le terrain d'élection est une RÉF au registre (`terrains.json`) : il s'élit dans la liste, jamais
            au clavier. `value` porte l'id, le texte porte le libellé FR ; l'ordre est celui du registre,
            RESTREINT aux terrains électifs — un porteur de rôle (absence, bord du monde) n'est pas un lieu
            dont on puisse sortir. `mSet`/`testDR` sont OPTIONNELS au payload : vider le champ ÔTE la clé. */}
        {op.op === 'offTerrainMod' && (
          <>
            <label className="dr">Terrain d’élection
              <select aria-label="Terrain d’élection" value={o.terrain ?? ''} onChange={(e) => upd({ terrain: e.target.value })}>
                {terrainsElectifs().map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="dr">M imposé
              <NumberField variant="nu" label="Mouvement imposé hors du terrain d’élection" min={0} placeholder="—" vide
                value={typeof o.mSet === 'number' ? o.mSet : undefined} onChange={(n) => upd({ mSet: n ?? undefined })} />
            </label>
            <label className="dr">DR aux Tests (±)
              <NumberField variant="nu" label="Modificateur de Degrés de Réussite aux Tests" placeholder="—" vide
                value={typeof o.testDR === 'number' ? o.testDR : undefined} onChange={(n) => upd({ testDR: n ?? undefined })} />
            </label>
            <label className="dr"><input type="checkbox" checked={!!o.suffocates} onChange={(e) => upd({ suffocates: e.target.checked || undefined })} /> suffoque hors de son terrain</label>
          </>
        )}
        {op.op === 'grantTrait' && (
          <>
            <TraitOctroyeFields trait={op.trait} indiceRequis={false} indiceMin={0} onChange={(trait) => upd({ trait })} />
            <label className="dr">Cible
              <select aria-label="Cible" value={op.cible?.table.id ?? ''}
                onChange={(e) => upd(e.target.value
                  ? { cible: { pick: op.cible?.pick ?? 1, table: { id: e.target.value } }, trait: sansClesVides({ ...op.trait, arg: undefined }) }
                  : { cible: undefined })}>
                <option value="">posée par le Trait</option>
                {Object.entries(valeursDe(tablesDeCiblesSchema) ?? {}).map(([k, l]) => <option key={k} value={k}>tirée sur {l}</option>)}
              </select>
            </label>
            {op.cible != null && (
              <label className="dr">Tirages
                <NumberField variant="nu" label="Nombre de Cibles tirées" min={1} value={op.cible.pick}
                  onChange={(n) => upd({ cible: { ...op.cible, pick: Math.max(1, n ?? 1) } })} />
              </label>
            )}
          </>
        )}
        {op.op === 'domeWard' && (
          // AUCUN champ de zone : la ZdE du Dôme se règle dans la CIBLE du sort (un seul endroit).
          <TraitOctroyeFields trait={op.trait} indiceRequis indiceMin={1} onChange={(trait) => upd({ trait })} />
        )}
        {op.op === 'grantTalent' && (
          <RefField cfg={{ ds: 'talents', single: true, spec: true }} fieldKey="Talent"
            value={{ id: o.talent?.id ?? '', spec: o.talent?.spec }}
            onChange={(v) => { const r = typeof v === 'string' ? { id: v } : (v as { id: string; spec?: string }); upd({ talent: r }); }} />
        )}
        {op.op === 'grantNaturalWeapon' && (
          <>
            <input placeholder="Arme (ex. Morsure, Griffes)" value={o.label ?? ''} onChange={(e) => upd({ label: e.target.value })} />
            <FormulaField label="Dégâts" champ="damage" value={o.damage} min={0} onChange={(damage) => upd({ damage })} />
            <label className="dr"><input type="checkbox" checked={o.plusBF !== false} onChange={(e) => upd({ plusBF: e.target.checked })} /> BF+</label>
            <input placeholder="Qualités (Magique…)" value={(o.qualities ?? []).join(', ')}
              onChange={(e) => { const a = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean); upd({ qualities: a.length ? a : undefined }); }} />
          </>
        )}
        {op.op === 'summon' && (
          <>
            <RefField cfg={{ ds: 'creatures', single: true }} fieldKey="Créature" value={o.ref ?? ''} onChange={(v) => upd({ ref: (v as string) ?? '' })} />
            <FormulaField label="Nombre" champ="count" value={o.count ?? 1} min={1} onChange={(count) => upd({ count })} />
            <label className="dr">Taille
              <select value={o.size ?? ''} onChange={(e) => upd({ size: e.target.value || undefined })}>
                <option value="">— d’origine —</option>
                {SIZES.map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
              </select>
            </label>
            <SaisieEnBrouillon
              placeholder="Traits ajoutés (ex. Frénésie, Magique)" value={o.addTraits as TraitPose[] | undefined}
              afficher={traitsAjoutesEnChaine} relire={relireTraitsAjoutes} onChange={(addTraits) => upd({ addTraits })} />
            <label className="dr"><input type="checkbox" checked={o.allyOfCaster !== false} onChange={(e) => upd({ allyOfCaster: e.target.checked ? true : false })} /> alliée du lanceur</label>
            <label className="dr"><input type="checkbox" checked={!!o.despawnIfCasterDown} onChange={(e) => upd({ despawnIfCasterDown: e.target.checked || undefined })} /> se dissipe si le lanceur tombe</label>
          </>
        )}
        {op.op === 'polymorph' && (
          <RefField cfg={{ ds: 'creatures', single: true }} fieldKey="Forme prise" value={o.ref ?? ''} onChange={(v) => upd({ ref: (v as string) ?? '' })} />
        )}
        {op.op === 'light' && (
          <>
            <label className="dr">Rayon (m)
              <NumberField variant="nu" label="Rayon (m)" min={1} value={o.radiusM ?? 1}
                onChange={(radiusM) => upd({ radiusM })} />
            </label>
            <label className="dr">Ton
              <select value={o.tone ?? ''} onChange={(e) => upd({ tone: e.target.value || undefined })}>
                <option value="">— ton par défaut —</option>
                {lightTones.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
          </>
        )}
        {op.op === 'lifeSteal' && (
          <>
            <label className="dr">Fraction
              <NumberField variant="nu" label="numérateur" title="numérateur" min={1} value={o.num ?? 1} onChange={(num) => upd({ num })} />
              /
              <NumberField variant="nu" label="dénominateur" title="dénominateur" min={1} value={o.den ?? 2} onChange={(den) => upd({ den })} />
            </label>
            <label className="dr">Arrondi
              <select value={o.round ?? 'floor'} onChange={(e) => upd({ round: e.target.value })}>
                <option value="floor">inférieur</option>
                <option value="ceil">supérieur</option>
              </select>
            </label>
          </>
        )}
        {op.op === 'push' && (
          <FormulaField label="Distance (m)" champ="meters" value={o.meters} min={0} onChange={(meters) => upd({ meters })} />
        )}
        {op.op === 'chain' && (
          <>
            <FormulaField label="Rebonds max" champ="maxBounces" value={o.maxBounces} min={0} onChange={(maxBounces) => upd({ maxBounces })} />
            <FormulaField label="Saut (m)" champ="hopMeters" value={o.hopMeters} min={0} onChange={(hopMeters) => upd({ hopMeters })} />
          </>
        )}
        {op.op === 'teleport' && (
          <>
            <FormulaField label="Distance (m)" champ="meters" value={o.meters} min={0} onChange={(meters) => upd({ meters })} />
            <label className="dr"><input type="checkbox" checked={o.perSL != null} onChange={(e) => upd({ perSL: e.target.checked ? { every: 2, metersFormula: { bonusOf: 'force-mentale' } } : undefined })} /> bonus par DR</label>
            {o.perSL != null && (
              <>
                <label className="dr">tous les<NumberField variant="nu" label="Palier en Degrés de Réussite" title="DR" min={1} value={o.perSL.every ?? 2} onChange={(every) => upd({ perSL: { ...o.perSL, every } })} /> DR</label>
                <FormulaField label="Bonus (m)" value={o.perSL.metersFormula} min={0} onChange={(metersFormula) => upd({ perSL: { ...o.perSL, metersFormula } })} />
              </>
            )}
          </>
        )}
        {op.op === 'narrative' && (
          <>
            <ProseField label="Texte journalisé" value={op.text} onChange={(text) => upd({ text })} />
            <ProvenanceDuTexte copie identite={identite} sujet="de la narration" value={op} onChange={upd} />
          </>
        )}
        {op.op === 'armourPierce' && (
          <>
            <label className="dr">PA retirés (plat)<NumberField variant="nu" label="Points d’Armure retirés" min={0} value={o.amount ?? 1} onChange={(amount) => upd({ amount })} /></label>
            <label className="dr">Matériau ignoré
              <select value={o.bypass ?? ''} onChange={(e) => upd({ bypass: (e.target.value || undefined) as ArmourBypass | undefined })}>
                <option value="">— aucun —</option>
                {Object.entries(valeursDe(armourBypassCategorieSchema) ?? {}).map(([k, l]) => (
                  <option key={k} value={k}>{l}</option>
                ))}
              </select>
            </label>
          </>
        )}
        {op.op === 'fall' && (
          <label className="dr">Table de hauteur
            <select value={o.hauteur.table.id} onChange={(e) => upd({ hauteur: { table: { id: e.target.value } } })}>
              {!o.hauteur.table.id && <option value="">— (choisir une table) —</option>}
              {fallTables.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
            </select>
          </label>
        )}
        {op.op === 'rollTable' && (
          <>
            {/* Deux formes EXCLUSIVES : table RÉFÉRENCÉE (`tableId` → tables.json) ou rangées INLINE. */}
            <label className="dr">Source de table
              <select value={'tableId' in o ? 'ref' : 'inline'} onChange={(e) => onChange(e.target.value === 'ref'
                ? { op: 'rollTable', ...(o.addNegativeSL ? { addNegativeSL: true } : {}), ...(o.extraRollsPerStep ? { extraRollsPerStep: o.extraRollsPerStep } : {}), tableId: '' }
                : { op: 'rollTable', die: 'd10', ...(o.addNegativeSL ? { addNegativeSL: true } : {}), ...(o.extraRollsPerStep ? { extraRollsPerStep: o.extraRollsPerStep } : {}), rows: [] })}>
                <option value="inline">Rangées inline</option>
                <option value="ref">Table référencée (tables.json)</option>
              </select>
            </label>
            <label className="dr"><input type="checkbox" checked={!!o.addNegativeSL} onChange={(e) => upd({ addNegativeSL: e.target.checked || undefined })} /> + |DR négatif| au jet (échec)</label>
            <label className="dr">+<NumberField variant="nu" label="Jets supplémentaires par pas de Surincantation" min={0} width={56} value={o.extraRollsPerStep ?? 0} onChange={(n) => upd({ extraRollsPerStep: n || undefined })} /> jet(s) par pas de Surincantation (Durée)</label>
            {'tableId' in o ? (
              <label className="dr">Table
                <select value={o.tableId} onChange={(e) => upd({ tableId: e.target.value })}>
                  {!o.tableId && <option value="">— (choisir une table) —</option>}
                  {effectTables.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
                </select>
              </label>
            ) : (
              <>
                <label className="dr">Dé
                  <select value={o.die ?? 'd10'} onChange={(e) => upd({ die: e.target.value as 'd10' | 'd100' })}>
                    {Object.entries(valeursDe(deDeTableSchema) ?? {}).map(([k, l]) => (
                      <option key={k} value={k}>{l}</option>
                    ))}
                  </select>
                </label>
                <RollTableRowsField rows={o.rows ?? []} onChange={(rows) => upd({ rows })} />
              </>
            )}
          </>
        )}
        {op.op === 'rollMutation' && (
          <>
            <label className="dr">Table de Corruption
              <select value={o.table} onChange={(e) => upd({ table: e.target.value })}>
                {!o.table && <option value="">— (choisir une table) —</option>}
                {mutationTables.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
              </select>
            </label>
            <label className="dr"><input type="checkbox" checked={o.duration === 'permanent'} onChange={(e) => upd({ duration: e.target.checked ? 'permanent' : undefined })} /> permanente (sinon durée du Sort)</label>
          </>
        )}
        {/* Un Test imbriqué n'est PLUS une op (`{op:'test'}` supprimé, Lot 4d) mais un nœud de la STRUCTURE
            Flow `{kind:'test'}` (édité par le FlowEditor, succès/échec cadence-aware). */}
        {/* Repli JSON pour toute op sans éditeur dédié — paramètres TOUJOURS lisibles/modifiables sans perte. */}
        {!DEDICATED.has(op.op) && (
          <JsonField label="paramètres de l’op" value={o} rows={6} onChange={(v) => onChange(v as GameOp)} />
        )}
      </div>
    </div>
    </NoeudDOpContext.Provider>
  );
}

/** `noeud` : schéma zod de la liste d'ops éditée ; chaque `Formula` d'op y lit le dialecte du nœud de
 *  SON champ, dans la variante de son op (`varianteDOp`). Absent = `gameOpSchema`, le vocabulaire du moteur. */
export function GameOpEditor({ ops, onChange, noeud = gameOpSchema, objets }: { ops: GameOp[]; onChange: (ops: GameOp[]) => void; noeud?: unknown; objets?: readonly TrappingData[] }) {
  const herites = useContext(ObjetsDOpContext);
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= ops.length) return;
    const next = [...ops];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const cles = useClesDeRangees(ops);
  return (
    <ObjetsDOpContext.Provider value={objets ?? herites}><div className="eff-list">
      {ops.map((o, i) => (
        <details className="eff-row" key={cles[i]}>
          <summary>
            <span className="eff-summary"><Icon id={OP_ICON[o.op] ?? 'journal/detail'} size="sm" /> {opSummary(o)}</span>
            {opsMissingRefs(o).length > 0 && <span className="de-warn">{opsMissingRefs(o).join(' · ')}</span>}
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === ops.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer l'op" onClick={() => onChange(ops.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          <OpFields noeudListe={noeud} op={o} onChange={(no) => onChange(ops.map((x, j) => (j === i ? no : x)))} />
        </details>
      ))}
      <AddMenu
        label="+ Op mécanique"
        groups={pickable(OP_MENU_GROUPS, (key) => onChange([...ops, newOp(key)]))}
      />
    </div></ObjetsDOpContext.Provider>
  );
}
