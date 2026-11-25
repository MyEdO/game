/**
 * LE DOCUMENT PAR LE PONT (#3328) : l'Effect `document { documentId }` joué comme Godot le joue. Le groupe mené au
 * porteur, sa conversation ouverte, le document lu : la fenêtre porte son titre et son texte, puis « Refermer » rend
 * la conversation à son nœud.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table, enFocus } from './pont.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton } from '../../../src/hote/elements';
import { buildScene } from '../../../src/noyau/mapSpec';
import { flowFromEffects } from '../../../src/noyau/monde/flow';
import { emptyNarratif } from '../../../src/noyau/monde/campaignNarratif';
import { tousLesHerosDeScenario } from '../../../src/scenes/test-scenarios/_heros';
import type { TestScenario } from '../../../src/scenes/test-scenarios/_shared';
import { contenu } from '../../../src/scenes/fixtures/contenuDuCommun';
import paquetDeTest from '../../../src/scenes/fixtures/paquet-de-test.json';

const [DOCUMENT] = paquetDeTest.narratif.documents;

/** Un pupitre dont la conversation offre la lecture du document du paquet de test. */
const PUPITRE: TestScenario = {
  id: 'pupitre',
  order: 0,
  category: 'scenarios',
  icon: 'navigation/campagne',
  title: 'Pupitre',
  tests: 'L’Effect `document` ouvre la fenêtre du document, que « Refermer » rend à la conversation.',
  partyNote: 'Approchez le pupitre.',
  construire: (idNeuf) => ({
    party: tousLesHerosDeScenario(idNeuf),
    narratif: { ...emptyNarratif(), documents: [DOCUMENT] },
    scene: buildScene({
      id: 'pupitre',
      label: 'Cabinet',
      size: [6, 5],
      terrain: 'pierre',
      ambiance: 'interieur',
      heroStart: [1, 2],
      entities: [{
        id: 'pupitre', kind: 'prop', decor: { id: 'bureau' }, pos: { x: 3, y: 2 }, label: 'Pupitre',
        usable: { actions: [{ id: 'consulter', label: 'Consulter', flow: flowFromEffects([{ type: 'startDialogue', dialogue: { id: 'dlg-pupitre' } }]) }] },
      }],
      dialogues: [{
        id: 'dlg-pupitre',
        start: { id: 'pupitre' },
        nodes: [{
          id: 'pupitre',
          desc: 'Un document attend sur le pupitre.',
          choices: [
            { id: 'lire', label: 'Lire le document.', flow: flowFromEffects([{ type: 'document', documentId: DOCUMENT.id }]), next: { id: 'pupitre' } },
            { id: 'partir', label: 'Partir.' },
          ],
        }],
      }],
    }),
  }),
};

const { appel } = table(undefined, null, { ...contenu, scenarios: [PUPITRE] });

describe('le document par le pont', () => {
  it('lire un document, puis le refermer', () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'pupitre', graine: 7 }));
    while (suite.vue.projection.fenetre) ({ suite } = drainer(appel, appel('jouer', enFocus(suite.vue)!.jeu)));
    ({ suite } = drainer(appel, appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x: 2, y: 2 }] })));
    const consulter = suite.vue.zones['exploration.gestes'].find((b) => b.libelle === 'Pupitre : Consulter');
    expect(consulter, 'à portée, le pupitre s’offre').toBeDefined();
    ({ suite } = drainer(appel, appel('jouer', consulter!.jeu)));
    const lire = suite.vue.zones['dialogue.reponses'].find((b) => b.libelle.startsWith('Lire'))!;
    ({ suite } = drainer(appel, appel('jouer', lire.jeu)));

    const z = suite.vue.zones;
    expect(z['fenetre.titre'].map((l) => l.texte), 'la fenêtre porte le titre du document').toEqual([DOCUMENT.titre]);
    expect(z['fenetre.corps'].map((l) => l.id), 'son corps est le texte du document').toEqual(['lecture']);
    expect(z['fenetre.corps'][0]).toMatchObject({ texte: expect.stringContaining(DOCUMENT.prose) });
    expect(z['dialogue.reponses'], 'sous le document, la conversation ne se dessine pas').toEqual([]);

    const refermer = z['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.libelle === 'Refermer');
    expect(refermer, 'le document se referme').toBeDefined();
    ({ suite } = drainer(appel, appel('jouer', refermer!.jeu)));
    expect(suite.vue.zones['fenetre.corps'], 'le document refermé ne se dessine plus').toEqual([]);
    expect(suite.vue.zones['dialogue.replique'].map((l) => l.texte), 'la conversation revient à son nœud').toEqual(['Un document attend sur le pupitre.']);
  });
});
