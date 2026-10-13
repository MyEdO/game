import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { skills } from '../data';
import { CHAR_LABELS } from '../engine/types';
import { fr } from '../i18n/messages/fr';

/**
 * CLIQUET LEXICAL du LIBELLÉ D'ACTION d'un jet (#1078 LOT C1) — « un signe, un sens »
 * (`docs/charte-ui.md`, section « Contrat d'affichage d'un jet ») : dans le libellé d'étape composé
 * par `composeRollLabel` (`src/state/rollSeam.ts`), la PARENTHÈSE est le détail DÉRIVÉ par le moteur
 * (la compétence) et le TIRET LONG le séparateur acteur/action. Un libellé d'action qui porte
 * lui-même l'un de ces deux signes rend la même ligne ambiguë : « Ilsa — Mal de mer — mauvais temps
 * (Résistance) », « Ilsa — Tonneau d'eau (boire) (Résistance) ».
 *
 * COUVERTURE (un détecteur ne mesure que la sienne) : les trois entrées du slot ACTION —
 * `actionLabel:` (`RollRequest`/`openPartyTest`/`openWorldTest`), le 2ᵉ argument de
 * `composeRollLabel(` et le `label:` du `FlowTest` littéral passé à `openSkillTest(` (titre Z0 de la
 * modale de Test : `useTestJetProps`, `title: pt.label`) —, en LITTÉRAL et en CLÉ de catalogue (`t('cle')`/`tr('cle')`, résolue au
 * catalogue FR : c'est le texte rendu qui compte). Ce que ce scan ne voit PAS : un libellé venu de la DONNÉE (`def.label` d'une
 * Activité, `game.label` d'un jeu de taverne, `hazard.label` d'un péril) — mesuré à la main au
 * 2026-08-05, conforme côté `activities.json` (contexte `mer`) et `tavernGames.json` ; les deux
 * libellés à tiret d'`activities.json` (`semer-dissension-*`) sont de contexte `interlude`, qui
 * n'atteint pas ce slot.
 */

/** Les deux signes RÉSERVÉS du libellé composé : parenthèse (compétence dérivée) et tiret long
 *  (séparateur acteur/action). La ponctuation restante n'est PAS traquée ici — un nom de règle cité
 *  au Source en porte (« Ça va lâcher, capitaine ! », MDG 13 l.121). */
const RESERVED = /[()—]/;

/** Les trois ANCRES du slot ACTION. Celle d'`openSkillTest(get, set, { … label: … })` lit le `label:` de
 *  PREMIER niveau du `FlowTest` littéral (deux niveaux d'objets imbriqués franchis : `skill: { id }`,
 *  `stake: combatStakeRef(…, { values: { … } })`) ; un `FlowTest` passé par variable n'est pas lu ici. */
const ACTION_SLOT = String.raw`(?:actionLabel:\s*|composeRollLabel\(\s*[^,()]+,\s*|openSkillTest\(\s*[^,()]+,\s*[^,()]+,\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*?\blabel:\s*)`;

/** Littéraux en position de LIBELLÉ D'ACTION (`ACTION_SLOT`). Les trois formes de chaîne sont
 *  couvertes ; une interpolation `${…}` n'est PAS un signe réservé (« Évaluer ${offer.label} » est
 *  conforme), seuls les signes ÉCRITS comptent. */
const ACTION_LABEL_RX = new RegExp(ACTION_SLOT + String.raw`(['"${'`'}])((?:\\.|(?!\1)[\s\S])*?)\1`, 'g');

/** Le MÊME slot en CLÉ de catalogue, paramétrée ou non, alias `tr(` compris (forme de `ROLL_LABEL_KEY_RX`). */
const ACTION_LABEL_KEY_RX = new RegExp(ACTION_SLOT + String.raw`t\s*r?\(\s*'([^']+)'\s*[,)]`, 'g');

export interface ActionLabelHit { line: number; text: string }

/** Scanne un source et rend les libellés d'action porteurs d'un signe réservé (exporté pour la
 *  preuve fail-closed ci-dessous : le scanner se mesure sur du code SYNTHÉTIQUE, pas seulement sur
 *  l'arbre — un détecteur muet passerait vert sur un arbre déjà propre). */
export function scanActionLabels(src: string): ActionLabelHit[] {
  const hits: ActionLabelHit[] = [];
  for (const m of src.matchAll(ACTION_LABEL_RX)) {
    if (!RESERVED.test(m[2])) continue;
    hits.push({ line: src.slice(0, m.index).split('\n').length, text: m[2] });
  }
  for (const m of src.matchAll(ACTION_LABEL_KEY_RX)) {
    const text = (fr as Record<string, string>)[m[1]];
    if (text == null || !RESERVED.test(text)) continue;
    hits.push({ line: src.slice(0, m.index).split('\n').length, text });
  }
  return hits;
}

describe('CLIQUET — le libellé d’ACTION d’un jet ne porte ni parenthèse ni tiret long (#1078)', () => {
  it('aucun libellé d’action ne porte un signe réservé', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      for (const h of scanActionLabels(text)) offenders.push(`${rel}:${h.line} — « ${h.text} »`);
    }
    expect(
      offenders,
      'Libellé d’action à signe réservé : la parenthèse est la compétence DÉRIVÉE, le tiret long le séparateur acteur/action — écrire un groupe nominal capitalisé (docs/charte-ui.md) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  it('fail-closed : une parenthèse d’usage SYNTHÉTIQUE est détectée', () => {
    expect(scanActionLabels(`label: composeRollLabel(h, "Tonneau d'eau (boire)", test),`)).toHaveLength(1);
    expect(scanActionLabels(`  actionLabel: 'Recherche active (au port)',`)).toHaveLength(1);
  });

  it('fail-closed : une CLÉ de catalogue dont le texte porte un signe réservé est détectée, dans les deux entrées du slot', () => {
    expect(scanActionLabels("label: composeRollLabel(force.actor, t('difficulty.intermediaire', { label }), test),")).toHaveLength(1);
    expect(scanActionLabels("  actionLabel: tr('difficulty.intermediaire'),")).toHaveLength(1);
    expect(scanActionLabels("label: composeRollLabel(force.actor, t('sv.degagement'), test),")).toEqual([]);
  });

  it('fail-closed : le `label` du FlowTest littéral d’`openSkillTest` est le slot ACTION', () => {
    expect(scanActionLabels("openSkillTest(get, set,\n  { skill: { id: skillId }, difficulty: 'intermediaire', label: `Avantage — ${skillLabel}`, stake: combatStakeRef('x', { values: { capChar } }) },\n  EMPTY_FLOW)")).toHaveLength(1);
    expect(scanActionLabels("openSkillTest(get, set, { stake: combatStakeRef('x', { values: { a: 1 } }), label: 'Recherche (au port)' }, EMPTY_FLOW)"), 'après deux niveaux imbriqués').toHaveLength(1);
    expect(scanActionLabels("openSkillTest(get, set, { skill: { id: 'x' }, label: t('difficulty.intermediaire') }, EMPTY_FLOW)"), 'clé de catalogue').toHaveLength(1);
    expect(scanActionLabels("openSkillTest(get, set, { skill: { id: 'commandement' }, label: t('step.contagion') }, EMPTY_FLOW)")).toEqual([]);
    expect(scanActionLabels("openSkillTest(get, set, { skill: { id: 'x', label: 'Voile (Chaland)' } }, EMPTY_FLOW)"), 'un `label:` imbriqué n’est pas le slot').toEqual([]);
  });

  it('fail-closed : un tiret long de situation SYNTHÉTIQUE est détecté', () => {
    expect(scanActionLabels(`label: composeRollLabel(h, 'Mal de mer — mauvais temps', test),`)).toHaveLength(1);
  });

  it('un groupe nominal conforme passe — l’interpolation n’est pas un signe', () => {
    expect(scanActionLabels(`actionLabel: 'Recherche d’acheteur',`)).toEqual([]);
    expect(scanActionLabels('actionLabel: `Évaluer ${offer.label}`,')).toEqual([]);
    expect(scanActionLabels(`label: composeRollLabel(h, 'Mal de mer par mauvais temps', test),`)).toEqual([]);
  });
});

/**
 * VOLET 2 (#1109) — le LIBELLÉ DE LIGNE d'un pas qui lance (`CascadeStep.rollLabel`) nomme la
 * COMPÉTENCE lancée, jamais la SITUATION : zone Z5 du contrat (`docs/charte-ui.md`). « Mal de mer »,
 * « Scorbut », « Tonneau contaminé » sont des situations — la ligne du jet, elle, dit « Résistance »
 * (précédents mesurés : `state/approach-fear.test.ts`, `state/combat/venin-test.test.ts`).
 *
 * MESURE : un `rollLabel` littéral de `src/state` (les `rollLabel` de `src/ui` sont le libellé du
 * BOUTON « Lancer », `RollRowProps` — autre champ, hors périmètre) doit être un libellé du CATALOGUE
 * — compétence (`skills`), caractéristique (`CHAR_LABELS`), ou compétence + spécialisation entre
 * parenthèses (« Métier (Cartographe) ») — apostrophes normalisées (le catalogue écrit `'`, les sites
 * écrivent parfois `’`).
 *
 * Un `rollLabel` CALCULÉ par `refLabel(…)` se mesure à part : il doit nommer le catalogue `skills`
 * (assertion ci-dessous). Ternaire et variable restent hors de ce scan lexical. Précédent d'un autre
 * catalogue : les rôles d'équipage (`findCrewRoleById(…).label`, #1112), couverts par le volet 3.
 */
const norm = (s: string): string => s.replace(/[’‘]/g, "'").trim();
const CATALOGUE_LABELS = new Set<string>([...skills.map((s) => norm(s.label)), ...Object.values(CHAR_LABELS).map(norm)]);

/** Libellé de COMPÉTENCE (ou carac), spécialisation entre parenthèses comprise. */
export function isCompetenceLabel(text: string): boolean {
  const n = norm(text);
  return CATALOGUE_LABELS.has(n) || CATALOGUE_LABELS.has(n.replace(/\s*\([^)]*\)$/, ''));
}

const ROLL_LABEL_RX = /rollLabel:\s*(['"])((?:\\.|(?!\1)[\s\S])*?)\1/g;

/** `rollLabel: t('cle')` — le MÊME slot, une fois la migration i18n passée par là (#1318 V8c₃). Sans
 *  cette forme, passer un libellé-situation au catalogue le faisait DISPARAÎTRE de ce cliquet sans
 *  qu'aucune situation ne soit assainie : une fausse décroissance. La clé est RÉSOLUE au catalogue FR,
 *  puis jugée par le MÊME `isCompetenceLabel` — c'est le texte rendu qui compte, pas sa provenance.
 *
 *  DEUX trous de la première écriture, refermés à la micro-passe (chacun laissait ré-ouvrir la fuite) :
 *  la clé PARAMÉTRÉE (`t('cle', { … })` — la parenthèse ne fermait pas juste après la clé) et l'ALIAS
 *  `tr(` (les fichiers où `t` est un identifiant local — `combatFlow`, `trauma`, `seaVoyageFlow`). */
const ROLL_LABEL_KEY_RX = /rollLabel:\s*t\s*r?\(\s*'([^']+)'\s*[,)]/g;

/** Rend les `rollLabel` littéraux qui nomment autre chose qu'une Compétence (exporté pour la preuve
 *  fail-closed : le scanner se mesure aussi sur du code SYNTHÉTIQUE). */
export function scanRollLabels(src: string): ActionLabelHit[] {
  const hits: ActionLabelHit[] = [];
  for (const m of src.matchAll(ROLL_LABEL_RX)) {
    if (isCompetenceLabel(m[2])) continue;
    hits.push({ line: src.slice(0, m.index).split('\n').length, text: m[2] });
  }
  for (const m of src.matchAll(ROLL_LABEL_KEY_RX)) {
    const text = (fr as Record<string, string>)[m[1]];
    if (text == null || isCompetenceLabel(text)) continue;
    hits.push({ line: src.slice(0, m.index).split('\n').length, text });
  }
  return hits;
}

describe('CLIQUET — un `rollLabel` nomme la COMPÉTENCE, pas la situation (#1109)', () => {
  const situationSites = (): string[] => {
    const out: string[] = [];
    for (const { rel, text } of readCorpus(['src/state'])) {
      for (const h of scanRollLabels(text)) out.push(`${rel}:${h.line} — « ${h.text} »`);
    }
    return out;
  };

  it('aucun `rollLabel` ne nomme une situation', () => {
    const sites = situationSites();
    expect(
      sites,
      '`rollLabel` qui nomme une SITUATION — la ligne du jet dit la Compétence lancée (Z5, docs/charte-ui.md) :\n' + sites.join('\n'),
    ).toEqual([]);
  });

  it('un `rollLabel` calculé par `refLabel(` nomme le catalogue `skills`', () => {
    const autres: string[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      for (const [i, ligne] of text.split('\n').entries()) {
        if (!/\brollLabel:/.test(ligne)) continue;
        for (const m of ligne.matchAll(/\brefLabel\(\s*(['"])([^'"]+)\1/g)) if (m[2] !== 'skills') autres.push(`${rel}:${i + 1} — ${m[2]}`);
      }
    }
    expect(autres, '`rollLabel` résolu hors du catalogue des Compétences :\n' + autres.join('\n')).toEqual([]);
  });

  it('fail-closed : un `rollLabel`-situation SYNTHÉTIQUE est détecté, une Compétence passe', () => {
    expect(scanRollLabels(`rollLabel: 'Gueule de bois', base: 40,`)).toHaveLength(1);
    expect(scanRollLabels(`rollLabel: 'Résistance', base: 40,`)).toEqual([]);
    expect(scanRollLabels(`rollLabel: 'Force Mentale', base: 40,`), 'une caractéristique aussi').toEqual([]);
    expect(scanRollLabels(`rollLabel: 'Métier (Cartographe)', base: 40,`), 'compétence + spécialisation').toEqual([]);
    expect(scanRollLabels(`rollLabel: 'Conduite d’attelage', base: 40,`), 'apostrophe typographique').toEqual([]);
    // …et la forme CATALOGUE du même slot : la clé est résolue, puis jugée sur son TEXTE.
    expect(scanRollLabels("rollLabel: t('sv.scurvy'),"), 'clé-situation au catalogue').toHaveLength(1);
    expect(scanRollLabels("rollLabel: t('char.force'),"), 'clé de caractéristique').toEqual([]);
    // Les DEUX trous du premier RX, chacun ROUGE avant son correctif :
    expect(scanRollLabels("rollLabel: t('sv.scurvy', { n: 2 }),"), 'clé PARAMÉTRÉE').toHaveLength(1);
    expect(scanRollLabels("rollLabel: tr('sv.scurvy'),"), "alias `tr(` (portées où `t` est local)").toHaveLength(1);
    expect(scanRollLabels("rollLabel: tr('char.force', { x: 1 }),"), 'alias + params, mais une carac').toEqual([]);
  });
});


/**
 * VOLET 3 (#1112) — le LIBELLÉ D'UNE LIGNE DE JET fabriquée dans `src/state` (`RollBreakdown` d'une
 * modale, `NightEntry.d` d'un procès-verbal) nomme la COMPÉTENCE / la CARACTÉRISTIQUE lancée (Z5), et
 * JAMAIS une autre nomenclature : le rôle tenu, la situation, le nom de l'action. La provenance (rôle
 * d'équipage, poste) vit sur l'entrée, pas sur la ligne.
 */
const CREW_CATALOGUE_RX = /\b(findCrewRoleById|crewRoles|crewRoleById|role\??\.label)\b/;

/** Littéraux de LIGNE DE JET (`{ … label: … roll: … }`) d'un fichier : leur libellé (littéral) et
 *  l'expression brute quand il est calculé. Exporté pour la preuve fail-closed. */
export function scanRollLineLabels(src: string): { line: number; text: string; computed: boolean }[] {
  const out: { line: number; text: string; computed: boolean }[] = [];
  for (const m of src.matchAll(/\broll:/g)) {
    const i = m.index!;
    let depth = 0;
    let start = -1;
    for (let j = i; j >= 0; j--) {
      if (src[j] === '}') depth++;
      else if (src[j] === '{') { if (depth === 0) { start = j; break; } depth--; }
    }
    if (start < 0) continue;
    let end = -1;
    depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { if (depth === 0) { end = j; break; } depth--; }
    }
    if (end < 0) continue;
    const lit = src.slice(start, end);
    if (!/\btarget\s*:/.test(lit)) continue; // pas une ligne de jet (base + cible + dé)
    // Une ligne de jet est un littéral COURT ; au-delà, l'accolade englobante est celle d'un bloc
    // (slice de store, fonction) qui contient par hasard `roll:`/`target:` — hors périmètre.
    if (lit.length > 600) continue;
    const lab = /\blabel:\s*([^,\r\n]+)/.exec(lit);
    if (!lab) continue;
    const raw = lab[1].trim();
    const literal = /^(['"])((?:\\.|(?!\1)[\s\S])*?)\1$/.exec(raw);
    out.push({ line: src.slice(0, start).split('\n').length, text: literal ? literal[2] : raw, computed: !literal });
  }
  return out;
}

describe('CLIQUET — le libellé d’une LIGNE de jet nomme la Compétence lancée (#1112 volet 3)', () => {
  // PÉRIMÈTRE ÉTENDU (#1117) : le FABRICANT de rangées-participants vit dans `src/ui`
  // (`buildParticipantRows`) et dérivait son libellé d'un `part.label` CALCULÉ — il échappait donc au
  // scan des littéraux de `src/state`. Le trou est celui-là : on scanne les deux couches.
  const files = () => readCorpus(['src/state', 'src/ui']);

  it('aucun libellé de ligne LITTÉRAL qui ne soit une Compétence/Caractéristique du catalogue', () => {
    const bad: string[] = [];
    for (const { rel, text } of files()) {
      for (const h of scanRollLineLabels(text)) {
        if (h.computed || isCompetenceLabel(h.text)) continue;
        bad.push(`${rel}:${h.line} — « ${h.text} »`);
      }
    }
    expect(bad, ['Libellé de LIGNE de jet qui ne nomme pas la Compétence lancée (Z5, docs/charte-ui.md) :', ...bad].join('\n')).toEqual([]);
  });

  it('aucun libellé de ligne RÉSOLU depuis le catalogue des rôles d’équipage (crew-roles)', () => {
    const bad: string[] = [];
    for (const { rel, text } of files()) {
      for (const h of scanRollLineLabels(text)) {
        if (!h.computed || !CREW_CATALOGUE_RX.test(h.text)) continue;
        bad.push(`${rel}:${h.line} — ${h.text}`);
      }
    }
    expect(bad, ['Le rôle d’équipage est une PROVENANCE, jamais le libellé de la ligne de jet :', ...bad].join('\n')).toEqual([]);
  });

  it('fail-closed : une ligne SYNTHÉTIQUE mal nommée est détectée, une ligne bien nommée passe', () => {
    const roleLine = `d: { label: 'Capitaine', base: 40, modifier: 0, target: 40, roll: 12, success: true, sl: 3 }`;
    const skillLine = `d: { label: 'Voile', base: 40, modifier: 0, target: 40, roll: 12, success: true, sl: 3 }`;
    const computedRole = `d: { label: findCrewRoleById(a.roleId)?.label ?? '', base: 40, modifier: 0, target: 40, roll: 12, success: true, sl: 3 }`;
    expect(scanRollLineLabels(roleLine).filter((h) => !h.computed && !isCompetenceLabel(h.text))).toHaveLength(1);
    expect(scanRollLineLabels(skillLine).filter((h) => !h.computed && !isCompetenceLabel(h.text))).toEqual([]);
    expect(scanRollLineLabels(computedRole).filter((h) => h.computed && CREW_CATALOGUE_RX.test(h.text))).toHaveLength(1);
  });
});

/**
 * VOLET 4 (#1111) — la forme « Action (Compétence) » du sous-titre Z1 (`docs/charte-ui.md`, « Contrat
 * d'affichage d'un jet ») n'a qu'un composeur, `composeRollLabel` (`src/state/rollSeam.ts`). Une
 * PARENTHÈSE remplie d'un libellé de Compétence ou de Caractéristique hors de lui est une seconde
 * source de la même forme (précédent : `riverVoyageFlow.ts`, étape `river-nav`, #1111).
 *
 * MESURE : les quatre portes d'une parenthèse de libellé — la fabrique `stepPrecision(sujet, precision)`,
 * tout gabarit de LIBELLÉ D'ÉTAPE du catalogue FR (`step.*`, `i18n/messages/fr.ts`) dont un
 * paramètre est écrit entre parenthèses (`'{sujet} ({precision})'`), appelé par `t(`/`tr(`, le gabarit
 * LITTÉRAL (`` `… (${…})` ``) et la CONCATÉNATION (`' (' + … + ')'`) —, dont l'argument de la parenthèse
 * est un libellé du catalogue des Compétences/Caractéristiques : appel `refLabel('skills', …)`,
 * `testSkillLabel(…)`, `skillRefLabel(…)`, `CHAR_LABELS[…]`, littéral, ou clé de catalogue dont le
 * texte en est un (`isCompetenceLabel`). Une variable nue n'est PAS lue. Cinquième porte : toute VALEUR du
 * catalogue FR qui ÉCRIT la parenthèse en dur (« manœuvre d'évitement (Navigation) », #1111).
 */
const SKILL_LABEL_CALL_RX = /^(?:refLabel\(\s*['"]skills['"]|testSkillLabel\(|skillRefLabel\(|CHAR_LABELS\[)/;

/** L'expression ÉCRITE nomme-t-elle une Compétence/Caractéristique du catalogue ? */
function isSkillLabelExpr(expr: string): boolean {
  const e = expr.trim();
  if (SKILL_LABEL_CALL_RX.test(e)) return true;
  const literal = /^(['"`])((?:\.|(?!\1)[\s\S])*)\1$/.exec(e);
  if (literal) return !literal[2].includes('${') && isCompetenceLabel(literal[2]);
  const key = /^t\s*r?\(\s*'([^']+)'\s*\)$/.exec(e);
  if (key) {
    const text = (fr as Record<string, string>)[key[1]];
    return text != null && isCompetenceLabel(text);
  }
  return false;
}

/** Arguments de PREMIER niveau d'un appel dont `open` indexe la parenthèse ouvrante (chaînes et
 *  imbrications `()[]{}` franchies). `undefined` si l'appel ne se ferme pas. */
function topLevelArgs(src: string, open: number): string[] | undefined {
  const args: string[] = [];
  let depth = 0;
  let from = open + 1;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = src.indexOf(ch, j + 1);
      if (end < 0) return undefined;
      j = end;
    } else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) { args.push(src.slice(from, j)); return args; }
    } else if (ch === ',' && depth === 1) { args.push(src.slice(from, j)); from = j + 1; }
  }
  return undefined;
}

/** Les paramètres que le texte FR d'une clé de libellé d'étape (`step.*`) écrit ENTRE PARENTHÈSES. */
const PARENTHESIZED_PARAMS = new Map<string, string[]>(
  Object.entries(fr as Record<string, string>)
    .filter(([k]) => k.startsWith('step.'))
    .map(([k, v]): [string, string[]] => [k, [...v.matchAll(/\(\{(\w+)\}\)/g)].map((m) => m[1])])
    .filter(([, ps]) => ps.length > 0),
);

/** Rend les parenthèses de libellé remplies d'une Compétence/Caractéristique hors `composeRollLabel`
 *  (exporté pour la preuve fail-closed). */
export function scanManualSkillParenthesis(src: string): ActionLabelHit[] {
  const hits: ActionLabelHit[] = [];
  const at = (i: number): number => src.slice(0, i).split('\n').length;
  for (const m of src.matchAll(/\bstepPrecision\(/g)) {
    const args = topLevelArgs(src, m.index! + m[0].length - 1);
    if (args?.[1] != null && isSkillLabelExpr(args[1])) hits.push({ line: at(m.index!), text: args[1].trim() });
  }
  for (const m of src.matchAll(/\bt\s*r?\(\s*'([^']+)'\s*,/g)) {
    const params = PARENTHESIZED_PARAMS.get(m[1]);
    if (!params) continue;
    const args = topLevelArgs(src, src.indexOf('(', m.index!));
    const obj = args?.[1]?.trim();
    if (!obj?.startsWith('{')) continue;
    const fields = topLevelArgs(obj, 0) ?? [];
    for (const field of fields) {
      const kv = /^\s*(\w+)\s*:\s*([\s\S]+)$/.exec(field);
      if (kv && params.includes(kv[1]) && isSkillLabelExpr(kv[2])) hits.push({ line: at(m.index!), text: `${m[1]} ← ${kv[2].trim()}` });
    }
  }
  // Gabarit LITTÉRAL : `(${expr})`, l'interpolation seule entre les parenthèses.
  for (const m of src.matchAll(/\(\$\{/g)) {
    const open = m.index! + 2;
    const close = closingBrace(src, open);
    if (close < 0 || src[close + 1] !== ')') continue;
    const expr = src.slice(open + 1, close);
    if (isSkillLabelExpr(expr)) hits.push({ line: at(m.index!), text: expr.trim() });
  }
  // CONCATÉNATION : une chaîne qui finit par `(`, puis `+ expr`.
  for (const m of src.matchAll(/\((['"`])\s*\+\s*/g)) {
    const expr = concatOperand(src, m.index! + m[0].length);
    if (isSkillLabelExpr(expr)) hits.push({ line: at(m.index!), text: expr.trim() });
  }
  return hits;
}

/** Index de l'accolade qui ferme celle ouverte à `open` (chaînes franchies), `-1` sinon. */
function closingBrace(src: string, open: number): number {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const ch = src[j];
    if (ch === "'" || ch === '"') { const end = src.indexOf(ch, j + 1); if (end < 0) return -1; j = end; }
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return j; }
  }
  return -1;
}

/** L'opérande d'une concaténation qui commence à `from` : jusqu'au `+`, `)`, `,` ou `;` de PREMIER niveau. */
function concatOperand(src: string, from: number): string {
  let depth = 0;
  for (let j = from; j < src.length; j++) {
    const ch = src[j];
    if (ch === "'" || ch === '"' || ch === '`') { const end = src.indexOf(ch, j + 1); if (end < 0) return src.slice(from); j = end; }
    else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if ((ch === ')' || ch === ']' || ch === '}') && depth > 0) depth--;
    else if (depth === 0 && (ch === '+' || ch === ')' || ch === ',' || ch === ';' || ch === '\n')) return src.slice(from, j);
  }
  return src.slice(from);
}

/** Sites où la parenthèse précise un MODIFICATEUR, pas une Action : clé `fichier — expression`. */
const PARENTHESE_HORS_ACTION = new Map<string, string>([
  ['src/engine/ops.ts — CHAR_LABELS[o.char]', 'op.testMod : « +10 (Force) » nomme la Caractéristique du modificateur, aucun jet n’est libellé'],
]);

/** Le Test de Navigation (MDG 13 l.18-19) : nom de famille du Test de Voile/Ramer, qu'une parenthèse
 *  écrite en dur substitue à la Compétence réellement lancée. */
const TEST_DE_NAVIGATION = norm((fr as Record<string, string>)['sv.navigation']);

/** Les parenthèses ÉCRITES EN DUR dans une valeur du catalogue (`cle → texte`) dont le contenu est un libellé
 *  de Compétence/Caractéristique, ou le Test de Navigation (exporté pour la preuve fail-closed). */
export function scanCatalogueSkillParenthesis(catalogue: Record<string, string>): string[] {
  const hits: string[] = [];
  for (const [cle, texte] of Object.entries(catalogue)) {
    for (const m of texte.matchAll(/\(([^(){}]+)\)/g)) {
      if (isCompetenceLabel(m[1]) || norm(m[1]) === TEST_DE_NAVIGATION) hits.push(`${cle} — « ${texte} »`);
    }
  }
  return hits;
}

describe('CLIQUET — « Action (Compétence) » n’est composé que par `composeRollLabel` (#1111)', () => {
  it('aucune valeur du catalogue FR n’écrit « (Compétence) » en dur', () => {
    const bad = scanCatalogueSkillParenthesis(fr as Record<string, string>);
    expect(bad, ['« (Compétence) » écrit en dur au catalogue — la Compétence se DÉRIVE (`composeRollLabel`, Z1, docs/charte-ui.md) :', ...bad].join('\n')).toEqual([]);
  });

  it('fail-closed : une valeur SYNTHÉTIQUE à « (Compétence) » en dur est détectée, une parenthèse d’autre nature passe', () => {
    expect(scanCatalogueSkillParenthesis({ x: "{peril} — manœuvre d'évitement (Navigation) : {issue}" })).toHaveLength(1);
    expect(scanCatalogueSkillParenthesis({ x: 'Test (Force Mentale)' }), 'caractéristique').toHaveLength(1);
    expect(scanCatalogueSkillParenthesis({ x: '{sujet} ({precision})' }), 'paramètre').toEqual([]);
    expect(scanCatalogueSkillParenthesis({ x: 'Rocher (2 coups)' }), 'parenthèse d’autre nature').toEqual([]);
  });

  it('aucune parenthèse de libellé remplie d’une Compétence hors du composeur', () => {
    const bad: string[] = [];
    const exemptions = new Set<string>();
    for (const { rel, text } of readCorpus(['src'])) {
      for (const h of scanManualSkillParenthesis(text)) {
        const site = `${rel} — ${h.text}`;
        if (PARENTHESE_HORS_ACTION.has(site)) exemptions.add(site);
        else bad.push(`${rel}:${h.line} — ${h.text}`);
      }
    }
    expect([...PARENTHESE_HORS_ACTION.keys()].filter((k) => !exemptions.has(k)), 'exemption sans site vivant').toEqual([]);
    expect(bad, ['« Action (Compétence) » composé hors de `composeRollLabel` (Z1, docs/charte-ui.md) :', ...bad].join('\n')).toEqual([]);
  });

  it('fail-closed : chaque porte SYNTHÉTIQUE est détectée, une parenthèse qui n’est pas une Compétence passe', () => {
    expect(scanManualSkillParenthesis("label: stepPrecision(t('step.navigation'), refLabel('skills', { id: skillId })),")).toHaveLength(1);
    expect(scanManualSkillParenthesis('label: stepPrecision(t(\'step.navigation\'), testSkillLabel({ skill: "voile" })),')).toHaveLength(1);
    expect(scanManualSkillParenthesis("label: stepPrecision(t('step.navigation'), 'Voile'),"), 'littéral du catalogue').toHaveLength(1);
    expect(scanManualSkillParenthesis("label: stepPrecision(t('step.navigation'), t('char.force')),"), 'clé de caractéristique').toHaveLength(1);
    expect(scanManualSkillParenthesis("label: t('step.sujetPrecision', { sujet: t('step.navigation'), precision: refLabel('skills', { id: 'voile' }) }),"), 'gabarit du catalogue').toHaveLength(1);
    expect(scanManualSkillParenthesis("label: tr('step.sujetPrecision', { sujet: x, precision: CHAR_LABELS[c] }),"), 'alias `tr(`').toHaveLength(1);
    expect(scanManualSkillParenthesis("label: stepPrecision(tr('step.blessureCritique'), locationLabel(cloc, target.bodyShape)),"), 'localisation').toEqual([]);
    expect(scanManualSkillParenthesis("t('step.sujetPrecision', { sujet: refLabel('skills', { id: 'natation' }), precision: DIFFICULTY_LABELS[diff] })"), 'la Compétence en SUJET n’est pas la parenthèse').toEqual([]);
    expect(scanManualSkillParenthesis("label: composeRollLabel(undefined, t('step.navigation'), { skill: skillId }),"), 'le composeur').toEqual([]);
    expect(scanManualSkillParenthesis("descOfferte={npc ? `${npc.label} (${skillRefLabel(npc.skill)})` : undefined}"), 'gabarit littéral').toHaveLength(1);
    expect(scanManualSkillParenthesis("const l = `${action} (${CHAR_LABELS[c]})`;"), 'gabarit littéral, caractéristique').toHaveLength(1);
    expect(scanManualSkillParenthesis("label: h.label + ' (' + refLabel('skills', { id: 'voile' }) + ')',"), 'concaténation').toHaveLength(1);
    expect(scanManualSkillParenthesis("const l = `${sujet} (${locationLabel(loc)})`;"), 'gabarit littéral, localisation').toEqual([]);
    expect(scanManualSkillParenthesis("label: h.label + ' (' + h.role + ')',"), 'concaténation, variable nue').toEqual([]);
  });
});
