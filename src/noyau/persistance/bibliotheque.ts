/**
 * LA BIBLIOTHÈQUE DE CAMPAGNES (#2404, #3041), sa forme et ses transformations pures : l'enveloppe d'une entrée
 * (`savedProjectSchema`), sa relecture (prouvée, refusée ou indésignable), ce qu'une écriture en garde, son nom
 * d'affichage, et la campagne lancée d'une entrée. La procédure sur les ports d'un hôte : `hote/bibliotheque.ts`.
 */
import { z } from 'zod';
import { parseProject, refusDeForme, ProjetRefuse, type ProjectDoc } from '../worldMap';
import type { EtatDeJeu } from '../etat';
import { validateDocument, rapportDeFautes } from '../../data/schemas/validate';
import { nommerChamps } from '../../data/schemas/grammaire/meta';

/** Ce qu'un écran LIT d'un projet de la bibliothèque SANS l'ouvrir (liste, détail, dédup d'import).
 *  Le document entier passe la porte `parseProject` au GESTE (ouvrir, jouer, exporter) : un projet
 *  d'un autre format reste ainsi listé, son refus affiché au geste, et sa suppression reste un geste
 *  de l'auteur (#2404). */
const apercuDeProjetSchema = nommerChamps(z.looseObject({
  scenes: z.array(z.unknown()),
  versionContenu: z.number().optional(),
  desc: z.string().optional(),
  auteur: z.string().optional(),
}), { scenes: { label: 'scènes' }, versionContenu: { label: 'version du contenu' }, desc: { label: 'description' }, auteur: { label: 'auteur' } });

/** Une entrée de la bibliothèque de projets. `published` = jouable depuis le menu ; `startSceneId` = scène de
 *  départ quand on JOUE la campagne. */
export const savedProjectSchema = nommerChamps(z.strictObject({
  id: z.string().min(1),
  label: z.string(),
  startSceneId: z.string(),
  savedAt: z.number(),
  published: z.boolean(),
  project: apercuDeProjetSchema,
}), { id: { label: 'identifiant' }, label: { label: 'libellé' }, startSceneId: { label: 'scène de départ' }, savedAt: { label: 'date de sauvegarde' }, published: { label: 'publié' }, project: { label: 'projet' } });

/** Une entrée PROUVÉE par `savedProjectSchema`. */
export type SavedProject = Omit<z.infer<typeof savedProjectSchema>, 'project'> & {
  project: z.infer<typeof apercuDeProjetSchema> | ProjectDoc;
  refus?: undefined;
};

/** Une entrée relue qui porte un `id` mais que l'ENVELOPPE refuse : LISTÉE, son refus levé au geste, son contenu
 *  `brut` réécrit tel quel par toute écriture (#2404). Les champs d'affichage sont ceux du brut quand il les
 *  type, sinon vides. */
export type EntreeRefusee = Omit<SavedProject, 'project' | 'refus'> & {
  project: z.infer<typeof apercuDeProjetSchema>;
  refus: ProjetRefuse;
  brut: unknown;
};

/** Une entrée LISTÉE de la bibliothèque. */
export type EntreeListee = SavedProject | EntreeRefusee;

/** L'entrée que l'application ÉCRIT : son projet est un `ProjectDoc` entier. */
export type EntreeEcrite = SavedProject & { project: ProjectDoc };

/** La campagne LANCÉE (`setPendingCampaign`). */
export type CampagneLancee = NonNullable<EtatDeJeu['pendingCampaign']>;

/** Sujet du rapport d'une enveloppe refusée. */
const SUJET_DU_REFUS_D_ENVELOPPE = 'Entrée de bibliothèque d’un autre format, ou mal formée';

/** L'`id` qui désigne une entrée relue : une chaîne non vide, ou rien. */
export function idDesignable(brut: unknown): string | null {
  if (brut === null || typeof brut !== 'object') return null;
  const id = (brut as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/** Une entrée relue : PROUVÉE, REFUSÉE (listée, refus au geste) si elle porte un `id`, sinon `null` —
 *  journalisée, jamais listée, et conservée par l'écriture (#2404). */
function entreeRelue(brut: unknown): EntreeListee | null {
  const fautes = validateDocument(savedProjectSchema, brut);
  if (!fautes) return brut as SavedProject;
  const rapport = rapportDeFautes(SUJET_DU_REFUS_D_ENVELOPPE, fautes);
  console.error('[bibliotheque]', rapport);
  const id = idDesignable(brut);
  if (id === null) return null;
  const champs = brut as { label?: unknown; published?: unknown; savedAt?: unknown };
  return {
    id,
    label: typeof champs.label === 'string' ? champs.label : '',
    startSceneId: '',
    savedAt: typeof champs.savedAt === 'number' ? champs.savedAt : 0,
    published: champs.published === true,
    project: { scenes: [] },
    refus: new ProjetRefuse('schema', fautes, rapport),
    brut,
  };
}

/** Les entrées listées de `liste`, relue entrée par entrée (`entreeRelue`). */
export function entreesRelues(liste: readonly unknown[]): EntreeListee[] {
  return liste.flatMap((brut) => entreeRelue(brut) ?? []);
}

/** Ce qu'une écriture reçoit d'une entrée listée : le brut d'une entrée refusée, jamais une réécriture. */
export function aEcrire(e: EntreeListee): unknown {
  return e.refus ? e.brut : e;
}

/** Le projet d'une entrée, passé par la porte `parseProject` : une entrée refusée lève son refus. */
export function projetDUneEntree(p: EntreeListee): ProjectDoc {
  if (p.refus) throw p.refus;
  return parseProject(p.project);
}

/** La campagne lancée depuis l'entrée `p` : le document passe la porte (`projetDUneEntree`) et un refus lève
 *  `ProjetRefuse`. Le `label` est celui du document PARSÉ ; l'`id` et la scène d'entrée sont ceux de l'ENTRÉE,
 *  `projet` est l'id du DOCUMENT parsé (#2206), et une scène d'entrée absente du document lève `ProjetRefuse` de
 *  cause `'entree'`. */
export function campagneDUneEntree(p: EntreeListee): CampagneLancee {
  const { id, label, scenes, worldMap, activeAxes, narratif } = projetDUneEntree(p);
  // #1627
  if (!scenes.some((s) => s.id === p.startSceneId)) {
    throw refusDeForme('entree', ['startSceneId'], `scène de départ « ${p.startSceneId} » absente du projet`);
  }
  return {
    id: p.id,
    label,
    scenes,
    startSceneId: p.startSceneId,
    worldMap: worldMap ?? null,
    ...(activeAxes !== undefined ? { activeAxes } : {}),
    narratif,
    projet: { id },
  };
}

/** Repli d'AFFICHAGE du nom d'un projet : une entrée dont le nom est vide (entrée fabriquée hors
 *  éditeur) se rend NOMMÉE « (sans nom) » plutôt qu'en rangée muette — le geste de
 *  suppression/ouverture reste ainsi désignable. SOURCE UNIQUE des deux écrans qui listent des
 *  projets (« Ouvrir » de l'éditeur, bibliothèque de campagnes). */
export const NOM_DE_PROJET_ABSENT = '(sans nom)';
export function nomDeProjet(label: string | undefined | null): string {
  return label?.trim() || NOM_DE_PROJET_ABSENT;
}

/** La marque, dans une liste, d'une entrée dont le projet est refusé. */
export const MARQUE_AUTRE_FORMAT = 'Autre format';

/** Ce qu'un refus `prose-non-materialisee` dit à qui importe : le fichier est la forme DÉPÔT d'une
 *  campagne livrée, pas son export. SOURCE UNIQUE de l'import joueur et de l'import de l'éditeur. */
export const IMPORT_FORME_DEPOT =
  'Ce fichier est la version de travail d’une campagne : les textes du livre n’y sont pas. Importez le fichier exporté par le jeu.';
