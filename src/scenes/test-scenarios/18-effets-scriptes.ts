import { tousLesHerosDeScenario } from './_heros';
import { buildScene } from '../../noyau/mapSpec';
import { flowFromEffects } from '../../noyau/monde/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';

/**
 * « Effets scriptés » (#96/#97) : cinq moteurs faits+testés Vitest (`fall`+`inflictTrauma`,
 * `medicalAid`, `ambitionLost`, `petitePriere`, `openCharacterCreator`) mais jamais atteignables depuis le
 * menu — chacun posé ici sur un déclencheur réel (trigger de zone, dialogue, décor interactif) d'un petit village.
 * Cinq interactions indépendantes, une seule chacune : rien à répéter (anti-grind trivial).
 */
const construireVillage = (): Scene => buildScene({
  id: 'test-effets-scriptes-village',
  label: 'Ebendorf — place du village',
  desc: 'Arène de test.',
  size: [12, 9],
  terrain: 'herbe',
  heroStart: [2, 4],
  startMessage:
    { texte: 'La place d’Ebendorf. Le médecin Holst reçoit près de sa maison (soins payants), l’autel de la ' +
    'chapelle attend une prière, le messager porte de mauvaises nouvelles, et la trappe de la cave à ' +
    'provisions n’a pas été réparée depuis des lustres.' },
  entities: [
    // Effet `medicalAid` (LDB 75) : PNJ soigneur payant, distinct de l'Action Guérison générique.
    {
      id: 'medecin', kind: 'personnage', creature: { id: 'stefan-hochen' }, label: 'Médecin Holst',
      pos: { x: 8, y: 2 }, dialogueId: { id: 'dlg-medecin' },
    },
    // Effet `petitePriere` (LDB 25 l.22-24, option `priere-petites`) : site sacré pour un non-Béni.
    {
      id: 'autel', kind: 'prop', decor: { id: 'autel' }, pos: { x: 8, y: 7 },
      usable: { actions: [{ id: 'fouiller', unique: true, consume: false,
        flow: flowFromEffects([
          {
            type: 'petitePriere',
            reward: flowFromEffects([
              { type: 'journal', desc: 'Une chaleur inattendue vous traverse — la prière a porté.' },
              { type: 'giveXp', amount: 20 },
            ]),
          },
        ]) }] },
    },
    // Effet `openCharacterCreator` (#3556) : l'hôte ouvre sa création sur un héros neuf.
    {
      id: 'avis-d-enrolement', kind: 'prop', decor: { id: 'panneau' }, label: 'Avis d’enrôlement', pos: { x: 2, y: 7 },
      usable: { actions: [{ id: 'lire', label: 'Signer l’enrôlement', flow: flowFromEffects([{ type: 'openCharacterCreator' }]) }] },
    },
    // Effet `ambitionLost` (ADE II Annexe I, reporté de #94) : le messager annonce une catastrophe.
    {
      id: 'messager', kind: 'personnage', creature: { id: 'humain' }, label: 'Messager essoufflé',
      pos: { x: 3, y: 2 }, dialogueId: { id: 'dlg-messager' },
    },
  ],
  dialogues: [
    {
      id: 'dlg-medecin',
      start: { id: 'accueil' },
      nodes: [
        {
          id: 'accueil',
          desc: '« Je soigne qui peut payer — pas plus, pas moins. Bander une plaie, ça se facture. »',
          choices: [
            {
              id: 'ouvrir-infirmaire-soins',
              label: 'Ouvrir son infirmaire (soins payants).',
              flow: flowFromEffects([
                {
                  type: 'medicalAid', entityId: { id: 'medecin' },
                  acts: [{ act: 'blessures', cost: { silver: 5 } }, { act: 'hemorragie', cost: { silver: 5 } }],
                },
                { type: 'endDialogue' },
              ]),
            },
            { id: 'autre-fois', label: 'Une autre fois.', flow: flowFromEffects([{ type: 'endDialogue' }]) },
          ],
        },
      ],
    },
    {
      id: 'dlg-messager',
      start: { id: 'annonce' },
      nodes: [
        {
          id: 'annonce',
          desc: '« L’atelier a brûlé cette nuit — il n’en reste rien. Tout ce pour quoi vous travailliez... c’est fini. »',
          choices: [
            {
              id: 'encaisser-nouvelle',
              label: 'Encaisser la nouvelle.',
              flow: flowFromEffects([{ type: 'ambitionLost' }, { type: 'endDialogue' }]),
            },
          ],
        },
      ],
    },
  ],
  triggers: [
    {
      id: 'trappe-cave',
      rect: { x: 9, y: 5, w: 1, h: 1 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', desc: 'Une planche vermoulue cède sous votre pied — vous plongez dans la cave à provisions !' },
        { type: 'fall', target: 'groupe', metres: 3, to: { x: 9, y: 6 } },
        { type: 'inflictTrauma', kind: 'dechirure', severity: 'mineur', location: 'jambeD' },
      ]),
    },
  ],
});

export const scenario: TestScenario = {
  id: 'effets-scriptes',
  order: 20,
  category: 'scenarios',
  icon: 'scenario/village',
  title: 'Effets scriptés',
  tests:
    'Quatre Effets d’auteur testés au moteur mais orphelins de scénario (#96/#97), chacun câblé à un ' +
    'déclencheur réel : `medicalAid` (dialogue du médecin, soins payants distincts de Guérison), ' +
    // LDB 25
    '`petitePriere` (autel interactif, option `priere-petites`), `ambitionLost` (dialogue du ' +
    // ADE II Annexe I ; LDB 15 ; LDB 18
    'messager), `fall`+`inflictTrauma` (trappe vermoulue, repositionnement), `openCharacterCreator` (avis ' +
    'd’enrôlement : la création s’ouvre sur un héros neuf).',
  partyNote: 'Pré-tirés',
  construire: (idNeuf) => ({ party: tousLesHerosDeScenario(idNeuf), scene: construireVillage() }),
  rules: { 'priere-petites': true, 'psycho-acquisition-optionnelle': true },
};
