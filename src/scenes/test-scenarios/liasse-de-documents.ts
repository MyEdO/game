import { tousLesHerosDeScenario } from './_heros';
import { buildScene } from '../../noyau/mapSpec';
import { flowFromEffects } from '../../noyau/monde/flow';
import { emptyNarratif } from '../../noyau/monde/campaignNarratif';
import type { DocumentNarratif } from '../../data/schemas/defs-scenes/narratif';
import type { TestScenario } from './_shared';

/**
 * Une liasse de documents de FIXTURE (#679, #4936) : dans un cabinet, une liasse offre la lecture de chacun des
 * documents du registre `narratif.documents` du scénario, rangés par chapitre ; chaque lecture joue l'Effect
 * `document { documentId }` puis revient à la liasse. Prose maison, sans source.
 */

const LIASSE = 'liasse';

/** Les documents de la liasse, par chapitre. */
const CHAPITRES: readonly { id: string; label: string; documents: readonly DocumentNarratif[] }[] = [
  {
    id: 'ch1',
    label: 'Chapitre 1 — Lettres',
    documents: [
      { id: 'lettre-de-test', titre: 'Lettre de test', prose: 'Une lettre de fixture, *signée* au bas de la page.' },
      { id: 'billet-de-test', titre: 'Billet de test', prose: 'Un billet de fixture, plié en quatre.' },
    ],
  },
  {
    id: 'ch2',
    label: 'Chapitre 2 — Affiches',
    documents: [{ id: 'affiche-de-test', titre: 'Affiche de test', prose: 'Une affiche de fixture, clouée à un poteau.' }],
  },
];

export const scenario: TestScenario = {
  id: 'liasse-de-documents',
  order: 27,
  category: 'scenarios',
  icon: 'navigation/campagne',
  title: 'Liasse de documents',
  tests:
    'Registre `narratif.documents` (#679) : chaque document de la liasse s’ouvre par l’Effect `document { documentId }` ' +
    'avec son titre et sa prose, puis la conversation revient à la liasse.',
  partyNote: 'Pré-tirés',
  construire: (idNeuf) => ({
    party: tousLesHerosDeScenario(idNeuf),
    narratif: { ...emptyNarratif(), documents: CHAPITRES.flatMap((ch) => ch.documents) },
    scene: buildScene({
      id: 'test-liasse-cabinet',
      label: 'Cabinet — liasse de documents',
      desc: 'Arène de test.',
      size: [6, 5],
      terrain: 'pierre',
      ambiance: 'interieur',
      heroStart: [1, 2],
      startMessage: { texte: 'Un cabinet de lecture. Sur le bureau, une liasse réunit des documents rangés par chapitre.' },
      entities: [
        {
          id: 'liasse', kind: 'prop', decor: { id: 'bureau' }, pos: { x: 3, y: 2 }, label: 'Liasse de documents',
          usable: { actions: [{ id: 'lire', label: 'Parcourir la liasse', flow: flowFromEffects([{ type: 'startDialogue', dialogue: { id: 'dlg-liasse' } }]) }] },
        },
      ],
      dialogues: [
        {
          id: 'dlg-liasse',
          start: { id: LIASSE },
          nodes: [
            {
              id: LIASSE,
              desc: 'La liasse est rangée par chapitre.',
              choices: [
                ...CHAPITRES.map((ch) => ({ id: ch.id, label: ch.label, next: { id: ch.id } })),
                { id: 'refermer-liasse', label: 'Refermer la liasse.' },
              ],
            },
            ...CHAPITRES.map((ch) => ({
              id: ch.id,
              desc: ch.label,
              choices: [
                ...ch.documents.map((d) => ({
                  id: `lire-${d.id}`,
                  label: `Lire « ${d.titre} ».`,
                  flow: flowFromEffects([{ type: 'document', documentId: d.id }]),
                  next: { id: LIASSE },
                })),
                { id: 'revenir-liasse', label: 'Revenir à la liasse.', next: { id: LIASSE } },
              ],
            })),
          ],
        },
      ],
    }),
  }),
};
