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
import { RULE_REF, type RuleId } from './ruleRefs';
import { weatherRef } from './travelStages';
import { weatherIdSchema } from '../data/schemas/defs/weather';
import { windsModLine, windsModFromRoll } from './windsOfMagic';
import { codexLookupById } from '../ui/compendium/registry';
import regles from '../data/regles.json';

describe('RULE_REF — la référence pointe une fiche Codex réelle', () => {
  it('chaque règle référencée existe au catalogue, par id STABLE', () => {
    for (const [rule, ref] of Object.entries(RULE_REF) as [RuleId, { category: string; id: string }][]) {
      expect(codexLookupById(ref.category, ref.id), `RULE_REF['${rule}'] → ${ref.category}/${ref.id} introuvable au Codex`).toBeTruthy();
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
  /** Clé `RULE_REF.<x>` / `RULE_REF['x']` de la `ref` quand elle est STATIQUE — sinon `null`. */
  ruleKey: string | null;
}

/** Le nom de règle d'une `ref` écrite `RULE_REF.viser` / `RULE_REF['viser']` ; `null` si calculée. */
function staticRuleKey(e: ts.Expression): string | null {
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'RULE_REF') return e.name.text;
  if (ts.isElementAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'RULE_REF'
      && ts.isStringLiteral(e.argumentExpression)) return e.argumentExpression.text;
  return null;
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
          const ref = prop('ref');
          found.push({
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            label: label && ts.isPropertyAssignment(label) ? label.initializer.getText(sf).replace(/\s+/g, ' ') : 'label',
            hasRef: names.includes('ref'),
            famille: famText == null ? null
              : /^'circonstance'/.test(famText) ? 'circonstance'
                : /^'jet'/.test(famText) ? 'jet' : '?',
            ruleKey: ref && ts.isPropertyAssignment(ref) ? staticRuleKey(ref.initializer) : null,
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
  ruleKey: string | null;
}

let sitesMemo: ModSite[] | undefined;
function modLineSites(): ModSite[] {
  return (sitesMemo ??= scanModLineSites());
}

function scanModLineSites(): ModSite[] {
  const out: ModSite[] = [];
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(readCorpus(['src']))) {
    for (const m of modLineLiterals(rel, text, sourceFile!)) {
      out.push({ at: `${rel} · ${m.label}`, where: `${rel}:${m.line} · ${m.label}`, hasRef: m.hasRef, famille: m.famille, ruleKey: m.ruleKey });
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
 *    et les deux modificateurs d'AMBIANCE de scène (`sc.label`, poussés par `state/combatFlow.ts` :
 *    la donnée de scène ne porte aucune identité Codex à ce jour, seule la branche `sc.concealed`
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
  "src/engine/combat.ts · 'Neige épaisse'",
  "src/state/combatFlow.ts · tr('cf.coverLabel', { cover })",
  'src/state/combatFlow.ts · sc.label',
  'src/state/combatFlow.ts · sc.label',
  "src/state/combatFlow.ts · 'Contrecoup'",
  "src/state/travelFlow.ts · t('tf.modGallop')",
  "src/state/travelFlow.ts · t('tf.modGalloped', { n: galloped })",
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
    expect(modLineLiterals('x.ts', src)).toEqual([{ line: 1, label: '`Météo : ${LABEL[w]}`', hasRef: false, famille: null, ruleKey: null }]);
  });

  it('cas planté : un littéral multi-ligne, et la présence d’une `ref`, sont lus sur la STRUCTURE (preuve TDD)', () => {
    const src = 'const m = {\n  label: "Viser",\n  value: 10,\n  famille: \'circonstance\',\n  ref: RULE_REF.viser,\n};';
    expect(modLineLiterals('x.ts', src)).toEqual([{ line: 1, label: '"Viser"', hasRef: true, famille: 'circonstance', ruleKey: 'viser' }]);
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
   *  règle. Le stock est ÉNUMÉRÉ pour qu'un vrai calcul ne s'y glisse pas ; il est VIDE depuis #1657
   *  B3-3, l'entretien transportant les `ModLine` de ses producteurs telles quelles. */
  const RELAIS: string[] = [];

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
      .toEqual([{ line: 1, label: "'Viser'", hasRef: true, famille: 'circonstance', ruleKey: 'viser' }]);
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

/**
 * COHÉRENCE ÉMISSION ⇄ DONNÉE (#1153 L3b-1, prépare #1173). Une fiche `regles.json` pourra DÉCLARER
 * la famille de sa règle ; le jour où elle le fait, toute ligne émise avec cette `ref` doit s'y
 * accorder — sinon l'écran classerait la même règle des deux côtés selon le site. Tant qu'aucune
 * fiche ne porte le champ, la garde est SANS OBJET et le dit (elle mordra sans être réécrite).
 */
describe('Famille — l’émission s’accorde à la fiche de règle quand la donnée la déclare (#1173)', () => {
  /** Le comparateur RÉEL — les fiches sont un PARAMÈTRE, pour que la contre-preuve exerce ce même
   *  code sur une donnée forgée (jamais une simulation parallèle qui ne prouverait rien). */
  const conflitsDeFamille = (fiches: { id: string; famille?: string }[]): string[] => {
    const out: string[] = [];
    for (const s of modLineSites()) {
      if (!s.ruleKey || s.famille === null || s.famille === '?') continue;
      const ref = RULE_REF[s.ruleKey as RuleId];
      if (!ref || ref.category !== 'regles') continue;
      const attendue = fiches.find((r) => r.id === ref.id)?.famille;
      if (attendue && attendue !== s.famille) out.push(`${s.where} → émet '${s.famille}', la fiche '${ref.id}' déclare '${attendue}'`);
    }
    return out.sort();
  };

  it('aucun site n’émet une famille contraire à celle de sa fiche `regles.json`', () => {
    expect(conflitsDeFamille(regles as { id: string; famille?: string }[]),
      'famille émise ≠ famille déclarée en donnée : une règle ne peut pas être des deux familles').toEqual([]);
  });

  it('contre-preuve sur le MÊME comparateur : une fiche `viser` déclarée « jet » fait rougir les sites qui l’émettent « circonstance »', () => {
    const forgees = (regles as { id: string; famille?: string }[]).map((r) => (r.id === 'viser' ? { ...r, famille: 'jet' } : r));
    const conflits = conflitsDeFamille(forgees);
    expect(conflits.length, 'le comparateur ne voit pas un désaccord pourtant présent en donnée').toBeGreaterThan(0);
    expect(conflits.every((c) => c.includes("la fiche 'viser' déclare 'jet'"))).toBe(true);
  });
});
