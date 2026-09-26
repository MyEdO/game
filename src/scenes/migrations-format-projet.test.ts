/**
 * LES MIGRATIONS DE FORMAT DU DOCUMENT DE PROJET, REJOUÉES SUR UN ARBRE JETABLE (#1467 L1b).
 *
 * Sœur de `src/data/migrations-type-enveloppe.test.ts`, MÊME doctrine : on exécute les VRAIS fichiers
 * de `scripts/migrations/` — copiés dans un arbre temporaire pour que leur `new URL('../../')` y
 * résolve — sur des fixtures GELÉES ici (aucun `git show` : un test qui en dépend casse en clone
 * superficiel). L'autre fichier tient la famille `type`→<clé métier> sur `src/data` ; celui-ci tient
 * la famille « bump de FORME » sur `src/scenes/<c>/<c>-projet.json`.
 *
 * Les cas PROPRES de ce banc : le bump 4 → 5 (`t1`-`t5`), le contrat de sortie RETOUCHÉ de la 3i,
 * les bumps 5 → 6 et 6 → 7 sur des fixtures d'ENTRÉE gelées à leur format ; `t6` joue la chaîne
 * ENTIÈRE. Ce que fait chaque script vit dans son propre en-tête ; les PORTES propres d'un bump
 * suivant, s'il en a, dans son banc de morsure `scripts/migrations/lib/*-portes.test.mjs`.
 *
 * RETOUCHER UN SCRIPT DÉJÀ JOUÉ est le geste le plus risqué du lot. Chaque élargissement en
 * « ≥ N = déjà migré » fait AVALER EN SILENCE un `schema` FUTUR inconnu ; ce qui rattrape ce trou est
 * TOUJOURS la DERNIÈRE migration de la chaîne, seule à savoir ce qui existe après elle. Cet invariant
 * se DÉPLACE à chaque bump : la chaîne (`CHAINE`) et sa dernière (`DERNIERE`) sont DÉRIVÉES du
 * dossier `scripts/migrations/`, le `schema` futur de `SCHEMA_PROJET` — un bump neuf rougit `t6`
 * tant que la pénultième n'a pas ouvert sa borne, sans qu'on édite ce banc.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA_PROJET } from '../data/schemas/defs-scenes/projet';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS } from '../state/scene';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { FORME_PROJET, serialise } from '../../scripts/migrations/lib/croissance.mjs';
import { depot, efface, joue as jouerDans, lireArbre, lireDans } from '../../scripts/migrations/lib/joue.mjs';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const SCRIPT_3I = '2026-08-27-l1b-3i-projet-schema-4.mjs';
const SCRIPT_13 = '2026-08-28-l1b-13-projet-forme.mjs';
const SCRIPT_15B = '2026-08-29-l1b-15b-projet-forme-6.mjs';
const SCRIPT_1552 = '2026-08-31-1552-projet-sannonce.mjs';
const SCRIPT_1691 = '2026-09-07-1691-relief-defaults-scenes.mjs';
const SCRIPT_1715 = '2026-09-09-1715-roof-defaults-scenes.mjs';
const SCRIPT_1687 = '2026-09-10-1687-usable-sieges.mjs';
const SCRIPT_1687_ACTIONS = '2026-09-11-1687-actions-authorees.mjs';
const SCRIPT_877 = '2026-09-21-877-ref-de-decor-nommee.mjs';
const SCRIPT_1897 = '2026-09-23-1897-projet-sorts-de-preset-ids-nus.mjs';
const SCRIPT_1897_FUSIONS = '2026-09-24-1897-projet-sorts-fusionnes.mjs';

/** La CHAÎNE du format projet, DÉRIVÉE du dossier : tout script daté qui lit le `schema` d'un
 *  `<campagne>-projet.json`, dans l'ordre lexical du rejeu (`scripts/migrations/replay.mjs`). */
const DOSSIER_MIGRATIONS = join(RACINE, 'scripts', 'migrations');
const CHAINE = listerDossier(DOSSIER_MIGRATIONS)
  .filter((f) => /^\d{4}-\d{2}-\d{2}-.+\.mjs$/.test(f))
  .filter((f) => {
    const source = lireArbre(`scripts/migrations/${f}`);
    return source.includes('-projet.json') && /\bdoc\.schema\b/.test(source);
  });
/** La DERNIÈRE de la chaîne dans l'ordre lexical — celle qui NOMME un `schema` inconnu. */
const DERNIERE = CHAINE[CHAINE.length - 1];

/** Document de projet minimal à la forme demandée, GELÉ ici. */
function projet(over: Record<string, unknown>): Record<string, unknown> {
  return {
    schema: 4,
    meta: { id: 'camp', label: 'Campagne', icon: 'scenario/village', version: 3 },
    narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
    scenes: [{ id: 's1', nom: 'Une salle', desc: 'Prose.', dimensions: { w: 4, h: 4 } }],
    ...over,
  };
}

/** Le document de projet posé dans le dépôt jetable. */
const CIBLE = 'src/scenes/camp/camp-projet.json';

/** Joue `script` sur un dépôt jetable portant `doc` (`scripts/migrations/lib/joue.mjs`) ; rend le code
 *  de sortie, la sortie (le MOTIF d'un refus : deux refus distincts sortent tous deux 1) et l'état
 *  APRÈS. `src/data/props.json` (les TYPES de décor à places, lus par `2026-09-10-1687-usable-sieges.mjs`),
 *  `src/data/sortsFusionnes.ts` (la primitive importée par `2026-09-24-1897-projet-sorts-fusionnes.mjs`)
 *  et `src/data/graphieOpsDeTalent.ts` (celle de `2026-09-24-2a-1473-projet-graphie-ops-de-talent.mjs`)
 *  sont des ENTRÉES déclarées de la chaîne : le dépôt les porte, sinon le script mourrait sur un fichier
 *  absent au lieu de rendre le refus qu'on mesure. */
function joue(script: string, doc: Record<string, unknown>): { code: number | null; err: string; avant: string; apres: string } {
  const d = depot({ [CIBLE]: serialise(doc, FORME_PROJET) }, ['src/data/props.json', 'src/data/sortsFusionnes.ts', 'src/data/graphieOpsDeTalent.ts']);
  try {
    const { code, sortie } = jouerDans(d.racine, script);
    return { code, err: sortie, avant: d.avant.get(CIBLE) ?? '', apres: lireDans(d.racine, CIBLE) };
  } finally {
    efface(d.racine);
  }
}

describe(`${SCRIPT_13} — le bump de forme 4 → 5 (aplatissement de la poche \`meta\`)`, () => {
  it('t1. schema 4 : la poche est APLATIE à sa place, `version` devient `versionContenu`', () => {
    const { code, apres } = joue(SCRIPT_13, projet({}));
    expect(code).toBe(0);
    const doc = JSON.parse(apres) as Record<string, unknown>;
    expect(doc.schema).toBe(5);
    expect('meta' in doc).toBe(false);
    expect(doc.versionContenu).toBe(3);
    // L'ORDRE des clés est celui de l'artefact généré : l'identité prend la place de `meta`.
    expect(Object.keys(doc)).toEqual(['schema', 'id', 'label', 'icon', 'versionContenu', 'narratif', 'scenes']);
    // La charge utile ne bouge pas.
    expect(doc.scenes).toEqual([{ id: 's1', nom: 'Une salle', desc: 'Prose.', dimensions: { w: 4, h: 4 } }]);
  });

  it('t2. schema 5 (état de l’arbre) : NO-OP, fichier byte-identique', () => {
    const deja = { schema: 5, id: 'camp', label: 'Campagne', icon: 'scenario/village', versionContenu: 3, narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] }, scenes: [] };
    const { code, avant, apres } = joue(SCRIPT_13, deja);
    expect(code).toBe(0);
    expect(apres).toBe(avant);
  });

  it('t3. schema 3 (non encore bumpé par 3i) → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_13, projet({ schema: 3 }));
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t4. forme HYBRIDE (schema 4 mais identité déjà à plat) → fail-fast, rien d’écrit', () => {
    const hybride = { schema: 4, id: 'camp', versionContenu: 3, narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] }, scenes: [] };
    const { code, avant, apres } = joue(SCRIPT_13, hybride);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t5. `meta` présent mais non-objet → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_13, projet({ meta: 'camp' }));
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t6. RATTRAPAGE : un `schema` FUTUR, avalé par TOUTES les amont, est REFUSÉ par la DERNIÈRE de la chaîne', () => {
    // La DÉRIVATION couvre la chaîne connue : un script qui perdrait sa marque sortirait du banc en
    // silence, et la « dernière » dérivée mentirait.
    expect(CHAINE).toEqual(expect.arrayContaining([SCRIPT_3I, SCRIPT_13, SCRIPT_15B, SCRIPT_1552, SCRIPT_1691, SCRIPT_1715, SCRIPT_1687, SCRIPT_1687_ACTIONS, SCRIPT_877, SCRIPT_1897, SCRIPT_1897_FUSIONS]));
    const schemaFutur = SCHEMA_PROJET + 1;
    // Un TYPE de décor à places, LU au catalogue : sans entité à places, `SCRIPT_1687` s'arrête sur
    // un périmètre vide au lieu de mesurer sa borne.
    const props = JSON.parse(lireArbre('src/data/props.json')) as { id: string; seatSlots?: unknown[] }[];
    const typeAPlaces = props.find((p) => p.seatSlots?.length)?.id;
    expect(typeAPlaces, 'aucun type de décor à places au catalogue').toBeTruthy();
    // Le document est à la forme d'ARRIVÉE de chaque amont (annoncé, provenance posée, relief et
    // toiture par défaut posés, assise nommée) : sans quoi une amont le réécrirait, ou sa vérification
    // de rejeu sortirait rouge, pour une autre raison que le numéro de forme.
    const futur = {
      type: 'projet', schema: schemaFutur, id: 'camp', label: 'C', versionContenu: 3, maison: 'fixture',
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
      scenes: [{
        type: 'scene', id: 's1', label: 'Une salle', dimensions: { w: 1, h: 1 },
        reliefDefaults: DEFAULT_RELIEF_DEFAULTS, roofDefaults: DEFAULT_ROOF_DEFAULTS,
        entities: [{ id: 'e1', kind: 'prop', pos: { x: 0, y: 0 }, ref: typeAPlaces, usable: { assise: true } }],
      }],
    };
    // Les migrations AMONT ont une borne ouverte vers le haut : chacune a été élargie quand la vague
    // suivante a bumpé le même document. Elles avalent donc l'inconnu — c'est le trou.
    for (const amont of CHAINE.slice(0, -1)) {
      const r = joue(amont, futur);
      expect(r.code, `${amont} doit avaler le futur (borne haute OUVERTE) : ${r.err.slice(0, 600)}`).toBe(0);
      expect(r.apres, `${amont} doit laisser le futur INTACT, à l'octet`).toBe(r.avant);
    }
    // La DERNIÈRE dans l'ordre lexical le NOMME : le rejeu sort rouge, pas muet.
    const { code, err, avant, apres } = joue(DERNIERE, futur);
    expect(code, `${DERNIERE} doit refuser un schema futur`).toBe(1);
    expect(err, 'le refus doit NOMMER le `schema` inattendu').toContain(`\`schema\` inattendu ${schemaFutur}`);
    expect(apres).toBe(avant);
  });
});

describe(`${SCRIPT_3I} — RETOUCHÉ : son contrat de sortie par \`schema\``, () => {
  const narratif = { affaires: [], indices: [], presetsPnj: [], objets: [] };

  it('schema 2 (antérieur à sa borne) → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_3I, { schema: 2, narratif, scenes: [] });
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('schema 3 → bumpé à 4, charge utile INTACTE', () => {
    const doc = projet({ schema: 3 });
    const { code, apres } = joue(SCRIPT_3I, doc);
    expect(code).toBe(0);
    const apresDoc = JSON.parse(apres) as Record<string, unknown>;
    expect(apresDoc.schema).toBe(4);
    const { schema: _a, ...resteApres } = apresDoc;
    const { schema: _b, ...resteAvant } = doc;
    expect(resteApres).toEqual(resteAvant);
  });

  it('schema 4, 5 ET 6 → NO-OP byte-identique (la retouche : sans elle, l’arbre bumpé sortait ROUGE au rejeu)', () => {
    for (const schema of [4, 5, 6]) {
      const { code, avant, apres } = joue(SCRIPT_3I, { schema, narratif, scenes: [] });
      expect(code, `schema ${schema} doit être reconnu « déjà migré »`).toBe(0);
      expect(apres, `schema ${schema} doit rester byte-identique`).toBe(avant);
    }
  });

  it('`schema` non numérique → fail-fast NOMMÉ (jamais absorbé par la borne « ≥ 4 »)', () => {
    const { code, avant, apres } = joue(SCRIPT_3I, { schema: 'quatre', narratif, scenes: [] });
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });
});

describe(`${SCRIPT_15B} — le bump 5 → 6 (\`label\` de scène/carte, statblocs annoncés)`, () => {
  const narratif = { affaires: [], indices: [], presetsPnj: [], objets: [] };

  /** Document au format 5 GELÉ ICI : la forme d'ENTRÉE ne bouge plus quoi qu'il arrive à l'arbre. */
  function projet5(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      schema: 5,
      id: 'camp',
      label: 'Campagne',
      icon: 'scenario/village',
      versionContenu: 3,
      narratif,
      scenes: [{
        id: 's1',
        nom: 'Une salle',
        desc: 'Prose.',
        dimensions: { w: 4, h: 4 },
        entities: [
          { id: 'e1', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: { label: 'Rat géant', char: { B: 5 } } },
          { id: 'e2', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' },
        ],
      }],
      worldMap: { id: 'w1', nom: 'La carte', places: [], routes: [] },
      ...over,
    };
  }

  it('t1. schema 5 : `nom` devient `label` À SA POSITION (scène ET carte), le statbloc s’annonce', () => {
    const { code, apres } = joue(SCRIPT_15B, projet5());
    expect(code).toBe(0);
    const doc = JSON.parse(apres) as Record<string, unknown>;
    expect(doc.schema).toBe(6);
    const scene = (doc.scenes as Record<string, unknown>[])[0];
    // POSITION : `label` occupe la place qu'occupait la clé de libellé, pas la fin de l'objet.
    expect(Object.keys(scene)).toEqual(['id', 'label', 'desc', 'dimensions', 'entities']);
    expect(scene.label).toBe('Une salle');
    expect(Object.keys(doc.worldMap as object)).toEqual(['id', 'label', 'places', 'routes']);
    expect((doc.worldMap as { label: string }).label).toBe('La carte');
    // `type` en 1ʳᵉ clé du profil, le reste du statbloc intact.
    const ents = scene.entities as Record<string, unknown>[];
    expect(Object.keys(ents[0].statblock as object)).toEqual(['type', 'label', 'char']);
    expect(ents[0].statblock).toEqual({ type: 'statblock', label: 'Rat géant', char: { B: 5 } });
    // Une entité SANS statbloc traverse INTACTE (témoin positif : rien n'est posé au hasard).
    expect(ents[1]).toEqual({ id: 'e2', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau' });
    // Le reste du document ne bouge pas.
    expect(doc.id).toBe('camp');
    expect(doc.versionContenu).toBe(3);
    expect(doc.narratif).toEqual(narratif);
  });

  it('t2. schema 6 ET 7 (état de l’arbre) : NO-OP, fichier byte-identique', () => {
    // La borne haute a été OUVERTE par #1552, qui a porté le même document à 7 : sans cet
    // élargissement, le rejeu de la 15b sur l'arbre courant sortirait ROUGE.
    for (const schema of [6, 7]) {
      const deja = { schema, id: 'camp', versionContenu: 3, narratif, scenes: [{ id: 's1', label: 'Une salle', dimensions: { w: 1, h: 1 } }] };
      const { code, avant, apres } = joue(SCRIPT_15B, deja);
      expect(code, `schema ${schema} doit être reconnu « déjà migré »`).toBe(0);
      expect(apres, `schema ${schema} doit rester byte-identique`).toBe(avant);
    }
  });

  it('t3. schema 4 (non encore bumpé par la 13) → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_15B, projet5({ schema: 4 }));
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t4. une scène portant À LA FOIS `nom` et `label` → fail-fast, rien d’écrit', () => {
    const hybride = projet5({ scenes: [{ id: 's1', nom: 'A', label: 'B', dimensions: { w: 1, h: 1 } }] });
    const { code, avant, apres } = joue(SCRIPT_15B, hybride);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t5. un statbloc portant DÉJÀ un `type` étranger → fail-fast (la migration ne l’écrase pas)', () => {
    const etranger = projet5({
      scenes: [{ id: 's1', nom: 'A', dimensions: { w: 1, h: 1 }, entities: [{ id: 'e1', statblock: { type: 'creature', label: 'X', char: {} } }] }],
    });
    const { code, avant, apres } = joue(SCRIPT_15B, etranger);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t6. une scène SANS libellé (ni `nom` ni `label`) → fail-fast, rien d’écrit', () => {
    const muette = projet5({ scenes: [{ id: 's1', dimensions: { w: 1, h: 1 } }] });
    const { code, avant, apres } = joue(SCRIPT_15B, muette);
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  /**
   * S4 — L'ORDRE LEXICAL EST PORTEUR pour les trois migrations de FORME : elles écrivent les MÊMES
   * fichiers et composent une CHAÎNE (3→4, 4→5, 5→6). La prose de `scripts/migrations/replay.mjs`
   * affirme que le tri des noms coïncide avec l'ordre des bumps ; sans ce test, cette affirmation ne
   * serait qu'une intention — un nom de migration mal choisi la casserait EN SILENCE au rejeu.
   */
  it('S4. jouée HORS ORDRE (15b la première sur un `schema: 3`), la chaîne REFUSE — l’ordre lexical est porteur', () => {
    const brut3 = { schema: 3, meta: { id: 'camp', version: 1 }, narratif, scenes: [{ id: 's1', nom: 'Une salle', dimensions: { w: 1, h: 1 } }] };
    // Hors ordre : la dernière du tri ne sait pas lire l'entrée de la première.
    const horsOrdre = joue(SCRIPT_15B, brut3);
    expect(horsOrdre.code, 'la 15b doit REFUSER un schema 3 (elle n’accepte que 5 ou 6)').toBe(1);
    // Le refus se NOMME : sans cette assertion, une 15b qui « avale » le 3 puis échoue à sa
    // vérification post-écriture sortirait AUSSI 1, et le test resterait vert sur un contrat rompu.
    expect(horsOrdre.err, 'le refus doit NOMMER le `schema` inattendu').toMatch(/`schema` inattendu 3/);
    expect(horsOrdre.apres, 'rien ne doit être écrit sur un refus').toBe(horsOrdre.avant);
    // DANS l'ordre : 3i puis 13 puis 15b amènent le MÊME document au format courant.
    expect(joue(SCRIPT_3I, brut3).code).toBe(0);
    const apres3i = JSON.parse(joue(SCRIPT_3I, brut3).apres) as Record<string, unknown>;
    expect(apres3i.schema).toBe(4);
    const apres13 = JSON.parse(joue(SCRIPT_13, apres3i).apres) as Record<string, unknown>;
    expect(apres13.schema).toBe(5);
    const apres15b = JSON.parse(joue(SCRIPT_15B, apres13).apres) as Record<string, unknown>;
    expect(apres15b.schema).toBe(6);
    expect((apres15b.scenes as Record<string, unknown>[])[0].label).toBe('Une salle');
    // La CONDITION que la prose énonce : le tri des NOMS suit l'ordre des bumps.
    expect([SCRIPT_3I, SCRIPT_13, SCRIPT_15B].slice().sort()).toEqual([SCRIPT_3I, SCRIPT_13, SCRIPT_15B]);
  });
});

describe(`${SCRIPT_1552} — le bump 6 → 7 (le document et ses scènes S'ANNONCENT, provenance posée)`, () => {
  const narratif = { affaires: [], indices: [], presetsPnj: [], objets: [] };

  /** Document au format 6 GELÉ ICI, sous le nom de dossier `camp` — c'est la clé de la table de
   *  provenance NOMINATIVE du script, et ce nom n'y figure pas : le refus attendu en dépend. */
  const projet6 = (over: Record<string, unknown> = {}) => ({
    schema: 6,
    id: 'camp',
    label: 'Campagne',
    icon: 'scenario/village',
    versionContenu: 3,
    narratif,
    scenes: [{ id: 's1', label: 'Une salle', dimensions: { w: 4, h: 4 } }],
    ...over,
  });

  it('t1. une campagne ABSENTE de la table de provenance → fail-fast NOMMÉ, rien d’écrit', () => {
    // La provenance ne se DEVINE pas : elle s'établit à la mesure, campagne par campagne. Une
    // campagne inconnue du script est un ARBITRAGE REQUIS, jamais un `maison` posé par défaut.
    const { code, err, avant, apres } = joue(SCRIPT_1552, projet6());
    expect(code).toBe(1);
    expect(err).toMatch(/aucune provenance DÉCLARÉE/);
    expect(apres).toBe(avant);
  });

  /** Forme d'ARRIVÉE de la 1552, telle qu'elle sort du bump — le `schema` reste paramétrable pour
   *  mesurer la borne OUVERTE (`≥ 7`) sur l'état RÉEL de l'arbre, qui a bumpé depuis. */
  const projetMigre = (schema: number) => ({ type: 'projet', schema, id: 'camp', label: 'C', versionContenu: 3, maison: 'fixture', narratif, scenes: [{ type: 'scene', id: 's1', label: 'Une salle', dimensions: { w: 1, h: 1 } }] });

  it('t2. schema 7 (forme d’arrivée de la 1552) : NO-OP, fichier byte-identique', () => {
    const { code, avant, apres } = joue(SCRIPT_1552, projetMigre(7));
    expect(code).toBe(0);
    expect(apres).toBe(avant);
  });

  it('t2 bis. schema 8 (état RÉEL de l’arbre) : NO-OP, fichier byte-identique — la borne est OUVERTE (≥ 7)', () => {
    // Sans ce cas, la borne ouverte du script ne serait mesurée qu'au numéro qu'il POSE : un rejeu
    // sur l'arbre courant (bumpé depuis par la 1691) ne serait couvert par AUCUN test.
    const { code, avant, apres } = joue(SCRIPT_1552, projetMigre(8));
    expect(code).toBe(0);
    expect(apres).toBe(avant);
  });

  it('t3. schema 5 (non encore bumpé par la 15b) → fail-fast, rien d’écrit', () => {
    const { code, avant, apres } = joue(SCRIPT_1552, projet6({ schema: 5 }));
    expect(code).toBe(1);
    expect(apres).toBe(avant);
  });

  it('t4. forme HYBRIDE (schema 6 portant déjà un `type` ou une provenance) → fail-fast', () => {
    for (const hybride of [projet6({ type: 'projet' }), projet6({ maison: 'déjà là' }), projet6({ scenes: [{ type: 'scene', id: 's1', label: 'A', dimensions: { w: 1, h: 1 } }] })]) {
      const { code, avant, apres } = joue(SCRIPT_1552, hybride);
      expect(code).toBe(1);
      expect(apres).toBe(avant);
    }
  });
});
