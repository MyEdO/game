/**
 * Réfs de registre du vocabulaire `GameOp` — libellé de chaque op (`OP_LABEL`) et champs-réfs
 * (`OP_REF_FIELDS`) avec leurs mesures PURES, partagés par l'atelier, son résumeur et le Codex.
 */
import type { GameOp } from '../../engine/ops';
import type { DatasetKey } from '../../data/overrides';

/** Libellé court (texte SEUL, sert aussi de `<option>` natif) de CHAQUE op du vocabulaire `GameOp` —
 *  `Record` TOTAL (TS force sa complétude) : source runtime de l'énumération des kinds pour les
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
  castWard: 'Aura anti-Sort (Langue)',
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
  grantTalent: [{ field: 'talent.id', ds: 'talents', label: 'Talent', required: true }],
  grantCareerTalent: [{ field: 'talent.id', ds: 'talents', label: 'Talent', required: true }],
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
