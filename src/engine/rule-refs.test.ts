import { ast, analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
/**
 * RULE_REF (#1078 LOT B3a) — deux gardes.
 *
 * 1. INTÉGRITÉ : chaque entrée pointe une fiche Codex qui EXISTE, par id stable. Re-pointer une
 *    entrée ailleurs (ou renommer l'entrée de donnée) échoue ici.
 * 2. CLIQUET NOMINATIF : le stock des producteurs de `ModLine` SANS `ref` est ÉNUMÉRÉ,
 *    `fichier:label` par `fichier:label`. Lier une règle de plus retire sa ligne du stock (la liste
 *    DÉCROÎT) ; en pousser une nouvelle SANS `ref` échoue immédiatement.
 *
 * PÉRIMÈTRE (#1117 L5a) — TOUT `src/**` hors `*.test.*`, jamais une liste de fichiers producteurs :
 * une `ModLine` naît aussi bien dans une modale (`ui/FocusModal.tsx`) que dans le moteur, et un
 * périmètre par fichiers ne mesurait qu'une PART du stock (13 sur 30 au moment de l'élargissement).
 * MÉCANIQUE — parseur AST réel (`typescript`, même patron que `src/name-field-guard.test.ts`), pas
 * une regex de texte : les libellés en gabarit (`` `Météo : ${…}` ``) et les littéraux multi-lignes
 * échappaient à la forme textuelle. Un littéral compte comme `ModLine` quand :
 *   - c'est un `ObjectLiteralExpression` portant `label` ET `value` ;
 *   - toutes ses clés appartiennent à `ModLine` (`label`/`value`/`famille`/`ref`/`by`) — le contrôle
 *     de propriétés excédentaires de TypeScript garantit qu'une VRAIE `ModLine` n'en porte pas
 *     d'autre, si bien qu'un littéral à clé étrangère (`kref` d'un `CodexFact`, `id` d'un axe,
 *     `tone` d'une zone de fiche) est d'une AUTRE forme ;
 *   - sa `value` n'est pas syntaxiquement une chaîne (`'x'`, gabarit, `String(x)`) — `ModLine.value`
 *     est un nombre, un littéral à valeur-chaîne est un fait de Codex.
 * Aucune exemption par fichier : la discrimination porte sur la FORME, à tous les sites.
 */
import { describe, it, expect } from 'vitest';
import * as ts from 'typescript/unstable/ast';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { RULE_REF, RANGEES_DE_REGLE, type RuleId, type RegleChiffree } from './ruleRefs';
import { refDeRegle } from './reglesChiffrees';
import { weatherRef } from './travelStages';
import { weatherIdSchema } from '../data/schemas/defs/weather';
import { windsModLine, windsModFromRoll } from './windsOfMagic';
import { codexLookupById } from '../ui/compendium/registry';

describe('RULE_REF — la référence pointe une fiche Codex réelle', () => {
  it('chaque règle référencée existe au catalogue, par id STABLE', () => {
    for (const [rule, ref] of Object.entries(RULE_REF) as [RuleId, { category: string; id: string }][]) {
      expect(codexLookupById(ref.category, ref.id), `RULE_REF['${rule}'] → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
    for (const rule of Object.keys(RANGEES_DE_REGLE) as RegleChiffree[]) {
      const ref = refDeRegle(rule);
      expect(codexLookupById(ref.category, ref.id), `règle chiffrée '${rule}' → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
  });

  /**
   * Angle mort de la garde ci-dessus : une `ref` PRODUITE (catégorie hors `RULE_REF`, id calculé de
   * la donnée) n'y figure pas — une catégorie mal orthographiée ou un id absent rendrait la chip
   * muette à l'écran sans qu'aucun test ne bronche. Chaque producteur dynamique est donc énuméré
   * sur son DOMAINE COMPLET.
   */
  it('les refs PRODUITES résolvent au Codex — météo : les 6 conditions, force des Vents : les 10 faces du d10', () => {
    // DOMAINE COMPLET dérivé de la DÉCLARATION (`weatherIdSchema`, `defs/weather.ts`) : une 7ᵉ météo
    // ajoutée au schéma entre ici toute seule — une liste recopiée aurait laissé le trou en silence.
    for (const w of weatherIdSchema.options) {
      const ref = weatherRef(w);
      expect(codexLookupById(ref.category, ref.id), `weatherRef('${w}') → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
    }
    for (let roll = 1; roll <= 10; roll++) {
      const mod = windsModFromRoll(roll);
      const line = windsModLine({ roll, mod });
      if (mod === 0) {
        // Vents stables : aucune ligne à afficher (rien à référencer).
        expect(line, `windsModLine(d10=${roll}) — force neutre, aucune ligne`).toBeNull();
        continue;
      }
      const ref = line!.ref!;
      expect(codexLookupById(ref.category, ref.id), `windsModLine(d10=${roll}) → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
      expect(line!.label, `windsModLine(d10=${roll}) NOMME la ligne du Tableau, jamais un libellé maison`)
        .toBe(codexLookupById(ref.category, ref.id)!.label);
    }
    // Aucun Vent tiré (option inactive / hors combat) : aucune ligne — jamais une chip sans référence.
    expect(windsModLine(undefined)).toBeNull();
    expect(windsModLine(null)).toBeNull();
  });
});

/** Les clés de `ModLine` (`engine/types.ts`) — un littéral qui en porte une autre est d'une autre
 *  forme. CLIQUET : ce jeu suit le TYPE clé pour clé. Une clé oubliée ici ferait sortir du scan tout
 *  littéral qui la porte, et le stock mesuré s'effondrerait sans qu'aucune règle soit liée (sonde A
 *  ci-dessous). La famille `'jet'` dit « hors du plafond des Difficultés » : `combineMods` ne combine
 *  que les circonstances (`LDB 14 l.48/95`) — aucun drapeau ne double cette information. */
const MODLINE_KEYS = new Set(['label', 'value', 'famille', 'ref', 'by']);

/** L'expression est-elle syntaxiquement une CHAÎNE ? (`ModLine.value` est un nombre.) */
function isStringExpr(e: ts.Expression): boolean {
  return ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e)
    || (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'String');
}

export interface ModLiteral {
  line: number;
  /** Texte SOURCE du libellé (`'Rapide'`, `sc.label`, `` `Météo : ${…}` ``) — l'identité de la ligne. */
  label: string;
  hasRef: boolean;
  /** `ModLine.famille` (#1153 L3b) quand elle est posée EN LITTÉRAL au site — `null` si absente, et
   *  `'?'` si elle est calculée (expression, variable) : présente mais non lisible statiquement. */
  famille: 'circonstance' | 'jet' | '?' | null;
  /** `value` écrite en NOMBRE LITTÉRAL (`20`, `-10`, `c ? 20 : 10`) : une magnitude posée au site. */
  valeurLitterale: boolean;
}

/** L'expression n'est-elle faite que de nombres littéraux (signe, parenthèses, alternative) ? */
function isLiteralNumber(e: ts.Expression): boolean {
  if (ts.isNumericLiteral(e)) return true;
  if (ts.isParenthesizedExpression(e)) return isLiteralNumber(e.expression);
  if (ts.isPrefixUnaryExpression(e)) return (e.operator === ts.SyntaxKind.MinusToken || e.operator === ts.SyntaxKind.PlusToken) && isLiteralNumber(e.operand);
  if (ts.isConditionalExpression(e)) return isLiteralNumber(e.whenTrue) && isLiteralNumber(e.whenFalse);
  return false;
}

/** Les littéraux de `ModLine` d'un fichier, `ref` présente ou non. */
export function modLineLiterals(path: string, raw: string, sf = ast({ rel: path, text: raw })!): ModLiteral[] {
  const found: ModLiteral[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const names = node.properties.map((p) => ('name' in p && p.name && ts.isIdentifier(p.name) ? p.name.text : null));
      const onlyModLineKeys = node.properties.every((p, i) => ts.isSpreadAssignment(p) || (!!names[i] && MODLINE_KEYS.has(names[i]!)));
      if (onlyModLineKeys && names.includes('label') && names.includes('value')) {
        const prop = (k: string) => node.properties.find((_, i) => names[i] === k);
        const value = prop('value');
        const stringValued = !!value && ts.isPropertyAssignment(value) && isStringExpr(value.initializer);
        if (!stringValued) {
          const label = prop('label');
          const fam = prop('famille');
          const famText = fam && ts.isPropertyAssignment(fam) ? fam.initializer.getText(sf) : null;
          found.push({
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            label: label && ts.isPropertyAssignment(label) ? label.initializer.getText(sf).replace(/\s+/g, ' ') : 'label',
            hasRef: names.includes('ref'),
            famille: famText == null ? null
              : /^'circonstance'/.test(famText) ? 'circonstance'
                : /^'jet'/.test(famText) ? 'jet' : '?',
            valeurLitterale: !!value && ts.isPropertyAssignment(value) && isLiteralNumber(value.initializer),
          });
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(sf);
  return found;
}

interface ModSite {
  at: string;
  where: string;
  hasRef: boolean;
  famille: ModLiteral['famille'];
  valeurLitterale: boolean;
}

let sitesMemo: ModSite[] | undefined;
function modLineSites(): ModSite[] {
  return (sitesMemo ??= scanModLineSites());
}

function scanModLineSites(): ModSite[] {
  const out: ModSite[] = [];
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(readCorpus(['src']))) {
    for (const m of modLineLiterals(rel, text, sourceFile!)) {
      out.push({ at: `${rel} · ${m.label}`, where: `${rel}:${m.line} · ${m.label}`, hasRef: m.hasRef, famille: m.famille, valeurLitterale: m.valeurLitterale });
    }
  }
  return out;
}

/** Le stock MESURÉ des producteurs SANS `ref`, un par `fichier:label` (source de vérité du cliquet). */
function refLessProducers(): string[] {
  return modLineSites().filter((s) => !s.hasRef).map((s) => s.at).sort();
}

/**
 * CLIQUET — stock des `ModLine` SANS `ref`. Les pools d'octroyeurs ont TOUS été levés (#1117 L4) :
 * `PassiveMod` porte l'identité Codex de sa source (`src`), et chaque site rend UNE ligne par
 * composante réelle, à son nom — pénalités d'État (`combatTestPenaltyParts`), bonus à l'attaquant
 * (`meleeAttackerBonusLines`), aura anti-Sort (`castWardLine`). Ce qui reste est MESURÉ, par famille :
 *  - RENVOIS légitimes — la ligne PORTE déjà l'identité de sa donnée dans son libellé : les quatre
 *    lignes volatiles de Caractéristique (`characteristics.ts` — la carac EST la fiche du libellé)
 *    et les trois modificateurs de MÉTÉO de scène (`sc.label`, poussés par `noyau/combatFlow.ts` :
 *    la donnée de scène ne porte aucune identité Codex (#1173), seule la branche `sc.concealed`
 *    en a une, celle de la Cible dissimulée).
 *  - lignes dont la RÈGLE n'a pas encore de fiche au catalogue (`regles.json`) : couvert de tir,
 *    allure forcée d'attelage, « Rounds tenus » de la bataille de masse, écrêtage « Combiner les
 *    Difficultés ». Leur dotation attend la fiche, elle ne s'invente pas au site.
 *  - lignes AGRÉGÉES qui doivent d'abord se DÉPLIER par source, comme les pools de L4 : « Contrecoup »
 *    (somme de `castPenalties`), « autres » (résidu de réconciliation), le modificateur d'Activité
 *    (`activityModLines`, porté par la donnée de flux — SOURCE UNIQUE depuis #1153 : le calcul de
 *    cible et son rendu lisent la MÊME ligne). Les lignes d'un Test de scène — météo maritime
 *    (`RULE_REF['meteo-maritime']`), malus psy DÉPLIÉ par source (`socialPsychLines`, fiche
 *    `psychologies/<id>`), Statut (`RULE_REF.statut`) — sont émises AVEC leur fiche et transportées
 *    par le pending (`PendingTest.mods`), donc hors de ce stock : l'affichage n'en produit plus.
 */
const RATCHET = [
  "src/noyau/combatFlow.ts · dataLabel(libelleDeValeur(classeDeCouvertSchema, cover))",
  'src/noyau/combatFlow.ts · sc.label',
  'src/noyau/combatFlow.ts · sc.label',
  'src/noyau/combatFlow.ts · sc.label',
  "src/noyau/combatFlow.ts · 'Contrecoup'",
  "src/noyau/travelFlow.ts · t('tf.modGallop')",
  "src/noyau/travelFlow.ts · t('tf.modGalloped', { n: galloped })",
  "src/engine/activities.ts · modLabel ?? 'Modificateur'",
  "src/ui/ActivityModal.tsx · 'Rounds tenus'",
  "src/ui/RollLine.tsx · `${cut < 0 ? 'plafond' : 'plancher'} ${target}`",
  "src/ui/RollLine.tsx · 'autres'",
].sort();

describe('Cliquet — les ModLine SANS règle liée sont ÉNUMÉRÉES et décroissent (#1078)', () => {
  it('le stock mesuré est EXACTEMENT le stock déclaré (lier une règle = retirer sa ligne)', { timeout: 60_000 }, () => {
    const measured = refLessProducers();
    const added = measured.filter((x) => !RATCHET.includes(x));
    const removed = RATCHET.filter((x) => !measured.includes(x));
    expect(added, 'NOUVELLE ModLine sans `ref` : donne-lui son entrée RULE_REF (ou son id d’entité)').toEqual([]);
    expect(removed, 'règle désormais liée : retire sa ligne du cliquet (il ne fait que décroître)').toEqual([]);
  });

  it('le stock ne peut que DÉCROÎTRE (plafond collé)', () => {
    expect(refLessProducers().length).toBeLessThanOrEqual(RATCHET.length);
  });

  it('le périmètre est TOUT src/** : des sites d’UI (.tsx) sont mesurés, pas seulement moteur/état', () => {
    const sites = modLineSites().map((s) => s.at);
    expect(sites.some((at) => at.startsWith('src/ui/') && at.includes('.tsx')), 'aucun site .tsx mesuré : le scan est retombé sur une liste de producteurs').toBe(true);
  });

  it('cas planté : un libellé en GABARIT est DÉTECTÉ (preuve TDD — la forme textuelle des `${…}` était aveugle)', () => {
    const src = 'const m = [{ label: `Météo : ${LABEL[w]}`, value: v }];';
    expect(modLineLiterals('x.ts', src)).toEqual([{ line: 1, label: '`Météo : ${LABEL[w]}`', hasRef: false, famille: null, valeurLitterale: false }]);
  });

  it('cas planté : un littéral multi-ligne, et la présence d’une `ref`, sont lus sur la STRUCTURE (preuve TDD)', () => {
    const src = 'const m = {\n  label: "Viser",\n  value: 10,\n  famille: \'circonstance\',\n  ref: RULE_REF.viser,\n};';
    expect(modLineLiterals('x.ts', src)).toEqual([{ line: 1, label: '"Viser"', hasRef: true, famille: 'circonstance', valeurLitterale: true }]);
  });

  it('faux positif écarté : un fait de Codex (`value` CHAÎNE, clé `kref`) n’est PAS une ModLine (preuve TDD — forme, jamais fichier)', () => {
    expect(modLineLiterals('x.ts', 'const f = { label, value: String(v) };')).toEqual([]);
    expect(modLineLiterals('x.ts', "const f = { label: 'B', value: n, kref: { category: 'c', id: 'i', label: 'L' } };")).toEqual([]);
    expect(modLineLiterals('x.ts', "const a = { id: 'force', label: a.label, value: 3 };")).toEqual([]);
  });
});

/**
 * GARDE EXHAUSTIVE de `ModLine.famille` (#1153 L3b-1). Le TYPE l'impose déjà à tout littéral
 * CONTEXTUELLEMENT typé ; ce que la garde verrouille, c'est ce que le compilateur ne voit pas :
 * un objet littéral monté hors contexte (tableau `const` inféré, `push` sur un `any`), un `as
 * ModLine`/`as never`, une assertion qui contourne le contrôle de propriétés excédentaires. La
 * mesure est STRUCTURELLE (le même parseur AST que le cliquet), sur TOUT `src/**` hors tests —
 * aucune liste de fichiers, aucune exemption de libellé.
 */
describe('Famille — chaque ModLine ÉMISE dit si elle DÉTERMINE la Difficulté ou MODIFIE le jet (#1153)', () => {
  it('aucun site d’émission sans `famille` (le type l’exige, la garde couvre les littéraux non typés et les `as`)', () => {
    const sans = modLineSites().filter((s) => s.famille === null).map((s) => s.where).sort();
    expect(sans, 'ModLine sans `famille` : « circonstance » = entrée de la table des Difficultés de Combat (LDB 14), « jet » sinon').toEqual([]);
  });

  /** Une famille CALCULÉE n'est légitime qu'en RELAI : le site rhabille une composante déjà classée
   *  par son producteur, il ne la décide pas — la re-décider créerait deux classements pour une même
   *  règle. Le stock est ÉNUMÉRÉ pour qu'un vrai calcul ne s'y glisse pas : la seule fabrique des lignes
   *  de règle chiffrée, qui relaie la famille DÉCLARÉE par la rangée (`regles.json`, #1173). */
  const RELAIS: string[] = ['src/engine/reglesChiffrees.ts · r.label'];

  it('une famille CALCULÉE n’est qu’un RELAI énuméré (jamais une décision au site)', () => {
    const opaques = modLineSites().filter((s) => s.famille === '?').map((s) => s.at).sort();
    expect(opaques, '`famille` posée par expression : relayer une famille déjà classée, ou la poser en LITTÉRAL').toEqual(RELAIS);
  });

  it('le scan MESURE réellement des familles (contre-preuve : un scan cassé rendrait la garde vide et verte)', () => {
    const sites = modLineSites();
    expect(sites.length, 'aucun site mesuré : le parseur ou le périmètre a lâché').toBeGreaterThan(50);
    expect(sites.some((s) => s.famille === 'circonstance'), 'aucune circonstance mesurée').toBe(true);
    expect(sites.some((s) => s.famille === 'jet'), 'aucun mod au jet mesuré').toBe(true);
  });

  it('cas planté : un littéral SANS famille est vu comme tel (preuve TDD)', () => {
    expect(modLineLiterals('x.ts', "const m = { label: 'Viser', value: 20 };")[0].famille).toBeNull();
    expect(modLineLiterals('x.ts', "const m = { label: 'X', value: 20, famille: f };")[0].famille).toBe('?');
  });

  /**
   * SONDE A — le delta `MODLINE_KEYS` est PORTEUR. `famille` retirée du jeu de clés, un littéral qui
   * la porte devient « une autre forme » : il sort du scan, et les DEUX gardes (cliquet #1078 et
   * famille) redeviendraient vertes sur un stock vide. Le détecteur RÉEL est éprouvé ici.
   */
  it('sonde A : un littéral PORTANT `famille` reste DÉTECTÉ (retirer la clé du jeu ferait fuir tout le stock)', () => {
    const src = "const m = { label: 'Viser', value: 20, famille: 'circonstance', ref: RULE_REF.viser };";
    expect(modLineLiterals('x.ts', src), 'le scan a perdu les littéraux à `famille` : MODLINE_KEYS est désynchronisé de ModLine')
      .toEqual([{ line: 1, label: "'Viser'", hasRef: true, famille: 'circonstance', valeurLitterale: true }]);
    // Et le stock mesuré en vrai est massivement peuplé — un jeu de clés désynchronisé l'aplatirait.
    expect(modLineSites().length).toBeGreaterThan(50);
  });

  /**
   * SONDE C — les CONTOURNEMENTS d'assertion. Le contrôle de propriétés excédentaires de TypeScript
   * ne s'applique pas derrière un `as` : c'est la seule voie par laquelle une `ModLine` peut naître
   * sans `famille` malgré un type obligatoire. La garde lit la FORME du littéral, pas son type — donc
   * elle voit à travers `as ModLine`, `as never` et `as unknown as`.
   */
  it('sonde C : les littéraux derrière `as ModLine` / `as never` / `as unknown as` sont MESURÉS', () => {
    for (const cast of ['as ModLine', 'as never', 'as unknown as ModLine']) {
      const lit = modLineLiterals('x.ts', `const m = { label: 'X', value: 20 } ${cast};`);
      expect(lit.length, `un littéral \`${cast}\` échappe au scan : la garde serait contournable`).toBe(1);
      expect(lit[0].famille, `\`${cast}\` : famille manquante non vue`).toBeNull();
    }
  });
});

/** Stock DÉCROISSANT des magnitudes littérales à côté d'un renvoi : la Cible dissimulée, que la scène
 *  pose par météo (`noyau/monde/sceneRules.ts`), rejoint sa fiche avec le vocabulaire météo unique (#1173, lot
 *  « Météo » du plan de #2778). */
const STOCK_LITTERALES: string[] = ['src/noyau/combatFlow.ts · sc.concealedLabel'];

/**
 * RÈGLES CHIFFRÉES (#1173) — la valeur, la famille et le libellé d'une ligne de règle chiffrée sont ceux
 * de sa rangée en donnée : `ligneDeRegle` est la seule fabrique, et une règle chiffrée n'a pas d'entrée
 * `RULE_REF` (une ligne écrite à la main ne compile pas). Ce que la structure ne voit pas : une magnitude
 * LITTÉRALE posée à côté d'un renvoi d'ENTITÉ ou de règle NON chiffrée — la garde ci-dessous la refuse.
 */
describe('Règles chiffrées — aucune valeur au site', () => {
  it('aucune ModLine n’écrit sa magnitude en nombre littéral à côté d’un renvoi (la valeur vit dans la donnée)', () => {
    const litterales = modLineSites().filter((s) => s.hasRef && s.valeurLitterale).map((s) => s.at).sort();
    expect(litterales, 'valeur littérale au site : lis-la dans la fiche de la règle (`ligneDeRegle`) ou dans l’entité qui l’octroie').toEqual(STOCK_LITTERALES);
  });

  it('cas plantés : un littéral, son signe et une alternative de littéraux sont vus ; une valeur lue ne l’est pas', () => {
    const vu = (v: string) => modLineLiterals('x.ts', `const m = { label: 'X', value: ${v}, famille: 'jet', ref: r };`)[0].valeurLitterale;
    expect(vu('20')).toBe(true);
    expect(vu('-20')).toBe(true);
    expect(vu('lower ? 20 : 10')).toBe(true);
    expect(vu('e.castWard.mod')).toBe(false);
    expect(vu('-10 * shots')).toBe(false);
  });
});
