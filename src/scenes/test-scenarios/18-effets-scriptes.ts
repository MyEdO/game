import { makePregens } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * « Effets scriptés » (#96/#97) : quatre moteurs faits+testés Vitest (`fall`+`inflictTrauma`,
 * `medicalAid`, `ambitionLost`, `petitePriere`) mais jamais atteignables depuis le menu — chacun
 * posé ici sur un déclencheur réel (trigger de zone, dialogue, décor interactif) d'un petit village.
 * Quatre interactions indépendantes, une seule chacune : rien à répéter (anti-grind trivial).
 */
const construireVillage = (): Scene => buildScene({
  id: 'test-effets-scriptes-village',
  label: 'Ebendorf — place du village',
  desc: 'Arène de test.',
  size: [12, 9],
  terrain: 'herbe',
  heroStart: [2, 4],
  startMessage:
    'La place d’Ebendorf. Le médecin Holst reçoit près de sa maison (soins payants), l’autel de la ' +
    'chapelle attend une prière, le messager porte de mauvaises nouvelles, et la trappe de la cave à ' +
    'provisions n’a pas été réparée depuis des lustres.',
  entities: [
    // Effet `medicalAid` (LDB 75) : PNJ soigneur payant, distinct de l'Action Guérison générique.
    {
      id: 'medecin', kind: 'personnage', ref: 'medecin', label: 'Médecin Holst',
      pos: { x: 8, y: 2 }, dialogueId: 'dlg-medecin',
    },
    // Effet `petitePriere` (LDB 25 l.22-24, option `prayer-petites`) : site sacré pour un non-Béni.
    {
      id: 'autel', kind: 'prop', ref: 'autel', pos: { x: 8, y: 7 },
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
    // Effet `ambitionLost` (ADE II Annexe I, reporté de #94) : le messager annonce une catastrophe.
    {
      id: 'messager', kind: 'personnage', ref: 'villageois', label: 'Messager essoufflé',
      pos: { x: 3, y: 2 }, dialogueId: 'dlg-messager',
    },
  ],
  dialogues: [
    {
      id: 'dlg-medecin',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          desc: '« Je soigne qui peut payer — pas plus, pas moins. Bander une plaie, ça se facture. »',
          choices: [
            {
              label: 'Ouvrir son infirmaire (soins payants).',
              flow: flowFromEffects([
                {
                  type: 'medicalAid', entityId: 'medecin',
                  acts: [{ act: 'wounds', cost: { silver: 5 } }, { act: 'bleed', cost: { silver: 5 } }],
                },
                { type: 'endDialogue' },
              ]),
            },
            { label: 'Une autre fois.', flow: flowFromEffects([{ type: 'endDialogue' }]) },
          ],
        },
      ],
    },
    {
      id: 'dlg-messager',
      start: 'annonce',
      nodes: [
        {
          id: 'annonce',
          desc: '« L’atelier a brûlé cette nuit — il n’en reste rien. Tout ce pour quoi vous travailliez... c’est fini. »',
          choices: [
            {
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
        { type: 'fall', target: 'party', metres: 3, to: { x: 9, y: 6 } },
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
    '`petitePriere` (autel interactif, LDB 25, option `prayer-petites`), `ambitionLost` (dialogue du ' +
    'messager, ADE II Annexe I), `fall`+`inflictTrauma` (trappe vermoulue, LDB 15/18, repositionnement).',
  partyNote: 'Pré-tirés',
  construire: () => ({ party: makePregens(), scene: construireVillage() }),
  rules: { 'prayer-petites': true, 'psych-acquisition-optional': true },
};
