import { pregenParty, PREGEN } from '../../data/pregens';
import type { Combatant } from '../../engine/types';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { Dialogue } from '../../state/scene';
import type { NarratifBlock, PresetPnj } from '../../state/campaignNarratif';
import type { TestScenario } from './_shared';

/**
 * Recette du LOT C de #671 : trois PNJ pilotes de « L'Ennemi Intérieur » authorés en `presetsPnj`
 * (base globale + surcharges embarquées, résolus par `resolvePresetCreature` une fois le narratif posé
 * par `loadProject`), puis mis en scène — spawn + dialogue avec portrait (Phillipe) + combat (Knud).
 * Statblocs VF verbatim (règle 1), chaque preset tagué à sa `source {book, page}` (folio imprimé).
 */
const presetsPnj: PresetPnj[] = [
  {
    // MSR 141 — Appendice I, « L'entraînement et les mentors » (le capitaine du Bérébeli).
    id: 'edo-josef-quartjin',
    base: 'batelier',
    source: { book: 'mort-sur-le-reik', page: 141 },
    profil: {
      label: 'Josef Quartjin',
      char: { M: 4, 'capacite-de-combat': 48, 'capacite-de-tir': 38, force: 55, endurance: 48, initiative: 42, agilite: 43, dexterite: 39, intelligence: 30, 'force-mentale': 24, sociabilite: 48, B: 15 },
      traits: [
        { id: 'a-distance', value: 9, arg: 'arbalete', range: 60 },
        { id: 'arme', value: 9, arg: 'Hache' },
        { id: 'armure', value: 1, arg: 'Calotte et Veste de cuir' },
      ],
      skills: [
        { id: 'metier', spec: 'construction-de-bateaux', value: 49 },
        { id: 'orientation', value: 50 },
        { id: 'ramer', value: 64 },
        { id: 'resistance-a-l-alcool', value: 73 },
        { id: 'savoir', spec: 'voies-fluviales', value: 45 },
        { id: 'survie-en-exterieur', value: 47 },
        { id: 'voile', value: 82 },
      ],
      talents: [
        { id: 'destinee' },
        { id: 'pecheur' },
        { id: 'sens-de-l-orientation' },
        { id: 'tres-fort' },
      ],
    },
  },
  {
    // EDO 30 — ch.2 « Erreur sur la personne » (le chef mutant). Le `mutant` de base porte 2 Traits
    // `mutation` : le tableau `traits` remplace en bloc (merge lot A) → tous listés ici.
    id: 'edo-knud-cratinx',
    base: 'mutant',
    source: { book: 'ennemi-dans-l-ombre', page: 30 },
    profil: {
      label: 'Knud Cratinx',
      char: { M: 4, 'capacite-de-combat': 36, 'capacite-de-tir': 43, force: 39, endurance: 32, initiative: 35, agilite: 33, dexterite: 29, intelligence: 33, 'force-mentale': 35, sociabilite: 30, B: 12 },
      traits: [
        { id: 'a-distance', value: 9, arg: 'arbalete', range: 60 },
        { id: 'arme', value: 7, arg: 'Épée' },
        { id: 'corruption', arg: 'Mineure' },
        { id: 'mutation', arg: 'ecailles-epineuses' },
      ],
      skills: [
        { id: 'commandement', value: 45 },
        { id: 'corps-a-corps', spec: 'base', value: 54 },
        { id: 'intimidation', value: 49 },
        { id: 'perception', value: 43 },
        { id: 'projectiles', spec: 'arbalete', value: 52 },
        { id: 'survie-en-exterieur', value: 38 },
      ],
    },
  },
  {
    // EDO 23 — ch.1 « On recherche : aventuriers courageux » (« Le Joueur », Phillipe Descartes).
    id: 'edo-phillipe-descartes',
    base: 'humain',
    source: { book: 'ennemi-dans-l-ombre', page: 23 },
    profil: {
      label: 'Phillipe Descartes',
      char: { M: 4, 'capacite-de-combat': 30, 'capacite-de-tir': 32, force: 30, endurance: 26, initiative: 31, agilite: 34, dexterite: 44, intelligence: 33, 'force-mentale': 30, sociabilite: 29, B: 10 },
      traits: [
        { id: 'a-distance', value: 7, arg: 'pistolet', range: 30 },
        { id: 'arme', value: 8, arg: 'Épée' },
      ],
      skills: [
        { id: 'athletisme', value: 60 },
        { id: 'calme', value: 60 },
        { id: 'charme', value: 44 },
        { id: 'commandement', value: 49 },
        { id: 'corps-a-corps', spec: 'bagarre', value: 47 },
        { id: 'corps-a-corps', spec: 'base', value: 57 },
        { id: 'escalade', value: 62 },
        { id: 'escamotage', value: 64 },
        { id: 'esquive', value: 60 },
        { id: 'guerison', value: 39 },
        { id: 'intimidation', value: 52 },
        { id: 'intuition', value: 50 },
        { id: 'langue', spec: 'bataille', value: 49 },
        { id: 'marchandage', value: 44 },
        { id: 'musicien', spec: 'tambour', value: 35 },
        { id: 'pari', value: 50 },
        { id: 'perception', value: 55 },
        { id: 'projectiles', spec: 'poudre-noire', value: 60 },
        { id: 'ragot', value: 44 },
        { id: 'resistance', value: 53 },
        { id: 'resistance-a-l-alcool', value: 58 },
        { id: 'survie-en-exterieur', value: 44 },
      ],
      talents: [
        { id: 'attirant' },
        { id: 'chat-de-gouttiere' },
        { id: 'coude-a-coude' },
        { id: 'maitrise-des-des' },
        { id: 'rechargement-rapide' },
        { id: 'savoir-vivre', spec: 'Soldats' },
        { id: 'seigneur-de-guerre' },
        { id: 'tricheur' },
        { id: 'vigilance' },
      ],
    },
  },
];

const narratif: NarratifBlock = { affaires: [], indices: [], objets: [], presetsPnj };

const dialogues: Dialogue[] = [
  {
    id: 'dlg-phillipe',
    start: 'p1',
    nodes: [
      {
        id: 'p1',
        speakerId: 'npc-phillipe',
        desc:
          "« Vous cherchez la route de Kemperbad ? Prenez garde : Knud Cratinx et sa bande de mutants " +
          "écument ces bois. J'ai croisé leur chef ce matin — écailleux, une arbalète en travers du dos. " +
          "Il vous attend un peu plus loin. Alors ? On croise le fer, ou on file ? »",
        choices: [
          {
            label: 'Fondre sur Knud Cratinx avant qu’il ne se poste.',
            flow: flowFromEffects([
              { type: 'journal', desc: 'Phillipe dégaine son épée et vous emboîte le pas vers le mutant.' },
              { type: 'endDialogue' },
              { type: 'startCombat', encounter: 'enc-knud' },
            ]),
          },
          {
            // CHEMIN JOUEUR de « il leur propose une partie » (`EDO 01 l.200`) : sans lui, le rôle
            // `tavernGame` de l'entité est une affordance morte — authorée, jamais atteignable au clic.
            label: 'Accepter la partie de cartes qu’il propose.',
            icon: 'nav/dice',
            flow: flowFromEffects([{ type: 'openTavernGames' }]),
          },
          {
            label: 'Le remercier et poursuivre sans se presser.',
            flow: flowFromEffects([{ type: 'endDialogue' }]),
          },
        ],
      },
    ],
  },
];

const scene = buildScene({
  id: 'edo-presets-test',
  label: 'Presets PNJ — pilotes EDO',
  desc:
    'Une clairière sur la route de Kemperbad. Phillipe Descartes (preset EDO) hèle le groupe et le ' +
    'renseigne sur Knud Cratinx (preset EDO), le chef mutant posté plus loin — le dialogue peut enchaîner ' +
    'sur le combat. Josef Quartjin (preset EDO) rôde en retrait.',
  ambiance: 'exterieur',
  size: [14, 9],
  terrain: 'herbe',
  legend: { B: 'bois' },
  levels: {
    z0: [
      'BBBBBBBBBBBBBB',
      'B............B',
      'B............B',
      'B............B',
      '..............',
      'B............B',
      'B............B',
      'B............B',
      'BBBBBBBBBBBBBB',
    ].join('\n'),
  },
  heroStart: [1, 4],
  startMessage:
    'Un homme séduisant, épée au côté et dés à la ceinture, vous fait signe depuis la clairière.',
  // Fiches par PRESET (`presetId`, #671) : `narratif` ci-dessus, `resolvePresetCreature` ; preset
  // irrésoluble → `FicheAbsente` (`state/sceneNpc.ts`, #1882).
  entities: [
    // JOUEUR de taverne AUTHORÉ (#1279 S4) : « il leur propose une partie d'Impératrice Écarlate »
    // (`EDO 01 l.200`), et la mise plancher qu'il accepte est de 2 pistoles d'argent — « considère
    // comme une perte de temps de jouer pour moins de 2/- » (`EDO 01 l.202`), soit 24 sous.
    // Jeu posé : `dominos` ; le jeu du RAW, l'Impératrice écarlate (`NADJ 16 l.133-139`), manque à
    // `tavernGames.json` (#1921).
    { id: 'npc-phillipe', kind: 'personnage', pos: { x: 5, y: 4 }, presetId: 'edo-phillipe-descartes', dialogueId: 'dlg-phillipe', label: 'Phillipe Descartes',
      tavernGame: { gameId: 'dominos', stakeBrass: 24 } },
    { id: 'npc-josef', kind: 'personnage', pos: { x: 3, y: 2 }, presetId: 'edo-josef-quartjin', label: 'Josef Quartjin' },
  ],
  dialogues,
  encounters: [
    {
      id: 'enc-knud',
      enemies: [
        { pos: { x: 10, y: 4 }, presetId: 'edo-knud-cratinx', label: 'Knud Cratinx' },
      ],
      onVictory: flowFromEffects([
        { type: 'journal', desc: 'Knud Cratinx s’effondre dans un sifflement. La route de Kemperbad est libre.' },
        { type: 'giveXp', amount: 60 },
        { type: 'giveMoney', montant: { silver: 5 } },
      ]),
    },
  ],
});

export const scenario: TestScenario = {
  id: 'presets-edo',
  order: 23,
  category: 'scenarios',
  icon: 'nav/campaign',
  title: 'Presets PNJ — pilotes EDO',
  tests:
    'Recette #671 (lot C) : trois PNJ authorés en presets (base globale + surcharges embarquées) résolus ' +
    'au chargement du narratif. Spawn (Josef), dialogue avec portrait de preset (Phillipe), et combat ' +
    '(Knud Cratinx) déclenché depuis le dialogue.',
  partyNote: 'Soldat · Chasseur · Prêtre',
  makeParty: (): Combatant[] => pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.pretre),
  scene,
  narratif,
};
