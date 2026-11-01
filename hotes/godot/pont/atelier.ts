/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : l'index (base, clé) → élément
 * (`indexerModeles`) des manifestes que le listage servi a validés contre leur GLB (`verdictsDesModeles`), mis en données
 * que Godot dessine sans les relire : chaque base avec ses points d'accroche (ses emplacements, puis ses prises), à chaque
 * point les éléments rigides construits pour elle dont un mesh pend à l'os du point (`osDesRigides` du listage,
 * `asset/glb.ts` `meshes`, `asset/evaluateur/evaluer.ts` `monter`) ; ses lignes de pièce (#3086, D3), tirées de la
 * garde-robe, où vont ses éléments liés au `squelette` ou en `surface` ; le fichier GLB de chaque élément servi
 * (`fichiersDuModele`) et les surfaces qui portent un emblème (`blason: true`), et les emblèmes de la garde-robe (#3111),
 * qu'on y pose au montage ; et la marche de chaque base, son clip et sa vitesse au sol (`asset/gabarit.ts`
 * `marcheDeLaBase`) ; une base sans marche unique est refusée, seule ; le rapport de l'index, dont l'élément n'est servi
 * nulle part.
 */
import type { Attache } from '../asset/attache';
import type { ManifesteDElement } from '../asset/element';
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import { fichiersDuModele, indexerModeles, type EntreeDeModele } from '../asset/modeles';
import { marcheDeLaBase } from '../asset/gabarit';
import { emplacementDePiece, gardeRobe, type EmblemeDef } from '../../../src/noyau/index';

/** Un point d'accroche d'une base : un emplacement ou une prise, son repère, et les ids des éléments qui s'y montent. */
export interface PointDAccroche {
  id: string;
  genre: 'emplacement' | 'prise';
  attache: Attache;
  elements: string[];
}

/** Un id de la garde-robe, son libellé, et les ids des éléments de la base, liés au `squelette` ou en `surface`, qui le portent. */
export interface ChoixDeLigne {
  id: string;
  label: string;
  elements: string[];
}

/** Une ligne de pièce (#3086, D3) : le sélecteur d'un axe (`tete`, `coiffure`), la bascule d'une pièce de vêtement ou
 *  d'armure (`piece`), ou la liste des accessoires d'un emplacement (`emplacement`) ; `elements` vide : « manquant ». */
export type LigneDePiece = { sorte: 'tete' | 'coiffure'; choix: ChoixDeLigne[] } | ({ sorte: 'piece' | 'emplacement' } & ChoixDeLigne);

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
  /** Par élément servi, les `nom` de ses surfaces `blason: true`, liste vide s'il n'en a aucune. */
  blasons: Record<string, string[]>;
  /** Les emblèmes de la garde-robe (`kind: 'embleme'`). */
  emblemes: EmblemeDeLAtelier[];
}

/** Un emblème offert au montage : son id, son libellé et son dessin. */
type EmblemeDeLAtelier = Pick<EmblemeDef, 'id' | 'label' | 'svg'>;

/** La `cle` du manifeste d'élément `manifeste`. */
export const cleDe = (manifeste: unknown): Readonly<Record<string, string | undefined>> => (manifeste as ManifesteDElement).cle;
const modeDe = (e: EntreeDeModele) => (e.brut as ManifesteDElement).liaison.mode;

/** Les modèles de `manifestes` (id de modèle → manifeste du listage servi, validé) : les bases, leurs points d'accroche et
 *  leurs lignes de pièce, les surfaces `blason` de chaque élément servi, les emblèmes de la garde-robe, les refus de
 *  l'index et ceux des bases dont la marche est ambiguë (`marcheDeLaBase`), qui ne sont pas servies, et le rapport de
 *  l'index. Un élément lié en `rigide` se monte aux points de sa base dont l'os est l'un de ses `osDesRigides` (id de
 *  modèle → os qui portent ses meshes rigides, du listage servi) ; tout autre, à la ligne dont l'id vaut sa clé : `tete`,
 *  `coiffure`, `piece` d'un vêtement ou d'une armure, ou l'emplacement de sa pièce d'accessoire (`emplacementDePiece`). */
export function modelesDeLAtelier(manifestes: Record<string, unknown>, osDesRigides: Readonly<Record<string, readonly string[]>>): ModelesDeLAtelier {
  const index = indexerModeles(Object.entries(manifestes).map(([id, brut]) => ({ id, brut })));
  const elements = [...index.elements.values()];
  const glb: Record<string, string> = {};
  const blasons: Record<string, string[]> = {};
  const servir = (servis: readonly EntreeDeModele[]): string[] =>
    servis.map(({ id, brut }) => {
      glb[id] = fichiersDuModele(id).glb;
      blasons[id] = (brut as ManifesteDElement).surfaces.filter((s) => s.blason === true).map((s) => s.nom);
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
    const rigides = deLaBase.filter((e) => modeDe(e) === 'rigide');
    const lies = deLaBase.filter((e) => modeDe(e) !== 'rigide');
    glb[id] = fichiersDuModele(id).glb;
    const pointsDe = (genre: PointDAccroche['genre'], attaches: Readonly<Record<string, Attache>>): PointDAccroche[] =>
      Object.entries(attaches).map(([pointId, attache]) => ({
        id: pointId, genre, attache, elements: servir(rigides.filter((e) => (osDesRigides[e.id] ?? []).includes(attache.os))),
      }));
    const points = [...pointsDe('emplacement', m.emplacements), ...pointsDe('prise', m.prises)];
    const choix = (idDeChoix: string, label: string, porte: (e: EntreeDeModele) => boolean): ChoixDeLigne => ({ id: idDeChoix, label, elements: servir(lies.filter(porte)) });
    const emplacementDe = (e: EntreeDeModele) => {
      const piece = cleDe(e.brut).piece;
      return piece === undefined ? undefined : emplacementDePiece(piece);
    };
    const lignes: LigneDePiece[] = [
      { sorte: 'tete', choix: gardeRobe.flatMap((g) => (g.kind === 'tete' ? [choix(g.id, g.label, (e) => cleDe(e.brut).tete === g.id)] : [])) },
      { sorte: 'coiffure', choix: gardeRobe.flatMap((g) => (g.kind === 'coiffure' ? [choix(g.id, g.label, (e) => cleDe(e.brut).coiffure === g.id)] : [])) },
      ...gardeRobe.flatMap((g): LigneDePiece[] => (g.kind === 'piece' && g.categorie !== 'accessoire' ? [{ sorte: 'piece', ...choix(g.id, g.label, (e) => cleDe(e.brut).piece === g.id) }] : [])),
      ...gardeRobe.flatMap((g): LigneDePiece[] =>
        g.kind === 'emplacement' && gardeRobe.some((p) => p.kind === 'piece' && emplacementDePiece(p.id) === g.id)
          ? [{ sorte: 'emplacement', ...choix(g.id, g.label, (e) => emplacementDe(e) === g.id) }]
          : []),
    ];
    return [{ id, empreinte: m.glb.sha256, points, lignes, marche: { clip: marche.clip, vitesse: marche.vitesse } }];
  });
  const emblemes = gardeRobe.flatMap((e) => (e.kind === 'embleme' ? [{ id: e.id, label: e.label, svg: e.svg }] : []));
  return { bases, glb, refus, rapport: index.rapport, blasons, emblemes };
}
