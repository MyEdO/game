/**
 * CE QUE LE GROUPE CONNAÎT (#3950) : les lecteurs de la loi de visibilité (`visibilityOf`, `src/noyau/visibility.ts`)
 * sur la vue du groupe (`computeStateVisible`) et la mémoire de carte de la scène (`explored`). Ils disent ce qui se
 * MONTRE : un combattant en vue, une entité connue, une coque montrée par le monde, un nom, le masque du monde et les
 * personnes déjà vues (#4017).
 */
import type { Combatant } from '../engine/types';
import type { Visibility } from '../data/schemas/ambiance.types';
import { ambiance, dataLabel } from '../data';
import { hash32AuMillieme } from '../lib/hash';
import { campOf } from '../engine/relations';
import { isInanimate, isStructure, structureFaceCells } from '../engine/structures';
import { enBase64 } from '../lib/base64';
import { t } from '../i18n';
import type { PlayerText } from '../i18n/playerText';
import type { EtatDeJeu, Jeu } from './etat';
import { combatGeomOfList } from './mount';
import { inBattleId, porteurParId } from './monde/combatants';
import { footprintN, footprintTiles } from './monde/footprint';
import { discTiles } from './monde/zones';
import { dansLaZoneJouable, wallOnSight, type Scene, type SceneEntity } from './monde/scene';
import { memoByRefDeps } from './monde/sceneMemo';
import { nomDEntite } from './monde/sceneNpc';
import { presetDuNarratif } from './monde/resolveursDuNarratif';
import { caseDansGrille } from './monde/opacite';
import { spaceCellKey } from './monde/volume/architectureVisibility';
import { resolveNappes } from './monde/volume/toits';
import { visibilityOf } from './visibility';
import { coquesDeLaScene, estPoseParSesPonts, type CoqueDeLaScene } from './planDeNavire';
import { garanti } from '../lib/garanti';
import { computeStateVisible, type VisionInput } from './visionState';

/** La tranche d'état que lisent les lecteurs : les entrées de la vue du groupe et la mémoire de carte. */
export type EntreesDeLaConnaissance = VisionInput & Pick<EtatDeJeu, 'explored'>;

/** L'état d'une case (clé `x,y,z`) pour le groupe. */
type Connaissance = (cle: string) => Visibility;

const RIEN_N_EST_CONNU: Connaissance = () => 'unknown';

const connaissanceDeLaScene = memoByRefDeps<Scene, Connaissance>();

/** Le lecteur de ce que le groupe connaît de la scène de `etat` : chaque case vue, explorée ou inconnue
 *  (`visibilityOf`), retenu sur l'identité de l'ensemble vu et de la liste explorée de la scène. Une case de la grille
 *  hors de la zone jouable (`dansLaZoneJouable`) est un paysage connu : au moins explorée, vue quand la vue l'atteint. */
export function connaissanceDuGroupe(etat: EntreesDeLaConnaissance): Connaissance {
  const { scene } = etat;
  if (!scene) return RIEN_N_EST_CONNU;
  const vu = computeStateVisible(etat);
  const explorees = etat.explored[scene.id];
  return connaissanceDeLaScene(scene, [vu, explorees], () => {
    const memoire = new Set(explorees);
    return (cle) => {
      const v = visibilityOf(cle, vu, memoire);
      if (v !== 'unknown') return v;
      const [x, y] = cle.split(',').map(Number);
      return caseDansGrille(scene.dimensions, x, y) && !dansLaZoneJouable(scene, x, y) ? 'explored' : v;
    };
  });
}

/** La case `c` (`x`, `y`, sa couche `z`, 0 sans elle) est-elle vue du groupe sur `etat`. */
export function caseEnVue(etat: EntreesDeLaConnaissance, c: { x: number; y: number; z?: number }): boolean {
  return connaissanceDuGroupe(etat)(spaceCellKey(c.x, c.y, c.z ?? 0)) === 'visible';
}

/** Le corps de `c` parmi les combattants de `etat`, ancré en `ancre`, est-il sur une case vue : les faces de l'arête
 *  d'une structure de siège (`structureFaceCells`), qui ne se déplace pas et ne lit donc aucun ancrage ; sinon
 *  l'empreinte de sa géométrie de combat (`combatGeomOfList`) posée en `ancre`, à défaut à sa position. */
export function corpsEnVue(etat: EntreesDeLaConnaissance, c: Combatant, ancre?: { x: number; y: number; z?: number }): boolean {
  if (isStructure(c)) {
    const z = c.structureEdge?.z ?? 0;
    return structureFaceCells(c).some((f) => caseEnVue(etat, { x: f.x, y: f.y, z }));
  }
  const corps = combatGeomOfList(etat.battle?.combatants ?? [], c);
  const pos = ancre ?? corps.pos;
  return !!pos && footprintTiles(pos, footprintN(corps)).some((p) => caseEnVue(etat, { x: p.x, y: p.y, z: pos.z }));
}

/** `c` est-il en vue du groupe : du camp du groupe, d'un couple monté dont l'un des corps l'est, ou son corps
 *  (`corpsEnVue`). */
export function combattantEnVue(etat: EntreesDeLaConnaissance, c: Combatant): boolean {
  const partenaire = c.mountId ?? c.riderId;
  const couple = partenaire ? [c, ...(etat.battle?.combatants ?? []).filter((x) => x.id === partenaire)] : [c];
  return couple.some((x) => campOf(x) === 'groupe') || corpsEnVue(etat, c);
}

/** Le porteur `id` est-il en vue : un combattant du champ (`inBattleId`) l'est par `combattantEnVue`, tout autre
 *  porteur l'est. */
export function porteurEnVue(etat: Pick<Jeu, 'battle'> & EntreesDeLaConnaissance, id: string): boolean {
  const c = inBattleId(etat.battle, id);
  return !c || combattantEnVue(etat, c);
}

/** Le lecteur des cases de zone que le groupe voit sur `etat` : une case vue (`caseEnVue`), ou d'une zone qui coupe la
 *  vue (`blocksLoS`, en `x,y` comme `rayBlocked`) montrée entière dès que le groupe en voit le bord : l'une de ses cases,
 *  ou l'une des huit voisines de même couche (`discTiles`) de l'une d'elles qu'aucune arête opaque n'en sépare
 *  (`wallOnSight`). */
export function caseDeZoneEnVue(etat: Pick<Jeu, 'battle'> & EntreesDeLaConnaissance): (c: { x: number; y: number; z?: number }) => boolean {
  const { scene } = etat;
  const bordVu = (t: { x: number; y: number; z?: number }) => !!scene && discTiles(t, 1, t.z).some((v) => caseEnVue(etat, v) && !wallOnSight(scene, v, t, t.z ?? 0));
  const montrees = new Set((etat.battle?.zones ?? []).filter((z) => z.blocksLoS && z.tiles.some(bordVu)).flatMap((z) => z.tiles.map((t) => `${t.x},${t.y}`)));
  return (c) => caseEnVue(etat, c) || montrees.has(`${c.x},${c.y}`);
}

/** Une entité posée en embuscade (`combat.hiddenUntilCombat`). */
export const enEmbuscade = (e: Pick<SceneEntity, 'combat'>): boolean => !!e.combat?.hiddenUntilCombat;

/** L'entité `e` est-elle connue du groupe : jamais en embuscade ; un `personnage` sur une case vue, toute autre entité
 *  sur une case vue ou explorée. */
export function entiteConnue(etat: EntreesDeLaConnaissance, e: SceneEntity): boolean {
  if (enEmbuscade(e)) return false;
  const v = connaissanceDuGroupe(etat)(spaceCellKey(e.pos.x, e.pos.y, e.z ?? 0));
  return e.kind === 'personnage' ? v === 'visible' : v !== 'unknown';
}

/** Les coques que `scene` montre par le monde (`coquesDeLaScene`) que le groupe voit : un navire posé par ses ponts,
 *  qui est le plateau, toujours ; une coque terrestre par son combattant en vue (`combattantEnVue`) au combat, sinon
 *  connue (`entiteConnue`), jamais en embuscade. */
export function coquesEnVue(etat: Pick<Jeu, 'battle'> & EntreesDeLaConnaissance, scene: Scene): CoqueDeLaScene[] {
  return coquesDeLaScene(scene).filter(({ id }) => {
    if (estPoseParSesPonts(scene, id)) return true;
    const c = inBattleId(etat.battle, id);
    return c ? combattantEnVue(etat, c) : entiteConnue(etat, garanti(scene.entities.find((e) => e.id === id), id, 'entité de coque'));
  });
}

/** Le nom du porteur que le groupe voit. */
export function nomObserve(c: Combatant): PlayerText {
  // eslint-disable-next-line murs/marques -- #4017 : minteur de PlayerText pour un combattant que le groupe voit.
  return c.label as PlayerText;
}

/** Le nom du porteur `id` tel que le groupe le connaît : son `label` s'il est en vue (`porteurEnVue`), sinon le nom
 *  neutre `vision.horsDeVue` ; `null` sans porteur. */
export function nomEnVue(etat: Jeu, id: string): PlayerText | null {
  if (!porteurEnVue(etat, id)) return t('vision.horsDeVue');
  const c = porteurParId(etat, id);
  return c ? nomObserve(c) : null;
}

type EtatDesPersonnesVues = EntreesDeLaConnaissance & Pick<EtatDeJeu, 'personnesVues' | 'campaignNarratif'>;

function memoireDesPersonnes(etat: Pick<EtatDesPersonnesVues, 'scene' | 'personnesVues'>): Record<string, PlayerText> | undefined {
  const { scene, personnesVues } = etat;
  return scene && Object.prototype.hasOwnProperty.call(personnesVues, scene.id) ? personnesVues[scene.id] : undefined;
}

/** Le groupe a-t-il déjà observé cette personne sur cette scène (#4017) ? */
export function personneDejaVue(etat: Pick<EtatDesPersonnesVues, 'scene' | 'personnesVues'>, id: string): boolean {
  const noms = memoireDesPersonnes(etat);
  return !!noms && Object.prototype.hasOwnProperty.call(noms, id);
}

/** Le dernier nom d'une personne observée sur cette scène (#4017). */
export function nomDejaVu(etat: Pick<EtatDesPersonnesVues, 'scene' | 'personnesVues'>, id: string): PlayerText | undefined {
  return personneDejaVue(etat, id) ? memoireDesPersonnes(etat)![id] : undefined;
}

/** Les personnes vues sur cette écriture, jointes à la mémoire de la scène (#4017). */
export function memoriserLesPersonnesVues(etat: EtatDesPersonnesVues): EtatDeJeu['personnesVues'] | undefined {
  const { scene, battle, personnesVues } = etat;
  if (!scene) return undefined;
  const anciensNoms = memoireDesPersonnes(etat);
  const observations: [string, PlayerText][] = [];
  const noter = (id: string, nom: PlayerText) => {
    if (anciensNoms?.[id] !== nom) observations.push([id, nom]);
  };
  if (battle) {
    for (const c of battle.combatants) {
      if (!isInanimate(c) && combattantEnVue(etat, c)) noter(c.id, nomObserve(c));
    }
  } else {
    const presetDe = presetDuNarratif(etat.campaignNarratif);
    for (const e of scene.entities) {
      if (e.kind !== 'personnage' || !entiteConnue(etat, e)) continue;
      const nom = nomDEntite(e, presetDe);
      if (nom !== undefined) noter(e.id, dataLabel(nom));
    }
  }
  return observations.length
    ? { ...personnesVues, [scene.id]: { ...anciensNoms, ...Object.fromEntries(observations) } }
    : undefined;
}

/** L'octet d'une case au masque de la vision. */
const OCTET: Record<Visibility, number> = { unknown: 0, explored: 128, visible: 255 };

/**
 * La vision du monde (`visionDuMonde`) : ce que le groupe connaît de chaque case de la scène.
 * @contrat Monde
 */
export interface VisionDuMonde {
  /** en base64, deux suites de plans de `h` rangées de `w` octets, un plan par couche dans l'ordre de
   *  `scene.layers`, un octet par case, 0 inconnue, 128 explorée, 255 vue. D'abord le plan `sol` de chaque couche :
   *  la couche d'indice `i` aux rangées `i·h` à `i·h + h − 1`, l'état de chaque case. Puis, `n` étant le nombre de
   *  couches, le plan `toit` de chaque couche, aux rangées `(n + i)·h` à `(n + i)·h + h − 1`, celui que lit une
   *  nappe de toit ou une couronne : sur l'emprise d'une nappe de cette couche, l'état de son pied (`etatDuPied`),
   *  ailleurs celui du plan `sol`. */
  masque: string;
  /** `w`, les cases d'une rangée. */
  largeur: number;
  /** `2 × h` × le nombre de couches : les plans `sol`, puis les plans `toit`. */
  rangees: number;
  /** `h`, les rangées d'un plan. */
  rangeesParPlan: number;
  /** la part de lumière de chaque état (`ambiance.fogTint`). */
  teintes: Record<Visibility, number>;
}

/** Un état dont la scène est posée. */
type AvecScene = EntreesDeLaConnaissance & { scene: Scene };

const masqueDeLaScene = memoByRefDeps<Scene, { masque: string; cle: string }>();

/** Le masque de la vision de la scène de `etat` et son empreinte, retenus sur l'identité de l'ensemble vu et de la
 *  liste explorée de la scène. */
function masqueDe(etat: AvecScene): { masque: string; cle: string } {
  const { scene } = etat;
  return masqueDeLaScene(scene, [computeStateVisible(etat), etat.explored[scene.id]], () => {
    const { w, h } = scene.dimensions;
    const connue = connaissanceDuGroupe(etat);
    const n = scene.layers.length;
    const octets = new Uint8Array(2 * n * h * w);
    scene.layers.forEach(({ z }, i) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) octets[(i * h + y) * w + x] = OCTET[connue(spaceCellKey(x, y, z))];
    });
    octets.copyWithin(n * h * w, 0, n * h * w);
    const toits = new Map<number, number>();
    for (const { mass, cells } of resolveNappes(scene).values()) {
      const i = scene.layers.findIndex((l) => l.z === mass.z);
      if (i < 0) continue;
      const octet = OCTET[etatDuPied(mass.z, cells, connue)];
      for (const key of cells) {
        const [x, y] = key.split(',').map(Number);
        if (!caseDansGrille(scene.dimensions, x, y)) continue;
        const rang = ((n + i) * h + y) * w + x;
        toits.set(rang, Math.max(toits.get(rang) ?? 0, octet));
      }
    }
    for (const [rang, octet] of toits) octets[rang] = octet;
    return { masque: enBase64(octets), cle: hash32AuMillieme(octets).toString(36) };
  });
}

/** La vision du monde de la scène de `etat` (`VisionDuMonde`). PUR. */
export function visionDuMonde(etat: AvecScene): VisionDuMonde {
  const { w, h } = etat.scene.dimensions;
  return { masque: masqueDe(etat).masque, largeur: w, rangees: 2 * h * etat.scene.layers.length, rangeesParPlan: h, teintes: ambiance.fogTint };
}

/** L'état du PIED d'une masse de niveau `z` et d'emprise `cells` (#950) : le meilleur des cases de son emprise élargie
 *  d'1 (on voit un bâtiment quand on voit le sol à son pied, l'intérieur restant derrière ses murs), aux niveaux 0 à
 *  `z`. */
function etatDuPied(z: number, cells: ReadonlySet<string>, connue: (cle: string) => Visibility): Visibility {
  let explore = false;
  for (const key of cells) {
    const [x, y] = key.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (let lvl = 0; lvl <= z; lvl++) {
          const etat = connue(spaceCellKey(x + dx, y + dy, lvl));
          if (etat === 'visible') return 'visible';
          explore ||= etat === 'explored';
        }
  }
  return explore ? 'explored' : 'unknown';
}

/** L'empreinte des octets du masque de la vision de `etat` (`hash32AuMillieme`, base 36). PUR. */
export function cleDeLaVision(etat: AvecScene): string {
  return masqueDe(etat).cle;
}
