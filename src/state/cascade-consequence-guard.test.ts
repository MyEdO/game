import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * Cliquet du composeur d'affichage (#295, verrou 2) — le canal `journal:` d'un `CascadeApplier` a
 * disparu DU TYPE (`cascade.ts CascadeApplier`, mort du canal) : le compilateur interdit déjà toute
 * chaîne LIBRE re-décrivant le jet (`${step.result.roll}/${step.result.target}`, « réussi »/« raté »)
 * que la rangée `RollLine` affiche déjà (✓/✗ ±DR). Ce cliquet reste en CEINTURE (grep, pas seulement
 * type) ; le CONTENU des conséquences (`freeCons(...)`) est verrouillé par le describe « CONTENU »
 * ci-dessous — doctrine #295 : une ligne de conséquence narre l'effet DÉJÀ appliqué, jamais le jet.
 *
 * BASELINE gelée par fichier (patron `ui-ratchets.test.ts`), TOUTE à ZÉRO (#295 migration soldée) :
 * toute HAUSSE échoue (régression).
 */

const ROOT = fileURLToPath(new URL('../../', import.meta.url)); // racine du repo

/** Isole les littéraux `journal: [...]` d'un CascadeApplier (canal MORT depuis #295, tout retour = régression) — exclut les écritures
 *  d'ÉTAT `journal: [...get().journal...]` (spread de `state.journal`, un champ homonyme sans rapport). */
function journalLiterals(src: string): string[] {
  return src.match(/\bjournal:\s*\[(?!\.\.\.get\(\)\.journal)[^\]]*\]/gs) ?? [];
}

/** Compte, DANS les littéraux `journal:` isolés, les deux motifs de duplication du jet (doc § Verrous) :
 *  re-print du résultat (`${…roll|target|sl}`) et verdict en dur (réussi/raté/réussit/échoue). */
function dupCounts(src: string): { journalArrays: number; jetDup: number; verdict: number } {
  const snippets = journalLiterals(src);
  let jetDup = 0;
  let verdict = 0;
  for (const s of snippets) {
    jetDup += (s.match(/\$\{[^}]*\.(roll|target|sl)\b/g) ?? []).length;
    verdict += (s.match(/\b(r[ée]ussi|rat[ée]|r[ée]ussit|[ée]choue)\b/gi) ?? []).length;
  }
  return { journalArrays: snippets.length, jetDup, verdict };
}

/** Baseline par fichier (relatif à la racine du repo, slashes avant) — ZÉRO partout : `travelFlow`/
 *  `travelPostes`/`seaVoyageFlow`/`shipwreck`/`pursuitFlow`/`combatFlow`/`combat/roundHooks`/
 *  `combat/turnHooks`/`combat/triggeredTest`/`restFlow`/`embrigadementFlow`/`riverVoyageFlow` (Lot 1) +
 *  `combatEffects`/`combatManeuvers`/`encounterPsychFlow` (mort du canal, #295) — plus aucun fichier
 *  du scope ne porte le canal `journal:` (mort, #295). */
const BASELINE: Record<string, { journalArrays: number; jetDup: number; verdict: number }> = {};

const SCOPE = [
  'src/state/travelFlow.ts', 'src/state/travelPostes.ts', 'src/state/seaVoyageFlow.ts', 'src/state/shipwreck.ts',
  'src/state/pursuitFlow.ts', 'src/state/combatFlow.ts', 'src/state/combat/roundHooks.ts', 'src/state/combat/turnHooks.ts',
  'src/state/combat/triggeredTest.ts', 'src/state/restFlow.ts', 'src/state/embrigadementFlow.ts', 'src/state/riverVoyageFlow.ts',
  'src/state/combatEffects.ts', 'src/state/combatManeuvers.ts', 'src/state/encounterPsychFlow.ts',
];

describe('cliquet composeur — canal journal: déprécié des CascadeApplier (#295, verrou 2, mort du canal)', () => {
  it('aucun fichier du scope ne réutilise le canal journal: (canal absent DU TYPE)', () => {
    const over: string[] = [];
    const stale: string[] = [];
    for (const rel of SCOPE) {
      const src = readFileSync(join(ROOT, rel), 'utf8');
      const n = dupCounts(src);
      const b = BASELINE[rel] ?? { journalArrays: 0, jetDup: 0, verdict: 0 };
      if (n.journalArrays > b.journalArrays || n.jetDup > b.jetDup || n.verdict > b.verdict) {
        over.push(`${rel} : journalArrays=${n.journalArrays}(base ${b.journalArrays}) jetDup=${n.jetDup}(base ${b.jetDup}) verdict=${n.verdict}(base ${b.verdict})`);
      }
      if (n.journalArrays < b.journalArrays || n.jetDup < b.jetDup || n.verdict < b.verdict) {
        stale.push(`${rel} : baseline journalArrays=${b.journalArrays}/jetDup=${b.jetDup}/verdict=${b.verdict}, réel ${n.journalArrays}/${n.jetDup}/${n.verdict}`);
      }
    }
    expect(over, `Régression canal journal: déprécié — migrer vers consequences: freeCons(...) :\n${over.join('\n')}`).toEqual([]);
    expect(stale, `Baseline(s) PÉRIMÉE(s) — abaisser (fichier assaini) :\n${stale.join('\n')}`).toEqual([]);
  });

  it('fail-closed : le compteur détecte une duplication SYNTHÉTIQUE de jet dans un littéral journal:', () => {
    const regressed = "registerCascadeApplier('x', (get, set, step, hero) => {\n"
      + "  return { journal: [`${hero.name} : ${step.result.roll}/${step.result.target} → réussi.`] };\n"
      + '});';
    const n = dupCounts(regressed);
    expect(n.journalArrays).toBe(1);
    expect(n.jetDup).toBeGreaterThan(0);
    expect(n.verdict).toBeGreaterThan(0);
  });

  it('fail-closed : une écriture d\'état journal: [...get().journal...] (state.journal) N\'EST PAS confondue avec le canal applier', () => {
    const stateWrite = "set({ journal: [...get().journal.slice(-40), 'ligne'] });";
    expect(journalLiterals(stateWrite)).toEqual([]);
  });

  it('aucun applier des surfaces migrées ne recense de nouveau fichier hors BASELINE (garde exhaustive du scope)', () => {
    for (const rel of Object.keys(BASELINE)) expect(SCOPE).toContain(rel);
  });
});

/**
 * Cliquet du composeur d'affichage (#295, Lot 5 — CONTENU) : le canal `journal:` a disparu (verrou
 * ci-dessus), mais la migration Lot 1 n'avait touché que le TYPE — pas le TEXTE. Ce second cliquet
 * scanne, PAR FICHIER, le motif `${…roll}/${…target}` sur TOUT le fichier (pas seulement les
 * littéraux `journal:`, morts) : un re-print du jet dans un texte de conséquence (`freeCons(...)`,
 * `tell(...)`, `log(...)`…) juste au-dessus d'une rangée qui l'affiche déjà (CascadeModal, SteamSaveModal,
 * RenounceModal…) est le symptôme exact du mandat user (« le pire c'est les résultats qui remettent le
 * résultat du jet visible juste au-dessus »).
 *
 * PÉRIMÈTRE INVERSÉ #410 (2026-07-13) : la garde balaie désormais TOUT `src/state` + `src/engine`
 * (walk récursif) au lieu d'une liste opt-in de 10 fichiers — l'audit de couverture a trouvé le
 * symptôme EXACT vivant hors liste (merchantFlow:206,226 ; portFlow:361,364 ; engine/magic ;
 * engine/provisions ; engine/travel), qu'un nouveau flow aurait franchi en silence. Tout nouveau
 * fichier naît couvert (baseline 0).
 *
 * BASELINE ZÉRO pour tout fichier sans re-print. BASELINE > 0 = STOCK GELÉ par fichier — les sites
 * que le dériveur (`engine/traceLine.ts`) ne peut PAS rendre (raison mesurée en regard de chacun).
 * Toute hausse au-delà = régression ; toute baisse doit ABAISSER la baseline (cliquet décroissant).
 *
 * CE QUE CE SCAN NE VOIT PAS, dit sans détour (il ne lit qu'un motif de TEXTE `${x.roll}/${x.target}`) :
 * une recopie du dé par un autre gabarit (`${roll} sur ${target}`, concaténation, `join`), une recopie
 * routée par une clé de catalogue (`t('out.…')` — le garde i18n ne fait que compter des littéraux FR
 * par fichier, il ne juge AUCUN contenu), et tout re-print hors `src/state`/`src/engine`. Le dériveur
 * lui-même échappe au motif par construction : c'est le volet « canal » (lint AST) plus bas qui tient
 * la porte d'entrée, pas ce compteur.
 */
const CONTENT_DIRS = ['src/state', 'src/engine'];

/** Baseline par fichier — voir doc ci-dessus. VIDE : aucun fichier de CODE ne re-printe un jet. Le jet
 *  rendu passe par le dériveur (`traceLineOf`, forme OPPOSÉE `casc.opposedTrace` — #1262 V3 Lj, #1294) ;
 *  les re-prints IRRÉDUCTIBLES au dériveur vivent au CATALOGUE, comptés par `CATALOG_BASELINE`
 *  ci-dessous (#295, #1318) — une migration i18n ne fait donc pas DISPARAÎTRE un site du compte. */
const CONTENT_BASELINE: Record<string, number> = {};

/**
 * VOLET CATALOGUE (#1318 V8c₂) — le compteur ci-dessus lit du CODE ; depuis que la narration passe par
 * `t()`, un re-print de jet vit dans une VALEUR du catalogue (`{roll}/{target}`), hors de sa portée. Une
 * baseline qui décroît pour cette seule raison est une FAUSSE résorption : le texte joueur n'a pas
 * changé, seul l'endroit où il est écrit. Ce volet rend les sites visibles à nouveau.
 *
 * ALLOWLIST NOMINATIVE : les patrons du DÉRIVEUR (`traceLineOf`/`casc.*`) SONT la forme canonique du
 * jet rendu — c'est par eux qu'on résorbe les autres. Ils sont donc exemptés NOMMÉMENT, jamais par
 * préfixe fourre-tout : une clé neuve n'entre pas dans l'exemption sans qu'on l'écrive ici.
 *
 * CIBLE : `CATALOG_BASELINE` décroît par RÉSORPTION (le site repasse au dériveur), jamais par
 * déplacement. Ce que ce volet ne voit pas : un re-print recomposé au call-site à partir de deux clés,
 * ou une paraphrase du dé (« {roll} sur {target} ») — même angle mort que le compteur de code.
 */
const CATALOG_FILE = 'src/i18n/messages/fr.ts';
/** Patrons du DÉRIVEUR (forme canonique du jet rendu) — exemptés NOMMÉMENT. */
const DERIVEUR_KEYS = new Set([
  'casc.autoRowTrace', 'casc.rowTraceAnon', 'casc.rowTraceNoDr', 'casc.rowTraceAnonNoDr', 'casc.opposedTrace',
]);
/** Clés de catalogue qui RE-PRINTENT un jet hors dériveur, avec leur raison — cible de résorption. */
const CATALOG_BASELINE = [
  'cf.wardTestFail', 'cf.handGateFail', 'cf.handGatePass', // #410 : Tests de gate, journal = seule surface
  'cs.shameOvercome', 'cs.dispelRoll', // #410 : jet incisé dans la narration
  // #1318 V8c₂ — narrations de voyage (travelFlow/riverVoyageFlow) :
  'tf.beastExhausted', // bêtes de l'attelage : porteur SANS identité, dé parenthétique en justification
  'rv.holeInline', 'rv.fragRefloat', // calfatage / renflouage IA : idem
  // #1318 V8c₃, #295 — `seaVoyageFlow.runRestart` : la ligne porte le DR CUMULÉ du Test étendu
  // (`lastDR`), que le patron du dériveur ne saurait dire.
  'sv.engineRestart',
].sort();

/** Clés du catalogue dont la VALEUR re-printe un jet (`{roll}/{target}`), dériveur exclu. */
function catalogJetEchoKeys(): string[] {
  const src = readFileSync(join(ROOT, CATALOG_FILE), 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(/^\s*'([\w.]+)':\s*(['"])((?:\\.|(?!\2)[\s\S])*)\2/gm)) {
    const [, key, , value] = m;
    if (DERIVEUR_KEYS.has(key)) continue;
    if (/\{roll\}\/\{target\}/.test(value)) out.push(key);
  }
  return out.sort();
}

function jetEchoCount(src: string): number {
  return (src.match(/\$\{[^}]*\.roll\}\/\$\{[^}]*\.target\}/g) ?? []).length;
}

function contentCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(CONTENT_DIRS)) {
    const n = jetEchoCount(text);
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('cliquet composeur — CONTENU des conséquences : re-print roll/target hors rangée (#295 Lot 5, #410 inversé)', () => {
  it('aucun fichier de src/state|src/engine ne dépasse sa baseline gelée', () => {
    const counts = contentCounts();
    const over: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const b = CONTENT_BASELINE[rel] ?? 0;
      if (n > b) over.push(`${rel} : ${n} occurrence(s) (baseline gelée ${b})`);
    }
    expect(over, `Régression — re-print roll/target hors rangée (#295 Lot 5) :\n${over.join('\n')}`).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (site purgé) doit être ABAISSÉE', () => {
    const counts = contentCounts();
    const stale: string[] = [];
    for (const [rel, b] of Object.entries(CONTENT_BASELINE)) {
      const n = counts[rel] ?? 0;
      if (n < b) stale.push(`${rel} : baseline gelée ${b}, réel ${n} — ABAISSER`);
    }
    expect(stale, `Baseline(s) PÉRIMÉE(s) — abaisser (site purgé depuis) :\n${stale.join('\n')}`).toEqual([]);
  });

  it('CATALOGUE : les clés qui re-printent un jet sont EXACTEMENT celles déclarées (dériveur exempté)', () => {
    const mesure = catalogJetEchoKeys();
    const nouvelles = mesure.filter((k) => !CATALOG_BASELINE.includes(k));
    const disparues = CATALOG_BASELINE.filter((k) => !mesure.includes(k));
    expect(nouvelles, 'NOUVEAU re-print de jet au catalogue — passer par le dériveur (`traceLineOf`)').toEqual([]);
    expect(disparues, 'clé RÉSORBÉE : retire-la de CATALOG_BASELINE (le cliquet ne fait que décroître)').toEqual([]);
  });

  it('fail-closed : le volet catalogue MESURE (une clé synthétique à `{roll}/{target}` est vue, le dériveur non)', () => {
    // Contre-preuve du scan : la forme qu'il cherche, et l'exemption qu'il applique.
    expect(/\{roll\}\/\{target\}/.test("'x.y': 'Test : {roll}/{target} → {issue}'")).toBe(true);
    expect(DERIVEUR_KEYS.has('casc.rowTraceAnon')).toBe(true);
    // …et le compte réel n'est pas vide (un scan cassé rendrait la garde verte pour rien).
    // Plancher 10 → 9 (#1657 B3-2) : `rv.splinterDodgedRoll`/`rv.fragDodgeFailed` sont MORTES avec le
    // double applier d'éclats — le stock de résorption décroît, le plancher de la sonde le suit.
    expect(catalogJetEchoKeys().length).toBeGreaterThanOrEqual(9);
  });

  it('fail-closed : le compteur détecte un re-print roll/target SYNTHÉTIQUE hors littéral journal:', () => {
    const regressed = "  return { consequences: freeCons([`${hero.name} : ${step.result.roll}/${step.result.target} → réussi.`]) };";
    expect(jetEchoCount(regressed)).toBe(1);
  });
});

/**
 * VOLET ISSUE (#1262 V3 Lj) — le canal de l'ISSUE d'un jet. Le murage par export est impossible
 * (`get().log` sert le narratif légitime, `describeX` sert AUSSI l'affichage des fenêtres de
 * `src/ui`) : la police est un LINT D'IMPORT AST (mur `murs/canal-issue`, `eslint.config.js`, patron
 * `ownsLocally`), borné à `src/state` — la couche qui décidait — et MESURÉ ici sur la config RÉELLE
 * (API ESLint, jamais une copie de règle : une regex maison laissait passer les guillemets doubles).
 *
 * Deux goulots exemptés, nommés, et RIEN d'autre : la DÉCLARATION d'issue d'un flux à fenêtre
 * (`rollFlowSpecs.ts`, `spec.issue`, rendue par le verbe `apply`) et la conséquence d'étape de
 * cascade (`encounterPsychFlow.ts` → `freeCons` → `commitStep`).
 *
 * CE QUE CETTE POLICE NE VOIT PAS, mesuré (cf. les deux derniers tests, qui l'attestent au lieu de
 * l'affirmer) : l'import DYNAMIQUE (`await import('./flowOutcomes')`), le `require()`, et surtout
 * toute recopie qui ne passe PAS par un import — réécrire la phrase à la main, ou la router par la
 * clé de catalogue (`t('out.reload', …)`). Aucune garde du dépôt ne tient cette dernière porte : le
 * garde i18n compte des littéraux FR par fichier, il ne juge aucun contenu. La limite est écrite ici
 * plutôt que couverte à tort.
 */
const ISSUE_GOULOTS = [
  'src/state/rollFlowSpecs.ts', // DÉCLARATION `spec.issue` des flux à fenêtre → verbe `apply`
  'src/state/encounterPsychFlow.ts', // conséquence d'étape (freeCons → commitStep)
];

/** Fichier de sonde SOUS le périmètre de la règle (aucun goulot, hors test). */
const SOUS_LA_REGLE = 'src/state/__sonde-canal-issue.ts';
const eslint = new ESLint({ cwd: ROOT });

/** Occurrences de la règle d'import restreint sur un CODE donné (config réelle). */
async function violationsCanal(code: string, filePath = SOUS_LA_REGLE): Promise<number> {
  const [res] = await eslint.lintText(code, { filePath, warnIgnored: false });
  return res.messages.filter((m) => m.ruleId === 'murs/canal-issue').length;
}

describe('cliquet du canal — l’ISSUE d’un jet ne se compose qu’aux GOULOTS (#1262 V3 Lj)', () => {
  it('src/state RÉEL : aucun fichier ne compose d’issue hors goulot (la population EST le contrat)', async () => {
    // Pré-filtre par SOUS-CHAÎNE nue (« flowOutcomes ») — aucune forme d'import n'y échappe, et seuls
    // les candidats sont lintés (linter tout `src/state` coûte ~8 s à chaque run pour le même verdict).
    // La population EST le corpus réel de `src/state`, tests compris, lu par `readCorpus` — mémoïsé par
    // clé, donc partagé avec les autres gardes du même worker.
    const candidats = readCorpus(['src/state'], { tests: true })
      .filter(({ text }) => text.includes('flowOutcomes'))
      .map(({ abs }) => abs);
    const res = await eslint.lintFiles(candidats);
    const offenders = res.flatMap((r) => r.messages
      .filter((m) => m.ruleId === 'murs/canal-issue')
      .map(() => relative(ROOT, r.filePath).split('\\').join('/')));
    expect(offenders, 'Issue composée hors goulot — déclarer `spec.issue` et acquitter par `flow.apply` :').toEqual([]);
  }, { timeout: 30_000 });

  it('les GOULOTS sont exemptés NOMMÉMENT (et eux seuls) : le même import y passe', async () => {
    for (const g of ISSUE_GOULOTS) {
      expect(await violationsCanal("import { describeReload } from './flowOutcomes';", g), g).toBe(0);
    }
  });

  it('fail-closed : la règle MORD, quelles que soient les guillemets, la forme d’import ou l’alias', async () => {
    expect(await violationsCanal("import { describeReload } from './flowOutcomes';"), 'guillemets simples').toBe(1);
    expect(await violationsCanal('import { describeReload } from "./flowOutcomes";'), 'guillemets DOUBLES').toBe(1);
    expect(await violationsCanal("import * as FO from './flowOutcomes';\nexport const x = FO;"), 'namespace').toBe(1);
    expect(await violationsCanal("import { describeReload } from '../flowOutcomes';"), 'chemin remontant').toBe(1);
    expect(await violationsCanal("import { describeReload } from '@/state/flowOutcomes';"), 'alias').toBe(1);
    expect(await violationsCanal("export { describeReload } from './flowOutcomes';"), 're-export').toBe(1);
    expect(await violationsCanal("import { ev } from './combatLog';\nexport const w = ev;"), 'un autre import ne mord pas').toBe(0);
  });

  it('LIMITES ASSUMÉES, mesurées : import dynamique, `require`, et recopie par CLÉ i18n passent', async () => {
    expect(await violationsCanal("export const f = async () => (await import('./flowOutcomes')).describeReload;"), 'import dynamique').toBe(0);
    expect(await violationsCanal("const FO = require('./flowOutcomes');\nexport const y = FO;"), 'require').toBe(0);
    expect(
      await violationsCanal("import { t } from '../i18n';\nexport const z = () => t('out.reload', { name: 'x', weapon: 'w', after: 1, reload: 2 });"),
      'recopie par clé de catalogue : AUCUNE garde ne la tient — dit au JSDoc ci-dessus',
    ).toBe(0);
  });
});
