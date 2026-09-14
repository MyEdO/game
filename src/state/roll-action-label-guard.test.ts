import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { cleDeSite, ecartsDeStock, sitesEnEntrees } from '../../scripts/guards/lib/stock.mjs';
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
 * COUVERTURE (un détecteur ne mesure que la sienne) : les deux entrées du slot ACTION, en LITTÉRAL —
 * `actionLabel:` (`RollRequest`/`openPartyTest`/`openWorldTest`) et le 2ᵉ argument de
 * `composeRollLabel(`. Ce que ce scan ne voit PAS : un libellé venu de la DONNÉE (`def.label` d'une
 * Activité, `game.label` d'un jeu de taverne, `hazard.label` d'un péril) — mesuré à la main au
 * 2026-08-05, conforme côté `activities.json` (contexte `mer`) et `tavernGames.json` ; les deux
 * libellés à tiret d'`activities.json` (`semer-dissension-*`) sont de contexte `interlude`, qui
 * n'atteint pas ce slot.
 */

/** Les deux signes RÉSERVÉS du libellé composé : parenthèse (compétence dérivée) et tiret long
 *  (séparateur acteur/action). La ponctuation restante n'est PAS traquée ici — un nom de règle cité
 *  au Source en porte (« Ça va lâcher, capitaine ! », MDG 13 l.121). */
const RESERVED = /[()—]/;

/** Littéraux en position de LIBELLÉ D'ACTION : `actionLabel: '…'` et `composeRollLabel(x, '…', …)`.
 *  Les trois formes de chaîne sont couvertes ; une interpolation `${…}` n'est PAS un signe réservé
 *  (« Évaluer ${offer.label} » est conforme), seuls les signes ÉCRITS comptent. */
const ACTION_LABEL_RX = /(?:actionLabel:\s*|composeRollLabel\(\s*[^,()]+,\s*)(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g;

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
  return hits;
}

/**
 * EXEMPTION AU SITE (jamais au fichier) — un seul site, motivé : le péril à dégager est une DONNÉE
 * (`sea-perils.json` : Iceberg / Débris marins / Rocher / Bas-fonds) sans article, et aucune
 * composition nominale ne le recolle sans en inventer un. Le libellé reste tel quel tant que
 * l'arbitrage n'est pas rendu ; l'entrée porte le FICHIER et le TEXTE exact (pas une ligne, qui
 * dérive, ni un fichier entier, qui blanchirait tout ce qu'il contiendra).
 */
const ACTION_LABEL_STOCK: { file: string; text: string }[] = [
  { file: 'src/state/seaVoyageFlow.ts', text: 'Dégagement — ${label}' },
];

describe('CLIQUET — le libellé d’ACTION d’un jet ne porte ni parenthèse ni tiret long (#1078)', () => {
  it('aucun libellé d’action hors stock ne porte un signe réservé', () => {
    const offenders: string[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      for (const h of scanActionLabels(text)) {
        if (ACTION_LABEL_STOCK.some((s) => s.file === rel && s.text === h.text)) continue;
        offenders.push(`${rel}:${h.line} — « ${h.text} »`);
      }
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
 * écrivent parfois `’`). Sinon : entrée NOMINATIVE au stock ci-dessous, plafond COLLÉ et décroissant.
 *
 * ANGLE MORT assumé du volet : un `rollLabel` CALCULÉ (`refLabel(…)`, ternaire, variable) n'est pas lu
 * par ce scan lexical. Il n'est PAS pour autant sûr : un libellé calculé peut venir d'un AUTRE
 * catalogue que les compétences — précédent MESURÉ, les rôles d'équipage (`findCrewRoleById(…).label`
 * servait de libellé de LIGNE au procès-verbal de mer, #1112). Le volet 3 ci-dessous couvre cette
 * famille du côté des lignes de jet fabriquées dans `src/state`.
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

/** STOCK NOMINATIF (#1109) — les sites `rollLabel`-situation encore mesurés dans `src/state`, à la
 *  forme d'entrée de TOUT stock nominatif du dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) :
 *  `fichier` à ouvrir, `ref` = le TEXTE exact du libellé, `occurrence` = l'ordinal parmi ses
 *  homonymes. Les DEUX volets ci-dessous le tiennent des deux côtés — un site NEUF hors stock rougit
 *  à son fichier et à son texte, une entrée que plus aucun site ne porte rougit comme SOLDÉE —, et
 *  c'est le `fichier` que la porte de plage voit : un append ici se DIT au message par `CLIQUET:`.
 *  #1318 V8c₃ : le stock est passé au catalogue (`sv.*`) SANS changer un octet de son texte — il est
 *  donc TOUJOURS LÀ, et le scan le suit désormais jusqu'à sa clé. */
const ROLL_LABEL_SITUATION_STOCK = [
  { fichier: 'src/state/seaVoyageFlow.ts', ref: 'Tonneau contaminé', occurrence: 1 },
  { fichier: 'src/state/seaVoyageFlow.ts', ref: "Tonneau d'eau", occurrence: 1 },
];

describe('CLIQUET — un `rollLabel` nomme la COMPÉTENCE, pas la situation (#1109)', () => {
  const situationSites = (): { file: string; ref: string }[] => {
    const out: { file: string; ref: string }[] = [];
    for (const { rel, text } of readCorpus(['src/state'])) {
      for (const h of scanRollLabels(text)) out.push({ file: rel, ref: h.text });
    }
    return out;
  };
  const ecarts = ecartsDeStock({
    observe: sitesEnEntrees(situationSites()),
    stock: ROLL_LABEL_SITUATION_STOCK,
    cle: cleDeSite,
    remede: {
      neuve: (k: string) => `${k} — site NEUF : un \`rollLabel\` qui nomme une SITUATION, là où la ligne du jet dit la Compétence lancée (Z5, docs/charte-ui.md ; dette #1109).`,
      perimee: (k: string) => `${k} — entrée SOLDÉE : plus aucun site ne porte ce libellé, retirer cette entrée du stock.`,
    },
  });

  it('aucun site NEUF : tout `rollLabel`-situation est au stock nominatif', () => {
    expect(ecarts.neuves, ecarts.neuves.join('\n')).toEqual([]);
  });

  it('aucune entrée PÉRIMÉE : chaque entrée du stock est encore mesurée à son site (#1109)', () => {
    expect(ecarts.perimees, ecarts.perimees.join('\n')).toEqual([]);
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
