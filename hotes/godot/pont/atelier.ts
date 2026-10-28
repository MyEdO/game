/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`, section « Atelier 3D ») : l'index (base, clé) → élément
 * (`indexerModeles`) des manifestes que le listage servi a validés contre leur GLB (`verdictsDesModeles`), mis en données
 * que Godot dessine sans les relire : chaque base avec ses points d'accroche (ses emplacements, puis ses prises), à chaque
 * point les éléments rigides construits pour elle dont un mesh pend à l'os du point (`osDesRigides` du listage,
 * `asset/glb.ts` `parentDesRigides`, `asset/evaluateur/evaluer.ts` `monter`), et le fichier GLB de chacun
 * (`fichiersDuModele`).
 */
import type { Attache } from '../asset/attache';
import type { ManifesteDElement } from '../asset/element';
import type { ManifesteDeBase } from '../asset/manifesteDeBase';
import { fichiersDuModele, indexerModeles } from '../asset/modeles';

/** Un point d'accroche d'une base : un emplacement ou une prise, son repère, et les ids des éléments qui s'y montent. */
export interface PointDAccroche {
  id: string;
  genre: 'emplacement' | 'prise';
  attache: Attache;
  elements: string[];
}

export interface BaseDeLAtelier {
  id: string;
  empreinte: string;
  points: PointDAccroche[];
}

export interface ModelesDeLAtelier {
  bases: BaseDeLAtelier[];
  /** Le fichier GLB, sous `modeles/`, de chaque base et de chaque élément montable, par id de modèle. */
  glb: Record<string, string>;
  refus: string[];
}

/** Les modèles de `manifestes` (id de modèle → manifeste du listage servi, validé) : les bases et leurs points
 *  d'accroche, et les refus de l'index. Un élément lié en `rigide` se monte aux points de sa base dont l'os est l'un de
 *  ses `osDesRigides` (id de modèle → os qui portent ses meshes rigides, du listage servi). */
export function modelesDeLAtelier(manifestes: Record<string, unknown>, osDesRigides: Readonly<Record<string, readonly string[]>>): ModelesDeLAtelier {
  const index = indexerModeles(Object.entries(manifestes).map(([id, brut]) => ({ id, brut })));
  const rigides = [...index.elements.values()].filter(({ brut }) => (brut as ManifesteDElement).liaison.mode === 'rigide');
  const glb: Record<string, string> = {};
  const bases = [...index.bases.values()].map(({ id, brut }) => {
    const m = brut as ManifesteDeBase;
    const deLaBase = rigides.filter((e) => (e.brut as ManifesteDElement).base === m.base);
    glb[id] = fichiersDuModele(id).glb;
    const points = (genre: PointDAccroche['genre'], attaches: Readonly<Record<string, Attache>>): PointDAccroche[] =>
      Object.entries(attaches).map(([pointId, attache]) => {
        const elements = deLaBase.filter((e) => (osDesRigides[e.id] ?? []).includes(attache.os)).map((e) => e.id);
        for (const element of elements) glb[element] = fichiersDuModele(element).glb;
        return { id: pointId, genre, attache, elements };
      });
    return { id, empreinte: m.glb.sha256, points: [...points('emplacement', m.emplacements), ...points('prise', m.prises)] };
  });
  return { bases, glb, refus: index.refus };
}
