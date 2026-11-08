/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : l'index (base, clé) → élément
 * (`indexerModeles`) des manifestes que le listage servi a validés contre leur GLB (`verdictsDesModeles`), mis en données
 * que Godot dessine sans les relire : chaque base avec ses points d'accroche (ses emplacements, puis ses prises), à chaque
 * emplacement les objets rigides construits pour elle dont un mesh pend à l'os du point, et les objets tenus qui s'y rangent
 * (`emplacementsDeRangement`), à chaque prise ceux dont un mesh pend à l'os de l'une de ses prises (`osDesRigides` du
 * listage, `asset/glb.ts` `meshes`, `asset/evaluateur/evaluer.ts` `monter`), que Godot repose du repère de leur prise
 * d'origine dans celui de la prise retenue, ou range à l'emplacement (#3319) ; ses lignes de pièce (#3086, D3), tirées de la
 * garde-robe, où vont ses éléments liés au `squelette` ou en `surface` et ses accessoires, rigides compris ; le fichier GLB de chaque élément servi
 * (`fichiersDuModele`) et le libellé de la chose qu'il porte ; les surfaces de chaque base et de chaque élément servi
 * (`asset/surfaces.ts`), où se posent au montage la palette de la composition et les emblèmes de la garde-robe (#3111) ;
 * la table rôle → clip de chaque base et la vitesse au sol de son rôle `walk` ; chaque véhicule servi, élément sans base
 * (#2987), sous la fiche que nomme sa clé `definition` ; le rapport de l'index, dont l'élément n'est servi nulle part.
 */
import type { Attache } from '../asset/attache';
import { ETATS_AU_POSTE, type ManifesteDElement } from '../asset/element';
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import type { Surface } from '../asset/surfaces';
import { fichiersDuModele, indexerModeles, type EntreeDeModele } from '../asset/modeles';
import { cataloguesDeComposition, emplacementDePiece, emplacementsDeRangement, gardeRobe, findTeinteById, libelleDeCleDElement, pieceRacine, type EmblemeDef, type FireArc, type PosteDuVehicule } from '../../../src/noyau/index';

/** Un point d'accroche d'une base : un emplacement ou une prise, son libellé, son repère, et les ids des éléments qui s'y
 *  montent. */
export interface PointDAccroche {
  id: string;
  label: string;
  genre: 'emplacement' | 'prise';
  attache: Attache;
  elements: string[];
}

/** Un id de la garde-robe, son libellé, et les ids des pièces de la base qui le portent. */
export interface ChoixDeLigne {
  id: string;
  label: string;
  elements: string[];
}

/** Une ligne de pièce (#3086, D3) : le sélecteur d'un axe (`tete`, `coiffure`), une pièce de vêtement ou d'armure
 *  (`piece`), bascule ou, si la garde-robe lui déclare des variantes (#3446), liste, ou la liste des accessoires d'un
 *  emplacement (`emplacement`) ; `elements` vide : « manquant ». */
export type LigneDePiece =
  | { sorte: 'tete' | 'coiffure'; label: string; choix: ChoixDeLigne[] }
  | ({ sorte: 'piece'; variantes: boolean } & ChoixDeLigne)
  | ({ sorte: 'emplacement' } & ChoixDeLigne);

export interface BaseDeLAtelier {
  id: string;
  empreinte: string;
  points: PointDAccroche[];
  lignes: LigneDePiece[];
  /** Le clip de chaque rôle que la base joue (`ManifesteDeBase.clips`). */
  clips: ManifesteDeBase['clips'];
  /** La vitesse au sol en m/s du clip du rôle `walk` (`ManifesteDeBase.appuis.vitesseAuSol`). */
  vitesseAuSol: number;
}

export interface ModelesDeLAtelier {
  bases: BaseDeLAtelier[];
  /** Le fichier GLB, sous `modeles/`, de chaque base et de chaque élément servi, par id de modèle. */
  glb: Record<string, string>;
  refus: string[];
  /** Le rapport de l'index (`indexerModeles`) : ses éléments ne sont servis nulle part. */
  rapport: string[];
  /** Par base et par élément servis, ses surfaces : le matériau, son emplacement de palette, et s'il porte l'emblème ;
   *  une base sans `surfaces`, aucune. */
  surfaces: Record<string, readonly Surface[]>;
  /** Par élément servi, le libellé de la chose que sa clé désigne (`libelleDeCleDElement`), à défaut son id. */
  libelles: Record<string, string>;
  /** Les emblèmes de la garde-robe (`kind: 'embleme'`). */
  emblemes: EmblemeDeLAtelier[];
  /** Par fiche de véhicule ou d'engin (`cle.definition`), l'id de l'élément `vehicule` servi qui la dessine (#2987). */
  vehicules: Record<string, string>;
  /** Par Amélioration navale (`cle.amelioration`), l'id de l'élément `amelioration` servi qui la dessine (#2987). */
  ameliorations: Record<string, string>;
}

/** Un emblème offert au montage : son id, son libellé et son dessin. */
type EmblemeDeLAtelier = Pick<EmblemeDef, 'id' | 'label' | 'svg'>;

/** La `cle` du manifeste d'élément `manifeste`. */
export const cleDe = (manifeste: unknown): Readonly<Record<string, string | undefined>> => (manifeste as ManifesteDElement).cle;
const modeDe = (e: EntreeDeModele) => (e.brut as ManifesteDElement).liaison.mode;
/** La base de l'élément `e`, `undefined` s'il est sans base (`estSansBase`). */
const baseDe = (e: EntreeDeModele): string | undefined => { const m = e.brut as ManifesteDElement; return 'base' in m ? m.base : undefined; };
/** Les `nom` des surfaces `blason: true` du manifeste d'élément `manifeste`, dans l'ordre du manifeste. */
export const blasonsDe = (manifeste: unknown): string[] => (manifeste as ManifesteDElement).surfaces.filter((s) => s.blason === true).map((s) => s.nom);

/** Les modèles de `manifestes` (id de modèle → manifeste du listage servi, validé) : les bases, leurs points d'accroche et
 *  leurs lignes de pièce, les surfaces de chaque modèle servi, les emblèmes de la garde-robe, les véhicules, les refus de
 *  l'index et son rapport. Un objet lié en `rigide` se monte aux emplacements de sa base dont l'os est l'un de ses `osDesRigides` (id
 *  de modèle → os qui portent ses meshes rigides, du listage servi), et à chacune de ses prises si l'un d'eux est l'os d'une
 *  prise (#3319) ; toute pièce, accessoire rigide compris, à la ligne dont
 *  l'id vaut sa clé : `tete`, `coiffure`, `piece` d'un vêtement ou d'une armure, ou de la pièce de sa variante (`pieceRacine`,
 *  #3446), ou l'emplacement de sa pièce
 *  d'accessoire (`emplacementDePiece`), que la base ou l'une de ses pièces offre. */
export function modelesDeLAtelier(manifestes: Record<string, unknown>, osDesRigides: Readonly<Record<string, readonly string[]>>): ModelesDeLAtelier {
  const index = indexerModeles(Object.entries(manifestes).map(([id, brut]) => ({ id, brut })));
  const elements = [...index.elements.values()];
  const glb: Record<string, string> = {};
  const surfaces: Record<string, readonly Surface[]> = {};
  const libelles: Record<string, string> = {};
  const catalogues = cataloguesDeComposition();
  const libelleDuPoint = (id: string, genre: PointDAccroche['genre']): string =>
    (genre === 'prise' ? catalogues.prises : gardeRobe.filter((g) => g.kind === 'emplacement')).find((c) => c.id === id)?.label ?? id;
  const libelleDeLAxe = (champ: 'tete' | 'coiffure'): string => catalogues.axes.find((a) => a.champ === champ)!.label;
  const servir = (servis: readonly EntreeDeModele[]): string[] =>
    servis.map(({ id, brut }) => {
      glb[id] = fichiersDuModele(id).glb;
      surfaces[id] = (brut as ManifesteDElement).surfaces;
      libelles[id] = libelleDeCleDElement(cleDe(brut)) ?? id;
      return id;
    });
  const bases = [...index.bases.values()].map(({ id, brut }): BaseDeLAtelier => {
    const m = brut as ManifesteDeBase;
    const deLaBase = elements.filter((e) => baseDe(e) === m.base);
    const estUnePiece = (e: EntreeDeModele) => modeDe(e) !== 'rigide' || (e.brut as ManifesteDElement).categorie === 'accessoire';
    const objets = deLaBase.filter((e) => !estUnePiece(e));
    const pieces = deLaBase.filter(estUnePiece);
    glb[id] = fichiersDuModele(id).glb;
    surfaces[id] = m.surfaces ?? [];
    const osDesPrises = Object.values(m.prises ?? {}).map((a) => a.os);
    const pointsDe = (genre: PointDAccroche['genre'], attaches: Readonly<Record<string, Attache>>): PointDAccroche[] =>
      Object.entries(attaches).map(([pointId, attache]) => {
        const pendA = (e: EntreeDeModele, porteurs: readonly string[]) => (osDesRigides[e.id] ?? []).some((os) => porteurs.includes(os));
        const seRangeIci = (e: EntreeDeModele) => {
          const apparence = cleDe(e.brut).apparence;
          return apparence !== undefined && pendA(e, osDesPrises) && emplacementsDeRangement(apparence).includes(pointId);
        };
        const offert = genre === 'prise' ? (e: EntreeDeModele) => pendA(e, osDesPrises) : (e: EntreeDeModele) => pendA(e, [attache.os]) || seRangeIci(e);
        return { id: pointId, label: libelleDuPoint(pointId, genre), genre, attache, elements: servir(objets.filter(offert)) };
      });
    const points = [...pointsDe('emplacement', m.emplacements), ...pointsDe('prise', m.prises ?? {})];
    const choix = (idDeChoix: string, label: string, porte: (e: EntreeDeModele) => boolean): ChoixDeLigne => ({ id: idDeChoix, label, elements: servir(pieces.filter(porte)) });
    const racineDe = (e: EntreeDeModele) => {
      const piece = cleDe(e.brut).piece;
      return piece === undefined ? undefined : pieceRacine(piece)?.id;
    };
    const emplacementDe = (e: EntreeDeModele) => {
      const piece = cleDe(e.brut).piece;
      return piece === undefined ? undefined : emplacementDePiece(piece);
    };
    const lignes: LigneDePiece[] = [
      { sorte: 'tete', label: libelleDeLAxe('tete'), choix: gardeRobe.flatMap((g) => (g.kind === 'tete' ? [choix(g.id, g.label, (e) => cleDe(e.brut).tete === g.id)] : [])) },
      { sorte: 'coiffure', label: libelleDeLAxe('coiffure'), choix: gardeRobe.flatMap((g) => (g.kind === 'coiffure' ? [choix(g.id, g.label, (e) => cleDe(e.brut).coiffure === g.id)] : [])) },
      ...gardeRobe.flatMap((g): LigneDePiece[] => (g.kind === 'piece' && g.categorie !== 'accessoire' ? [{ sorte: 'piece', variantes: gardeRobe.some((v) => v.kind === 'variante' && v.piece.id === g.id), ...choix(g.id, g.label, (e) => racineDe(e) === g.id) }] : [])),
      ...gardeRobe.flatMap((g): LigneDePiece[] =>
        g.kind === 'emplacement' && gardeRobe.some((p) => p.kind === 'piece' && emplacementDePiece(p.id) === g.id)
          ? [{ sorte: 'emplacement', ...choix(g.id, g.label, (e) => emplacementDe(e) === g.id) }]
          : []),
    ];
    return { id, empreinte: m.glb.sha256, points, lignes, clips: m.clips, vitesseAuSol: m.appuis.vitesseAuSol };
  });
  const emblemes = gardeRobe.flatMap((e) => (e.kind === 'embleme' ? [{ id: e.id, label: e.label, svg: e.svg }] : []));
  const parCle = (categorie: 'vehicule' | 'amelioration', champ: 'definition' | 'amelioration') => Object.fromEntries(elements.flatMap((e) => {
    const m = e.brut as ManifesteDElement;
    return m.categorie === categorie ? [[cleDe(m)[champ]!, servir([e])[0]]] : [];
  }));
  return { bases, glb, refus: index.refus, rapport: index.rapport, surfaces, libelles, emblemes, vehicules: parCle('vehicule', 'definition'), ameliorations: parCle('amelioration', 'amelioration') };
}

/** Une pièce montée sur un véhicule : l'élément `vehicule` servi qui dessine sa fiche, son bord, sa position dans la
 *  scène du véhicule (`postes` de son manifeste) et sa palette, en `#rrggbb` par emplacement de palette. */
export interface PosteMonte {
  element: string;
  bord: FireArc;
  position: readonly [number, number, number];
  palette: Record<string, string>;
}

/** Les pièces de `postes` montées sur le véhicule de manifeste `manifeste` et de palette `palette` : chacune à la position
 *  de son bord qui suit celles des pièces précédentes de ce bord, si le manifeste l'offre et qu'un élément de `vehicules`
 *  (fiche → élément servi) dessine sa fiche, à la palette du véhicule où la palette de sa teinte (`findTeinteById`) colore ;
 *  une autre ne se monte pas. */
export function postesMontes(manifeste: unknown, postes: readonly PosteDuVehicule[], vehicules: Readonly<Record<string, string>>, palette: Readonly<Record<string, string>>): PosteMonte[] {
  const offertes = (manifeste as Extract<ManifesteDElement, { categorie: 'vehicule' }>).postes ?? {};
  const rangs = new Map<FireArc, number>();
  return postes.flatMap(({ definition, bord, teinte }) => {
    const rang = rangs.get(bord) ?? 0;
    rangs.set(bord, rang + 1);
    const position = offertes[bord]?.[rang];
    const element = vehicules[definition];
    return position && element ? [{ element, bord, position, palette: { ...palette, ...findTeinteById(teinte)?.palette } }] : [];
  });
}

type EtatAuPoste = (typeof ETATS_AU_POSTE)[keyof typeof ETATS_AU_POSTE];

/** Une pièce d'Amélioration montée sur un véhicule : l'élément `amelioration` servi qui la dessine, sa position dans la
 *  scène du véhicule, et, montée à un poste, son bord, le nœud qu'elle montre et celui qu'elle cache (`ETATS_AU_POSTE`). */
export interface AmeliorationMontee {
  element: string;
  position: readonly [number, number, number];
  poste?: { bord: FireArc; montre: EtatAuPoste; cache: EtatAuPoste };
}

/** Les pièces des `ameliorations` montées sur le véhicule de manifeste `manifeste`, dont `montes` sont les pièces de ses
 *  postes (`postesMontes`) : pour chaque Amélioration dont un élément de `pieces` (Amélioration → élément servi, de manifeste
 *  dans `manifestes`) est servi, une pièce à chacun de ses `ancrages` dans le manifeste du véhicule, ou, montée aux postes,
 *  à chaque poste qu'il offre, `ouvert` devant une pièce montée, `ferme` sinon. */
export function ameliorationsMontees(manifeste: unknown, ameliorations: readonly string[], montes: readonly PosteMonte[], pieces: Readonly<Record<string, string>>, manifestes: Readonly<Record<string, unknown>>): AmeliorationMontee[] {
  const vehicule = manifeste as Extract<ManifesteDElement, { categorie: 'vehicule' }>;
  return ameliorations.flatMap((amelioration) => {
    const element = pieces[amelioration];
    if (!element) return [];
    if ((manifestes[element] as Extract<ManifesteDElement, { categorie: 'amelioration' }>).montage === 'ancrages') return (vehicule.ancrages?.[amelioration] ?? []).map((position) => ({ element, position }));
    return Object.entries(vehicule.postes ?? {}).flatMap(([bord, positions]) => positions.map((position) => {
      const arme = montes.some((m) => m.bord === bord && m.position === position);
      return { element, position, poste: { bord: bord as FireArc, montre: arme ? ETATS_AU_POSTE.arme : ETATS_AU_POSTE.vide, cache: arme ? ETATS_AU_POSTE.vide : ETATS_AU_POSTE.arme } };
    }));
  });
}
