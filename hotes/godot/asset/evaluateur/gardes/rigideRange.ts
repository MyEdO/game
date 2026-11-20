/**
 * GARDE DU RIGIDE RANGÉ (#4351) : un objet rangé, posé où le jeu le range (`rangerLesRigides`, `../rangement.ts`), ne
 * passe pas à travers un vêtement. Il se mesure comme un membre (`mesurerMembresDansUnVetement`,
 * `membreDansUnVetement.ts`) : à chaque échantillon d'un clip, contre l'endroit de chaque mesh de zone d'un élément
 * montré, il le traverse s'il a des sommets de chaque côté, au même seuil `ECART_DE_SUIVI_M` et à la même portée
 * `PORTEE_DE_COUVERTURE_M`. Deux écarts au membre : un objet n'a pas de zone, donc aucun vêtement ne lui est voisin ;
 * et il ne pince pas le tissu contre le corps, donc aucun de ses sommets derrière un vêtement n'est écarté. Les meshes
 * de l'élément qui offre son emplacement n'y entrent pas : le jeu pose l'objet dans sa case, entre ses parois
 * (`MontageDeComposition._appuyer`).
 * Au repos neutre, il se mesure comme une couche sous sa couverture (`lierLesCouches`, `traversee.ts`) : une arête qui
 * traverse l'endroit d'un vêtement en sort par un bout, percé s'il est à plus de `ECART_DE_SUIVI_M` devant lui.
 * `objet-dans-un-vetement` : un écart par (rigide, mesh, clip), à son pire instant (`piresTraversees`), de valeur le
 * plus grand écart signé derrière ; au repos neutre, un écart par (rigide, mesh), de valeur l'écart signé le plus
 * négatif.
 */
import type { Mesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { piresTraversees, type MembreDUnEchantillon, type PaireHorsDeZone } from './membreDansUnVetement.ts';
import type { PercementAuRepos } from './traversee.ts';

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

/** `objet-dans-un-vetement` au repos neutre : un écart par percement de `percements` (`lierLesCouches`, le rigide en
 *  sujet). */
export const gardeRigideRangeAuRepos = (percements: readonly PercementAuRepos[], libelle: LibelleDeMesh): Ecart[] => percements.map((p): Ecart => ({
  garde: GARDE, code: 'objet-dans-un-vetement', mesh: libelle(p.sujet), valeur: p.pire, seuil: -ECART_DE_SUIVI_M,
  detail: `${p.sommets} sommet(s) de l'objet rangé devant ${libelle(p.couverture)} qu'il traverse au repos neutre : écart signé le plus négatif, en m`,
}));
