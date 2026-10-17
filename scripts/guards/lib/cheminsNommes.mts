// #2432
import { descendre, enfantsDe } from '../../../src/data/schemas/grammaire/descente';
import { metaDesChamps } from '../../../src/data/schemas/grammaire/meta';

export const GARDE_CHEMINS_NOMMES = {
  question: 'A — objets atteints depuis les racines déclarées ; B — champs réels et métas du parent final ; C — nom absent ou méta orpheline',
  primitive: 'descendre/enfantsDe/metaDesChamps',
  perimetre: 'DEFS_DE_DOCUMENT, catalogues et scènes, enfants dynamiques déclarés compris',
  angleMort: ['français des libellés', 'objets opaques sans champs déclarés', 'noms des valeurs de discriminant'],
  baseline: { plafond: 0, decroissant: true },
  ticket: '#2432',
} as const;

export function mesurerCheminsNommes(racines: readonly unknown[]) {
  const fautes: string[] = [];
  const chemins: string[] = [];
  let champs = 0;
  descendre(racines, ({ noeud, def, path }) => {
    if (def.type !== 'object') return;
    chemins.push(path);
    const cles = enfantsDe(noeud).flatMap(e => e.cle === undefined ? [] : [e.cle]);
    const meta = metaDesChamps(noeud) ?? {};
    champs += cles.length;
    for (const cle of cles) if (!meta[cle]?.label?.trim()) fautes.push(`${path}.${cle} : champ sans nom`);
    for (const cle of Object.keys(meta)) if (!cles.includes(cle)) fautes.push(`${path}.${cle} : méta orpheline`);
  });
  return { fautes, chemins, champs, objets: chemins.length };
}
