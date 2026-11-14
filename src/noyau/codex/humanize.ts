/**
 * REGISTRE JOUEUR — traduit les structures de LOGIQUE authorée (`Flow`/`Condition`/`GameOp`/`Formula`)
 * en phrases FRANÇAISES NATURELLES lisibles par un joueur qui ne connaît PAS le moteur. Pendant JOUEUR du
 * registre d'ATELIER (`flowSummary`/`condSummary`/`opSummary`, éditeur) : là où l'atelier crache la forme
 * technique (« si … → … », « NON( … ) », ids bruts), ce module rend « Les ennemis touchés s'embrasent,
 * sauf les lanceurs du Domaine du Feu ».
 *
 * Le vocabulaire des 4 algèbres est FINI (`Flow` 5 kinds, `Condition` ~24 kinds, `GameOp` ~96 kinds,
 * `Formula` 10 formes) → le renderer est MÉCANIQUE : chaque switch est EXHAUSTIF (garde `assertNever` en
 * default — un kind futur force une phrase humaine à la compilation, jamais de repli silencieux vers
 * l'atelier). Zéro id brut à l'écran : toute réf (État, Talent, Trait, Groupe, Caractéristique, Maladie,
 * arme…) est résolue en libellé via les résolveurs canoniques (`conditionLabel`/`refLabel`/`CHAR_LABELS`/
 * `charAbr`/`traitLabelById`/`groupLabel`/`psychologyLabel`/`symptomLabel`/`creatureLabel`), jamais une
 * table id→label parallèle. PUR (structure → string) — testable sans DOM.
 */
import type { Flow } from '../../data/schemas/defs-scenes/effets';
import type { Condition, EffectOp, PartySelector } from '../../engine/flowCore';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { contexteDeTestSchema } from '../../data/schemas/grammaire/valeurs';
import {
  armourBypassCategorieSchema,
  loseTurnWhatSchema,
  ressourceDeDestinSchema,
  senseSchema,
  tablesDeCiblesSchema,
  zoneShapeSchema,
} from '../../data/schemas/grammaire/mecanique';
import { INDICE_TEMPLATE, seuilDeBourse, type ActorRef, type CompareOp, type CompareSubject } from '../../engine/flowCore';
import { estCausePersistante, estPoseDEtat, type GameOp, type Formula, type FormuleSansTirage, type ResolveWindow } from '../../engine/ops';
import type { Camp, Relation } from '../../engine/relations';
import { CHAR_LABELS, DIFFICULTY_LABELS, HIT_LOCATION_LABELS, type CharKey, type ArmourBypass } from '../../engine/types';
import { formatWardSave, traitLabelById, traitLisible } from '../../engine/traits/dispatch';
import { giveTrappingLabel } from '../../engine/items';
import { traumaLabelOf } from '../../engine/trauma';
import { cibleDeRef, libelleDePsy } from '../../engine/psych/ciblage';
import { libelleDuTraitOctroye } from '../../engine/psych/opsPsy';
import { formatMoney, fromBrass } from '../../engine/money';
import { formatDice, formatEffetSigne } from '../../engine/dice';
import { seaWeatherLabel } from '../../engine/seaWeather';
import { shipLocationLabel } from '../../engine/shipCritical';
import { findSeaHazard, findWhirlpool } from '../../engine/seaPerils';
import { rule, ruleDef } from '../../engine/policy';
import {
  conditionLabel, psychologyLabel, groupLabel, symptomLabel, creatureLabel,
  diseaseLabel, refLabel, qualityRefLabel, testSkillLabel,
} from '../../data';
import { findFallTable } from '../../data/shipCriticals';
import { effectTableDie, findEffectTableById } from '../../data/effectTables';
import { deDeTirageDe } from '../../data/rangees';
import { facesDuDe, fourchette } from '../../engine/tables';
import { deElide, t, type MsgKey } from '../../i18n';
import type { EtatDeclare } from '../../data/schemas/defs-scenes/formes-d-etat';
import { libelleDEtat } from './libellesNarratifs';

function assertNever(x: never): never {
  throw new Error(`humanize: cas non couvert — ${JSON.stringify(x)}`);
}

/** Nom d'affichage d'un État nommé, en *italique* (convention des desc : `*Hémorragique*`). */
const stateItal = (id: string): string => `*${conditionLabel(id)}*`;
const whoLabel = (w: ActorRef): string => t(w === 'caster' ? 'codex.qui.lanceur' : 'codex.qui.cible');

/** Libellés JOUEUR d'un camp / d'une relation (enum FERMÉ, pas un id de registre) — pendant naturel des
 *  libellés d'atelier (« adversaire (camp ≠) »). */
const REL_PLAYER: Record<Relation | Camp, string> = {
  soi: 'lui-même', allie: 'un allié', adversaire: 'un adversaire',
  groupe: 'un membre du groupe', neutre: 'un neutre', hostile: 'un ennemi',
};

// ---------------------------------------------------------------------------
// Formule
// ---------------------------------------------------------------------------

/** Quantité (`Formula`) en toutes lettres — « le Bonus de Force Mentale », « 1d10+2 », « le résultat du dé ».
 *  Une règle optionnelle NUMÉRIQUE (`kind: 'param'`) s'y lit à sa VALEUR courante, la règle nommée :
 *  le joueur lit une quantité, pas une indirection. */
export function humanizeFormula(f: Formula): string {
  return formuleEnMots(f, null);
}

/** Le Trait OCTROYÉ (`grantTrait`) lisible : `traitLisible` de sa pose, un Indice formulé rendu par `formule`
 *  (omis sans elle), une Cible tirée par la table qui la tire. SEUL rendu d'un octroi : Codex, résumé
 *  d'éditeur, puces. */
export function traitOctroyeLisible(o: Extract<GameOp, { op: 'grantTrait' }>, formule?: (f: FormuleSansTirage) => string): string {
  const { value, ...pose } = o.trait;
  const nombre = typeof value === 'number';
  const indice = value === undefined || nombre || !formule ? '' : ` ${formule(value)}`;
  const table = o.cible && libelleDeValeur(tablesDeCiblesSchema, o.cible.table.id);
  const cible = o.cible ? ` ${t(o.cible.pick > 1 ? 'codex.trait.cibleTireeFois' : 'codex.trait.cibleTiree', { table: table!, pick: o.cible.pick })}` : '';
  return `${traitLisible(nombre ? { ...pose, value } : pose)}${indice}${cible}`;
}

/** Les rangées d'une table en ligne (`rollTable.entries`) : chaque bande au dé de la table, puis ses ops. */
function rangeesLisibles(o: Extract<GameOp, { op: 'rollTable'; entries: unknown }>): string {
  const faces = facesDuDe(deDeTirageDe(o));
  return t('codex.op.jetSurTable.rangees', {
    rangees: o.entries.map((r) => `${fourchette(r.min, r.max, faces)} : ${r.ops.length ? r.ops.map(humanizeOp).join(', ') : t('codex.op.jetSurTable.rien')}`).join(' ; '),
  });
}

/** « de » + une formule humanisée, AVEC la contraction française : `de le` → `du`, `de les` → `des`
 *  (`de la`/`de l'` restent). Une formule se NOMME (« le Bonus de Force Mentale », « la Sociabilité ») :
 *  la coller derrière un « de » nu rendait « dans un rayon de le Bonus… ». SITE UNIQUE de cette
 *  contraction — toute phrase qui pose une quantité derrière « de » passe par ici. PURE. */
export function deFormule(f: Formula): string {
  const mots = humanizeFormula(f);
  if (mots.startsWith('le ')) return t('codex.de.le', { reste: mots.slice(3) });
  if (mots.startsWith('les ')) return t('codex.de.les', { reste: mots.slice(4) });
  return t('codex.de', { mots });
}

/** Accord réel singulier/pluriel d'un compte — `Formula` non littérale (dé, bonus…) accorde au
 *  pluriel (jamais garanti « un » à l'affichage). Jamais le pluriel-code « (s) ». */
export const plural = (n: unknown, singular: string, pluralForm: string): string => (n === 1 ? singular : pluralForm);

/** DURÉE PROPRE d'une op à trois échelles exclusives (`condition`, `charMod` — `durationFromOp`,
 *  engine/ops) : « 3 heures », « 1 minute », « 2 Rounds » ; `undefined` sans durée propre (celle du
 *  contexte). SOURCE UNIQUE de la pastille (`opRows`) et du résumé d'atelier (`opSummary`). */
export function dureePropre(o: { durationRounds?: Formula; durationMinutes?: Formula; durationHours?: Formula; durationDays?: Formula }): string | undefined {
  const echelle = (f: Formula | undefined, un: MsgKey, plusieurs: MsgKey) => (f != null ? `${humanizeFormula(f)} ${plural(f, t(un), t(plusieurs))}` : undefined);
  return echelle(o.durationRounds, 'codex.unite.round', 'codex.unite.rounds') ?? echelle(o.durationMinutes, 'codex.unite.minute', 'codex.unite.minutes') ?? echelle(o.durationHours, 'codex.unite.heure', 'codex.unite.heures') ?? echelle(o.durationDays, 'codex.unite.jour', 'codex.unite.jours');
}

/** PLANCHER d'un `charMod` (EDO 11 l.190) : « min 10 », `undefined` sans plancher. SOURCE UNIQUE de la
 *  pastille (`opRows`) et du résumé d'atelier (`opSummary`). */
export const plancher = (o: { min?: number }): string | undefined => (o.min != null ? t('codex.plancher', { min: o.min }) : undefined);

/** Fragment « pendant <durée propre> » d'une op qui en porte une (`dureePropre`) — vide si l'op n'en
 *  porte pas (elle prend alors celle du contexte). La borne d'une entrée s'y dit d'elle-même
 *  (« … (minimum de 1) », AA 07 l.113 / LDB 18 l.88). */
const pendant = (o: Parameters<typeof dureePropre>[0]): string => {
  const duree = dureePropre(o);
  return duree ? ` ${t('codex.pendant', { duree })}` : '';
};

/** La MÊME quantité, mais la note de règle SORTIE du nombre — pour les phrases où une UNITÉ suit le
 *  nombre (« 12 sou(s) de cuivre », « 5 minute(s) ») : la note se pose APRÈS l'unité, jamais entre. */
export function humanizeQuantite(f: Formula): { valeur: string; note: string } {
  const regles: string[] = [];
  const valeur = formuleEnMots(f, regles);
  const note = regles.length
    ? ` ${t(regles.length > 1 ? 'codex.note.regles' : 'codex.note.regle', { regles: regles.map((nom) => t('codex.guillemets', { nom })).join(', ') })}`
    : '';
  return { valeur, note };
}

/** Traversal UNIQUE des deux rendus. `regles` non nul = les règles numériques rencontrées y sont
 *  COLLECTÉES (le nombre s'imprime nu) ; nul = chacune se nomme sur place. PURE. */
function formuleEnMots(f: Formula, regles: string[] | null): string {
  if (typeof f === 'number') return String(f);
  // Placeholder RUNTIME baké (`INDICE_TEMPLATE` — Redoutable ZI, substitué à l'attache) qui peut atteindre
  // l'affichage : jamais un objet Formula, donc gardé AVANT les `in` (mirroir de `resolveFormula`).
  if (typeof f !== 'object' || f === null) return String(f) === INDICE_TEMPLATE ? t('codex.f.indice') : String(f);
  if ('bonusOf' in f) return t('codex.f.bonusOf', { car: CHAR_LABELS[f.bonusOf] });
  if ('charOf' in f) return t('codex.f.charOf', { car: CHAR_LABELS[f.charOf] });
  if ('dice' in f) return formatDice(f.dice);
  if ('rolled' in f) return t('codex.f.rolled');
  if ('indiceOf' in f) return t('codex.f.indiceOf');
  if ('stacks' in f) return t('codex.f.stacks');
  if ('engagedAdvantageGap' in f) return t('codex.f.engagedAdvantageGap');
  if ('woundsDealt' in f) return t('codex.f.woundsDealt');
  if ('blessuresMax' in f) return t('codex.f.blessuresMax');
  if ('tailleDuNavire' in f) return t('codex.f.tailleDuNavire');
  if ('valeurCargaison' in f) return t('codex.f.valeurCargaison');
  if ('sl' in f) return t('codex.f.sl');
  if ('tire' in f) return f.de === undefined ? t('codex.f.tire', { nom: f.tire }) : t('codex.f.tire.de', { de: formuleEnMots(f.de, regles), nom: f.tire });
  // Les formes NON numériques (`flag`/`mode`) n'ont pas de nombre à montrer : elles se nomment, quel que
  // soit le rendu demandé. Un id hors du registre (brouillon d'éditeur) se nomme par son id : `ruleDef` le
  // lit avant `rule()`, qui lève (#1463 LD.1).
  if ('rule' in f) {
    const def = ruleDef(f.rule);
    const valeur = def?.kind === 'param' ? rule(f.rule) : undefined;
    if (def?.kind !== 'param' || typeof valeur !== 'number') return t('codex.f.regle', { regle: def?.label ?? f.rule });
    if (regles) {
      if (!regles.includes(def.label)) regles.push(def.label);
      return String(valeur);
    }
    return t('codex.f.regleValeur', { valeur, regle: def.label });
  }
  if ('minimum' in f) return t('codex.f.minimum', { valeur: formuleEnMots(f.of, regles), min: f.minimum });
  if ('parTranche' in f) return t('codex.f.parTranche', { tranche: f.parTranche, valeur: formuleEnMots(f.of, regles) });
  if ('sum' in f) return f.sum.map((t) => formuleEnMots(t, regles)).join(' + ');
  // Le FACTEUR est une `Formula` comme le multiplicande (`formulaSchema`, grammaire/valeurs.ts) :
  // il s'humanise, il ne s'interpole pas — sans quoi « × {sl:true} » s'imprime « × [object Object] ».
  if ('times' in f) return `${formuleEnMots(f.times.of, regles)} × ${formuleEnMots(f.times.factor, regles)}`;
  return assertNever(f);
}

/** La quantité est-elle un DÉBIT ? Un littéral négatif, ou un produit dont le nombre de facteurs
 *  négatifs est impair. Sert aux ops à DOUBLE SENS (`money`) : le sens se DIT (« perd »), il ne
 *  s'imprime pas en « × -1 » à l'écran. PURE. */
function estDebit(f: Formula): boolean {
  if (typeof f === 'number') return f < 0;
  if (typeof f !== 'object' || f === null) return false;
  if ('times' in f) return estDebit(f.times.of) !== estDebit(f.times.factor);
  return false;
}

/** La MÊME quantité, privée de son signe et de ses facteurs unitaires — ce qu'on imprime une fois le
 *  sens dit par ailleurs (« perd LA RÈGLE … », jamais « perd LA RÈGLE … × -1 »). PURE. */
function sansSigne(f: Formula): Formula {
  if (typeof f === 'number') return Math.abs(f);
  if (typeof f !== 'object' || f === null || !('times' in f)) return f;
  const { of, factor } = f.times;
  if (typeof factor === 'number' && Math.abs(factor) === 1) return sansSigne(of);
  if (typeof of === 'number' && Math.abs(of) === 1) return sansSigne(factor);
  return { times: { of: sansSigne(of), factor: sansSigne(factor) } };
}

// ---------------------------------------------------------------------------
// Condition
// ---------------------------------------------------------------------------

/** Comparateur en toutes lettres (`neg` inverse l'opérateur, De Morgan pour une négation naturelle). */
function opWord(op: CompareOp, neg: boolean): string {
  const table: Record<CompareOp, string> = {
    '>=': 'est au moins', '<=': 'est au plus', '==': 'égale', '<': 'est inférieur à', '>': 'est supérieur à',
  };
  const negTable: Record<CompareOp, string> = {
    '>=': 'est inférieur à', '<=': 'est supérieur à', '==': 'ne vaut pas', '<': 'est au moins', '>': 'est au plus',
  };
  return neg ? negTable[op] : table[op];
}

/** Nom du membre d'une comparaison (donnée fixe / valeur d'État / Caractéristique) rattaché à son acteur. */
function subjectNoun(s: CompareSubject): string {
  const who = whoLabel(s.who);
  if ('condition' in s) return t('codex.sujet.etats', { etat: stateItal(s.condition), qui: who });
  if ('characteristic' in s) return t(s.bonus ? 'codex.sujet.bonus' : 'codex.sujet.car', { car: CHAR_LABELS[s.characteristic], qui: who });
  const FIELD: Record<typeof s.field, string> = {
    woundsCurrent: 'les PB', woundsMax: 'les PB maximum', size: 'la Taille', advantage: "l'Avantage",
  } as Record<typeof s.field, string>;
  return t('codex.sujet.champ', { champ: FIELD[s.field], qui: who });
}

/** Comparaison NATURELLE — cas privilégié « porte / ne porte pas l'État X » quand le sujet est un État. */
function comparePhrase(c: Extract<Condition, { kind: 'compare' }>, neg: boolean): string {
  const who = whoLabel(c.subject.who);
  if ('condition' in c.subject && typeof c.value === 'number') {
    const holds = (c.op === '>=' || c.op === '>') && c.value >= 1;
    const absent = (c.op === '==' && c.value === 0) || (c.op === '<' && c.value <= 1);
    if (holds || absent) {
      const carries = holds !== neg; // « porte » vrai si (seuil de présence) XOR négation
      return t(carries ? 'codex.cmp.porte' : 'codex.cmp.nePortePas', { qui: who, etat: stateItal(c.subject.condition) });
    }
  }
  const rhs = typeof c.value === 'number' ? String(c.value) : subjectNoun(c.value);
  return `${subjectNoun(c.subject)} ${opWord(c.op, neg)} ${rhs}`;
}

/** Fenêtre horaire lisible (« entre 06:00 et 18:00 »). */
function timePhrase(w: { afterHour?: number; afterMinute?: number; beforeHour?: number; beforeMinute?: number }): string {
  const pad = (n?: number) => String(n ?? 0).padStart(2, '0');
  const a = w.afterHour != null ? `${pad(w.afterHour)}:${pad(w.afterMinute)}` : null;
  const b = w.beforeHour != null ? `${pad(w.beforeHour)}:${pad(w.beforeMinute)}` : null;
  return a && b ? t('codex.heure.entre', { a, b }) : a ? t('codex.heure.apres', { a }) : b ? t('codex.heure.avant', { b }) : t('codex.heure.toute');
}

/** Sujets d'acteur (`whoLabel`) susceptibles de se répéter en tête de clauses conjointes. */
const clauseSubjects = (): string[] => [whoLabel('caster'), whoLabel('target')];

/** Dédoublonne le sujet répété en tête de clauses jointes : « la cible est un adversaire ET la cible ne
 *  possède pas … » → « … ET ne possède pas … ». Ne retire le sujet que si la clause ET sa précédente
 *  partagent EXACTEMENT le même sujet en tête (sûreté grammaticale : sinon on conserve le sujet). */
function dedupSubjects(parts: string[]): string[] {
  return parts.map((p, i) => {
    if (i === 0) return p;
    const subj = clauseSubjects().find((s) => p.startsWith(`${s} `) && parts[i - 1].startsWith(`${s} `));
    return subj ? p.slice(subj.length + 1) : p;
  });
}

/** Condition en clause NATURELLE. `neg` porte la négation (poussée dans la feuille — « ne possède pas … »,
 *  De Morgan sur `all`/`any` — au lieu d'un « NON( … ) » d'atelier). SOURCE UNIQUE joueur des Conditions.
 *  `etats` : les états de campagne qui libellent `etat` et `who: { etat }` (#2539), fournis par l'appelant. */
export function humanizeCondition(c: Condition, etats: readonly EtatDeclare[], neg = false): string {
  const who = (r: ActorRef) => whoLabel(r);
  const sujetDuGroupe = (w: PartySelector | undefined): string =>
    w === 'all' ? t('codex.groupe.tous') : typeof w === 'object' ? t('codex.groupe.designe', { etat: libelleDEtat(etats, w.etat) }) : t('codex.groupe.un');
  switch (c.kind) {
    case 'always': return t(neg ? 'codex.c.jamais' : 'codex.c.toujours');
    case 'flag': return t(neg ? 'codex.c.flag.non' : 'codex.c.flag', { expr: c.expr });
    case 'time': return neg ? t('codex.c.time.non', { creneau: timePhrase(c.window) }) : timePhrase(c.window);
    case 'hasItem': {
      const label = c.trappingId || '?';
      return `${t(neg ? 'codex.c.hasItem.non' : 'codex.c.hasItem', { objet: label })}${c.count && c.count > 1 ? ` (×${c.count})` : ''}`;
    }
    case 'money': {
      const seuil = seuilDeBourse(c.atLeast);
      const montant = 'lie' in seuil
        ? t('codex.f.tire', { nom: seuil.lie })
        : formatMoney({ gold: seuil.montant.gold ?? 0, silver: seuil.montant.silver ?? 0, brass: seuil.montant.brass ?? 0 });
      return t(neg ? 'codex.c.money.non' : 'codex.c.money', { montant });
    }
    case 'partyDead': {
      if (!neg) return t('codex.c.partyDead', { sujet: sujetDuGroupe(c.who) });
      return c.who === 'all' ? t('codex.c.partyDead.nonTous') : c.who === 'any' ? t('codex.c.partyDead.nonAucun') : t('codex.c.partyDead.non', { sujet: sujetDuGroupe(c.who) });
    }
    case 'etat': {
      const nom = libelleDEtat(etats, c.etat);
      return c.value === undefined
        ? t(neg ? 'codex.c.etat.defini.non' : 'codex.c.etat.defini', { nom })
        : t(neg ? 'codex.c.etat.vaut.non' : 'codex.c.etat.vaut', { nom, valeur: libelleDEtat(etats, c.etat, c.value) });
    }
    case 'compare': return comparePhrase(c, neg);
    case 'slThreshold': return t('codex.c.slThreshold', { op: opWord(c.op, neg), valeur: c.value });
    case 'location': return t(neg ? 'codex.c.location.non' : 'codex.c.location', { loc: HIT_LOCATION_LABELS[c.is] });
    case 'attackKind': return t(neg ? 'codex.c.attackKind.non' : 'codex.c.attackKind', { type: c.is });
    case 'startleCause': return t(neg ? 'codex.c.startleCause.non' : 'codex.c.startleCause', { cause: t(c.is === 'noise' ? 'codex.c.startleCause.bruit' : 'codex.c.startleCause.magie') });
    case 'woundsDealt': return t('codex.c.woundsDealt', { op: opWord(c.op, neg), valeur: c.value });
    case 'engagedAdvantageGap': return t('codex.c.engagedAdvantageGap', { op: opWord(c.op, neg), valeur: c.value });
    case 'engagedAdvantageLead': return t('codex.c.engagedAdvantageLead', { op: opWord(c.op, neg), valeur: c.value });
    case 'foeInLoS': return t(neg ? 'codex.c.foeInLoS.non' : 'codex.c.foeInLoS');
    case 'cibleEnVue': return t(neg
      ? (c.hostiles ? 'codex.c.cibleEnVue.hostile.non' : 'codex.c.cibleEnVue.non')
      : (c.hostiles ? 'codex.c.cibleEnVue.hostile' : 'codex.c.cibleEnVue'));
    case 'hiddenFromFoes': return t(neg ? 'codex.c.hiddenFromFoes.non' : 'codex.c.hiddenFromFoes');
    case 'engaged': return t(neg ? 'codex.c.engaged.non' : 'codex.c.engaged');
    case 'crewTest': return t(neg ? 'codex.c.crewTest.non' : 'codex.c.crewTest');
    case 'roundDeCombat': return t(neg ? 'codex.c.roundDeCombat.non' : 'codex.c.roundDeCombat');
    case 'nearestFoe': return t('codex.c.nearestFoe', { op: opWord(c.op, neg), valeur: c.value });
    case 'capability': return `${t(neg ? 'codex.c.capability.non' : 'codex.c.capability', { qui: who(c.who), id: c.id })}${c.value != null ? ` (${c.op ?? '>='} ${c.value})` : ''}`;
    case 'relation': return t(neg ? 'codex.c.relation.non' : 'codex.c.relation', { qui: who(c.who), rel: REL_PLAYER[c.is] });
    case 'has': {
      const qui = who(c.who);
      if (c.what === 'talent') return t(neg ? 'codex.c.has.talent.non' : 'codex.c.has.talent', { qui, nom: refLabel('talents', { id: c.value, spec: c.spec }) });
      if (c.what === 'trait') return t(neg ? 'codex.c.has.trait.non' : 'codex.c.has.trait', { qui, nom: traitLabelById(c.value) });
      if (c.what === 'psych') return t(neg ? 'codex.c.has.psych.non' : 'codex.c.has.psych', { qui, nom: psychologyLabel(c.value) });
      if (c.what === 'immunity') return t(neg ? 'codex.c.has.immunity.non' : 'codex.c.has.immunity', { qui, nom: refLabel('damageTypes', { id: c.value }) });
      return t(neg ? 'codex.c.has.group.non' : 'codex.c.has.group', { qui, nom: groupLabel(c.value) });
    }
    case 'casterChaosDomain': return t(neg ? 'codex.c.casterChaosDomain.non' : 'codex.c.casterChaosDomain', { dieu: refLabel('gods', { id: c.is }) });
    case 'visiblePassive': return t(neg ? 'codex.c.visiblePassive.non' : 'codex.c.visiblePassive', { qui: who(c.who) });
    case 'skill': {
      const sujet = sujetDuGroupe(c.who);
      return `${t(neg ? 'codex.c.skill.non' : 'codex.c.skill', { sujet, nom: refLabel('skills', { id: c.id, spec: c.spec }) })}${c.advances ? ` (≥${c.advances})` : ''}`;
    }
    case 'talent': return t(neg ? 'codex.c.talent.non' : 'codex.c.talent', { sujet: sujetDuGroupe(c.who), nom: refLabel('talents', { id: c.id, spec: c.spec }) });
    case 'career': return t(neg ? 'codex.c.career.non' : 'codex.c.career', { sujet: sujetDuGroupe(c.who), nom: refLabel('careers', { id: c.id }) });
    case 'species': return t(neg ? 'codex.c.species.non' : 'codex.c.species', { sujet: sujetDuGroupe(c.who), nom: refLabel('races', { id: c.id }) });
    case 'status': return t(neg ? 'codex.c.status.non' : 'codex.c.status', { sujet: sujetDuGroupe(c.who), statut: c.atLeast });
    // De Morgan : NON(A ET B) = (NON A) OU (NON B) ; NON(A OU B) = (NON A) ET (NON B).
    case 'all': return c.of.length ? dedupSubjects(c.of.map((x) => humanizeCondition(x, etats, neg))).join(t(neg ? 'codex.ou' : 'codex.et')) : t(neg ? 'codex.c.jamais' : 'codex.c.toujours');
    case 'any': return c.of.length ? dedupSubjects(c.of.map((x) => humanizeCondition(x, etats, neg))).join(t(neg ? 'codex.et' : 'codex.ou')) : t(neg ? 'codex.c.toujours' : 'codex.c.jamais');
    case 'not': return humanizeCondition(c.of, etats, !neg);
  }
  return assertNever(c);
}

// ---------------------------------------------------------------------------
// GameOp
// ---------------------------------------------------------------------------

const ATTR_LABEL = { wounds: 'Blessures', fortune: 'Chance', resolve: 'Détermination' } as const;
/** Libellé JOUEUR du volet matériau d'`armourPierce.bypass` (LDB 62 l.270) — `undefined`/nombre = pas de volet matériau. */
const armourBypassCatLabel = (b: ArmourBypass | undefined): string | undefined =>
  typeof b === 'string' ? libelleDeValeur(armourBypassCategorieSchema, b) : undefined;

/** ÉCHELLE « par DR » d'une quantité d'op (`PerSL`) en clair joueur — « +1 par DR d'échec » (Terreur,
 *  LDB 21 l.54), « +1 par 2 DR ». SOURCE UNIQUE de cette phrase : la chip d'une op qui la porte
 *  l'affiche AVANT le jet (la règle complète), le nombre RÉSOLU la remplace une fois le DR connu. */
export function humanizePerSL(p: { every: number; amount: number; onFailure?: boolean }): string {
  const pas = p.every > 1 ? `${p.every} DR` : 'DR';
  return t(p.onFailure ? 'codex.parDR.echec' : 'codex.parDR', { n: `${p.amount >= 0 ? '+' : '−'}${Math.abs(p.amount)}`, pas });
}

/** Effet mécanique (`GameOp`) en verbe d'action JOUEUR (sujet = la cible de l'effet, implicite). SOURCE
 *  UNIQUE joueur des ops. Switch EXHAUSTIF (never en default). */
/**
 * Phrase JOUEUR d'une CHUTE (op `fall`) — la hauteur vient de la TABLE, colonne par colonne : rien
 * n'est écrit en dur ici, une bande ou une station de plus s'y lit d'elle-même. Table inconnue de
 * l'authoring : son id RESTE visible (un libellé inventé masquerait l'erreur).
 */
function humanizeFall(tableId: string): string {
  const table = findFallTable(tableId);
  if (!table) return t('codex.chute.inconnue', { table: tableId });
  const stations = [...new Set(table.bandes.flatMap((b) => Object.keys(b.hauteurs)))];
  const colonnes = stations.map((id) => {
    const parBande = table.bandes.map((b) => {
      const hauteur = Object.entries(b.hauteurs).find(([station]) => station === id)?.[1];
      return hauteur === undefined ? '—' : humanizeFormula(hauteur);
    });
    return `${refLabel('shipStations', { id })} ${parBande.join('/')} m`;
  });
  return t('codex.chute', { table: table.label, colonnes: colonnes.join(', ') });
}

/** UN terme joueur pour la CAUSE PERSISTANTE (prédicat `estCausePersistante`, `engine/ops.ts`) : le
 *  même que le journal (`op.etatParRoundSauf`/`op.etatRegagne`). SOURCE UNIQUE de la formulation,
 *  composée par les trois lecteurs du Codex (`humanizeOp`, `opRows`, dialecte miscast de `registry`). */
export const causePersistante = (): string => t('codex.causePersistante');

/** MAGNITUDE d'un coût d'Avantage (`Flow` `choice.coutEnAvantage`) telle qu'un JOUEUR la lit. Un coût
 *  resté TEMPLATE (`INDICE_TEMPLATE`, substitué par `withArg` sur l'instance porteuse) se lit comme le
 *  livre l'imprime — `AA 08 l.87` « **Taillade (XA) :** … dépenser X Avantages ». SOURCE UNIQUE des deux
 *  lecteurs de Codex (`humanizeFlow`, `describe::flowSummary`) : un `$indice` ne doit jamais atteindre
 *  l'écran. `undefined` = pas de coût (l'appelant n'imprime alors rien). */
export function coutAvantageTexte(cost: number | typeof INDICE_TEMPLATE | undefined): string | undefined {
  if (cost == null) return undefined;
  return cost === INDICE_TEMPLATE ? 'X' : String(cost);
}

/** Un Flow VIDE (`sequence` sans étape, ici comme en donnée) ne se dit pas : « ; sinon » suivi de rien est du
 *  bruit. Prédicat PARTAGÉ par les deux lecteurs, sur la branche `non` d'un `choix` (renoncer = ne rien
 *  faire, la forme la plus courante en donnée). */
export function flowMuet(f: Flow | undefined): boolean {
  return !f || (f.kind === 'sequence' && f.etapes.length === 0);
}

/** Une rangée qui pose un État PUIS déclare la cause qui le maintient (`LDB 16 l.117`) l'écrit en DEUX
 *  ops ; elle se LIT en UNE chip — la pose littérale est ABSORBÉE par la cause, qui porte le terme et la
 *  durée. Pré-passe PARTAGÉE des deux lecteurs de LISTES d'ops (`opRows`, dialecte miscast de
 *  `registry`), sur la forme MINIMALE commune aux deux dialectes. */
export function replieCausesPersistantes<T extends { op?: unknown }>(ops: readonly T[]): T[] {
  const maintenus = new Set(ops.flatMap((o) => (estPoseDEtat(o) && estCausePersistante(o) ? [o.id.id] : [])));
  return ops.filter((o) => !estPoseDEtat(o) || estCausePersistante(o) || !maintenus.has(o.id.id));
}

/** L'effet d'une pénalité d'incantation, phrase du Codex : SOURCE UNIQUE de l'op `castPenalty` et de la
 *  rangée du dialecte miscast (`registry.ts`). */
export function effetDeContrecoup(o: { blocked?: boolean; maxZeroDR?: boolean; mod?: number }): string {
  return o.blocked ? t('codex.op.malusDIncantation.bloque') : o.maxZeroDR ? t('codex.op.malusDIncantation.priere') : t('codex.op.malusDIncantation', { mod: o.mod ?? 0 });
}

/** FENÊTRE de Détermination (`ResolveWindow`, `engine/ops`) de l'État qu'une op `condition` porte en
 *  PASSIF, telle qu'un JOUEUR la lit (`LDB 17 l.61`). `undefined` = rien à dire de plus que le défaut
 *  (la phrase ne se charge que d'une fenêtre AUTHORÉE). Une durée d'horloge tirée du registre des règles
 *  optionnelles se lit en MINUTES, la règle nommée entre parenthèses — jamais « la règle X minute(s) ». */
export function humanizeResolveWindow(w: ResolveWindow | undefined): string | undefined {
  if (w === undefined) return undefined;
  if (w === 'none') return t('codex.fenetre.none');
  if (w.scale === 'rounds') {
    return w.left === 1
      ? t('codex.fenetre.finDuRound')
      : t('codex.fenetre.suspend', { valeur: humanizeFormula(w.left), unite: plural(w.left, t('codex.unite.round'), t('codex.unite.rounds')) });
  }
  const { valeur, note } = humanizeQuantite(w.minutes);
  return `${t('codex.fenetre.suspend', { valeur, unite: plural(w.minutes, t('codex.unite.minute'), t('codex.unite.minutes')) })}${note}`;
}

/** Un montant d'op en sous de cuivre : la monnaie s'il est fixe, sa formule sinon. */
const montantEnSous = (brass: Formula): string =>
  typeof brass === 'number' ? formatMoney(fromBrass(brass)) : t('codex.op.argent.enSous', { valeur: humanizeQuantite(brass).valeur });

export function humanizeOp(o: GameOp): string {
  /** Signe affiché d'un modificateur : « + » devant un positif, le « - » du nombre sinon. */
  const signe = (n: number): string => `${n >= 0 ? '+' : ''}${n}`;
  switch (o.op) {
    case 'wounds': return `${t('codex.op.blessures', { n: humanizeFormula(o.amount) })}${o.ignoreAP === false ? '' : t('codex.op.blessures.ignorerLesPA')}${o.bypassArmour === 'metal' ? t('codex.op.blessures.metal') : o.bypassArmour === 'nonMagic' ? t('codex.op.blessures.nonMagique') : ''}`;
    case 'heal': return t('codex.op.soin', { n: humanizeFormula(o.amount) });
    case 'healCaster': return t('codex.op.soinDuLanceur', { n: humanizeFormula(o.amount) });
    case 'condition': {
      const perSL = o.valuePerSL ? ` (${humanizePerSL(o.valuePerSL)})` : '';
      const duree = pendant(o);
      const fenetre = humanizeResolveWindow(o.resolveWindow);
      const determination = fenetre ? ` — ${fenetre}` : '';
      if (estCausePersistante(o)) return t('codex.op.condition.persistante', { etat: stateItal(o.id.id), perSL, cause: causePersistante(), duree, determination });
      return t('codex.op.condition', {
        fois: o.value != null && o.value !== 1 ? `${humanizeFormula(o.value)} × ` : '',
        etat: stateItal(o.id.id), perSL, duree, parRound: o.perRound ? t('codex.op.condition.parRound') : '', determination,
      });
    }
    case 'removeCondition': return t('codex.op.perd', { quoi: `${o.id ? t('codex.op.etat', { etat: stateItal(o.id.id) }) : t('codex.op.etatAuChoix')}${o.valuePerSL ? ` (${humanizePerSL(o.valuePerSL)})` : ''}` });
    case 'endPsych': return 'instance' in o ? t('codex.op.finDePsychologie.instance') : t('codex.op.finDePsychologie', { nom: psychologyLabel(o.type.id) });
    case 'beginPsych': return t('codex.op.debutDePsychologie', { psy: libelleDePsy(o.type.id, o.cible && cibleDeRef(o.cible)), indice: o.indice != null ? ` ${humanizeFormula(o.indice)}` : '' });
    case 'charMod': return `${[t(o.mod >= 0 ? 'codex.op.modificateur.gagneEn' : 'codex.op.modificateur.subitEn', { mod: signe(o.mod), nom: CHAR_LABELS[o.characteristic] }), plancher(o)].filter(Boolean).join(', ')}${pendant(o)}`;
    case 'ap': return o.loc ? t('codex.op.pa.localisation', { n: humanizeFormula(o.amount), loc: HIT_LOCATION_LABELS[o.loc] }) : t('codex.op.pa', { n: humanizeFormula(o.amount) });
    case 'corruption': return t('codex.op.corruption', { n: signe(o.amount) });
    case 'sinMod': return t(o.amount >= 0 ? 'codex.op.peche.gagne' : 'codex.op.peche.perd', { n: Math.abs(o.amount) });
    case 'corruptionExposure': return t('codex.op.expositionALaCorruption');
    case 'gainResource': return `${t(o.amount >= 0 ? 'codex.op.gainDeRessource.gagne' : 'codex.op.gainDeRessource.perd', { n: Math.abs(o.amount), res: libelleDeValeur(ressourceDeDestinSchema, o.resource) })}${o.temporary ? t('codex.op.gainDeRessource.temporaire') : ''}`;
    case 'gainAdvantage': return t('codex.op.gainDAvantage', { n: humanizeFormula(o.amount) });
    case 'topUpAdvantage': return t('codex.op.avantagePlancher', { n: humanizeFormula(o.amount) });
    case 'castPenalty': return effetDeContrecoup(o);
    case 'money': {
      const debit = estDebit(o.montant.brass);
      const montant = debit ? sansSigne(o.montant.brass) : o.montant.brass;
      if (o.groupe && typeof montant === 'number') return t(debit ? 'codex.op.argent.groupe.perd' : 'codex.op.argent.groupe.gagne', { valeur: formatMoney(fromBrass(montant)) });
      const { valeur, note } = humanizeQuantite(montant);
      if (o.groupe) return `${t(debit ? 'codex.op.argent.groupe.perd' : 'codex.op.argent.groupe.gagne', { valeur: t('codex.op.argent.enSous', { valeur }) })}${note}`;
      return `${t(debit ? 'codex.op.argent.perd' : 'codex.op.argent.gagne', { valeur })}${note}`;
    }
    case 'statusMod': return t(typeof o.amount === 'number' && o.amount < 0 ? 'codex.op.statut.perd' : 'codex.op.statut.gagne', { n: humanizeFormula(o.amount) });
    case 'grantReverseToken': return t(o.illimite ? 'codex.op.jetonDInversion.illimite' : 'codex.op.jetonDInversion', {
      quoi: o.skill ? refLabel('skills', o.skill) : o.characteristic ? t('codex.op.jetonDInversion.car', { car: deElide(CHAR_LABELS[o.characteristic]) }) : t('codex.op.jetonDInversion.cible'),
      contexte: o.contexte ? ` ${libelleDeValeur(contexteDeTestSchema, o.contexte)}` : '',
    });
    case 'grantTrait': return t('codex.op.octroiDeTrait', { trait: traitOctroyeLisible(o, humanizeFormula), duree: pendant(o) });
    case 'removeTrait': return t('codex.op.retraitDeTrait', { trait: traitLisible(o.trait) });
    case 'grantPsychTrait': return `${t('codex.op.octroiDeTraitPsychologique', { nom: libelleDuTraitOctroye(o), duree: pendant(o) })}${o.resistanceSiAmis ? t('codex.op.octroiDeTraitPsychologique.amis') : ''}`;
    case 'removePsychTrait': return t('codex.op.perd', { quoi: o.psychType ? t('codex.op.psychologie', { nom: psychologyLabel(o.psychType.id) }) : t('codex.op.psychologieAuChoix') });
    case 'grantTalent': return t('codex.op.octroiDeTalent', { nom: refLabel('talents', o.talent) });
    case 'deitySkillMod': return t(o.pick === 'all' ? 'codex.op.competenceDeDivinite.toutes' : 'codex.op.competenceDeDivinite.une', { mod: `${o.mod >= 0 ? '+' : ''}${o.mod}`, duree: pendant(o) });
    case 'suppressTalents': return t('codex.op.suppressionDeTalents', { noms: o.talents.map((x) => refLabel('talents', x)).join(', '), duree: pendant(o) });
    case 'deityBan': return t('codex.op.interditDivin', { duree: pendant(o) });
    case 'prayerForAction': return t('codex.op.priereContreAction', { duree: pendant(o) });
    case 'grantCareerSkill': return t('codex.op.octroiDeCompetenceDeCarriere', { nom: refLabel('skills', o.skill) });
    case 'grantCareerTalent': return t('codex.op.octroiDeTalentDeCarriere', { nom: refLabel('talents', o.talent) });
    case 'augmentWeapon': return t('codex.op.armeAugmentee', {
      qualites: o.addQualities?.length ? ` (${o.addQualities.map((id) => qualityRefLabel({ id })).join(', ')})` : '',
      degats: o.damageBonus != null ? t('codex.op.armeAugmentee.degats', { n: humanizeFormula(o.damageBonus) }) : '',
    });
    case 'cureDisease': return t('codex.op.guerisonDeMaladie', { n: o.count ?? 1 });
    case 'reduceDiseaseDays': return t('codex.op.maladieAbregee', { maladie: o.disease ? diseaseLabel(o.disease) : t('codex.op.uneMaladie'), n: o.dice ? `${o.dice.n}d${o.dice.sides}` : (o.days ?? 1) });
    case 'preventInfection': return t('codex.op.preventionDInfection');
    case 'aideMedicale': return t('codex.op.aideMedicale');
    case 'exposeDisease': return t('codex.op.expositionAUneMaladie', { nom: diseaseLabel(o.disease) });
    case 'contractDisease': return t('codex.op.maladieContractee', { nom: diseaseLabel(o.disease) });
    case 'kill': return t('codex.op.mort');
    case 'cureCriticalWound': return t('codex.op.guerisonDeCritique', { n: o.count ?? 1 });
    case 'amputer': {
      // La QUANTITÉ de la ligne (« Perdez 1d10 dents », LDB 18 l.77) porte sur les séquelles cumulatives ;
      // `unitesPerSL` est l'échelle de DR (« plus un orteil par DR en dessous de 0 », l.180).
      return t('codex.op.amputer', {
        quantite: o.unites != null ? `${humanizeFormula(o.unites)} ` : '',
        sequelles: o.sequels.map((id) => traumaLabelOf(id)).join(t('codex.et')),
        echelle: o.unitesPerSL ? t('codex.op.amputer.parDR') : '',
      });
    }
    case 'reduceToZero': return t('codex.op.reductionAZero');
    case 'banish': return t('codex.op.bannissement');
    case 'ignoreStatePenalties': return o.count ? t('codex.op.ignorerLesMalusDEtat.pires', { n: o.count }) : t('codex.op.ignorerLesMalusDEtat');
    case 'freeReroll': return t('codex.op.relanceGratuite');
    case 'critTwice': return t('codex.op.critiqueDouble');
    case 'damageArmour': return t('codex.op.armureEndommagee');
    case 'damageWornGear': return t('codex.op.equipementEndommage');
    case 'suppressPsych': return t('codex.op.suppressionDePsychologie');
    case 'castWard': return t('codex.op.protectionContreLesSorts', { mod: `${o.mod >= 0 ? '+' : '−'}${Math.abs(o.mod)}`, rayon: deFormule(o.radius) });
    case 'suffocate': return t('codex.op.asphyxie');
    case 'arrowWard': return t('codex.op.protectionContreLesFleches');
    case 'domeWard': return t('codex.op.domeProtecteur', { trait: formatWardSave({ kind: 'trait', id: o.trait.id }, o.trait.value === undefined ? '?' : humanizeFormula(o.trait.value)) });
    case 'attackWardFM': return t('codex.op.protectionParFM');
    case 'martyr': return t('codex.op.martyr');
    case 'noBreath': return t('codex.op.sansSouffle');
    case 'noHunger': return t('codex.op.sansFaim');
    case 'ignoreAnimosity': return t('codex.op.ignorerLAnimosite');
    case 'testMod': return o.characteristic
      ? t(o.amount >= 0 ? 'codex.op.modificateurDeTest.car.gagne' : 'codex.op.modificateurDeTest.car.subit', { mod: signe(o.amount), car: CHAR_LABELS[o.characteristic] })
      : t(o.amount >= 0 ? 'codex.op.modificateurDeTest.gagne' : 'codex.op.modificateurDeTest.subit', { mod: signe(o.amount) });
    case 'weatherWard': return t('codex.op.protectionContreLaMeteo');
    case 'giveTrapping': return t('codex.op.remiseDObjet', { fois: o.count && o.count > 1 ? `${o.count}× ` : '', objet: giveTrappingLabel(o) });
    case 'grantWeapon': return t('codex.op.octroiDArme', { nom: o.label, bf: o.plusBF ? 'BF+' : '', degats: humanizeFormula(o.damage) });
    case 'grantNaturalWeapon': return t('codex.op.octroiDArmeNaturelle', { nom: o.label, bf: o.plusBF !== false ? 'BF+' : '', degats: humanizeFormula(o.damage) });
    case 'grantFreeAttack': return t('codex.op.attaqueGratuite');
    case 'interruptFocus': return t('codex.op.focalisationInterrompue');
    case 'breakBlade': return t('codex.op.lameBrisee');
    case 'push': return t('codex.op.poussee', { distance: deFormule(o.meters) });
    case 'teleport': return t('codex.op.teleportation', { n: humanizeFormula(o.meters) });
    case 'chain': return t('codex.op.chaine', { n: humanizeFormula(o.maxBounces), m: humanizeFormula(o.hopMeters) });
    case 'perRound': return t('codex.op.parRound', { ops: o.ops.map(humanizeOp).join(' ; ') });
    case 'rollThreshold': return t('codex.op.seuilDeJet', { faces: o.sides });
    case 'rollTable': return t('codex.op.jetSurTable', {
      table: 'tableId' in o ? t('codex.op.jetSurTable.table', { table: findEffectTableById(o.tableId).label }) : t('codex.op.jetSurTable.uneTable'),
      de: 'tableId' in o ? formatDice(effectTableDie(o.tableId)) : o.die,
      negatifs: o.addNegativeSL ? t('codex.op.jetSurTable.negatifs') : '',
      extra: o.extraRollsPerStep ? t('codex.op.jetSurTable.supplement', { n: o.extraRollsPerStep }) : '',
    }) + ('entries' in o ? rangeesLisibles(o) : '');
    case 'rollMutation': return t(o.duration === 'permanent' ? 'codex.op.jetDeMutation.permanente' : 'codex.op.jetDeMutation', { table: o.table.id });
    case 'charDamage': return t('codex.op.degatsDeCaracteristique', { n: humanizeFormula(o.amount), car: CHAR_LABELS[o.characteristic] });
    case 'summon': return `${t('codex.op.invocation', { n: humanizeFormula(o.count), nom: creatureLabel(o.ref) })}${o.allyOfCaster === false ? t('codex.op.invocation.hostile') : ''}`;
    case 'scheduleRespawn': return t('codex.op.reapparition', { nom: creatureLabel(o.ref), n: humanizeFormula(o.delayDays) });
    case 'zone': return t('codex.op.zone', { forme: libelleDeValeur(zoneShapeSchema, o.shape), taille: deFormule((o.shape === 'wall' ? o.lengthMeters : o.radiusMeters) ?? 2) });
    case 'polymorph': return t('codex.op.polymorphie', { nom: creatureLabel(o.ref) });
    case 'transform': return t('codex.op.transformation', { nom: creatureLabel(o.morphRef ?? o.tag) });
    case 'endTransform': return t('codex.op.finDeTransformation');
    case 'lifeSteal': return t('codex.op.volDeVie', { num: o.num, den: o.den });
    case 'skillMod': return t(o.mod >= 0 ? 'codex.op.modificateur.gagneEn' : 'codex.op.modificateur.subitEn', { mod: signe(o.mod), nom: refLabel('skills', o.skill) });
    case 'skillDRBonus': return t('codex.op.bonusDeDRDeCompetence', { n: humanizeFormula(o.bonus), quoi: o.skill ? refLabel('skills', o.skill) : t('codex.op.bonusDeDRDeCompetence.concernes') });
    case 'charDRBonus': return t('codex.op.bonusDeDRDeCaracteristique', { n: humanizeFormula(o.bonus), car: CHAR_LABELS[o.characteristic] });
    case 'crewTestMod': return t(o.mod >= 0 ? 'codex.op.modificateurDeTestDEquipage.gagne' : 'codex.op.modificateurDeTestDEquipage.subit', { mod: signe(o.mod) });
    case 'fall': return humanizeFall(o.hauteur.table.id);
    case 'incomingAttackMod': return t('codex.op.modificateurDAttaqueSubie', { mod: signe(o.amount) });
    case 'incomingAdvantage': return t('codex.op.avantageSubi', { n: o.amount });
    // « réduit de 2 par point » (LDB 10 l.1026, Talent) / Indice du Trait (LDB 85 l.302) : le nombre
    // affiché est l'incrément PAR POINT — l'échelle par rang/Indice n'est pas résolue ici.
    case 'incomingSpellDRMod': return typeof o.amount === 'number' && o.amount < 0
      ? t('codex.op.modificateurDeDRDeSortSubi.reduit', { n: -o.amount })
      : t('codex.op.modificateurDeDRDeSortSubi', { quantite: deFormule(o.amount) });
    case 'sbBonus': return t('codex.op.bonusDeBF', { n: o.amount });
    case 'attackKeyword': return t('codex.op.motCleDAttaque');
    case 'mitigateIncoming': return `${t('codex.op.attenuationSubie')}${o.unlessKeyword === 'magic' ? t('codex.op.attenuationSubie.magie') : ''}`;
    case 'moveScale': return `${o.num === 1 && o.den === 2 ? t('codex.op.echelleDeMouvement.moitie') : t('codex.op.echelleDeMouvement', { num: o.num, den: o.den })}${pendant(o)}`;
    case 'moveMod': return t(o.mod >= 0 ? 'codex.op.modificateurDeMouvement.gagne' : 'codex.op.modificateurDeMouvement.subit', { mod: signe(o.mod) });
    case 'offTerrainMod': return t('codex.op.malusHorsTerrain');
    case 'attrMod': return t('codex.op.modificateurDAttribut', { n: humanizeFormula(o.mod), attr: ATTR_LABEL[o.attr] });
    case 'maxWeaponHands': return `${t('codex.op.mainsDArmeMax', { n: o.hands })}${pendant(o)}`;
    case 'disarm': return t('codex.op.desarmement');
    case 'handGate': return t('codex.op.mainRequise');
    case 'senseLoss': return t('codex.op.perd', { quoi: libelleDeValeur(senseSchema, o.sense) });
    case 'loseTurn': return t('codex.op.perd', { quoi: o.what ? libelleDeValeur(loseTurnWhatSchema, o.what) : t('codex.op.tourPerdu.tout') });
    case 'testDAgir': return t('codex.op.testDAgir', { car: CHAR_LABELS[o.characteristic] });
    case 'diseaseTestMod': return t(o.amount >= 0 ? 'codex.op.modificateurDeTestDeMaladie.gagne' : 'codex.op.modificateurDeTestDeMaladie.subit', { mod: signe(o.amount) });
    case 'suppressSymptom': return t('codex.op.suppressionDeSymptome', { nom: symptomLabel(o.symptomId) });
    case 'aggravateSymptom': return t('codex.op.symptomeAggrave', { nom: symptomLabel(o.symptomId) });
    case 'attenuateSymptom': return t('codex.op.symptomeAttenue', { nom: symptomLabel(o.symptomId) });
    case 'grantSymptom': return t('codex.op.octroiDeSymptome', { nom: symptomLabel(o.symptomId) });
    case 'delayed': return t('codex.op.differe', { ops: o.ops.map(humanizeOp).join(' ; ') });
    case 'removeShipPoste': return t('codex.op.retraitDePoste');
    case 'teamCommander': return t('codex.op.commandantDEquipe');
    case 'weaponRollMod': return t('codex.op.modificateurDeJetDArme');
    case 'weaponDamageMod': return t('codex.op.modificateurDeDegatsDArme');
    case 'armourPierce': { const cat = armourBypassCatLabel(o.bypass); return cat ? t('codex.op.perceArmure.categorie', { n: o.amount, cat }) : t('codex.op.perceArmure', { n: o.amount }); }
    case 'critOnRoll': return t('codex.op.critiqueSurJet');
    case 'spendAdvantage': return o.amount == null ? t('codex.op.depenseDAvantage.tout') : t('codex.op.depenseDAvantage', { n: o.amount });
    case 'light': return t('codex.op.lumiere', { n: o.radiusM });
    case 'intoxicate': return t('codex.op.ivresse');
    case 'narrative': return o.nombre === undefined ? o.text : t('codex.op.nombreNarratif', { text: o.text, n: humanizeFormula(o.nombre) });
    case 'shipMorale': return t('codex.op.moralDEquipage', { delta: formatEffetSigne(o.delta) });
    case 'manann': return o.factorId !== undefined
      ? t('codex.op.manann.facteur', { nom: refLabel('seaManannFactors', { id: o.factorId }) })
      : t('codex.op.manann', { delta: formatEffetSigne(o.delta) });
    case 'shipCritical': return t('codex.op.critiqueDeNavire', {
      n: humanizeFormula(o.count),
      loc: o.location === 'aleatoire' ? t('codex.op.critiqueDeNavire.aleatoire') : shipLocationLabel(o.location),
    }) + (o.equipageEpargne ? t('codex.op.critiqueDeNavire.equipageEpargne') : '');
    case 'navireMod': return t('codex.op.modificateurDeNavire', {
      axes: [
        ...(o.m !== undefined ? [t('eff.modificateurDuNavireM', { m: `${o.m >= 0 ? '+' : '−'}${Math.abs(o.m)}` })] : []),
        ...(o.manDR !== undefined ? [t('eff.modificateurDuNavireManoeuvre', { dr: `${o.manDR >= 0 ? '+' : '−'}${Math.abs(o.manDR)}` })] : []),
        ...(o.evite ? [t('eff.modificateurDuNavireEvite', { perils: o.evite.map((id) => findSeaHazard(id)?.label ?? id).join(', ') })] : []),
      ].join(', '),
      duree: o.jusqua === 'carenage' ? t('eff.jusquAuCarenage') : o.jusqua === 'evenementDeBord' ? t('eff.jusquAuProchainEvenement') : t('codex.op.pendantJours', { n: humanizeFormula(o.jusqua.jours) }),
    });
    case 'meteoImposee': return t('codex.op.meteoImposee', {
      meteo: [...(o.meteo ? [seaWeatherLabel(o.meteo)] : []), ...(o.ventInverse ? [t('codex.op.meteoImposee.ventInverse')] : [])].join(', '),
      n: humanizeFormula(o.jours),
    });
    case 'cargaison': return o.perteAuDechargement !== undefined
      ? t('codex.op.cargaison.perte', { enc: humanizeFormula(o.perteAuDechargement) })
      : o.perduePct !== undefined
        ? t('codex.op.cargaison.perdueEnPourcentage', { pct: o.perduePct })
        : o.perdueEnc !== undefined
          ? t('codex.op.cargaison.perdueEnEncombrement', { enc: humanizeFormula(o.perdueEnc) })
          : t('codex.op.cargaison', { enc: humanizeFormula(o.enc) });
    case 'equipage': return o.perdusPct !== undefined
      ? t('codex.op.equipage.perdusEnPourcentage', { pct: o.perdusPct })
      : `${t('codex.op.equipage', { delta: humanizeFormula(o.delta) })}${o.role ? t('codex.op.equipage.role', { role: refLabel('crewRoles', o.role) }) : ''}${o.sansSolde ? t('codex.op.equipage.sansSolde') : ''}`;
    case 'provisions': return o.gateesPct !== undefined
      ? t('codex.op.provisions.gatees', { pct: o.gateesPct })
      : o.rations !== undefined
        ? t('codex.op.provisions.rations', { n: humanizeFormula(o.rations), vivre: refLabel('trappings', o.vivre) })
        : o.eauTonneaux !== undefined
          ? t('codex.op.provisions.eau', { n: humanizeFormula(o.eauTonneaux) })
          : t('codex.op.provisions.jours', { n: humanizeFormula(o.jours), vivre: refLabel('trappings', o.vivre) });
    case 'perilDeMer': return o.collision !== undefined
      ? t('codex.op.perilDeMer.collision', { peril: findSeaHazard(o.collision.id)?.label ?? o.collision.id })
      : t('codex.op.perilDeMer.tourbillon', { tourbillon: findWhirlpool(o.tourbillon.id)?.label ?? o.tourbillon.id });
    case 'navireHostile': return `${t('codex.op.navireHostile', { navire: refLabel('vehicles', o.navire), nombre: o.equipage.nombre, equipage: creatureLabel(o.equipage.id) })}`
      + `${o.chef ? t('codex.op.navireHostile.chef', { chef: creatureLabel(o.chef.id) }) : ''}`
      + `${o.grandsCanons ? t('codex.op.navireHostile.canons', { n: o.grandsCanons }) : ''}`
      + `${o.exigence === 'fouille' ? t('codex.op.navireHostile.fouille') : ''}`;
    case 'infestation': return t('codex.op.infestation', {
      test: testSkillLabel({ crewTestType: o.crewTestType.id }) ?? o.crewTestType.id,
      difficulte: DIFFICULTY_LABELS[o.difficulty], dr: o.drCible,
      nuit: humanizeFlow(o.chaqueNuit, []),
    }) + `${o.surDRNegatif ? t('codex.op.infestation.attaques', { assaut: humanizeFlow(o.surDRNegatif, []) }) : ''}`;
    case 'combatEnMer': return t('codex.op.combatEnMer', { nombre: o.adversaire.nombre, adversaire: creatureLabel(o.adversaire.id) })
      + `${o.adversaire.optionals ? t('codex.op.combatEnMer.facultatifs', { traits: o.adversaire.optionals.map((p) => traitLisible(p)).join(', ') }) : ''}`
      + `${o.repousseAPct !== undefined ? t('codex.op.combatEnMer.repousse', { pct: o.repousseAPct }) : ''}`
      + `${o.victoire ? t('codex.op.combatEnMer.victoire', { victoire: humanizeFlow(o.victoire, []) }) : ''}`;
    case 'attaquesSubies': return t('codex.op.attaquesSubies', { nombre: formatDice(o.nombre.dice), assaillant: o.assaillant.statblock.label });
    case 'commission': return t('codex.op.commission', { valeur: montantEnSous(o.montant.brass) });
    case 'constructeurDEscale': return t('codex.op.constructeurDEscale', { competence: o.competence, duree: humanizeFormula(o.duree) });
    case 'rationsDEscale': return t('codex.op.rationsDEscale', { valeur: montantEnSous(o.montant.brass) });
    case 'marcheDuPort': return o.colonnes !== undefined
      ? t(o.colonnes === 'penurie' ? 'codex.op.marcheDuPort.penurie' : 'codex.op.marcheDuPort.saturation')
      : o.offre !== undefined
        ? t('codex.op.marcheDuPort.offre', { enc: humanizeFormula(o.offre.enc), pct: o.offre.remisePct })
        : t('codex.op.marcheDuPort.demande', { delta: `${o.demande >= 0 ? '+' : '−'}${Math.abs(o.demande)}`, n: humanizeFormula(o.jours) });
  }
  return assertNever(o);
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

/** Met une majuscule initiale (première phrase d'un effet). */
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** La durée TIRÉE d'une feuille `ops` (`pendantJours`), en suffixe ; vide sans elle. */
export const dureeDeLaFeuille = (e: EffectOp): string =>
  (e.pendantJours === undefined ? '' : ` (${t('codex.op.pendantJours', { n: humanizeFormula(e.pendantJours) })})`);

/** Effet MÉCANIQUE d'un Flow en prose JOUEUR — « Si {condition}, {conséquence}. » / « Jet de … : en cas
 *  de réussite … ». Switch EXHAUSTIF sur les 5 kinds de Flow (never en default). SOURCE UNIQUE joueur. */
export function humanizeFlow(f: Flow, etats: readonly EtatDeclare[]): string {
  switch (f.kind) {
    case 'effet': {
      const e = f.effet as EffectOp;
      if (e && e.type === 'ops') return `${e.ops.map(humanizeOp).filter(Boolean).join(' ; ')}${dureeDeLaFeuille(e)}`;
      return (f.effet as { type?: string }).type ?? '';
    }
    case 'sequence': return f.etapes.map((s) => humanizeFlow(s, etats)).filter(Boolean).join(' ; ');
    case 'si': {
      const base = t('codex.flow.si', { cond: humanizeCondition(f.condition, etats), alors: humanizeFlow(f.alors, etats) });
      return f.sinon ? `${base}${t('codex.flow.sinon', { sinon: humanizeFlow(f.sinon, etats) })}` : base;
    }
    case 'test': {
      const who = testSkillLabel(f.test) ?? t('codex.flow.unTest');
      // lecture déclarée : la fiche Codex dit la Condition d'accès authorée
      const { gate } = f.test;
      const sujet = `${deElide(who)}${gate ? t('codex.flow.jetGate', { cond: humanizeCondition(gate, etats) }) : ''}`;
      return t(f.test.opposed ? 'codex.flow.jetOppose' : 'codex.flow.jet', { sujet, ok: humanizeFlow(f.reussite, etats), ko: humanizeFlow(f.echec, etats) });
    }
    case 'choix': {
      const cout = coutAvantageTexte(f.coutEnAvantage);
      return t('codex.flow.choix', {
        cout: cout ? t('codex.flow.choix.cout', { cout }) : '',
        invite: f.invite,
        oui: humanizeFlow(f.oui, etats),
        non: flowMuet(f.non) ? '' : t('codex.flow.sinon', { sinon: humanizeFlow(f.non!, etats) }),
      });
    }
  }
  return assertNever(f);
}

/** Wrapper : effet de Flow rendu comme UNE phrase (majuscule initiale). Utilisé par `describe`. */
export function humanizeFlowSentence(f: Flow, etats: readonly EtatDeclare[]): string {
  return cap(humanizeFlow(f, etats));
}

/** Bonus d'incantation d'un Domaine (`castBonus`) en français JOUEUR — « +10 par cible affectée par En
 *  flammes dans un rayon égal à votre Bonus de Force Mentale en mètres ». Contexte PLEIN TEXTE (fact
 *  « Bonus d'incantation », `registry.ts`) : ni jargon (« ≤ BFM m »), ni Markdown — État et Caractéristique
 *  en libellé résolu, jamais l'id brut. */
export function humanizeCastBonus(cb: { bonus: number; perCondition: string; radiusStat: CharKey }): string {
  return t('codex.castBonus', { bonus: cb.bonus, etat: conditionLabel(cb.perCondition), car: CHAR_LABELS[cb.radiusStat] });
}
