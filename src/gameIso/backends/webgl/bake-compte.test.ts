/**
 * COMPTEURS DU BAKE — la garde de PROVENANCE de la géométrie du monde (#1176, C6).
 *
 * Ce que tient ce fichier n'est pas une politique de rendu : c'est un TÉMOIN CHIFFRÉ. Toute passe qui
 * touche la conversion monde (`worldTris`), les builders du pivot ou les catalogues d'épaisseur doit
 * voir ici, en un run, si elle a bougé la masse de triangles — et de combien.
 *
 * POURQUOI ELLE EXISTE : un lot de C6 (épaisseurs en donnée) a été annoncé « géométrie inchangée » en
 * comparant des compteurs à une baseline PÉRIMÉE (relevée avant #1300). Le fond était juste, la
 * PROVENANCE était fausse — et rien dans l'arbre ne pouvait le dire. Une table de compteurs datée, elle,
 * le dit : elle rougit sur l'écart réel, pas sur celui qu'on croit mesurer.
 *
 * SUR QUOI LE CHIFFRE SE PREND — sur des scènes CONSTRUITES ICI, et SANS AUCUNE ENTITÉ. Deux entrées
 * VIVANTES rendraient le compte non déterministe, et chacune a été mesurée :
 *  1. une CARTE LIVRÉE bouge sous le pinceau de son auteur ou sous son générateur (#1709, arbitrage
 *     2026-09-07, verbatim de l'utilisateur : « Franchement si on veut faire de test, faites les sur
 *     des scenes créé spécialement pour ces tests, pas sur des scénes qui sont utilisés ») — mesuré :
 *     une armoire déplacée d'une case et un coffre déplacé d'une case font 23 352 → 23 400 triangles
 *     au hub de l'Arène, et le motif vaut pour toute carte livrée ;
 *  2. le CATALOGUE DE DÉCOR (`src/data/props.json`) est vivant et RETOUCHABLE sans changer aucune
 *     cote : `buildProps` ne cuit que des recettes résolues par `findPropById` (aucune recette ne se
 *     passe en objet), donc toute scène qui POSE un décor hérite de ce catalogue — mesuré : passer le
 *     `tonneau` de 16 à 12 facettes fait 2 770 → 2 674 triangles. Une scène meublée ne peut donc pas
 *     porter de compte exact ; elle reste couverte par l'ORDRE des régimes, qu'une facette ne renverse
 *     pas.
 * Les scènes livrées ET la scène meublée restent couvertes par les invariants SANS chiffre plus bas :
 * une carte livrée par l'index IDENTITÉ et par la comptabilité de `SANS_CHIFFRE` (couverte, jamais
 * figée) ; la salle MEUBLÉE, qui est une fixture, par l'index identité ET par la hiérarchie des
 * régimes — aucune masse de carte livrée n'est comparée à une autre. La garde `aucun étalon chiffré
 * ne pose d'entité` ci-dessous tient la règle 2 par construction, et non par cette prose.
 *
 * POLITIQUE DE MISE À JOUR — la seule admise :
 *  - un changement de géométrie VOULU des BUILDERS (épaisseur authorée, nouvelle face émise, volume
 *    d'une part de mur) met à jour la table DANS LE MÊME COMMIT, avec la mesure et sa raison au message ;
 *  - un ajustement AVEUGLE des nombres « pour faire passer la garde » est exactement ce que ce fichier
 *    existe pour rendre impossible : la valeur REÇUE que l'échec affiche est la mesure courante, mais
 *    elle ne devient un témoin qu'accompagnée de la raison du déplacement.
 */
import { describe, expect, it } from 'vitest';
import { bakeWorldGeometry } from './sceneMeshes';
import { parseProject } from '../../../state/worldMap';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity, type Terrain } from '../../../state/scene';
import { putLayer } from '../../../state/sceneEdit';
import { perimeterWallSegs } from '../../../state/sceneEdit.testkit';
import { scenario as diligence } from '../../../scenes/test-scenarios/diligence';
import { lireProjetLivre } from '../../../../scripts/source/projetLivre.mjs';

const projet: Scene[] = parseProject(
  lireProjetLivre('arene/arene-projet.json'),
).scenes;
const sceneDuProjet = (id: string): Scene => {
  const s = projet.find((x) => x.id === id);
  if (!s) throw new Error(`scène étalon absente du projet : ${id}`);
  return s;
};

/** Compteurs MESURÉS au bake — la sortie EXACTE que la table ci-dessous fige. */
function compteursDe(scene: Scene): { sommets: number; triangles: number; spans: number } {
  const baked = bakeWorldGeometry(scene, sceneMetresPerTile(scene), 'jeu');
  const sommets = baked.geometry.getAttribute('position').count;
  return { sommets, triangles: sommets / 3, spans: baked.spans.length };
}

// ── SCÈNES ÉTALONS, CONSTRUITES ICI ────────────────────────────────────────────────────────────────
const SIZE = 16;
const SALLE = { x: 2, y: 2, w: 8, h: 6 };
const dans = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

/** Couche PLEINE sur les rectangles donnés, `vide` (ou `herbe` au rez) ailleurs. */
function couche(scene: Scene, z: number, rects: { x: number; y: number; w: number; h: number }[]): Scene {
  const tiles: Terrain[] = new Array(SIZE * SIZE).fill(z === 0 ? 'herbe' : 'vide');
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) if (rects.some((r) => dans(r, x, y))) tiles[y * SIZE + x] = 'pierre';
  return putLayer(scene, z, tiles);
}

/** UNE salle close, plain-pied, SANS aucune entité : le plancher de comparaison. */
function salleNue(): Scene {
  const sc = couche({ ...emptyScene(SIZE, SIZE), id: 'fixture-salle-nue' }, 0, [SALLE]);
  sc.walls = perimeterWallSegs([SALLE]);
  sc.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }];
  return sc;
}

/** La même salle, coiffée d'un ÉTAGE — toujours SANS entité : plancher z1, donc une nappe DÉRIVÉE
 *  portée à z1 sur deux niveaux (mesuré : aucun élément de mur n'est émis à z1, l'élévation est celle
 *  de la masse). Le second régime que le chiffre peut tenir. */
function corpsAEtage(): Scene {
  const sc = couche(salleNue(), 1, [SALLE]);
  sc.id = 'fixture-corps-a-etage';
  sc.walls = perimeterWallSegs([SALLE]);
  return sc;
}

/** La salle MEUBLÉE de décors du catalogue — SANS compte exact (cf. en-tête, point 2) : elle mesure
 *  que le décor PÈSE, ce qu'aucune retouche de facettes ne renverse. */
function salleMeublee(): Scene {
  const sc = salleNue();
  sc.id = 'fixture-salle-meublee';
  sc.entities = ['tonneau', 'caisse', 'coffre', 'table', 'banc', 'etagere'].map((ref, i) => ({
    id: `decor-${ref}`, kind: 'prop', ref, pos: { x: SALLE.x + 1 + i, y: SALLE.y + 1 }, facing: 'S',
  } as SceneEntity));
  return sc;
}

/**
 * TABLE DATÉE — mesurée le 2026-09-08 sur les scènes construites ci-dessus. `spans` = une face du
 * pivot ; `triangles` = ce que le GPU dessine ; `sommets` = l'index IDENTITÉ (aucun sommet partagé,
 * donc exactement 3 par triangle). Aucune de ces scènes ne pose d'entité : leur compte ne dépend que
 * des BUILDERS.
 */
const ETALONS: [string, () => Scene, { sommets: number; triangles: number; spans: number }][] = [
  ['fixture-salle-nue', salleNue, { sommets: 6282, triangles: 2094, spans: 528 }],
  ['fixture-corps-a-etage', corpsAEtage, { sommets: 7194, triangles: 2398, spans: 628 }],
];

/** SCÈNES COUVERTES SANS CHIFFRE — leur masse dépend d'une donnée VIVANTE : la carte d'un auteur (ou
 *  de son générateur) pour les trois premières, le catalogue de décor pour la quatrième. Les
 *  invariants sans chiffre ci-dessous les couvrent de bout en bout. */
const SANS_CHIFFRE: [string, () => Scene, string][] = [
  ['arene-zone13', () => sceneDuProjet('arene-zone13'), 'carte livrée (générateur d’auteur)'],
  ['arene-hub', () => sceneDuProjet('arene-hub'), 'carte livrée (générateur d’auteur)'],
  ['la-diligence', () => diligence.construire().scene, 'carte livrée (authoring au studio)'],
  ['fixture-salle-meublee', salleMeublee, 'pose des décors du catalogue vivant `props.json`'],
];

/** Toutes les scènes couvertes — étalonnées au chiffre, ou couvertes sans chiffre. */
const SCENES: [string, () => Scene][] = [
  ...ETALONS.map(([id, charger]): [string, () => Scene] => [id, charger]),
  ...SANS_CHIFFRE.map(([id, charger]): [string, () => Scene] => [id, charger]),
];

const GUIDE =
  'compteurs de bake mesurés 2026-09-08 sur des scènes CONSTRUITES et SANS ENTITÉ — seules les faces des '
  + 'BUILDERS y entrent (ni carte d’auteur, ni catalogue `props.json`). Si la géométrie a changé '
  + 'VOLONTAIREMENT, recopie la valeur REÇUE ci-dessus dans `ETALONS` ET dis dans le commit CE QUI l’a '
  + 'déplacée (épaisseur authorée, face neuve d’un builder). Sinon, c’est une dérive de géométrie non '
  + 'voulue : ne touche pas la table, trouve la cause.';

describe('COMPTEURS DU BAKE — la masse de géométrie de chaque scène étalon', () => {
  for (const [id, charger, attendu] of ETALONS)
    it(`${id} : ${attendu.triangles} triangles / ${attendu.spans} faces, au compte exact`, () => {
      expect(compteursDe(charger()), GUIDE).toEqual(attendu);
    });

  it('aucun étalon CHIFFRÉ ne pose d’entité — sinon le catalogue vivant décide du compte', () => {
    for (const [id, charger] of ETALONS)
      expect(charger().entities, `${id} : une entité ici, et une retouche de \`props.json\` rougit la table`).toEqual([]);
    // Et les étalons chiffrés EXERCENT bien la géométrie qu'ils prétendent témoigner.
    for (const [id, , attendu] of ETALONS) expect(attendu.spans, `${id} : étalon sans aucune face`).toBeGreaterThan(0);
  });

  it('ce qui dépend d’une donnée VIVANTE n’a pas de compte exact — mais reste couvert', () => {
    for (const [id, , raison] of SANS_CHIFFRE) {
      expect(ETALONS.some(([n]) => n === id), `${id} — ${raison} : jamais de compte figé`).toBe(false);
      expect(SCENES.some(([n]) => n === id), `${id} — ${raison} : mais elle reste couverte`).toBe(true);
    }
  });

  it('l’index reste IDENTITÉ partout : 3 sommets par triangle, aucun partage', () => {
    for (const [id, charger] of SCENES) {
      const c = compteursDe(charger());
      expect(c.sommets, id).toBe(c.triangles * 3);
    }
  });

  it('chaque régime PÈSE : l’étage et le décor ajoutent de la masse (une salle nue ne pèse pas une ville meublée)', () => {
    const triangles = (charger: () => Scene) => compteursDe(charger()).triangles;
    const nue = triangles(salleNue);
    expect(nue).toBeLessThan(triangles(corpsAEtage)); // nappe dérivée portée à z1 sur deux niveaux
    expect(nue).toBeLessThan(triangles(salleMeublee)); // volumes de décor, quel que soit leur facettage
  });
});
