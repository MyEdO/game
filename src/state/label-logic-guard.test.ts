import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  scanLabelLogic, collectIdParamFunctions, scanLabelAsIdArg, collectIdParamFnsAcrossDirs, effectiveIdParamFns,
  scanLabelLiteralCompare, labelLiteralStockDrift, LABEL_LITERAL_STOCK,
  scanCallResultLiteralCompare, labelCallLiteralStockDrift, LABEL_CALL_LITERAL_STOCK,
  STRICT_DIRS, RATCHET_DIRS, DATA_DIRS, RATCHET_EXCEPTIONS,
  collectLabelEntityResolvers, labelEntityResolverNames, scanLabelResolverCalls,
  scanLabelKeyedIndex, LABEL_KEYED_INDEX_STOCK,
  scanGardeDeFace, collectFacesDAffichage, scanFaceDAffichageIdentite, scanFaceDeDonneeString, scanLiantsLitterauxDesFaces,
} from '../../scripts/guards/lib/labelLogic.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { LABEL_RESOLVER_CALL_STOCK } from '../../scripts/guards/lib/labelResolverCallStock.mjs';
import { champsAveugles, couvertureDuBalayage, ecartsDeStock } from '../../scripts/guards/lib/stock.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';
import { skillRefLabel } from '../data';
import { parseSkillRef } from '../ui/editor/refFormatLivre';

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

// `src/data` (`DATA_DIRS`) = couture label→id du CHARGEMENT : balayée au régime RATCHET, chaque
// résolveur par libellé exempté AU SITE. (`instanceIdMigration.ts` est SCANNÉ comme tout fichier
// state : sa migration de renommage teste la PRÉSENCE de clé `'label' in o`, pas une comparaison de
// libellé.)
const EXCLUDED = estFichierVitest;

// Mécanique de scan (vue `codeSeul` + BY_LABEL_RX/LABEL_EQ_RX + scanLabelLogic) :
// `scripts/guards/lib/labelLogic.mjs` (module .mjs pur), partagé avec le hook pre-commit
// (`scripts/git-hooks/pre-commit.mjs`) — la composition « map globale de déclarations id-param +
// résolution du shadowing » (`collectIdParamFnsAcrossDirs`/`effectiveIdParamFns`, #142 LOT 6bis) est
// EXPORTÉE par la lib, consommée à l'identique par ce test ET par le hook, sans copie.

const ALL_DIRS = [...STRICT_DIRS, ...RATCHET_DIRS];
/** Périmètre RATCHET des volets de LIGNE (#142/#289) : `RATCHET_DIRS` et la couture `DATA_DIRS`. */
const LIGNE_RATCHET_DIRS = [...RATCHET_DIRS, ...DATA_DIRS];

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
const ID_PARAM_FNS = () => (_idParamFns ??= collectIdParamFnsAcrossDirs(ROOT, [...ALL_DIRS, ...DATA_DIRS]));

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

/** Garde de FACE D'AFFICHAGE (#1988 §7) sur tout `src/` — mémoïsée : le cliquet des exceptions
 *  périmées et le volet de la garde lisent le MÊME balayage. */
let _face: ReturnType<typeof scanGardeDeFace> | null = null;
const scanDeFace = (): ReturnType<typeof scanGardeDeFace> => (_face ??= scanGardeDeFace(readCorpus(['src'], { tests: true })));

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

  it('src/gameIso + src/ui (#289) + src/data : aucune régression hors des exceptions justifiées', () => {
    const scan = scanDe(LIGNE_RATCHET_DIRS);
    attendCouverture({ nom: '#142 RATCHET', stock: {}, balayes: scan.fichiers, gisements: LIGNE_RATCHET_DIRS });
    const offenders: string[] = [];
    for (const f of scan.sites) {
      // `f.rel` est relatif à la racine (`src/gameIso/...`/`src/data/...`) ; les clés d'exception omettent `src/`.
      const shortKey = `${f.rel.replace(/^src\//, '')}:${f.line}`;
      if (!(shortKey in RATCHET_EXCEPTIONS)) offenders.push(`${f.rel}:${f.line}: ${f.detail}`);
    }
    expect(
      offenders,
      "Logique par LABEL non-exceptée dans src/gameIso/src/ui/src/data — migrer vers un keying par id, ou ajouter " +
        'une entrée JUSTIFIÉE à RATCHET_EXCEPTIONS (`scripts/guards/lib/labelLogic.mjs`), avec son test de légitimité :\n' + offenders.join('\n'),
    ).toEqual([]);
  });

  it('CLIQUET : toute exception dont le site a bougé/disparu doit être RETIRÉE ou re-justifiée', () => {
    const findings = [...findingsIn(LIGNE_RATCHET_DIRS), ...scanDeFace()];
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

  it('scanLabelLogic : détecte une IDENTITÉ dérivée du label, quelle que soit la chaîne qui mène au `.label` (#637, #1988)', () => {
    // Cas PLANTÉS = le motif qui vivait au rig (`TENUE_BY_ID` keyé par `slugId(d.label)`), et la forme
    // de `rigSpeciesId` (`src/data/index.ts`, #1988) qu'un motif de ligne `slugId\s*\(\s*[\w.]+\.label` ne
    // voit pas : appel, `?.`, `??`, gabarit, appel sur plusieurs lignes. CONTRE-ÉPREUVES : `slugId(p.name)`
    // (fragment TEXTE saisi en éditeur, couture label→id d'authoring) et `slugId(label)` (paramètre de
    // saisie) — le détecteur vise la LECTURE d'un champ `.label` seulement.
    const src = [
      'export const defId = (c) => c.id ?? slugId(c.label);',
      'const id = findTalent(p.name)?.id ?? slugId(p.name);',
      "export const r = (x) => slugId(findSpeciesById(x)?.label ?? x ?? 'Humain');",
      'export const s = slugId(a?.b.label);',
      'export const u = slugId(x.label ?? y);',
      'export const v = slugId(`${x.label}-${n}`);',
      'export const w = slugId(',
      '  pick(x).label,',
      ');',
      'export const q = (label) => slugId(label);',
    ].join('\n');
    const findings = scanLabelLogic('fixture.ts', src);
    expect(findings.map((f) => f.line)).toEqual([1, 3, 4, 5, 6, 7]);
    expect(new Set(findings.map((f) => f.rule))).toEqual(new Set(['label-logic']));
  });

  it('scanLabelLogic : la ligne rapportée est celle du FICHIER, sous un commentaire de bloc multiligne', () => {
    // Les volets de ligne et le volet AST (`slugId`) partagent la numérotation du fichier : c'est elle
    // que portent les clés `fichier:ligne` de `RATCHET_EXCEPTIONS`.
    const src = [
      '/**',
      ' * JSDoc de trois lignes.',
      ' */',
      'export const k = slugId(c.label);',
      'const m = X_BY_LABEL;',
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src).map((f) => f.line)).toEqual([4, 5]);
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
  it('scanLabelLogic : un `typeof x.label` compare le TYPE du champ, pas son texte', () => {
    const src = [
      "const l = estObjet(v) && typeof v.label === 'string' ? v.label : undefined;",
      "const m = typeof a?.b.label === 'string';",
      "const n = v.label === 'Épée';",
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src).map((f) => f.line)).toEqual([3]);
  });

  it('scanLabelLogic : le contenu d’une CHAÎNE n’est pas du code, `detail` cite la ligne source', () => {
    const src = [
      "const aide = 'écrire x.label === y est interdit';",
      "const k = x.label === 'Arme (au choix)';",
    ].join('\n');
    expect(scanLabelLogic('fixture.ts', src).map((f) => [f.line, f.detail])).toEqual([[2, "const k = x.label === 'Arme (au choix)';"]]);
  });

  describe('exemptions de la couture `src/data` : chacune vit dans un résolveur par libellé de #909', () => {
    /** Nom de la déclaration de PREMIER NIVEAU qui porte la ligne `n` (1-based). */
    const declarationDe = (lignes: string[], n: number): string => {
      for (let i = n - 1; i >= 0; i--) {
        const m = /^(?:export\s+)?(?:function|const)\s+(\w+)/.exec(lignes[i]);
        if (m) return m[1];
      }
      return '';
    };

    it('chaque site exempté de `src/data` est dans un résolveur reconnu, ou dans un index lu par lui SEUL', () => {
      const resolveurs = labelEntityResolverNames(ROOT);
      const lignes = readFileSync(join(ROOT, 'src/data/index.ts'), 'utf8').split('\n');
      const sites = new Set(scanDe(DATA_DIRS).sites.map((f) => `${f.rel.replace(/^src\//, '')}:${f.line}`));
      const exemptes = Object.keys(RATCHET_EXCEPTIONS).filter((k) => sites.has(k));
      expect(exemptes.length, 'aucun site `src/data` exempté : le volet est devenu muet').toBeGreaterThan(0);
      for (const cle of exemptes) {
        expect(cle.startsWith('data/index.ts:'), cle).toBe(true);
        const decl = declarationDe(lignes, Number(cle.split(':')[1]));
        const lecteurs = new Set(lignes.flatMap((l, i) =>
          new RegExp(`\\b${decl}\\b`).test(l) && declarationDe(lignes, i + 1) !== decl ? [declarationDe(lignes, i + 1)] : []));
        const porteur = resolveurs.has(decl) ? decl : lecteurs.size === 1 ? [...lecteurs][0] : `${decl} (lu par ${[...lecteurs].join(', ')})`;
        expect(resolveurs.has(porteur), `${cle} : \`${porteur}\` n'est pas un résolveur par libellé de #909`).toBe(true);
      }
    });
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

/**
 * FACE D'AFFICHAGE en position d'IDENTITÉ (#1988 §7) — une fonction exportée de `src/` au retour DÉCLARÉ
 * `PlayerText` rend un texte montré au joueur, qui change avec la langue : il ne sert ni de clé, ni
 * d'opérande de comparaison, ni d'argument de recherche (b). Une face de `src/data/**` qui lit `.label`
 * naît `PlayerText` (c), et ses liants vivent au catalogue (d). Cible 0 ; exemptions AU SITE par
 * `RATCHET_EXCEPTIONS`, chacune prouvée légitime ci-dessous.
 */
describe('garde de FACE D’AFFICHAGE (#1988 §7)', () => {
  const FACES = new Map([['trappingRefLabel', 'src/data/index.ts'], ['t', 'src/i18n/index.ts'], ['specLabel', 'src/data/index.ts']]);
  const identite = (src: string, rel = 'src/ui/sonde.tsx') => scanFaceDAffichageIdentite(rel, src, FACES).map((f) => f.line);

  it('corpus `src/` : aucune face en position d’identité, aucune face de donnée en `string`, aucun liant littéral hors exceptions', () => {
    const faces = collectFacesDAffichage(readCorpus(['src'], { tests: true }).filter(({ rel }) => !estFichierVitest(rel)));
    for (const f of ['t', 'dataLabel', 'refLabel', 'trappingRefLabel', 'mutationTablePlayerLabel', 'specLabel', 'conditionLabel']) {
      expect(faces.has(f), `la face \`${f}\` doit être COLLECTÉE par son type de retour`).toBe(true);
    }
    const hors = scanDeFace().filter((f) => !(`${f.rel.replace(/^src\//, '')}:${f.line}` in RATCHET_EXCEPTIONS));
    expect(hors.map((f) => `${f.rel}:${f.line} [${f.rule}:${f.face}] ${f.detail}`)).toEqual([]);
  });

  it('(b) chaque position d’identité est vue : clé calculée, index, égalité, `in`, `switch`, méthodes de clé', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'export const a = { ...choices, [trappingRefLabel(ref)]: v };',
      'export const b = choices[trappingRefLabel(ref)];',
      'export const c = trappingRefLabel(ref) === x;',
      'export const d = trappingRefLabel(ref) in choices;',
      'switch (trappingRefLabel(ref)) { default: break; }',
      'export const e = xs.includes(trappingRefLabel(ref));',
      'export const f = m.get(trappingRefLabel(ref));',
      'm.set(trappingRefLabel(ref), 1);',
    ].join('\n');
    expect(identite(src)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('(b) ALIAS suivi, import RENOMMÉ suivi ; nom de face MASQUÉ par une liaison locale ignoré', () => {
    const src = [
      'import { t as tr } from "../i18n";',
      'const k = tr("ref.ou");',
      'export const a = choices[k];',
      'export const b = xs.find((t) => t === y);',
      'export function c(t: string) { return m[t]; }',
    ].join('\n');
    expect(identite(src)).toEqual([3]);
  });

  it('(b) une méthode qui GARDE le texte reste la face : casse, blancs, forme Unicode, `String()`', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'import { t } from "../i18n";',
      'export const a = trappingRefLabel(r).toLowerCase() === y;',
      'export const b = m[trappingRefLabel(r).trim()];',
      'export const c = m[String(trappingRefLabel(r))];',
      "export const d = x === t('k').normalize().toUpperCase();",
    ].join('\n');
    expect(identite(src)).toEqual([3, 4, 5, 6]);
  });

  it('(b) positions de PRÉDICAT : receveur de méthode de texte, argument de `RegExp#test`, paire d’une table', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      "export const e = trappingRefLabel(r).includes('x');",
      "export const f = trappingRefLabel(r).startsWith('x');",
      "export const g = trappingRefLabel(r).endsWith('x');",
      'export const h = trappingRefLabel(r).match(/x/);',
      'export const i = trappingRefLabel(r).search(/x/);',
      'export const j = /x/.test(trappingRefLabel(r));',
      'export const k = new Map(xs.map((x) => [trappingRefLabel(x), x]));',
      'export const l = Object.fromEntries(xs.map((x) => [trappingRefLabel(x), 1]));',
      "export const n = [trappingRefLabel(r), 'x'].join(' ');",
    ].join('\n');
    expect(identite(src)).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('(b) ALIAS par affectation (`let`) et TRANSITIF ; une ré-affectation à un id le libère', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'let u; u = trappingRefLabel(r); export const n = m[u];',
      'const v = trappingRefLabel(r); const w = v; export const o = m[w];',
      "let q = trappingRefLabel(r); q = 'id'; export const p = m[q];",
    ].join('\n');
    expect(identite(src)).toEqual([2, 3]);
  });

  it('(b) HORS du volet : l’affichage, l’attribut JSX `key=`, et un appel de fonction non-face', () => {
    const src = [
      'import { trappingRefLabel } from "../data";',
      'export const a = <li key={trappingRefLabel(ref)}>{trappingRefLabel(ref)}</li>;',
      'export const b = `${trappingRefLabel(ref)} (3)`;',
      'export const c = choices[refKey(id, spec)];',
    ].join('\n');
    expect(identite(src)).toEqual([]);
  });

  it('(c) une export de `src/data/**` qui lit `.label` et rend `string`, déclaré ou INFÉRÉ, est refusée ; `PlayerText`, un type déclaré, ou hors `data/` passe', () => {
    const src = [
      'export function a(id: string): string { return find(id)?.label ?? id; }',
      'export const b = (id: string): string => find(id)?.label ?? id;',
      'export function c(id: string): PlayerText { return dataLabel(find(id)?.label, id); }',
      'export function d(id: string): string { return find(id)?.id ?? id; }',
      'export function e(id: string) { return find(id)?.label ?? id; }',
      'export const g = (id: string) => find(id)?.label;',
      'export function h(label: string): SkillData | undefined { return xs.find((s) => s.label === label); }',
    ].join('\n');
    expect(scanFaceDeDonneeString('src/data/sonde.ts', src).map((f) => f.face)).toEqual(['a', 'b', 'e', 'g']);
    expect(scanFaceDeDonneeString('src/ui/sonde.ts', src)).toEqual([]);
  });

  it('(d) liant littéral d’au moins deux lettres dans une face de `data/index.ts` ; clé, id et opérande passent', () => {
    const src = [
      'export function a(xs: string[]): PlayerText { return dataLabel(xs.join(" ou ")); }',
      'export function b(n: number): PlayerText { const s = `${n} parmi : x`; return dataLabel(s); }',
      'export function c(r: R): PlayerText { return r.w === "arme" ? t("ref.armeAuChoix") : refLabel("skills", r); }',
      'export function d(r: R): PlayerText { return "choice" in r ? t(`absent.${r.n}`) : dataLabel(r.l); }',
      'export function e(r: R): string { return r.l + " ou "; }',
      'function f(xs: string[]): PlayerText { return dataLabel(xs.join(" ou ")); }',
    ].join('\n');
    expect(scanLiantsLitterauxDesFaces('src/data/index.ts', src).map((f) => `${f.face}:${f.line}`)).toEqual(['a:1', 'b:2', 'f:6']);
    expect(scanLiantsLitterauxDesFaces('src/data/autre.ts', src)).toEqual([]);
  });

  it('MUTATION (d) sur la face RÉELLE : réintroduire `\' ou \'` dans `trappingRefLabel` rougit', () => {
    const reel = readFileSync(join(ROOT, 'src/data/index.ts'), 'utf8');
    const site = 'if (\'choice\' in ref) return ouListe(ref.choice.map(trappingRefLabel));';
    expect(reel, 'le site de la mutation a bougé : re-pointer ce test').toContain(site);
    expect(scanLiantsLitterauxDesFaces('src/data/index.ts', reel)).toEqual([]);
    const mute = reel.replace(site, 'if (\'choice\' in ref) return dataLabel(ref.choice.map(trappingRefLabel).join(\' ou \'));');
    expect(scanLiantsLitterauxDesFaces('src/data/index.ts', mute).map((f) => f.face)).toEqual(['trappingRefLabel']);
  });

  describe('exemptions de la garde de face : chacune est LÉGITIME', () => {
    const face = (cle: string) => scanDeFace().find((f) => `${f.rel.replace(/^src\//, '')}:${f.line}` === cle);
    const appelants = (nom: string) => readCorpus(['src'], { tests: true })
      .filter(({ rel, text }) => !estFichierVitest(rel) && new RegExp(`\\b${nom}\\(`).test(text))
      .map(({ rel }) => rel).sort();

    it('`qualityIdByLabel` rend un ID : résolveur libellé→id d’authoring, recensé par la garde #909', () => {
      const cle = Object.keys(RATCHET_EXCEPTIONS).find((k) => k.startsWith('data/index.ts:'))!;
      expect(face(cle)?.face).toBe('qualityIdByLabel');
      expect(labelEntityResolverNames(ROOT).has('qualityIdByLabel')).toBe(true);
    });

    it('`rollObsession` : copie runtime du lot 4 de #1816, lue seulement comme `cible`/`arg` du moteur', () => {
      expect(face('data/obsessions.ts:34')?.face).toBe('rollObsession');
      expect(RATCHET_EXCEPTIONS['data/obsessions.ts:34']).toMatch(/#1816.*lot 4/);
      expect(appelants('rollObsession')).toEqual(['src/data/obsessions.ts', 'src/engine/corruption.ts', 'src/engine/ops.ts']);
      for (const rel of ['src/engine/corruption.ts', 'src/engine/ops.ts']) {
        const lignes = readFileSync(join(ROOT, rel), 'utf8').split('\n').filter((l) => /rollObsession\(rng\)/.test(l));
        expect(lignes.length).toBeGreaterThan(0);
        for (const l of lignes) expect(l).toMatch(/const (cible|arg) = /);
      }
    });

    it('`conditionIdInText` : scan du journal FR sous #1330, lu par les deux lecteurs du journal seulement', () => {
      expect(face('engine/conditions.ts:69')?.face).toBe('conditionLabel');
      const conditions = readFileSync(join(ROOT, 'src/engine/conditions.ts'), 'utf8').split('\n');
      expect(conditions.slice(62, 68).join('\n')).toMatch(/#1330/);
      expect(conditions[67]).toMatch(/export function conditionIdInText/);
      expect(appelants('conditionIdInText')).toEqual(['src/engine/conditions.ts', 'src/gameIso/combatNarration.ts', 'src/state/combatLog.ts']);
    });

    it('`refFormatLivre` : parseur de SAISIE de l’éditeur, qui rend un id — l’aller-retour affichage → saisie tient', () => {
      expect(face('ui/editor/refFormatLivre.ts:41')?.face).toBe('specLabel');
      const ref = { id: 'corps-a-corps', spec: 'fleau', value: 50 };
      expect(parseSkillRef(skillRefLabel(ref))).toEqual(ref);
    });

    it('`refFormatLivre` : la saisie « (Au choix) » se lit au mot que l’affichage compose, et rend `choix`', () => {
      expect(face('ui/editor/refFormatLivre.ts:20')?.face).toBe('t');
      const ref = { id: 'savoir', choix: true as const, value: 30 };
      expect(parseSkillRef(skillRefLabel(ref))).toEqual(ref);
    });
  });
});
