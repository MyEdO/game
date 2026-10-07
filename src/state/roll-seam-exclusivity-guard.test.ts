import { ast, analyserCorpus } from '../../scripts/guards/lib/dialecte.mjs';
import { describe, it, expect, vi } from 'vitest';
import { rendreCible } from '../../scripts/docs/build-all.mjs';
import * as ts from 'typescript/unstable/ast';
import { useGame } from './store';
import { CLOTURE_VERBES, jouerLesClotures } from './combatEffects';
import './combatFlow'; // charge les clôtures que le combat enregistre (`ouvrirEcranDeVictoire`)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanRollSeamExclusivity, ROLL_SEAM_RX, scanPendingJetFabrication, engineRollerExports, engineHomonyms, scanEngineDelegatedRoll, scanDesHorsPorte, engineDiceRollers, AMORCE_DES } from '../../scripts/guards/lib/rollSeamExclusivity.mjs';
import { RACINE_DU_SEAM, rollSeamExcluded, ROLL_SEAM_PHASE2_STOCK, WORLD_DIE_SUBTRACTED_STOCK, PENDING_JET_FABRICATION_STOCK, ENGINE_DELEGATED_ROLL_STOCK, DES_HORS_PORTE_STOCK, SEAM_CALLERS } from '../../scripts/guards/lib/rollSeamWhitelist.mjs';
import { contexteDeScanRng, scanBattleRngEngineLeak } from '../../scripts/guards/lib/battleRngEngineLeak.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { tableDesExports } from '../../scripts/guards/lib/canonUnique.mjs';
import * as canon from '../../scripts/guards/lib/canonUnique.mjs';
import * as programmes from '../../scripts/guards/lib/tsProgram.mjs';
import { scanRegistryIdBranch } from '../../scripts/guards/lib/registryIdBranch.mjs';
import { battleRngEngineLeakExcluded } from '../../scripts/guards/lib/battleRngEngineLeakWhitelist.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { detenteur } from '../detenteur.testkit';

/**
 * Garde-fou « exclusivité du seam de jet » (#274, DERNIER verrou du programme #276).
 * La porte `openRoll` (`src/state/rollSeam.ts`) +
 * `TestOutcome.seal` (`src/engine/testOutcome.ts`) sont le SEUL chemin scellé pour produire une issue
 * de Test — un `rollTest(`/`d100(`/`TestOutcome.seal(` inline hors whitelist forge un jet SANS passer
 * par la policy de surfaçage M/V/I (Décision 3). Un `rollTest` réintroduit dans un flow est rouge ICI
 * (CI) et AVERTI au commit (`scripts/git-hooks/pre-commit.mjs`).
 *
 * Ce qui n'est PAS une violation se décide par la FORME, pas par une liste de noms (#918) :
 *  - `src/engine/**` : moteur PUR, fonctions qui REÇOIVENT un `rng` sans jamais décider du
 *    surfaçage — c'est l'APPELANT (state/) qui choisit modale/MJ/inline (règle du seam elle-même).
 *  - (S) position de spec et (M) dé de monde : reconnues STRUCTURELLEMENT par le scanner (critères
 *    et angles morts en en-tête de `scripts/guards/lib/rollSeamExclusivity.mjs`).
 *  - `ROLL_SEAM_CORE` : les fichiers qui SONT le seam (porte, fabrique, séquenceur, résolveurs de
 *    spec, pont de Test déclenché) — exclusion de principe.
 *  - `ROLL_SEAM_PHASE2_STOCK` : le stock restant à router par `openRoll`, avec son compte par fichier
 *    vérifié plus bas (cf. `scripts/guards/lib/rollSeamWhitelist.mjs`).
 */

/** `docs/registre-jets.md` tel que son générateur le rend (`rendreCible`), jamais le fichier du disque. */
const DOC_REGISTRE = await rendreCible('docs/registre-jets.md');
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = [RACINE_DU_SEAM];

const EXCLUDED = (rel: string) => estFichierVitest(rel) || rollSeamExcluded(rel);

/** Corpus SOURCE de tous les scans de ce fichier : `src/**` en `.ts(x)`, TESTS COMPRIS (les vues
 *  `prodFiles`/`EXCLUDED` filtrent ensuite), chemin RELATIF POSIX + texte. Marche, lecture et
 *  MÉMOÏSATION par clé dans `scripts/guards/lib/sourceCorpus.mjs` : les 13 assertions de corpus de
 *  ce fichier — et les autres fichiers de test du même worker — partagent une seule lecture, payée
 *  au 1ᵉʳ appel (jamais à la collecte Vitest). */
const corpus = () => readCorpus(SCAN_DIRS, { tests: true });

describe('contexte d’import des parcours manuels', () => {
  const table = { 'src/engine/dice.ts': ['d100'] };
  const texte = [
    "import { d100, d100 as alias } from '../engine/dice';",
    "import * as dice from '../engine/dice';",
    'd100();', 'alias();', 'dice.d100();',
    'function masque(d100, dice) { d100(); dice.d100(); }',
  ].join('\n');
  const rng = [
    "import { battleRng } from './battleRng';",
    "import { resolveMelee, resolveMelee as alias } from '../engine/combat';",
    "import * as combat from '../engine/combat';",
    'battleRng();', 'resolveMelee();', 'alias();', 'combat.resolveMelee();',
    'function masque(resolveMelee, combat) { resolveMelee(); combat.resolveMelee(); }',
  ].join('\n');
  it.each([
    ['dés hors porte', () => scanDesHorsPorte('src/state/probe.ts', texte, table)],
    ['jets délégués', () => scanEngineDelegatedRoll('src/state/probe.ts', texte, table)],
    ['rng vivant', () => scanBattleRngEngineLeak('src/state/probe.ts', rng, { resolveurs: { 'src/engine/combat.ts': ['resolveMelee'] } })],
  ] as const)('%s partage un contexte et un programme entre occurrences, renouvelés au scan suivant', (_nom, scanner) => {
    const contextes = vi.spyOn(canon, 'contexteImports');
    const programmesCrees = vi.spyOn(programmes, 'syntaxProgram');
    try {
      expect(scanner()).toHaveLength(3);
      expect(contextes).toHaveBeenCalledTimes(1);
      expect(programmesCrees).toHaveBeenCalledTimes(1);
      const premier = contextes.mock.results[0].value as canon.ContexteImports;
      expect(scanner()).toHaveLength(3);
      expect(contextes).toHaveBeenCalledTimes(2);
      expect(programmesCrees).toHaveBeenCalledTimes(2);
      const second = contextes.mock.results[1].value as canon.ContexteImports;
      expect(second).not.toBe(premier);
      expect(second.source).not.toBe(premier.source);
      expect(second.source.fileName).toBe(premier.source.fileName);
    } finally {
      contextes.mockRestore();
      programmesCrees.mockRestore();
    }
  });

  it('registre : le vocabulaire importé garde son origine sans construire de checker', () => {
    const contextes = vi.spyOn(canon, 'contexteImports');
    const programmesCrees = vi.spyOn(programmes, 'syntaxProgram');
    const corps = "const ids: Os[] = ['head', 'torso']; function f(entry) { return ids.includes(entry.id); }";
    try {
      expect(scanRegistryIdBranch('src/probe.ts', "import type { BoneId as Os } from './gameIso/rig/bones';" + corps)).toEqual([]);
      expect(scanRegistryIdBranch('src/probe.ts', "import type { BoneId as Os } from './engine/types';" + corps)).toHaveLength(1);
      expect(contextes).toHaveBeenCalledTimes(2);
      expect(programmesCrees).toHaveBeenCalledTimes(2);
    } finally {
      contextes.mockRestore();
      programmesCrees.mockRestore();
    }
  });
});

/** Sites de roulage brut du corpus entier, mode `includeExcluded` — SUR-ENSEMBLE dont la forme NUE du
 *  garde est le sous-ensemble sans `excludedBy` (rollSeamExclusivity.mjs, `opts.includeExcluded`) :
 *  un seul parcours nourrit le garde d'exclusivité ET le compteur (M). */
const sitesByFile = detenteur(() => {
  const m = new Map<string, { line: number; detail: string; excludedBy?: string }[]>();
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(corpus())) m.set(rel, scanRollSeamExclusivity(rel, text, { includeExcluded: true }, sourceFile!));
  return m;
});

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [rel, sites] of sitesByFile()) {
    if (EXCLUDED(rel)) continue;
    const n = sites.filter((s) => !s.excludedBy).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « seam de jet » — exclusivité de rollTest/d100/TestOutcome.seal (cliquet, #274)', () => {
  it('aucun fichier hors whitelist ne roule/scelle un Test en direct', { timeout: 240_000 }, () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Nouveau jet forgé hors seam — router par openRoll (src/state/rollSeam.ts) ou justifier l'entrée dans la whitelist (roll-seam-exclusivity-guard.test.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte un rollTest inline SYNTHÉTIQUE', () => {
    const regressed = "const res = rollTest(best.value, 'intermediaire', battleRng());";
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('fail-closed : le scanner détecte un d100 inline SYNTHÉTIQUE (DR forgés à la main)', () => {
    const regressed = 'const sl = Math.floor(target / 10) - Math.floor(d100(rng) / 10);';
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('fail-closed : le scanner détecte un TestOutcome.seal( hors seam SYNTHÉTIQUE', () => {
    const regressed = "return TestOutcome.seal({ roll: 1, target: 40, success: true, sl: 1, isDouble: false });";
    expect(scanRollSeamExclusivity('src/state/x.ts', regressed).length).toBe(1);
  });

  it('périmètre : un flux de `src/` entre dans les gardes du seam et du rng, un outil de `scripts/` non', () => {
    expect(rollSeamExcluded('src/state/x.ts')).toBe(false);
    expect(battleRngEngineLeakExcluded('src/state/x.ts')).toBe(false);
    expect(rollSeamExcluded('scripts/ops/table-des.mts')).toBe(true);
    expect(battleRngEngineLeakExcluded('scripts/ops/table-des.mts')).toBe(true);
  });

  it('le noyau du seam (rollSeam.ts, hors scan) porte bien TestOutcome.seal( — sinon le foyer a bougé', () => {
    const src = readFileSync(join(ROOT, 'src/state/rollSeam.ts'), 'utf8');
    expect(scanRollSeamExclusivity('src/state/rollSeam.ts', src).length).toBeGreaterThan(0);
  });

  it('lignes EXACTES : un JSDoc de 10 lignes avant le site ne décale pas la ligne rapportée', () => {
    const src = [
      "import { rollTest } from '../engine/tests';",
      '/**',
      ' * 1', ' * 2', ' * 3', ' * 4', ' * 5', ' * 6', ' * 7', ' * 8',
      ' */',
      "const t = rollTest(40, 'intermediaire', battleRng());",
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', src)).toEqual([
      { line: 12, detail: "rollTest(40, 'intermediaire', battleRng())" },
    ]);
  });

  it('(S) position de spec : un rollTest dans le callback `resolve` d’une spec makeRollFlow n’est pas une violation', () => {
    const spec = [
      'export const FLOWS = {',
      '  test: makeRollFlow({',
      '    resolve: (p) => rollTest(p.skillValue, p.difficulty, battleRng()),',
      '  }),',
      '};',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', spec)).toEqual([]);
  });

  it('(S) hors position : le MÊME rollTest dans une fonction libre reste une violation', () => {
    const libre = 'function resolve(p) { return rollTest(p.skillValue, p.difficulty, battleRng()); }';
    expect(scanRollSeamExclusivity('src/state/x.ts', libre).length).toBe(1);
  });

  it('(M) dé de monde : un d100 comparé à un seuil n’est pas une violation', () => {
    expect(scanRollSeamExclusivity('src/state/x.ts', 'if (d100(rng) <= chance.target) { found = true; }')).toEqual([]);
  });

  it('(M) dé de monde : un d100 lu en TABLE (findTableEntry, via une liaison locale) n’est pas une violation', () => {
    const table = [
      'function tirer(rng) {',
      '  const roll = d100(rng);',
      '  return findTableEntry(t.ranges, roll);',
      '}',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', table)).toEqual([]);
  });

  it('(M) ne blanchit pas un Test déguisé : un d100 qui nourrit une valeur de Test reste une violation', () => {
    const deguise = "const sl = Math.floor(testValue(c, 'perception') / 10) - Math.floor(d100(rng) / 10);";
    expect(scanRollSeamExclusivity('src/state/x.ts', deguise).length).toBe(1);
  });

  it('(M) ne blanchit pas un Test à variable NEUTRE : la valeur comparée vient d’effectiveChar (A1)', () => {
    const neutre = [
      'function jet(c, rng) {',
      "  const cible = effectiveChar(c, 'ag');",
      "  if (d100(rng) <= cible) return 'reussi';",
      "  return 'rate';",
      '}',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', neutre).length).toBe(1);
  });

  it('(M) ne blanchit pas un Test OPPOSÉ maison : deux d100 contre deux caractéristiques (A4)', () => {
    const duel = [
      'function duel(a, b, rng) {',
      "  const va = effectiveChar(a, 'cc');",
      "  const vb = effectiveChar(b, 'cc');",
      '  return (d100(rng) <= va) && (d100(rng) > vb);',
      '}',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', duel).length).toBe(2);
  });

  it('(M) ne blanchit pas un d100 comparé à une caractéristique EN DIRECT (E2)', () => {
    const direct = 'function jet(c, rng) { if (d100(rng) <= c.characteristics.ag) return 1; return 0; }';
    expect(scanRollSeamExclusivity('src/state/x.ts', direct).length).toBe(1);
  });

  it('(S) fail-closed : un callback `resolve` DÉPORTÉ (fonction libre référencée) reste une violation (B1)', () => {
    const deporte = [
      'function resolveIt(p) { return rollTest(p.skillValue, p.difficulty, battleRng()); }',
      'export const F = { t: makeRollFlow({ resolve: resolveIt }) };',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', deporte).length).toBe(1);
  });

  it('(S) fail-closed : une spec CONSTRUITE puis passée à makeRollFlow reste une violation (B2)', () => {
    const construite = [
      "const spec = { resolve: (p) => rollTest(p.skillValue, p.difficulty, battleRng()) };",
      'export const F = makeRollFlow(spec);',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', construite).length).toBe(1);
  });

  it('(S) la MÉTHODE raccourcie du littéral est une position de spec au même titre que la propriété (B3)', () => {
    const methode = [
      'export const F = makeRollFlow({',
      '  resolve(p) { return rollTest(p.skillValue, p.difficulty, battleRng()); },',
      '});',
    ].join('\n');
    expect(scanRollSeamExclusivity('src/state/x.ts', methode)).toEqual([]);
  });

  it('pré-filtre : les formes espacées/multilignes/génériques passent la garde ET sont détectées', () => {
    const formes: [string, string][] = [
      ['C1b d100 espacé', "const t = rollTest(1,'moyen',rng);\nconst r = d100 (rng);\nconst dr = Math.floor(testValue(c,'x')/10) - Math.floor(r/10);"],
      ['C3b TestOutcome .seal multiligne', "const t = rollTest(1,'moyen',rng);\nreturn TestOutcome\n  .seal({ roll: 1, target: 40, success: true, sl: 1, isDouble: false });"],
      ['C4b rollTest espacé', "const x = d100(rng);\nconst t = rollTest (40, 'moyen', battleRng());"],
      ['F2 rollTest générique', "const t = rollTest<string>(40, 'moyen', battleRng());"],
    ];
    const rates = formes.filter(([, src]) => !ROLL_SEAM_RX.test(src) || scanRollSeamExclusivity('src/state/x.ts', src).length === 0);
    expect(rates.map(([nom]) => nom)).toEqual([]);
  });

  it('stock de phase 2 (#918) : le compte déclaré par fichier est le compte MESURÉ', { timeout: 60_000 }, () => {
    const ecarts: string[] = [];
    for (const [rel, attendu] of ROLL_SEAM_PHASE2_STOCK) {
      const n = scanRollSeamExclusivity(rel, readFileSync(join(ROOT, rel), 'utf8')).length;
      if (n !== attendu) ecarts.push(`${rel} : ${n} site(s) mesuré(s), ${attendu} déclaré(s)`);
    }
    expect(
      ecarts,
      `Stock de phase 2 périmé — un site de plus est une régression, un site migré se solde ICI (ROLL_SEAM_PHASE2_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  /**
   * (M) PUBLIE CE QU'ELLE SOUSTRAIT (#1426). La forme « dé de monde » est une exemption STRUCTURELLE :
   * elle ne laisse par construction AUCUNE liste à relire, et c'est exactement ce qui lui a permis
   * d'absorber 11 sites hors moteur pendant que le garde restait vert. Le compte par fichier est donc
   * gelé ICI, au MÊME patron que `ROLL_SEAM_PHASE2_STOCK`, et mesuré par le scanner CANONIQUE en mode
   * `includeExcluded` — jamais par un fork instrumenté, qui serait un second socle de scan.
   *
   * PÉRIMÈTRE : hors `src/engine/**`. Le moteur reçoit un rng et ne décide pas du surfaçage ; ses sites
   * sont déjà comptés à leur CALL-SITE dans `ENGINE_DELEGATED_ROLL_STOCK`, les compter deux fois
   * ferait mentir les deux listes.
   */
  it('(M) dé de monde : le compte SOUSTRAIT par fichier est le compte MESURÉ (cliquet à cible zéro)', () => {
    const mesure = new Map<string, number>();
    for (const [rel, sites] of sitesByFile()) {
      if (estFichierVitest(rel) || rel.startsWith('src/engine/')) continue;
      const n = sites.filter((s: { excludedBy?: string }) => s.excludedBy === 'M').length;
      if (n > 0) mesure.set(rel, n);
    }
    const ecarts: string[] = [];
    for (const [rel, { n }] of WORLD_DIE_SUBTRACTED_STOCK) {
      const vu = mesure.get(rel) ?? 0;
      if (vu !== n) ecarts.push(`${rel} : ${vu} site(s) mesuré(s), ${n} déclaré(s)${vu === 0 ? ' — entrée PÉRIMÉE, à retirer' : ''}`);
    }
    for (const [rel, n] of mesure) {
      if (!WORLD_DIE_SUBTRACTED_STOCK.has(rel)) ecarts.push(`${rel} : ${n} dé(s) de monde HORS compteur — router par une porte du canal (openWorldTest / rollTableStep / deMonde), ou entrer ICI avec sa raison`);
    }
    expect(
      ecarts,
      `Ce que (M) soustrait a bougé — une exemption structurelle qui absorbe en silence est le défaut même que ce compteur ferme (WORLD_DIE_SUBTRACTED_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque entrée du compteur (M) nomme le lot qui l\u2019emporte (dette à cible zéro, jamais un registre d\u2019équilibre)', () => {
    const nues = [...WORLD_DIE_SUBTRACTED_STOCK]
      .filter(([, v]) => !/#\d+/.test(v.why ?? ''))
      .map(([rel]) => rel);
    expect(nues, `Entrée du compteur (M) sans ticket — une population qui doit tomber à zéro nomme le lot qui l'emporte :\n${nues.join('\n')}`).toEqual([]);
  });

  it('fail-closed : `includeExcluded` rend bien les sites (M), et le mode NU du garde ne les voit jamais', () => {
    const monde = 'if (d100(rng) <= chance.target) { found = true; }';
    expect(scanRollSeamExclusivity('src/state/x.ts', monde)).toEqual([]);
    const avec = scanRollSeamExclusivity('src/state/x.ts', monde, { includeExcluded: true });
    expect(avec.map((s: { excludedBy?: string }) => s.excludedBy)).toEqual(['M']);
  });

  it('fail-closed : `includeExcluded` marque (S) sans le confondre avec (M)', () => {
    const spec = 'export const F = makeRollFlow({ resolve: (p) => rollTest(p.skillValue, p.difficulty, battleRng()) });';
    const avec = scanRollSeamExclusivity('src/state/x.ts', spec, { includeExcluded: true });
    expect(avec.map((s: { excludedBy?: string }) => s.excludedBy)).toEqual(['S']);
  });

  /**
   * CLAUSE DE COMPLÉTUDE (#1426) — le `why` d'une entrée de registre qui invoque « dé de monde » ou
   * « aucun acteur » plaide une prémisse que #1262 (sentinel `worldOwner`) puis #939 (« tout jet qu'on
   * contrôle — héros / PNJ / environnement ») ont périmée : « personne ne le porte » n'est plus une
   * raison de rester hors de la porte. Une telle justification doit donc être confrontée au lot qui a
   * redéfini le périmètre, et le DIRE. Sans cette clause, le test ne vérifiait que la FORME du champ.
   */
  it('complétude : un `why` qui plaide « dé de monde / aucun acteur » cite le lot qui a redéfini le périmètre', () => {
    // #1508 rejoint #1426 comme lot de référence : il va PLUS LOIN (aucune classe de dé n'est hors
    // porte, magnitudes et dispersion comprises), donc une justification qui le cite est confrontée
    // au périmètre le plus récent, pas à l'ancien.
    const PLAIDE = /d[eé]s? de MONDE|aucun acteur/i;
    const orphelines = [...PENDING_JET_FABRICATION_STOCK, ...ENGINE_DELEGATED_ROLL_STOCK]
      .filter(([, e]) => PLAIDE.test(e.why ?? '') && !/#(1426|1508)/.test(e.why ?? ''))
      .map(([rel]) => rel);
    expect(
      orphelines,
      `Justification « dé de monde / aucun acteur » non confrontée au canal des dés de monde (#1426) — la prémisse « personne ne le porte » n'exempte plus de la porte depuis le sentinel \`worldOwner\` (#1262) :\n${orphelines.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * Garde-fou « rng vivant → résolveur moteur » (#370, ronde 2 — cf. `battleRngEngineLeak.mjs`). Le
 * garde d'exclusivité ci-dessus exempte TOUT `src/engine/**` au motif que le moteur pur « reçoit un
 * rng sans jamais décider du surfaçage » — motif qui suppose que l'APPELANT passe par le seam. Ce
 * second garde ferme le trou : un flux `state/**` qui appelle DIRECTEMENT un résolveur moteur `resolveXxx`
 * (convention du dépôt : « roule ET décide » une confrontation complète — Test opposé/étendu, gagnant/DR)
 * avec un rng VIVANT (`battleRng()`) au call-site contourne la policy M/V/I aussi sûrement qu'un
 * `rollTest(` inline.
 */
describe('garde-fou « rng vivant → résolveur moteur » — un flux state/** ne peut plus appeler un resolveXxx(…) moteur avec battleRng() en direct (#370)', () => {
  const contexte = detenteur(contexteDeScanRng);
  it('aucun fichier hors whitelist ne remet un rng vivant à un résolveur moteur', { timeout: 60_000 }, () => {
    const offenders: string[] = [];
    const passage = contexte();
    for (const { fichier: { rel, text }, sourceFile, checker } of analyserCorpus(corpus().filter(({ rel }) => !estFichierVitest(rel) && !battleRngEngineLeakExcluded(rel)))) {
      const findings = scanBattleRngEngineLeak(rel, text, passage, sourceFile!, checker);
      for (const x of findings) offenders.push(`${rel}:${x.line} [rng vivant → ${x.name}] ${x.detail}`);
    }
    expect(
      offenders,
      `rng vivant remis à un résolveur moteur hors seam — router par openRoll (côté joueur) + rouler l'adversaire en POST-COMMIT dans l'applier (patron portFlow.ts), ou justifier l'entrée dans battleRngEngineLeakWhitelist.mjs :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('le scanner détecte un resolveXxx(…, battleRng()) SYNTHÉTIQUE', () => {
    const regressed = [
      "import { resolveMelee } from '../engine/combat';",
      "import { battleRng } from './battleRng';",
      "const res = resolveMelee(attacker, defender, battleRng());",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', regressed, contexte()).length).toBe(1);
  });

  it('le scanner MORD le rng HOISTÉ (battleRng() et resolveXxx( sur des lignes séparées, #370)', () => {
    const hoisted = [
      "import { resolveMelee } from '../engine/combat';",
      "import { battleRng } from './battleRng';",
      "const rng = battleRng();",
      "const res = resolveMelee(attacker, defender, rng);",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', hoisted, contexte()).length).toBe(1);
  });

  it('zéro faux positif : une primitive roll*/valeur (testValue/effectiveChar) voisine d’un battleRng() sur une AUTRE ligne ne matche pas', () => {
    const clean = [
      "import { rollTavernTest } from '../engine/tavernGame';",
      "import { battleRng } from './battleRng';",
      "const v = testValue(hero, 'pari');",
      "const opponentTR = rollTavernTest(opponentValue, battleRng());",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', clean, contexte()).length).toBe(0);
  });

  it('zéro faux positif : un résolveur moteur PUR (resolveOpposed, aucun paramètre RNG) coexistant avec battleRng() ne matche pas (#912)', () => {
    const clean = [
      "import { resolveOpposed } from '../engine/tests';",
      "import { battleRng } from './battleRng';",
      'const rng = battleRng();',
      "const res = resolveOpposed(attackerTR, defenderTR);",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', clean, contexte()).length).toBe(0);
  });

  it('vrai positif préservé : un résolveur moteur RNG-capable réel (resolveCasting) reste détecté (#912)', () => {
    const regressed = [
      "import { resolveCasting } from '../engine/magic';",
      "import { battleRng } from './battleRng';",
      "const res = resolveCasting(caster, spell, battleRng());",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', regressed, contexte()).length).toBe(1);
  });

  it('un import RENOMMÉ et un appel par NAMESPACE d’un résolveur à RNG comptent, sous le nom exporté', () => {
    const renomme = [
      "import { resolveMelee as melee } from '../engine/combat';",
      "import { battleRng } from './battleRng';",
      'const res = melee(attacker, defender, battleRng());',
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', renomme, contexte()).map((f) => f.name)).toEqual(['resolveMelee']);
    const espace = [
      "import * as combat from '../engine/combat';",
      "import { battleRng } from './battleRng';",
      'const res = combat.resolveMelee(attacker, defender, battleRng());',
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', espace, contexte()).map((f) => f.name)).toEqual(['resolveMelee']);
  });

  it('un battleRng LOCAL, non importé, ou un HOMONYME local d’un résolveur ne comptent pas', () => {
    const local = [
      "import { resolveMelee } from '../engine/combat';",
      'const battleRng = () => makeRNG(1);',
      'const res = resolveMelee(attacker, defender, battleRng());',
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', local, contexte())).toEqual([]);
    const homonyme = [
      "import { battleRng } from './battleRng';",
      'const resolveMelee = (a, b, rng) => a;',
      'const res = resolveMelee(attacker, defender, battleRng());',
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', homonyme, contexte())).toEqual([]);
  });

  /* CONTRAT DU TEXTE SCANNÉ (#1788) : le scan lit la vue CODE SEUL (`codeSeul.mjs`), commentaires ET
   * littéraux de chaîne blanchis. Ce qui est écrit dans une chaîne n'appelle rien : c'est une DONNÉE,
   * et le scan ne la voit pas. Ce que ce choix laisse passer est MESURÉ ici, pas supposé. */
  it('un appel écrit en CHAÎNE n’est pas un appel — et le voisin en CODE en est un', () => {
    const donnee = [
      "import { resolveCasting } from '../engine/magic';",
      "import { battleRng } from './battleRng';",
      'const rng = battleRng();',
      "const gabarit = 'resolveCasting(caster, spell, rng)';",
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', donnee, contexte()).length).toBe(0);

    const codeEtDonnee = [...donnee.split('\n'), 'const res = resolveCasting(caster, spell, rng);'].join('\n');
    const trouve = scanBattleRngEngineLeak('src/state/x.ts', codeEtDonnee, contexte());
    expect(trouve.map((f) => f.line)).toEqual([5]);
  });

  it('le blanchiment PRÉSERVE les lignes : le numéro rapporté est celui de la source (#1788)', () => {
    const regressed = [
      "import { resolveCasting } from '../engine/magic';",
      "import { battleRng } from './battleRng';",
      '/* un bloc',
      ' * de prose',
      ' */',
      'const res = resolveCasting(caster, spell, battleRng());',
    ].join('\n');
    expect(scanBattleRngEngineLeak('src/state/x.ts', regressed, contexte()).map((f) => f.line)).toEqual([6]);
  });
});

/**
 * REGISTRE DES CHEMINS DE JET (#1066) — deux familles de plus, MÊME module de gardes (mécanique dans
 * `rollSeamExclusivity.mjs`, policy dans `rollSeamWhitelist.mjs`), jamais un scanner parallèle : deux
 * comptes divergents du même stock sont le défaut classique. Les deux populations que les gardes
 * ci-dessus laissent passer par construction :
 *  (F) FABRICATION d'un pending de jet au call-site (le roulage arrive plus tard, par le seam — donc
 *      rien ne le signale) ;
 *  (D) roulage DÉLÉGUÉ à un export de `src/engine` (exempté de principe) appelé par un flux.
 * Ce lot FIGE la population avant que #1064 la fasse bouger : une entrée sans justification, un site
 * de plus, ou une entrée devenue vide sont rouges.
 */
const SEAM_CORE = new Set([
  'src/state/rollSeam.ts', 'src/state/rollFlowFactory.ts', 'src/state/cascade.ts',
  'src/state/rollFlowSpecs.ts', 'src/state/combat/triggeredTest.ts',
]);

/** Fichiers de PRODUCTION scannables (hors tests), en chemin relatif POSIX — vue du `corpus()`. */
function prodFiles(...dirs: string[]): { rel: string; text: string }[] {
  return corpus().filter(({ rel }) => !estFichierVitest(rel) && dirs.some((d) => rel === d || rel.startsWith(`${d}/`)));
}

/** Rouleurs d'engine DÉRIVÉS (clôture transitive) — mémoïsés : 4 `it` de deux `describe` les
 *  demandent, la dérivation reparse tout `src/engine` à chaque appel. */
const rollers = detenteur(() => engineRollerExports(prodFiles('src/engine')));
/** Table `{ module: [rouleurs] }` de (D), lue par `scanEngineDelegatedRoll` — détenue, comme `rollers()`. */
const delegues = detenteur(() => tableDesExports(prodFiles('src/engine'), rollers().keys()));
/** Table d'une fixture de (D) : le module de `resolveClash`. */
const MASS_BATTLE = { 'src/engine/massBattle.ts': ['resolveClash'] };

type Stock = Map<string, { n: number; kind: string; why: string }>;

/** Écarts « compte mesuré vs compte déclaré » d'un stock, plus les fichiers hors stock. */
function stockDiff(stock: Stock, mesure: Map<string, number>) {
  const ecarts: string[] = [];
  for (const [rel, { n }] of stock) {
    const vu = mesure.get(rel) ?? 0;
    if (vu !== n) ecarts.push(`${rel} : ${vu} site(s) mesuré(s), ${n} déclaré(s)${vu === 0 ? ' — entrée PÉRIMÉE, à retirer' : ''}`);
  }
  const horsStock = [...mesure].filter(([rel]) => !stock.has(rel)).map(([rel, n]) => `${rel} : ${n} site(s) HORS registre`);
  return [...ecarts, ...horsStock];
}

/**
 * Le `kind` porte l'INVARIANT de l'entrée, et chaque état a une CHARGE DE PREUVE dans le `why` :
 * une entrée `dette` sans ticket qui l'emporte est une dette orpheline — un « -> #ticket » recopié
 * sans y penser. Une entrée `canonique` qui n'annonce pas sa nature en tête se relit comme de la
 * dette au premier balayage. Le vocabulaire accepté est de TROIS valeurs (#1070) : chaque entrée est
 * qualifiée site par site, une entrée qui se déclare « à trier » est rouge (cf. le test dédié).
 */
const KINDS_ADMIS = ['dette', 'canonique', 'mixte'] as const;

function kindDiff(stock: Stock, label: string) {
  const KINDS = new Set<string>(KINDS_ADMIS);
  const ecarts: string[] = [];
  for (const [rel, e] of stock) {
    if (!KINDS.has(e.kind)) { ecarts.push(`${label} ${rel} : kind « ${e.kind} » inconnu (${KINDS_ADMIS.join('|')})`); continue; }
    const citeTicket = /#\d+/.test(e.why);
    const ditCanonique = /canonique/i.test(e.why);
    if (e.kind === 'dette' && !citeTicket) ecarts.push(`${label} ${rel} : kind=dette sans ticket cité — une population qui doit tomber à zéro nomme le lot qui l'emporte`);
    if (e.kind === 'canonique' && !/^canonique/i.test(e.why.trim())) ecarts.push(`${label} ${rel} : kind=canonique dont la justification n'annonce pas sa nature en tête`);
    if (e.kind === 'mixte' && !(citeTicket && ditCanonique)) ecarts.push(`${label} ${rel} : kind=mixte doit citer un ticket ET dire la part canonique`);
  }
  return ecarts;
}

describe('REGISTRE des chemins de jet (#1070) — le tri de population est SOLDÉ', () => {
  it('chaque entrée des deux stocks est QUALIFIÉE : dette | canonique | mixte, et rien d’autre', () => {
    const restants = [...PENDING_JET_FABRICATION_STOCK, ...ENGINE_DELEGATED_ROLL_STOCK]
      .filter(([, e]) => !(KINDS_ADMIS as readonly string[]).includes(e.kind))
      .map(([rel, e]) => `${rel} : kind=${e.kind}`);
    expect(
      restants,
      `Une entrée du registre n'est pas qualifiée — le tri site par site est le geste, pas une étiquette d'attente (KINDS_ADMIS = ${KINDS_ADMIS.join('|')}) :\n${restants.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : une entrée « à trier » réintroduite est REFUSÉE par kindDiff', () => {
    const stock: Stock = new Map([['src/state/x.ts', { n: 1, kind: 'tri', why: 'population non qualifiée -> #1070.' }]]);
    expect(kindDiff(stock, '(X)')).toEqual(['(X) src/state/x.ts : kind « tri » inconnu (dette|canonique|mixte)']);
  });
});

/**
 * LE DOC DÉRIVÉ DÉCRIT CE QUI EST (#1657) — la section « Les N NON routés » raconte un DÉFAUT :
 * des nœuds `test` de la donnée consommés avant tout routeur. À N=0 elle n'a plus de sujet, et un
 * doc qui continue de décrire un mal éteint se relit comme s'il durait. Le générateur la rend donc
 * SOUS CONDITION, et ne laisse qu'une LIGNE DE MESURE — c'est ce commutateur que ce contrat tient,
 * dans les DEUX états : la mesure décide, jamais une main.
 */
describe('REGISTRE des chemins de jet (#1657) — la section « NON routés » suit la MESURE', () => {
  const doc = () => DOC_REGISTRE;
  /** Cardinal MESURÉ des nœuds hors porte, lu sur le doc généré (jamais un littéral recopié). */
  const horsPorte = (): number => {
    const m = /\*\*(\d+) nœuds? authoré[s]? hors porte\*\*|\*\*(\d+) NON ROUTÉS\*\*/.exec(doc());
    expect(m, 'le doc ne dit plus son cardinal de nœuds hors porte').toBeTruthy();
    return Number(m![1] ?? m![2]);
  };

  it('à ZÉRO : aucune section de défaut, mais une ligne de MESURE — et la table par document reste', () => {
    const n = horsPorte();
    const d = doc();
    if (n === 0) {
      expect(d, 'section « NON routés » rendue alors qu’il n’y a plus de nœud hors porte').not.toMatch(/### Les \d+ NON routés/);
      expect(d, 'le cardinal ZÉRO doit rester DIT (une absence de section n’est pas une mesure)')
        .toMatch(/\*\*0 nœud authoré hors porte\*\*/);
    } else {
      expect(d, 'des nœuds sont hors porte : la section qui les NOMME doit être rendue').toMatch(new RegExp(`### Les ${n} NON routés`));
    }
    expect(d, 'la table par document est le cardinal par famille — elle vit dans les deux états').toMatch(/### Par document/);
  });
});

describe('REGISTRE des chemins de jet (#1066) — (F) fabrication d’un pending de jet', () => {
  const mesure = () => {
    const m = new Map<string, number>();
    for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(prodFiles('src').filter(({ rel }) => !SEAM_CORE.has(rel)))) {
      const n = scanPendingJetFabrication(rel, text, sourceFile!).length;
      if (n > 0) m.set(rel, n);
    }
    return m;
  };

  it('le compte par fichier est EXACT et fail-closed (site en plus, entrée périmée, fichier hors registre)', { timeout: 60_000 }, () => {
    const ecarts = stockDiff(PENDING_JET_FABRICATION_STOCK, mesure());
    expect(
      ecarts,
      `Population (F) désynchronisée — un pending de jet fabriqué à la main entre au registre AVEC sa justification (PENDING_JET_FABRICATION_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque entrée du registre porte une justification ÉCRITE', () => {
    const nues = [...PENDING_JET_FABRICATION_STOCK].filter(([, v]) => !v.why?.trim()).map(([rel]) => rel);
    expect(nues, `Entrée de registre sans justification (dette -> #ticket, ou « canonique : <raison mesurée> ») :\n${nues.join('\n')}`).toEqual([]);
  });

  it('chaque entrée porte un `kind` VALIDE dont la charge de preuve est tenue', () => {
    const ecarts = kindDiff(PENDING_JET_FABRICATION_STOCK, '(F)');
    expect(ecarts, `Invariant de stock non tenu — « cette liste décroît » ne vaut que pour la dette :\n${ecarts.join('\n')}`).toEqual([]);
  });

  it('fail-closed : la signature discriminante mord `skillValue` + `target`', () => {
    const src = "set({ pendingX: { actorId: a.id, skillValue: v, difficulty: 'intermediaire', target: v + 0 } });";
    expect(scanPendingJetFabrication('src/state/x.ts', src).length).toBe(1);
  });

  it('fail-closed : elle mord aussi `skillValue` + `roll: null` (pending pas encore roulé)', () => {
    const src = "set({ pendingX: { skillValue: v, difficulty: 'intermediaire', roll: null, sl: 0, success: false } });";
    expect(scanPendingJetFabrication('src/state/x.ts', src).length).toBe(1);
  });

  it('zéro faux positif : `skillValue` SEUL (paramètre de résolveur) n’est pas une fabrication', () => {
    const src = 'function resolve(p) { return { skillValue: p.skillValue, skillLabel: p.label }; }';
    expect(scanPendingJetFabrication('src/state/x.ts', src)).toEqual([]);
  });

  it('zéro faux positif : `target` SEUL (cible d’un effet) n’est pas une fabrication', () => {
    expect(scanPendingJetFabrication('src/state/x.ts', 'const o = { target: foe.id, amount: 3 };')).toEqual([]);
  });
});

describe('REGISTRE des chemins de jet (#1066) — (D) roulage délégué à un export de src/engine', () => {

  const mesure = (table: Readonly<Record<string, readonly string[]>>) => {
    const m = new Map<string, number>();
    for (const { fichier: { rel, text }, sourceFile, checker } of analyserCorpus(prodFiles('src/state', 'src/ui').filter(({ rel }) => !SEAM_CORE.has(rel)))) {
      const n = scanEngineDelegatedRoll(rel, text, table, sourceFile!, checker).length;
      if (n > 0) m.set(rel, n);
    }
    return m;
  };

  it('la table des exports compte un export RÉEXPORTÉ sous le nom qu’il exporte', () => {
    const fichier = { rel: 'src/engine/x.ts', text: "export { resolveClash as melee } from './massBattle';\nexport const autre = () => 0;\n" };
    expect(tableDesExports([fichier], ['resolveClash', 'autre'])).toEqual({ 'src/engine/x.ts': ['melee', 'autre'] });
  });

  it('la liste des rouleurs est DÉRIVÉE, transitivement : `rollMightTest` ET `resolveClash` en sont', () => {
    const r = rollers();
    expect(r.get('rollMightTest')?.file).toBe('src/engine/massBattle.ts');
    expect(r.get('resolveClash')?.file, 'resolveClash ne roule QUE via rollMightTest — sans clôture transitive, le site fondateur du trou reste invisible').toBe('src/engine/massBattle.ts');
    expect(r.has('rollTest'), 'rollTest/d100 sont la population du garde d’exclusivité, pas de celui-ci').toBe(false);
  });

  it('le call-site massBattle est VISIBLE au garde (plus aucun Test résolu hors de tout registre)', () => {
    const sites = scanEngineDelegatedRoll(
      'src/state/massBattleFlow.ts',
      readFileSync(join(ROOT, 'src/state/massBattleFlow.ts'), 'utf8'),
      delegues(),
    );
    expect(sites.map((s: { name: string }) => s.name)).toContain('resolveClash');
    expect(ENGINE_DELEGATED_ROLL_STOCK.has('src/state/massBattleFlow.ts')).toBe(true);
  });

  it('le compte par fichier est EXACT et fail-closed (site en plus, entrée périmée, fichier hors registre)', () => {
    const ecarts = stockDiff(ENGINE_DELEGATED_ROLL_STOCK, mesure(delegues()));
    expect(
      ecarts,
      `Population (D) désynchronisée — un call-site de rouleur moteur entre au registre AVEC sa justification (ENGINE_DELEGATED_ROLL_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque entrée du registre porte une justification ÉCRITE', () => {
    const nues = [...ENGINE_DELEGATED_ROLL_STOCK].filter(([, v]) => !v.why?.trim()).map(([rel]) => rel);
    expect(nues, `Entrée de registre sans justification :\n${nues.join('\n')}`).toEqual([]);
  });

  it('chaque entrée porte un `kind` VALIDE dont la charge de preuve est tenue', () => {
    const ecarts = kindDiff(ENGINE_DELEGATED_ROLL_STOCK, '(D)');
    expect(ecarts, `Invariant de stock non tenu — « cette liste décroît » ne vaut que pour la dette :\n${ecarts.join('\n')}`).toEqual([]);
  });

  it('(S) position de spec : le MÊME appel dans un callback `resolve` de spec n’est pas un site', () => {
    const imp = "import { resolveClash } from '../engine/massBattle';\n";
    const spec = `${imp}export const F = makeRollFlow({ resolve: (p) => resolveClash(p.a, p.b, battleRng()) });`;
    expect(scanEngineDelegatedRoll('src/state/x.ts', spec, MASS_BATTLE)).toEqual([]);
    const libre = `${imp}function go(p) { return resolveClash(p.a, p.b, battleRng()); }`;
    expect(scanEngineDelegatedRoll('src/state/x.ts', libre, MASS_BATTLE).length).toBe(1);
  });
});

/**
 * Les ANGLES MORTS déclarés par `docs/registre-jets.md` sont eux-mêmes MESURÉS ici — un angle mort
 * écrit dans une doc mais jamais éprouvé est une promesse, pas une mesure ; et s'il se refermait un
 * jour (résolution de liaison ajoutée au scanner), la doc le dirait encore à tort. Le 3ᵉ cas est
 * SURVEILLÉ, pas subi : aucun homonyme rouleur aujourd'hui, et le test rougit dès qu'il en naît un.
 */
describe('REGISTRE des chemins de jet (#1066) — les angles morts DÉCLARÉS sont mesurés', () => {
  it('un import RENOMMÉ compte sous son nom exporté (liaison résolue)', () => {
    const renomme = [
      "import { resolveClash as duel } from '../engine/massBattle';",
      'function go(p) { return duel(p.a, p.b, battleRng()); }',
    ].join('\n');
    expect(scanEngineDelegatedRoll('src/state/x.ts', renomme, MASS_BATTLE)).toEqual([{ line: 2, name: 'resolveClash' }]);
  });

  it('un appel par NAMESPACE (`mb.resolveClash(…)`) compte', () => {
    const ns = [
      "import * as mb from '../engine/massBattle';",
      'function go(p) { return mb.resolveClash(p.a, p.b, battleRng()); }',
    ].join('\n');
    expect(scanEngineDelegatedRoll('src/state/x.ts', ns, MASS_BATTLE)).toEqual([{ line: 2, name: 'resolveClash' }]);
  });

  it('SURVEILLANCE : aucun rouleur d’engine n’a d’HOMONYME dans un autre module (l’index est à plat)', () => {
    const files = prodFiles('src/engine');
    const collisions = [...engineHomonyms(files)]
      .filter(([name, h]) => h.rollsDirectly || rollers().has(name))
      .map(([name, h]) => `${name} déclaré dans ${h.files.join(' + ')}`);
    expect(
      collisions,
      `Homonyme de rouleur apparu — \`engineRollerExports\` indexe par nom À PLAT : la dernière déclaration lue écrase les autres, ce qui peut FAIRE SORTIR un vrai rouleur de la liste (et sa clôture transitive avec lui). Désambiguïser (renommer, ou clé fichier#nom) :\n${collisions.join('\n')}`,
    ).toEqual([]);
  });

  it('angle mort : un dé qui n’est ni `rollTest` ni `d100` (ex. `d10`) n’est vu par AUCUN des trois scanners', () => {
    const src = readFileSync(join(ROOT, 'src/state/massBattleFlow.ts'), 'utf8');
    const hazard = /export function massBattleSetHazard[\s\S]*?\n}/.exec(src)?.[0] ?? '';
    expect(hazard, 'massBattleSetHazard a bougé — l’exemple d’angle mort cité par la doc doit rester mesurable').toContain('d10(battleRng())');
    expect(scanRollSeamExclusivity('src/state/massBattleFlow.ts', hazard)).toEqual([]);
    expect(scanPendingJetFabrication('src/state/massBattleFlow.ts', hazard)).toEqual([]);
    expect(scanEngineDelegatedRoll('src/state/massBattleFlow.ts', hazard, delegues())).toEqual([]);
  });
});

describe('REGISTRE des chemins de jet (#1066) — familles CANONIQUES énumérées (seamCallers)', () => {
  it('chaque famille déclarée existe, à son fichier, avec son statut d’export MESURÉ', () => {
    const ecarts: string[] = [];
    for (const c of SEAM_CALLERS) {
      const path = join(ROOT, c.file);
      if (!existsSync(path)) { ecarts.push(`${c.name} : fichier ${c.file} introuvable`); continue; }
      const src = readFileSync(path, 'utf8');
      const decl = new RegExp(`^(export\\s+)?(async\\s+)?(function|const|let|class)\\s+${c.name}\\b`, 'm').exec(src);
      if (!decl) { ecarts.push(`${c.name} : aucune déclaration dans ${c.file}`); continue; }
      const exported = decl[1] !== undefined;
      if (exported !== c.exported) ecarts.push(`${c.name} (${c.file}) : exporté=${exported} mesuré, ${c.exported} déclaré`);
      if (!c.role?.trim()) ecarts.push(`${c.name} : rôle non renseigné`);
    }
    expect(
      ecarts,
      `Énumération des familles canoniques périmée — le registre est la SOURCE de docs/registre-jets.md (SEAM_CALLERS, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('la 3ᵉ famille navale `openCrewTestPending` est bien MODULE-LOCALE (le fait qui l’a tenue hors registre)', () => {
    const src = readFileSync(join(ROOT, 'src/state/combatSlice.ts'), 'utf8');
    expect(/^export\s+function\s+openCrewTestPending\b/m.test(src)).toBe(false);
    expect(/^function\s+openCrewTestPending\b/m.test(src)).toBe(true);
  });
});

/**
 * CLIQUET « le calcul de ligne ne se réécrit plus à la main » (#1153 L2bis) — l'arithmétique de cible
 * (`DIFFICULTY_MODIFIERS[…]` ET `DIFFICULTY_MODIFIERS.…`, écrêtage `Math.min(99, …)`) n'a de place que
 * dans `src/engine/**` (les formules), dans le MONTEUR canonique (`rollSeam.rollLine`) et chez ses
 * LECTEURS d'affichage (`ui/breakdown.ts`, `ui/RollLine.tsx`, harnais de test) — partout ailleurs,
 * elle signe un monteur local qui refait la ligne et peut donc mentir (base fondue, chip fantôme,
 * cible NaN). Les DEUX notations sont mordues : indexer par crochets ou par point est le même geste,
 * et n'en voir qu'une laissait 6 sites hors du compte (#1153 L1a).
 *
 * Ce stock est un CLIQUET : il ne peut que DÉCROÎTRE. Toute entrée est un site à router par
 * `rollLine` ; le COMBAT y entre lot par lot (#1153 L1b).
 *
 * RÉFÉRENTIEL DE MESURE : `HEAD` + le lot COURANT, jamais l'arbre de travail. Une baseline abaissée
 * sur le WIP NON COMMITTÉ d'une autre session créditerait un travail qui peut ne jamais atterrir —
 * et le cliquet remonterait en silence si ce WIP était abandonné.
 */
const LIGNE_A_LA_MAIN_STOCK: Record<string, number> = {
  // COMBAT — reste de #1467 (`encounterPsychFlow` = la rangée batch du Test de Peur hors rencontre).
  // `combat/triggeredTest.ts` (L3) et `combatEffects.ts` (L2' : `openSkillTest`, Test ÉTENDU,
  // exposition hydrique) sont SOLDÉS — leurs étapes montent toutes leur ligne par `rollStep`.
  'src/state/encounterPsychFlow.ts': 1,
  'src/state/rollFlowSpecs.ts': 2, // cible du dé d'une MANŒUVRE d'attaque + cible de repli d'un Test opposé — COMBAT
  // HORS COMBAT — les sites de jet sont routés par `rollLine`/`rollStep` ; ce qui reste n'est pas une cible.
  'src/state/seaVoyageFlow.ts': 1, // reste : conversion Difficulté→DR d'une infestation (pas une cible)
  'src/state/cascadeTestKit.ts': 1, // le cliquet lui-même (`inexplique`)
};

/** Dette TOTALE MESURÉE sur `HEAD` + ce lot : 5 occurrences / 4 fichiers, dont 3 en combat — verrou
 *  global : un site déplacé d'un fichier à l'autre ne s'y cache pas. `ui/editor/LogicDock.tsx` n'y
 *  figure pas : son aperçu de difficulté mesure 0 site, la borne du champ vit dans `NumberField`. */
const TOTAL_DECLARE = Object.values(LIGNE_A_LA_MAIN_STOCK).reduce((s, n) => s + n, 0);

describe('CLIQUET — l’arithmétique de ligne vit dans le monteur, pas dans les flux (#1153)', () => {
  const LIGNE_RX = /DIFFICULTY_MODIFIERS\s*[.[]|Math\.min\(99/g;
  const HORS_CLIQUET = ['src/engine/', 'src/state/rollSeam.ts', 'src/ui/breakdown.ts', 'src/ui/RollLine.tsx'];

  it('aucun NOUVEAU site ne recalcule une cible à la main (le stock ne peut que décroître)', () => {
    const mesure: Record<string, number> = {};
    for (const { rel, text } of prodFiles('src')) {
      if (HORS_CLIQUET.some((p) => rel.startsWith(p))) continue;
      const n = (text.match(LIGNE_RX) ?? []).length;
      if (n > 0) mesure[rel] = n;
    }
    const ecarts: string[] = [];
    for (const [file, n] of Object.entries(mesure)) {
      const attendu = LIGNE_A_LA_MAIN_STOCK[file];
      if (attendu === undefined) ecarts.push(`${file} : ${n} occurrence(s) NOUVELLE(S) — monter la ligne par \`rollLine\` (rollSeam.ts)`);
      else if (n > attendu) ecarts.push(`${file} : ${n} > ${attendu} déclaré(s) — le cliquet ne remonte pas`);
    }
    expect(ecarts, `Arithmétique de ligne réécrite à la main :\n${ecarts.join('\n')}`).toEqual([]);
    // Le TOTAL est verrouillé aussi : un site déplacé d'un fichier à l'autre ne passerait pas entre
    // les mailles du compte par fichier.
    expect(Object.values(mesure).reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(TOTAL_DECLARE);
  });

  it('le stock DÉCLARÉ suit la dette RÉELLE, à l’unité près (entrée périmée ET baseline trop haute)', () => {
    // Le cliquet ne mord pas qu'à ZÉRO : une baseline de 5 sur un fichier retombé à 3 est PÉRIMÉE elle
    // aussi — sans quoi le stock mentirait de 2 sites déjà migrés, et 2 régressions pourraient s'y
    // glisser sans rien casser (patron `cascade-step-stake-guard`).
    const perimees: string[] = [];
    for (const [file, attendu] of Object.entries(LIGNE_A_LA_MAIN_STOCK)) {
      const abs = join(ROOT, file);
      if (!existsSync(abs)) { perimees.push(`${file} : fichier absent — retirer du stock`); continue; }
      const n = (readFileSync(abs, 'utf8').match(LIGNE_RX) ?? []).length;
      if (n < attendu) perimees.push(`${file} : baseline ${attendu}, réel ${n} — ABAISSER`);
    }
    expect(perimees, `Stock périmé (dette déjà résorbée, à refléter) :\n${perimees.join('\n')}`).toEqual([]);
  });
});

/**
 * SECOND CLIQUET — l'ANGLE MORT du premier (#1153, déclaré au commit 57860131). Une étape-jet peut
 * être montée à la main SANS jamais écrire d'arithmétique : `base: best.value` + `target = base`, la
 * Difficulté et le Soutien fondus dans un helper de cible (`exposureTarget`) ou dans `partyAssisted`.
 * `LIGNE_RX` ne voit rien, et `inexplique` non plus (0 − 0 = 0) : la ligne ment en silence.
 *
 * Ce qu'on mesure ici est STRUCTUREL, pas lexical : un littéral d'objet qui pose `kind:` ET `target:`
 * (donc une étape que `cascade.stepInteraction` classera « jet ») sans que sa ligne vienne du monteur
 * (`...rollStep(` / `...rollLine(`).
 *
 * PÉRIMÈTRE — HORS COMBAT, mais par un geste DIFFÉRENT du premier cliquet : celui-là BASELINE les
 * fichiers de combat dans son stock, celui-ci les EXCLUT du scan (`HORS_PERIMETRE_COMBAT`), et sur un
 * SUR-ENSEMBLE (il ajoute `src/state/combat/`, `combatManeuvers`, `targetingModes`, `rollFlowFactory`,
 * `rollFlowSpecs`). Raison : l'arène a son arithmétique propre (`baseTestMods`, Avantage, allonge) et
 * son lot dédié — un stock chiffré sur un chantier en cours mesurerait le voisin, pas la dette.
 *
 * COUVERTURE DÉCLARÉE (ce que le scanner compte, dette ou pas — le stock est un COMPTE, pas un
 * verdict) : il attrape aussi (a) les DÉCLARATIONS de type qui portent `kind` + `target`
 * (`DeferredUpkeepTest`, `PendingExtendedTest`, `RestRoll`…) et (b) les RELAIS d'une ligne déjà
 * montée ailleurs (`deferredUpkeepSteps` recopie `t.base`/`t.target` du wrapper d'entretien, par le
 * régime `MonoSpec.montee`). Ces deux familles sont annotées entrée par entrée ci-dessous. Angle
 * mort : une étape dont le littéral est éclaté sur plusieurs variables
 * (`const st = {...}; st.target = …`) échappe au scanner.
 */
const HORS_PERIMETRE_COMBAT = [
  'src/state/combat/', 'src/state/combatFlow.ts', 'src/state/combatSlice.ts', 'src/state/combatEffects.ts',
  'src/state/combatManeuvers.ts', 'src/state/encounterPsychFlow.ts', 'src/state/shipManeuver.ts',
  'src/state/targetingModes.ts', 'src/state/rollFlowSpecs.ts', 'src/state/rollFlowFactory.ts',
];
const ETAPE_A_LA_MAIN_STOCK: Record<string, number> = {
  // TYPES (aucun montage) — `kind` + `target` en position de DÉCLARATION
  'src/data/schemas/defs/spells.ts': 1,
  'src/data/schemas/defs-scenes/effets.ts': 2, // schémas `inflictPsychology` et `exposureNight`
  'src/state/pendings.ts': 1, // PendingExtendedTest
  'src/state/upkeep.ts': 1, // DeferredUpkeepTest
  'src/state/interludeFlow.ts': 2, // PendingActivityFields (type) + `target: 0` sentinelle d'ouverture
  'src/state/store.ts': 1, // signature de `startExtendedTest`
  // RELAIS d'une ligne DÉJÀ montée par le monteur (rien à recalculer ici) — EXEMPTION AU SITE
  'src/state/restFlow.ts': 1, // `deferredUpkeepSteps` : `montee` recopie base/target/mods/clamped de la
  // ligne que `rollStep` a montée AU MOMENT DÛ (upkeep.ts:178). Le scanner est TEXTUEL : il ne voit pas
  // cette provenance, il compte le littéral — la raison la dit.
  // MONTAGES à la main — dette RÉELLE restante hors combat, à router par `rollStep`
  'src/engine/rest.ts': 3, // bilan EAGER de la modale de Repos (`RestRoll` : type + 2 collectes)
};
const TOTAL_ETAPES = Object.values(ETAPE_A_LA_MAIN_STOCK).reduce((s, n) => s + n, 0);

/** Littéraux d'objet (un niveau d'imbrication) — assez pour isoler une étape de cascade.
 *
 *  PROFONDEUR MESURÉE, pas choisie : passer à DEUX niveaux apparie des CORPS DE FONCTION entiers et
 *  compte un `kind:` et un `target:` appartenant à deux objets DIFFÉRENTS (mesuré : `data/index.ts`
 *  (interface), `scenes/test-scenarios/18-effets-scriptes.ts` (deux effets d'un même tableau),
 *  `state/jumpMove.ts` et `state/corruptionFlow.ts` (corps de fonction) faussement comptés, et
 *  `engine/rest.ts` retombant de 3 à 2 parce qu'un englobant avale deux vrais sites). Le compte
 *  deviendrait faux dans les DEUX sens. */
const LITTERAL_RX = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gs;

/** La PORTE DE FORGE de la ligne (#1262 V2) : `MonoSpec.montee` accepte une ligne DÉJÀ étalée. Quand
 *  elle sort du monteur (`montee: rollStep(…)`) il n'y a rien à compter ; quand c'est un LITTÉRAL
 *  (`montee: { base: …, target: … }`), la ligne est montée à la main — même dette que le littéral
 *  d'étape, et le sous-objet est mesuré ICI plutôt qu'en élargissant l'appariement global (ce nid
 *  `...(cond ? { mods } : {})` est justement ce qui échappe à `LITTERAL_RX`). */
const MONTEE_FORGEE_RX = /montee:\s*\{/g;

function etapesALaMain(src: string, rel = 'src/state/probe.ts'): number {
  src = canon.sansDeclarationsDeMetadonnees({ rel, text: src });
  let n = (src.match(MONTEE_FORGEE_RX) ?? []).length;
  for (const m of src.matchAll(LITTERAL_RX)) {
    const lit = m[0];
    if (!/(^|[\s,{])kind:\s/.test(lit)) continue;
    if (!/(^|[\s,{])target:\s/.test(lit)) continue;
    if (/\.\.\.roll(Step|Line)\(/.test(lit)) continue;
    n++;
  }
  return n;
}

describe('CLIQUET 2 — une étape-JET ne se monte plus à la main, même sans arithmétique (#1153)', () => {

  it('les métadonnées canoniques ne sont pas des étapes, leurs expressions exécutées restent mesurées', () => {
    const importeur = `import { nommerChamps as nommer } from '../data/schemas/grammaire/meta';`;
    expect(etapesALaMain(`${importeur} nommer(schema, { kind: { label: 'Type' }, target: { label: 'Cible' }, montee: { label: 'Montée' } });`)).toBe(0);
    expect(etapesALaMain(`${importeur} nommer({ kind: 'test', target: 1 }, {});`)).toBe(1);
    expect(etapesALaMain(`${importeur} nommer(schema, { exemple: donne({ kind: 'test', target: 1 }) });`)).toBe(1);
    expect(etapesALaMain(`${importeur} function f(nommer) { nommer(schema, { kind: 'test', target: 1 }); }`)).toBe(1);
    expect(etapesALaMain(`import { nommerChamps as nommer } from './etranger'; nommer(schema, { kind: 'test', target: 1 });`)).toBe(1);
    expect(etapesALaMain(`import * as noms from '../data/schemas/grammaire/meta'; noms.nommerNoeud(schema, { kind: { label: 'Type' }, target: { label: 'Cible' } });`)).toBe(0);
    const physique = `{ target: z.number(), opposed: z.strictObject({ kind: z.literal('resist') }) }`;
    const nomme = `${importeur} const s = { target: z.number(), opposed: nommer(z.strictObject({ kind: z.literal('resist') }), { kind: { label: 'Type' } }) };`;
    expect(etapesALaMain(physique)).toBe(1);
    expect(etapesALaMain(nomme)).toBe(etapesALaMain(physique));
  });

  it('le scanner VOIT bien la famille qu’il prétend mesurer (les 5 sites de restFlow d’avant migration)', () => {
    // Preuve de couverture sur PIÈCE : le montage à base FONDUE tel qu'il s'écrivait (abri de fortune,
    // Soutien de `partyAssisted` fondu, cible = base) — invisible au premier cliquet ET à `inexplique`.
    const avant = `
      steps.push({ id: 'abri', kind: 'shelter', actorId: best.actor.id, label: 'Abri de fortune',
        rollLabel: 'Survie en extérieur', base: best.value, difficulty: 'intermediaire', target: best.value,
        result: null, interactive: true });`;
    expect(etapesALaMain(avant), 'le scanner doit voir le montage à la main').toBe(1);
    const apres = `
      steps.push({ id: 'abri', kind: 'shelter', actorId: best.actor.id, label: 'Abri de fortune',
        rollLabel: 'Survie en extérieur',
        ...rollStep({ actor: best.actor, test: { skill: 'survie-en-exterieur' }, difficulty: 'intermediaire',
          valeur: best.value, soutien: best.support }),
        result: null, interactive: true });`;
    expect(etapesALaMain(apres), 'routé par le monteur : plus rien à voir').toBe(0);
  });

  /**
   * LE RÉGIME `montee` EST UNE PORTE DE FORGE — et elle reste SOUS CLIQUET (#1262 V2). Un mint
   * (`monoStep`) ne garantit que la POSSESSION et la SURFACE ; la ligne, elle, peut y entrer déjà
   * montée (`MonoSpec.montee`, `LigneMontee` = type structurel nu). Rien n'empêche donc d'y forger de
   * l'arithmétique à la main — c'est ce que le scanner doit continuer de compter.
   *
   * Le cas MORDANT est le NID (`...(cond ? { mods } : {})` DANS `montee`) : le littéral d'étape qui le
   * porte échappe à `LITTERAL_RX` (un seul niveau d'imbrication), et sans la passe dédiée
   * (`MONTEE_FORGEE_RX`) la baseline décroîtrait pour la mauvaise raison — un site TOUJOURS là,
   * simplement devenu invisible.
   */
  it('le scanner VOIT une ligne FORGÉE dans `montee`, nid compris — et laisse passer la sortie du monteur', () => {
    const forgeeAvecNid = `
      const st = monoStep({ id: 'faim', kind: 'faim', actor: h, label: 'Faim', difficulty: 'intermediaire',
        montee: { base: v, ...(mods.length ? { mods } : {}), target: v - 10 } });`;
    expect(etapesALaMain(forgeeAvecNid), 'une ligne montée à la main dans `montee` reste de la dette').toBe(1);

    const parLeMonteur = `
      const st = monoStep({ id: 'faim', kind: 'faim', actor: h, label: 'Faim', difficulty: 'intermediaire',
        montee: rollStep({ actor: h, test: { skill: 'resistance' }, difficulty: 'intermediaire' }), target: 0 });`;
    expect(etapesALaMain(parLeMonteur), 'la SORTIE du monteur canonique n’est pas un montage à la main').toBe(0);
  });

  it('aucune NOUVELLE étape montée à la main (le stock ne peut que décroître)', () => {
    const mesure: Record<string, number> = {};
    for (const { rel, text } of prodFiles('src')) {
      if (rel === 'src/state/rollSeam.ts') continue; // le monteur lui-même
      if (HORS_PERIMETRE_COMBAT.some((p) => rel.startsWith(p))) continue; // frontière déclarée, lot dédié
      const n = etapesALaMain(text, rel);
      if (n > 0) mesure[rel] = n;
    }
    const ecarts: string[] = [];
    for (const [file, n] of Object.entries(mesure)) {
      const attendu = ETAPE_A_LA_MAIN_STOCK[file];
      if (attendu === undefined) ecarts.push(`${file} : ${n} étape(s) NOUVELLE(S) montée(s) à la main — passer par \`rollStep\` (rollSeam.ts)`);
      else if (n > attendu) ecarts.push(`${file} : ${n} > ${attendu} déclaré(s) — le cliquet ne remonte pas`);
    }
    expect(ecarts, `Étape-jet montée à la main :\n${ecarts.join('\n')}`).toEqual([]);
    expect(Object.values(mesure).reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(TOTAL_ETAPES);
  });

  it('le stock DÉCLARÉ suit la dette RÉELLE (baseline trop haute = mensonge de 1 site migré)', () => {
    const perimees: string[] = [];
    for (const [file, attendu] of Object.entries(ETAPE_A_LA_MAIN_STOCK)) {
      const abs = join(ROOT, file);
      if (!existsSync(abs)) { perimees.push(`${file} : fichier absent — retirer du stock`); continue; }
      const n = etapesALaMain(readFileSync(abs, 'utf8'), file);
      if (n < attendu) perimees.push(`${file} : baseline ${attendu}, réel ${n} — ABAISSER`);
    }
    expect(perimees, `Stock périmé (dette déjà résorbée, à refléter) :\n${perimees.join('\n')}`).toEqual([]);
  });
});

/**
 * GARDE SŒUR (#1508) — TOUT DÉ TIRÉ HORS PORTE. Le garde d'exclusivité (#274) ne connaît que le
 * FORGEAGE d'un Test ; une magnitude (`rollDice`), une dispersion (`d10`), une expression authorée
 * (`rollExpr`), un d100 d'environnement (`deMonde`) et une désignation (`rng.int`) lui sont
 * INVISIBLES par construction — c'est ce trou que la sonde de morsure a mesuré (0 site vu sur cinq
 * cas synthétiques, un seul reconnu).
 *
 * La doctrine utilisateur du 2026-09-04 ne laisse aucune classe de dé dehors — « Vu que tous les jets
 * passé par le même point d'entrée, il est inutile de se demander si le jeu est configuré pour » : ce
 * qui se mesure ici est donc une DETTE À CIBLE ZÉRO (`DES_HORS_PORTE_STOCK`), pas un registre.
 */
describe('garde SŒUR « dés hors porte » (#1508) — un dé qui tombe hors de la porte est compté nominativement', () => {
  /** Rouleurs DIRECTS de `src/engine` (un hop) — mémoïsés, comme `rollers()`. */
  const desRollers = detenteur(() => engineDiceRollers(prodFiles('src/engine')));

  /** Mesure du corpus de PRODUCTION hors moteur et hors noyau du seam. */
  function mesureDesHorsPorte(): Map<string, number> {
    const m = new Map<string, number>();
    for (const { fichier: { rel, text }, sourceFile, checker } of analyserCorpus(prodFiles('src').filter(({ rel }) => !rel.startsWith('src/engine/') && !SEAM_CORE.has(rel)))) {
      const n = scanDesHorsPorte(rel, text, desRollers(), sourceFile!, checker).length;
      if (n > 0) m.set(rel, n);
    }
    return m;
  }

  // #1508
  it('MORSURE : les cinq primitives de dé sont vues par la sœur, là où l’exclusivité n’en voit qu’une', () => {
    const cas: [string, string][] = [
      ['d100', "import { d100 } from '../engine/dice';\nexport function f(rng) { return d100(rng); }\n"],
      ['d10', "import { d10 } from '../engine/dice';\nexport function f(rng) { return d10(rng); }\n"],
      ['rollDice', "import { rollDice } from '../engine/dice';\nexport function f(rng) { return rollDice({ n: 2, sides: 10 }, rng); }\n"],
      ['rollExpr', "import { rollExpr } from '../engine/dice';\nexport function f(rng) { return rollExpr('2d10+3', rng); }\n"],
      ['deMonde', "import { deMonde } from '../engine/dice';\nexport function f(rng) { return deMonde(rng); }\n"],
    ];
    const vus = cas.map(([nom, src]) => [nom, scanDesHorsPorte('src/state/faux.ts', src, desRollers()).length] as const);
    expect(vus, 'chaque primitive de dé compte pour UN site').toEqual([['d100', 1], ['d10', 1], ['rollDice', 1], ['rollExpr', 1], ['deMonde', 1]]);
    // Le garde d'exclusivité, lui, est aveugle à quatre des cinq (et blanchit même le `d100` nu, qui
    // n'est ni consommé en seuil ni en table ici : il le compte comme forgeage de Test).
    const exclusivite = cas.map(([nom, src]) => [nom, scanRollSeamExclusivity('src/state/faux.ts', src).length] as const);
    expect(exclusivite).toEqual([['d100', 1], ['d10', 0], ['rollDice', 0], ['rollExpr', 0], ['deMonde', 0]]);
  });

  it('AMORCE COMPLÈTE : tout export de `src/engine/dice.ts` qui tire un dé est une primitive de `AMORCE_DES`', () => {
    const dice = prodFiles('src/engine').filter((f) => f.rel === 'src/engine/dice.ts');
    expect(dice).toHaveLength(1);
    const horsAmorce = (engineDiceRollers(dice)['src/engine/dice.ts'] ?? []).filter((n) => !AMORCE_DES.includes(n));
    expect(horsAmorce, 'primitive de dé absente de `AMORCE_DES` (scripts/guards/lib/rollSeamExclusivity.mjs)').toEqual([]);
  });

  it('MORSURE : un `d10` NEUF dans un applier de `src/state` est vu (fail-closed)', () => {
    const regresse = "import { d10 } from '../engine/dice';\nexport function applyChute(c, rng) { c.wounds -= d10(rng); }\n";
    expect(scanDesHorsPorte('src/state/x.ts', regresse, desRollers()).map((s) => s.name)).toEqual(['d10']);
  });

  it('MORSURE : un dé SYNTHÉTIQUE ajouté dans `src/engine` sur un chemin d’op est vu par la CLÔTURE', () => {
    const moteur = [{ rel: 'src/engine/combat.ts', text: "import { d10 } from './dice';\nexport function applyGrosDegats(c, rng) { return d10(rng); }\n" }];
    const table = engineDiceRollers(moteur);
    expect(table['src/engine/combat.ts'], 'un export qui tire dans son corps entre dans la clôture').toContain('applyGrosDegats');
    const appelant = "import { applyGrosDegats } from '../engine/combat';\nexport function f(c, rng) { applyGrosDegats(c, rng); }\n";
    expect(scanDesHorsPorte('src/state/x.ts', appelant, table).map((s) => s.name)).toEqual(['applyGrosDegats']);
  });

  /**
   * MORSURE DU HELPER PRIVÉ — le dé ne tombe pas dans le corps de l'export, mais dans un helper
   * MODULE-LOCAL qu'il appelle : c'est la forme RÉELLE de `merchantFlow.rollStock` → `fullStock` →
   * `rollDice` et de `rollAge`/`rollEyes`/`rollHair`/`rollHeight` → `rollDetailFormula` → `roll`.
   * Un critère à UN SAUT les rendait invisibles (10 sites réels, dont `merchantFlow.ts` en entier —
   * que `ENGINE_DELEGATED_ROLL_STOCK` classait pourtant déjà en dette : deux stocks du même dé ne
   * peuvent pas se contredire). La frontière est l'EXPORT, pas le nombre de sauts.
   */
  it('MORSURE : un dé derrière un helper PRIVÉ du moteur entre dans la clôture — et un export intermédiaire l’ARRÊTE', () => {
    const moteur = [{
      rel: 'src/engine/combat.ts',
      text: [
        "import { roll } from './dice';",
        'function tirageInterne(rng) { return roll(2, 10, rng); }', // helper MODULE-LOCAL
        'export function magnitudeCachee(rng) { return tirageInterne(rng); }',
        'export function viaExport(rng) { return magnitudeCachee(rng); }', // franchit une frontière EXPORTÉE
      ].join('\n'),
    }];
    const rouleurs = engineDiceRollers(moteur);
    const exports = rouleurs['src/engine/combat.ts'];
    expect(exports, 'le dé tombe derrière un helper privé : l’export compte').toContain('magnitudeCachee');
    expect(exports, 'son appelant franchit une frontière EXPORTÉE : il ne contamine plus').not.toContain('viaExport');
    expect(exports, 'un helper non exporté n’est pas un site d’appel visible').not.toContain('tirageInterne');
    const appelant = "import { magnitudeCachee } from '../engine/combat';\nexport function f(rng) { return magnitudeCachee(rng); }\n";
    expect(scanDesHorsPorte('src/state/x.ts', appelant, rouleurs).map((s) => s.name)).toEqual(['magnitudeCachee']);
  });

  it('ALIAS résolu : `import { roll as rollDice }` compte sous son nom D’ORIGINE, et un alias inconnu ne se perd plus', () => {
    const alias = "import { roll as rollDice } from '../engine/dice';\nexport function f(rng) { return rollDice(2, 10, rng); }\n";
    expect(scanDesHorsPorte('src/state/x.ts', alias, desRollers()).map((s) => s.name)).toEqual(['roll']);
    const aliasDe = "import { d100 as des } from '../engine/dice';\nexport function f(rng) { return des(rng); }\n";
    expect(scanDesHorsPorte('src/state/x.ts', aliasDe, desRollers()).map((s) => s.name), 'un `d100 as des` ne s’échappe plus').toEqual(['d100']);
  });

  it('un `rng.int(` (désignation « lequel ? ») est un dé comme un autre', () => {
    expect(scanDesHorsPorte('src/state/x.ts', 'export function f(rng, l) { return l[rng.int(0, l.length - 1)]; }', desRollers()).map((s) => s.name)).toEqual(['rng.int']);
  });

  /**
   * CRITÈRE DU `.int(` — un dé porte SA PLAGE (`RNG.int(min, max)`, `src/engine/dice.ts:7`), un
   * `.int()` de schéma zod ne porte rien et ne tire rien. Les deux formes réelles du dépôt sont
   * reprises à l'octet : `src/state/combatSetup.ts:31` (`rng.int(1, 10)` d'Initiative) et
   * `src/state/etalLot.ts:60` (`base.int(min, max)` de peuplement d'étal) restent VUS ; la forme zod de
   * `src/data/schemas/grammaire/valeurs.ts:85` ne compte pas.
   */
  it('CRITÈRE : un `.int()` de schéma zod n’est pas un dé, un `.int(min, max)` de RNG en est un', () => {
    const zod = "import { z } from 'zod';\nexport const s = z.strictObject({ n: z.number().int().min(1), m: z.number().int().positive() });\n";
    expect(scanDesHorsPorte('src/data/schemas/faux.ts', zod, desRollers()), 'un validateur d’entier ne tire aucun dé').toEqual([]);
    const initiative = 'export function ordre(c, rng) { return rng.int(1, 10) + bonus(c); }\n';
    expect(scanDesHorsPorte('src/state/x.ts', initiative, desRollers()).map((s) => s.name), 'forme de combatSetup.ts:31').toEqual(['rng.int']);
    const etal = 'export function lot(base, min, max) { return base.int(min, max); }\n';
    expect(scanDesHorsPorte('src/state/x.ts', etal, desRollers()).map((s) => s.name), 'forme d’etalLot.ts:60').toEqual(['rng.int']);
    const battle = 'export function victime(crowd) { return crowd[battleRng().int(0, crowd.length - 1)]; }\n';
    expect(scanDesHorsPorte('src/state/x.ts', battle, desRollers()).map((s) => s.name), 'forme de combatFlow.ts:800').toEqual(['rng.int']);
  });

  it('zéro faux positif : un `roll` LOCAL (déclencheur de flux, non importé du moteur) n’est pas un dé', () => {
    const ui = "export function Modale({ roll }) { return <button onClick={() => roll()}>Lancer</button>; }";
    expect(scanDesHorsPorte('src/ui/x.tsx', ui, desRollers())).toEqual([]);
  });

  it('(S) position de spec : un dé dans le callback `resolve` d’une spec de flux reste exclu', () => {
    const spec = "import { d10 } from '../engine/dice';\nexport const F = makeRollFlow({ resolve: (p) => d10(battleRng()) });";
    expect(scanDesHorsPorte('src/state/x.ts', spec, desRollers())).toEqual([]);
  });

  it('le stock « dés hors porte » déclare le compte MESURÉ, à l’unité, dans les DEUX sens', { timeout: 60_000 }, () => {
    const mesure = mesureDesHorsPorte();
    const ecarts: string[] = [];
    for (const [rel, { n }] of DES_HORS_PORTE_STOCK) {
      const vu = mesure.get(rel) ?? 0;
      if (vu !== n) ecarts.push(`${rel} : ${vu} site(s) mesuré(s), ${n} déclaré(s)${vu === 0 ? ' — entrée PÉRIMÉE, à retirer' : ''}`);
    }
    for (const [rel, n] of mesure) {
      if (!DES_HORS_PORTE_STOCK.has(rel)) ecarts.push(`${rel} : ${n} dé(s) HORS compteur — router par la porte (rollSeam : dieStep / tableStep / worldStep / openRoll), ou entrer ICI avec sa famille et son train`);
    }
    expect(
      ecarts,
      `Les dés tirés hors porte ont bougé — dette à cible zéro (#1508), jamais un registre d'équilibre (DES_HORS_PORTE_STOCK, scripts/guards/lib/rollSeamWhitelist.mjs) :\n${ecarts.join('\n')}`,
    ).toEqual([]);
  });

  it('chaque entrée du stock est QUALIFIÉE et cite son lot (aucune ne justifie une règle)', () => {
    expect(kindDiff(DES_HORS_PORTE_STOCK as Stock, '(dés hors porte)')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// #1508 — LE SIGNAL « DIFFÉRÉ » NE TOMBE JAMAIS PAR TERRE
// ---------------------------------------------------------------------------------------------

/** Les fonctions qui appliquent des Effets/des ops et rendent `Applique` (`state/combatEffects` ; et
 *  les deux points d'application de COMBAT dont la grappe de dés part à la porte — `state/combatFlow`
 *  `applyOups`/`applyBladeTrap`, #1508 T3b-4). */
const POINTS_DAPPLICATION = ['applyEffects', 'applyEffectsLoot', 'applyLeafOps', 'runFlow', 'applyOups', 'applyBladeTrap'];
/** Les CONSOMMATEURS nommés — recevoir le retour en argument de l'un d'eux EST le consommer. */
const CONSOMMATEURS = ['jouerFlowEntier', 'nePeutPasDifferer', 'cloturer'];

/** La FORME d'un appel dont le retour se perd, ou `null` s'il est consommé. Purement syntaxique : les
 *  formes que le scan ne SAIT PAS trancher sont déclarées en angles morts mesurés, plus bas. */
function formePerdue(n: ts.CallExpression, sf: ts.SourceFile): string | null {
  const p = n.parent;
  // A — instruction nue : `runFlow(…);`
  if (ts.isExpressionStatement(p)) return 'retour JETÉ (instruction nue)';
  // D — séquence à virgule : `x = (runFlow(…), 1);` — l'opérande gauche est évalué puis abandonné.
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.CommaToken && p.left === n) return 'retour jeté par une VIRGULE';
  // G — flèche à CORPS EXPRESSION : la valeur part dans le retour de la flèche, que son appelant ne lit
  //     pas forcément (`() => void` d'un verbe de store, callback de `forEach`). Le corps de BLOC, lui,
  //     rend le choix EXPLICITE — c'est celui qu'on exige.
  if (ts.isArrowFunction(p) && p.body === n) return 'retour jeté dans une FLÈCHE à corps expression (corps de bloc + retour consommé)';
  // C — argument d'un appel qui n'est pas un consommateur nommé.
  if (ts.isCallExpression(p) && p.arguments.includes(n)) {
    const nom = ts.isIdentifier(p.expression) ? p.expression.text : '(appel non nommé)';
    return CONSOMMATEURS.includes(nom) ? null : `retour passé en ARGUMENT de « ${nom} »`;
  }
  // B — capturé dans une variable JAMAIS RELUE : la capture ne consomme rien, seule la lecture le fait.
  if (ts.isVariableDeclaration(p) && p.initializer === n && ('name' in p && ts.isIdentifier(p.name))) {
    const nom = p.name.text;
    let lectures = 0;
    const compte = (x: ts.Node): void => { if (ts.isIdentifier(x) && x.text === nom && x !== p.name) lectures++; x.forEachChild(compte); };
    compte(sf);
    if (lectures === 0) return `retour capturé dans « ${nom} », JAMAIS relu`;
  }
  return null;
}

/** Tous les appels PERDUS du corpus de PRODUCTION, par forme. Un test peut ignorer le retour — il
 *  mesure une couture, il ne joue pas la suite d'une partie : le corpus est donc `prod` seul. */
function appelsPerdus(): string[] {
  const out: string[] = [];
  for (const { fichier: { rel }, sourceFile: sf } of analyserCorpus(corpus().filter(({ rel, text }) => !estFichierVitest(rel) && POINTS_DAPPLICATION.some((n) => text.includes(`${n}(`))))) {
    if (!sf) continue;
    const walk = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && POINTS_DAPPLICATION.includes(n.expression.text)) {
        const forme = formePerdue(n, sf);
        if (forme) out.push(`${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} ${n.expression.text}(…) — ${forme}`);
      }
      n.forEachChild(walk);
    };
    walk(sf);
  }
  return out;
}

/**
 * FORME, pas liste de noms (même doctrine que le reste de ce fichier). Une application d'Effets peut
 * DIFFÉRER (ses dés partent à la porte, #1508) : elle rend alors `OPS_DIFFEREES` et rien n'est encore
 * joué. Un appelant qui poursuit sans lire ce retour applique sa suite PAR-DESSUS un dé en vol — c'est
 * l'inversion d'ordre authoré que le canal existe pour empêcher.
 *
 * Le TYPE ne peut pas l'imposer, et c'est MESURÉ (2026-09-05, sonde à deux fichiers hors dépôt) :
 * `tsc --noEmit --strict` accepte une valeur rendue jetée en position d'instruction (sortie 0), et
 * `no-unused-expressions` (`oxlint.config.mjs`) aussi (sortie 0 — la règle laisse passer tout appel de
 * fonction, par construction). TypeScript n'a pas de `must_use` : CE scan tient donc l'invariant.
 *
 * TROIS issues admises, et AUCUNE liste de sites : l'appelant lit le retour lui-même (il confie sa
 * suite, `differerLaSuite`), ou il le passe à un CONSOMMATEUR nommé — `cloturer` (ce qui suit est une
 * `Cloture`, différée avec la continuation), `jouerFlowEntier` (rien ne suit), `nePeutPasDifferer`
 * (la donnée appliquée n'a pas de canal de dés — fail-fast si ça change). Écrire le nom EST la
 * déclaration ; personne n'a besoin d'être cité ici.
 */
describe('#1508 — tout point d’application consomme son retour, ou le passe à un consommateur nommé', () => {
  it('le scan MESURE quelque chose (le corpus porte bien des appels de points d’application)', () => {
    let vus = 0;
    for (const { rel, text } of corpus()) {
      if (estFichierVitest(rel)) continue;
      for (const n of POINTS_DAPPLICATION) vus += text.split(`${n}(`).length - 1;
    }
    expect(vus, 'aucun appel vu : le scan ne mordrait sur rien').toBeGreaterThan(20);
  });

  it('QUATRE formes de perte sont reconnues (instruction nue, virgule, flèche à corps expression, argument étranger)', () => {
    const sonde = (src: string): string[] => {
      const sf = ast({ rel: 'x.ts', text: src })!;
      const out: string[] = [];
      const walk = (n: ts.Node): void => {
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && POINTS_DAPPLICATION.includes(n.expression.text)) {
          const f = formePerdue(n, sf);
          if (f) out.push(f);
        }
        n.forEachChild(walk);
      };
      walk(sf);
      return out;
    };
    expect(sonde('runFlow(g, s, f);'), 'A').toHaveLength(1);
    expect(sonde('const r = runFlow(g, s, f);'), 'B — capturé, jamais relu').toHaveLength(1);
    expect(sonde('const r = runFlow(g, s, f); use(r);'), 'B — capturé PUIS lu : consommé').toEqual([]);
    expect(sonde('console.log(runFlow(g, s, f));'), 'C').toHaveLength(1);
    expect(sonde('x = (runFlow(g, s, f), 1);'), 'D').toHaveLength(1);
    expect(sonde('list.forEach((f) => runFlow(g, s, f));'), 'G').toHaveLength(1);
    expect(sonde('jouerFlowEntier(runFlow(g, s, f));'), 'consommateur nommé').toEqual([]);
    expect(sonde('cloturer(g, s, runFlow(g, s, f), []);'), 'consommateur nommé').toEqual([]);
    expect(sonde('nePeutPasDifferer(applyEffects(g, s, e), "site");'), 'consommateur nommé').toEqual([]);
    expect(sonde('return runFlow(g, s, f);'), 'retour propagé : consommé').toEqual([]);
  });

  it('aucun appel ne PERD son retour — le signal « différé » ne peut pas mourir en silence', () => {
    const perdus = appelsPerdus();
    expect(
      perdus,
      'Un appel dont le retour se perd applique sa suite par-dessus un dé en vol (#1508).\n'
        + 'Trois issues : lire le retour (confier la suite, `differerLaSuite`), ou le passer à\n'
        + '`cloturer(…)` / `jouerFlowEntier(…)` / `nePeutPasDifferer(…)` (cf. state/combatEffects.ts) :\n'
        + `${perdus.join('\n')}`,
    ).toEqual([]);
  });
});

/**
 * Les ANGLES MORTS du scan ci-dessus, MESURÉS et non tus (patron du bloc « angles morts DÉCLARÉS »
 * plus haut dans ce fichier) : le scan résout les appels PAR NOM APPELÉ, sans liaison. Deux formes lui
 * échappent donc par construction — et le corpus mesure aujourd'hui ZÉRO occurrence de chacune, ce qui
 * est la seule raison de les tolérer. Ces deux `it` rougissent le jour où l'une apparaît.
 */
describe('#1508 — angles morts du scan, mesurés (alias local, appel par objet)', () => {
  const sondeVoit = (src: string): number => {
    const sf = ast({ rel: 'x.ts', text: src })!;
    let n = 0;
    const walk = (x: ts.Node): void => { if (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && POINTS_DAPPLICATION.includes(x.expression.text)) n++; x.forEachChild(walk); };
    walk(sf);
    return n;
  };

  it('angle mort : un ALIAS local échappe au scan — et le corpus n’en porte aucun', () => {
    expect(sondeVoit('const jouer = runFlow; jouer(g, s, f);'), 'le scan ne voit que le nom APPELÉ').toBe(0);
    const alias = corpus().filter(({ rel, text }) => !estFichierVitest(rel)
      && POINTS_DAPPLICATION.some((n) => new RegExp(`=\\s*${n}\\s*;`).test(text)));
    expect(alias.map((f) => f.rel), 'un alias local d’un point d’application : le scan cesserait de mordre dessus').toEqual([]);
  });

  it('angle mort : la propriété de `jouerFlowEntier` est SÉMANTIQUE, le scan ne la mesure pas', () => {
    // Le scan mesure la CONSOMMATION du retour, pas la vérité de ce que le nom affirme (« mon appelant
    // ne continue pas »). Un site qui écrirait `jouerFlowEntier(…)` alors que sa fonction poursuit
    // passerait — c'est un fait de LECTURE, pas de forme. Ce qui l'a fermé pour toute une classe :
    // l'appelant d'un applier de cascade EST une séquence qui continue, et depuis que les étapes
    // poussées s'INSÈRENT derrière l'étape courante (`cascade.poseDansLaSequence`), cette suite-là
    // passe APRÈS le dé par construction — plus rien à déclarer au site. Le contrat qui le mord :
    // `chute-a-la-porte.test.ts` (xi).
    const sf = ast({ rel: 'x.ts', text: 'function f() { jouerFlowEntier(runFlow(g, s, x)); autreChose(); }' })!;
    const perdus: string[] = [];
    const walk = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && POINTS_DAPPLICATION.includes(n.expression.text)) {
        const f = formePerdue(n, sf);
        if (f) perdus.push(f);
      }
      n.forEachChild(walk);
    };
    walk(sf);
    expect(perdus, 'le scan voit un retour CONSOMMÉ — il ne peut pas savoir que l’appelant poursuit').toEqual([]);
  });

  it('angle mort : un appel PAR OBJET échappe au scan — et le corpus n’en porte aucun', () => {
    expect(sondeVoit('CE.runFlow(g, s, f);'), 'le scan ne lit pas les accès de propriété').toBe(0);
    const parObjet = corpus().filter(({ rel, text }) => !estFichierVitest(rel)
      && POINTS_DAPPLICATION.some((n) => new RegExp(`\\.${n}\\s*\\(`).test(text)));
    expect(parObjet.map((f) => f.rel), 'un appel par objet/namespace : le scan cesserait de mordre dessus').toEqual([]);
  });
});

/**
 * REGISTRE des CLÔTURES (#1508) : la continuation d'une étape porte un `Flow` ET des `Cloture` — des
 * VERBES sérialisables (le `pendingCascade` est sauvegardé et voyage sur le réseau). Le registre doit
 * être TOTAL, sans quoi une clôture se perdrait exactement comme le signal qu'elle répare.
 */
describe('#1508 — le registre des clôtures est TOTAL', () => {
  it('chaque verbe déclaré a son applier (un verbe sans applier LÈVE, nommément)', () => {
    for (const verbe of CLOTURE_VERBES) {
      expect(() => jouerLesClotures(useGame.getState, useGame.setState, [{ verbe } as never]),
        `le verbe « ${verbe} » n’a pas d’applier enregistré`).not.toThrow(/sans applier/);
    }
  });

  it('un verbe INCONNU lève au lieu de se perdre en silence', () => {
    expect(() => jouerLesClotures(useGame.getState, useGame.setState, [{ verbe: 'verbeQuiNExistePas' } as never]))
      .toThrow(/sans applier/);
  });
});
