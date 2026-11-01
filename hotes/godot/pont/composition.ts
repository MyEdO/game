/**
 * LA COMPOSITION D'UN PERSONNAGE SUR UNE BASE (#3086, D2 et son amendement ; `CONTRAT.md`, section « Composition d'un
 * personnage ») : ce que porte une composition (`porteeDeComposition`, surface du noyau), résolu en éléments de la base sur
 * ses lignes et ses points (`modelesDeLAtelier`), avec la pose de son gabarit (`poseDuGabarit`) et les poids de ses
 * silhouettes (`poidsDeSilhouettes`).
 */
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import { poidsDeSilhouettes, poseDuGabarit, type PoseDuGabarit } from '../asset/gabarit';
import { BUILD_NEUTRE } from '../../../src/lib/corpulence';
import { porteeDeComposition, type Composition, type Portee } from '../../../src/noyau/index';
import { cleDe, type BaseDeLAtelier, type LigneDePiece } from './atelier';

/** Un emplacement de montage d'une chose portée (`"<point>"` ou la clé de sa ligne, `cleDuPanneau`) et l'élément de
 *  la base qui la monte, `null` s'il n'y en a aucun. */
export interface Monte {
  ligne: string;
  element: string | null;
}

/** Une chose portée sans élément de la base : son emplacement de montage, la clé qui la désigne, son libellé et ce
 *  qui l'apporte. */
export interface Manquant {
  ligne: string;
  champ: Portee['cle']['champ'];
  id: string;
  label: string;
  par?: Portee['par'];
}

export interface CompositionSurLaBase {
  montes: Monte[];
  manquants: Manquant[];
  /** Les objets de la composition ni tenus ni rangés (`porteeDeComposition`). */
  rapport: string[];
  gabarit: PoseDuGabarit;
  morphes: Record<string, number>;
}

/** La clé d'emplacement d'une ligne au panneau de l'atelier (`CONTRAT.md`, « Écran publié ») : `ligne/<sorte>` d'un
 *  sélecteur (`tete`, `coiffure`), `ligne/<sorte>/<id>` d'une `piece` ou d'un `emplacement`. */
const cleDuPanneau = (sorte: LigneDePiece['sorte'], id?: string): string => (id === undefined ? `ligne/${sorte}` : `ligne/${sorte}/${id}`);
const cleDeLigne = (l: LigneDePiece): string => ('choix' in l ? cleDuPanneau(l.sorte) : cleDuPanneau(l.sorte, l.id));
const elementsDeLigne = (l: LigneDePiece): string[] => ('choix' in l ? l.choix.flatMap((c) => c.elements) : l.elements);

/** Les emplacements de montage où chercher une chose portée : la ligne de sa tête, de sa coiffure ou de sa pièce de
 *  vêtement ou d'armure ; la ligne puis le point de l'emplacement d'une pièce d'accessoire (liée en surface ou rigide) ;
 *  le point d'un objet. */
function ouChercher({ cle, point }: Portee): string[] {
  if (cle.champ === 'tete' || cle.champ === 'coiffure') return [cleDuPanneau(cle.champ)];
  if (cle.champ === 'apparence') return [point!];
  return point === undefined ? [cleDuPanneau('piece', cle.id)] : [cleDuPanneau('emplacement', point), point];
}

/** `composition` sur la base `base` des modèles de l'atelier : `manifestes` (id de modèle → manifeste) lit la base et la
 *  `cle` de ses éléments. Chaque chose portée se monte à l'élément de son emplacement dont la clé la désigne. */
export function composerSurLaBase(base: BaseDeLAtelier, manifestes: Readonly<Record<string, unknown>>, composition: Composition): CompositionSurLaBase {
  const portee = porteeDeComposition(composition);
  const elementsDe = new Map<string, string[]>([
    ...base.points.map((p): [string, string[]] => [p.id, p.elements]),
    ...base.lignes.map((l): [string, string[]] => [cleDeLigne(l), elementsDeLigne(l)]),
  ]);
  const montes: Monte[] = [];
  const manquants: Manquant[] = [];
  for (const p of portee.portees) {
    const ou = ouChercher(p);
    const trouve = ou
      .map((ligne) => ({ ligne, element: (elementsDe.get(ligne) ?? []).find((e) => cleDe(manifestes[e])[p.cle.champ] === p.cle.id) }))
      .find((t) => t.element !== undefined);
    montes.push({ ligne: trouve?.ligne ?? ou[0], element: trouve?.element ?? null });
    if (!trouve) manquants.push({ ligne: ou[0], champ: p.cle.champ, id: p.cle.id, label: p.label, ...(p.par ? { par: p.par } : {}) });
  }
  const manifeste = manifestes[base.id] as ManifesteDeBase;
  return {
    montes,
    manquants,
    rapport: portee.rapport,
    gabarit: poseDuGabarit(manifeste, portee.facteurs),
    morphes: poidsDeSilhouettes({ sex: composition.sex, build: composition.build ?? BUILD_NEUTRE, st: portee.facteurs.st }, manifeste.gabarit),
  };
}
