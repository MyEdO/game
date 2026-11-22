/**
 * LES ÉCHANTILLONS FIGÉS DE L'ATELIER (#3802) : ce que la recette native du décor
 * (`projet/recettes/atelier-du-decor.gd`) lit, figé par la sonde (`construire.mjs --sonde`) dans la copie du projet
 * qu'elle importe. L'atelier figé sur la base humanoïde du dossier des modèles (`figerLAtelier`), qui l'ouvre, la
 * réponse du pont à `echantillons`, sous la clé de son entrée absente, et sa réponse à `echantillon` sur chaque entrée
 * de `entreesDeLaRecette`, sous la clé de cette entrée (`cleDEntree`), celle que la recette calcule de l'entrée que
 * l'atelier envoie. L'atelier garde aussi chaque élément `decor` du dossier, l'échantillon d'un décor qui en a un se
 * montrant par son modèle, et chaque élément `arete`, que les recettes des arêtes posent
 * (`projet/recettes/arete-au-pied.gd`, `aretes-en-instances.gd`, #4471). Pour la recette de la coïncidence
 * (`projet/recettes/decor-sur-ses-primitives.gd`), `caps` : l'échantillon de `ASYMETRIQUE` à chaque cap de `CAPS`, son
 * volume et ses décors servis comme la vue les sert (`DecorServi`) ; et `coiffe` : ce même échantillon posé sur un bloc
 * plein (`coiffeUnBloc`), son volume, ses décors servis, et le retrait que rend le noyau sous sa couche
 * (`retraitDuMonde`), qui retire le plan `pose` de chaque case et laisse montré son plan `sol` (`capsSolid`) ; et
 * `luminaire` : l'échantillon de `LUMINEUX`, son volume et ses décors servis, dont chaque pose éclaire ; et
 * `paletteDesAretes` : la palette que les recettes des arêtes donnent à leurs arêtes servies (`paletteDeLApparence`) ;
 * et `volee` : la réponse de `echantillon` sur le sol `SOL_A_MARCHES`, dont la recette des côtés de marches pose les
 * côtés (`projet/recettes/cotes-de-marches.gd`, #4471) ; et `toit` : par plateau de `PLATEAUX_DU_TOIT` mètres par case,
 * l'échantillon de la couverture `TOIT` à cette échelle (`echantillonDessine`), dont la recette des pièces de toit pose
 * les pièces sur les nappes (`projet/recettes/pieces-de-toit.gd`, #4471), et, sous la clé `diligence`, la scène
 * `la-diligence` (`diligenceCampaign`) dessinée de même sans ses morceaux, dont des arêtes voisines se joignent bout à
 * bout. L'atelier garde aussi chaque élément `escalier` et
 * `toit` du dossier.
 */
import { figerLAtelier, type Listage } from './atelier';
import { cleDEntree } from './vehicule';
import {
  echantillonDessine, paletteDeLApparence, posesDesDecors, retraitDuMonde, sceneDEchantillon, structureAppearances, volumeDuMonde, type Scene,
} from '../../../src/noyau/index';
import type { Dir4 } from '../../../src/geometry/dir8';
import { tableTotale } from '../../../src/lib/tableTotale';
import { diligenceCampaign, paquetDuJeu } from '../../../src/scenes/campaign';

/** Les entrées de `echantillon` que l'atelier envoie, dans l'ordre des gestes de la recette : un décor, la mer, une
 *  matière de relief, une matière de toit et `MUR_CRENELE`, dont la brèche abat la couronne et dont la case crénelée
 *  porte la crête. `entreesDeLaRecette` y ajoute un mur de chaque autre famille dont le modèle d'arête est servi. */
const ENTREES: readonly Record<string, unknown>[] = [
  { famille: 'decor', id: 'tonneau' },
  { famille: 'decor', id: 'arbre-mort' },
  { famille: 'sol', id: 'eau' },
  { famille: 'relief', id: 'pierre' },
  { famille: 'toit', id: 'chaume' },
];

/** L'apparence de mur crénelé (`parapet`) que la recette pose, de la famille `moellons`. */
const MUR_CRENELE = 'mur-en-pierre';

/** `ENTREES`, `MUR_CRENELE`, puis, pour chaque famille de `aretes` (les modèles d'arête servis, réponse de `modeles`)
 *  autre que celle de `MUR_CRENELE`, la première apparence de `structureAppearance.json` de cette famille (#4471) : un
 *  kit servi se recette dès son import, sans liste propre à la recette. */
function entreesDeLaRecette(aretes: Record<string, string>): Record<string, unknown>[] {
  const famille = (id: string) => structureAppearances.find((a) => a.id === id)?.kit;
  const murs = Object.keys(aretes).filter((kit) => kit !== famille(MUR_CRENELE))
    .map((kit) => {
      const apparence = structureAppearances.find((a) => a.kit === kit);
      if (!apparence) throw new Error(`modèle d'arête servi pour la famille ${kit}, qu'aucune apparence ne porte`);
      return apparence.id;
    });
  return [...ENTREES, ...[MUR_CRENELE, ...murs].map((id) => ({ famille: 'mur', id }))];
}

/** Le décor asymétrique de la recette de la coïncidence, et les caps où elle le pose : celui de sa recette telle
 *  qu'authorée, puis un cap tourné. */
const ASYMETRIQUE = 'arbre-mort';
const CAPS: readonly Dir4[] = ['S', 'E'];

/** Le décor qui éclaire de la recette de la coïncidence : sa pose porte `luminaire`. */
const LUMINEUX = 'lampadaire';

/** Le sol bâti dont l'échantillon porte une volée (`sceneDuSol`, `src/noyau/monde/echantillons.ts`), que pose la
 *  recette des côtés de marches (`projet/recettes/cotes-de-marches.gd`, #4471). */
const SOL_A_MARCHES = 'plancher';

/** La couverture dont l'échantillon porte les pièces de toit que pose la recette des pièces de toit
 *  (`projet/recettes/pieces-de-toit.gd`, #4471), et les échelles de plateau, en mètres par case, où elle les pose. */
const TOIT = 'toit-ardoise';
const PLATEAUX_DU_TOIT = [2, 3] as const;

/** Les apparences de la palette des arêtes servies des recettes : la porte, et le mur qui la porte
 *  (`paletteDeLApparence`), choisies pour que chaque emplacement y ait sa couleur (`paletteDistincte`). */
const PORTE_DES_ARETES = 'porte-de-ville';
const MUR_DES_ARETES = 'mur-a-ossature-en-bois';

/** L'apparence `id` de `structureAppearance.json`. */
function apparenceNommee(id: string) {
  const trouvee = structureAppearances.find((a) => a.id === id);
  if (!trouvee) throw new Error(`apparence ${id} absente de structureAppearance.json`);
  return trouvee;
}

/** La palette des arêtes servies (`paletteDeLApparence` de `PORTE_DES_ARETES` portée par `MUR_DES_ARETES`), refusée
 *  si deux emplacements y ont la même couleur : la recette ne distinguerait plus une surface peinte de la couleur d'un
 *  autre emplacement. */
function paletteDistincte(): Record<string, string> {
  const palette = paletteDeLApparence(apparenceNommee(PORTE_DES_ARETES), apparenceNommee(MUR_DES_ARETES));
  const doublons = Object.entries(palette).filter(([emplacement, couleur]) =>
    Object.entries(palette).some(([autre, sienne]) => autre !== emplacement && sienne === couleur));
  if (doublons.length) {
    throw new Error(`palette des arêtes servies (${PORTE_DES_ARETES} sur ${MUR_DES_ARETES}) à couleurs partagées : `
      + `${doublons.map(([emplacement, couleur]) => `${emplacement} ${couleur}`).join(', ')}`);
  }
  return palette;
}

/** Le bloc plein (`solidHeightM` de `terrains.json`) que coiffe la couche du décor de `coiffeUnBloc`, et la hauteur,
 *  en mètres, de la couche qui le coiffe : celle de son dessus. */
const BLOC = 'mur';
const DESSUS_DU_BLOC_M = 4;

/** `scene` élevée d'une couche : chaque case de sa couche 0 en `BLOC`, une couche 1 de `pierre` qui la coiffe à
 *  `DESSUS_DU_BLOC_M`, et chaque entité posée sur cette couche 1. */
function coiffeUnBloc(scene: Scene): Scene {
  const [rez] = scene.layers;
  return {
    ...scene,
    layers: [
      { ...rez, tiles: rez.tiles.map(() => BLOC) },
      { z: 1, tiles: rez.tiles.map(() => 'pierre'), height: rez.tiles.map(() => DESSUS_DU_BLOC_M) },
    ],
    entities: scene.entities.map((e) => ({ ...e, z: 1 })),
  };
}

/** L'échantillon dessiné `e` sans les morceaux de son volume : ses nappes et ses faîtières s'y posent seules. */
const sansMorceaux = <E extends { monde: { morceaux: unknown[] } }>(e: E): E => ({ ...e, monde: { ...e.monde, morceaux: [] } });

/** Les échantillons figés : l'atelier figé sur la base humanoïde et les éléments `decor`, `arete`, `escalier` et `toit`
 *  de `listage`, la
 *  réponse de `echantillons` sous la clé de l'entrée absente, par clé d'entrée (`cleDEntree`), la réponse de
 *  `echantillon` à chacune de `entreesDeLaRecette`, par cap de `CAPS`, l'échantillon de `ASYMETRIQUE` tourné à ce
 *  cap (`caps`), cet échantillon sur un bloc plein avec le retrait sous sa couche (`coiffe`), et l'échantillon de
 *  `LUMINEUX` (`luminaire`), la palette des arêtes servies (`paletteDesAretes`), et l'échantillon de
 *  `SOL_A_MARCHES` (`volee`), et celui de `TOIT` à chaque échelle de `PLATEAUX_DU_TOIT` (`toit`). */
export function figerLeDecor(listage: Listage) {
  const { fige, appel } = figerLAtelier(listage,
    (id, { categorie }) => id === 'humanoide' || categorie === 'decor' || categorie === 'arete' || categorie === 'escalier' || categorie === 'toit');
  /** Le volume de `scene` et le décor `id` tel que l'échantillon le sert, aux poses de `scene`. */
  const figee = (id: string, scene: Scene) => {
    type Servis = { decors: Record<string, Record<string, unknown>> };
    const servi = (appel('echantillon', { famille: 'decor', id }) as Servis).decors[id];
    return { monde: volumeDuMonde(scene), decors: { [id]: { ...servi, poses: posesDesDecors(scene) } } };
  };
  const caps = tableTotale(CAPS, (cap) => {
    const scene = sceneDEchantillon('decor', ASYMETRIQUE);
    const entities = scene.entities.map((e) => (e.kind === 'prop' ? { ...e, facing: cap } : e));
    return figee(ASYMETRIQUE, { ...scene, entities });
  });
  const coiffee = coiffeUnBloc(sceneDEchantillon('decor', ASYMETRIQUE));
  const coiffe = { ...figee(ASYMETRIQUE, coiffee), retrait: retraitDuMonde(coiffee, 0) };
  return {
    ...fige,
    echantillons: { [cleDEntree(null)]: appel('echantillons') },
    echantillon: Object.fromEntries(entreesDeLaRecette(fige.modeles.aretes as Record<string, string>)
      .map((e) => [cleDEntree(e), appel('echantillon', e)])),
    caps,
    coiffe,
    luminaire: figee(LUMINEUX, sceneDEchantillon('decor', LUMINEUX)),
    paletteDesAretes: paletteDistincte(),
    volee: appel('echantillon', { famille: 'sol', id: SOL_A_MARCHES }),
    toit: {
      ...tableTotale(PLATEAUX_DU_TOIT.map(String), (_, i) => echantillonDessine({ ...sceneDEchantillon('toit', TOIT), metresPerTile: PLATEAUX_DU_TOIT[i] })),
      diligence: sansMorceaux(echantillonDessine(paquetDuJeu(diligenceCampaign).scenes.find((s) => s.id === 'la-diligence')!)),
    },
  };
}
