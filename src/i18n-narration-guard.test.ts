import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Garde-fou i18n — narration moteur (Phase C, plan évacué → #320).
 *
 * Règle : toute ligne de JOURNAL de combat/effet doit passer par le catalogue (`t(...)` / `tr(...)`),
 * jamais par un littéral FR brut. Le scan échoue si un SITE D'ÉMISSION de journal contient un littéral
 * de chaîne FRANÇAIS (cf. `isFrench`) au lieu d'un appel `t`.
 *
 * PÉRIMÈTRE INVERSÉ #410 (2026-07-13) : ancien jumeau exact du garde emoji FAINÉANT — l'ancienne
 * version n'auditait qu'une allowlist de fichiers MIGRÉS, laissant passer TOUT nouveau littéral FR
 * d'un fichier non listé. Le scan balaie TOUT `SCAN_DIRS` (walk récursif), sans liste : tout fichier
 * naît couvert, et aucun ne porte de littéral FR (ABSOLUE depuis #1318 V8c₅, 2026-08-17).
 *
 * Couvre les FORMES d'émission de journal (PAS les libellés de MODALE/UI `{label:…}`/`prompt:` —
 * surface UI distincte, Phase D différée) :
 *   - `ev('<kind>', `…``               (événement de journal)
 *   - `.log(`…`` / `.log('…'`          (journal direct)
 *   - `<arr>.push(`…``                  (poussée d'une LIGNE de journal — string nu en littéral)
 *   - `castRefused(…, `…``              (refus d'incantation journalisé)
 *   - `return `…``                      (issue renvoyée par un describer pur, ex. flowOutcomes)
 *   - `t('cle', { x: '…' })`            (PARAMÈTRE d'un appel de catalogue — interpolé, donc AFFICHÉ :
 *                                        un `t()` autour ne met pas la prose au catalogue, 8ᵉ forme V8c₅)
 *
 * NON couvert volontairement : les tableaux `outcome: […]` / `options: […]` / `label:`/`prompt:`
 * d'étape de MODALE (surface UI distincte, Phase D) — leurs chaînes ne sont PAS du journal.
 */

const SCAN_DIRS = ['src/engine', 'src/state', 'src/noyau'];

/** Fichiers DISPENSÉS par NATURE (#1117) : leur sortie n'est pas une surface de JEU mais une sortie
 *  d'OUTIL de développement — la console de recette (`__wfrp.*`), lue par un développeur/recetteur,
 *  jamais par un joueur. Traduire ces verdicts n'a aucun sens, et les compter ne mesure rien (chaque
 *  helper de recette en ajoute par construction). Dispense STRUCTURELLE et NOMINATIVE — elle
 *  ne s'étend pas d'elle-même : ajouter un fichier ici demande de justifier que sa surface est
 *  hors-jeu. */
const DEV_ONLY = new Set([
  'src/state/devtools.ts', // outillage `__wfrp` de la recette navigateur (docs/recette-navigateur.md)
  // #1318 V8c₅ : export ASCII d'une scène — ses surfaces sont la modale d'export de l'ÉDITEUR
  // (`ui/editor/Editor.tsx`) et la console de recette (`state/devtools.ts`), et sa sortie est un FICHIER SOURCE `.ts` commenté,
  // recollé à la main par l'auteur de map (« `bind` (marqueurs → poses) … non réémis »). Une 2ᵉ langue
  // ne traduit pas du code d'authoring : même nature que `devtools.ts`, dispensé au même titre.
  'src/noyau/monde/sceneToAscii.ts',
]);

/**
 * PRÉDICAT DE FRANCITÉ — HEURISTIQUE, et c'est dit ici (#1333, V8c₀).
 *
 * Trois marques, dans cet ordre : (1) une lettre ACCENTUÉE ; (2) des GUILLEMETS français `« »`
 * (ponctuation de locale) ; (3) un MOT-OUTIL français ou une ÉLISION (`d'`, `l'`, `n'`…) dans un
 * littéral qui contient au moins une espace. La marque (1) seule laissait passer ~67 littéraux FR
 * mesurés sur `src/engine`+`src/state` (« pas de ligne de vue », « Impossible de sauvegarder en plein
 * combat. », « Bourse insuffisante pour … ») — un texte français sans accent restait invisible.
 *
 * Les marques (2) et (3) se lisent sur la PROSE du littéral, ses interpolations `${…}` ôtées : le code
 * interpolé n'est pas du texte, et le lire déclenchait sur `${n > 1 ? 's' : ''}` (élision apparente).
 *
 * LIMITES RÉSIDUELLES, nommées (le garde MESURE ce qu'il sait voir, il ne certifie pas le zéro) :
 *   - phrase FR sans accent, sans guillemets ET sans mot-outil : `reprend connaissance.`,
 *     `Vente : …`, la forme `{sujet} — {quoi} !` (`{label} — MALADRESSE ({roll}) !`, `interludeFlow`)
 *     restent hors du compte. MESURÉ sur trois d'entre eux (`isFrench` rendu `false` pour les trois) :
 *     `combatEffects.ts:1517` « incante … (rituel garanti). », `consumableFlow.ts:128` « utilise : … »,
 *     `partyFlow.ts:615` « +{xp} PX (Ambition accomplie). ». Conséquence à dire : le compte de
 *     `consumableFlow.ts` est 0, ce qui ne veut pas dire « aucun texte FR », seulement « aucun que ce
 *     prédicat sache voir » ;
 *   - littéral d'UN SEUL mot FR (`Carreaux`, `Aucun`, `Standard`) : indiscernable d'un id/clé ASCII —
 *     écarté volontairement (l'espace est la condition de la marque 3) ;
 *   - un mot-outil FR dans une chaîne TECHNIQUE la ferait compter (aucun cas mesuré sur le stock
 *     courant : 0 faux positif sur les 67 littéraux nouvellement captés) ;
 *   - le périmètre reste celui des FORMES d'émission ci-dessus — un littéral posé ailleurs (champ
 *     `reason:`, retour d'objet) n'est vu par aucune marque, faute d'être scanné. DEUX fichiers l'ont
 *     démontré, parce qu'ils portaient du texte JOUEUR (leurs `reason` remontent à l'écran via
 *     `pf.refused`/`pf.designateRefused`) sans peser un seul point de gel : `src/engine/advancement.ts`
 *     (« PX insuffisants », « Compétence inconnue »…) et `src/engine/careerSlots.ts` (« emplacement déjà
 *     désigné », « un seul Domaine sombre autorisé… »). V8c₅ les a migrés — leur zéro ne prouve
 *     toujours que ce que ces huit formes savent voir.
 *
 * CE QUE CE ZÉRO EST, DONC : la COUVERTURE de ce prédicat sur ces huit formes — jamais la dette totale
 * de FR-hors-catalogue de `SCAN_DIRS`. Il dit « plus rien de ce que je sais voir », pas « plus un
 * littéral » — les formes ci-dessus restent hors de portée dans l'absolu. Toute réapparition dans ce
 * périmètre ROUGIT.
 */
const ACCENT = /[éèêëàâäçôöûùîïœÉÈÊÀÂÇÔÛ]/;
const FR_QUOTES = /[«»]/;
const FR_WORDS =
  /(^|[^A-Za-zÀ-ÿ])(le|la|les|un|une|des|du|de|au|aux|et|est|ne|pas|sur|par|pour|dans|avec|sans|que|qui|ce|cette|ces|son|ses|leur|vers|chez|entre|sous|contre|se|en|vous|votre)([^A-Za-zÀ-ÿ]|$)/i;
const FR_ELISION = /(^|[^A-Za-zÀ-ÿ])[dlnjcmst]['’]/i;

/** `lit` = littéral AVEC ses délimiteurs, tel que rendu par `readString`. */
export function isFrench(lit: string): boolean {
  if (ACCENT.test(lit)) return true;
  const prose = lit.slice(1, -1).replace(/\$\{[^}]*\}/g, ' ');
  if (FR_QUOTES.test(prose)) return true;
  return /\s/.test(prose) && (FR_WORDS.test(prose) || FR_ELISION.test(prose));
}

/** Retire commentaires de ligne et de bloc (sans toucher aux chaînes — heuristique suffisante ici). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Sites d'émission de JOURNAL : le littéral de chaîne suit DIRECTEMENT l'ouverture (pas un `t(`/`tr(`). */
const EMIT_SHAPES: RegExp[] = [
  /\.log\(\s*(['"`])/g, // get().log('…') / env.log(`…`)
  /\bev\('[a-z]+',\s*(['"`])/g, // ev('kind', `…`)
  /\.push\(\s*(['"`])/g, // <journalArray>.push(`…`)
  /castRefused\([^;]*?,\s*(['"`])/g, // castRefused(get, set, c, `…`)
  /\breturn\s+(['"`])/g, // return `…` (describer pur ; PAS `return [` = tableau de modale)
];

/** Forme INITIALISEUR d'un tableau de lignes : `const lines: string[] = [`…`, `…`]`. Semer le tableau
 *  à la déclaration OU l'alimenter par `.push` est le MÊME site d'émission ; sans cette forme, déplacer
 *  un littéral de l'un vers l'autre le faisait DISPARAÎTRE du compte (fausse décroissance de baseline,
 *  mesurée sur `interludeFlow.ts` au passage de #942 L7). Les éléments de tête sont lus un à un —
 *  compter le seul premier rejouerait le même trou d'un cran plus loin. */
const ARRAY_SEED = /:\s*string\[\]\s*=\s*\[/g;

/**
 * Extrait le littéral de chaîne qui commence au délimiteur `quote` à la position `from`.
 *
 * L'ÉCHAPPEMENT est honoré (`\'`, `\"`, `` \` ``, `\\`) : un délimiteur précédé d'un backslash ne
 * ferme pas le littéral. Sans ce pas de plus, `'Impossible d\'ouvrir une bataille de masse…'` était
 * lu comme `'Impossible d\'` — un fragment que `isFrench` déclare FAUX (l'élision y perd son
 * apostrophe, et aucun mot-outil ne subsiste) : la phrase entière échappait au compte (mesuré sur
 * `massBattleFlow.ts` au lot V8c₁).
 */
function readString(body: string, from: number, quote: string): string | null {
  for (let i = from + 1; i < body.length; i++) {
    if (body[i] === '\\') { i++; continue; }
    if (body[i] === quote) return body.slice(from, i + 1);
  }
  return null;
}

/**
 * 6ᵉ FORME (#1318 V8c₁) : `.log(` dont l'argument n'est PAS un littéral COLLÉ à l'ouverture — le cas
 * réel est le TERNAIRE, `get().log(free ? `…` : `…`)`, qui cachait DEUX phrases joueur du chemin
 * d'achat le plus fréquenté (`merchantFlow.ts`) : les cinq formes ci-dessus exigent le délimiteur
 * immédiatement après l'ouverture, donc elles ne voyaient ni l'une ni l'autre.
 *
 * On lit ici tous les littéraux de PROFONDEUR 0 de l'appel — ceux passés en argument DIRECT, quelle
 * que soit l'expression qui les enchâsse (ternaire, concaténation). Un littéral sous appel imbriqué
 * (`get().log(t('mf.buy', { label }))`) est à profondeur 1 : jamais compté, c'est du catalogue.
 * Les appels dont le PREMIER argument est déjà un littéral appartiennent à la forme 1 et sont laissés
 * à elle (sans quoi ils compteraient deux fois).
 */
function logDepth0Literals(body: string): string[] {
  const out: string[] = [];
  const rx = /\.log\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    let i = m.index + m[0].length;
    while (i < body.length && /\s/.test(body[i])) i++;
    if (body[i] === '"' || body[i] === "'" || body[i] === '`') continue; // forme 1 : à elle de compter
    let prof = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === '(' || c === '[' || c === '{') { prof++; i++; continue; }
      if (c === ']' || c === '}') { prof--; i++; continue; }
      if (c === ')') { if (prof === 0) break; prof--; i++; continue; }
      if (c === '"' || c === "'" || c === '`') {
        const lit = readString(body, i, c);
        if (!lit) break;
        if (prof === 0) out.push(lit);
        i += lit.length;
        continue;
      }
      i++;
    }
  }
  return out;
}

/**
 * 7ᵉ FORME (#1318 V8c₂) : `return [ … ]` — un describer qui RENVOIE SON JOURNAL en tableau. La forme 5
 * (`return` + délimiteur) exige le littéral immédiatement après `return`, et `ARRAY_SEED` ne connaît que
 * la déclaration annotée (`: string[] = [`) : entre les deux, le retour direct d'un tableau de lignes
 * n'était vu par PERSONNE. Le trou est mesuré, pas supposé — `engine/disease.ts` en portait QUATRE
 * (contraction, développement, les deux issues de Gangrène), et la mutation qui remettait l'un d'eux en
 * littéral laissait l'invariant ZÉRO du fichier VERT.
 *
 * Même lecture que la 6ᵉ forme : littéraux de PROFONDEUR 0 du tableau (ceux qui SONT des lignes), pas
 * ceux d'un appel imbriqué (`return [t('dz.develop', { … })]` est à profondeur 1 — c'est du catalogue).
 */
function returnArrayLiterals(body: string): string[] {
  const out: string[] = [];
  const rx = /\breturn\s*\[/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    let i = m.index + m[0].length;
    let prof = 0;
    while (i < body.length) {
      const c = body[i];
      if (c === '(' || c === '[' || c === '{') { prof++; i++; continue; }
      if (c === ')' || c === '}') { prof--; i++; continue; }
      if (c === ']') { if (prof === 0) break; prof--; i++; continue; }
      if (c === '"' || c === "'" || c === '`') {
        const lit = readString(body, i, c);
        if (!lit) break;
        if (prof === 0) out.push(lit);
        i += lit.length;
        continue;
      }
      i++;
    }
  }
  return out;
}

/**
 * 8ᵉ FORME (#1318 V8c₅) : littéral FR passé en PARAMÈTRE de `t()`/`tr()`. Un appel de catalogue n'est
 * pas un blanc-seing — `t('op.attrMod', { attr: 'Blessures' })` INTERPOLE ce littéral et l'affiche tel
 * quel. Le commentaire des 6ᵉ/7ᵉ formes disait « un littéral sous appel imbriqué reste du catalogue » :
 * c'était faux, et cette forme le mesure. Ce que les formes 6/7 constatent vraiment, c'est que ce
 * littéral-là n'est PAS une ligne de journal ; il est désormais compté ICI, à sa place.
 *
 * Lecture : pour CHAQUE appel, le PREMIER littéral est la CLÉ (jamais du texte), les suivants à
 * profondeur ≤ 1 sont les paramètres (`{ … }` ouvre un niveau). La borne évite le double comptage d'un
 * `t()` imbriqué dans un `t()` : ses paramètres appartiennent à SON appel, compté par sa propre
 * occurrence. Limite héritée du prédicat : un repli d'UN SEUL MOT (« Destin », « Effet ») reste
 * invisible (indiscernable d'un id) — la passe humaine de V8c₅ en a migré 9, sans qu'aucun compte ne
 * les ait jamais portés.
 */
function tParamLiterals(body: string): string[] {
  const out: string[] = [];
  const rx = /\b(?:t|tr)\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(body))) {
    if (/[A-Za-z0-9_$.]/.test(body[m.index - 1] ?? ' ')) continue; // `.at(`, `format(`… : pas un minteur
    let i = m.index + m[0].length;
    let prof = 0;
    let cle = false;
    while (i < body.length) {
      const c = body[i];
      if (c === '(' || c === '[' || c === '{') { prof++; i++; continue; }
      if (c === ']' || c === '}') { prof--; i++; continue; }
      if (c === ')') { if (prof === 0) break; prof--; i++; continue; }
      if (c === '"' || c === "'" || c === '`') {
        const lit = readString(body, i, c);
        if (!lit) break;
        if (!cle) cle = true; // 1er littéral = la clé de catalogue
        else if (prof <= 1) out.push(lit);
        i += lit.length;
        continue;
      }
      i++;
    }
  }
  return out;
}

/** Compte les littéraux FR de narration d'un fichier (hors catalogue). */
export function narrationCount(raw: string): number {
  const body = stripComments(raw);
  let n = 0;
  ARRAY_SEED.lastIndex = 0;
  let seed: RegExpExecArray | null;
  while ((seed = ARRAY_SEED.exec(body))) {
    let i = seed.index + seed[0].length;
    for (;;) {
      while (i < body.length && /\s/.test(body[i])) i++;
      const q = body[i];
      if (q !== '"' && q !== "'" && q !== '`') break;
      const lit = readString(body, i, q);
      if (!lit) break;
      if (isFrench(lit)) n++;
      i += lit.length;
      while (i < body.length && /\s/.test(body[i])) i++;
      if (body[i] !== ',') break;
      i++;
    }
  }
  for (const shape of EMIT_SHAPES) {
    shape.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = shape.exec(body))) {
      const quote = m[1];
      const litStart = m.index + m[0].length - 1;
      const lit = readString(body, litStart, quote);
      if (lit && isFrench(lit)) n++;
    }
  }
  for (const lit of logDepth0Literals(body)) if (isFrench(lit)) n++;
  for (const lit of returnArrayLiterals(body)) if (isFrench(lit)) n++;
  for (const lit of tParamLiterals(body)) if (isFrench(lit)) n++;
  return n;
}

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS)) {
    if (DEV_ONLY.has(rel)) continue; // sortie d'OUTIL de dev : hors périmètre de la narration de JEU
    const n = narrationCount(text);
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou i18n — narration moteur (Phase C, #410 inversé)', () => {
  it(`aucun fichier de ${SCAN_DIRS.join(', ')} ne porte de littéral FR de narration`, () => {
    const over = Object.entries(countsByFile()).map(([rel, n]) => `${rel} : ${n} littéral(aux) FR`);
    expect(
      over,
      `Nouveau(x) littéral(aux) FR de narration hors catalogue — passer par t(...)/tr(...) :\n${over.join('\n')}`,
    ).toEqual([]);
  });

  it('le lecteur de littéraux honore l’ÉCHAPPEMENT : une phrase à apostrophe échappée est COMPTÉE', () => {
    // Fixture posée ICI, jamais lue dans l'arbre : le scan ignore les `.test.ts`.
    // Avant le correctif, la lecture s'arrêtait au `\'` — le fragment `'Impossible d\'` ne portait plus
    // ni élision ni mot-outil, et la phrase entière sortait du compte (cas réel : `massBattleFlow.ts`).
    expect(narrationCount("get().log('Impossible d\\'ouvrir une bataille de masse en plein combat tactique.');")).toBe(1);
    expect(narrationCount("  return 'La bataille s\\'achève sans vainqueur clair.';")).toBe(1);
    // Le délimiteur ÉCHAPPÉ ne coupe plus le littéral : les deux moitiés ne comptent pas pour deux.
    expect(narrationCount("get().log('Le tuteur demande l\\'argent d\\'un maître.');")).toBe(1);
    // Aucune régression sur la forme ordinaire (sans échappement).
    expect(narrationCount('get().log("Bourse insuffisante pour payer le panier.");')).toBe(1);
    // …ni faux positif sur une chaîne technique échappée.
    expect(narrationCount("get().log('a\\'b');")).toBe(0);
  });

  it('6ᵉ FORME : un `.log(` TERNAIRE compte SES DEUX branches (l’argument n’est pas collé à l’ouverture)', () => {
    // Le site réel (`merchantFlow.ts`, chemin d'achat) : deux phrases joueur, zéro vue avant ce lot.
    const ternaire = 'get().log(free ? `Achat : ${e} (dans les moyens du Statut du groupe — Tenir les comptes).` : `Vente : ${e} à la criée.`);';
    expect(narrationCount(ternaire)).toBe(2);
    // Un littéral sous appel IMBRIQUÉ n'est pas une LIGNE DE JOURNAL — cette forme-ci ne le compte donc
    // pas. « Pas compté ici » ≠ « au catalogue » : ce paramètre s'affiche tel quel, et c'est la 8ᵉ FORME
    // qui le mesure (ci-dessous) — d'où 1, et non 0, sur cet exemple.
    expect(narrationCount("get().log(t('mf.buy', { label: 'Épée' }));")).toBe(1);
    // La forme 1 garde ses appels : un littéral collé ne compte pas DEUX fois.
    expect(narrationCount("get().log(`Bourse insuffisante pour ${x}.`);")).toBe(1);
  });

  it('7ᵉ FORME : un `return [ … ]` compte SES lignes (le journal RENDU en tableau)', () => {
    // Le site réel (`engine/disease.ts`, contraction/développement/Gangrène) : quatre phrases joueur
    // dans un fichier migré — la garde restait VERTE quand on les y remettait.
    expect(narrationCount("  return [`${c.label} développe : ${diseaseLabel(name)}.`];")).toBe(1);
    // Deux lignes dans le même retour comptent DEUX fois.
    expect(narrationCount('return [`Le groupe arrive à ${to}.`, `La nuit tombe sur le camp.`];')).toBe(2);
    // Un littéral sous appel IMBRIQUÉ n'est pas une LIGNE (même énoncé qu'à la 6ᵉ forme) : il est compté
    // par la 8ᵉ FORME, pas ici — le paramètre S'AFFICHE, interpolé dans le gabarit. (« Peste noire » ne
    // porte ni accent ni mot-outil : le PRÉDICAT ne le voit pas — limite dite, pas une exemption.)
    expect(narrationCount("return [t('dz.develop', { name: c.label, disease: 'la peste noire' })];")).toBe(1);
    // …et un retour de tableau TECHNIQUE (ids) ne déclenche rien.
    expect(narrationCount("return ['infection-du-sang', 'blessure-purulente'];")).toBe(0);
  });

  it('8ᵉ FORME : un littéral FR en PARAMÈTRE de `t()` compte (le catalogue l’interpole et l’AFFICHE)', () => {
    // Le site réel (`engine/ops.ts:1847`) : le nom d'attribut passait en clair dans le gabarit — pris ici
    // sous une forme que le prédicat SAIT voir (accent), cf. la limite « littéral d'UN SEUL mot ».
    expect(narrationCount("lines.push(t('op.attrMod', { name: c.label, attr: 'Détermination perdue' }));")).toBe(1);
    // La CLÉ (1er littéral) n'est jamais du texte : elle ne compte pas.
    expect(narrationCount("lines.push(t('op.heal', { name: c.label, n: 3 }));")).toBe(0);
    // Un paramètre qui vient du CATALOGUE (appel imbriqué) ne compte pas : c'est la forme à viser.
    expect(narrationCount("lines.push(t('op.attrMod', { attr: t('op.attrWounds') }));")).toBe(0);
    // Aucun double comptage d'un `t()` imbriqué : le paramètre FR de l'appel INTERNE compte UNE fois.
    expect(narrationCount("lines.push(t('a.b', { x: t('c.d', { y: 'une phrase de plus' }) }));")).toBe(1);
    // `.at(`/`format(` ne sont pas des minteurs : leurs littéraux ne sont pas visés par cette forme.
    expect(narrationCount("const s = arr.at('la première case');")).toBe(0);
  });
});
