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
import type { Flow, Condition, EffectOp } from '../../state/flow';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { armourBypassCategorieSchema, loseTurnWhatSchema, senseSchema, zoneShapeSchema } from '../../data/schemas/grammaire/mecanique';
import { INDICE_TEMPLATE, type ActorRef, type CompareOp, type CompareSubject } from '../../engine/flowCore';
import { estCausePersistante, type GameOp, type Formula, type ResolveWindow } from '../../engine/ops';
import type { Camp, Relation } from '../../engine/relations';
import { CHAR_LABELS, HIT_LOCATION_LABELS, type CharKey, type ArmourBypass } from '../../engine/types';
import { formatTrait, formatWardSave, traitLabelById } from '../../engine/traits/dispatch';
import { giveTrappingLabel } from '../../engine/items';
import { traumaLabelOf } from '../../engine/trauma';
import { formatMoney } from '../../engine/money';
import { rule, ruleDef } from '../../engine/policy';
import {
  conditionLabel, psychologyLabel, groupLabel, symptomLabel, creatureLabel,
  diseaseLabel, refLabel, qualityRefLabel,
} from '../../data';
import { findFallTable } from '../../data/shipCriticals';

function assertNever(x: never): never {
  throw new Error(`humanize: cas non couvert — ${JSON.stringify(x)}`);
}

/** Nom d'affichage d'un État nommé, en *italique* (convention des desc : `*Hémorragique*`). */
const stateItal = (id: string): string => `*${conditionLabel(id)}*`;
const whoLabel = (w: ActorRef): string => (w === 'caster' ? 'le lanceur' : 'la cible');

/** Libellés JOUEUR d'un camp / d'une relation (enum FERMÉ, pas un id de registre) — pendant naturel des
 *  libellés d'atelier (« adversaire (camp ≠) »). */
const REL_PLAYER: Record<Relation | Camp, string> = {
  self: 'lui-même', ally: 'un allié', opponent: 'un adversaire',
  party: 'un membre du groupe', neutral: 'un neutre', hostile: 'un ennemi',
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

/** « de » + une formule humanisée, AVEC la contraction française : `de le` → `du`, `de les` → `des`
 *  (`de la`/`de l'` restent). Une formule se NOMME (« le Bonus de Force Mentale », « la Sociabilité ») :
 *  la coller derrière un « de » nu rendait « dans un rayon de le Bonus… ». SITE UNIQUE de cette
 *  contraction — toute phrase qui pose une quantité derrière « de » passe par ici. PURE. */
export function deFormule(f: Formula): string {
  const mots = humanizeFormula(f);
  if (mots.startsWith('le ')) return `du ${mots.slice(3)}`;
  if (mots.startsWith('les ')) return `des ${mots.slice(4)}`;
  return `de ${mots}`;
}

/** Fragment de DURÉE en Rounds d'une op qui en porte une (`durationFromOp`, engine/ops) — vide si
 *  l'op n'en porte pas (elle prend alors celle du contexte). SOURCE UNIQUE de la phrase : la borne
 *  d'une entrée s'y dit d'elle-même (« … (minimum de 1) », AA 07 l.113 / LDB 18 l.88). */
const pendantRounds = (f: Formula | undefined): string => (f != null ? ` pendant ${humanizeFormula(f)} Round(s)` : '');

/** La MÊME quantité, mais la note de règle SORTIE du nombre — pour les phrases où une UNITÉ suit le
 *  nombre (« 12 sou(s) de cuivre », « 5 minute(s) ») : la note se pose APRÈS l'unité, jamais entre. */
export function humanizeQuantite(f: Formula): { valeur: string; note: string } {
  const regles: string[] = [];
  const valeur = formuleEnMots(f, regles);
  const note = regles.length
    ? ` (règle${regles.length > 1 ? 's' : ''} ${regles.map((r) => `« ${r} »`).join(', ')})`
    : '';
  return { valeur, note };
}

/** Traversal UNIQUE des deux rendus. `regles` non nul = les règles numériques rencontrées y sont
 *  COLLECTÉES (le nombre s'imprime nu) ; nul = chacune se nomme sur place. PURE. */
function formuleEnMots(f: Formula, regles: string[] | null): string {
  if (typeof f === 'number') return String(f);
  // Placeholder RUNTIME baké (`INDICE_TEMPLATE` — Redoutable ZI, substitué à l'attache) qui peut atteindre
  // l'affichage : jamais un objet Formula, donc gardé AVANT les `in` (mirroir de `resolveFormula`).
  if (typeof f !== 'object' || f === null) return String(f) === INDICE_TEMPLATE ? "l'Indice" : String(f);
  if ('bonusOf' in f) return `le Bonus de ${CHAR_LABELS[f.bonusOf]}`;
  if ('charOf' in f) return `la ${CHAR_LABELS[f.charOf]}`;
  if ('dice' in f) return `${f.dice.n}d${f.dice.sides}${f.dice.plus ? `+${f.dice.plus}` : ''}`;
  if ('rolled' in f) return 'le résultat du dé';
  if ('indiceOf' in f) return "l'Indice de l'attaque";
  if ('stacks' in f) return "le nombre de pions de l'État";
  if ('engagedAdvantageGap' in f) return "l'écart d'Avantage avec les ennemis engagés";
  if ('woundsDealt' in f) return 'les Blessures infligées';
  if ('sl' in f) return 'les DR du Test';
  // Les formes NON numériques (`flag`/`mode`, ou une règle inconnue) n'ont pas de nombre à montrer :
  // elles se nomment, quel que soit le rendu demandé.
  if ('rule' in f) {
    const def = ruleDef(f.rule);
    const valeur = rule(f.rule);
    if (def?.kind !== 'param' || typeof valeur !== 'number') return `la règle « ${def?.label ?? f.rule} »`;
    if (regles) {
      if (!regles.includes(def.label)) regles.push(def.label);
      return String(valeur);
    }
    return `${valeur} (règle « ${def.label} »)`;
  }
  if ('minimum' in f) return `${formuleEnMots(f.of, regles)} (minimum de ${f.minimum})`;
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
  if ('condition' in s) return `le nombre d'États ${stateItal(s.condition)} de ${who}`;
  if ('char' in s) return `la ${CHAR_LABELS[s.char]}${s.bonus ? ' (Bonus)' : ''} de ${who}`;
  const FIELD: Record<typeof s.field, string> = {
    woundsCurrent: 'les PB', woundsMax: 'les PB maximum', size: 'la Taille', advantage: "l'Avantage",
  } as Record<typeof s.field, string>;
  return `${FIELD[s.field]} de ${who}`;
}

/** Comparaison NATURELLE — cas privilégié « porte / ne porte pas l'État X » quand le sujet est un État. */
function comparePhrase(c: Extract<Condition, { kind: 'compare' }>, neg: boolean): string {
  const who = whoLabel(c.subject.who);
  if ('condition' in c.subject && typeof c.value === 'number') {
    const holds = (c.op === '>=' || c.op === '>') && c.value >= 1;
    const absent = (c.op === '==' && c.value === 0) || (c.op === '<' && c.value <= 1);
    if (holds || absent) {
      const carries = holds !== neg; // « porte » vrai si (seuil de présence) XOR négation
      return `${who} ${carries ? 'porte' : 'ne porte pas'} ${stateItal(c.subject.condition)}`;
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
  return a && b ? `entre ${a} et ${b}` : a ? `à partir de ${a}` : b ? `avant ${b}` : "à n'importe quelle heure";
}

/** Sujets d'acteur (`whoLabel`) susceptibles de se répéter en tête de clauses conjointes. */
const CLAUSE_SUBJECTS = ['le lanceur', 'la cible'] as const;

/** Dédoublonne le sujet répété en tête de clauses jointes : « la cible est un adversaire ET la cible ne
 *  possède pas … » → « … ET ne possède pas … ». Ne retire le sujet que si la clause ET sa précédente
 *  partagent EXACTEMENT le même sujet en tête (sûreté grammaticale : sinon on conserve le sujet). */
function dedupSubjects(parts: string[]): string[] {
  return parts.map((p, i) => {
    if (i === 0) return p;
    const subj = CLAUSE_SUBJECTS.find((s) => p.startsWith(`${s} `) && parts[i - 1].startsWith(`${s} `));
    return subj ? p.slice(subj.length + 1) : p;
  });
}

/** Condition en clause NATURELLE. `neg` porte la négation (poussée dans la feuille — « ne possède pas … »,
 *  De Morgan sur `all`/`any` — au lieu d'un « NON( … ) » d'atelier). SOURCE UNIQUE joueur des Conditions. */
export function humanizeCondition(c: Condition, neg = false): string {
  const who = (r: ActorRef) => whoLabel(r);
  switch (c.kind) {
    case 'always': return neg ? 'jamais' : 'toujours';
    case 'flag': return `${neg ? 'sauf si ' : 'si '}la condition de scénario « ${c.expr} » est ${neg ? 'fausse' : 'remplie'}`;
    case 'time': return neg ? `hors du créneau ${timePhrase(c.window)}` : timePhrase(c.window);
    case 'hasItem': {
      const label = c.trappingId || '?';
      return `le groupe ${neg ? 'ne possède pas' : 'possède'} « ${label} »${c.count && c.count > 1 ? ` (×${c.count})` : ''}`;
    }
    case 'money': return `la bourse du groupe ${neg ? "n'atteint pas" : 'atteint'} ${formatMoney({ gold: c.atLeast.gold ?? 0, silver: c.atLeast.silver ?? 0, brass: c.atLeast.brass ?? 0 })}`;
    case 'partyDead': {
      const subj = c.who === 'all' ? 'tout le groupe' : 'un héros';
      return neg ? `${subj} ${c.who === 'all' ? "n'est pas entièrement mort" : "n'est mort"}` : `${subj} est mort`;
    }
    case 'compare': return comparePhrase(c, neg);
    case 'slThreshold': return `la marge ${opWord(c.op, neg)} ${c.value} DR`;
    case 'location': return `la touche ${neg ? "n'atteint pas" : 'atteint'} ${HIT_LOCATION_LABELS[c.is]}`;
    case 'attackKind': return `l'attaque ${neg ? "n'est pas" : 'est'} de type « ${c.is} »`;
    case 'startleCause': return `l'effarouchement ${neg ? 'ne vient pas' : 'vient'} ${c.is === 'noise' ? "d'un bruit fort" : 'de la magie'}`;
    case 'woundsDealt': return `les Blessures infligées ${opWord(c.op, neg)} ${c.value}`;
    case 'engagedAdvantageGap': return `l'écart d'Avantage avec les ennemis engagés ${opWord(c.op, neg)} ${c.value}`;
    case 'engagedAdvantageLead': return `l'avance d'Avantage sur les ennemis engagés ${opWord(c.op, neg)} ${c.value}`;
    case 'foeInLoS': return neg ? "aucun ennemi n'est en vue" : 'un ennemi est en vue';
    case 'hiddenFromFoes': return `la cible ${neg ? "n'est pas cachée" : 'est cachée'} de l'ennemi`;
    case 'engaged': return `la cible ${neg ? "n'est pas engagée" : 'est engagée'} avec un ennemi`;
    case 'crewTest': return neg ? "ce n'est pas un Test d'équipage" : "il s'agit d'un Test d'équipage";
    case 'nearestFoe': return `l'ennemi le plus proche ${opWord(c.op, neg)} ${c.value} cases`;
    case 'capability': return `${who(c.who)} ${neg ? "n'a pas" : 'a'} la capacité « ${c.id} »${c.value != null ? ` (${c.op ?? '>='} ${c.value})` : ''}`;
    case 'relation': return `${who(c.who)} ${neg ? "n'est pas" : 'est'} ${REL_PLAYER[c.is]}`;
    case 'has': {
      const v = neg ? 'ne possède pas' : 'possède';
      if (c.what === 'talent') return `${who(c.who)} ${v} le Talent ${refLabel('talents', { id: c.value, spec: c.spec })}`;
      if (c.what === 'trait') return `${who(c.who)} ${v} le Trait ${traitLabelById(c.value)}`;
      if (c.what === 'psych') return `${who(c.who)} ${v} l'état psychologique ${psychologyLabel(c.value)}`;
      return `${who(c.who)} ${neg ? "n'appartient pas" : 'appartient'} au Groupe ${groupLabel(c.value)}`;
    }
    case 'casterChaosDomain': return `le Domaine du Chaos du lanceur ${neg ? "n'est pas" : 'est'} ${refLabel('gods', { id: c.is })}`;
    case 'visiblePassive': return `${who(c.who)} ${neg ? 'ne porte aucune' : 'porte une'} atteinte VISIBLE`;
    case 'skill': {
      const subj = c.who === 'all' ? 'tout le groupe' : 'un héros';
      return `${subj} ${neg ? 'ne possède pas' : 'possède'} la Compétence ${refLabel('skills', { id: c.id, spec: c.spec })}${c.advances ? ` (≥${c.advances})` : ''}`;
    }
    case 'career': {
      const subj = c.who === 'all' ? 'tout le groupe' : 'un héros';
      return `${subj} ${neg ? "n'exerce pas" : 'exerce'} la carrière ${refLabel('careers', { id: c.id })}`;
    }
    case 'species': {
      const subj = c.who === 'all' ? 'tout le groupe' : 'un héros';
      return `${subj} ${neg ? "n'est pas" : 'est'} de l'espèce ${refLabel('races', { id: c.id })}`;
    }
    case 'status': {
      const subj = c.who === 'all' ? 'tout le groupe' : 'un héros';
      return `${subj} a un Statut ${neg ? 'inférieur à' : 'au moins'} « ${c.atLeast} »`;
    }
    // De Morgan : NON(A ET B) = (NON A) OU (NON B) ; NON(A OU B) = (NON A) ET (NON B).
    case 'all': return c.of.length ? dedupSubjects(c.of.map((x) => humanizeCondition(x, neg))).join(neg ? ' ou ' : ' et ') : (neg ? 'jamais' : 'toujours');
    case 'any': return c.of.length ? dedupSubjects(c.of.map((x) => humanizeCondition(x, neg))).join(neg ? ' et ' : ' ou ') : (neg ? 'toujours' : 'jamais');
    case 'not': return humanizeCondition(c.of, !neg);
  }
  return assertNever(c);
}

// ---------------------------------------------------------------------------
// GameOp
// ---------------------------------------------------------------------------

const RESOURCE_LABEL = { fortune: 'Chance', fate: 'Destin' } as const;
const ATTR_LABEL = { wounds: 'Blessures', fortune: 'Chance', resolve: 'Détermination' } as const;
/** Libellé JOUEUR du volet matériau d'`armourPierce.bypass` (LDB 62 l.270) — `undefined`/nombre = pas de volet matériau. */
const armourBypassCatLabel = (b: ArmourBypass | undefined): string | undefined =>
  typeof b === 'string' ? libelleDeValeur(armourBypassCategorieSchema, b) : undefined;

/** ÉCHELLE « par DR » d'une quantité d'op (`PerSL`) en clair joueur — « +1 par DR d'échec » (Terreur,
 *  LDB 21 l.54), « +1 par 2 DR ». SOURCE UNIQUE de cette phrase : la chip d'une op qui la porte
 *  l'affiche AVANT le jet (la règle complète), le nombre RÉSOLU la remplace une fois le DR connu. */
export function humanizePerSL(p: { every: number; amount: number; onFailure?: boolean }): string {
  const pas = p.every > 1 ? `${p.every} DR` : 'DR';
  return `${p.amount >= 0 ? '+' : '−'}${Math.abs(p.amount)} par ${pas}${p.onFailure ? ' d’échec' : ''}`;
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
  if (!table) return `tombe de la hauteur que dit « ${tableId} »`;
  const stations = [...new Set(table.bandes.flatMap((b) => Object.keys(b.hauteurs)))];
  const colonnes = stations.map((id) => {
    const parBande = table.bandes.map((b) => (b.hauteurs[id] === undefined ? '—' : `${humanizeFormula(b.hauteurs[id])}`));
    return `${refLabel('shipStations', { id })} ${parBande.join('/')} m`;
  });
  return `tombe de la hauteur que dit « ${table.label} » (${colonnes.join(', ')}, selon la Taille du bateau)`;
}

/** UN terme joueur pour la CAUSE PERSISTANTE (prédicat `estCausePersistante`, `engine/ops.ts`) : le
 *  même que le journal (`op.condPerRoundUnless`/`op.condRegain`). SOURCE UNIQUE de la formulation,
 *  composée par les trois lecteurs du Codex (`humanizeOp`, `opRows`, dialecte miscast de `registry`). */
export const CAUSE_PERSISTANTE = 'regagné à chaque fin de Round';

/** MAGNITUDE d'un coût d'Avantage (`Flow` `choice.advantageCost`) telle qu'un JOUEUR la lit. Un coût
 *  resté TEMPLATE (`INDICE_TEMPLATE`, substitué par `withArg` sur l'instance porteuse) se lit comme le
 *  livre l'imprime — `AA 08 l.87` « **Taillade (XA) :** … dépenser X Avantages ». SOURCE UNIQUE des deux
 *  lecteurs de Codex (`humanizeFlow`, `describe::flowSummary`) : un `$indice` ne doit jamais atteindre
 *  l'écran. `undefined` = pas de coût (l'appelant n'imprime alors rien). */
export function coutAvantageTexte(cost: number | typeof INDICE_TEMPLATE | undefined): string | undefined {
  if (cost == null) return undefined;
  return cost === INDICE_TEMPLATE ? 'X' : String(cost);
}

/** Un Flow VIDE (`seq` sans étape, ici comme en donnée) ne se dit pas : « ; sinon » suivi de rien est du
 *  bruit. Prédicat PARTAGÉ par les deux lecteurs, sur la branche `no` d'un `choice` (renoncer = ne rien
 *  faire, la forme la plus courante en donnée). */
export function flowMuet(f: Flow | undefined): boolean {
  return !f || (f.kind === 'seq' && f.steps.length === 0);
}

/** Une rangée qui pose un État PUIS déclare la cause qui le maintient (`LDB 16 l.117`) l'écrit en DEUX
 *  ops ; elle se LIT en UNE chip — la pose littérale est ABSORBÉE par la cause, qui porte le terme et la
 *  durée. Pré-passe PARTAGÉE des deux lecteurs de LISTES d'ops (`opRows`, dialecte miscast de
 *  `registry`), sur la forme MINIMALE commune aux deux dialectes. */
export function replieCausesPersistantes<T extends { op?: unknown; id?: unknown }>(ops: readonly T[]): T[] {
  const maintenus = new Set(ops.filter(estCausePersistante).map((o) => o.id));
  return ops.filter((o) => estCausePersistante(o) || o.op !== 'condition' || !maintenus.has(o.id));
}

/** FENÊTRE de Détermination (`ResolveWindow`, `engine/ops`) de l'État qu'une op `condition` porte en
 *  PASSIF, telle qu'un JOUEUR la lit (`LDB 17 l.61`). `undefined` = rien à dire de plus que le défaut
 *  (la phrase ne se charge que d'une fenêtre AUTHORÉE). Une durée d'horloge tirée du registre des règles
 *  optionnelles se lit en MINUTES, la règle nommée entre parenthèses — jamais « la règle X minute(s) ». */
export function humanizeResolveWindow(w: ResolveWindow | undefined): string | undefined {
  if (w === undefined) return undefined;
  if (w === 'none') return 'la Détermination ne le lève pas tant que sa cause dure';
  if (w.scale === 'rounds') {
    return w.left === 1
      ? 'la Détermination le suspend jusqu’à la fin du Round'
      : `la Détermination le suspend ${humanizeFormula(w.left)} Round(s)`;
  }
  const { valeur, note } = humanizeQuantite(w.minutes);
  return `la Détermination le suspend ${valeur} minute(s)${note}`;
}

export function humanizeOp(o: GameOp): string {
  switch (o.op) {
    case 'wounds': return `subit ${humanizeFormula(o.amount)} Blessure(s)${o.ignoreAP === false ? '' : ', ignorant les PA'}${o.bypassArmour === 'metal' ? " (perce l'armure métallique)" : o.bypassArmour === 'nonMagic' ? " (perce l'armure non magique)" : ''}`;
    case 'heal': return `récupère ${humanizeFormula(o.amount)} PB`;
    case 'healCaster': return `le lanceur récupère ${humanizeFormula(o.amount)} PB`;
    case 'condition': {
      const perSL = o.valuePerSL ? ` (${humanizePerSL(o.valuePerSL)})` : '';
      const duree = o.durationRounds ? ` pendant ${humanizeFormula(o.durationRounds)} Round(s)` : '';
      const fenetre = humanizeResolveWindow(o.resolveWindow);
      const determination = fenetre ? ` — ${fenetre}` : '';
      if (estCausePersistante(o)) return `gagne l'État ${stateItal(o.id)}${perSL}, ${CAUSE_PERSISTANTE}${duree}${determination}`;
      return `gagne ${o.value != null && o.value !== 1 ? `${humanizeFormula(o.value)} × ` : ''}l'État ${stateItal(o.id)}${perSL}${duree}${o.perRound ? ' à chaque Round' : ''}${determination}`;
    }
    case 'removeCondition': return `perd ${o.id ? `l'État ${stateItal(o.id)}` : 'un État au choix'}${o.valuePerSL ? ` (${humanizePerSL(o.valuePerSL)})` : ''}`;
    case 'endPsych': return `n'est plus sous l'effet de ${psychologyLabel(o.type)}`;
    case 'beginPsych': return `tombe sous ${psychologyLabel(o.type)}${o.cible ? ` (${o.cible})` : ''}${o.indice != null ? ` ${humanizeFormula(o.indice)}` : ''}`;
    case 'charMod': return `${o.mod >= 0 ? 'gagne' : 'subit'} ${o.mod >= 0 ? '+' : ''}${o.mod} en ${CHAR_LABELS[o.char]}`;
    case 'ap': return `gagne +${humanizeFormula(o.amount)} PA${o.loc ? ` (${HIT_LOCATION_LABELS[o.loc]})` : ' à toutes les Localisations'}`;
    case 'corruption': return `gagne ${o.amount >= 0 ? '+' : ''}${o.amount} point(s) de Corruption`;
    case 'sinMod': return `${o.amount >= 0 ? 'gagne' : 'perd'} ${Math.abs(o.amount)} point(s) de Péché`;
    case 'corruptionExposure': return `est exposé à une influence corruptrice`;
    case 'gainResource': return `${o.amount >= 0 ? 'gagne' : 'perd'} ${Math.abs(o.amount)} point(s) de ${RESOURCE_LABEL[o.resource]}${o.temporary ? ' (temporaire)' : ''}`;
    case 'gainAdvantage': return `voit son Avantage porté à au moins ${humanizeFormula(o.amount)}`;
    case 'castPenalty': return o.blocked ? "ne peut plus lancer de magie" : o.maxZeroDR ? 'ne peut plus obtenir de DR en Prière' : `subit ${o.mod ?? 0} aux Tests de magie`;
    case 'money': {
      const debit = estDebit(o.montant.brass);
      const { valeur, note } = humanizeQuantite(debit ? sansSigne(o.montant.brass) : o.montant.brass);
      return debit
        ? `perd ${valeur} sou(s) de cuivre de sa bourse${note}`
        : `gagne ${valeur} sou(s) de cuivre dans sa bourse${note}`;
    }
    case 'statusMod': return `${typeof o.amount === 'number' && o.amount < 0 ? 'perd' : 'gagne'} ${humanizeFormula(o.amount)} Standing pour la prochaine aventure`;
    case 'grantReverseToken': return `peut inverser ${o.skill ? refLabel('skills', o.skill) : 'un Test concernant sa cible'} une fois pendant sa prochaine aventure`;
    case 'grantTrait': return `gagne le Trait ${formatTrait({ id: o.traitId, arg: o.arg })}${o.indice != null ? ` ${humanizeFormula(o.indice)}` : ''}${pendantRounds(o.durationRounds)}`;
    case 'removeTrait': return `perd le Trait ${formatTrait({ id: o.traitId })}`;
    case 'grantPsychTrait': return `gagne l'état psychologique ${psychologyLabel(o.psychType)}${o.cible ? ` (${o.cible})` : ''}`;
    case 'removePsychTrait': return `perd ${o.psychType ? `l'état psychologique ${psychologyLabel(o.psychType)}` : 'un état psychologique au choix'}`;
    case 'grantTalent': return `gagne le Talent ${refLabel('talents', o.talent)}`;
    case 'grantCareerSkill': return `ajoute ${refLabel('skills', o.skill)} à ses carrières`;
    case 'grantCareerTalent': return `ajoute le Talent ${refLabel('talents', o.talent)} à ses carrières`;
    case 'augmentWeapon': return `voit son arme enchantée${o.addQualities?.length ? ` (${o.addQualities.map((id) => qualityRefLabel({ id })).join(', ')})` : ''}${o.damageBonus != null ? ` +${humanizeFormula(o.damageBonus)} Dégâts` : ''}`;
    case 'cureDisease': return `guérit ${o.count ?? 1} maladie(s)`;
    case 'reduceDiseaseDays': return `raccourcit ${o.disease ? diseaseLabel(o.disease) : 'une maladie'} de ${o.dice ? `${o.dice.n}d${o.dice.sides}` : (o.days ?? 1)} jour(s)`;
    case 'preventInfection': return `voit ses Blessures protégées de l'infection`;
    case 'exposeDisease': return `est exposé à la maladie ${diseaseLabel(o.disease)}`;
    case 'contractDisease': return `contracte la maladie ${diseaseLabel(o.disease)}`;
    case 'kill': return `meurt (sauf point de Destin dépensé)`;
    case 'cureCriticalWound': return `soigne ${o.count ?? 1} Blessure(s) critique(s)`;
    case 'amputer': {
      // La QUANTITÉ de la ligne (« Perdez 1d10 dents », LDB 18 l.77) porte sur les séquelles cumulatives ;
      // `unitesPerSL` est l'échelle de DR (« plus un orteil par DR en dessous de 0 », l.180).
      const quantite = o.unites != null ? `${humanizeFormula(o.unites)} ` : '';
      const echelle = o.unitesPerSL ? ', et un de plus par DR en dessous de 0' : '';
      return `perd ${quantite}${o.sequels.map((id) => traumaLabelOf(id)).join(' et ')}${echelle} — Amputation`;
    }
    case 'reduceToZero': return `voit ses PB réduits à 0`;
    case 'banish': return `est retiré du jeu`;
    case 'ignoreStatePenalties': return `ignore les pénalités ${o.count ? `de ses ${o.count} pire(s) États` : "d'État"}`;
    case 'freeReroll': return `peut relancer son prochain Test raté`;
    case 'critTwice': return `lance deux fois ses Blessures critiques et garde le meilleur`;
    case 'damageArmour': return `voit une pièce d'armure en cuir perdre 1 PA`;
    case 'suppressPsych': return `voit tous ses Traits psychologiques apaisés`;
    case 'castWard': return `impose −20 aux Tests de magie dans un rayon ${deFormule(o.radius)} m`;
    case 'suffocate': return `est soumis aux règles de la Suffocation`;
    case 'arrowWard': return "détruit les projectiles organiques qui entrent dans la Zone d'Effet";
    case 'domeWard': return `érige un dôme sur la Zone d'Effet : elle octroie le Trait ${formatWardSave(o.traitId, humanizeFormula(o.indice))} contre les attaques magiques ou à distance venant de l'extérieur`;
    case 'attackWardFM': return `ne peut être attaqué qu'après un Test de Force Mentale réussi`;
    case 'martyr': return `reçoit à leur place les Dégâts subis par ses protégés`;
    case 'noBreath': return `n'a plus besoin de respirer`;
    case 'noHunger': return `n'a plus besoin de manger ni de boire`;
    case 'ignoreAnimosity': return `ignore ses Animosités et Préjugés`;
    case 'testMod': return `${o.amount >= 0 ? 'gagne' : 'subit'} ${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests${o.char ? ` de ${CHAR_LABELS[o.char]}` : ''}`;
    case 'weatherWard': return `est immunisé aux intempéries`;
    case 'giveTrapping': return `reçoit ${o.count && o.count > 1 ? `${o.count}× ` : ''}${giveTrappingLabel(o)}`;
    case 'grantWeapon': return `invoque ${o.label} (Dégâts ${o.plusBF ? 'BF+' : ''}${humanizeFormula(o.damage)})`;
    case 'grantNaturalWeapon': return `gagne l'arme naturelle ${o.label} (${o.plusBF !== false ? 'BF+' : ''}${humanizeFormula(o.damage)})`;
    case 'grantFreeAttack': return `peut porter une attaque gratuite`;
    case 'interruptFocus': return `voit sa Focalisation interrompue`;
    case 'breakBlade': return `voit l'arme adverse arrachée`;
    case 'push': return `est repoussé ${deFormule(o.meters)} m`;
    case 'teleport': return `se téléporte jusqu'à ${humanizeFormula(o.meters)} m`;
    case 'chain': return `rebondit sur ${humanizeFormula(o.maxBounces)} ennemi(s) à ${humanizeFormula(o.hopMeters)} m`;
    case 'perRound': return `déclenche à chaque Round : ${o.ops.map(humanizeOp).join(' ; ')}`;
    case 'rollThreshold': return `lance 1d${o.sides} pour un effet à paliers`;
    case 'rollTable': return `tire sur ${'tableId' in o ? `la table « ${o.tableId} »` : 'une table'} (${'tableId' in o ? 'd10/d100' : o.die}${o.addNegativeSL ? ' + DR négatifs' : ''}${o.extraRollsPerStep ? `, +${o.extraRollsPerStep} jet par pas de Surincantation (Durée) choisi au lancer` : ''}) pour un effet selon la fourchette`;
    case 'rollMutation': return `subit une mutation tirée sur la table « ${o.table} »${o.duration === 'permanent' ? ' (permanente)' : ' (le temps du Sort)'}`;
    case 'charDamage': return `perd ${humanizeFormula(o.amount)} en ${CHAR_LABELS[o.char]} (définitivement)`;
    case 'summon': return `invoque ${humanizeFormula(o.count)}× ${creatureLabel(o.ref)}${o.allyOfCaster === false ? ' (hostile)' : ''}`;
    case 'scheduleRespawn': return `se reconstitue (${creatureLabel(o.ref)}) après ${humanizeFormula(o.delayDays)} jour(s)`;
    case 'zone': return `pose un ${libelleDeValeur(zoneShapeSchema, o.shape)} ${deFormule((o.shape === 'wall' ? o.lengthMeters : o.radiusMeters) ?? 2)} m`;
    case 'polymorph': return `se métamorphose en ${creatureLabel(o.ref)}`;
    case 'transform': return `se transforme (${creatureLabel(o.morphRef ?? o.tag)})`;
    case 'endTransform': return `retrouve sa forme initiale`;
    case 'lifeSteal': return `draine ${o.num}/${o.den} des Dégâts infligés en PB`;
    case 'skillMod': return `${o.mod >= 0 ? 'gagne' : 'subit'} ${o.mod >= 0 ? '+' : ''}${o.mod} en ${refLabel('skills', o.skill)}`;
    case 'skillDRBonus': return `gagne +${humanizeFormula(o.bonus)} DR ${o.skill ? refLabel('skills', o.skill) : 'aux Tests concernés'}`;
    case 'charDRBonus': return `gagne +${humanizeFormula(o.bonus)} DR aux Tests de ${CHAR_LABELS[o.char]}`;
    case 'crewTestMod': return `${o.mod >= 0 ? 'gagne' : 'subit'} ${o.mod >= 0 ? '+' : ''}${o.mod} aux Tests d'équipage`;
    case 'fall': return humanizeFall(o.hauteur.table.id);
    case 'incomingAttackMod': return `impose ${o.amount >= 0 ? '+' : ''}${o.amount} aux attaques qui le visent`;
    case 'incomingAdvantage': return `donne +${o.amount} Avantage à qui l'attaque`;
    // « réduit de 2 par point » (LDB 10 l.1026, Talent) / Indice du Trait (LDB 85 l.302) : le nombre
    // affiché est l'incrément PAR POINT — l'échelle par rang/Indice n'est pas résolue ici.
    case 'incomingSpellDRMod': return typeof o.amount === 'number' && o.amount < 0
      ? `réduit de ${-o.amount} par point le DR des Sorts qui l'affectent`
      : `modifie ${deFormule(o.amount)} par point le DR des Sorts qui l'affectent`;
    case 'sbBonus': return `gagne +${o.amount} au Bonus de Force pour ses Dégâts`;
    case 'attackKeyword': return `voit ses attaques comptées comme magiques`;
    case 'mitigateIncoming': return `annule les Dégâts qu'il subit${o.unlessKeyword === 'magic' ? ' (sauf attaques magiques)' : ''}`;
    case 'moveScale': return `voit son Mouvement ${o.num === 1 && o.den === 2 ? 'réduit de moitié' : `multiplié par ${o.num}/${o.den}`}${pendantRounds(o.durationRounds)}`;
    case 'moveMod': return `${o.mod >= 0 ? 'gagne' : 'subit'} ${o.mod >= 0 ? '+' : ''}${o.mod} en Mouvement`;
    case 'offTerrainMod': return `est diminué hors de son terrain d'élection`;
    case 'attrMod': return `gagne +${humanizeFormula(o.mod)} ${ATTR_LABEL[o.attr]} (maximum)`;
    case 'maxWeaponHands': return `ne peut manier que des armes à ${o.hands} main(s)${pendantRounds(o.durationRounds)}`;
    case 'disarm': return `lâche l'objet tenu dans une main`;
    case 'handGate': return `doit réussir un Test avant d'agir de cette main`;
    case 'senseLoss': return `perd ${libelleDeValeur(senseSchema, o.sense)}`;
    case 'loseTurn': return `perd ${o.what ? libelleDeValeur(loseTurnWhatSchema, o.what) : 'son Action et son Mouvement'}`;
    case 'actGate': return `doit réussir un Test de ${CHAR_LABELS[o.char]} chaque Round pour agir`;
    case 'diseaseTestMod': return `${o.amount >= 0 ? 'gagne' : 'subit'} ${o.amount >= 0 ? '+' : ''}${o.amount} aux Tests de maladie`;
    case 'suppressSymptom': return `voit le symptôme ${symptomLabel(o.symptomId)} suspendu`;
    case 'aggravateSymptom': return `voit le symptôme ${symptomLabel(o.symptomId)} s'aggraver`;
    case 'attenuateSymptom': return `voit le symptôme ${symptomLabel(o.symptomId)} s'atténuer`;
    case 'grantSymptom': return `développe le symptôme ${symptomLabel(o.symptomId)}`;
    case 'delayed': return `déclenche plus tard : ${o.ops.map(humanizeOp).join(' ; ')}`;
    case 'removeShipPoste': return `perd une pièce d'artillerie`;
    case 'teamCommander': return `est dirigé par un commandant d'équipe`;
    case 'weaponRollMod': return `modifie une phase de son jet de combat`;
    case 'weaponDamageMod': return `modifie ses Dégâts d'arme`;
    case 'armourPierce': { const cat = armourBypassCatLabel(o.bypass); return `perce ${o.amount} PA${cat ? ` (ignore ${cat})` : ''}`; }
    case 'critOnRoll': return `déclenche un Critique sur certains jets`;
    case 'spendAdvantage': return `dépense ${o.amount} point(s) d'Avantage`;
    case 'light': return `émet de la lumière sur ${o.radiusM} m`;
    case 'intoxicate': return `échoue à résister à l'alcool`;
    case 'narrative': return o.text;
  }
  return assertNever(o);
}

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------

/** Met une majuscule initiale (première phrase d'un effet). */
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Effet MÉCANIQUE d'un Flow en prose JOUEUR — « Si {condition}, {conséquence}. » / « Jet de … : en cas
 *  de réussite … ». Switch EXHAUSTIF sur les 5 kinds de Flow (never en default). SOURCE UNIQUE joueur. */
export function humanizeFlow(f: Flow): string {
  switch (f.kind) {
    case 'do': {
      const e = f.effect as EffectOp;
      if (e && e.type === 'ops') return e.ops.map(humanizeOp).filter(Boolean).join(' ; ');
      return (f.effect as { type?: string }).type ?? '';
    }
    case 'seq': return f.steps.map(humanizeFlow).filter(Boolean).join(' ; ');
    case 'if': {
      const then = humanizeFlow(f.then);
      const base = `Si ${humanizeCondition(f.cond)}, ${then}`;
      return f.else ? `${base} ; sinon ${humanizeFlow(f.else)}` : base;
    }
    case 'test': {
      const who = f.test.skill ? refLabel('skills', f.test.skill) : (f.test.characteristic ? CHAR_LABELS[f.test.characteristic] : 'un Test');
      const opp = f.test.opposed ? ' opposé' : '';
      return `Jet${opp} de ${who} : en cas de réussite, ${humanizeFlow(f.success)} ; en cas d'échec, ${humanizeFlow(f.fail)}`;
    }
    case 'choice': {
      const cout = coutAvantageTexte(f.advantageCost);
      return `Au choix${cout ? ` (${cout} Avantage)` : ''} « ${f.prompt} » : si oui, ${humanizeFlow(f.yes)}${flowMuet(f.no) ? '' : ` ; sinon ${humanizeFlow(f.no!)}`}`;
    }
  }
  return assertNever(f);
}

/** Wrapper : effet de Flow rendu comme UNE phrase (majuscule initiale). Utilisé par `describe`. */
export function humanizeFlowSentence(f: Flow): string {
  return cap(humanizeFlow(f));
}

/** Bonus d'incantation d'un Domaine (`castBonus`) en français JOUEUR — « +10 par cible affectée par En
 *  flammes dans un rayon égal à votre Bonus de Force Mentale en mètres ». Contexte PLEIN TEXTE (fact
 *  « Bonus d'incantation », `registry.ts`) : ni jargon (« ≤ BFM m »), ni Markdown — État et Caractéristique
 *  en libellé résolu, jamais l'id brut. */
export function humanizeCastBonus(cb: { bonus: number; perCondition: string; radiusStat: CharKey }): string {
  return `+${cb.bonus} par cible affectée par ${conditionLabel(cb.perCondition)} dans un rayon égal à votre Bonus de ${CHAR_LABELS[cb.radiusStat]} en mètres`;
}
