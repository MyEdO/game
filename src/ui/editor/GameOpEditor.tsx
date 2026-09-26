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
import { Formula, GameOp, type ResolveWindow } from '../../engine/ops';
import { ChaosAlign, ExposureLevel } from '../../engine/corruption';
import { libelleDeValeur, valeursDe } from '../../data/schemas/grammaire/meta';
import { chaosAlignSchema, exposureLevelSchema } from '../../data/schemas/grammaire/valeurs';
import { CHAR_LABELS, CharKey, ArmourBypass, type ConditionUnlock } from '../../engine/types';
import { SUJETS_DE_VERROU, CHAMPS_EXCLUS_DE_CARRIED } from '../../data/schemas/grammaire/mecanique';
import { ConditionEditor } from './ConditionEditor';
import type { Condition } from '../../engine/flowCore';
import { SizeCategory, SIZE_LABEL } from '../../engine/size';
import { etats, talentConcrete, qualityRefLabel, refLabel, findCrewTestTypeById, charAbr, effectTables, mutationTables, conditionLabel, lightTones, memoParVersion } from '../../data';
import { findFallTable, fallTables } from '../../data/shipCriticals';
import { terrainLabel, terrainsElectifs } from '../../state/terrain';
import { RefField } from '../compendium/RefField';
import type { DatasetKey } from '../../data/overrides';
import { giveTrappingLabel } from '../../engine/items';
import { parseTraitInstance, formatTrait, formatWardSave } from '../../engine/traits/dispatch';
import { traumaLabelOf } from '../../engine/trauma';
import { ACTE_DE_DEVERROUILLAGE } from '../../engine/conditions';
import { AddMenu, TypeMenu, pickable, type TypeMenuGroup } from './AddMenu';
import { JsonField } from './JsonField';
import { Icon } from '../Icon';
import { NumberField } from '../NumberField';
import type { IconIdInput } from '../icons';
import { TESTS_DE_CORRUPTION, type TestDeCorruption } from '../../data/schemas/grammaire/valeurs';
import { OPTIONAL_RULES, ruleDef } from '../../engine/policy';

/** Aide à la SAISIE de l'atelier : nature d'Influence que chaque Compétence repousse (`LDB 19 l.29`).
 *  Le `Record` est TOTAL sur l'alphabet — un id de plus impose son libellé ici. */
const NATURE_INFLUENCE: Record<TestDeCorruption, string> = { resistance: 'Influence physique', calme: 'Corruption spirituelle' };

const SIZES = Object.keys(SIZE_LABEL) as SizeCategory[];

const CHARS = Object.keys(CHAR_LABELS) as CharKey[];

/** Actes de soin qui LÈVENT un verrou d'État (`ConditionUnlock`, LDB 18) — libellés du moteur
 *  (`ACTE_DE_DEVERROUILLAGE`), partagés avec le refus d'un remède sur un État verrouillé. */
const UNLOCK_LABELS = Object.entries(ACTE_DE_DEVERROUILLAGE) as [ConditionUnlock, string][];

// ---------------------------------------------------------------------------
// Vocabulaire COMPLET — libellé + menu groupé par intention
// ---------------------------------------------------------------------------

/** Libellé court (texte SEUL, sert aussi de `<option>` natif) de CHAQUE op du vocabulaire `GameOp` —
 *  `Record` EXHAUSTIF (TS force sa complétude) : source runtime de l'énumération des kinds pour les
 *  tests (`Object.keys(OP_LABEL)`), sans dupliquer la liste. */
export const OP_LABEL: Record<GameOp['op'], string> = {
  wounds: 'Blessures (ignore BE/PA)',
  fall: 'Chute (hauteur lue dans une table)',
  heal: 'Soin (Blessures rendues)',
  healCaster: 'Soin au lanceur',
  condition: 'Poser un État',
  removeCondition: 'Retirer un État',
  charMod: 'Modif. de caractéristique',
  ap: '+PA (Localisation ou toutes)',
  testMod: 'Modif. à tous les Tests',
  skillDRBonus: '+DR à une Compétence',
  charDRBonus: '+DR aux Tests d’une Caractéristique',
  offTerrainMod: 'Hors de son terrain (M imposé, ±DR)',
  crewTestMod: 'Modif. aux Tests individuels d’un Test d’équipage',
  incomingAttackMod: 'Modif. au toucher de l’attaquant',
  incomingAdvantage: 'Avantage donné à l’attaquant (mêlée)',
  incomingSpellDRMod: 'Modif. au DR des Sorts qui l’affectent (par point/Indice)',
  sbBonus: '+Bonus de Force aux Dégâts',
  endPsych: 'Fin d’un état psychologique',
  beginPsych: 'Entrée dans un état psychologique',
  exposeDisease: 'Exposer à une Maladie (Test post-combat)',
  contractDisease: 'Contracter une Maladie (immédiat)',
  kill: 'Mort directe (Point de Destin sauve)',
  removeShipPoste: 'Retirer un poste de navire (Canon perdu)',
  teamCommander: 'Diriger l’équipe (score de Projectiles du commandant)', // posé par l'action « Diriger l'équipe » ; hors palette d'auteur (commanderId interne)
  attackKeyword: 'Mot-clé d’attaque (ex. magique)',
  mitigateIncoming: 'Mitige les Dégâts entrants (Éthéré)',
  ignoreStatePenalties: 'Ignore les pénalités d’État',
  freeReroll: 'Relance gratuite (prochain échec)',
  critTwice: 'Deux lancers de Critique (meilleur)',
  gainResource: 'Points de Chance / Destin',
  gainAdvantage: 'Porter l’Avantage à (min)',
  attrMod: 'Modif. d’attribut secondaire',
  corruption: 'Points de Corruption',
  sinMod: 'Points de Péché (±)',
  corruptionExposure: 'Exposition corruptrice (Test différé)',
  castPenalty: 'Contrecoup d’incantation',
  money: 'Bourse personnelle (sous de cuivre, ±)',
  statusMod: 'Standing temporaire (prochaine aventure)',
  grantReverseToken: 'Jeton d’inversion (prochaine aventure)',
  castWard: 'Aura anti-Sort (−20 Langue)',
  arrowWard: 'Bouclier anti-projectiles',
  domeWard: 'Dôme protecteur',
  attackWardFM: 'Attaquer exige un Test de FM',
  grantWeapon: 'Invoquer une arme magique',
  grantNaturalWeapon: 'Accorder une arme naturelle',
  grantFreeAttack: 'Accorder une attaque gratuite',
  interruptFocus: 'Interrompre la Focalisation', // marqueur combat-interne (branche d’échec du Test de Calme) — non author-pickable
  breakBlade: 'Désarmer / briser la lame', // marqueur combat-interne (victoire du Test de Piège-lame) — non author-pickable
  push: 'Poussée (repousser de N m)',
  teleport: 'Téléportation du lanceur',
  chain: 'Attaques en chaîne (rebond)',

  grantTrait: 'Accorder un Trait',
  removeTrait: 'Retirer un Trait',
  grantPsychTrait: 'Accorder un Trait psychologique',
  removePsychTrait: 'Retirer un Trait psychologique',
  grantTalent: 'Accorder un Talent',
  grantCareerSkill: 'Compétence ajoutée aux carrières',
  grantCareerTalent: 'Talent ajouté aux carrières',
  augmentWeapon: 'Enchanter l’arme',
  cureDisease: 'Guérir des maladies',
  reduceDiseaseDays: 'Raccourcir une maladie',
  preventInfection: 'Empêcher l’infection',
  cureCriticalWound: 'Guérir une Blessure critique',
  amputer: 'Amputer (plaie + séquelles permanentes)',
  diseaseTestMod: 'Modif. aux Tests d’une maladie',
  suppressSymptom: 'Suspendre un symptôme',
  aggravateSymptom: 'Aggraver un symptôme',
  attenuateSymptom: 'Atténuer un symptôme',
  grantSymptom: 'Ajouter un symptôme',
  actGate: 'Test par Round pour agir (drogue)',
  delayed: 'Ops différées (échéance d’horloge)',
  suppressPsych: 'Apaiser les Traits psychologiques',
  suffocate: 'Suffocation',
  noBreath: 'Plus besoin de respirer',
  noHunger: 'Plus besoin de manger',
  ignoreAnimosity: 'Ignore Préjugés/Animosités',
  weatherWard: 'Immunité aux intempéries',
  damageArmour: 'Pourrir le cuir (−1 PA)',
  reduceToZero: 'Réduire les Blessures à 0',
  banish: 'Bannir (retirer du jeu)',
  martyr: 'Martyr (recevoir les Dégâts)',
  giveTrapping: 'Donner un objet',
  perRound: 'Effet récurrent (chaque Round)',
  summon: 'Invoquer une créature',
  scheduleRespawn: 'Reconstitution différée (à la mort)', // marqueur de DONNÉE (op onSlain, non author-pickable)
  zone: 'Zone persistante (mur / disque)',
  polymorph: 'Métamorphose en créature',
  transform: 'Transformation durable (réversible)',
  endTransform: 'Fin de transformation',
  lifeSteal: 'Vol de vie (drain de Blessures)',
  light: 'Émettre de la lumière (rayon)',
  skillMod: 'Modif. d’une Compétence',
  moveScale: 'Échelle de Mouvement (×n/d)',
  moveMod: 'Modif. de Mouvement (±N)',
  maxWeaponHands: 'Plafond de mains d’arme',
  disarm: 'Lâcher l’objet tenu (main)',
  handGate: 'Main ensanglantée (Test par Action)',
  senseLoss: 'Perte sensorielle (œil/oreille)',
  loseTurn: 'Perdre Action + Mouvement',
  weaponRollMod: 'Atout d’arme — modif. de jet (passif)',
  weaponDamageMod: 'Atout d’arme — modif. de Dégâts (passif)',
  armourPierce: 'Atout d’arme — Perforante (passif)',
  critOnRoll: 'Atout d’arme — Critique sur jet (passif)',
  spendAdvantage: 'Dépenser de l’Avantage',
  rollThreshold: 'Jet à paliers (un dé → ops par seuil)',
  rollTable: 'Tirage sur table (dé → ops par fourchette)',
  rollMutation: 'Tirage d’une mutation (durée réglable)',
  charDamage: 'Perte permanente de Caractéristique',
  intoxicate: 'Boisson alcoolisée (échec de Résistance à l’alcool)',
  narrative: 'Effet narratif (texte libre)',
};

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
  critTwice: 'journal/critical', gainResource: 'resource/fortune', gainAdvantage: 'flag/focus',
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

export type FormulaShape = 'lit' | 'bonus' | 'char' | 'dice' | 'rolled' | 'times' | 'regle' | 'dr' | 'minimum' | 'somme';
export const shapeOf = (f: Formula | undefined): FormulaShape =>
  typeof f === 'number' || f == null ? 'lit' : 'minimum' in f ? 'minimum' : 'sum' in f ? 'somme' : 'bonusOf' in f ? 'bonus' : 'charOf' in f ? 'char' : 'rolled' in f ? 'rolled' : 'times' in f ? 'times' : 'rule' in f ? 'regle' : 'sl' in f ? 'dr' : 'dice';

/** Formule par défaut d'une forme — utilisée au CHANGEMENT de forme. Préserve le littéral courant
 *  quand on bascule vers « Nombre » ; ne touche JAMAIS une formule dont la forme est déjà la bonne. */
export function formulaForShape(s: FormulaShape, current: Formula | undefined): Formula {
  if (s === shapeOf(current)) return current as Formula; // déjà la bonne forme → inchangée (pas de clobber)
  // QUITTER la borne basse rend la formule qu'elle enveloppait — symétrique de l'enveloppement
  // ci-dessous : l'aller-retour Minimum → autre forme ne jette pas la quantité éditée.
  if (current != null && typeof current === 'object' && 'minimum' in current) return formulaForShape(s, current.of);
  if (s === 'lit') return typeof current === 'number' ? current : 1;
  if (s === 'bonus') return { bonusOf: 'force' };
  if (s === 'char') return { charOf: 'force' };
  if (s === 'rolled') return { rolled: true };
  if (s === 'times') return { times: { of: { dice: { n: 1, sides: 10 } }, factor: 10 } }; // « 1d10 × 10 » (LDB 71)
  if (s === 'regle') return { rule: paramsDeRegle()[0]?.id ?? '' };
  if (s === 'dr') return { sl: true };
  // Le minimum ENVELOPPE la formule courante (« 1d10 – (Bonus d'Endurance) Rounds (minimum de 1) »,
  // AA 07 l.113) : la quantité éditée n'est pas perdue au changement de forme.
  if (s === 'minimum') return { minimum: 1, of: current ?? { dice: { n: 1, sides: 10 } } };
  // Une SOMME neuve part du terme courant + un second terme à éditer (« 1d10 + … », LDB 16 l.84).
  if (s === 'somme') return { sum: [current ?? { dice: { n: 1, sides: 10 } }, 0] };
  return { dice: { n: 1, sides: 10 } };
}

/** CharKey portée par une Formula de carac. (Bonus/Valeur) — défaut F pour le sélecteur. */
const charOfFormula = (f: Formula | undefined): CharKey =>
  f && typeof f === 'object' ? ('bonusOf' in f ? f.bonusOf : 'charOf' in f ? f.charOf : 'force') : 'force';

/** Résumé court d'une Formula (lecture sans perte dans les résumés d'op). */
export function formulaSummary(f: Formula | undefined): string {
  if (f == null) return '0';
  if (typeof f === 'number') return String(f);
  if ('bonusOf' in f) return `B${charAbr(f.bonusOf)}`;
  if ('charOf' in f) return charAbr(f.charOf);
  if ('rolled' in f) return 'dé';
  if ('indiceOf' in f) return 'Indice';
  if ('stacks' in f) return 'pions';
  if ('engagedAdvantageGap' in f) return 'écart d’Avantage';
  if ('woundsDealt' in f) return 'PB infligés';
  if ('sl' in f) return 'DR';
  if ('rule' in f) return ruleDef(f.rule)?.label ?? f.rule;
  if ('minimum' in f) return `${formulaSummary(f.of)} (min ${f.minimum})`;
  if ('sum' in f) return f.sum.map(formulaSummary).join(' + ');
  if ('times' in f) return `${formulaSummary(f.times.of)} × ${formulaSummary(f.times.factor)}`;
  return `${f.dice.n}d${f.dice.sides}${f.dice.plus ? `+${f.dice.plus}` : ''}`;
}

/** Éditeur RÉUTILISABLE d'une `Formula` : sélecteur de FORME + champs adaptés. AUCUNE forme
 *  existante n'est dégradée — un littéral reste littéral, un `{dice}`/`{charOf}` est édité tel quel.
 *  EXPORTÉ : réutilisé par les éditeurs de champs Formula hors-op (durée d'un consommable, CodexEdit). */
export function FormulaField({ label, value, onChange, min }: {
  label: string;
  value: Formula | undefined;
  onChange: (f: Formula) => void;
  min?: number;
}) {
  const shape = shapeOf(value);
  const setShape = (s: FormulaShape) => { if (s !== shape) onChange(formulaForShape(s, value)); };
  return (
    <label className="dr fml-field">
      {label}
      <span className="fml-row">
        <select className="fml-shape" value={shape} onChange={(e) => setShape(e.target.value as FormulaShape)}>
          <option value="lit">Nombre</option>
          <option value="bonus">Bonus de carac.</option>
          <option value="char">Valeur de carac.</option>
          <option value="dice">Dés</option>
          <option value="times">Dés × facteur</option>
          <option value="rolled">Dé du jet (paliers)</option>
          <option value="regle">Règle optionnelle</option>
          <option value="dr">DR du Test</option>
          <option value="minimum">Minimum</option>
          <option value="somme">Somme de termes</option>
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
            <FormulaField label="" value={value.times.of} onChange={(of) => onChange({ times: { of, factor: value.times.factor } })} />
            ×
            <FormulaField label="" value={value.times.factor} onChange={(factor) => onChange({ times: { of: value.times.of, factor } })} />
          </span>
        )}
        {/* `minimum` = BORNE BASSE de la formule enveloppée (AA 07 l.113) : `of` s'édite par le MÊME
            `FormulaField` (récursif), la borne est un entier ≥ 0 (`formulaSchema`). */}
        {shape === 'minimum' && typeof value === 'object' && value != null && 'minimum' in value && (
          <span className="fml-dice">
            <NumberField variant="nu" label="minimum" title="minimum" min={0} value={value.minimum}
              onChange={(minimum) => onChange({ minimum, of: value.of })} />
            ≤
            <FormulaField label="" value={value.of} min={min} onChange={(of) => onChange({ minimum: value.minimum, of })} />
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
                <FormulaField label="" value={terme}
                  onChange={(t) => onChange({ sum: value.sum.map((x, j) => (j === i ? t : x)) })} />
                <button type="button" className="btn small danger" title="retirer ce terme" aria-label="retirer ce terme"
                  onClick={() => onChange({ sum: value.sum.filter((_, j) => j !== i) })}>−</button>
              </span>
            ))}
            <button type="button" className="btn small" title="ajouter un terme" aria-label="ajouter un terme"
              onClick={() => onChange({ sum: [...value.sum, 0] })}>+</button>
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
 * à pied parmi les ÉLECTIFS (`state/terrain › terrainsElectifs`), dans l'ordre authoré. Un défaut
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
    case 'castWard': return { op: 'castWard', radius: 5 };
    case 'arrowWard': return { op: 'arrowWard' };
    // L'Indice naît à 1 : le 6 du Dôme est la valeur RAW de CE sort (`LDB 47 l.410`), pas un défaut de
    // l'op — et le Trait `protection` déclare son Indice sans valeur (`traits.json`, `indice.label`).
    // Aucune zone : elle vient de la ligne « Cible » du sort (ZdE), pas de l'op.
    case 'domeWard': return { op: 'domeWard', traitId: '', indice: 1 };
    case 'attackWardFM': return { op: 'attackWardFM' };
    case 'grantWeapon': return { op: 'grantWeapon', label: '', damage: { bonusOf: 'force-mentale' } };
    case 'grantNaturalWeapon': return { op: 'grantNaturalWeapon', label: '', damage: 3 };
    case 'grantFreeAttack': return { op: 'grantFreeAttack', weapon: 'held', when: 'immediate', advantageOrMovement: true };
    case 'grantTrait': return { op: 'grantTrait', traitId: '' };
    case 'removeTrait': return { op: 'removeTrait', traitId: '' };
    case 'grantPsychTrait': return { op: 'grantPsychTrait', psychType: '' };
    case 'removePsychTrait': return { op: 'removePsychTrait' };
    case 'grantTalent': return { op: 'grantTalent', talentId: '' };
    case 'grantCareerSkill': return { op: 'grantCareerSkill', skill: { id: '' } };
    case 'grantCareerTalent': return { op: 'grantCareerTalent', talentId: '' };
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
    case 'skillDRBonus': return { op: 'skillDRBonus', bonus: 1 };
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
// Champs d'IDENTITÉ d'une op — réf de registre
// ---------------------------------------------------------------------------

/** Champ d'une op portant une RÉFÉRENCE de registre : `ds` = dataset où elle doit résoudre,
 *  `required` = l'op est inapplicable tant que rien n'est élu. Un champ à union FERMÉE (`char`,
 *  `material`, `resource`, `level`…) n'en est pas une : TS y impose déjà l'un de ses N membres. */
export interface OpRefField { field: string; ds: DatasetKey; label: string; required: boolean }

/** Valeur d'un champ-réf d'op — `field` est un CHEMIN (`skill.id` pour une référence EMBOÎTÉE,
 *  `traitId` pour une référence à plat). PURE. */
export function opRefValue(op: unknown, field: string): unknown {
  return field.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), op);
}

/** Même chemin, en ÉCRITURE : rend une COPIE de `op` dont `field` porte `valeur`. PURE. */
export function opWithRefValue<T>(op: T, field: string, valeur: unknown): T {
  const [tete, ...reste] = field.split('.');
  const source = op as Record<string, unknown>;
  const sousArbre = reste.length
    ? opWithRefValue((source[tete] ?? {}) as Record<string, unknown>, reste.join('.'), valeur)
    : valeur;
  return { ...source, [tete]: sousArbre } as T;
}

/** SOURCE UNIQUE des réfs de registre du vocabulaire `GameOp`, lue par les contrôles d'édition
 *  (sentinelle vide), par la raison visible portée par la rangée, et par le gate pré-persist du
 *  Codex (`validateEntry`). Un nouveau champ-réf s'ajoute ICI, jamais dans une nième liste. */
export const OP_REF_FIELDS: Partial<Record<GameOp['op'], readonly OpRefField[]>> = {
  condition: [{ field: 'id', ds: 'etats', label: 'État', required: true }],
  removeCondition: [{ field: 'id', ds: 'etats', label: 'État', required: false }],
  endPsych: [{ field: 'type', ds: 'psychologies', label: 'Trait psychologique', required: true }],
  beginPsych: [{ field: 'type', ds: 'psychologies', label: 'État psychologique', required: true }],
  grantPsychTrait: [{ field: 'psychType', ds: 'psychologies', label: 'Trait psychologique', required: true }],
  removePsychTrait: [{ field: 'psychType', ds: 'psychologies', label: 'Trait psychologique', required: false }],
  grantTrait: [{ field: 'traitId', ds: 'traits', label: 'Trait', required: true }],
  removeTrait: [{ field: 'traitId', ds: 'traits', label: 'Trait', required: true }],
  domeWard: [{ field: 'traitId', ds: 'traits', label: 'Trait', required: true }],
  grantTalent: [{ field: 'talentId', ds: 'talents', label: 'Talent', required: true }],
  grantCareerTalent: [{ field: 'talentId', ds: 'talents', label: 'Talent', required: true }],
  grantCareerSkill: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: true }],
  skillMod: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: true }],
  skillDRBonus: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: false }],
  grantReverseToken: [{ field: 'skill.id', ds: 'skills', label: 'Compétence', required: false }],
  castPenalty: [{ field: 'skill.id', ds: 'skills', label: 'Compétence de magie', required: false }],
  corruptionExposure: [{ field: 'skill.id', ds: 'skills', label: 'Compétence du Test', required: false }],
  suppressSymptom: [{ field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  aggravateSymptom: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }, { field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  attenuateSymptom: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }, { field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  grantSymptom: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }, { field: 'symptomId', ds: 'symptoms', label: 'Symptôme', required: true }],
  rollMutation: [{ field: 'table', ds: 'mutationTables', label: 'Table de Corruption', required: true }],
  summon: [{ field: 'ref', ds: 'creatures', label: 'Créature', required: true }],
  polymorph: [{ field: 'ref', ds: 'creatures', label: 'Créature', required: true }],
  exposeDisease: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }],
  contractDisease: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: true }],
  reduceDiseaseDays: [{ field: 'disease', ds: 'maladies', label: 'Maladie', required: false }],
  giveTrapping: [{ field: 'trappingId', ds: 'trappings', label: 'Possession', required: false }],
};

/** Réfs REQUISES non élues d'UNE op (champ absent ou vide) — sans récursion. PURE. */
export function opMissingRefs(op: GameOp): string[] {
  return (OP_REF_FIELDS[op.op] ?? [])
    .filter((f) => f.required && (opRefValue(op, f.field) == null || opRefValue(op, f.field) === ''))
    .map((f) => `${OP_LABEL[op.op]} : ${f.label} à choisir`);
}

/** Même mesure sur une valeur QUELCONQUE (liste d'ops, rangée de table, entrée entière de Codex) :
 *  descente générique sur tout nœud portant un `op` — les ops imbriquées (`delayed`, `perRound`,
 *  `transform`, rangées de `rollTable`…) sont couvertes sans énumérer leurs porteurs. PURE. */
export function opsMissingRefs(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(opsMissingRefs);
  if (value == null || typeof value !== 'object') return [];
  const node = value as Record<string, unknown>;
  const own = typeof node.op === 'string' && node.op in OP_LABEL ? opMissingRefs(node as unknown as GameOp) : [];
  return [...own, ...Object.values(node).flatMap(opsMissingRefs)];
}

// ---------------------------------------------------------------------------
// Résumé
// ---------------------------------------------------------------------------

export function opSummary(o: GameOp): string {
  // Une op dont la réf REQUISE n'est pas élue n'a pas de résumé à donner : elle porte son état, et la
  // rangée affiche la raison détaillée (`opsMissingRefs`).
  if (opMissingRefs(o).length) return '(à compléter)';
  switch (o.op) {
    case 'wounds': return `${formulaSummary(o.amount)} Blessure(s)`;
    case 'heal': return `+${formulaSummary(o.amount)} PB`;
    case 'healCaster': return `+${formulaSummary(o.amount)} PB au lanceur`;
    case 'condition': return `${conditionLabel(o.id)}${o.value && o.value !== 1 ? ` ×${formulaSummary(o.value)}` : ''}${o.perRound ? '/Round' : ''}`;
    case 'removeCondition': return `${o.id ? conditionLabel(o.id) : '(au choix)'}`;
    case 'endPsych': return `${o.type}`;
    case 'beginPsych': return `${o.type}${o.cible ? ` (${o.cible})` : ''}${o.indice != null ? ` ${formulaSummary(o.indice)}` : ''}`;
    case 'sbBonus': return `+${o.amount} BF aux Dégâts`;
    case 'incomingSpellDRMod': return `${typeof o.amount === 'number' && o.amount >= 0 ? '+' : ''}${formulaSummary(o.amount)} DR de Sort / point`;
    case 'charMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char] ?? o.char}`;
    case 'skillMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} ${refLabel('skills', o.skill)}`;
    case 'skillDRBonus': return `+${formulaSummary(o.bonus)} DR ${o.skill ? refLabel('skills', o.skill) : (findCrewTestTypeById(o.testType ?? '')?.label ?? o.testType)}`;
    case 'charDRBonus': return `+${formulaSummary(o.bonus)} DR ${CHAR_LABELS[o.char] ?? o.char}`;
    case 'crewTestMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} (Tests d’équipage)`;
    case 'fall': return `hauteur lue dans « ${findFallTable(o.hauteur.table.id)?.label ?? (o.hauteur.table.id || '— table à choisir —')} »`;
    case 'moveMod': return `${o.mod >= 0 ? '+' : ''}${o.mod} Mouvement`;
    // Le résumé est de l'AFFICHAGE : le terrain s'y lit à son LIBELLÉ (`terrains.json › label`), l'id nu
    // ne restant que pour un id absent du registre — l'auteur doit VOIR ce qu'il a élu.
    case 'offTerrainMod': return `hors ${terrainLabel(o.terrain) ?? o.terrain}${o.mSet != null ? ` : M ${o.mSet}` : ''}${o.testDR ? `, ${o.testDR} DR aux Tests` : ''}${o.suffocates ? ', suffoque' : ''}`;
    case 'attrMod': return `+${formulaSummary(o.mod)} ${({ wounds: 'Blessures', fortune: 'Chance', resolve: 'Détermination', fate: 'Destin', resilience: 'Résilience' } as const)[o.attr]}`;
    case 'ap': return `${typeof o.amount === 'number' && o.amount < 0 ? '' : '+'}${formulaSummary(o.amount)} PA${o.loc ? ` (${o.loc})` : ''}`;
    case 'testMod': return `${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests${o.char ? ` de ${CHAR_LABELS[o.char] ?? o.char}` : ''}`;
    case 'ignoreStatePenalties': return 'ignore les pénalités d’État';
    case 'freeReroll': return 'relance gratuite';
    case 'critTwice': return 'deux lancers de Critique';
    case 'gainResource': return `${o.amount >= 0 ? '+' : '−'}${Math.abs(o.amount)} ${o.resource === 'fate' ? 'Destin' : 'Chance'}${o.temporary ? ' (temp.)' : ''}`;
    case 'corruption': return `${o.amount >= 0 ? '+' : ''}${o.amount}${o.align ? ` (${libelleDeValeur(chaosAlignSchema, o.align)})` : ''}`;
    case 'sinMod': return `${o.amount >= 0 ? '+' : ''}${o.amount}`;
    case 'corruptionExposure': return o.easeSteps != null ? `abri : −${o.easeSteps} cran(s) d’Influence` : `${libelleDeValeur(exposureLevelSchema, o.level ?? '')}${o.skill ? ` (${refLabel('skills', o.skill)})` : ''}`;
    case 'castPenalty': return `${o.blocked ? 'magie interdite' : o.maxZeroDR ? 'Prière plafonnée' : `${o.mod ?? 0} ${o.skill ? refLabel('skills', o.skill) : 'toute magie'}`}`;
    case 'money': return `bourse ${typeof o.montant.brass === 'number' && o.montant.brass < 0 ? '' : '+'}${formulaSummary(o.montant.brass)} sc`;
    case 'statusMod': return `Standing ${formulaSummary(o.amount)} (prochaine aventure)`;
    case 'grantReverseToken': return `inverser ${o.skill ? refLabel('skills', o.skill) : 'un Test (cible)'}`;
    case 'castWard': return `−20 Langue, rayon ${formulaSummary(o.radius)} m`;
    case 'arrowWard': return 'projectiles organiques détruits (ZdE du sort)';
    case 'domeWard': return `${formatWardSave(o.traitId, formulaSummary(o.indice))} (ZdE du sort)`;
    case 'attackWardFM': return 'l’attaquer exige un Test de FM';
    case 'grantWeapon': return `${o.label} (Dégâts ${o.plusBF ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantNaturalWeapon': return `${o.label} (${o.plusBF !== false ? 'BF+' : ''}${formulaSummary(o.damage)})`;
    case 'grantTrait': return `${formatTrait({ id: o.traitId, arg: o.arg })}${o.indice != null ? ` ${formulaSummary(o.indice)}` : ''}`;
    case 'removeTrait': return `${formatTrait({ id: o.traitId })}`;
    case 'grantPsychTrait': return `${o.psychType}${o.cible ? ` (${o.cible})` : ''}`;
    case 'grantTalent': return `${talentConcrete(o)}`;
    case 'grantCareerSkill': return `${refLabel('skills', o.skill)}`;
    case 'grantCareerTalent': return `${refLabel('talents', { id: o.talentId, spec: o.spec })}`;
    case 'augmentWeapon': return `${[
      ...(o.addQualities ?? []).map((id) => qualityRefLabel({ id })),
      o.damageBonus != null ? `+${formulaSummary(o.damageBonus)} Dégâts` : '',
      ...(o.removeQualities ?? []).map((id: string) => `−${qualityRefLabel({ id })}`),
      o.removeType === 'atout' ? 'perd ses Atouts' : o.removeType === 'defaut' ? 'perd ses Défauts' : '',
      o.suppressEnchants ? 'enchantements annulés' : '',
      o.passive?.length ? 'maniement altéré' : '',
    ].filter(Boolean).join(', ') || '(vide)'}`;
    case 'cureDisease': return `${o.count ?? 1} maladie(s)`;
    case 'reduceDiseaseDays': return `−${o.dice ? `${o.dice.n}d${o.dice.sides}` : (o.days ?? 1)} jour(s)${o.disease ? ` (${refLabel('maladies', { id: o.disease })})` : ''}`;
    case 'diseaseTestMod': return `${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests de maladie${o.diseases?.length ? ` (${o.diseases.map((d) => refLabel('maladies', { id: d })).join(', ')})` : ''}`;
    case 'suppressSymptom': return `${refLabel('symptoms', { id: o.symptomId })} suspendu`;
    case 'aggravateSymptom': return `${refLabel('symptoms', { id: o.symptomId })} → ${o.severity} (${refLabel('maladies', { id: o.disease })})`;
    case 'attenuateSymptom': return `${refLabel('symptoms', { id: o.symptomId })} → échelon inférieur (${refLabel('maladies', { id: o.disease })})`;
    case 'grantSymptom': return `+ ${refLabel('symptoms', { id: o.symptomId })} (${refLabel('maladies', { id: o.disease })})`;
    case 'actGate': return `Test de ${CHAR_LABELS[o.char] ?? o.char} chaque Round pour agir`;
    case 'delayed': return `${o.ops.length} op(s) différée(s)${o.afterDuration ? ' (à la dissipation)' : ''}`;
    case 'preventInfection': return 'pas d’infection';
    case 'cureCriticalWound': return `${o.count ?? 1} critique(s)`;
    case 'amputer': return `${o.sequels.map((id) => traumaLabelOf(id)).join(' + ') || 'aucune séquelle'}${o.unitesPerSL ? ' (+1 par DR)' : ''}`;
    case 'suppressPsych': return 'Traits psy. apaisés';
    case 'suffocate': return 'suffocation';
    case 'noBreath': return 'plus besoin de respirer';
    case 'noHunger': return 'plus besoin de manger';
    case 'weatherWard': return 'immunité aux intempéries';
    case 'damageArmour': return 'cuir −1 PA';
    case 'reduceToZero': return 'Blessures à 0';
    case 'banish': return 'retirée du jeu';
    case 'martyr': return 'reçoit les Dégâts';
    case 'giveTrapping': return `${o.count && o.count > 1 ? `${o.count}× ` : ''}${giveTrappingLabel(o)}`;
    case 'perRound': return `${o.ops.length} op(s) chaque Round`;
    case 'summon': return `${formulaSummary(o.count)}× ${o.ref}${o.allyOfCaster === false ? ' (hostile)' : ''}`;
    case 'scheduleRespawn': return `${o.ref} dans ${formulaSummary(o.delayDays)} j${o.cancelFlag ? ` (sauf « ${o.cancelFlag} »)` : ''}`;
    case 'zone': return `${o.shape === 'wall' ? `mur ${formulaSummary(o.lengthMeters ?? 2)} m` : `disque ${formulaSummary(o.radiusMeters ?? 2)} m`}`;
    case 'push': return `${formulaSummary(o.meters)} m`;
    case 'teleport': return `${formulaSummary(o.meters)} m${o.perSL ? ` (+${formulaSummary(o.perSL.metersFormula)}/${o.perSL.every} DR)` : ''}`;
    case 'chain': return `${formulaSummary(o.maxBounces)} rebond(s), saut ${formulaSummary(o.hopMeters)} m`;
    case 'polymorph': return `${o.ref}`;
    case 'transform': return `« ${o.tag} » (${o.ops.length} effet(s)${o.morphRef ? `, apparence ${o.morphRef}` : ''})`;
    case 'endTransform': return `« ${o.tag} »`;
    case 'lifeSteal': return `${o.num}/${o.den} des Dégâts`;
    case 'loseTurn': return 'saute le tour';
    case 'removeShipPoste': return 'retire un poste de navire';
    case 'rollThreshold': return `1d${o.sides} → ${o.thresholds.length} palier(s)`;
    case 'rollTable': return `${'tableId' in o ? `table « ${o.tableId} »` : `${o.die === 'd100' ? '1d100' : '1d10'} → ${o.rows.length} rangée(s)`}${o.addNegativeSL ? ' (+|DR néga.|)' : ''}${o.extraRollsPerStep ? ` +${o.extraRollsPerStep} jet/pas Surinc. (Durée)` : ''}`;
    case 'rollMutation': return `mutation ← « ${o.table} »${o.duration === 'permanent' ? ' (perm.)' : ''}`;
    case 'narrative': return `${o.text ? `« ${o.text.length > 40 ? `${o.text.slice(0, 39)}…` : o.text}` + ' »' : '(vide)'}`;
    default: return `${(o as GameOp).op}`;
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
  'fall', 'domeWard', 'offTerrainMod', 'moveScale', 'maxWeaponHands',
]);

/** Durée PROPRE en Rounds d'une op qui en porte une (`durationFromOp`, engine/ops) : une `Formula`,
 *  donc la borne basse d'une entrée (`{minimum, of}` — AA 07 l.113) s'y édite comme toute autre forme.
 *  ABSENTE = la durée du CONTEXTE (`durationFromCtx`). SOURCE UNIQUE des ops à durée de Rounds SEULE
 *  (`charMod`, `moveScale`, `maxWeaponHands`) ; `condition` a son propre bloc à TROIS échelles exclusives. */
function DureeRoundsField({ value, onChange }: { value: Formula | undefined; onChange: (f: Formula | undefined) => void }) {
  return (
    <>
      <label className="dr"><input type="checkbox" checked={value != null}
        onChange={(e) => onChange(e.target.checked ? 1 : undefined)} /> dure N Rounds</label>
      {value != null && <FormulaField label="Durée (Rounds)" value={value} min={0} onChange={onChange} />}
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
  return (
    <div className="ed-field">
      <span>rangées de la table (fourchette du jet → ops)</span>
      {rows.map((r, i) => (
        <div className="ed-subfield" key={i}>
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

function OpFields({ op, onChange }: { op: GameOp; onChange: (o: GameOp) => void }) {
  const o = op as any;
  // Le payload d'une op est STRICT : un champ VIDÉ ôte sa clé, jamais une clé à `undefined` (une option
  // absente n'est pas une option indéfinie — `'clé' in op` reste le test d'existence, ici comme au moteur).
  // Le filtre ne balaie que le PREMIER niveau du payload : un patch qui écrit un SOUS-objet (`valuePerSL`…)
  // passe par `sansClesVides`, qui y applique la même loi.
  const upd = (patch: any) => onChange(sansClesVides({ ...o, ...patch }) as GameOp);
  return (
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
        {(op.op === 'wounds' || op.op === 'heal' || op.op === 'healCaster') && (
          <FormulaField label="Quantité" value={o.amount} min={0} onChange={(amount) => upd({ amount })} />
        )}
        {/* `ap` : quantité SIGNÉE — un montant négatif RETIRE des PA (VDM 05). Aucun `min` : le borner à 0
            rendrait le retrait insaisissable à l'atelier alors que le moteur le sait appliquer. */}
        {op.op === 'ap' && (
          <FormulaField label="PA (±)" value={o.amount} onChange={(amount) => upd({ amount })} />
        )}
        {op.op === 'sinMod' && (
          <label className="dr">Péché ±<NumberField variant="nu" label="Points de Péché (±)" value={o.amount ?? 1} onChange={(amount) => upd({ amount })} /></label>
        )}
        {op.op === 'corruptionExposure' && (
          <>
            {/* Sens ABRI (VDM 05, Bouclier en acier doré) : `easeSteps` pose une protection en CRANS ;
                le niveau et la compétence ne servent qu'au sens POSE. */}
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
                {/* Options BORNÉES à `TESTS_DE_CORRUPTION` (même alphabet que la porte de document) ;
                    la valeur posée est la RÉFÉRENCE `{ id }`, jamais un id nu. */}
                <select value={(o.skill as { id?: string } | undefined)?.id ?? ''}
                  onChange={(e) => upd({ skill: e.target.value ? { id: e.target.value } : undefined })}>
                  <option value="">Compétence : au choix du joueur</option>
                  {TESTS_DE_CORRUPTION.map((id) => (
                    <option key={id} value={id}>{refLabel('skills', { id })} ({NATURE_INFLUENCE[id]})</option>
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
            {o.indice != null && <FormulaField label="Valeur" value={o.indice} min={0} onChange={(indice) => upd({ indice })} />}
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
            <FormulaField label="Intensité" value={o.value ?? 1} min={0} onChange={(value) => upd({ value })} />
            {op.op === 'condition' && (
              <>
                <label className="dr"><input type="checkbox" checked={!!o.perRound} onChange={(e) => upd({ perRound: e.target.checked || undefined })} /> chaque Round</label>
                <label className="dr"><input type="checkbox" checked={o.valuePerSL != null} onChange={(e) => upd({ valuePerSL: e.target.checked ? { every: 1, amount: 1 } : undefined })} /> par DR</label>
                {o.valuePerSL != null && (
                  <>
                    <label className="dr">tous les<NumberField variant="nu" label="Palier en Degrés de Réussite" title="DR" min={1} value={o.valuePerSL.every ?? 1} onChange={(every) => upd({ valuePerSL: { ...o.valuePerSL, every } })} /> DR</label>
                    <label className="dr">+<NumberField variant="nu" label="quantité par palier" title="quantité par palier" value={o.valuePerSL.amount ?? 1} onChange={(amount) => upd({ valuePerSL: { ...o.valuePerSL, amount } })} /></label>
                    <label className="dr"><input type="checkbox" checked={!!o.valuePerSL.onFailure} onChange={(e) => upd({ valuePerSL: sansClesVides({ ...o.valuePerSL, onFailure: e.target.checked || undefined }) })} /> sur l'échec (niveau d'échec)</label>
                  </>
                )}
                {/* Se libérer (LDB 16 l.66 / Filets, Zoo Impérial p.29) — escapeStrength (Test opposé) et
                    escapeThreshold (Test à seuil) sont MUTUELLEMENT EXCLUSIFS (cf. resolveRecoverTest). */}
                <label className="dr"><input type="checkbox" checked={o.escapeStrength != null} onChange={(e) => upd({ escapeStrength: e.target.checked ? { charOf: 'force' } : undefined, escapeThreshold: e.target.checked ? undefined : o.escapeThreshold })} /> Force d'évasion (opposée)</label>
                {o.escapeStrength != null && <FormulaField label="Force" value={o.escapeStrength} min={0} onChange={(escapeStrength) => upd({ escapeStrength, escapeThreshold: undefined })} />}
                <label className="dr"><input type="checkbox" checked={o.escapeThreshold != null} onChange={(e) => upd({ escapeThreshold: e.target.checked ? 3 : undefined, escapeStrength: e.target.checked ? undefined : o.escapeStrength })} /> Seuil de DR (Test non opposé)</label>
                {o.escapeThreshold != null && <FormulaField label="Seuil (DR)" value={o.escapeThreshold} min={0} onChange={(escapeThreshold) => upd({ escapeThreshold, escapeStrength: undefined })} />}
                <label className="dr"><input type="checkbox" checked={!!o.entangleOnFail} onChange={(e) => upd({ entangleOnFail: e.target.checked || undefined })} /> échec → +1 État (Filets, ZI 02 l.176)</label>
                <label className="dr"><input type="checkbox" checked={o.struggleDamage != null} onChange={(e) => upd({ struggleDamage: e.target.checked ? 1 : undefined })} /> Dégâts par tentative (ignore armure)</label>
                {o.struggleDamage != null && <FormulaField label="Dégâts" value={o.struggleDamage} min={0} onChange={(struggleDamage) => upd({ struggleDamage })} />}
                {/* Ce que la Détermination fait à l'État quand cette op le porte en PASSIF (LDB 17 l.61) :
                    DIT en donnée, jamais déduit du porteur. Inerte hors canal passif. */}
                <ResolveWindowField value={o.resolveWindow} onChange={(resolveWindow) => upd({ resolveWindow })} />
                {/* État PORTÉ (#1695, LDB 48 l.495) : cocher « porté » EFFACE les champs que le canal
                    passif ne transporte pas (même patron d'exclusivité que Force d'évasion / Seuil de DR
                    ci-dessus), depuis la MÊME liste close que le refus au parse (`CHAMPS_EXCLUS_DE_CARRIED`)
                    — la donnée ne peut donc pas naître dans la forme que `refusLoose` refuse. */}
                <label className="dr"><input type="checkbox" checked={!!o.carried} onChange={(e) => upd(e.target.checked
                  ? { carried: true, ...Object.fromEntries(CHAMPS_EXCLUS_DE_CARRIED.map((k) => [k, undefined])) }
                  : { carried: undefined })}
                /> porté par la source (durée du Sort)</label>
                {o.carried
                  ? <span className="dr">— la durée et le verrou de l’État sont ceux de l’effet actif de la source : il part avec elle.</span>
                  : (
                    <>
                      {/* Les trois échelles de durée PROPRE sont exclusives entre elles (JSDoc de l'op). */}
                      <label className="dr"><input type="checkbox" checked={o.durationRounds != null} onChange={(e) => upd({ durationRounds: e.target.checked ? 1 : undefined, durationMinutes: undefined, durationHours: undefined })} /> dure N Rounds</label>
                      {o.durationRounds != null && <FormulaField label="Durée (Rounds)" value={o.durationRounds} min={1} onChange={(durationRounds) => upd({ durationRounds })} />}
                      <label className="dr"><input type="checkbox" checked={o.durationMinutes != null} onChange={(e) => upd({ durationMinutes: e.target.checked ? 1 : undefined, durationRounds: undefined, durationHours: undefined })} /> dure N minutes</label>
                      {o.durationMinutes != null && <FormulaField label="Durée (minutes)" value={o.durationMinutes} min={1} onChange={(durationMinutes) => upd({ durationMinutes })} />}
                      <label className="dr"><input type="checkbox" checked={o.durationHours != null} onChange={(e) => upd({ durationHours: e.target.checked ? 1 : undefined, durationRounds: undefined, durationMinutes: undefined })} /> dure N heures</label>
                      {o.durationHours != null && <FormulaField label="Durée (heures)" value={o.durationHours} min={1} onChange={(durationHours) => upd({ durationHours })} />}
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
            <DureeRoundsField value={o.durationRounds} onChange={(durationRounds) => upd({ durationRounds })} />
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
            <RefField cfg={{ ds: 'traits', single: true }} fieldKey="Trait" value={o.traitId ?? ''} onChange={(v) => upd({ traitId: (v as string) ?? '' })} />
            {/* `arg` = l'argument IMPRIMÉ du Trait (Haine (Skavens)) — prose d'authoring, hors registre. */}
            <input placeholder="argument (ex. Skavens)" value={o.arg ?? ''} onChange={(e) => upd({ arg: e.target.value || undefined })} />
            <label className="dr"><input type="checkbox" checked={o.indice != null} onChange={(e) => upd({ indice: e.target.checked ? 1 : undefined })} /> Indice</label>
            {o.indice != null && <FormulaField label="Valeur" value={o.indice} min={0} onChange={(indice) => upd({ indice })} />}
          </>
        )}
        {op.op === 'domeWard' && (
          <>
            {/* AUCUN champ de zone : la ZdE du Dôme se règle dans la CIBLE du sort (un seul endroit). */}
            <RefField cfg={{ ds: 'traits', single: true }} fieldKey="Trait" value={o.traitId ?? ''} onChange={(v) => upd({ traitId: (v as string) ?? '' })} />
            <FormulaField label="Indice" value={o.indice ?? 1} min={1} onChange={(indice) => upd({ indice })} />
          </>
        )}
        {op.op === 'grantTalent' && (
          <RefField cfg={{ ds: 'talents', single: true, spec: true }} fieldKey="Talent"
            value={{ id: o.talentId ?? '', spec: o.spec }}
            onChange={(v) => { const r = typeof v === 'string' ? { id: v } : (v as { id: string; spec?: string }); upd({ talentId: r.id, spec: r.spec }); }} />
        )}
        {op.op === 'grantNaturalWeapon' && (
          <>
            <input placeholder="Arme (ex. Morsure, Griffes)" value={o.label ?? ''} onChange={(e) => upd({ label: e.target.value })} />
            <FormulaField label="Dégâts" value={o.damage} min={0} onChange={(damage) => upd({ damage })} />
            <label className="dr"><input type="checkbox" checked={o.plusBF !== false} onChange={(e) => upd({ plusBF: e.target.checked })} /> BF+</label>
            <input placeholder="Qualités (Magique…)" value={(o.qualities ?? []).join(', ')}
              onChange={(e) => { const a = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean); upd({ qualities: a.length ? a : undefined }); }} />
          </>
        )}
        {op.op === 'summon' && (
          <>
            <RefField cfg={{ ds: 'creatures', single: true }} fieldKey="Créature" value={o.ref ?? ''} onChange={(v) => upd({ ref: (v as string) ?? '' })} />
            <FormulaField label="Nombre" value={o.count ?? 1} min={1} onChange={(count) => upd({ count })} />
            <label className="dr">Taille
              <select value={o.size ?? ''} onChange={(e) => upd({ size: e.target.value || undefined })}>
                <option value="">— d’origine —</option>
                {SIZES.map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}
              </select>
            </label>
            <input placeholder="Traits ajoutés (ex. Frénésie, Magique)" value={(o.addTraits ?? []).map(formatTrait).join(', ')}
              onChange={(e) => { const a = e.target.value.split(',').map((t: string) => t.trim()).filter(Boolean).map(parseTraitInstance); upd({ addTraits: a.length ? a : undefined }); }} />
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
          <FormulaField label="Distance (m)" value={o.meters} min={0} onChange={(meters) => upd({ meters })} />
        )}
        {op.op === 'chain' && (
          <>
            <FormulaField label="Rebonds max" value={o.maxBounces} min={0} onChange={(maxBounces) => upd({ maxBounces })} />
            <FormulaField label="Saut (m)" value={o.hopMeters} min={0} onChange={(hopMeters) => upd({ hopMeters })} />
          </>
        )}
        {op.op === 'teleport' && (
          <>
            <FormulaField label="Distance (m)" value={o.meters} min={0} onChange={(meters) => upd({ meters })} />
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
          <textarea placeholder="Texte journalisé (arbitrage MJ)" value={o.text ?? ''} onChange={(e) => upd({ text: e.target.value })} />
        )}
        {op.op === 'armourPierce' && (
          <>
            <label className="dr">PA retirés (plat)<NumberField variant="nu" label="Points d’Armure retirés" min={0} value={o.amount ?? 1} onChange={(amount) => upd({ amount })} /></label>
            <label className="dr">Matériau ignoré
              <select value={o.bypass ?? ''} onChange={(e) => upd({ bypass: (e.target.value || undefined) as ArmourBypass | undefined })}>
                <option value="">— aucun —</option>
                <option value="nonMetal">Non-métal (Perforante, LDB 62 l.270)</option>
                <option value="metal">Métal</option>
                <option value="leather">Cuir</option>
                <option value="nonMagic">Non-magique</option>
                <option value="all">Toute l'armure</option>
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
                    <option value="d10">1d10</option>
                    <option value="d100">1d100</option>
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
  );
}

export function GameOpEditor({ ops, onChange }: { ops: GameOp[]; onChange: (ops: GameOp[]) => void }) {
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= ops.length) return;
    const next = [...ops];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="eff-list">
      {ops.map((o, i) => (
        <details className="eff-row" key={i}>
          <summary>
            <span className="eff-summary"><Icon id={OP_ICON[o.op] ?? 'journal/detail'} size="sm" /> {opSummary(o)}</span>
            {opsMissingRefs(o).length > 0 && <span className="de-warn">{opsMissingRefs(o).join(' · ')}</span>}
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === ops.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer l'op" onClick={() => onChange(ops.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          <OpFields op={o} onChange={(no) => onChange(ops.map((x, j) => (j === i ? no : x)))} />
        </details>
      ))}
      <AddMenu
        label="+ Op mécanique"
        groups={pickable(OP_MENU_GROUPS, (key) => onChange([...ops, newOp(key)]))}
      />
    </div>
  );
}
