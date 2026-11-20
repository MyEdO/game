/**
 * GARDE DU RIGIDE RANGÉ (#4351) : un objet rangé, posé où le jeu le range (`rangerLesRigides`, `../rangement.ts`), ne
 * passe pas à travers un vêtement. Il se mesure comme un membre (`mesurerMembresDansUnVetement`,
 * `membreDansUnVetement.ts`) : à chaque échantillon d'un clip, contre l'endroit de chaque mesh de zone d'un élément
 * montré, il le traverse s'il a des sommets de chaque côté, au même seuil `ECART_DE_SUIVI_M` et à la même portée
 * `PORTEE_DE_COUVERTURE_M`. Deux écarts au membre : un objet n'a pas de zone, donc aucun vêtement ne lui est voisin ;
 * et il ne pince pas le tissu contre le corps, donc aucun de ses sommets derrière un vêtement n'est écarté. Les meshes
 * de l'élément qui offre son emplacement n'y entrent pas : le jeu pose l'objet dans sa case, entre ses parois
 * (`MontageDeComposition._appuyer`).
 * `objet-dans-un-vetement` : un écart par (rigide, mesh, clip), à son pire instant (`piresTraversees`), de valeur le
 * plus grand écart signé derrière.
 */
import type { Mesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { piresTraversees, type MembreDUnEchantillon, type PaireHorsDeZone } from './membreDansUnVetement.ts';

const GARDE = 'rigideRange';

/** Les paires de chaque mesh de `rigides`, sous son libellé, et de chaque mesh de `vetements` hors de `offerts`, ceux
 *  de l'élément qui offre son emplacement ; `triangles` : par vêtement, ceux d'une paire. */
export function pairesDuRigide(rigides: readonly Mesh[], vetements: readonly Mesh[], offerts: ReadonlySet<Mesh>, libelle: LibelleDeMesh, triangles: (vetement: Mesh) => ArrayLike<number>): PaireHorsDeZone[] {
  return rigides.flatMap((membre) => vetements.flatMap((vetement) => (offerts.has(vetement) ? [] : [{ membre, zone: libelle(membre), vetement, triangles: triangles(vetement) }])));
}

/** `objet-dans-un-vetement` : par (rigide, vêtement, clip) de `mesures` (`mesurerMembresDansUnVetement` sur
 *  `pairesDuRigide`), son pire échantillon. */
export function gardeRigideRange(mesures: readonly MembreDUnEchantillon[], libelle: LibelleDeMesh): Ecart[] {
  return piresTraversees(mesures, libelle).map((m): Ecart => ({
    garde: GARDE, code: 'objet-dans-un-vetement', mesh: m.zone, clip: m.clip, t: m.t, valeur: m.pire, seuil: ECART_DE_SUIVI_M,
    detail: `${m.sommets} sommet(s) de l'objet rangé derrière ${libelle(m.vetement)} qu'il traverse : plus grand écart signé, en m`,
  }));
}
