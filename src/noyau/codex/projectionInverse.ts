import { z } from 'zod';
import { auChemin } from '../../lib/objet.mjs';
import { tableTotale } from '../../lib/tableTotale';
import { descendre, enfantsDe, ouverts } from '../../data/schemas/grammaire/descente';
import { metaDesChamps, type MetaChamp } from '../../data/schemas/grammaire/meta';
import { versDisque } from '../../data/schemas/grammaire/prose';
import { declarationDeFeuilleDId, espaceDe, reperesDuParse, type TypeEntite } from '../../data/schemas/grammaire/ref';

type ChampInverse = NonNullable<MetaChamp['inverseCodex']>;
type Cible = { type: TypeEntite; id: string; detail?: string };

interface Projection {
  readonly schema: z.ZodType;
  readonly champs: ReadonlyMap<string, ChampInverse>;
}

const projections = new WeakMap<z.ZodType, Projection | undefined>();

function compilerProjection(schema: z.ZodType): Projection | undefined {
  const source = ouverts([schema]).find((noeud) =>
    Object.values(metaDesChamps(noeud) ?? {}).some((meta) => meta.inverseCodex),
  );
  if (!source) return undefined;
  const metas = metaDesChamps(source)!;
  const champs = new Map<string, ChampInverse>();
  const forme: Record<string, z.ZodType> = {};
  for (const { cle, noeud } of enfantsDe(source)) {
    if (cle === undefined) continue;
    const publication = metas[cle]?.inverseCodex;
    if (!publication) continue;
    champs.set(cle, publication);
    forme[cle] = noeud as z.ZodType;
  }
  return { schema: z.array(z.object(forme)), champs };
}

function projectionDe(schema: z.ZodType): Projection | undefined {
  if (!projections.has(schema)) projections.set(schema, compilerProjection(schema));
  return projections.get(schema);
}

/** Espaces des feuilles dont la référence peut basculer entre catalogue et portée locale. */
export function espacesMixtesDeProjectionInverse(schema: z.ZodType): ReadonlySet<string> {
  const projection = projectionDe(schema);
  const espaces = new Set<string>();
  if (!projection) return espaces;
  descendre([projection.schema], ({ noeud }) => {
    const feuille = declarationDeFeuilleDId(noeud);
    if (feuille?.portee) espaces.add(espaceDe(feuille.type));
  });
  return espaces;
}

/** Une référence directe a au plus un rang de liste et la clef d'une ref enveloppée. */
function estDirecte(path: readonly PropertyKey[]): boolean {
  const profondeur = typeof path[1] === 'number' ? 2 : 1;
  return path.length === profondeur || (path.length === profondeur + 1 && path[profondeur] === 'id');
}

/** Slots globaux publiés par la méta de l'entrée, dans l'ordre des champs du schéma. */
export function projeterInversesCodex(schema: z.ZodType, entrees: readonly unknown[]): Cible[][] {
  const projection = projectionDe(schema);
  if (!projection) return entrees.map(() => []);
  const { champs } = projection;
  const cles = [...champs.keys()];
  const donnees = versDisque(entrees.map((entree) =>
    tableTotale(cles, (champ) => auChemin(entree, [champ])),
  ));
  const ciblesParEntree = donnees.map(() => new Map<string, Cible[]>());
  for (const { path, type, parCle } of reperesDuParse(projection.schema, donnees)) {
    if (type.startsWith('local:')) continue;
    const [rang, champ, element, charge, cle] = path;
    if (typeof rang !== 'number' || typeof champ !== 'string') continue;
    const publication = champs.get(champ);
    if (!publication || (publication !== true && 'cle' in publication)) continue;
    const id = parCle ? path[path.length - 1] : auChemin(donnees, path);
    if (typeof id !== 'string') continue;
    const cible: Cible = { type: type as TypeEntite, id };
    if (publication !== true) {
      if ('operations' in publication) {
        if (parCle || path.length !== 5 || typeof element !== 'number' || typeof charge !== 'string' || cle !== 'id') continue;
        const op = auChemin(donnees, [rang, champ, element, 'op']);
        if (typeof op !== 'string' || publication.operations[op] !== type) continue;
      } else {
        if (publication.type && publication.type !== type) continue;
        if (publication.portee === 'directe' && !estDirecte(path.slice(1))) continue;
        if (publication.detail) cible.detail = publication.detail;
      }
    }
    const cibles = ciblesParEntree[rang];
    const liste = cibles.get(champ) ?? [];
    liste.push(cible);
    cibles.set(champ, liste);
  }
  return donnees.map((entree, rang) => [...champs].flatMap(([champ, publication]) => {
    if (publication === true || !('cle' in publication)) return ciblesParEntree[rang].get(champ) ?? [];
    const valeur = entree[champ];
    const ids = Array.isArray(valeur) ? valeur : [valeur];
    return ids.flatMap((id) => typeof id === 'string' ? [{ type: publication.cle, id }] : []);
  }));
}
