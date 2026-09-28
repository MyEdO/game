/**
 * Contrat du schéma de PROJET DE SCÈNE (#1466 T3-a) — la porte UNIQUE du seam `parseProject`, qui a
 * remplacé les quatre validateurs manuscrits. On y verrouille, sur un projet-JOUET minimal :
 *  - la FORME reçue par le seam, AVANT `normalizeScene`/`resolvePortRef` (collections absentes,
 *    port SPARSE `{ref}`) — VERTE, sinon le schéma refuserait un document que l'app charge ;
 *  - les sémantiques, chacune ROUGE avec le CHEMIN et l'id fautif : FK `activeAxes`, invariants du
 *    narratif, FK intra-document `presetId` ;
 *  - l'ENVELOPPE que la fabrique `document()` pose depuis #1552 : le `type` du document et celui de
 *    chaque scène embarquée, l'IDENTITÉ requise (`id`/`label`/`versionContenu`) et la PROVENANCE
 *    (`source` ∨ `maison`) ;
 *  - le `schema` littéral courant (un document non migré n'entre pas par cette porte).
 */
import { describe, it, expect } from 'vitest';
import { projetSchema, projetDoc, SCHEMA_PROJET } from './projet';
import { PENTE_TOIT_DEG } from './scene';
import { narratifSchema } from './narratif';
import { cheminLisible, validateDocument } from '../validate';
import diligenceProjet from '../../../scenes/diligence/diligence-projet.json';

type Jouet = Record<string, unknown>;

const sceneMinimale = (over: Jouet = {}): Jouet => ({
  type: 'scene',
  id: 'scene-1',
  label: 'Une salle',
  desc: 'Scène minimale de fixture.',
  dimensions: { w: 4, h: 4 },
  // EXIGÉ (#1691) : la matière de chaque partie de relief vient de la scène, le rendu n'en devine
  // aucune — une scène qui n'en porte pas est refusée ici même.
  reliefDefaults: { cliff: 'terre', ramp: 'terre', deck: 'pierre', pilier: 'pilier' },
  // EXIGÉE (#1715) : la couverture, la pente de référence et la borne de comble des toitures
  // dérivées viennent de la scène — même refus nominatif si elle manque.
  roofDefaults: { material: 'toit-ardoise', pitchDeg: 45, riseMaxStoreys: 1 },
  ...over,
});

/** Projet-JOUET au format COURANT : l'enveloppe exige le `type`, l'identité et la provenance. */
const projet = (over: Jouet = {}): Jouet => ({
  type: 'projet',
  schema: SCHEMA_PROJET,
  id: 'projet-jouet',
  label: 'Projet jouet',
  versionContenu: 1,
  maison: 'fixture de test — aucun livre ne publie ce projet-jouet',
  narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
  scenes: [sceneMinimale()],
  ...over,
});

/** Le document PRIVÉ d'une clé — l'exigence de l'enveloppe se MESURE par amputation. */
const sans = (cle: string, over: Jouet = {}): Jouet => {
  const doc = projet(over);
  delete doc[cle];
  return doc;
};

/** LIEU + message des fautes, tels que la porte les rend (`validateDocument`) : l'erreur NOMME le
 *  fautif par son lieu, jamais par un préfixe recopié dans son message. */
const fautes = (valeur: unknown, schema: typeof projetSchema | typeof narratifSchema = projetSchema) => {
  const trouvees = validateDocument(schema, valeur);
  expect(trouvees).not.toBeNull();
  return (trouvees ?? []).map((f) => `${cheminLisible(f.lieu)} :: ${f.message}`);
};

/**
 * Chemin + CODE d'issue + la donnée que l'issue NOMME (clé en trop, options attendues, borne). C'est
 * la forme STABLE d'un refus de la dépendance : le `message`, lui, appartient à la locale FR
 * (`grammaire/locale-fr.ts`) et rote à chaque montée de zod. `fautes` reste la porte des messages
 * MAISON, que le dépôt écrit et tient.
 */
const fautesCodees = (valeur: unknown, schema: typeof projetSchema = projetSchema) => {
  const res = schema.safeParse(valeur);
  expect(res.success).toBe(false);
  return res.success ? [] : res.error.issues.map((i) => {
    const brut = i as unknown as Record<string, unknown>;
    const nommee = brut.keys ?? brut.values ?? brut.maximum ?? brut.minimum;
    return `${i.path.join('.')} :: ${i.code}${nommee === undefined ? '' : ` ${JSON.stringify(nommee)}`}`;
  });
};

describe('projetSchema — la FORME que voit le seam (avant normalizeScene/resolvePortRef)', () => {
  it('un projet minimal parse : les collections que `normalizeScene` comble sont OPTIONNELLES', () => {
    const res = projetSchema.safeParse(projet());
    expect(res.success, res.success ? '' : JSON.stringify(res.error.issues.slice(0, 3))).toBe(true);
  });

  it('une scène SANS `entities` (document antérieur, comblé par `normalizeScene`) est VALIDE', () => {
    expect(projetSchema.safeParse(projet()).success).toBe(true);
    expect('entities' in sceneMinimale()).toBe(false);
  });

  /**
   * DÉCOR UTILISABLE (#1687) : l'enveloppe `usable` porte DEUX faits nommés, et le champ `interact`
   * d'avant le lot n'existe plus — un document qui en porte un est REFUSÉ, à son chemin, plutôt
   * qu'ignoré en silence (c'est ce refus que `PROJECT_MIGRATIONS[10]` rattrape au chargement).
   */
  it('`usable` : l’enveloppe à deux faits passe, `interact` est REFUSÉ, un `id` d’action DOUBLÉ aussi', () => {
    const FLOW = { kind: 'seq', steps: [] };
    const entite = (over: Jouet) => [sceneMinimale({ entities: [{ id: 'coffre', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'coffre', ...over }] })];

    expect(projetSchema.safeParse(projet({ scenes: entite({ usable: { assise: true, actions: [{ id: 'fouiller', flow: FLOW, unique: true }] } }) })).success).toBe(true);
    expect(fautesCodees(projet({ scenes: entite({ interact: { flow: FLOW } }) })))
      .toEqual(['scenes.0.entities.0 :: unrecognized_keys ["interact"]']);
    expect(fautes(projet({ scenes: entite({ usable: { actions: [{ id: 'fouiller', flow: FLOW }, { id: 'fouiller', flow: FLOW }] } }) })))
      .toEqual(['scenes « scene-1 » › entities « coffre » › usable › actions « fouiller » :: « fouiller » dupliqué : « id » identifie l’élément dans sa liste, il y est unique.']);
    // `assise` ne se DÉSACTIVE pas par `false` : le fait est présent ou absent, jamais nié.
    expect(fautes(projet({ scenes: entite({ usable: { assise: false } }) })).length).toBeGreaterThan(0);
  });

  it('un `port` SPARSE `{ ref }` (avant `resolvePortRef`) est VALIDE ; sans `ref`, le profil est exigé EN ENTIER', () => {
    const carte = (port: Jouet) => ({
      id: 'carte',
      label: 'Le monde',
      places: [{ id: 'lieu-1', label: 'Port', pos: { x: 1, y: 2 }, scene: 'scene-1', port }],
      routes: [],
    });
    expect(projetSchema.safeParse(projet({ worldMap: carte({ ref: 'marienburg', lighthouse: true }) })).success).toBe(true);
    expect(fautes(projet({ worldMap: carte({ taille: 3 }) }))).toEqual([
      expect.stringContaining('worldMap › places « lieu-1 » › port.richesse'),
      expect.stringContaining('worldMap › places « lieu-1 » › port.production'),
    ]);
  });

  it('`schema: 2` est REFUSÉ (littéral COURANT — un document non migré n\'entre pas par cette porte)', () => {
    expect(fautes(projet({ schema: 2 }))[0]).toContain('schema');
  });

  /**
   * PLAGE de pente (`PENTE_TOIT_DEG`) : une toiture verticale ou plate n'est pas une toiture, et la
   * même plage borne la pente de RÉFÉRENCE de la scène et la pente POSÉE sur un corps. Le refus est
   * nominatif, au chemin — la garde ne dit pas « invalide », elle dit OÙ.
   */
  it('une pente de RÉFÉRENCE hors plage est REFUSÉE au chemin, aux DEUX bornes', () => {
    const pente = (deg: number) => fautesCodees(projet({ scenes: [sceneMinimale({ roofDefaults: { material: 'toit-ardoise', pitchDeg: deg, riseMaxStoreys: 1 } })] }));
    expect(pente(90)).toEqual([`scenes.0.roofDefaults.pitchDeg :: too_big ${PENTE_TOIT_DEG.max}`]);
    expect(pente(0)).toEqual([`scenes.0.roofDefaults.pitchDeg :: too_small ${PENTE_TOIT_DEG.min}`]);
    expect(projetSchema.safeParse(projet({ scenes: [sceneMinimale({ roofDefaults: { material: 'toit-ardoise', pitchDeg: PENTE_TOIT_DEG.max, riseMaxStoreys: 1 } })] })).success).toBe(true);
  });

  it('une pente POSÉE sur un CORPS suit la même plage, au chemin du corps', () => {
    const corps = [{ id: 'corps-1', storeys: [], facades: [], masses: [], roofDefaults: { pitchDeg: 90 } }];
    expect(fautesCodees(projet({ scenes: [sceneMinimale({ architecture: corps })] }))).toEqual([
      `scenes.0.architecture.0.roofDefaults.pitchDeg :: too_big ${PENTE_TOIT_DEG.max}`,
    ]);
  });

  it('une clé inconnue sur une scène est REFUSÉE (schéma STRICT)', () => {
    expect(fautesCodees(projet({ scenes: [sceneMinimale({ inventedField: 'poison' })] }))).toEqual([
      'scenes.0 :: unrecognized_keys ["inventedField"]',
    ]);
  });

  /**
   * Le STATBLOC EMBARQUÉ est déclaré CHAMP PAR CHAMP, calé sur `CustomStatblock` : aucun champ n'y est
   * plus large que l'interface TS. `char` est le seul qui pourrait l'être en silence — écrit en
   * `z.record(z.string(), …)` il avalerait n'importe quelle clé, et une coquille d'authoring
   * (`endurence`, `ZZZZ`) vivrait dans la donnée sans jamais rien modifier au jeu.
   */
  const statblocMinimal = (over: Jouet = {}): Jouet => ({ type: 'statblock', label: 'Rat géant', char: { B: 5 }, ...over });
  const avecStatbloc = (sb: Jouet): Jouet =>
    projet({ scenes: [sceneMinimale({ entities: [{ id: 'e1', kind: 'personnage', pos: { x: 1, y: 1 }, statblock: sb }] })] });

  it('le statbloc embarqué : `char` n’accepte QUE les 10 Caractéristiques ∪ M ∪ B', () => {
    // Témoin POSITIF : les clés du canon passent, et `char` reste PARTIEL (aucune n'est exigée).
    expect(projetSchema.safeParse(avecStatbloc(statblocMinimal({ char: { 'capacite-de-combat': 30, M: 4, B: 5 } }))).success).toBe(true);
    expect(projetSchema.safeParse(avecStatbloc(statblocMinimal({ char: {} }))).success).toBe(true);
    // Une clé HORS canon est nommée, jamais avalée.
    expect(fautesCodees(avecStatbloc(statblocMinimal({ char: { ZZZZ: 7 } })))).toEqual([
      'scenes.0.entities.0.statblock.char :: unrecognized_keys ["ZZZZ"]',
    ]);
    // La coquille d'authoring la plus plausible — une Caractéristique mal orthographiée — mord aussi.
    expect(fautesCodees(avecStatbloc(statblocMinimal({ char: { endurence: 35 } })))).toEqual([
      'scenes.0.entities.0.statblock.char :: unrecognized_keys ["endurence"]',
    ]);
  });

  it('le statbloc embarqué DOIT s’annoncer : `type: \'statblock\'` (#1467 L1b)', () => {
    const { type: _sans, ...muet } = statblocMinimal();
    expect(fautesCodees(avecStatbloc(muet))).toEqual([
      'scenes.0.entities.0.statblock.type :: invalid_value ["statblock"]',
    ]);
  });
});

/**
 * UNE arête, UN segment (#1624) — l'invariant que l'index d'arêtes (`state/wallIndex.ts`) SUPPOSE
 * et que ses consommateurs consomment (`aretesA(...)[0]`, `gameIso/builders/roofs.ts`). Mesuré vrai
 * sur les 65 scènes livrées ; `setEdgeWall` (`state/sceneEdit.ts`) le tient à la POSE, ce banc le
 * tient à la PORTE — le chemin que prennent l'authoring littéral, les migrations et l'import.
 */
describe('sceneSchema — une arête `x,y,side,z` ne porte qu’un segment', () => {
  const avecMurs = (walls: Jouet[]): Jouet => projet({ scenes: [sceneMinimale({ walls })] });

  it('une arête DUPLIQUÉE est refusée, la clé NOMMÉE à chaque doublon', () => {
    const doublon = (cle: string) => `scenes « scene-1 » › walls « ${cle} » :: « ${cle} » dupliqué : « x,y,side,z » identifie l’élément dans sa liste, il y est unique.`;
    expect(fautes(avecMurs([{ x: 14, y: 6, side: 'E' }, { x: 14, y: 6, side: 'E', door: true }]))).toEqual([doublon('14,6,E,0')]);
    // `z` ABSENT et `z: 0` sont la MÊME arête (l'index lit `w.z ?? 0`) : chaque segment en trop est une faute.
    expect(fautes(avecMurs([{ x: 1, y: 2, side: 'N', z: 0 }, { x: 1, y: 2, side: 'N' }, { x: 1, y: 2, side: 'N', window: true }]))).toEqual([
      doublon('1,2,N,0'),
      doublon('1,2,N,0'),
    ]);
  });

  it('deux arêtes de la MÊME case sur des `side` différents sont acceptées', () => {
    expect(projetSchema.safeParse(avecMurs([{ x: 3, y: 3, side: 'N' }, { x: 3, y: 3, side: 'E' }])).success).toBe(true);
  });

  it('la même clé à des ÉTAGES différents est acceptée (`z` fait partie de l’arête)', () => {
    expect(projetSchema.safeParse(avecMurs([{ x: 3, y: 3, side: 'N' }, { x: 3, y: 3, side: 'N', z: 1 }])).success).toBe(true);
  });

  it('la DONNÉE livrée traverse : aucune arête dupliquée dans les scènes de la Diligence', () => {
    const scenes = (JSON.parse(JSON.stringify(diligenceProjet)) as { scenes: { walls?: Jouet[] }[] }).scenes;
    expect(scenes.flatMap((s) => s.walls ?? []).length).toBeGreaterThan(0);
    expect(projetSchema.safeParse(diligenceProjet).success).toBe(true);
  });
});

/**
 * CARDINAL de la grille (#1789) — `tiles`, `height` et `crenellated` sont des tableaux PARALLÈLES
 * aplatis indexés `y·w+x` : l'un d'eux plus court que `w×h` rendrait des trous au MÊME index.
 * `tileAt` (`state/scene.ts`) ne porte plus AUCUN repli de tuile ; c'est cette porte qui le permet.
 */
describe('sceneSchema — chaque tableau parallèle d’une couche porte EXACTEMENT `w×h` entrées', () => {
  const pleine = (n: number, t = 'sol') => Array.from({ length: n }, () => t);
  const avecCouches = (layers: Jouet[]): Jouet => projet({ scenes: [sceneMinimale({ layers })] });

  it('une couche AMPUTÉE est refusée, le LIEU nommant la scène et l’étage, le message la longueur et l’attendu', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(15) }]))).toEqual([
      'scenes « scene-1 » › layers « 0 » › tiles :: `tiles` porte 15 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
  });

  it('une couche TROP LONGUE est refusée de la même façon, et l’étage fautif est celui qui est nommé', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(16) }, { z: 1, tiles: pleine(17) }]))).toEqual([
      'scenes « scene-1 » › layers « 1 » › tiles :: `tiles` porte 17 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
  });

  it('`height` amputé est refusé en NOMMANT `height` — même index, même trou silencieux (`heightAt` replierait à 0 m)', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(16), height: Array.from({ length: 15 }, () => 0) }]))).toEqual([
      'scenes « scene-1 » › layers « 0 » › height :: `height` porte 15 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
  });

  it('`crenellated` amputé est refusé en NOMMANT `crenellated`, et les deux tableaux présents au cardinal passent', () => {
    expect(fautes(avecCouches([{ z: 0, tiles: pleine(16), crenellated: Array.from({ length: 4 }, () => null) }]))).toEqual([
      'scenes « scene-1 » › layers « 0 » › crenellated :: `crenellated` porte 4 entrée(s) pour une grille 4×4 — il en faut EXACTEMENT 16',
    ]);
    expect(projetSchema.safeParse(avecCouches([{ z: 0, tiles: pleine(16), height: Array.from({ length: 16 }, () => 0), crenellated: Array.from({ length: 16 }, () => null) }])).success).toBe(true);
  });

  it('les couches EXACTES passent, et une scène sans couche du tout n’invente rien', () => {
    expect(projetSchema.safeParse(avecCouches([{ z: 0, tiles: pleine(16) }, { z: 1, tiles: pleine(16, 'vide') }])).success).toBe(true);
    expect(projetSchema.safeParse(projet({ scenes: [sceneMinimale()] })).success).toBe(true);
  });

  it('la DONNÉE livrée traverse : les couches de la Diligence sont au cardinal', () => {
    const scenes = (diligenceProjet as { scenes: { layers?: { tiles: string[] }[] }[] }).scenes;
    expect(scenes.flatMap((s) => s.layers ?? []).length).toBeGreaterThan(0);
    expect(projetSchema.safeParse(diligenceProjet).success).toBe(true);
  });
});

describe('projetSchema — les quatre sémantiques du seam, chacune NOMMÉE', () => {
  it('(a) `activeAxes` référence un axe inconnu de axes.json → rouge nommant l\'index et l\'id', () => {
    expect(fautes(projet({ activeAxes: ['negoce', 'plongee-sous-marine'] }))).toEqual([
      'activeAxes.1 :: « plongee-sous-marine » est absent du catalogue des axes (axes.json).',
    ]);
  });

  it('(b) `indice.affaireId` orphelin → rouge nommant le chemin et l\'affaire manquante', () => {
    const narratif = {
      affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
      indices: [{ id: 'indice-1', affaireId: 'affaire-fantome', kind: 'indice', titre: 'x', stades: [{ id: 's1', prose: '' }] }],
      presetsPnj: [],
      objets: [],
    };
    expect(fautes(projet({ narratif }))).toEqual([
      'narratif › indices « indice-1 » › affaireId :: affaire inconnue « affaire-fantome ».',
    ]);
  });

  it('(b bis) un id de preset qui COLLISIONNE avec la règle globale → rouge nommé', () => {
    const narratif = {
      affaires: [],
      indices: [],
      presetsPnj: [{ id: 'gobelin', base: 'gobelin' }],
      objets: [],
    };
    expect(fautes(projet({ narratif }))).toEqual([
      'narratif › presetsPnj « gobelin » › id :: l\'id de preset PNJ « gobelin » collisionne avec un id de la règle globale (créature/possession).',
    ]);
  });

  it('(b ter) un preset sans base ni profil → rouge nommé (contrat de `presetPnjSchema`)', () => {
    const narratif = { affaires: [], indices: [], presetsPnj: [{ id: 'le-borgne' }], objets: [] };
    expect(fautes(projet({ narratif }))).toEqual([
      'narratif › presetsPnj « le-borgne » :: ni base ni profil (au moins l\'un des deux est requis).',
    ]);
  });

  it('(c) `entity.presetId` sans preset déclaré → rouge nommant la scène ET l\'entité', () => {
    const scenes = [sceneMinimale({ entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'le-borgne' }] })];
    expect(fautes(projet({ scenes }))).toEqual([
      'scenes « scene-1 » › entities « pnj-1 » › presetId :: preset de PNJ inconnu « le-borgne » (narratif.presetsPnj).',
    ]);
  });

  it('(c bis) le MÊME `presetId`, déclaré au narratif, est VALIDE', () => {
    const scenes = [sceneMinimale({ entities: [{ id: 'pnj-1', kind: 'personnage', pos: { x: 1, y: 1 }, presetId: 'le-borgne' }] })];
    const narratif = {
      affaires: [],
      indices: [],
      presetsPnj: [{ id: 'le-borgne', profil: { char: { CC: 40 }, traits: [] } }],
      objets: [],
    };
    expect(projetSchema.safeParse(projet({ scenes, narratif })).success).toBe(true);
  });

  it('(d) identité PLATE : `label` vide → rouge nommant le champ à la RACINE', () => {
    // `.min(1)` vient de l'ENVELOPPE (`grammaire/document.ts`) depuis #1552 : le libellé d'un document
    // n'est jamais la chaîne vide, et c'est vrai des 122 defs, pas du seul projet.
    expect(fautes(projet({ label: '' }))).toEqual([
      expect.stringMatching(/^label :: /),
    ]);
  });

  it('(d bis) identité REQUISE : chaque champ du trio AMPUTÉ est rouge, NOMMÉ', () => {
    // #1552 — arbitrage utilisateur 2026-08-31 (AskUser, verbatim choisi) : « Un projet se NOMME
    // avant d'être enregistré (Recommandé) ». `id` et `label` viennent de l'enveloppe,
    // `versionContenu` du document : les trois se mesurent PAR AMPUTATION, jamais par un refine.
    for (const cle of ['id', 'label', 'versionContenu']) {
      expect(fautes(sans(cle)), `« ${cle} » amputé doit être rouge et NOMMÉ`).toEqual([
        expect.stringMatching(new RegExp(`^${cle} :: `)),
      ]);
    }
    // Les ACCESSOIRES, eux, restent facultatifs — sur un document par ailleurs identifié.
    for (const accessoire of [{ icon: 'scenario/village' }, { desc: 'Une prose.' }, { auteur: 'Une autrice' }]) {
      const nom = Object.keys(accessoire)[0];
      expect(projetSchema.safeParse(projet(accessoire)).success, `« ${nom} » est un accessoire, jamais une exigence`).toBe(true);
    }
  });

  it('(e) le document DOIT s’annoncer : `type: \'projet\'`, et chaque scène EMBARQUÉE aussi (#1552)', () => {
    expect(fautesCodees(sans('type'))).toEqual(['type :: invalid_value ["projet"]']);
    const { type: _muette, ...sceneMuette } = sceneMinimale();
    expect(fautesCodees(projet({ scenes: [sceneMuette] }))).toEqual([
      'scenes.0.type :: invalid_value ["scene"]',
    ]);
  });

  it('(f) PROVENANCE : ni `source` ni `maison` → rouge ; l’une des deux suffit', () => {
    // Refine de FABRIQUE (`grammaire/document.ts`) : une campagne sans folio n'est pas interdite,
    // elle doit DIRE pourquoi. Mesuré au dépôt : la Diligence cite EDO, les 3 autres sont maison.
    expect(fautes(sans('maison'))).toEqual([expect.stringMatching(/^source :: /)]);
    const avecSource = { ...sans('maison'), source: { book: 'ennemi-dans-l-ombre', page: 12 } };
    expect(projetSchema.safeParse(avecSource).success).toBe(true);
  });

  it('(d ter) la poche `meta` et le `version` RACINE sont REFUSÉS par le SCEAU de l’enveloppe plate', () => {
    // Portée EXACTE de cette assertion : elle juge `projetSchema` SEUL. Par le seam réel, un `version`
    // racine n'arrive JAMAIS jusqu'ici (`parseProject` l'écrase puis le purge avant de valider —
    // mesuré par `state/projet-migration-4-vers-5.test.ts`). Le sceau est donc la garde du document
    // AU REPOS : un `.json` authioré/exporté à la mauvaise forme est nommé à la porte du schéma,
    // plutôt que d'être absorbé en silence par le seam.
    expect(fautes(projet({ version: 1 })).join(' ')).toMatch(/version/);
    expect(fautes(projet({ meta: { id: 'c', label: 'C', version: 1 } })).join(' ')).toMatch(/meta/);
  });
});

/**
 * ANCRAGE au document RÉEL (« La Diligence », le seul paquet committé à citer un folio). Le
 * projet-JOUET ci-dessus prouve la forme ; ici c'est la DONNÉE du dépôt qui traverse la porte, et
 * chaque refus est APPARIÉ à son acceptation — un rouge ne prouve rien s'il ne se distingue pas d'un
 * vert. Les FK (`activeAxes` vers `axes.json`, `presetId` intra-document) ne sont mesurables qu'ici :
 * elles exigent des ids qui EXISTENT.
 */
describe('projetSchema — le document RÉEL, ses FK et son enveloppe (sondes du juge #1552)', () => {
  const reel = () => JSON.parse(JSON.stringify(diligenceProjet)) as Jouet;
  const ok = (doc: Jouet) => projetSchema.safeParse(doc).success;
  const sansCle = (cle: string) => { const d = reel(); delete d[cle]; return d; };

  it('le document committé PARSE tel quel — et le handle déclare bien ce qu’il dit déclarer', () => {
    expect(ok(reel())).toBe(true);
    expect(projetDoc.type).toBe('projet');
    expect(projetDoc.famille).toBe('config');
  });

  it('FK `activeAxes` → axes.json : ids RÉELS acceptés (et la liste vide/absente aussi), inconnu REFUSÉ au CHEMIN', () => {
    expect(ok({ ...reel(), activeAxes: ['melee', 'tir'] }), 'axes réels refusés').toBe(true);
    expect(ok({ ...reel(), activeAxes: [] }), 'liste vide = socle de base').toBe(true);
    expect(ok(sansCle('activeAxes')), 'absente = socle de base').toBe(true);
    expect(fautes({ ...reel(), activeAxes: ['axe-qui-nexiste-pas'] })).toEqual([
      'activeAxes.0 :: « axe-qui-nexiste-pas » est absent du catalogue des axes (axes.json).',
    ]);
    // Un id qui n'est pas un AXE (c'est une compétence) est refusé comme un id inventé : la FK vise
    // `axes.json`, pas « un id connu quelque part ».
    expect(ok({ ...reel(), activeAxes: ['courage'] })).toBe(false);
  });

  it('FK intra-document `presetId` → narratif.presetsPnj : preset DÉCLARÉ accepté, fantôme REFUSÉ au CHEMIN', () => {
    const avecPreset = (presetId: string, declare: boolean): Jouet => {
      const d = reel();
      const scenes = d.scenes as Record<string, unknown>[];
      const entites = (scenes[0].entities as Record<string, unknown>[]);
      scenes[0] = { ...scenes[0], entities: [{ ...entites[0], presetId }, ...entites.slice(1)] };
      const narratif = d.narratif as { presetsPnj: unknown[] };
      if (declare) narratif.presetsPnj = [...narratif.presetsPnj, { id: presetId, profil: { char: { CC: 40 }, traits: [] } }];
      return { ...d, scenes };
    };
    expect(ok(avecPreset('preset-temoin', true)), 'preset DÉCLARÉ refusé').toBe(true);
    expect(fautes(avecPreset('preset-fantome', false))).toEqual([
      expect.stringMatching(/^scenes « [^»]+ » › entities « [^»]+ » › presetId :: preset de PNJ inconnu « preset-fantome »/),
    ]);
  });

  it('ENVELOPPE sur la donnée réelle : chaque clé d’identité amputée est rouge, NOMMÉE', () => {
    for (const cle of ['id', 'label', 'versionContenu', 'type']) {
      expect(fautes(sansCle(cle)), `« ${cle} » amputé`).toEqual([expect.stringMatching(new RegExp(`^${cle} :: `))]);
    }
    expect(fautes({ ...reel(), label: '' })).toEqual([expect.stringMatching(/^label :: /)]);
    expect(fautesCodees({ ...reel(), type: 'scene' })).toEqual(['type :: invalid_value ["projet"]']);
  });

  it('PROVENANCE réelle : la Diligence cite son folio ; sans provenance c’est rouge, les DEUX ensemble passent', () => {
    expect(reel().source, 'la Diligence cite EDO à sa racine').toBeTruthy();
    expect(fautes(sansCle('source'))).toEqual([expect.stringMatching(/^source :: /)]);
    // `source` ∨ `maison` : le refine exige AU MOINS une provenance, il n'en interdit pas deux.
    expect(ok({ ...reel(), maison: 'arbitrage maison, en plus du folio' })).toBe(true);
  });

  it('SCEAU sur la donnée réelle : `schema` non courant, clé inconnue et scène muette sont refusés', () => {
    expect(fautesCodees({ ...reel(), schema: 6 })).toEqual([`schema :: invalid_value [${SCHEMA_PROJET}]`]);
    // Chemin VIDE : la clé inconnue est rapportée à la RACINE du document.
    expect(fautesCodees({ ...reel(), champInconnu: 1 })).toEqual([' :: unrecognized_keys ["champInconnu"]']);
    const d = reel();
    const { type: _muette, ...sceneMuette } = (d.scenes as Jouet[])[0];
    expect(fautesCodees({ ...d, scenes: [sceneMuette] })).toEqual(['scenes.0.type :: invalid_value ["scene"]']);
  });
});

describe('narratifSchema — un id VIDE est refusé dans les QUATRE registres, chemin nommé', () => {
  const narratif = (over: Jouet = {}): Jouet => ({ affaires: [], indices: [], presetsPnj: [], objets: [], ...over });
  const indice = (over: Jouet = {}): Jouet => ({ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'x', stades: [{ id: 'stade-1', prose: '' }], ...over });

  it('affaire : `id` vide', () => {
    expect(fautes(narratif({ affaires: [{ id: '', titre: 'Le Marché noir' }] }), narratifSchema)).toEqual([
      'affaires.0.id :: id vide.',
    ]);
  });

  it('indice : `id` vide', () => {
    const doc = narratif({ affaires: [{ id: 'affaire-a', titre: 'x' }], indices: [indice({ id: '' })] });
    expect(fautes(doc, narratifSchema)).toEqual(['indices.0.id :: id vide.']);
  });

  it('stade d\'indice : `id` vide', () => {
    const doc = narratif({ affaires: [{ id: 'affaire-a', titre: 'x' }], indices: [indice({ stades: [{ id: '', prose: '' }] })] });
    expect(fautes(doc, narratifSchema)).toEqual(['indices « indice-1 » › stades.0.id :: id vide.']);
  });

  it('preset PNJ : `id` vide', () => {
    expect(fautes(narratif({ presetsPnj: [{ id: '', base: 'gobelin' }] }), narratifSchema)).toEqual([
      'presetsPnj.0.id :: id vide.',
    ]);
  });

  it('objet : `id` vide (contrôle — la même exigence, déjà tenue par `raffineNarratif`)', () => {
    expect(fautes(narratif({ objets: [{ id: '' }] }), narratifSchema)).toEqual([
      'objets.0.id :: id absent.',
    ]);
  });
});
