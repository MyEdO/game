/**
 * LES MODÈLES DE L'ATELIER 3D (#3086, `CONTRAT.md`) : l'index (base, clé) → élément (`indexerModeles`) des manifestes
 * que le dossier servi publie, mis en données que Godot dessine sans les relire : chaque base avec ses points
 * d'accroche (ses emplacements, puis ses prises), et à chaque point les éléments rigides construits pour elle.
 */
import type { Attache } from '../asset/attache';
import { indexerModeles } from '../asset/modeles';
import { estObjet } from '../../../src/hote/formes';

/** Un point d'accroche d'une base : un emplacement ou une prise, son repère, et les ids des éléments qui s'y montent. */
export interface PointDAccroche {
  id: string;
  genre: 'emplacement' | 'prise';
  attache: Attache;
  elements: string[];
}

export interface BaseDeLAtelier {
  id: string;
  base: string;
  empreinte: string;
  points: PointDAccroche[];
}

export interface ElementDeLAtelier {
  id: string;
  base: string;
  categorie: string;
  empreinte: string;
}

export interface ModelesDeLAtelier {
  bases: BaseDeLAtelier[];
  elements: ElementDeLAtelier[];
  refus: string[];
}

const champ = (brut: unknown, cle: string): Record<string, unknown> => (estObjet(brut) && estObjet(brut[cle]) ? brut[cle] : {});

/** Les modèles de `manifestes` (id de modèle → manifeste, tels qu'importés) : les bases et leurs points d'accroche, les
 *  éléments rattachés à une base présente, et les refus de l'index. Un élément se monte à un point s'il est lié en
 *  `rigide` (`liaison.mode`) ; les éléments skinnés n'ont aucun point. */
export function modelesDeLAtelier(manifestes: Record<string, unknown>): ModelesDeLAtelier {
  const index = indexerModeles(Object.entries(manifestes).map(([id, brut]) => ({ id, brut })));
  const elements = [...index.elements.values()].flatMap(({ id, brut }) => {
    const m = brut as Record<string, unknown>;
    return typeof m.base === 'string' && index.bases.has(m.base) ? [{ id, base: m.base, categorie: String(m.categorie), empreinte: String(champ(m, 'glb').sha256), rigide: champ(m, 'liaison').mode === 'rigide' }] : [];
  });
  const bases = [...index.bases.values()].map(({ id, brut }) => {
    const m = brut as Record<string, unknown>;
    const montables = elements.filter((e) => e.rigide && e.base === m.base).map((e) => e.id);
    const points = (genre: PointDAccroche['genre'], cle: string): PointDAccroche[] =>
      Object.entries(champ(m, cle)).map(([pointId, attache]) => ({ id: pointId, genre, attache: attache as Attache, elements: montables }));
    return { id, base: String(m.base), empreinte: String(champ(m, 'glb').sha256), points: [...points('emplacement', 'emplacements'), ...points('prise', 'prises')] };
  });
  return { bases, elements: elements.map(({ rigide: _, ...e }) => e), refus: index.refus };
}
