import { makePregens } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import { emptyNarratif, type DocumentNarratif, type NarratifBlock } from '../../state/campaignNarratif';
import { diligenceCampaign, paquetDuJeu } from '../campaign';
import type { TestScenario } from './_shared';
import type { DialogueChoice, DialogueNode, Scene } from '../../state/scene';

/**
 * Recette des documents joueur de L'Ennemi dans l'Ombre (#679) : une liasse, dans un cabinet dédié,
 * offre la lecture de chacun des documents du registre `narratif.documents` du paquet EDO
 * (`diligence-projet.json`, passé par `parseProject`), rangés par chapitre. Affaire et indice de
 * FIXTURE (prose maison, sans source) dont deux stades croisent les Documents 8 et 9
 * (`IndiceStade.documentId`) — terrain de la recette du Carnet.
 */

/** Documents de la liasse, par chapitre d'EDO. */
const CHAPITRES: readonly { id: string; label: string; documents: readonly string[] }[] = [
  { id: 'ch1', label: 'Chapitre 1 — On recherche : aventuriers courageux', documents: ['edo-document-1-on-recherche'] },
  { id: 'ch2', label: 'Chapitre 2 — Erreur sur la personne', documents: ['edo-document-2-rolf-hurtsis', 'edo-document-3-heritage', 'edo-document-4-affidavit'] },
  { id: 'ch3', label: 'Chapitre 3 — Le cœur de l’Empire', documents: ['edo-document-5-josef-quartjin', 'edo-document-6-schaffenfest'] },
  { id: 'ch4', label: 'Chapitre 4 — Sur la route de Bögenhafen', documents: ['edo-document-7-lettre-q-f'] },
  { id: 'ch8', label: 'Chapitre 8 — Chasser les ombres', documents: ['edo-document-8-invitation-de-teugen', 'edo-document-9-tout-se-passe-bien'] },
  { id: 'ch9', label: 'Chapitre 9 — L’heure fatidique', documents: ['edo-document-10-lettre-d-herzen', 'edo-document-11-mot-de-magirius'] },
];

const LIASSE = 'liasse';
const INDICE = 'ind-billets-de-teugen';

/** Réponses du chapitre 8 qui consignent au Carnet les stades croisés avec les Documents 8 et 9. */
const CONSIGNES_CH8: readonly DialogueChoice[] = [
  {
    label: 'Consigner l’invitation au carnet.',
    flow: flowFromEffects([{ type: 'revealClue', indiceId: INDICE, stade: 's-invitation' }]),
    next: 'ch8',
  },
  {
    label: 'Consigner le billet signé Teugen au carnet.',
    flow: flowFromEffects([{ type: 'revealClue', indiceId: INDICE, stade: 's-billet' }]),
    next: 'ch8',
  },
];

function construireNarratif(documents: DocumentNarratif[]): NarratifBlock {
  return {
    ...emptyNarratif(),
    documents,
    affaires: [{ id: 'aff-conseil-interieur', titre: 'Le Conseil intérieur' }],
    indices: [
      {
        id: INDICE,
        affaireId: 'aff-conseil-interieur',
        kind: 'indice',
        titre: 'Les billets de Teugen',
        stades: [
          { id: 's-invitation', documentId: 'edo-document-8-invitation-de-teugen' },
          { id: 's-billet', prose: 'Le même nom signe les deux billets.', documentId: 'edo-document-9-tout-se-passe-bien' },
        ],
      },
    ],
  };
}

/** Un titre entre guillemets, sauf s'il porte déjà les siens (Document 9, « Tout se passe bien »). */
const cite = (titre: string): string => (/^[«“"].*[»”"]$/u.test(titre) ? titre : `« ${titre} »`);

function construireScene(documents: readonly DocumentNarratif[]): Scene {
  const titreDe = (id: string): string => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) throw new Error(`documents-edo : document « ${id} » absent du paquet EDO.`);
    return doc.titre;
  };
  const noeudsDeChapitre: DialogueNode[] = CHAPITRES.map((ch) => ({
    id: ch.id,
    desc: ch.label,
    choices: [
      ...ch.documents.map((documentId): DialogueChoice => ({
        label: `Lire ${cite(titreDe(documentId))}.`,
        flow: flowFromEffects([{ type: 'document', documentId }]),
        next: LIASSE,
      })),
      ...(ch.id === 'ch8' ? CONSIGNES_CH8 : []),
      { label: 'Revenir à la liasse.', next: LIASSE },
    ],
  }));
  return buildScene({
    id: 'test-documents-edo-cabinet',
    label: 'Cabinet — documents d’EDO',
    desc: 'Arène de test.',
    size: [6, 5],
    terrain: 'pierre',
    ambiance: 'interieur',
    heroStart: [1, 2],
    startMessage:
      { texte: 'Un cabinet de lecture. Sur le bureau, une liasse réunit les documents de L’Ennemi dans l’Ombre, ' +
      'rangés par chapitre.' },
    entities: [
      {
        id: 'liasse-edo', kind: 'prop', ref: 'bureau', pos: { x: 3, y: 2 }, label: 'Liasse de documents',
        usable: { actions: [{ id: 'lire', label: 'Parcourir la liasse', flow: flowFromEffects([{ type: 'startDialogue', dialogue: 'dlg-liasse' }]) }] },
      },
    ],
    dialogues: [
      {
        id: 'dlg-liasse',
        start: LIASSE,
        nodes: [
          {
            id: LIASSE,
            desc: 'La liasse est rangée par chapitre.',
            choices: [
              ...CHAPITRES.map((ch): DialogueChoice => ({ label: ch.label, next: ch.id })),
              { label: 'Refermer la liasse.' },
            ],
          },
          ...noeudsDeChapitre,
        ],
      },
    ],
  });
}

export const scenario: TestScenario = {
  id: 'documents-edo',
  order: 27,
  category: 'scenarios',
  icon: 'nav/campaign',
  title: "Documents de L'Ennemi dans l'Ombre",
  tests:
    'Registre `narratif.documents` du paquet EDO (#679) : chaque document de la liasse s’ouvre par ' +
    'l’Effect `document { documentId }` avec le titre et la prose du paquet, puis la conversation revient ' +
    'à la liasse ; deux stades d’un indice de fixture croisent les Documents 8 et 9 (`IndiceStade.documentId`) ' +
    'et sont révélés au Carnet par `revealClue`.',
  partyNote: 'Pré-tirés',
  construire: () => {
    const { documents } = paquetDuJeu(diligenceCampaign).narratif;
    return { party: makePregens(), scene: construireScene(documents), narratif: construireNarratif(documents) };
  },
};
