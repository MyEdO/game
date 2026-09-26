import { describe, it, expect } from 'vitest';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import {
  EXCUSE_GUARD_ACTIVE,
  POISON_DIRS,
  POISON_EXTS,
  tombstonesIn,
  scanTombstones,
  untaggedExcuseMatch,
  scanExcuses,
  legacyVocabIn,
  scanLegacyVocab,
  scanRawClaims,
  scanDecisionClaims,
  extractComments,
  matchLine,
  excerptAt,
  loadDecisionsBaseline,
  matchesBaselineEntry,
  partitionBaseline,
  formatBaselineReport,
  DECISIONS_BASELINE_PATH,
  type BaselineEntry,
} from '../scripts/guards/lib/commentPoison.mjs';
import { LEGACY_VOCAB_SITES } from '../scripts/guards/lib/legacyVocabStock.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';

/**
 * EN-TÊTE STRUCTURÉ de la garde (#1475).
 */
const GARDE = {
  question:
    'A — quel COMMENTAIRE du dépôt porte du poison (CLAUDE.md règle 6, credo règle 1) : excuse sans tag, ' +
    'pierre tombale, revendication d’autorité, vocabulaire de l’ANCIEN ÉTAT ? ' +
    'B — pour la seule famille (e), le stock NOMINATIF DATÉ des sites restants, nommés par fichier + ancre. ' +
    'C — chaque ligne du stock porte le LOT qui l’éteint (#1486) et part avec lui ; les familles excuse et ' +
    'tombale n’ont AUCUN stock (tolérance zéro : le site se reformule dans le geste).',
  primitive:
    '`extractComments` + `scanTombstones`/`scanExcuses`/`scanLegacyVocab`/`scanDecisionClaims` ' +
    '(`scripts/guards/lib/commentPoison.mjs`), sur le corpus de `readCorpus` ' +
    '(`scripts/guards/lib/sourceCorpus.mjs`, #1462) — plus aucun parcours de dossiers local.',
  perimetre:
    '`src/**` + `scripts/**`, extensions `.ts`, `.tsx`, `.mts`, `.mjs`. Familles excuse, tombale et (e) : TESTS ' +
    'INCLUS (le poison écrit dans un test est du poison). ' +
    'Cliquet des revendications d’autorité : les tests de `src/**`.',
  angleMort: [
    'Les commentaires HTML/JSX (`<!-- … -->`, `{/* … */}` hors TS), les `.css` et les `.md` ne sont pas scannés (#593).',
    'Un énoncé de règle qui n’emploie AUCUN mot des familles passe : la garde mesure un vocabulaire, pas une intention.',
    'Une occurrence en CHAÎNE est invisible par construction (`extractComments` ne lit que les commentaires) — dont ' +
      'les DONNÉES d’une garde : `scripts/guards/lib/labelLogic.mjs` porte un site de #1486 dans une valeur de `RATCHET_EXCEPTIONS`.',
    'Le cliquet des revendications d’autorité ne couvre que les tests de `src/**` : un test de `scripts/**` y échappe — ' +
      '12 sites mesurés le 2026-08-23 dans `scripts/**` (dont `structures-lexique.mts`, `registryIdBranch.mjs`, les ateliers `*.dessin.mts`) ne sont vus par AUCUN canal.',
    'La famille (e) ne mesure QUE le code de production : 17 sites vivent dans des tests le 2026-08-23, dont une dette ' +
      'gelée réelle (`src/gameIso/rig/parts/tenues/jambes-gabarit-ratchet.test.ts:14`, `JAMBE_LEGACY`).',
    'Motifs NON couverts par la famille (e), mesurés le 2026-08-23 : « obsolescence », « hérité », « transitoire », ' +
      '« provisoire », « compatibilité ascendante » — aucun n’est détecté.',
    'Les motifs « fin du/de la <nom> » et « était <participe> » restent HORS des familles : mesurés le 2026-08-23 à ' +
      '71 et 2 commentaires, pour respectivement 1/10 et 0/2 vraies tombales dans l’échantillon — leur entrée coûterait plus de faux positifs que de sites.',
    'La cessation devant un artefact BACK-TICKÉ (« plus de `poisonResistValue` ici ») reste HORS de la famille ' +
      'tombale : mesurée le 2026-09-05 à 48 commentaires de `src/**`+`scripts/**`, en majorité des prédicats VIVANTS ' +
      '(« une entrée portant déjà `id` et plus de `key` », « le nœud scellé n’expose plus de `.shape` ») — seule la ' +
      'NATURE révolue (« n’est plus du code ») y entre, à 1 site mesuré.',
    'Le SITE quitté n’est mesuré que devant l’adverbe de PROXIMITÉ : l’adverbe de DISTANCE reste HORS de la ' +
      'famille tombale — 5 sites mesurés le 2026-09-05 (`src/state/partyFlow.ts:767`, `src/state/combat/triggeredTest.ts:375`, ' +
      '`src/state/poste-ammo.test.ts:159`, `src/gameIso/stage/entree-en-scene-demontage.test.tsx:12`, ' +
      '`src/gameIso/backends/webgl/cacheBorne.ts:149`), tous une absence À L’EXÉCUTION, aucun une tombale.',
    'Le DÉPART au passé composé n’est mesuré que collé à un artefact BACK-TICKÉ : sans lui, la forme reste HORS de la ' +
      'famille tombale — 13 commentaires mesurés le 2026-09-22 dans `src/**`+`scripts/**` après purge, dont aucun ne ' +
      'raconte l’histoire du code : 11 un départ À L’EXÉCUTION (un combattant hors de la rencontre, une arme hors de ' +
      'l’inventaire, un corps hors du canevas), 2 un moment de GARDE (`scripts/docs/build-registre-jets.mjs`, ' +
      '`scripts/guards/lib/stocksNominatifs.mjs`). L’angle mort est RÉEL : le même relevé (#1343) a réécrit À LA MAIN ' +
      '9 tombales de cette forme SANS artefact back-tické (`GameStage3D.test.tsx`, `spritePicker.ts`, ' +
      '`keybindings.test.ts`, `marques-parite.test.tsx`, `combatFlow-los.test.ts`, `progression-schemas.test.ts`, ' +
      '`cascade-consequence-guard.test.ts` ×2, `editeur-monde-volumique.test.tsx`) — la suivante de cette forme ' +
      '(« la couche monde a quitté le SVG ») passe la garde. Le démonstratif en complément (« ce compte ») ' +
      'reste hors famille pour la même raison : il ne distingue pas le code du jeu. Le verbe de victoire (« l’a ' +
      'emporté ») : 4 sites, tous du vocabulaire de JEU.',
  ],
  baseline: {
    fichier: 'scripts/guards/lib/legacyVocabStock.mjs',
    decroissant: true,
    raison:
      'Le stock est le dénominateur des COMMENTAIRES de #1486 (credo règle 1) : chaque ligne se solde par la mort du site ' +
      'dans le commit de son lot. Il ne couvre PAS les sites de #1486 portés par du CODE — identifiants et chaînes : ' +
      '`charKeyLegacy.mjs`, `LEGACY_KEY` (`saves.ts`), `labelLogic.mjs:874`, ' +
      '`scripts/agents/compat-core.mjs` — invisibles à `extractComments` par construction : ceux-là meurent avec leurs lots, ' +
      'listés au ticket, jamais par cette garde. Une ligne neuve est une dérive, jamais une exception à inscrire — seul le ' +
      'tag `[entériné AAAA-MM-JJ]` de l’utilisateur soustrait un commentaire à la famille.',
  },
  ticket: '#1486',
} as const;

/** Ensemble FERMÉ des lots de #1486 (relevé au ticket le 2026-08-23, étendu le 2026-09-26 par le lot
 *  `L7` : #1486 #1509) : le `lot` d’une ligne de stock
 *  est un ou plusieurs de ces jetons séparés par ` / `. Aucun placeholder n’est admis. */
const LOTS_1486 = [
  'L1b #1467',
  'L1c #1468',
  'L2',
  'L3',
  'L4',
  'L5',
  'L6',
  '#1473',
  '#1474',
  'chantier rig',
  'lot rendu',
  'L7 désormais',
] as const;

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)
// #828 : les gardes sont soumises à la règle qu'elles font respecter — la mécanique de détection est
// scannée par elle-même. Un détecteur qui doit citer un motif le plante en LITTÉRAL DE CHAÎNE ici
// (jamais lu par `extractComments`), il ne l'écrit pas dans sa prose.
const CORPUS = readCorpus([...POISON_DIRS], { exts: [...POISON_EXTS], tests: true });
/** Fichiers de test de `src/**` : périmètre du cliquet famille 4. */
const TESTS_SRC = CORPUS.filter((f) => estSuiteVitest(f.rel) && f.rel.startsWith('src/'));

describe('garde-fou commentaires — en-tête structuré (#1475)', () => {
  it('la garde se déclare : question A→B→C, primitive, périmètre, angles morts, baseline décroissante, ticket', () => {
    expect(GARDE.question).toMatch(/A —.*B —.*C —/s);
    expect(GARDE.primitive).toContain('sourceCorpus.mjs');
    expect(GARDE.perimetre, 'le périmètre doit NOMMER les deux racines scannées.').toMatch(/src\/\*\*.*scripts\/\*\*/s);
    expect(GARDE.angleMort.length).toBeGreaterThanOrEqual(4);
    expect(GARDE.baseline).toMatchObject({ fichier: 'scripts/guards/lib/legacyVocabStock.mjs', decroissant: true });
    expect(GARDE.ticket).toBe('#1486');
  });

  it('le corpus scanné couvre bien les DEUX racines et les quatre extensions (preuve de câblage)', () => {
    const exts = new Set(CORPUS.map((f) => f.rel.slice(f.rel.lastIndexOf('.'))));
    expect([...exts].sort()).toEqual(['.mjs', '.mts', '.ts', '.tsx']);
    expect(CORPUS.some((f) => f.rel.startsWith('src/'))).toBe(true);
    expect(CORPUS.some((f) => f.rel.startsWith('scripts/') && !f.rel.startsWith('scripts/guards/lib/'))).toBe(true);
    expect(TESTS_SRC.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Famille 1 — PIERRE TOMBALE (CLAUDE.md règle 6c). Tolérance ZÉRO, pas d'exception.
// Familles de regex + `tombstonesIn` : `scripts/guards/lib/commentPoison.mjs` (mécanique partagée).
// ---------------------------------------------------------------------------------------------

describe('balayage — un `/` de CODE ne fait jamais disparaître le commentaire qui suit', () => {
  // Le balayage doit distinguer le littéral de REGEX (dont les guillemets ne sont pas des chaînes)
  // de la division et de la fermeture JSX. Rater la distinction rend MUET tout ce qui suit dans le
  // fichier — mesuré sur `scripts/hooks/solde-ticket-guard.mjs` : 2 commentaires vus sur 1 902 lignes.
  const TEMOIN = 'TEMOIN' + '_DE_QUEUE';
  const vu = (code: string) => extractComments(code).some((c) => c.text.includes(TEMOIN));

  it('DIVISION et post-incrément : le commentaire de queue reste vu', () => {
    expect(vu('const q = a / b; // ' + TEMOIN)).toBe(true);
    expect(vu('const v = (a + b) / 2; // ' + TEMOIN)).toBe(true);
    expect(vu('const q = a++ / 2; // ' + TEMOIN)).toBe(true);
    expect(vu('const q = a-- / 2; // ' + TEMOIN)).toBe(true);
  });

  it('JSX auto-fermant : `/>` n’ouvre pas de regex, même précédé d’une accolade fermante', () => {
    expect(vu('const el = <F attr={x} />; // ' + TEMOIN)).toBe(true);
    expect(vu('const el = <F />; // ' + TEMOIN)).toBe(true);
  });

  it('REGEX : ses guillemets ne sont pas des chaînes, et la suite du fichier reste lisible', () => {
    expect(vu('const re = /("[^"]*")/; // ' + TEMOIN)).toBe(true);
    expect(vu('return /x/.test(s); // ' + TEMOIN)).toBe(true);
    expect(vu('const x = c ? /a/ : /b/; // ' + TEMOIN)).toBe(true);
    expect(vu('const re = /[/]/; // ' + TEMOIN)).toBe(true);
  });

  it('CHAÎNE et gabarit : un `/` entre guillemets n’ouvre rien', () => {
    expect(vu('const s = "a/b"; // ' + TEMOIN)).toBe(true);
    expect(vu('const t = `a/${b}/c`; // ' + TEMOIN)).toBe(true);
  });
});

describe('garde-fou commentaires — pierres tombales (#136, CLAUDE.md règle 6c)', () => {
  it('cas planté : un rappel d\'ancien emplacement est détecté (preuve TDD)', () => {
    const planted = "// Cette logique vit ici anciennement dans un autre module.";
    expect(tombstonesIn(planted)).toContain('anciennement');
  });

  it('cas planté : "déplacé(e) vers/dans" est détecté même au féminin/pluriel (preuve TDD)', () => {
    expect(tombstonesIn('// Fonction déplacée vers state/foo.ts').length).toBeGreaterThan(0);
    expect(tombstonesIn('// Fonctions déplacées dans state/foo.ts').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "déplacé dans la boîte" (a11y, pas du code — affinage #136)', () => {
    expect(tombstonesIn('// focus déplacé dans la boîte à l\'ouverture.')).toEqual([]);
  });

  it('cas planté : "l\'ancien X a été supprimé" est détecté (preuve TDD affinage #136)', () => {
    expect(tombstonesIn("// L'ancien registre `FOO_BY_LABEL` a été supprimé.").length).toBeGreaterThan(0);
    expect(tombstonesIn('// Le marqueur `(2M)` a été supprimé.').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "une PA/ration a été retirée" (vocabulaire de jeu — affinage #136)', () => {
    expect(tombstonesIn('// RETOURNE true si une PA a été retirée.')).toEqual([]);
    expect(tombstonesIn("// Une ration a été retirée de l'inventaire.")).toEqual([]);
  });

  it('cas planté : "comme avant :" et "avant : «X»" sont détectés (preuve TDD affinage #136)', () => {
    expect(tombstonesIn('// ignorées (comme avant : un libellé non catalogué n\'était pas trouvé).').length).toBeGreaterThan(0);
    expect(tombstonesIn('// doit ouvrir la modale (avant : « hors de portée »)').length).toBeGreaterThan(0);
  });

  it('faux positif écarté : "avant" de façade/rendu/entraînement (affinage #136)', () => {
    expect(tombstonesIn("// Cadre d'avant : ARC VU DE CHANT.")).toEqual([]);
    expect(tombstonesIn("// vue de dos (plan avant : couvre le dos, plis)")).toEqual([]);
    expect(tombstonesIn("// qui pointe vers l'avant : sinon de profil la jambe est un poteau nu.")).toEqual([]);
    expect(tombstonesIn('// Espèces mises en avant : celles du Livre de base.')).toEqual([]);
    expect(tombstonesIn('// avant : Esquive pénalisée')).toEqual([]);
    expect(tombstonesIn("// avant : pas d'arme à 2 mains")).toEqual([]);
  });

  it('cas planté : `ex-` nomme un artefact révolu QUELLE QUE SOIT la casse (#828)', () => {
    expect(tombstonesIn("// Mêmes teintes que l'ex-houseWallIso.")).toContain('ex-Nom');
    expect(tombstonesIn("// Reprend la logique de l'ex-mode manœuvre.")).toContain('ex-Nom');
    expect(tombstonesIn('// Promu ici (ex-dupliqué à l’identique dans `qualities.ts`).')).toContain('ex-Nom');
    expect(tombstonesIn("// Ombrée comme l'ex-riser (×0.82).")).toContain('ex-Nom');
    expect(tombstonesIn('// Reprend les champs de l’ex-table PROPS.')).toContain('ex-Nom');
  });

  it('faux positifs écartés : « ex aequo » (locution latine) et tout `ex` NON préfixé (#828)', () => {
    expect(tombstonesIn("// l'ex-aequo de frontière de secteur arrondit au cran horaire suivant.")).toEqual([]);
    expect(tombstonesIn('// Navigation codex-liée : chips vers la fiche.')).toEqual([]);
    expect(tombstonesIn('// index-based : la position dans le tableau fait foi.')).toEqual([]);
  });

  it('cas planté : « l’ancien chemin » désigne du code que le lecteur ne peut plus ouvrir (#828)', () => {
    expect(tombstonesIn("// parité RNG avec l'ancien chemin inline.")).toContain("l'ancien chemin (code disparu)");
    expect(tombstonesIn('// EXACTEMENT le calcul de l’ancien chemin inline.')).toContain("l'ancien chemin (code disparu)");
  });

  it('faux positif écarté : un ancien FORMAT existe encore sur disque (migration — #828)', () => {
    expect(tombstonesIn("// v3 → v4 : les sauvegardes à l'ancien format sont converties au chargement.")).toEqual([]);
    expect(tombstonesIn("// Assainit un document authoré à l'ancien schéma (entrées `null`).")).toEqual([]);
  });

  it('cas planté : « remplace l’ancien X » ne dit que ce qui n’existe plus (#828)', () => {
    expect(tombstonesIn("// Remplace l'ancien marqueur d'affichage `(2M)` re-parsé par regex.")).toContain(
      "remplace l'ancien X",
    );
    expect(tombstonesIn('// Événements STRUCTURÉS — remplacent l’ancien journal en chaînes.')).toContain(
      "remplace l'ancien X",
    );
  });

  it('cas planté : un artefact révolu NOMMÉ entre parenthèses est une tombale (#948)', () => {
    const L = 'ancien X (parenthésé — artefact disparu)';
    expect(tombstonesIn('// rien à forcer sans jet (ancien `force.guard : !!p.result`)')).toContain(L);
    expect(tombstonesIn('// `moveScale` (ancien movementHalved), `maxWeaponHands` (ancien noTwoHanded)')).toContain(L);
    expect(tombstonesIn('// 2 cases (ancien TILES_PER_LEVEL)')).toContain(L);
    expect(tombstonesIn('// repli si l’événement ne la porte pas (anciens chemins).')).toContain(L);
    expect(tombstonesIn('// 0 = aplat plasticky (ancienne rampe).')).toContain(L);
    expect(tombstonesIn('// Rendu par le registre (anciennement un emoji brut).')).toContain(L);
  });

  it('faux positifs écartés : le qualificatif HORS parenthèse porte souvent une donnée vivante (#948)', () => {
    expect(tombstonesIn("// v3 → v4 : les sauvegardes à l'ancien format sont converties au chargement.")).toEqual([]);
    expect(tombstonesIn('// Le propriétaire précédent du bien reste inscrit au registre de la ville.')).toEqual([]);
    expect(tombstonesIn('// Rachat par l’ancien maître d’armes de la compagnie (PNJ).')).toEqual([]);
  });

  it('cas planté : un identifiant de code qualifié de révolu et CLÔTURANT la ligne est une tombale (#1686)', () => {
    const L = 'ancien <identifiant> en fin de ligne (artefact disparu)';
    expect(tombstonesIn('// ancien stone-dark')).toContain(L);
    expect(tombstonesIn('const x = 1; // ancien earth-foot-dark')).toContain(L);
    expect(tombstonesIn('// teinte de pied — ancien `sol-inconnu`')).toContain(L);
    expect(tombstonesIn('/* ancien wallOnSight */')).toContain(L);
    expect(tombstonesIn('// ancienne houseWallIso')).toContain(L);
    expect(tombstonesIn('// anciens riser_foot')).toContain(L);
    expect(tombstonesIn('// ancien floorsSvg.ts')).toContain(L);
  });

  it('faux positifs écartés : la ligne CONTINUE après le mot, ou la cible n’est pas du code (#1686)', () => {
    expect(tombstonesIn("// v3 → v4 : les sauvegardes à l'ancien format sont converties au chargement.")).toEqual([]);
    expect(tombstonesIn("// Assainit un document authoré à l'ancien schéma (entrées `null`).")).toEqual([]);
    expect(tombstonesIn('// Le propriétaire précédent du bien reste inscrit au registre de la ville.')).toEqual([]);
    expect(tombstonesIn('// Rachat par l’ancien maître d’armes')).toEqual([]);
    expect(tombstonesIn('// une commande passée à l’ancien comptoir')).toEqual([]);
  });

  it('cas planté : la négation TEMPORELLE devant un artefact de code est une tombale (#136, 2026-07-30)', () => {
    const L = 'négation temporelle + artefact de code (état révolu)';
    expect(tombstonesIn("// La Résistance à l'Empoisonné n'a PLUS d'entrée propre : l'étape est générique.")).toContain(L);
    expect(tombstonesIn('// Le déplacement et l’attaque n’ont plus de mode : ils sont implicites au clic.')).toContain(L);
    expect(tombstonesIn('// La Corruption N’A PLUS d’ancre : c’est une jauge de la bande Constitution.')).toContain(L);
    expect(tombstonesIn("// Et l'entrée absente n'a plus de repli deviné — elle est bruyante.")).toContain(L);
    // La coupure de ligne ne met pas la tombale hors de portée (bloc `*` comme suite de `//`).
    expect(tombstonesIn("/** l'issue de modale n'a plus de\n *  repli FALLBACK. */")).toContain(L);
    expect(tombstonesIn("// l'attaque n'ont PLUS de\n // mode : implicite au clic.")).toContain(L);
  });

  it('faux positifs écartés : la simple absence AU PRÉSENT, et les ressources de JEU épuisées (2026-07-30)', () => {
    expect(tombstonesIn("// une qualité qui n'a pas d'entrée dans le registre est ignorée.")).toEqual([]);
    expect(tombstonesIn("// si le héros n'a plus de créneau, la journée se clôt.")).toEqual([]);
    expect(tombstonesIn("// le poste n'a plus d'objet à livrer → un pas d'AFFICHAGE.")).toEqual([]);
    expect(tombstonesIn("// le navire n'a plus d'équipage en état de le défendre.")).toEqual([]);
    expect(tombstonesIn("// la cascade n'a plus de continuation → la journée suivante ne se ré-arme jamais.")).toEqual([]);
    expect(tombstonesIn("// n'a plus de modèle applicable : on retombe sur le gabarit générique.")).toEqual([]);
  });

  it('cas planté : l’ORIGINE révolue d’un module est une tombale (#1385)', () => {
    const L = 'extrait/migré de X (origine révolue du module)';
    expect(tombstonesIn(" * Extrait d'IsoStage tel quel (rendu inchangé).")).toContain(L);
    expect(tombstonesIn('// FX de combat (extraits de GameStage3D) : flottants typés.')).toContain(L);
    expect(tombstonesIn(' * Marche visuelle (extraite de useWalkAnim.ts) : le token glisse.')).toContain(L);
    expect(tombstonesIn(' * extrait de `IsoStage` pour le garder navigable')).toContain(L);
    // #1898 : la MIGRATION d'un module est la même origine révolue, et son chemin peut porter un dossier.
    expect(tombstonesIn('  // Caractéristiques (LDB) — migré de engine/types.ts (CHAR_LABELS).')).toContain(L);
    expect(tombstonesIn(' * libellés migrés de `combatFlow.ts` vers le catalogue')).toContain(L);
    expect(tombstonesIn('// Migrée de RollShell pour être partagée')).toContain(L);
    // Toutes les prépositions d'origine, et les cibles propres à la migration : dossier, glob, constante.
    expect(tombstonesIn(' * FX (extraits du `IsoStage.tsx` d’origine)')).toContain(L);
    expect(tombstonesIn('  /** Drapeaux de CAPACITÉ — migrés des `defs/` mécaniques, lus par id. */')).toContain(L);
    expect(tombstonesIn('  // ── MÉTADONNÉES (migrées depuis src/data/spellspecs/*.ts — migration #5)')).toContain(L);
    expect(tombstonesIn(' * enjeu de nuit, migré depuis `NIGHT_STAKES` en donnée app-owned')).toContain(L);
    // La migration se dit aussi par sa DESTINATION, et son origine peut porter « l'ancien(ne) ».
    expect(tombstonesIn(' * les métadonnées ont migré dans `SpellData` (spells.json)')).toContain(L);
    expect(tombstonesIn('// La bande résumée a migré vers `FigTile.zoneBadges`')).toContain(L);
    expect(tombstonesIn(" *  `SpellData` (les champs migrés de l'ancienne SpellSpec)")).toContain(L);
  });

  it('faux positifs écartés : l’extrait de SOURCE et le sens courant du mot (#1385)', () => {
    // Une citation RAW nomme un livre, pas un module : ses sigles ne portent aucune minuscule interne.
    expect(tombstonesIn('// extrait du chapitre LDB 13 sur les Talents')).toEqual([]);
    expect(tombstonesIn("// extrait d'ADE II, page 41 — verbatim")).toEqual([]);
    expect(tombstonesIn('// un extrait de texte est affiché dans la fiche')).toEqual([]);
    expect(tombstonesIn("// l'extrait de la prose est tronqué à 80 signes")).toEqual([]);
    expect(tombstonesIn('// extraits de sang et de bile (composants alchimiques)')).toEqual([]);
    // Une migration de DONNÉE nomme un format ou un lot, jamais un module.
    expect(tombstonesIn("// les 6 véhicules migrés (achat) portent prix + dispo")).toEqual([]);
    expect(tombstonesIn('// document migré de la version 3 du format de sauvegarde')).toEqual([]);
    expect(tombstonesIn('// le barème, migré du CODE en donnée, est édité au Codex')).toEqual([]);
    expect(tombstonesIn('// Sites migrés depuis un DÉ vers le jet opposé')).toEqual([]);
    expect(tombstonesIn('// un catalogue en dur est l’exception, il migre en donnée')).toEqual([]);
    expect(tombstonesIn('// les réglages migrés vers le catalogue restent éditables')).toEqual([]);
    // Une EXTRACTION peut être vivante : constante ou dossier back-tické décrivent ce que le code FAIT.
    expect(tombstonesIn('// ids extraits de `CHAR_KEYS` à chaque rendu')).toEqual([]);
    expect(tombstonesIn('// arêtes extraites des `walls/` du niveau chargé')).toEqual([]);
  });

  it('cas planté : le passé nostalgique nomme un état révolu, quel que soit son sujet (2026-07-30)', () => {
    expect(tombstonesIn('// DR maximum, plus le plancher 1 d’antan')).toContain('passé nostalgique (état révolu)');
    expect(tombstonesIn("// mêmes couleurs que la palette d'antan.")).toContain('passé nostalgique (état révolu)');
  });

  it('cas plantés : la NATURE révolue d’un site est une tombale (#1653, 2026-09-05)', () => {
    const L = 'n’est plus du code (nature révolue du site)';
    expect(tombstonesIn("// La Résistance à l'Empoisonné n'est PLUS du code moteur : elle vit en donnée.")).toContain(L);
    expect(tombstonesIn('// Ces deux résolveurs ne sont plus du code : le dispatcher les joue.')).toContain(L);
    expect(tombstonesIn("/** l'entretien n'est plus du\n *  code impératif. */")).toContain(L);
  });

  it('faux positifs écartés : le mot `code` au PRÉSENT et la quantité (2026-09-05)', () => {
    expect(tombstonesIn('// ce module n’est que du code pur : aucune donnée ne s’y cache.')).toEqual([]);
    expect(tombstonesIn('// le pion n’est plus du groupe du joueur après la capture.')).toEqual([]);
    expect(tombstonesIn('// le décodage n’accepte plus du texte libre : un id, ou rien.')).toEqual([]);
  });

  it('cas plantés : le SITE quitté est une tombale (#1686, 2026-09-05)', () => {
    const L = 'n’est / ne vit plus ici (site quitté)';
    expect(tombstonesIn('// Le FICHIER, lui, ne vit plus ici : il est DÉRIVÉ du def porteur.')).toContain(L);
    expect(tombstonesIn("// Les péripéties d'AUTEUR ne sont plus ici : chacune est SON étape de monde.")).toContain(L);
    expect(tombstonesIn('/** la conversion n’est plus\n *  ici : le résolveur la porte. */')).toContain(L);
  });

  it('cas plantés : le DÉPART d’un artefact back-tické est une tombale (#1343, 2026-09-22)', () => {
    const L = 'artefact back-tické parti (départ révolu)';
    expect(tombstonesIn('// `domeWard` a QUITTÉ `OPS_NON_TYPEES` : le Trait se nomme par `traitId`.')).toContain(L);
    expect(tombstonesIn('/** le manuscrit renvoyait à un fichier que `FLOW_VERBS` a quitté ; */')).toContain(L);
    expect(tombstonesIn('// l’op est TYPÉE ; elle a quitté\n  // `OPS_NON_TYPEES`.')).toContain(L);
    expect(tombstonesIn('// les sites `a` et `b` ont quittés le compte.')).toContain(L);
  });

  it('faux positifs écartés : le départ À L’EXÉCUTION, sans artefact back-tické (#1343, 2026-09-22)', () => {
    expect(tombstonesIn('// un slot référençant une arme qui a quitté l’inventaire est élagué.')).toEqual([]);
    expect(tombstonesIn('// le curseur a QUITTÉ l’étape défense orpheline')).toEqual([]);
    expect(tombstonesIn('// la marque de ceux qui ont quitté la manche (`tavernFlow`).')).toEqual([]);
    expect(tombstonesIn('// `quitterLaDefense` : le curseur quitte l’étape.')).toEqual([]);
  });

  it('faux positif écarté : l’adverbe de DISTANCE dit une absence à l’EXÉCUTION (2026-09-05)', () => {
    expect(tombstonesIn('// en ORPHELIN à sa résolution : son entrée n’est plus là pour le retenir.')).toEqual([]);
    expect(tombstonesIn('// le coup au boulet n’est plus là')).toEqual([]);
    expect(tombstonesIn('// ni pose d’état sur un composant qui n’est plus là,')).toEqual([]);
  });

  it('cas planté : un commentaire neutre ne matche aucune famille (contrôle négatif)', () => {
    expect(tombstonesIn('// Calcule le total des dégâts appliqués à la cible.')).toEqual([]);
  });

  it('cas plantés : la locution de cessation devant un artefact de CODE nommé est une tombale (#1486)', () => {
    const L = 'plus de <artefact de code> (état révolu)';
    expect(tombstonesIn('// Amputation déclarée STRUCTURELLEMENT (plus de regex sur `desc`).')).toContain(L);
    expect(tombstonesIn('// le pool DÉRIVE du registre : plus de liste maintenue à la main.')).toContain(L);
    expect(tombstonesIn('// `id` porte la LOGIQUE — le titre FR ne sert plus de clé (#602).')).toContain(L);
    expect(tombstonesIn('// un évaluateur unique, plus de planner par-catégorie')).toContain(L);
    expect(tombstonesIn('// Sélection vue PARTAGÉE — plus de\n // ternaire ad hoc par vue.')).toContain(L);
  });

  it('faux positifs écartés : la QUANTITÉ, la COMPARAISON, le renvoi documentaire et les locutions (#1486)', () => {
    expect(tombstonesIn('// à plus de 3 cases, la portée longue s’applique')).toEqual([]);
    expect(tombstonesIn('// une charge couvre plus de cases que la marche')).toEqual([]);
    expect(tombstonesIn('// plus de détails dans docs/architecture.md')).toEqual([]);
    expect(tombstonesIn('// en plus de la branche par défaut, le registre porte les variantes')).toEqual([]);
    expect(tombstonesIn('// d’autant plus de mode que la scène en déclare')).toEqual([]);
    expect(tombstonesIn('// la cible ne peut plus se déplacer ce Round : vocabulaire de JEU')).toEqual([]);
    expect(tombstonesIn('// si le héros n’a plus de créneau, la journée se clôt.')).toEqual([]);
  });

  it('aucun commentaire de src/** ni de scripts/** ne porte une pierre tombale (tolérance ZÉRO)', () => {
    const offenders: string[] = [];
    for (const { rel, text } of CORPUS) {
      for (const x of scanTombstones(rel, text)) offenders.push(`${rel}:${x.line} ${x.detail}`);
    }
    expect(
      offenders,
      `Pierre(s) tombale(s) détectée(s) — à PURGER (jamais à taguer en exception, CLAUDE.md règle 6c) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// Famille 2 — commentaire-EXCUSE (CLAUDE.md règle 6b). Un tag `[entériné AAAA-MM-JJ]` dans le MÊME
// commentaire neutralise la détection (décision utilisateur traçable).
// Regex + `untaggedExcuseMatch` : `scripts/guards/lib/commentPoison.mjs` (mécanique partagée).
// ---------------------------------------------------------------------------------------------

describe('garde-fou commentaires — excuses non tracées (#136, CLAUDE.md règle 6b)', () => {
  it('cas planté : une justification sans tag est détectée (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant")).not.toBeNull();
  });

  it('cas planté : le tag [entériné AAAA-MM-JJ] neutralise la détection (preuve TDD)', () => {
    expect(untaggedExcuseMatch("// on garde X pour l'instant [entériné 2026-07-06]")).toBeNull();
  });

  it('cas planté : un commentaire neutre ne matche pas (contrôle négatif)', () => {
    expect(untaggedExcuseMatch('// Calcule le total des dégâts appliqués à la cible.')).toBeNull();
  });

  it('faux positifs écartés : « pas encore <participe de mécanique> » = état de partie (affinage 2026-07-06)', () => {
    expect(untaggedExcuseMatch('// null = pas encore lancé (rien à re-dériver).')).toBeNull();
    expect(untaggedExcuseMatch('// Round 1 pas encore commencé (sujet HORS-TOUR).')).toBeNull();
    expect(untaggedExcuseMatch('// chargée + pas encore tiré ce Round (Tir rapide).')).toBeNull();
    expect(untaggedExcuseMatch('// pas encore de Contre-sort ce Round.')).toBeNull();
    expect(untaggedExcuseMatch('// Test étendu de Calme pas encore au niveau.')).toBeNull();
  });

  it('faux positifs écartés : « temporairement <durée d\'effet> » et « épargné par <règle> » (affinage 2026-07-06)', () => {
    expect(untaggedExcuseMatch('// Chance accordée temporairement, retirée à expiration.')).toBeNull();
    expect(untaggedExcuseMatch('// temporairement insensible (Détermination, LDB 17).')).toBeNull();
    expect(untaggedExcuseMatch('// les PA magiques sont épargnés par Ulgu.')).toBeNull();
    // Le participe, avec ou sans complément d'objet, reste une excuse : le seul site du dépôt qui
    // aurait bénéficié d'une soustraction « forme transitive » était le commentaire qui l'a demandée
    // (rejeu 2026-07-26 : 1 bénéficiaire sur tout le dépôt) — il a été reformulé, pas exempté.
    expect(untaggedExcuseMatch('// ce cas est épargné, on verra plus tard')).not.toBeNull();
    expect(untaggedExcuseMatch("// on lui épargne la résolution de types.")).not.toBeNull();
  });

  it('défaut relevé puis RENVOYÉ à un autre geste = excuse (motif mesuré sur `defs/careerLevels.ts`, #1466 T2)', () => {
    expect(untaggedExcuseMatch('// ANOMALIE DE DONNÉE relevée (à corriger séparément, PAS ici) : status « Agent 1 »')).not.toBeNull();
    expect(untaggedExcuseMatch('// clé en double : à traiter ailleurs')).not.toBeNull();
    expect(untaggedExcuseMatch('// à migrer plus tard vers le registre')).not.toBeNull();
    // Le report ASSUMÉ par l'utilisateur reste admis, comme tout le volet excuses.
    expect(untaggedExcuseMatch('// à corriger séparément [entériné 2026-08-24]')).toBeNull();
  });

  it('dette EN ATTENTE et alibi de PÉRIMÈTRE daté = excuses (deux formes mesurées MUETTES le 2026-08-29)', () => {
    // Verbatims du site réel `src/engine/travelStages.ts` (reformulé dans le même geste) : sans renvoi
    // explicite, le premier échappait au motif de report, le second n'était couvert par aucune famille.
    expect(untaggedExcuseMatch(' * ... relève de la MÊME classe que ce lot et reste à migrer :')).not.toBeNull();
    expect(untaggedExcuseMatch(" * il était hors périmètre le jour du murage (`src/ui/**` n'était pas ouvert).")).not.toBeNull();
    expect(untaggedExcuseMatch('// ces deux lignes restent à traiter')).not.toBeNull();
    expect(untaggedExcuseMatch('// hors périmètre le jour de la revue')).not.toBeNull();
    // Le report ASSUMÉ par l'utilisateur reste admis ici aussi.
    expect(untaggedExcuseMatch('// reste à migrer [entériné 2026-08-29]')).toBeNull();
    // Contrôles négatifs : un PÉRIMÈTRE décrit au présent, et un « reste » sans verbe de réparation.
    expect(untaggedExcuseMatch('// ce champ est hors périmètre de la garde (mesure de #1486).')).toBeNull();
    expect(untaggedExcuseMatch('// le compte reste à 0 tant que le motif tient.')).toBeNull();
    // ANGLE MORT ASSUMÉ du motif (consigné à `ALIBI_PERIMETRE`, `commentPoison.mjs`) : la même forme
    // au PASSÉ portant un complément de SOURCE est une prose DESCRIPTIVE, pas une dette laissée — elle
    // MORD quand même. 0 occurrence dans le corpus le 2026-08-30 : motif tenu STRICT tant que c'est 0.
    expect(untaggedExcuseMatch("// ce champ était hors périmètre de l'extraction FR.")).not.toBeNull();
  });

  it('dette laissée EN ATTENTE D’ARBITRAGE = excuse ; le POINTEUR vers le ticket reste admis', () => {
    // Verbatim du site réel `src/state/combatFlow.ts` (reformulé dans le même geste) : la divergence
    // y était renvoyée à une décision que personne ne portait et qu'aucune date n'échéançait.
    expect(untaggedExcuseMatch('// divergence MESURÉE, en attente d\'arbitrage (#1265).')).not.toBeNull();
    expect(untaggedExcuseMatch('// en attente d’un arbitrage utilisateur')).not.toBeNull();
    // Contrôle négatif : NOMMER le ticket où la question vit n'est pas une excuse — c'est un renvoi
    // vérifiable. 17 sites du dépôt portent cette forme (mesure 2026-09-02).
    expect(untaggedExcuseMatch('// le critère métier du site, arbitrage #1265.')).toBeNull();
    expect(untaggedExcuseMatch('// arbitrage utilisateur 2026-08-24 : la raison vit au survol.')).toBeNull();
    // Le report ASSUMÉ par l'utilisateur reste admis, comme tout le volet excuses.
    expect(untaggedExcuseMatch("// en attente d'arbitrage [entériné 2026-09-02]")).toBeNull();
  });

  it('site d’ORIGINE (#1732) : la phrase est vue À CHEVAL sur deux lignes d’un bloc enroulé', () => {
    // VERBATIM des lignes 16-17 de `src/gameIso/stage/AreteOverlay.tsx` au commit 2a27b8b60 : le bloc
    // s'enroule à ~100 colonnes, donc la phrase porte son marqueur sur la ligne SUIVANTE, derrière le
    // préfixe de continuation. C'est l'unité PHRASE qui la rend visible, pas la ligne.
    const bloc = [
      '/**',
      " * et non par la cible. Une seule chaîne d'activation, donc, et le nom lisible en attendant l'infobulle",
      ' * partagée (lot 3).',
      ' */',
    ].join('\n');
    const trouve = scanExcuses('src/gameIso/stage/AreteOverlay.tsx', bloc);
    expect(trouve).toHaveLength(1);
    expect(trouve[0].line).toBe(2); // la ligne de la LOCUTION, pas celle du marqueur
    expect(trouve[0].detail).toContain('en attendant');
  });

  it('locution d’ATTENTE + MARQUEUR DE DETTE = excuse ; le vocabulaire de FLUX reste hors motif (#1732)', () => {
    expect(untaggedExcuseMatch("// rendu ici en attendant la primitive partagée")).not.toBeNull();
    expect(untaggedExcuseMatch("// champ figé dans l'attente du registre canonique")).not.toBeNull();
    expect(untaggedExcuseMatch("// champ figé dans l’attente de la migration")).not.toBeNull();
    // Le marqueur est vu OÙ QU'IL TOMBE DANS LA PHRASE : derrière une virgule, derrière une
    // subordonnée, derrière un retour de ligne préfixé.
    expect(untaggedExcuseMatch('// rendu ici en attendant, la primitive partagée arrive au lot 3.')).not.toBeNull();
    expect(untaggedExcuseMatch("// `<title>` natif en attendant qu'une infobulle partagée existe.")).not.toBeNull();
    expect(untaggedExcuseMatch("// rendu ici dans l'attente d'avoir la primitive partagée.")).not.toBeNull();
    expect(untaggedExcuseMatch('// rendu ici en attendant la\n// primitive partagée.')).not.toBeNull();
    // Le report ASSUMÉ par l'utilisateur reste admis, comme tout le volet excuses.
    expect(untaggedExcuseMatch('// rendu ici en attendant la primitive partagée [entériné 2026-09-14]')).toBeNull();
    // Contrôles négatifs (1) — le VOCABULAIRE DE FLUX du jeu : la chose attendue est une pièce d'état de
    // partie (un jet, un tour, un Round, un résultat), jamais un artefact de chantier.
    expect(untaggedExcuseMatch('// la cible reste GELÉE en attendant le jet adverse.')).toBeNull();
    expect(untaggedExcuseMatch('// on ne purge rien en attendant la fin du round.')).toBeNull();
    expect(untaggedExcuseMatch("// le pending vit dans l'attente du résultat du frappeur.")).toBeNull();
    expect(untaggedExcuseMatch('// le combattant garde sa posture en attendant son tour.')).toBeNull();
    expect(untaggedExcuseMatch("// l'ancre est jetée en attendant l'accalmie.")).toBeNull();
    expect(untaggedExcuseMatch('// le groupe refait à neuf ne laisse aucun jumeau orphelin en attendant les corps suivants.')).toBeNull();
    // Contrôle négatif (2) — la fenêtre est la PHRASE : un marqueur de la phrase SUIVANTE ne fait pas
    // d'une phrase de flux une dette (c'est ce que coûterait le bloc entier comme fenêtre).
    expect(untaggedExcuseMatch('// la cible reste GELÉE en attendant le jet adverse. La primitive partagée arrive au lot 3.')).toBeNull();
    expect(untaggedExcuseMatch('// le pending vit dans l’attente du résultat ; la migration viendra avec son lot 3.')).toBeNull();
    // Contrôles négatifs (3) — les 3 sites légitimes du corpus mesurés le 2026-09-14 (verbatims).
    expect(untaggedExcuseMatch('/** Enregistre une relève et rend le matériau nu en attendant. */')).toBeNull();
    expect(untaggedExcuseMatch("// c'est son PÉRIMÈTRE : il ne doit pas s'étendre à un septième document en attendant.")).toBeNull();
    expect(untaggedExcuseMatch('// `dominos` tient la place en attendant, et ce n’est PAS le même Test.')).toBeNull();
  });

  it('faux positif écarté : une phrase de DONNÉE qui dit « séparément »/« ailleurs » décrit le découpage RÉEL', () => {
    expect(untaggedExcuseMatch('// les entrées de racine et les documents embarqués se comptent SÉPARÉMENT.')).toBeNull();
    expect(untaggedExcuseMatch('// la QUANTITÉ perdue est portée par la ligne de Critique, pas ici.')).toBeNull();
    expect(untaggedExcuseMatch('// hors de portée : géré ailleurs, pas « trop proche »')).toBeNull();
  });

  it('affirmation-RAW non ancrée détectée (règle 6a — classe « bélier » 2026-07-06, preuve TDD)', () => {
    // Le verbatim qui a contourné toutes les gardes : thèse sur le RAW, zéro réf, et FAUSSE (ADE II 8 exige l'Équipe).
    expect(scanRawClaims('x.ts', "// mains, via son inventaire/loadout — RAW ne l'exige PAS « servi » en poste pour être manié")).toHaveLength(1);
    expect(scanRawClaims('x.ts', '// arbitrage : laissé au MJ')).toHaveLength(1);
    expect(scanRawClaims('x.ts', '// le RAW est muet sur ce cas')).toHaveLength(1);
  });

  it('affirmation-RAW ANCRÉE à une réf de livre = matériellement vérifiable, pas d\'alerte (preuve TDD)', () => {
    expect(scanRawClaims('x.ts', '// AFFICHAGE (couche UI, hors RAW LDB 16) : icône du registre')).toHaveLength(0);
    expect(scanRawClaims('x.ts', '// cadence laissée au MJ, LDB 13 l.106 — reset au tour')).toHaveLength(0);
    expect(scanRawClaims('x.ts', '// Calcule le total des dégâts appliqués à la cible.')).toHaveLength(0);
  });

  it('revendication d\'autorité SANS trace détectée (classe « servir coûte l\'Action », preuve TDD)', () => {
    expect(scanDecisionClaims('x.ts', '// notre arbitrage : servir la pièce consomme l\'Action')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// choix de modèle assumé pour simplifier la démo')).toHaveLength(1);
  });

  it('SEUL le tag [entériné] trace une revendication (décision utilisateur 2026-07-07) — date/citation/canon/#N ne suffisent PAS', () => {
    expect(scanDecisionClaims('x.ts', '// choix de modèle assumé [entériné 2026-07-07]')).toHaveLength(0);
    expect(scanDecisionClaims('x.ts', '// Décision de design (2026-06-10, retour playtest) : la Peur reste combat-only.')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// arbitrage utilisateur V1 : « pour le moment on ne gère que le combat »')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// choix de design ANCRÉ sur le texte canon : Grande = 2×2')).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', '// arbitrage maison tracé #133, valeur éditable')).toHaveLength(1);
  });

  it('la COUPURE de ligne ne met pas une revendication hors de portée (angle mort mesuré 2026-08-03)', () => {
    // Motif COUPÉ par le marqueur de continuation d'un bloc : la détection ne dépend pas de l'endroit
    // où l'auteur coupe sa phrase, et le numéro de ligne rapporté est celui du motif.
    const bloc = '/** Contexte long\n *  qui prépare le terrain, arbitrage\n *  maison de la chose. */';
    expect(scanDecisionClaims('x.ts', bloc)).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', bloc)[0].line).toBe(2);
    // Même coupure sur une suite de lignes `//` fusionnées.
    const lignes = '// blabla\n// blabla arbitrage\n// maison de la chose';
    expect(scanDecisionClaims('x.ts', lignes)).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', lignes)[0].line).toBe(2);
    // Non coupée : détection inchangée, ligne 1.
    const uneLigne = '/** Contexte long qui prépare, arbitrage maison de la chose. */';
    expect(scanDecisionClaims('x.ts', uneLigne)).toHaveLength(1);
    expect(scanDecisionClaims('x.ts', uneLigne)[0].line).toBe(1);
  });

  it('la coupure ne fabrique pas de match : deux commentaires DISTINCTS ne se recollent pas (contrôle négatif)', () => {
    const separes = '// blabla arbitrage\nconst x = 1;\n// maison de la chose';
    expect(scanDecisionClaims('x.ts', separes)).toEqual([]);
  });

  it('vraies excuses TOUJOURS détectées après affinage (preuve TDD)', () => {
    expect(untaggedExcuseMatch('// pas encore migré vers le registre canonique')).not.toBeNull();
    expect(untaggedExcuseMatch('// paramètre non utilisé pour l\'instant par les appelants')).not.toBeNull();
    expect(untaggedExcuseMatch('// on assume cette exception ici')).not.toBeNull();
  });

  (EXCUSE_GUARD_ACTIVE ? it : it.skip)(
    'aucune excuse de src/** ni de scripts/** sans tag [entériné AAAA-MM-JJ] (ACTIVE depuis #177)',
    () => {
      const offenders: string[] = [];
      for (const { rel, text } of CORPUS) {
        for (const c of extractComments(text)) {
          const m = untaggedExcuseMatch(c.text);
          if (m) offenders.push(`${rel}:${matchLine(c, m.index)} ${excerptAt(c, m.index)}`);
        }
      }
      expect(
        offenders,
        `Excuse(s) sans tag \`[entériné AAAA-MM-JJ]\` (CLAUDE.md règle 6b) :\n${offenders.join('\n')}`,
      ).toEqual([]);
    },
  );
});

// ---------------------------------------------------------------------------------------------
// Famille (e) — VOCABULAIRE DE L'ANCIEN ÉTAT (#1486, credo règle 1). Les mots couverts sont plantés
// ici en LITTÉRAUX DE CHAÎNE (jamais lus par `extractComments`) : c'est la spécification exécutable
// du détecteur. Stock nominatif daté : `scripts/guards/lib/legacyVocabStock.mjs`.
// ---------------------------------------------------------------------------------------------

describe('garde-fou commentaires — vocabulaire de l’ancien état (#1486, credo règle 1)', () => {
  it('cas plantés : chaque mot qui nomme l’état d’avant est détecté (preuve TDD)', () => {
    expect(legacyVocabIn('// repli conservé pour le stock legacy des projets')).toContain('legacy');
    expect(legacyVocabIn('// `target` (optionnel — rétro-compat) sert le combat au contact')).toContain('rétro-compat');
    expect(legacyVocabIn('// Absent = tous les pas alloués (défaut, IA/rétrocompatibilité).')).toContain('rétro-compat');
    expect(legacyVocabIn('// kept for backward compatibility with the old export')).toContain('backward-compat');
    expect(legacyVocabIn('// @deprecated — passer par le registre')).toContain('deprecated');
    expect(legacyVocabIn('// `PCFSoftShadowMap` est DÉPRÉCIÉ depuis three 0.185')).toContain('déprécié');
    expect(legacyVocabIn('// une entrée obsolète est refusée à la lecture')).toContain('obsolète');
    expect(legacyVocabIn('// enrobé en `ViewSet` par le shim `toViewSet`')).toContain('shim');
    expect(legacyVocabIn('// le registre porte désormais le libellé')).toContain('désormais');
    expect(legacyVocabIn('// DÉSORMAIS, la file appartient à la scène')).toContain('désormais');
    for (const site of [
      '// ce point d’entrée ne sert plus qu’aux étapes déjà mintées',
      '// le SVG de catalogue n’est plus qu’une vignette de palette',
      "// `type` ci-dessus n'est plus qu'un libellé d'affichage",
      '// ces entrées ne sont plus que des déléguées',
      '// le registre ne porte plus que le libellé',
      '// ce backend ne sert plus que le décor',
      '// ce champ n’est désormais plus qu’un alias',
      '// la voie n’était plus qu’un repli',
    ])
      expect(legacyVocabIn(site), site).toContain('ne … plus que');
  });

  it('faux positifs écartés : le COMPARATIF, le mot plus long, la locution et la citation VERBATIM ne sont pas « ne … plus que »', () => {
    expect(legacyVocabIn('// le SVG de catalogue est la vignette de palette')).toEqual([]);
    expect(legacyVocabIn('// la cible n’est plus quelconque : elle est nommée')).toEqual([]);
    expect(legacyVocabIn('// ce total n’est pas plus que la somme des parts')).toEqual([]);
    expect(legacyVocabIn('// le pot ne rend jamais plus qu’il n’a reçu')).toEqual([]);
    expect(legacyVocabIn('// il n’est plus que temps de clore la manche')).toEqual([]);
    expect(legacyVocabIn('// « jusqu’à ce qu’il n’y ait plus qu’un seul joueur en jeu » (NADJ 16 l.17)')).toEqual([]);
    expect(legacyVocabIn('// « le module n’est plus que du bruit » (2026-07-27)')).toEqual([]);
    expect(legacyVocabIn('// « la cible est désormais à couvert » (NADJ 16 l.17)')).toEqual([]);
    expect(legacyVocabIn('// la cible est désormais à couvert')).toContain('désormais');
    // L'exclusion ne vaut que si elle RECOUVRE le match : hors guillemets, la même phrase est un site.
    expect(legacyVocabIn('// jusqu’à ce qu’il n’y ait plus qu’un seul joueur en jeu')).toContain('ne … plus que');
  });

  it('des guillemets SANS réf ne font pas une citation : la tombale y reste un site, toutes familles', () => {
    expect(legacyVocabIn('// « jusqu’à ce qu’il n’y ait plus qu’un seul joueur en jeu »')).toContain('ne … plus que');
    expect(legacyVocabIn('// « ce module n’est plus qu’un relais », puis la suite du commentaire (NADJ 16 l.17)')).toContain('ne … plus que');
    expect(legacyVocabIn('// « enrobé par le shim `toViewSet` »')).toContain('shim');
  });

  it('ÉTAT DE JEU au présent : un site de la forme, que seul le tag [entériné AAAA-MM-JJ] du MÊME commentaire neutralise (`scanLegacyVocab`, `ENTERINE_TAG_RX`)', () => {
    expect(scanLegacyVocab('x.ts', '// la case n’est plus qu’éclairée par la lune')).toHaveLength(1);
    expect(scanLegacyVocab('x.ts', '// la case n’est plus qu’éclairée par la lune [entériné 2026-09-26]')).toEqual([]);
  });

  it('cas planté : une CONSTANTE citée en commentaire est un site (le tiret bas n’est pas une frontière)', () => {
    expect(legacyVocabIn('// `LEGACY_KEY` nettoie les clés des versions antérieures')).toContain('legacy');
  });

  it('cas planté : la coupure de ligne ne met pas la locution hors de portée', () => {
    expect(legacyVocabIn('/** ce point d’entrée ne sert\n *  plus qu’aux étapes mintées. */')).toContain('ne … plus que');
    expect(legacyVocabIn('/** ce qui distingue une région n’est\n *  plus que ses alvéoles */')).toContain('ne … plus que');
  });

  it('faux positifs écartés : l’IDENTIFIANT et le NOM DE FICHIER cités en commentaire ne sont pas des sites', () => {
    expect(legacyVocabIn('// `legacyVocabIn` rend les motifs portés par un commentaire')).toEqual([]);
    expect(legacyVocabIn('// scanner `charKeyLegacy.mjs` (clés de caractéristique)')).toEqual([]);
    expect(legacyVocabIn('// stock nominatif : `legacyVocabStock.mjs`')).toEqual([]);
    expect(legacyVocabIn('// Message du joueur par CAUSE de rejet (`ObsoleteCause`)')).toEqual([]);
  });

  it('faux positif écarté : le mot dans une CHAÎNE n’est pas un commentaire (preuve TDD)', () => {
    expect(scanLegacyVocab('x.ts', "const mode = 'legacy';\nconst n = 1; // compteur")).toEqual([]);
  });

  it('hors périmètre mesuré : la quantité, le vocabulaire de JEU et la citation RAW ne sont pas des sites', () => {
    expect(legacyVocabIn('// à plus de 3 cases, la portée longue s’applique')).toEqual([]);
    expect(legacyVocabIn('// remis à zéro à la fin du tour (LDB 13 l.106)')).toEqual([]);
    expect(legacyVocabIn('// « le personnage était étourdi »')).toEqual([]);
  });

  it('cas planté : le tag [entériné AAAA-MM-JJ] du MÊME commentaire neutralise la famille (preuve TDD)', () => {
    expect(scanLegacyVocab('x.ts', '// repli du stock legacy conservé')).toHaveLength(1);
    expect(scanLegacyVocab('x.ts', '// repli du stock legacy conservé [entériné 2026-08-23]')).toEqual([]);
  });

  it('cas planté : un commentaire neutre ne matche aucune famille (contrôle négatif)', () => {
    expect(legacyVocabIn('// Calcule le total des dégâts appliqués à la cible.')).toEqual([]);
  });

  it('emplois VIVANTS écartés : la dépendance npm, la couture DEV Playwright, l’entrée de garde sans correspondance', () => {
    // Aucun de ces sites ne peut « mourir » : le mot n'y nomme pas un état révolu de CE dépôt.
    expect(legacyVocabIn('// dépendances inutilisées (knip) + majeures obsolètes (npm outdated), en issue')).toEqual([]);
    expect(legacyVocabIn('// Simule un BOUTON de manette en passant par le shim DEV installé par `useGamepad`')).toEqual([]);
    expect(legacyVocabIn('// le hook (vraie manette) ET le shim DEV (Playwright, `__wfrpPad`)')).toEqual([]);
    expect(legacyVocabIn('// un motif de cette liste sans AUCUNE correspondance est une erreur (motif obsolète).')).toEqual([]);
    // L'exclusion ne vaut que si elle RECOUVRE le match : le mot NU reste un site.
    expect(legacyVocabIn('// le shim `toViewSet` enrobe l’art partiel')).toContain('shim');
    expect(legacyVocabIn('// une entrée obsolète est refusée à la lecture')).toContain('obsolète');
  });

  it('tout site de src/** et scripts/** (tests compris) est au stock nominatif daté, et aucune ligne du stock n’est périmée', () => {
    const findings: { file: string; line: number; detail: string }[] = [];
    const scanned: string[] = [];
    for (const { rel, text } of CORPUS) {
      scanned.push(rel);
      for (const x of scanLegacyVocab(rel, text)) findings.push({ file: rel, line: x.line, detail: x.detail });
    }
    const stock: BaselineEntry[] = LEGACY_VOCAB_SITES.map(({ fichier, motif, ancre, lot, date }) => ({
      fichier,
      motif,
      ancre,
      raison: lot,
      date,
    }));
    // Clé = fichier + ancre + MOTIF : le rangement se fait motif par motif, sinon une entrée couvre
    // les DEUX findings d'un commentaire à deux motifs et tuer l'un des deux laisse la garde verte.
    const motifDe = (detail: string) => /^\[([^\]]+)\]/.exec(detail)?.[1] ?? '';
    const motifs = new Set([...findings.map((f) => motifDe(f.detail)), ...stock.map((s) => s.motif)]);
    const nouveaux: string[] = [];
    const perimees: string[] = [];
    for (const motif of motifs) {
      const v = partitionBaseline(
        findings.filter((f) => motifDe(f.detail) === motif),
        stock.filter((s) => s.motif === motif),
        scanned,
      );
      nouveaux.push(...v.nouveaux.map((f) => `${f.file}:${f.line} ${f.detail}`));
      perimees.push(...v.perimees.map((e) => `${e.fichier} — ${e.motif} : ${e.ancre}`));
    }
    expect(
      nouveaux,
      'Vocabulaire de l’ancien état hors stock : tuer le site (credo règle 1), ou le faire couvrir par un tag `[entériné AAAA-MM-JJ]` de l’utilisateur. Le stock ne s’allonge JAMAIS (#1486).',
    ).toEqual([]);
    expect(
      perimees,
      'Ligne(s) du stock sans site correspondant : purger `scripts/guards/lib/legacyVocabStock.mjs` dans le MÊME commit.',
    ).toEqual([]);
    expect(LEGACY_VOCAB_SITES.length, 'une ligne de stock par finding : un commentaire à 2 motifs = 2 lignes.').toBe(
      findings.length,
    );
  });

  it('chaque ligne du stock est bien formée : fichier existant, ancre, LOT de l’ensemble fermé de #1486, date ISO', () => {
    for (const s of LEGACY_VOCAB_SITES) {
      expect(statSync(join(ROOT, s.fichier)).isFile(), `${s.fichier} introuvable`).toBe(true);
      expect(s.motif, JSON.stringify(s)).toBeTruthy();
      expect(s.ancre, JSON.stringify(s)).toBeTruthy();
      expect(s.date, JSON.stringify(s)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const jeton of s.lot.split(' / ')) {
        expect(
          LOTS_1486 as readonly string[],
          `lot inconnu « ${jeton} » sur ${s.fichier} — un site se rattache à un lot RÉEL de #1486, jamais à un placeholder.`,
        ).toContain(jeton);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------
// BASELINE NOMINATIVE du canal non bloquant (familles 3 et 4). Les sites déjà tranchés se déclarent
// par FICHIER + ANCRE de texte dans `scripts/guards/lib/decisions-baseline.json` ; le détecteur les
// range à part pour que la ligne NOUVELLE saute aux yeux, et signale toute entrée qui ne matche plus
// rien dans les fichiers scannés.
// ---------------------------------------------------------------------------------------------

describe('baseline nominative des signaux de commentaires (#136, 2026-08-03)', () => {
  const ENTREE = {
    fichier: 'src/engine/magic.ts',
    motif: 'cumul RaM plus-fort-seul',
    ancre: 'Cumul TRAIT↔TALENT : le plus FORT seul',
    raison: 'option « pas de tag à poser » choisie par l’utilisateur au revirement du 2026-08-03 (#1040)',
    date: '2026-08-03',
  };
  const SIGNAL_CONNU = {
    file: 'src/engine/magic.ts',
    line: 754,
    detail: '[arbitrage X] *  Cumul TRAIT↔TALENT : le plus FORT seul (arbitrage utilisateur 2026-08-03, verbatim au ticket',
  };
  const SIGNAL_NEUF = {
    file: 'src/engine/magic.ts',
    line: 900,
    detail: '[arbitrage X] notre arbitrage : la Ram double le DR',
  };

  it('cas planté : un signal déclaré par fichier + ancre est classé INTENTIONNEL (preuve TDD)', () => {
    expect(matchesBaselineEntry(SIGNAL_CONNU, ENTREE)).toBe(true);
    const v = partitionBaseline([SIGNAL_CONNU], [ENTREE], ['src/engine/magic.ts']);
    expect(v.nouveaux).toEqual([]);
    expect(v.connus.map((c) => c.entry.motif)).toEqual(['cumul RaM plus-fort-seul']);
    expect(v.perimees).toEqual([]);
  });

  it('cas planté : la ligne du MÊME fichier hors ancre sort en NOUVEAU (preuve TDD)', () => {
    const v = partitionBaseline([SIGNAL_CONNU, SIGNAL_NEUF], [ENTREE], ['src/engine/magic.ts']);
    expect(v.nouveaux).toEqual([SIGNAL_NEUF]);
    expect(v.connus).toHaveLength(1);
  });

  it('cas planté : une entrée FANTÔME (site corrigé) est signalée pour purge (preuve TDD)', () => {
    const v = partitionBaseline([SIGNAL_NEUF], [ENTREE], ['src/engine/magic.ts']);
    expect(v.perimees).toEqual([ENTREE]);
    expect(formatBaselineReport(v).join('\n')).toContain("baseline périmée — purger l'entrée");
  });

  it('la péremption ne se conclut QUE sur les fichiers scannés (hook diff-scopé)', () => {
    const v = partitionBaseline([], [ENTREE], ['src/ui/HeroSheet.tsx']);
    expect(v.perimees).toEqual([]);
  });

  it('rendu : NOUVEAU en tête, BASELINE compacte ; zéro nouveau = section absente', () => {
    const rapport = formatBaselineReport(partitionBaseline([SIGNAL_CONNU], [ENTREE], ['src/engine/magic.ts']));
    expect(rapport.some((l) => l.startsWith('NOUVEAU'))).toBe(false);
    expect(rapport[0]).toBe('BASELINE (intentionnel) : 1 site(s)');
    expect(rapport).toHaveLength(2);

    const avecNeuf = formatBaselineReport(partitionBaseline([SIGNAL_CONNU, SIGNAL_NEUF], [ENTREE], ['src/engine/magic.ts']));
    expect(avecNeuf[0]).toContain('NOUVEAU');
    expect(avecNeuf[1]).toContain('src/engine/magic.ts:900');
  });

  it('rien à dire = aucune ligne imprimée (contrôle négatif)', () => {
    expect(formatBaselineReport(partitionBaseline([], [], []))).toEqual([]);
  });

  it('la baseline LIVRÉE est bien formée : 5 champs, date ISO, fichier existant', () => {
    const sites = loadDecisionsBaseline();
    expect(DECISIONS_BASELINE_PATH.replace(/\\/g, '/')).toContain('scripts/guards/lib/decisions-baseline.json');
    expect(sites.length).toBeGreaterThan(0);
    for (const e of sites) {
      expect(typeof e.fichier, JSON.stringify(e)).toBe('string');
      expect(e.motif, JSON.stringify(e)).toBeTruthy();
      expect(e.ancre, JSON.stringify(e)).toBeTruthy();
      expect(e.raison, JSON.stringify(e)).toBeTruthy();
      expect(e.date, JSON.stringify(e)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(statSync(join(ROOT, e.fichier)).isFile(), `${e.fichier} introuvable`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// CLIQUET famille 4 dans les FICHIERS DE TEST. Les deux portes existantes (pre-commit `pre-commit.mjs`,
// hook au stylo `poison-postcheck.mjs`) écartent `*.test.*` de leur périmètre : une revendication
// d'autorité écrite dans un test leur échappe. Ici elle BLOQUE dès qu'elle sort de la liste
// nominative ci-dessous — et l'entrée dont le site a disparu est signalée pour purge (les listes
// décroissent). Même mécanique que la baseline (`partitionBaseline`), donnée locale : ces sites-là
// vivent dans les tests, pas dans le code de production.
// ---------------------------------------------------------------------------------------------

/** Sites de test tolérés, PAR FICHIER + ANCRE : tout autre signal famille 4 dans un test bloque, et
 *  une entrée dont le site ne matche plus se purge (les listes décroissent). Chaque entrée cite la
 *  SOURCE du verbatim — sans elle, la revendication n'est qu'une évaluation d'ingénierie. */
const TEST_DECISION_SITES: BaselineEntry[] = [
  {
    fichier: 'src/state/saves-flow.test.ts',
    motif: 'politique de version des saves (en-tête)',
    ancre: 'Plus la POLITIQUE DE VERSION (arbitrage utilisateur 2026-08-17)',
    raison: 'verbatim utilisateur du 2026-08-17 consigné dans `.claude/memory/user-arbitrage-saves-reset-pas-migration.md` (une save d’une autre version se jette, elle ne se migre plus)',
    date: '2026-08-17',
  },
  {
    fichier: 'src/state/saves-flow.test.ts',
    motif: 'politique de version des saves (describe)',
    ancre: 'Arbitrage utilisateur 2026-08-17 : un changement de forme persistée',
    raison: 'même verbatim, même fiche mémoire (`user-arbitrage-saves-reset-pas-migration.md`) : c’est lui qui fixe le comportement mesuré par ce describe',
    date: '2026-08-17',
  },
  {
    fichier: 'src/ui/saveload-message-obsolete.test.tsx',
    motif: 'message joueur d’une save jetée',
    ancre: 'arbitrage utilisateur 2026-08-17 : une save',
    raison: 'même verbatim, même fiche mémoire : l’écran doit DIRE le rejet que l’arbitrage ordonne',
    date: '2026-08-17',
  },
  {
    fichier: 'src/data/schemas/defs-scenes/projet-schema.test.ts',
    motif: 'identité requise d’un projet (#1552)',
    ancre: 'arbitrage utilisateur 2026-08-31 (AskUser, verbatim choisi)',
    raison:
      'verbatim utilisateur du 2026-08-31 (AskUserQuestion, option choisie) cité en toutes lettres dans le MÊME commentaire (« Un projet se NOMME avant d’être enregistré (Recommandé) »), consigné au ticket #1552 : c’est lui qui rend `id`/`label`/`versionContenu` REQUIS. Site UNIQUE de cette citation dans les tests — les autres sites du lot (migration, bibliothèque, éditeur) y RENVOIENT au lieu de la recopier.',
    date: '2026-08-31',
  },
];

describe('cliquet : revendications d’autorité dans les fichiers de test (#136, famille 4)', () => {
  it('aucun site famille 4 dans src/**/*.test.ts(x) hors liste nominative, et aucune entrée périmée', () => {
    const findings: { file: string; line: number; detail: string }[] = [];
    const scanned: string[] = [];
    for (const { rel, text } of TESTS_SRC) {
      scanned.push(rel);
      for (const x of scanDecisionClaims(rel, text)) findings.push({ file: rel, line: x.line, detail: x.detail });
    }
    const v = partitionBaseline(findings, TEST_DECISION_SITES, scanned);
    expect(
      v.nouveaux.map((f) => `${f.file}:${f.line} ${f.detail}`),
      'Revendication(s) d’autorité dans un test, hors liste nominative : reformuler en constat d’ingénierie (comportement + réf nue), ou faire valider le verbatim par l’utilisateur.',
    ).toEqual([]);
    expect(
      v.perimees.map((e) => `${e.fichier} — ${e.motif}`),
      'Entrée(s) de la liste nominative sans site correspondant : purger.',
    ).toEqual([]);
  });
});
