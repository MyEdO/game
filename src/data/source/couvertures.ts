// COUVERTURES D'UN PAQUET DE CAMPAGNE (#2290) — ce qu'un projet CITE des fiches de dossier de chapitre :
// chaque `couvre` de ses porteurs (`couvreSchema`, `src/data/schemas/defs-scenes/communs.ts`) et ses
// `narratif.ecartes`. LA lecture, composée par l'état des lieux (`scripts/docs/build-dossiers-de-chapitre.mjs`)
// et par la garde référentielle (`src/data/dossiers-couverture.test.ts`).
//
// Module PUR, sans import : chargé tel quel par Node nu (retrait de types natif) comme par vitest. Il lit
// la FORME d'un projet (`ProjectDoc`, `src/state/worldMap.ts`) par un type structurel réduit aux porteurs.

/** Les porteurs de `couvre`, dans l'ordre de lecture. */
export const KINDS_DE_PORTEUR = ['presetPnj', 'indice', 'scene', 'entite', 'zoneDEffet', 'declencheur', 'dialogue', 'rencontre', 'lieu', 'route'] as const;
type KindDePorteur = (typeof KINDS_DE_PORTEUR)[number];

/** Nom d'affichage de chaque porteur. */
const LIBELLES_DE_PORTEUR: Readonly<Record<KindDePorteur, string>> = {
  presetPnj: 'PNJ',
  indice: 'indice',
  scene: 'scène',
  entite: 'entité',
  zoneDEffet: 'zone d’effet',
  declencheur: 'déclencheur',
  dialogue: 'dialogue',
  rencontre: 'rencontre',
  lieu: 'lieu de la carte',
  route: 'route de la carte',
};

interface ElementCouvrant {
  id: string;
  couvre?: readonly string[];
}

interface SceneLue extends ElementCouvrant {
  entities?: readonly ElementCouvrant[];
  effectZones?: readonly ElementCouvrant[];
  triggers?: readonly ElementCouvrant[];
  dialogues?: readonly ElementCouvrant[];
  encounters?: readonly ElementCouvrant[];
}

/** Ce qu'un projet porte de `couvre` et d'`ecartes` : `ProjectDoc` s'y affecte. */
export interface ProjetLu {
  narratif: {
    presetsPnj: readonly ElementCouvrant[];
    indices: readonly ElementCouvrant[];
    ecartes?: readonly EcartLu[];
  };
  scenes: readonly SceneLue[];
  worldMap?: { places?: readonly ElementCouvrant[]; routes?: readonly ElementCouvrant[] };
}

interface EcartLu {
  entree: string;
  motif: string;
}

/** Le porteur d'un `couvre` : son genre, son id, et la scène qui le contient (porteurs de scène). */
interface Porteur {
  kind: KindDePorteur;
  id: string;
  sceneId?: string;
}

interface Couverture {
  entree: string;
  porteur: Porteur;
}

interface CouverturesDuProjet {
  couvertures: Couverture[];
  ecartes: EcartLu[];
}

const de = (elements: readonly ElementCouvrant[] | undefined, kind: KindDePorteur, sceneId?: string): Couverture[] =>
  (elements ?? []).flatMap((el) => (el.couvre ?? []).map((entree) => ({ entree, porteur: sceneId === undefined ? { kind, id: el.id } : { kind, id: el.id, sceneId } })));

/** Chaque `couvre` des porteurs du projet, puis ses `narratif.ecartes`. PUR. */
export function couverturesDuProjet(projet: ProjetLu): CouverturesDuProjet {
  return {
    couvertures: [
      ...de(projet.narratif.presetsPnj, 'presetPnj'),
      ...de(projet.narratif.indices, 'indice'),
      ...projet.scenes.flatMap((s) => [
        ...de([s], 'scene'),
        ...de(s.entities, 'entite', s.id),
        ...de(s.effectZones, 'zoneDEffet', s.id),
        ...de(s.triggers, 'declencheur', s.id),
        ...de(s.dialogues, 'dialogue', s.id),
        ...de(s.encounters, 'rencontre', s.id),
      ]),
      ...de(projet.worldMap?.places, 'lieu'),
      ...de(projet.worldMap?.routes, 'route'),
    ],
    ecartes: [...(projet.narratif.ecartes ?? [])],
  };
}

/** Un porteur, lisible : « PNJ `edo-gustav` », « entité `coffre` (scène `la-diligence`) ». */
export const nommerPorteur = ({ kind, id, sceneId }: Porteur): string =>
  `${LIBELLES_DE_PORTEUR[kind]} \`${id}\`${sceneId === undefined ? '' : ` (scène \`${sceneId}\`)`}`;

/** Les fautes RÉFÉRENTIELLES d'un paquet, une phrase chacune : un `couvre` ou un `ecartes[].entree` qui ne
 *  résout à aucune entrée de `entreesConnues`, une entrée à la fois couverte et écartée. Une entrée NON
 *  couverte n'est jamais une faute. PUR. */
export function fautesDeReference(paquet: string, lu: CouverturesDuProjet, entreesConnues: ReadonlySet<string>): string[] {
  const couvertes = new Set(lu.couvertures.map((c) => c.entree));
  return [
    ...lu.couvertures.filter((c) => !entreesConnues.has(c.entree)).map((c) => `${paquet} : ${nommerPorteur(c.porteur)} couvre « ${c.entree} », absente des fiches commitées`),
    ...lu.ecartes.filter((e) => !entreesConnues.has(e.entree)).map((e) => `${paquet} : écart « ${e.entree} », absente des fiches commitées`),
    ...lu.ecartes.filter((e) => couvertes.has(e.entree)).map((e) => `${paquet} : « ${e.entree} » à la fois couverte et écartée`),
  ];
}
