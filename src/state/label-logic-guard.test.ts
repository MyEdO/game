import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  scanLabelLogic, collectIdParamFunctions, scanLabelAsIdArg, collectIdParamFnsAcrossDirs, effectiveIdParamFns,
  scanLabelLiteralCompare, labelLiteralStockDrift, LABEL_LITERAL_STOCK,
  scanCallResultLiteralCompare, labelCallLiteralStockDrift, LABEL_CALL_LITERAL_STOCK,
  STRICT_DIRS, RATCHET_DIRS, RATCHET_EXCEPTIONS,
  collectLabelEntityResolvers, labelEntityResolverNames, scanLabelResolverCalls,
  scanLabelKeyedIndex, LABEL_KEYED_INDEX_STOCK,
} from '../../scripts/guards/lib/labelLogic.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { LABEL_RESOLVER_CALL_STOCK } from '../../scripts/guards/lib/labelResolverCallStock.mjs';
import { champsAveugles, couvertureDuBalayage, ecartsDeStock } from '../../scripts/guards/lib/stock.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/** NON-VACUITÉ d'un cliquet, à jouer EN TÊTE du `it` qu'elle protège (patron `props-volumiques.test.ts`,
 *  `2639287cd`) : le cliquet ne juge que ce que le balayage lui présente — un gisement muet ou une
 *  entrée de stock hors corpus le rendrait vert sans que rien n'ait été lu. Les deux listes sont
 *  NOMMÉES par le socle (`couvertureDuBalayage`, `scripts/guards/lib/stock.mjs`) ; les `gisements`
 *  sont ceux que CE volet balaie, jamais ceux d'un volet voisin. */
function attendCouverture(p: { nom: string; stock: Record<string, unknown>; balayes: Iterable<string>; gisements: readonly string[] }): void {
  const c = couvertureDuBalayage({ nom: p.nom, stock: Object.keys(p.stock), balayes: p.balayes, gisements: p.gisements });
  expect(c.gisementsMuets, c.gisementsMuets.join('\n')).toEqual([]);
  expect(c.entreesDeStockAbsentes, c.entreesDeStockAbsentes.join('\n')).toEqual([]);
}

/**
 * Garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc agents) : toute LOGIQUE est
 * keyée par `id` STABLE — le `label` est de l'AFFICHAGE (multilangue). Scanne `src/engine` + `src/state`
 * (moteur/store, #142) + `src/gameIso` + `src/ui` (#289, rendu iso + UI) récursif, `.ts`/`.tsx`, HORS
 * `*.test.*` : ÉCHEC si le code (commentaires retirés) porte, sur `.label`, l'une de CINQ formes —
 * une carte par label (`XXX_BY_LABEL`/`byLabel`), une comparaison D'ÉGALITÉ (`x.label === …` /
 * `… === x.label`), un PRÉDICAT (regex `.test(x.label)`, méthode de chaîne `x.label.startsWith(…)`,
 * `switch (x.label)`), un champ d'AFFICHAGE en CLÉ (`display-key`/`collection-key`), ou `.label`
 * passé en ARGUMENT à un appel dont le PARAMÈTRE de déclaration s'appelle `id` (`label-as-id-arg`,
 * LOT 5 — `bodyShapeOf(sb.label)` : le paramètre attend un id STABLE, `.label` est de l'affichage).
 *
 * `src/engine`/`src/state` restent TOLÉRANCE ZÉRO, AUCUNE exception (l'instance de référence,
 * `creatureEquip.ts` SHAPE_BY_LABEL/RELOAD_BY_LABEL, est déjà migrée — rien ne justifie un répit
 * dans le moteur/store).
 *
 * `src/gameIso`/`src/ui` (#289, élargissement) portent un ratchet à EXCEPTIONS JUSTIFIÉES
 * (patron `no-emoji-affordance.test.ts`/LOT 4) : un `fichier:ligne` par site, chacun un pattern
 * DIFFÉRENT du FK-par-label originel (#142) — recherche/diagnostic, pas persistance de logique :
 *  - diagnostic DEV qui détecte PRÉCISÉMENT un mésusage label-au-lieu-d'id (comparer par id
 *    annulerait le diagnostic) ;
 *  - saisie/recherche UI par texte tapé (le label EST la clé de recherche humaine, motif `RefField`
 *    freeText déjà sanctionné) sur un type qui ne porte PAS d'id (aucune régression possible) ;
 *  - auto-liage de PROSE par texte (Codex) — matching textuel, pas une FK.
 * Chaque exception se justifie ligne par ligne ; une migration mécanique retire son entrée (CLIQUET).
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
// `STRICT_DIRS`/`RATCHET_DIRS`/`RATCHET_EXCEPTIONS` : SOURCE UNIQUE `scripts/guards/lib/labelLogic.mjs`
// (importés ci-dessus), consommée à l'identique par le hook pre-commit : aucune copie locale ici.

// `src/data/index.ts` = couture label→id tolérée au CHARGEMENT (conversion depuis du texte) — hors
// périmètre du garde-fou, aucune LOGIQUE keyée par label. (`instanceIdMigration.ts` est SCANNÉ comme
// tout fichier state : sa migration de renommage teste la PRÉSENCE de clé `'label' in o`, pas une
// comparaison de libellé.)
const EXCLUDED = (rel: string) =>
  estFichierVitest(rel) || rel === 'src/data/index.ts';

// Mécanique de scan (stripComments + BY_LABEL_RX/LABEL_EQ_RX + scanLabelLogic) :
// `scripts/guards/lib/labelLogic.mjs` (module .mjs pur), partagé avec le hook pre-commit
// (`scripts/git-hooks/pre-commit.mjs`) — la composition « map globale de déclarations id-param +
// résolution du shadowing » (`collectIdParamFnsAcrossDirs`/`effectiveIdParamFns`, #142 LOT 6bis) est
// EXPORTÉE par la lib, consommée à l'identique par ce test ET par le hook, sans copie.

const ALL_DIRS = [...STRICT_DIRS, ...RATCHET_DIRS];

/** Fichiers SCANNABLES d'un jeu de dossiers (chemin relatif POSIX + texte) — marche, lecture et
 *  mémoïsation par clé dans `scripts/guards/lib/sourceCorpus.mjs`, le PÉRIMÈTRE (`EXCLUDED`) reste
 *  ici. Les dossiers de fixtures des tests de CÂBLAGE sont des `mkdtemp` uniques à chaque run — leur
 *  clé ne peut donc pas répondre pour un corpus réel. */
function corpus(dirs: string[]): { rel: string; text: string }[] {
  return readCorpus(dirs, { tests: true }).filter(({ rel }) => !EXCLUDED(rel));
}

/** Le corpus des QUATRE dossiers, COMPOSÉ des deux périmètres au lieu d'être demandé sous sa propre
 *  clé : `readCorpus` concatène ses bases dans l'ordre reçu et `ALL_DIRS` est `[...STRICT_DIRS,
 *  ...RATCHET_DIRS]` — même liste, mêmes entrées. Une 3ᵉ clé relirait les 1 677 fichiers du disque
 *  (1,2 s mesurées le 2026-09-11) et rendrait des entrées d'identité NEUVE, donc hors des mémos
 *  keyés par identité de fichier. */
const corpusTotal = (): { rel: string; text: string }[] => [...corpus(STRICT_DIRS), ...corpus(RATCHET_DIRS)];

// Fonctions à paramètre `id` (5ᵉ forme, LOT 5) — collecte GLOBALE sur src/engine+state+gameIso+ui
// (déclaration et appel peuvent vivre dans des fichiers différents, ex. `bodyShapeOf` déclarée dans
// `state/spawn.ts`, appelée depuis le même module). PARESSEUSE : au top-level, cette collecte se
// paierait à la phase de COLLECTE de Vitest, hors de tout `it` (patron
// `src/gameIso/rig/quadruped/quad-couture.test.ts`).
let _idParamFns: ReturnType<typeof collectIdParamFnsAcrossDirs> | null = null;
const ID_PARAM_FNS = () => (_idParamFns ??= collectIdParamFnsAcrossDirs(ROOT, ALL_DIRS));

/** Sites des deux détecteurs `.label` sur un jeu de dossiers, ET les fichiers réellement ITÉRÉS pour
 *  les produire — mémoïsés ensemble : trois `it` (STRICT, RATCHET, CLIQUET des exceptions) demandent
 *  le MÊME scan, et la couverture doit porter sur la collection PARCOURUE, pas sur un second appel
 *  de `corpus(...)` qui pourrait diverger. */
const _scans = new Map<string, { sites: { rel: string; line: number; detail: string }[]; fichiers: string[] }>();
function scanDe(dirs: string[]): { sites: { rel: string; line: number; detail: string }[]; fichiers: string[] } {
  const cle = dirs.join('|');
  const cached = _scans.get(cle);
  if (cached) return cached;
  const sites: { rel: string; line: number; detail: string }[] = [];
  const fichiers: string[] = [];
  for (const { rel, text } of corpus(dirs)) {
    fichiers.push(rel);
    for (const finding of scanLabelLogic(rel, text)) sites.push({ rel, line: finding.line, detail: finding.detail });
    for (const finding of scanLabelAsIdArg(rel, text, effectiveIdParamFns(text, ID_PARAM_FNS()))) sites.push({ rel, line: finding.line, detail: finding.detail });
  }
  const scan = { sites, fichiers };
  _scans.set(cle, scan);
  return scan;
}
const findingsIn = (dirs: string[]): { rel: string; line: number; detail: string }[] => scanDe(dirs).sites;

describe('garde-fou « logique par label interdite » (#142)', () => {
  it('src/engine + src/state : TOLÉRANCE ZÉRO, aucune carte/comparaison par label', () => {
    // Volet à tolérance ZÉRO, donc sans stock : c'est la non-vacuité par GISEMENT qui porte seule le
    // contrôle — son `offenders == []` est satisfait par un corpus évaporé. (Le volet RATCHET jumeau,
    // lui, est déjà tenu par le cliquet des exceptions périmées ci-dessous.)
    const scan = scanDe(STRICT_DIRS);
    attendCouverture({ nom: '#142 STRICT', stock: {}, balayes: scan.fichiers, gisements: STRICT_DIRS });
    const offenders = scan.sites.map((f) => `${f.rel}:${f.line}: ${f.detail}`);
    expect(
      offenders,
      'Logique par LABEL détectée dans src/engine ou src/state — doctrine : `id` stable pour la logique, ' +
        '`label` = affichage seul. Migrer vers un keying par id (cf. `src/data/index.ts` pour la seule ' +
        'couture label→id tolérée, au CHARGEMENT).',
    ).toEqual([]);
  });

  it('src/gameIso + src/ui (#289) : aucune régression hors des exceptions justifiées', () => {
    const offenders: string[] = [];
    for (const f of findingsIn(RATCHET_DIRS)) {
      // `f.rel` est relatif à la racine (`src/gameIso/...`/`src/ui/...`) ; les clés d'exception omettent `src/`.
      const shortKey = `${f.rel.replace(/^src\//, '')}:${f.line}`;
      if (!(shortKey in RATCHET_EXCEPTIONS)) offenders.push(`${f.rel}:${f.line}: ${f.detail}`);
    }
    expect(
      offenders,
      "Logique par LABEL non-exceptée dans src/gameIso/src/ui — migrer vers un keying par id, ou ajouter " +
        'une entrée JUSTIFIÉE à RATCHET_EXCEPTIONS (label-logic-guard.test.ts) :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : toute exception dont le site a bougé/disparu doit être RETIRÉE ou re-justifiée', () => {
    const findings = findingsIn(RATCHET_DIRS);
    const present = new Set(findings.map((f) => `${f.rel.replace(/^src\//, '')}:${f.line}`));
    const stale = Object.keys(RATCHET_EXCEPTIONS).filter((k) => !present.has(k));
    expect(stale, 'Exception(s) PÉRIMÉE(s) (site déplacé ou assaini) — retirer/re-pointer ces entrées de RATCHET_EXCEPTIONS :\n' + stale.join('\n')).toEqual([]);
  });

  it('scanLabelLogic : détecte un champ d’AFFICHAGE interpolé dans une CLÉ (#598)', () => {
    // Cas PLANTÉ = le motif EXACT qui vivait en `state/triggeredEffects.ts` (Atouts d'arme keyés par
    // LIBELLÉ, corrigé en `weaponIdentity`) : la garde `.label` d'origine n'en voyait NI le champ
    // `name`, NI la construction de clé par littéral de gabarit — c'est ce trou qui l'a laissé vivre.
    const src = [
      'out.push({ effects: w.onHitEffects, cap: 1, key: `weapon:${weapon.name}`, label: weapon.name });',
      'const key = `zone-${zone.label}-${t.x}`;',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2]);
    expect(findings.map((f) => f.rule)).toEqual(['display-key', 'display-key']);
  });

  it('scanLabelLogic : détecte une IDENTITÉ dérivée du label (slugId(x.label), #637)', () => {
    // Cas PLANTÉ = le motif EXACT qui vivait au rig (`TENUE_BY_ID` keyé par `slugId(d.label)`) et en
    // moteur (`uid: { prefix: nat-${slugId(op.label)} }`) : re-dériver un `id` du libellé d'affichage
    // multilangue au runtime. La CONTRE-ÉPREUVE `slugId(p.name)` (fragment TEXTE saisi en éditeur,
    // couture label→id d'authoring) NE doit PAS être flaguée — le détecteur vise `.label` seulement.
    const src = [
      'export const defId = (c) => c.id ?? slugId(c.label);',
      'const id = findTalent(p.name)?.id ?? slugId(p.name);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1]);
    expect(findings.map((f) => f.rule)).toEqual(['label-logic']);
  });

  it('scanLabelLogic : ne flague PAS la LECTURE d’affichage d’un libellé (interpolation de journal)', () => {
    // Contre-épreuve indispensable : ~700 interpolations d'AFFICHAGE existent dans src/ (`${c.name} touche
    // ${d.name}`). Les flaguer rendrait la garde inutilisable — seule la construction d'une CLÉ est visée.
    const src = [
      'log: `${attacker.name} manque ${defender.name}.`,',
      'lines.push(`${f.label} : ${rolled} Moral.`);',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte un champ d’AFFICHAGE en CLÉ DE COLLECTION (#602)', () => {
    // Cas PLANTÉ = les motifs EXACTS du ticket #602 — `owned` (Set de talents possédés) keyé par LIBELLÉ
    // concret faute d'identité de spécialisation (`engine/character.ts`, corrigé en `refKey(id, spec)`),
    // et un repli d'UI keyé par le nom d'un sous-groupe (`compendium/CompendiumScreen.tsx`).
    const src = [
      'const free = specs.filter((s) => !owned.has(concreteLabel(entry.label, s)));',
      'if (!owned.has(entry.label)) return entry.label;',
      'const open = manualOpen[cl.name] ?? hasActive;',
      'seen.delete(other.label);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
    expect(findings.map((f) => f.rule)).toEqual(['collection-key', 'collection-key', 'collection-key', 'collection-key']);
  });

  it('scanLabelLogic : ne flague NI la résolution par id NI la CONSTRUCTION d’un index de texte (#602)', () => {
    // Contre-épreuves : (1) lire le libellé d'un lookup PAR ID est l'usage légitime du label (~50 sites
    // dans src/data) ; (2) REMPLIR un index depuis du texte est la conversion label→id tolérée
    // (CLAUDE.md) — auto-liage de prose, import de statbloc —, seule l'INTERROGATION est une décision.
    const src = [
      'return DISEASE_BY_ID.get(id)?.label ?? id;',
      'const l = byId.get(mm.entityId)?.label ?? byId.get(mm.entityId)?.ref;',
      'idx.exact.set(it.label, it);',
      'teamOf.set(named[i].name, named[i].kind === \'hero\' ? \'ally\' : \'enemy\');',
      'roots.add(e.label);',
      'NAME_TO_GROUP[norm(t.label)] = t.subType;',
      '(acc[it.name] ??= { name: it.name, uids: [] }).uids.push(it.uid);',
      '...Object.fromEntries(travelVehicles().map((v) => [v.id, v.label])),',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src)).toEqual([]);
  });

  it('scanLabelLogic : détecte les prédicats sur `.label` (regex .test, méthode de chaîne, switch)', () => {
    const src = [
      "const isOgre = /ogre/i.test(sp.label);",
      "const isPermanent = !/amputation|cécité|surdité/i.test(t.label);",
      "const isAffaler = eff.label.startsWith('Affaler');",
      "switch (x.label) { case 'A': break; }",
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3, 4]);
  });

  it('collectIdParamFunctions + scanLabelAsIdArg : détecte `.label` passé où le paramètre déclaré est `id` (LOT 5)', () => {
    // Cas PLANTÉ = le motif EXACT de #142 LOT 5 (`state/spawn.ts` avant correction) : `bodyShapeOf`
    // déclare un paramètre `id: string` — lui passer `sb.label` fait résoudre par un libellé d'auteur,
    // pas une identité stable.
    const decl = 'export function bodyShapeOf(id: string): BodyShape {\n  return rec.appearance.species;\n}';
    const idParamFns = collectIdParamFunctions(decl);
    expect(idParamFns.get('bodyShapeOf')).toBe(0);
    const bad = 'bodyShape: bodyShapeOf(sb.label), // BUG';
    const ok = 'bodyShape: bodyShapeOf(creature.id),';
    expect(scanLabelAsIdArg('fixture.ts', bad, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    expect(scanLabelAsIdArg('fixture.ts', ok, idParamFns)).toEqual([]);
  });

  it('collectIdParamFunctions : repère le paramètre `id` quel que soit son rang positionnel', () => {
    const decl = 'function findEntry(list, id: string, fallback) {}';
    expect(collectIdParamFunctions(decl).get('findEntry')).toBe(1);
    const findings = scanLabelAsIdArg('fixture.ts', 'findEntry(all, e.label, def)', collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('CÂBLAGE : le scan de CORPUS (findingsIn) consomme réellement scanLabelAsIdArg, pas juste le détecteur isolé (#142 LOT 6)', () => {
    // Preuve de câblage, PAS un test du détecteur : on invoque `findingsIn` — la MÊME fonction que
    // les 2 assertions de corpus ci-dessus (STRICT_DIRS/RATCHET_DIRS) — sur un dossier de fixtures
    // réel sur disque. Si la ligne qui appelle `scanLabelAsIdArg` dans `findingsIn` disparaît, ce
    // test devient rouge alors que les 2 tests de corpus resteraient VERTS (ils assèrent `[]` sur
    // le vrai corpus, qui n'en contient plus). Contre `applyOps`-forgé (#541) : ceci exécute le
    // MÊME pipeline (scanFiles → findingsIn) que la vraie assertion, sans ctx forgé à la main.
    const tmp = mkdtempSync(join(tmpdir(), 'label-logic-wiring-'));
    try {
      // Déclaration ET appel dans le MÊME fichier (câblage sur `effectiveIdParamFns` local, sans
      // dépendre du `ID_PARAM_FNS` global figé au chargement du module sur le VRAI corpus).
      writeFileSync(
        join(tmp, 'probe.ts'),
        'export function wiringProbeId(id: string): string {\n' +
          '  return id;\n' +
          '}\n' +
          'export const x = wiringProbeId(sb.label);\n',
      );
      const findings = findingsIn([tmp]);
      expect(findings.map((f) => f.detail)).toContain('export const x = wiringProbeId(sb.label);');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('collectIdParamFunctions : couvre aussi un paramètre `*Id` (creatureId/entityId/refId…), pas seulement `id` (LOT 6)', () => {
    const decl = 'function resolve(list: unknown[], creatureId: string, fallback: unknown) {}';
    expect(collectIdParamFunctions(decl).get('resolve')).toBe(1);
    const findings = scanLabelAsIdArg('fixture.ts', 'resolve(all, e.label, def)', collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('collectIdParamFunctions : const fléchée ASYNC, générique, et paramètre `id` APRÈS un callback (LOT 6)', () => {
    const asyncArrow = 'const loadThing = async (id: string) => fetchThing(id);';
    expect(collectIdParamFunctions(asyncArrow).get('loadThing')).toBe(0);

    const generic = 'function pick<T>(id: string, list: T[]): T | undefined { return list[0]; }';
    expect(collectIdParamFunctions(generic).get('pick')).toBe(0);

    const afterCallback = 'function withCb(onDone: (n: number) => void, id: string) {}';
    expect(collectIdParamFunctions(afterCallback).get('withCb')).toBe(1);
  });

  it('collectIdParamFunctions : méthode de CLASSE et d’objet littéral (raccourci sans `function`) (LOT 6)', () => {
    const classBody = 'class Repo {\n  findById(id: string): unknown {\n    return this.map.get(id);\n  }\n}';
    expect(collectIdParamFunctions(classBody).get('findById')).toBe(0);

    const objLiteral = 'const helpers = {\n  bodyShapeOf(id: string) {\n    return id;\n  },\n};';
    expect(collectIdParamFunctions(objLiteral).get('bodyShapeOf')).toBe(0);
  });

  it('scanLabelAsIdArg : appel MULTILIGNE (le scan porte sur le corps entier, pas ligne par ligne) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(id: string) { return id; }\n';
    const call = 'const shape = bodyShapeOf(\n  sb.label,\n);\n';
    const findings = scanLabelAsIdArg('fixture.ts', decl + call, collectIdParamFunctions(decl));
    expect(findings.map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('scanLabelAsIdArg : enrobages triviaux (`??`, template, String(...), `as`, `!`, méthode de chaîne) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(id: string) { return id; }\n';
    const idParamFns = collectIdParamFunctions(decl);
    const cases = [
      'bodyShapeOf(sb.label ?? "");',
      'bodyShapeOf(`${sb.label}`);',
      'bodyShapeOf(String(sb.label));',
      'bodyShapeOf(sb.label as string);',
      'bodyShapeOf(sb.label!);',
      'bodyShapeOf(sb.label.toLowerCase());',
    ];
    for (const line of cases) {
      expect(scanLabelAsIdArg('fixture.ts', decl + line, idParamFns).map((f) => f.rule), line).toEqual(['label-as-id-arg']);
    }
  });

  it('scanLabelAsIdArg : découpage d’arguments robuste aux `<`/`>` de comparaison (pas des génériques) (LOT 6)', () => {
    const decl = 'function bodyShapeOf(a: unknown, id: string, b: unknown) { return id; }\n';
    const idParamFns = collectIdParamFunctions(decl);
    const withComparison = 'bodyShapeOf(a < b, sb.label, d);';
    expect(scanLabelAsIdArg('fixture.ts', decl + withComparison, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    const withCallback = 'bodyShapeOf(() => 1, sb.label, d);';
    expect(scanLabelAsIdArg('fixture.ts', decl + withCallback, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
  });

  it('scanLabelAsIdArg : appel de MÉTHODE dont le nom n’est PAS une méthode de collection connue reste un candidat (LOT 6)', () => {
    const decl = 'const helpers = {\n  bodyShapeOf(id: string) {\n    return id;\n  },\n};\n';
    const idParamFns = collectIdParamFunctions(decl);
    const via = 'helpers.bodyShapeOf(sb.label);';
    expect(scanLabelAsIdArg('fixture.ts', decl + via, idParamFns).map((f) => f.rule)).toEqual(['label-as-id-arg']);
    // Contre-épreuve documentée : un nom de méthode COLLISIONNANT avec l'API Map/Set/Array reste
    // exclu, receveur inconnu ou pas — limite ASSUMÉE, cf. `COLLECTION_METHOD_NAMES` (labelLogic.mjs).
    const setDecl = 'function set(id: string) { return id; }\n';
    const setFns = collectIdParamFunctions(setDecl);
    expect(scanLabelAsIdArg('fixture.ts', 'teamOf.set(sb.label);', setFns)).toEqual([]);
  });
});

/**
 * Deuxième volet (#142 LOT 7) : un LIBELLÉ ne vit pas que dans un champ `label`. `weapon.reach ===
 * 'Très longue'` a vécu dans `src/engine` — zone à tolérance zéro — sans qu'aucune garde ne le voie,
 * parce que toutes ne regardaient que `label`/`name`. Le critère porte donc sur la FORME du LITTÉRAL
 * (majuscule initiale, accent ou espace = texte d'affichage, jamais un id slug de ce dépôt), quel que
 * soit le nom du champ. La dette héritée est un STOCK PAR FICHIER (`LABEL_LITERAL_STOCK`), à cliquet
 * strict dans les deux sens — pas une liste de sites exemptés.
 */
describe('garde-fou « logique par LIBELLÉ hors du champ label » (#142 LOT 7)', () => {
  const literalFindings = (fichiers: { rel: string; text: string }[]) => {
    const counts = new Map<string, number>();
    for (const { rel, text } of fichiers) {
      const n = scanLabelLiteralCompare(rel, text).length;
      if (n > 0 || rel in LABEL_LITERAL_STOCK) counts.set(rel, n);
    }
    return counts;
  };

  it('CLIQUET : aucune logique par libellé NEUVE, aucune dette soldée non retirée du stock', () => {
    const fichiers = corpusTotal();
    attendCouverture({ nom: 'LABEL_LITERAL_STOCK', stock: LABEL_LITERAL_STOCK, balayes: fichiers.map(({ rel }) => rel), gisements: ALL_DIRS });
    const drift = labelLiteralStockDrift(literalFindings(fichiers));
    expect(
      drift,
      'Logique par LIBELLÉ (champ hors `label`) hors stock — toute LOGIQUE est keyée par `id` STABLE, le\n' +
        'libellé est de l’AFFICHAGE (multilangue) :\n' + drift.join('\n'),
    ).toEqual([]);
  });

  it('ANTI-VACANCE : échoue sur la faute d’Allonge reconstituée, y compris portée par une variable', () => {
    // Le motif EXACT qui vivait en `engine/engagement.ts` avant migration (`REACH_ORDER` + comparaisons
    // au libellé accentué) — et sa variante par ALIAS, invisible à un scan ligne à ligne.
    const direct = "export const reachTiles = (w: Weapon) => (w.reach === 'Très longue' ? 2 : 1);";
    expect(scanLabelLiteralCompare('engagement.ts', direct).map((f) => f.rule)).toEqual(['label-literal']);
    const viaAlias = 'function f(w: Weapon) {\n  const band = w.reach;\n  return band === \'Considérable\' ? 3 : 1;\n}';
    expect(scanLabelLiteralCompare('engagement.ts', viaAlias).map((f) => f.rule)).toEqual(['label-literal']);
    const table = "const REACH_ORDER = { 'Très courte': 0, 'Moyenne': 1, 'Très longue': 2 };";
    expect(scanLabelLiteralCompare('engagement.ts', table).map((f) => f.rule)).toEqual(['label-record']);
    const aiguillage = "function g(w: Weapon) {\n  switch (w.reach) {\n    case 'Très longue': return 2;\n    default: return 1;\n  }\n}";
    expect(scanLabelLiteralCompare('engagement.ts', aiguillage).map((f) => f.rule)).toEqual(['label-switch']);
  });

  it('CONTRE-ÉPREUVES : discriminant d’union, champ d’affichage rendu, vocabulaire DOM, comparaison à une variable', () => {
    const src = [
      "if (area.kind === 'disc') return radius;", // discriminant d'union en slug ASCII
      "const melee = w.type === 'melee';",
      'return <span className="chip">{item.label}</span>;', // RENDU d'un libellé = son usage légitime
      "if (e.key === 'Enter' || e.code === 'Space') act();", // vocabulaire W3C, aucun id possible
      "if (tag === 'INPUT') return;", // alias de `el.tagName`, même vocabulaire W3C
      'if (a.reach === b.reach) return 0;', // comparaison à une VARIABLE : aucun libellé figé
      "const ids = { 'tres-longue': 2, 'considérable': 3 };", // table keyée par ids (minuscules)
    ].join('\n');
    expect(scanLabelLiteralCompare('fixture.tsx', 'const tag = el.tagName;\n' + src)).toEqual([]);
  });

  it('ANTI-VACANCE : échoue sur la faute de RÉCOLTE reconstituée (regex de libellé sur une valeur dérivée d’un champ)', () => {
    // Le motif EXACT qui vivait en `engine/harvest.ts` avant migration (#1318 V6) : le TraitInstance
    // formaté en prose FR, puis re-parsé à la regex — la voie par id (`findResolvedTrait`) existait.
    const viaCallback = 'function h(c: Creature) {\n'
      + "  return (c.traits ?? []).map(traitText).find((s) => /^Taille/.test(s)) ?? '';\n"
      + '}';
    expect(scanLabelLiteralCompare('harvest.ts', viaCallback).map((f) => f.rule)).toEqual(['label-regex']);
    const viaVariable = 'function h(c: Creature) {\n'
      + "  const t = (c.traits ?? []).map(traitText).join(' ');\n"
      + "  if (/Monstrueuse/.test(t)) return 'Monstrueuse';\n"
      + "  return t.match(/Énorme/) ? 'Énorme' : 'Moyenne';\n"
      + '}';
    expect(scanLabelLiteralCompare('harvest.ts', viaVariable).map((f) => f.rule)).toEqual(['label-regex', 'label-regex']);
  });

  it('CONTRE-ÉPREUVES `label-regex` : motif de FORME, texte non dérivé d’un champ, transformation', () => {
    const src = [
      "const slug = s.replace(/[^a-z0-9]+/g, '-');", // transformation, pas une décision
      'if (/^\\p{Lu}/u.test(raw)) return raw;', // critère de FORME (classe/échappement), aucun mot de libellé
      "if (/^Taille/.test('Taille (Grande)')) return 1;", // littéral en dur : aucun champ de donnée derrière
      'const n = txt.match(/[0-9]+/);', // motif numérique
    ].join('\n');
    expect(scanLabelLiteralCompare('fixture.ts', src)).toEqual([]);
  });
});

/**
 * Troisième volet (#1694 B3) : le sujet comparé à un libellé n'est pas toujours un CHAMP.
 * `rangeBandName(distanceTiles, rangeM, metresPerTile) === 'Bout portant'` décidait l'Esquive contre
 * un tir (`engine/combat.ts`, LDB 14 l.40) sur le TEXTE FR d'une bande de portée, alors que la même
 * couture expose `rangeBandId(...) === 'bout-portant'`. Les deux volets ci-dessus étaient AVEUGLES à
 * cette forme — mesuré : sur la ligne isolée, `scanLabelLogic` et `scanLabelLiteralCompare` rendent
 * `[]`. Critère STRUCTUREL : égalité dont un côté est un APPEL et l'autre un littéral de FORME libellé.
 */
describe('garde-fou « retour d’APPEL comparé à un LIBELLÉ » (#1694 B3)', () => {
  it('CLIQUET src/engine + src/state : aucun site neuf, aucune dette soldée non retirée du stock', () => {
    // Gisements = `STRICT_DIRS` SEULS : ce volet ne balaie que la zone à tolérance zéro, exiger la
    // zone ratchet ici réclamerait une couverture que le cliquet ne prétend pas tenir.
    const fichiers = corpus(STRICT_DIRS);
    attendCouverture({ nom: 'LABEL_CALL_LITERAL_STOCK', stock: LABEL_CALL_LITERAL_STOCK, balayes: fichiers.map(({ rel }) => rel), gisements: STRICT_DIRS });
    const counts = new Map<string, number>();
    for (const { rel, text } of fichiers) {
      const n = scanCallResultLiteralCompare(rel, text).length;
      if (n > 0 || rel in LABEL_CALL_LITERAL_STOCK) counts.set(rel, n);
    }
    const drift = labelCallLiteralStockDrift(counts);
    expect(drift, 'Retour d’appel comparé à un LIBELLÉ :\n' + drift.join('\n')).toEqual([]);
  });

  it('ANTI-VACANCE : la faute d’Esquive à Bout Portant reconstituée est VUE, et les deux volets précédents ne la voient PAS', () => {
    const avant =
      "if (distanceTiles != null && rangeM != null && rangeBandName(distanceTiles, rangeM, metresPerTile) === 'Bout portant')\n"
      + "  modes.add('esquive');";
    expect(scanCallResultLiteralCompare('combat.ts', avant).map((f) => f.rule)).toEqual(['label-call-literal']);
    expect(scanLabelLogic('combat.ts', avant)).toEqual([]);
    expect(scanLabelLiteralCompare('combat.ts', avant)).toEqual([]);
    const apres = "if (rangeBandId(distanceTiles, rangeM, metresPerTile) === 'bout-portant') modes.add('esquive');";
    expect(scanCallResultLiteralCompare('combat.ts', apres)).toEqual([]);
  });

  it('CONTRE-ÉPREUVES : id kebab, comparaison à une variable, texte FABRIQUÉ (`t`/`String`)', () => {
    const src = [
      "if (rangeBandId(d, r, m) === 'bout-portant') return 1;", // l'id STABLE : la forme attendue
      'if (bandOf(a) === bandOf(b)) return 0;', // aucun libellé figé
      "if (t('roll.voile') === 'Voile') return 1;", // texte FABRIQUÉ par l'i18n, pas une clé de logique
      "if (String(n) === 'Deux') return 1;",
    ].join('\n');
    expect(scanCallResultLiteralCompare('fixture.ts', src)).toEqual([]);
  });
});

/**
 * Volet CONSTRUCTION (#909) : les volets ci-dessus jugent l'INTERROGATION d'une collection par un
 * libellé — la REMPLIR depuis du texte y est tolérée, la conversion label→id étant licite mais à UN
 * endroit (`src/data/index.ts`, CLAUDE.md). Dans `src/engine`/`src/state`, cette CONSTRUCTION est la
 * faute, et elle était MUETTE : `QUALITY_DESC` (`engine/qualities/describe.ts`) y a vécu comme
 * `Record` keyé par LIBELLÉ, bâti par `fromEntries(… [q.label, q.desc])` et lu par une VARIABLE.
 */
describe('garde-fou « index keyé par un LIBELLÉ, construit dans le moteur » (#909)', () => {
  it('scanLabelKeyedIndex : échoue sur la faute QUALITY_DESC reconstituée, et sur ses deux variantes', () => {
    const src = [
      'const DATA_DESC = Object.fromEntries(qualitiesJson.filter((q) => q.desc).map((q) => [q.label, q.desc!]));',
      'idx.exact.set(it.label, it);',
      'NAME_TO_GROUP[norm(t.label)] = t.subType;',
    ].join('\n');
    const findings = scanLabelKeyedIndex('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 2, 3]);
    expect(findings.map((f) => f.rule)).toEqual(['label-keyed-index', 'label-keyed-index', 'label-keyed-index']);
  });

  it('CONTRE-ÉPREUVES : libellé en VALEUR, index par id, lecture d’un libellé', () => {
    const src = [
      '...Object.fromEntries(travelVehicles().map((v) => [v.id, v.label])),', // le libellé est la VALEUR
      'byId.set(e.id, e);',
      'return DISEASE_BY_ID.get(id)?.label ?? id;',
      'const noms = [a.label, b.label].join(\', \');', // tableau d'AFFICHAGE, pas une paire clé/valeur
    ].join('\n');
    expect(scanLabelKeyedIndex('fixture.ts', src)).toEqual([]);
  });

  it('CLIQUET : aucun index par libellé NEUF dans src/engine + src/state, aucune dette soldée non retirée', () => {
    // Même périmètre que le volet précédent : `STRICT_DIRS` seuls. Le stock est VIDE (cliquet tenu à
    // zéro) — sa liste d'entrées absentes l'est donc aussi, et c'est la non-vacuité par GISEMENT qui
    // porte seule le contrôle : c'est elle qui tomberait si le balayage s'évaporait.
    const fichiers = corpus(STRICT_DIRS);
    attendCouverture({ nom: 'LABEL_KEYED_INDEX_STOCK', stock: LABEL_KEYED_INDEX_STOCK, balayes: fichiers.map(({ rel }) => rel), gisements: STRICT_DIRS });
    const counts = new Map<string, number>();
    for (const { rel, text } of fichiers) {
      const n = scanLabelKeyedIndex(rel, text).length;
      if (n > 0 || rel in LABEL_KEYED_INDEX_STOCK) counts.set(rel, n);
    }
    const ecarts = ecartsDeStock({
      observe: [...counts].filter(([, n]) => n > 0).map(([rel, n]) => ({ rel, n })),
      stock: Object.entries(LABEL_KEYED_INDEX_STOCK).map(([rel, n]) => ({ rel, n: Number(n) })),
      cle: (e: { rel: string; n: number }) => `${e.rel} | ${e.n}`,
      remede: {
        neuve: (_cle, e) =>
          `${e.rel} : ${e.n} index keyé(s) par un LIBELLÉ — la conversion label→id vit dans ` +
          '`src/data/index.ts` (résolveur d’id), le moteur ne manipule que des ids.',
        perimee: (cle) =>
          `${cle} : ce compte n'est plus mesuré — la ligne se retire (dette SOLDÉE) ou se met à jour, ` +
          'dans le MÊME geste, au stock LABEL_KEYED_INDEX_STOCK.',
      },
    });
    const drift = [...ecarts.neuves, ...ecarts.perimees];
    expect(drift, drift.join('\n')).toEqual([]);
  });
});

/**
 * Troisième volet (#909) : la comparaison `.label === label` d'un résolveur (`findCreature`,
 * `findSpell`…) vit DANS `src/data/index.ts`, seul fichier où la doctrine la tolère — les deux
 * premiers volets ne voient QUE cette comparaison textuelle, pas le fait d'INVOQUER un tel
 * résolveur depuis `src/engine`/`src/state`. Reconnaissance et stock : voir l'en-tête de
 * `scanLabelResolverCalls` (`labelLogic.mjs`) et de `labelResolverCallStock.mjs`.
 */
describe('garde-fou « appel à un résolveur d’entité par LIBELLÉ » (#909)', () => {
  const RESOLVER_NAMES = labelEntityResolverNames(ROOT);

  function resolverCallCounts(fichiers: { rel: string; text: string }[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const { rel, text } of fichiers) {
      const n = scanLabelResolverCalls(rel, text, RESOLVER_NAMES).length;
      if (n > 0 || rel in LABEL_RESOLVER_CALL_STOCK) counts.set(rel, n);
    }
    return counts;
  }

  it('src/data/index.ts porte au moins un résolveur reconnu', () => {
    expect(RESOLVER_NAMES.size, 'aucun résolveur reconnu : le volet est devenu muet').toBeGreaterThan(0);
  });

  it('collectLabelEntityResolvers : reconnaît les TROIS formes d’un résolveur par libellé (#909, #1924)', () => {
    const src = [
      'export function findMachin(label: string): MachinData | undefined { return undefined; }',
      'export const findBidule = (label: string): BiduleData | undefined => undefined;',
      'export function machinIdByLabel(label: string): string { return label; }',
      "const trucParLabel = indexParChamp('trucs', trucs, (t) => t.label);",
      'export const findTruc: (label: string) => TrucData | undefined = trucParLabel;',
      // Contre-épreuves : paramètre `label` mais ni retour `XxxData` ni nom `…By…Label` —
      // et fonction NON exportée (résolveur privé, pas la surface publique du fichier).
      'export function charKeyOf(label: string): string { return label; }',
      'function privateFind(label: string): MachinData | undefined { return undefined; }',
    ].join('\n');
    expect([...collectLabelEntityResolvers(src)].sort()).toEqual(['findBidule', 'findMachin', 'findTruc', 'machinIdByLabel']);
  });

  // Le stock ne fait que décroître : aucun plafond ne le double. Un appel neuf
  // depuis `src/engine`/`src/state` est une entrée que le stock ne porte pas, donc une `neuve` du
  // volet ci-dessous — et une ligne ajoutée au stock pour « solder » cette régression serait une
  // `perimee` au même geste. Les deux sens sont tenus par l'ÉCART, jamais par un compte.

  /** Clé de la dette : le fichier ET son COMPTE d'appels — un appel de plus est une entrée neuve,
   *  pas une ligne qui bouge (même mesure que `CLE_DETTE`, `src/data/slots-contrat.test.ts`). */
  const CLE_APPELS = (e: { rel: string; n: number }) => `${e.rel} | ${e.n}`;
  const stockEntries = Object.entries(LABEL_RESOLVER_CALL_STOCK).map(([rel, n]) => ({ rel, n }));

  it('CLIQUET : aucun appel NEUF à un résolveur par libellé, aucune dette soldée non retirée du stock', () => {
    // Même trou que les trois volets précédents : `resolverCallCounts` ne retient un fichier que s'il
    // porte un finding OU s'il est au stock — un balayage évaporé rend zéro compte, donc zéro écart.
    const fichiers = corpus(STRICT_DIRS);
    attendCouverture({ nom: 'LABEL_RESOLVER_CALL_STOCK', stock: LABEL_RESOLVER_CALL_STOCK, balayes: fichiers.map(({ rel }) => rel), gisements: STRICT_DIRS });
    const ecarts = ecartsDeStock({
      observe: [...resolverCallCounts(fichiers)].filter(([, n]) => n > 0).map(([rel, n]) => ({ rel, n })),
      stock: stockEntries,
      cle: CLE_APPELS,
      remede: {
        neuve: (_cle, e) =>
          `${e.rel} : ${e.n} appel(s) à un résolveur d'entité par LIBELLÉ — résoudre par l'id STABLE déjà tenu par ` +
          "l'appelant (findXById), le résolveur par label est réservé à l'authoring.",
        perimee: (cle) =>
          `${cle} : ce compte n'est plus mesuré — la ligne se retire (dette SOLDÉE) ou se met à jour (le compte a bougé) ` +
          'dans le MÊME geste, au stock LABEL_RESOLVER_CALL_STOCK.',
      },
    });
    const drift = [...ecarts.neuves, ...ecarts.perimees];
    expect(drift, drift.join('\n')).toEqual([]);
  });

  it('MUTATION par champ : le COMPTE d’appels entre dans la clé comparée', () => {
    expect(
      champsAveugles(stockEntries, CLE_APPELS, ['n']),
      'le compte est HORS de la clé comparée : un fichier stocké passant de 1 à 3 appels laisserait la garde verte.',
    ).toEqual([]);
  });

  it('scanLabelResolverCalls : détecte l’appel BARE, ignore un nom SHADOWÉ localement', () => {
    const resolverNames = new Set(['findCreature']);
    const bad = "const c = findCreature('Orc');";
    expect(scanLabelResolverCalls('fixture.ts', bad, resolverNames).map((f) => f.rule)).toEqual(['label-entity-resolver-call']);

    // Shadowing local (`collectDeclaredNames`) : le fichier définit SA PROPRE `findCreature` — son
    // appel vise la locale, pas le résolveur de `src/data/index.ts`.
    const shadowed = 'function findCreature(id: string) { return id; }\nconst c = findCreature(x);';
    expect(scanLabelResolverCalls('fixture.ts', shadowed, resolverNames)).toEqual([]);
  });

  it('CÂBLAGE : le scan de CORPUS (resolverCallCounts) consomme réellement scanLabelResolverCalls sur le vrai corpus', () => {
    // Preuve de câblage sur une FIXTURE réelle sur disque, comme le test « CÂBLAGE » du volet #142 —
    // contre `applyOps`-forgé (#541) : si l'appel à `scanLabelResolverCalls` dans `resolverCallCounts`
    // disparaît, ce test devient rouge alors que le test CLIQUET resterait VERT (stock déjà soldé à 0
    // sur les fichiers réels scannés en dehors de ce dossier temporaire).
    const tmp = mkdtempSync(join(tmpdir(), 'label-resolver-call-wiring-'));
    try {
      const [resolveur] = RESOLVER_NAMES;
      writeFileSync(join(tmp, 'probe.ts'), `export const x = ${resolveur}('Orc');\n`);
      const counts = new Map<string, number>();
      for (const { rel, text } of readCorpus([tmp], { tests: true })) {
        counts.set(rel, scanLabelResolverCalls(rel, text, RESOLVER_NAMES).length);
      }
      expect([...counts.values()]).toContain(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
