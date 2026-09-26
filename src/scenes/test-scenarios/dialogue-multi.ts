import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';

/**
 * « Dialogue multi-interlocuteurs » (#669) : UN dialogue dont les NŒUDS alternent l'interlocuteur
 * via `DialogueNode.speakerId` (id d'une `SceneEntity` de la scène → SON portrait + SON nom, jamais
 * un nom en clair — CLAUDE.md, « on ne MANIPULE que des IDs »). Ouvert en parlant à Gustav
 * (`dialogueId: 'dlg-tablee'`) : le nœud d'accueil n'a PAS de `speakerId` → il hérite du locuteur de
 * SESSION posé par `interactEntity` (Gustav, l'entité qu'on a cliquée). Les nœuds suivants alternent
 * vers Isolde puis Phillipe (`speakerId` explicite), avant de revenir à Gustav (session, par défaut).
 * `dlg-gustav-repeat` illustre le PATRON DE REPRISE : les CHOIX du nœud d'accueil sont gatés par
 * `when` sur un flag — un premier passage propose la présentation, les suivants un accueil différent
 * (rien au niveau du nœud lui-même : la reprise est un branchement ORDINAIRE de `Condition`, pas un
 * mécanisme séparé).
 */
const auberge = buildScene({
  id: 'test-dialogue-multi-auberge',
  label: 'Auberge — la tablée',
  desc: 'Arène de test.',
  size: [12, 8],
  terrain: 'herbe',
  heroStart: [3, 6],
  entities: [
    { id: 'gustav', kind: 'personnage', ref: 'humain', label: 'Gustav', pos: { x: 5, y: 3 }, appearance: { species: 'humains-reiklander' }, dialogueId: 'dlg-tablee' },
    { id: 'isolde', kind: 'personnage', ref: 'humain', label: 'Isolde', pos: { x: 7, y: 3 }, appearance: { species: 'humains-reiklander' } },
    { id: 'phillipe', kind: 'personnage', ref: 'humain', label: 'Phillipe', pos: { x: 6, y: 4 }, appearance: { species: 'humains-reiklander' } },
  ],
  startMessage:
    'Une tablée d’auberge : Gustav, Isolde et Phillipe. Parlez à Gustav — la conversation passe de ' +
    'main en main, portrait et nom changeant à chaque réplique (`speakerId`, #669).',
  dialogues: [
    {
      id: 'dlg-tablee',
      start: 'a1',
      nodes: [
        {
          // Pas de speakerId : hérite du locuteur de SESSION (Gustav, l'entité cliquée par interactEntity).
          id: 'a1',
          desc: '« Vous tombez bien — on refaisait le monde. Isolde soutient qu’un dragon a survolé le Nordland la semaine dernière. »',
          choices: [{ label: '« Un dragon ? »', next: 'a2' }],
        },
        {
          id: 'a2',
          speakerId: 'isolde',
          desc: '« Je l’ai VU, de mes yeux. Une ombre plus grande qu’une grange, au-dessus de la lisière. Phillipe ne me croit pas. »',
          choices: [{ label: '« Et vous, Phillipe ? »', next: 'a3' }],
        },
        {
          id: 'a3',
          speakerId: 'phillipe',
          desc: 'Il hausse les épaules. « Une ombre de nuage, plutôt. Isolde voit des dragons partout depuis qu’elle a lu ce roman de gare. »',
          choices: [{ label: '« Vous vous chamaillez souvent ? »', next: 'a4' }],
        },
        {
          id: 'a4',
          // Retour au locuteur de session (Gustav) sans le redéclarer.
          desc: 'Gustav rit et lève sa chope. « Tous les soirs, l’ami. Ça fait la conversation. »',
          choices: [{ label: 'Trinquer avec eux.', flow: flowFromEffects([{ type: 'setFlag', flag: 'tablee_faite' }, { type: 'endDialogue' }]) }],
        },
      ],
    },
    {
      // Patron de reprise : le nœud d'accueil est unique, mais ses CHOIX se gatent par `when` sur un
      // flag (posé au premier passage) — un état déjà atteint change ce qui est PROPOSÉ, sans nouveau
      // mécanisme (juste des `Condition` ordinaires sur `DialogueChoice.when`).
      id: 'dlg-gustav-repeat',
      start: 'accueil',
      nodes: [
        {
          id: 'accueil',
          desc: 'Gustav lève les yeux de sa chope.',
          choices: [
            {
              label: '(Se présenter)',
              when: { kind: 'flag', expr: '!repeat_presente' },
              flow: flowFromEffects([{ type: 'setFlag', flag: 'repeat_presente' }, { type: 'journal', desc: 'Gustav vous serre la main. « Enchanté, on se reverra. »' }, { type: 'endDialogue' }]),
            },
            {
              label: '(Reprendre la conversation)',
              when: { kind: 'flag', expr: 'repeat_presente' },
              flow: flowFromEffects([{ type: 'journal', desc: '« Encore vous ! Asseyez-vous. »' }, { type: 'endDialogue' }]),
            },
          ],
        },
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'dialogue-multi',
  order: 22,
  category: 'scenarios',
  icon: 'scenario/village',
  title: 'Dialogue multi-interlocuteurs',
  tests:
    'Dialogue #669 : `DialogueNode.speakerId` (id d’entité de scène → portrait + nom) alterne le ' +
    'locuteur d’un nœud à l’autre — Gustav (session, `interactEntity`) → Isolde → Phillipe → Gustav ; ' +
    'ZÉRO nom en clair dans la donnée. `dlg-gustav-repeat` illustre le patron de reprise (`when` sur flag).',
  partyNote: 'Sigmund (Soldat) · Tueur nain · Sorcier · Chasseur',
  makeParty: () => pregenParty(PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur),
  scene: auberge,
};
