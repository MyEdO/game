/**
 * CONTRAT des deux concepts à DEUX BORNES de la donnée (#1463 L4, vague `plage`) — sondes du design
 * jugé du 2026-08-31 promues en tests.
 *
 * Ce fichier tient six affirmations POSITIVES, chacune mesurée sur les DEUX racines de donnée
 * (`src/data` et `src/scenes`, comme le scan des structures) :
 *  A. une seule graphie d'OBJET nomme une paire de bornes (`min,max`) ; ce qui reste encodé par la
 *     BORNE HAUTE SEULE est INVENTORIÉ, document par document ;
 *  B. les bornes d'un RÉGLAGE et les bornes d'un TIRAGE sont disjointes ;
 *  C. la fourchette EMBOÎTÉE (`{range: {min, max}}`) n'existe nulle part ;
 *  D. l'en-tête de `STRUCTURES_ORPHELINES` dit ce que le stock mesure ;
 *  E. les bandes OUVERTES (`max: null`) de toute la donnée sont NOMMÉES, une par document — c'est ce
 *     qui justifie un nœud de grammaire à part (`plageOuverteSchema`, #1463 L-gram-1) plutôt qu'une
 *     borne haute rendue `nullable` partout ;
 *  F. la paire de bornes encodée en TUPLE `[min, max]` est INVENTORIÉE, site par site, en stock
 *     DÉCROISSANT — avec les sites qui n'en sont pas, EXCLUS NOMMÉMENT.
 *
 * COUVERTURE RÉELLE, et ses deux bords (#1659, 2026-09-01 — l'en-tête d'avant revendiquait « les deux
 * concepts à DEUX BORNES de la donnée » alors que 99 paires écrites en TUPLE lui échappaient, sur 18
 * sites) :
 *   (1) A/B/C/E ne voient que des OBJETS : une paire de bornes écrite `[81, 130]` n'a ni clé `min` ni
 *       clé `max` — c'est le volet F, et lui seul, qui la mesure ;
 *   (2) le volet A « borne haute seule » reste borné à l'ÉLÉMENT DE TABLEAU, là où A/B/C/E et le
 *       lexique ne le sont plus : hors tableau, `{max}` sans `min` est un CARDINAL, pas une table
 *       encodée par sa borne haute — mesuré 2026-09-01, les deux seuls sites sont
 *       `arcane-phenomena.json › stonePropertySlots` (nombre de propriétés d'une pierre) et
 *       `traits.json › effects[].on` (nombre de cibles d'un déclenchement).
 *
 * Ces six-là sont ce qui rend la CIBLE tenable : `findTableEntry`
 * (`src/engine/tables.ts`, primitive de la table `docs/primitives.md`) exige la forme PLATE `{min, max}`, et
 * borne le tirage des DEUX côtés — donc l'ordre des rangées d'une table éditable au Codex ne décide
 * plus de son résultat.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { STRUCTURES_ORPHELINES } from '../../scripts/guards/lib/structuresStock.mjs';

/** Les DEUX racines de donnée du projet, comme le scan des structures (`scripts/docs/lib/structures-scan.mts`) :
 *  une graphie de bornes qui n'apparaîtrait que dans un document de SCÈNE échapperait sinon à la mesure.
 *  Mesuré 2026-08-31 : `src/scenes` (4 documents de projet) porte 0 paire de bornes, 0 borne haute
 *  seule, 0 `rand` — la sonde y verrouille donc une population VIDE, et c'est ce qu'on veut tenir. */
const RACINES: [string, string][] = ['src/data', 'src/scenes'].map((r) => [r, join(process.cwd(), r)]);

/** Graphies CONNUES d'une paire de bornes — celles qu'on cherche, pas seulement celle qu'on écrit. */
const PAIRES = [
  ['min', 'max'],
  ['from', 'to'],
  ['de', 'a'],
  ['low', 'high'],
  ['lo', 'hi'],
  ['debut', 'fin'],
  ['start', 'end'],
  ['inf', 'sup'],
] as const;

type Objet = Record<string, unknown>;
type Site = { doc: string; chemin: string; cles: string[] };

const estNombre = (v: unknown): v is number => typeof v === 'number';

/** Paramètre d'une recette de RENDU (`detailRecipeSchema`, `schemas/grammaire/valeurs.ts`) : un
 *  intervalle géométrique lu POSITIONNELLEMENT (`src/gameIso/detail/courses.ts:44` :
 *  `c.blockWM[0] + c.blockWM[1]`), pas une bande de table — aucun d100 ne le traverse. */
const EXCLU_RECETTE =
  'paramètre d’une recette de RENDU (`detailRecipeSchema`) lu positionnellement par `src/gameIso/detail/courses.ts:44`, pas une bande de table.';

type Mesure = {
  /** Compte par graphie de paire (`'min,max'` → n). */
  paires: Record<string, number>;
  /** Objets `{range: {min, max}}` — la cible EMBOÎTÉE. */
  emboites: string[];
  /** Objet portant `min` ET `max` numériques — la candidature structurelle du lexique, qui n'est plus
   *  POSITIONNELLE depuis #1659 (`candidatureHorsTableau`) : élément de tableau comme porté par un champ. */
  deuxBornes: Site[];
  /** Élément de TABLEAU portant `max` (nombre ou `null`) SANS `min` : la borne haute SEULE. Borné au
   *  tableau à dessein (cf. l'en-tête, bord (2) : hors tableau, `{max}` seul est un CARDINAL). */
  borneHauteSeule: Site[];
  /** Objet portant `min` numérique et `max: null` : la bande OUVERTE (`plageOuverteSchema`). */
  bandesOuvertes: Site[];
  /** TUPLE `[nombre, nombre]`, agrégé par `doc::chemin` (indices de tableau réduits à `[]`). */
  tuples: Record<string, number>;
  /** Documents portant le champ `rand` (borne haute d100 portée par l'ENTITÉ), et son compte. */
  rand: Record<string, number>;
  /** Documents JSON effectivement lus, PAR RACINE — sans quoi l'élargissement de la marche à une
   *  seconde racine serait un no-op indétectable (elle n'y porte, aujourd'hui, aucune borne). */
  documentsParRacine: Record<string, number>;
};

function mesurer(): Mesure {
  const m: Mesure = { paires: {}, emboites: [], deuxBornes: [], borneHauteSeule: [], bandesOuvertes: [], tuples: {}, rand: {}, documentsParRacine: {} };
  const walk = (n: unknown, doc: string, chemin: string, dansTableau: boolean): void => {
    if (Array.isArray(n)) {
      // Volet F : le TUPLE de deux nombres est la paire de bornes qu'aucune clé ne nomme — il se
      // mesure sur le TABLEAU lui-même, avant la descente, et s'agrège par `doc::chemin`.
      if (n.length === 2 && n.every(estNombre)) {
        const site = `${doc}::${chemin}`;
        m.tuples[site] = (m.tuples[site] ?? 0) + 1;
      }
      for (const e of n) walk(e, doc, `${chemin}[]`, true);
      return;
    }
    if (!n || typeof n !== 'object') return;
    const o = n as Objet;
    const cles = Object.keys(o);

    for (const [a, b] of PAIRES) {
      if (estNombre(o[a]) && estNombre(o[b])) m.paires[`${a},${b}`] = (m.paires[`${a},${b}`] ?? 0) + 1;
    }
    const r = o.range as Objet | undefined;
    if (r && typeof r === 'object' && !Array.isArray(r) && estNombre(r.min) && estNombre(r.max)) {
      m.emboites.push(`${doc}${chemin}`);
    }
    // Ni `deuxBornes` ni `bandesOuvertes` ne regardent la POSITION du porteur : la candidature `plage`
    // du lexique ne le fait plus non plus (`candidatureHorsTableau`, #1659) — un `{min,max}` porté par
    // un champ est la même fourchette que celui d'un élément de tableau.
    if (estNombre(o.min) && estNombre(o.max)) m.deuxBornes.push({ doc, chemin, cles });
    if (estNombre(o.min) && o.max === null) m.bandesOuvertes.push({ doc, chemin, cles });
    if (dansTableau && 'max' in o && !('min' in o) && (estNombre(o.max) || o.max === null)) {
      m.borneHauteSeule.push({ doc, chemin, cles });
    }
    if (estNombre(o.rand)) m.rand[doc] = (m.rand[doc] ?? 0) + 1;

    for (const c of cles) walk(o[c], doc, `${chemin}.${c}`, false);
  };
  /** Les `.json` d'une racine, à toute profondeur : ce qui est collecté est de la DONNÉE, pas un
   *  corpus source — `listerArbre`, jamais `readCorpus`. */
  const documents = (dir: string): [string, string][] =>
    listerArbre(dir, { filtre: (rel) => rel.endsWith('.json') }).map((rel) => [rel, join(dir, rel)]);
  for (const [cle, racine] of RACINES) {
    const lus = documents(racine);
    m.documentsParRacine[cle] = lus.length;
    for (const [nom, chemin] of lus) walk(JSON.parse(readFileSync(chemin, 'utf8')), nom, '', false);
  }
  return m;
}

/**
 * STOCK DÉCROISSANT des paires de bornes écrites en TUPLE `[min, max]` (volet F, #1659) — la sonde A
 * du design jugé du 2026-09-01, promue en test. 36 occurrences sur 10 sites, deux racines (99 sur 18 à
 * l'ouverture de la vague ; L-1659-2 en a soldé 72 et L-1659-3 les 11 dernières, cf. ci-dessous).
 * `exclu` = ce site n'est PAS une paire de bornes, et la chaîne dit pourquoi. Le stock a seulement
 * des EXCLUS : plus une seule paire de bornes du dépôt ne s'écrit en tuple. Ce qui reste ici est donc
 * un inventaire de VIGIE — il n'a plus à décroître, il a à ne pas REPOUSSER.
 * SOLDÉ par #1659 L-1659-2 (2026-09-01) : les 72 disponibilités saisonnières — `sea-cargo.json ›
 * cargoes[].avail.{4 saisons}` (44) et `land-cargo.json` (28) — sont des FOURCHETTES `{min, max}` que
 * `findTableEntryIndex` lit, et dont les 8 colonnes couvrent le d100 sous refine de def.
 * SOLDÉ par #1659 L-1659-3 (2026-09-01) : les 7 `ship-construction.json › standard[].lengthM` (dont
 * la bande FINALE OUVERTE, MDG 12 l.129 « 81+ » — le plafond `130` qu'inventait la donnée est mort)
 * et les 4 `stars.json › [].sub` (1d10 de l'Étoile du Sorcier, ADE II 03 l.63) : `findTableEntry` les
 * lit telles quelles, sans adaptateur au call-site.
 * HORS COMPTE, dit ici pour qu'il ne se croie pas oublié : `defs/progression-schemas-derived.ts:29`
 * `teinte` est un 3-TUPLE (une couleur), pas une paire — et il vit dans un schéma, pas en donnée.
 */
const TUPLES_STOCK: Record<string, { n: number; exclu?: string }> = {
  'qualities.json::[].capabilities.fumbleDigits': {
    n: 1,
    exclu: 'ENSEMBLE de chiffres de Maladresse (`[8, 9]`), pas une bande : l’UNION est lue chiffre par chiffre (`src/engine/qualities/dispatch.ts:232`), et le schéma la déclare `z.array(z.number())`.',
  },
  'structureAppearance.json::[].door.herse.traverseFracs': {
    n: 1,
    exclu: 'positions FRACTIONNAIRES des traverses d’une herse (`[0.4, 0.78]`) : deux points, pas deux bornes — `z.array` dans `defs/structureAppearance.ts`.',
  },
  'materials.json::[].detail.courses.blockWM': { n: 3, exclu: EXCLU_RECETTE },
  'materials.json::[].detail.speckle.rM': { n: 1, exclu: EXCLU_RECETTE },
  'materials.json::[].detail.tufts.hM': { n: 1, exclu: EXCLU_RECETTE },
  'terrains.json::[].detail.courses.blockWM': { n: 6, exclu: EXCLU_RECETTE },
  'terrains.json::[].detail.speckle.rM': { n: 13, exclu: EXCLU_RECETTE },
  'terrains.json::[].detail.tufts.hM': { n: 1, exclu: EXCLU_RECETTE },
  'structureAppearance.json::[].detail.courses.blockWM': { n: 6, exclu: EXCLU_RECETTE },
  'structureAppearance.json::[].detail.speckle.rM': { n: 3, exclu: EXCLU_RECETTE },
};

const M = mesurer();

describe('deux bornes : une seule graphie, et rien d’emboîté (#1463 L4, vague `plage`)', () => {
  it('A — la marche couvre les DEUX racines de donnée (sinon l’affirmation « dans la donnée » ment)', () => {
    // `src/scenes` ne porte AUCUNE borne aujourd'hui (mesuré 2026-08-31) : les assertions ci-dessous
    // y verrouillent donc le vide. Sans ce compte, ramener la marche à la seule racine `src/data` ne
    // ferait rougir aucun test — la sonde revendiquerait une couverture qu'elle n'a plus.
    const lues = Object.entries(M.documentsParRacine).filter(([, n]) => n > 0).map(([r]) => r).sort();
    expect(
      lues,
      'la marche ne lit plus les DEUX racines de donnée : une graphie de bornes posée dans un document de scène échapperait à tout ce que ce fichier affirme.',
    ).toEqual(['src/data', 'src/scenes']);
  });

  it('A — la SEULE paire de bornes nommée dans la donnée est `min,max`', () => {
    expect(
      Object.keys(M.paires).sort(),
      'une graphie CONCURRENTE de `min,max` est apparue (from/to, de/a, low/high…) : une fourchette s’écrit `{min, max}` — c’est la forme que `findTableEntry` (`src/engine/tables.ts`) lit.',
    ).toEqual(['min,max']);
    expect(M.paires['min,max'], 'la population à deux bornes a disparu : la sonde ne mesure plus rien.').toBeGreaterThan(1400);
  });

  it('A — ce qui reste encodé par la BORNE HAUTE SEULE est INVENTORIÉ : les rangs maximaux de `talents.json`, et rien d’autre', () => {
    // Un RANG maximal n'est PAS une fourchette : `talents.json › max` est le nombre de fois qu'un
    // Talent peut être pris (`null` = sans limite, `{bonusOf}` = un Bonus de Caractéristique).
    // Aucun d100 ne le traverse — il n'a pas de borne basse à porter.
    expect(
      [...new Set(M.borneHauteSeule.map((s) => `${s.doc}${s.chemin}`))].sort(),
      'un document encode ENCORE une table par sa seule borne haute — sa borne basse serait reconstruite par POSITION, donc ni authorée ni éditable, et son lookup ordre-dépendant (cf. `weather.json`/`advancementCosts.json`, migrés le 2026-08-31).',
    ).toEqual(['talents.json[]', 'talents.json[].variants[]']);
  });

  it('E — les bandes OUVERTES (`max: null`) sont NOMMÉES, une par document', () => {
    // La divergence que `plageOuverteSchema` (`grammaire/valeurs.ts`) porte, et les TROIS endroits où
    // un livre l'écrit : `LDB 07 l.49` ne pose aucun plafond au nombre d'Augmentations, la bande
    // « 71 et + » (l.70) n'a donc pas de borne haute ; `MDG 15 l.383` imprime « 4 ou plus » à la
    // dernière bande du Prix d'offre ; `MDG 12 l.129` imprime « 81+ » à la dernière taille de coque
    // (#1659 L-1659-3 — la donnée y écrivait un plafond `130` absent de la l.129). JSON n'a
    // pas d'Infinity — c'est le lookup qui ouvre, et il est UN pour les trois (`tableOuverte`,
    // `src/engine/tables.ts`).
    // Si une QUATRIÈME population s'ouvrait sans revue, le nœud ouvert cesserait d'être l'exception
    // mesurée qu'il dit être.
    expect(
      [...new Set(M.bandesOuvertes.map((s) => `${s.doc}${s.chemin}`))].sort(),
      'une bande à borne haute OUVERTE (`max: null`) est apparue ailleurs : `plageOuverteSchema` est le nœud d’une EXCEPTION nommée, pas la forme générale d’une fourchette.',
    ).toEqual(['advancementCosts.json[]', 'sea-cargo.json.sell.offerPrice[]', 'ship-construction.json.standard[].lengthM']);
    expect(M.bandesOuvertes.length, 'une bande ouverte a disparu : la sonde ne mesure plus ce qu’elle nomme.').toBe(3);
  });

  it('F — les paires de bornes en TUPLE sont un STOCK NOMINATIF DÉCROISSANT, et ce qui n’en est pas est EXCLU NOMMÉMENT', () => {
    const observe = Object.fromEntries(Object.entries(M.tuples).sort());
    const attendu = Object.fromEntries(Object.entries(TUPLES_STOCK).map(([site, l]) => [site, l.n]).sort());
    expect(
      observe,
      'le stock des TUPLES a déphasé : un site en trop côté observé est une paire de bornes NEUVE écrite `[min, max]` (elle s’écrit `{min, max}`, la forme que `findTableEntry` lit) ; un site en trop côté stock est MIGRÉ — sa ligne se retire ICI, elle ne se laisse pas traîner.',
    ).toEqual(attendu);

    const total = Object.values(M.tuples).reduce((s, n) => s + n, 0);
    // 16 → 36 (#1690) : le plafond MONTE une fois, parce qu'un DOCUMENT entre dans les deux racines —
    // les 20 tuples de recette des 25 sols existaient déjà, écrits en modules TS que la mesure ne
    // voyait pas. Aucun n'est une paire de bornes ; le stock reprend sa décroissance depuis 36.
    expect(total, 'stock des tuples en HAUSSE : la liste ne fait que décroître (#1659).').toBeLessThanOrEqual(36);

    // Le stock a DEUX populations, et le cardinal de chacune se mesure sur le RÉSULTAT — le mot
    // « exclu » ne solde rien : une exclusion porte SA raison. La population À MIGRER est VIDE depuis
    // #1659 L-1659-3 : aucune paire de bornes du dépôt ne s'écrit plus en tuple, et un site qui
    // reparaîtrait ici sans raison écrite ferait rougir la comparaison nominative ci-dessus.
    const exclus = Object.entries(TUPLES_STOCK).filter(([, l]) => l.exclu);
    const cibles = Object.entries(TUPLES_STOCK).filter(([, l]) => !l.exclu);
    // 16 → 36 (#1690) : les 20 tuples de recette des 25 sols ENTRENT dans la mesure — ils existaient
    // déjà, écrits dans 25 modules TS que les deux racines de documents ne voyaient pas. Même classe
    // que les 16 autres : paramètres géométriques d'une recette de rendu, lus POSITIONNELLEMENT.
    expect(exclus.reduce((s, [, l]) => s + l.n, 0), 'le compte des tuples EXCLUS a bougé sans qu’une raison soit dite.').toBe(36);
    // 8 → 7 sites (#1686 lot 2) : les 4 sites de recette de `reliefMaterials.json`/`roofMaterials.json`
    // deviennent 3 sites de `materials.json` — les 16 occurrences, elles, ne bougent pas.
    // 7 → 10 sites (#1690) : les 3 sites de recette de `terrains.json`.
    expect(exclus.length).toBe(10);
    expect(cibles.reduce((s, [, l]) => s + l.n, 0), 'un tuple À MIGRER est réapparu : la population est soldée depuis #1659 L-1659-3.').toBe(0);
    expect(cibles.length).toBe(0);
    expect(
      exclus.filter(([, l]) => !l.exclu?.trim()).map(([s]) => s),
      'un site EXCLU sans raison écrite : une exclusion se motive, sinon c’est un angle mort déguisé.',
    ).toEqual([]);
  });

  it('A — `rand` (borne haute d100 portée par l’ENTITÉ) est un RESTE NOMMÉ, borné à six documents', () => {
    // Reste ANCRÉ au pilotage de #1463 : sa cible est un document TABLE dédié (DESIGN v2 S1), donc
    // il appartient à la vague `reference`/`pick,table` — pas à celle-ci. Ce qu'on verrouille ici,
    // c'est son PÉRIMÈTRE : il ne doit pas s'étendre à un septième document en attendant.
    expect(
      Object.keys(M.rand).sort(),
      '`rand` a gagné un document : la borne haute portée par l’entité ne s’étend pas — sa cible est un document TABLE dédié (#1463 S1).',
    ).toEqual(['astrology.json', 'eyes.json', 'hairs.json', 'species.json', 'stars.json', 'talents.json']);
  });

  it('B — les bornes d’un RÉGLAGE et celles d’un TIRAGE sont DISJOINTES', () => {
    // Discriminant STRUCTUREL, celui que le lexique déclare (`bornes.coPresence`) : une borne de
    // réglage vit avec sa valeur par défaut ou son pas. Mesuré 2026-08-31 : `kind` seul ne
    // discrimine pas (`oups.json` et `sea-events.json` le portent aussi).
    const estBorne = (s: Site) => s.cles.includes('default') || s.cles.includes('step');
    const bornes = M.deuxBornes.filter(estBorne);
    const tirages = M.deuxBornes.filter((s) => !estBorne(s));
    expect(
      [...new Set(bornes.map((s) => s.doc))],
      'les bornes de DOMAINE d’un réglage ne vivent que dans `reglesOptionnelles.json` : ailleurs, `min,max` est une plage de TIRAGE.',
    ).toEqual(['reglesOptionnelles.json']);
    expect(bornes.length, 'la population des bornes de réglage a disparu : la sonde ne mesure plus rien.').toBeGreaterThan(0);
    expect(
      tirages.filter((s) => s.doc === 'reglesOptionnelles.json'),
      'un réglage porte `min,max` SANS `default` ni `step` : il serait classé plage de tirage (`bornes` passe AVANT `plage` dans le lexique, mais sa co-présence n’est plus vérifiée).',
    ).toEqual([]);
    expect(bornes.filter((b) => tirages.includes(b)), 'intersection non vide entre bornes et tirages.').toEqual([]);
  });

  it('C — la fourchette EMBOÎTÉE `{range: {min, max}}` n’existe NULLE PART', () => {
    // La cible que le lexique déclarait avant le 2026-08-31 (« portée par `range` », #1463 S1) :
    // 0 objet la portait. La cible retenue est la fourchette PLATE, celle que `findTableEntry` lit.
    expect(
      M.emboites,
      'un objet emboîte sa fourchette sous `range` : `findTableEntry` (`src/engine/tables.ts`) lit la forme PLATE `{min, max}` — emboîter fork le lookup partagé.',
    ).toEqual([]);
  });

  it('D — l’en-tête de `STRUCTURES_ORPHELINES` dit ce que le stock MESURE', () => {
    const parMotif: Record<string, { lignes: number; occurrences: number }> = {};
    for (const o of STRUCTURES_ORPHELINES) {
      const v = (parMotif[o.motif] ??= { lignes: 0, occurrences: 0 });
      v.lignes += 1;
      v.occurrences += o.occurrences;
    }
    expect(
      Object.keys(parMotif).sort(),
      'les motifs des orphelines ne sont plus les deux que l’en-tête du stock décrit.',
    ).toEqual(['clé réservée', 'identité non résolue']);
    expect(
      parMotif['clé de référence non résolue'],
      'la branche `clé de référence non résolue` (la SEULE que la prose décrivait) s’est peuplée : l’en-tête doit alors la décrire pour de bon.',
    ).toBeUndefined();

    // Le déclencheur `source` : ce que le motif `clé réservée` nomme vraiment — un NOM de clé
    // réservé au lexique, sur un objet dont le CONTENU est légitime (une vraie référence de livre).
    const parSource = STRUCTURES_ORPHELINES.filter((o) => o.signature.split(',').includes('source'));

    // La répartition est un compte DÉRIVÉ du stock : elle ne se recopie pas en littéral ici (un
    // littéral recopié dérive du jour où une ligne de stock bouge, et c'est ce qui l'a fait rougir).
    // Ce qui se vérifie est que l'EN-TÊTE du stock cite les comptes que le stock MESURE — et il se
    // vérifie en CO-OCCURRENCE : un compte cherché ISOLÉ se retrouve par HASARD ailleurs dans la
    // prose, et la dérive passe alors en silence. Mesuré sur cet en-tête même (2026-09-01) : `95`
    // dérivant vers `205` (le dénominateur de `L1b #1467`, cité plus bas) et `2` dérivant vers `1`
    // (le `1` de `L1a #1466` répond au motif) restaient VERTS. Le fragment exige donc le compte AVEC
    // ce qu'il compte.
    const cr = parMotif['clé réservée'];
    const identite = parMotif['identité non résolue'];
    const fragments = [
      `\`clé réservée\` ${cr.lignes} lignes / ${cr.occurrences} occurrences`,
      `\`identité non résolue\` ${identite.lignes} / ${identite.occurrences}`,
      `\`source\` à lui seul déclenche ${parSource.length} des ${cr.lignes} lignes (${parSource.reduce((s, o) => s + o.occurrences, 0)} occurrences)`,
      `Les ${STRUCTURES_ORPHELINES.length} lignes de ce volet`,
    ];
    // L'en-tête est un bloc de commentaire : on le remet À PLAT (marqueurs de continuation retirés,
    // blancs réduits) — sinon un fragment ne franchirait pas un retour à la ligne du JSDoc.
    const blocs = readFileSync(join(process.cwd(), 'scripts/guards/lib/structuresStock.mjs'), 'utf8')
      .split('export const STRUCTURES_ORPHELINES')[0]
      .split('/** Objet qui ANNONCE une référence');
    const entete = blocs[blocs.length - 1].replace(/^\s*\*\s?/gm, ' ').replace(/\s+/g, ' ');
    for (const fragment of fragments) {
      expect(
        entete,
        `l’en-tête des orphelines ne dit pas « ${fragment} » : le compte que le stock MESURE et la prose qui le NOMME ont déphasé.`,
      ).toContain(fragment);
    }
    expect(
      entete,
      'l’en-tête des orphelines réaffirme « la valeur pointe vers rien » — mesuré FAUX pour les 96 lignes `clé réservée` : le déclencheur est le NOM de la clé, pas la valeur.',
    ).not.toContain('la valeur pointe vers rien');
  });
});
