/**
 * LA SCÈNE À DEUX PIÈCES et son contexte de prise — fixture PARTAGÉE (#1788).
 *
 * Deux lecteurs, un seul montage : le contrat (`arete-dans-la-chaine.test.ts`, ce que le pixel d'un
 * seuil REND) et le banc (`arete-dans-la-chaine.bench.ts`, ce que le balayage COÛTE). Un montage
 * recopié des deux côtés dériverait, et le banc cesserait de mesurer ce que le contrat prouve.
 */
import { emptyScene, type Scene } from '../../state/scene';
import type { RoomPortal } from '../../state/roomPortals';
import { aretesUtilisables } from '../../state/aretes';
import { type Dims } from '../../geometry/iso';
import { poseFromDims } from './projection';
import { projeterAretes } from './aretesProjetees';
import type { CadreDePick, EtatDePick } from './pickResolve';

export const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

/** Une salle 8×8 cloisonnée par un mur percé de DEUX accès : une porte et un passage. */
export function scèneÀDeuxPièces(): Scene {
  const s = emptyScene(8, 8);
  s.walls = [
    ...[0, 3, 4, 5, 7].map((y) => ({ x: 3, y, side: 'E' as const })),
    { x: 3, y: 2, side: 'E' as const, door: true },
  ];
  return s;
}

/** Les accès que l'hôte calcule (`portalsForParty`) sur cette cloison — posés ici en littéraux : ce
 *  montage porte la CHAÎNE, pas le zonage de pièces. */
export const PORTAILS: readonly RoomPortal[] = [
  {
    id: '3,2,E,0:a:b', z: 0, edge: { x: 3, y: 2, side: 'E' },
    fromZoneId: 'a', toZoneId: 'b', kind: 'door-closed', exterior: false,
    from: { x: 3, y: 2 }, to: { x: 4, y: 2 },
  },
  {
    id: '3,6,E,0:a:b', z: 0, edge: { x: 3, y: 6, side: 'E' },
    fromZoneId: 'a', toZoneId: 'b', kind: 'passage', exterior: false,
    from: { x: 3, y: 6 }, to: { x: 4, y: 6 },
  },
];

const toutVisible = (scene: Scene): Set<string> => {
  const vu = new Set<string>();
  for (let x = 0; x < scene.dimensions.w; x += 1)
    for (let y = 0; y < scene.dimensions.h; y += 1) vu.add(`${x},${y},0`);
  return vu;
};

export const milieu = (a: { cx: number; cy: number }, b: { cx: number; cy: number }) =>
  ({ x: (a.cx + b.cx) / 2, y: (a.cy + b.cy) / 2 });

/** Un acteur que le rayon peut NOMMER, pour le volet « aucune arête offerte ». */
export const acteur = { id: 'e1', pos: { x: 0, y: 0, z: 0 } };

export const etat = (scene: Scene, partyPos = { x: 0, y: 0 }): EtatDePick =>
  ({ scene, mode: 'exploration', battle: null, partyPos }) as EtatDePick;

/** Le contexte de l'hôte pour les seules PORTES, tel que `MondeDeCampagne` le bâtit. */
export function aretesDePortes(scene: Scene, portails: readonly RoomPortal[], dims: Dims) {
  return projeterAretes(
    aretesUtilisables({ scene, visible: toutVisible(scene), controleur: null, activeZ: 0, portails }),
    dims,
    () => 0,
  );
}

/** Le montage complet : la scène, ses arêtes projetées, et les deux cadres de prise (avec / sans
 *  arêtes offertes) que la chaîne oppose. */
export function montage() {
  const scene = scèneÀDeuxPièces();
  const dims = dimsDe(scene);
  const pose = poseFromDims(dims);
  const portails = PORTAILS;
  const aretes = aretesDePortes(scene, portails, dims);
  const cadre: CadreDePick = { pose, dims, activeZ: 0, aretes };
  const sansAretes: CadreDePick = { ...cadre, aretes: [] };
  return { scene, dims, pose, portails, aretes, cadre, sansAretes };
}
