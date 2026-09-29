/**
 * RÉFÉRENCES NARRATIVES d'un document de campagne (#679) — toute clé d'Effect de `REFERENCES_NARRATIVES`
 * (`./registres-narratifs.ts`) désigne une entrée du registre qu'elle nomme, PAR ID ; le `stade` d'un
 * `indiceId` désigne un stade de cet indice. Une référence qui ne résout pas est une faute NOMMÉE à son
 * chemin complet.
 *
 * Le parcours est celui de la validation de scène (`src/state/validateScene.ts`) : chaque RACINE de
 * Flow d'une scène (`racinesDeFlow`), l'arbre entier par `walkFlow`, et les Flows PORTÉS par une
 * feuille par `carriedFlows` (`src/engine/flowCore.ts`) ; plus les Effects des péripéties de route de
 * la carte du monde (`worldMap.routes[].perils[].effects`, `./worldmap.ts`).
 *
 * Deux lecteurs : la porte du projet (`projetSchema`, `./projet.ts`) et le contrat des scénarios de
 * test (`./scenarios-contrat.test.ts`), dont les scènes ne passent jamais par cette porte.
 */
import { carriedFlows, isFlowNode, racinesDeFlow, walkFlow, type CheminDeFlow, type Flow } from '../../../engine/flowCore';
import { inconnuDe, REFERENCES_NARRATIVES, type RegistreReference } from './registres-narratifs';

type Chemin = readonly (string | number)[];

/** Une faute de référence narrative : son chemin depuis la racine du document, son message. */
export interface FauteDeRefNarrative {
  readonly chemin: Chemin;
  readonly message: string;
}

/** Ce que le parcours lit d'un document — sa forme AVANT `normalizeScene` (collections optionnelles). */
export interface DocumentAReferences {
  readonly scenes: readonly unknown[];
  readonly worldMap?: unknown;
}

/** Ce que le parcours lit du narratif : chaque registre désigné, et les stades des indices. */
export type NarratifAReferences = { readonly [R in Exclude<RegistreReference, 'indices'>]: readonly { readonly id: string }[] } & {
  readonly indices: readonly { readonly id: string; readonly stades: readonly { readonly id: string }[] }[];
};

const REFERENCES = Object.entries(REFERENCES_NARRATIVES) as [string, RegistreReference][];

const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Les fautes de référence narrative de `doc` contre `narratif`, dans l'ordre du document. */
export function refsNarrativesPendantes(doc: DocumentAReferences, narratif: NarratifAReferences): FauteDeRefNarrative[] {
  const fautes: FauteDeRefNarrative[] = [];
  const ids = Object.fromEntries(REFERENCES.map(([, reg]) => [reg, new Set(narratif[reg].map((x) => x.id))])) as Record<RegistreReference, Set<string>>;
  const indices = new Map(narratif.indices.map((ind) => [ind.id, ind]));

  const verifieEffet = (effet: unknown, chemin: Chemin): void => {
    const e = objet(effet);
    for (const [cle, reg] of REFERENCES) {
      const v = e[cle];
      if (typeof v === 'string' && !ids[reg].has(v)) fautes.push({ chemin: [...chemin, cle], message: `${inconnuDe(reg)} « ${v} » (narratif.${reg}).` });
    }
    const ind = typeof e.indiceId === 'string' ? indices.get(e.indiceId) : undefined;
    if (ind && typeof e.stade === 'string' && !ind.stades.some((s) => s.id === e.stade))
      fautes.push({ chemin: [...chemin, 'stade'], message: `stade inconnu « ${e.stade} » de l'indice « ${ind.id} ».` });
    for (const porte of carriedFlows(effet)) verifieFlow(porte.flow, [...chemin, ...porte.chemin]);
  };
  const verifieFlow = (flow: Flow<unknown>, chemin: Chemin): void =>
    walkFlow(flow, (noeud, sous: CheminDeFlow) => {
      if (noeud.kind === 'do') verifieEffet(noeud.effect, [...chemin, ...sous, 'effect']);
    });

  doc.scenes.forEach((s, i) => {
    for (const r of racinesDeFlow(s)) if (isFlowNode(r.flow)) verifieFlow(r.flow, ['scenes', i, ...r.chemin]);
  });
  liste(objet(doc.worldMap).routes).forEach((route, i) =>
    liste(objet(route).perils).forEach((peril, j) =>
      liste(objet(peril).effects).forEach((effet, k) => verifieEffet(effet, ['worldMap', 'routes', i, 'perils', j, 'effects', k])),
    ),
  );
  return fautes;
}
