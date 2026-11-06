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
 * (`asset/surfaces.ts`), où se posent au montage la palette de la composition et les emblèmes de la garde-robe (#3111) ; et la marche de chaque base, son clip et sa vitesse au sol (`asset/gabarit.ts`
 * `marcheDeLaBase`) ; une base sans marche unique est refusée, seule ; le rapport de l'index, dont l'élément n'est servi
 * nulle part.
 */
import type { Attache } from '../asset/attache';
import type { ManifesteDElement } from '../asset/element';
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import type { Surface } from '../asset/surfaces';
import { fichiersDuModele, indexerModeles, type EntreeDeModele } from '../asset/modeles';
import { marcheDeLaBase } from '../asset/gabarit';
import { cataloguesDeComposition, emplacementDePiece, emplacementsDeRangement, gardeRobe, libelleDeCleDElement, pieceRacine, type EmblemeDef } from '../../../src/noyau/index';

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
  /** Le clip de marche de la base et sa vitesse au sol en m/s (`marcheDeLaBase`). */
  marche: { clip: string; vitesse: number };
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
}

/** Un emblème offert au montage : son id, son libellé et son dessin. */
type EmblemeDeLAtelier = Pick<EmblemeDef, 'id' | 'label' | 'svg'>;

/** La `cle` du manifeste d'élément `manifeste`. */
export const cleDe = (manifeste: unknown): Readonly<Record<string, string | undefined>> => (manifeste as ManifesteDElement).cle;
const modeDe = (e: EntreeDeModele) => (e.brut as ManifesteDElement).liaison.mode;
/** Les `nom` des surfaces `blason: true` du manifeste d'élément `manifeste`, dans l'ordre du manifeste. */
export const blasonsDe = (manifeste: unknown): string[] => (manifeste as ManifesteDElement).surfaces.filter((s) => s.blason === true).map((s) => s.nom);

/** Les modèles de `manifestes` (id de modèle → manifeste du listage servi, validé) : les bases, leurs points d'accroche et
 *  leurs lignes de pièce, les surfaces de chaque modèle servi, les emblèmes de la garde-robe, les refus de
 *  l'index et ceux des bases dont la marche est ambiguë (`marcheDeLaBase`), qui ne sont pas servies, et le rapport de
 *  l'index. Un objet lié en `rigide` se monte aux emplacements de sa base dont l'os est l'un de ses `osDesRigides` (id de
 *  modèle → os qui portent ses meshes rigides, du listage servi), et à chacune de ses prises si l'un d'eux est l'os d'une
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
  const refus = [...index.refus];
  const bases = [...index.bases.values()].flatMap(({ id, brut }): BaseDeLAtelier[] => {
    const m = brut as ManifesteDeBase;
    const marche = marcheDeLaBase(m);
    if (!marche.ok) {
      refus.push(`[${marche.code}] ${id} : ${marche.detail}`);
      return [];
    }
    const deLaBase = elements.filter((e) => (e.brut as ManifesteDElement).base === m.base);
    const estUnePiece = (e: EntreeDeModele) => modeDe(e) !== 'rigide' || (e.brut as ManifesteDElement).categorie === 'accessoire';
    const objets = deLaBase.filter((e) => !estUnePiece(e));
    const pieces = deLaBase.filter(estUnePiece);
    glb[id] = fichiersDuModele(id).glb;
    surfaces[id] = m.surfaces ?? [];
    const osDesPrises = Object.values(m.prises).map((a) => a.os);
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
    const points = [...pointsDe('emplacement', m.emplacements), ...pointsDe('prise', m.prises)];
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
    return [{ id, empreinte: m.glb.sha256, points, lignes, marche: { clip: marche.clip, vitesse: marche.vitesse } }];
  });
  const emblemes = gardeRobe.flatMap((e) => (e.kind === 'embleme' ? [{ id: e.id, label: e.label, svg: e.svg }] : []));
  return { bases, glb, refus, rapport: index.rapport, surfaces, libelles, emblemes };
}
