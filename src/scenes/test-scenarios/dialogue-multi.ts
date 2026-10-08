import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { TestScenario } from './_shared';
import type { Scene } from '../../state/scene';

/**
 * « Dialogue multi-interlocuteurs » (#669) : UN dialogue dont les NŒUDS alternent l'interlocuteur
 * via `DialogueNode.speakerId` (id d'une `SceneEntity` de la scène → SON portrait + SON nom, jamais
 * un nom en clair — CLAUDE.md, « on ne MANIPULE que des IDs »). Ouvert en parlant à Gustav
 * (`dialogueId: 'dlg-tablee'`) : le nœud d'accueil n'a PAS de `speakerId` → il hérite du locuteur de
 * SESSION posé par `interactEntity` (Gustav, l'entité qu'on a cliquée). Les nœuds suivants alternent
 * vers Isolde puis Phillipe (`speakerId` explicite), avant de revenir à Gustav (session, par défaut).
 * PATRON DE REPRISE, dans le dialogue même de l'entité (`dialogueId` est fixe : une reprise ne peut
 * vivre qu'à l'intérieur) : les CHOIX du nœud d'accueil sont gatés par `when` sur le flag que pose la
 * fin du premier passage — la reprise est un branchement ORDINAIRE de `Condition`, pas un mécanisme
 * séparé. La réponse du 1ᵉʳ passage est déclarée AVANT celles du 2ᵉ : masquée, elle ne consomme pas
 * de numéro, et la 1ʳᵉ réponse visible du 2ᵉ passage porte le 1.
 */
const construireAuberge = (): Scene => buildScene({
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
    { texte: 'Une tablée d’auberge : Gustav, Isolde et Phillipe. Parlez à Gustav — la conversation passe de ' +
    'main en main, portrait et nom changeant à chaque réplique (`speakerId`, #669).' },
  dialogues: [
    {
      id: 'dlg-tablee',
      start: 'a1',
      nodes: [
        {
          // Pas de speakerId : hérite du locuteur de SESSION (Gustav, l'entité cliquée par interactEntity).
          id: 'a1',
          desc: '« Vous tombez bien — on refaisait le monde. Isolde soutient qu’un dragon a survolé le Nordland la semaine dernière. »',
          choices: [
            { label: '« Un dragon ? »', when: { kind: 'flag', expr: '!tablee_faite' }, next: 'a2' },
            { label: '« Encore ce dragon ? »', when: { kind: 'flag', expr: 'tablee_faite' }, next: 'a2' },
            { label: '« Une autre fois. »', when: { kind: 'flag', expr: 'tablee_faite' }, flow: flowFromEffects([{ type: 'endDialogue' }]) },
          ],
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
    'ZÉRO nom en clair dans la donnée. Reparler à Gustav après la tablée : reprise par `when` sur flag ' +
    'dans le MÊME dialogue — la réponse masquée ne consomme pas de numéro (touche 1 = 1ʳᵉ visible).',
  partyNote: 'Sigmund (Soldat) · Tueur nain · Sorcier · Chasseur',
  construire: () => ({
    party: pregenParty(PREGEN.soldat, PREGEN.tueur, PREGEN.sorcier, PREGEN.chasseur),
    scene: construireAuberge(),
  }),
};
