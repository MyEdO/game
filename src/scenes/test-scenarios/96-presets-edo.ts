import { pregenParty, PREGEN } from '../../data/pregens';
import { buildScene } from '../../state/mapSpec';
import { flowFromEffects } from '../../state/flow';
import type { Dialogue, Scene } from '../../state/scene';
import { emptyNarratif, type NarratifBlock, type PresetPnj } from '../../state/campaignNarratif';
import { diligenceCampaign, paquetDuJeu } from '../campaign';
import type { TestScenario } from './_shared';

/**
 * Recette du LOT C de #671 : trois PNJ de « L'Ennemi Intérieur » authorés en `presetsPnj` (base globale
 * + surcharges embarquées, résolus par `resolvePresetCreature` une fois le narratif posé par
 * `loadProject`), puis mis en scène — spawn + dialogue avec portrait (Phillipe) + combat (Knud).
 * Knud et Phillipe : le paquet de la Diligence (`diligence/diligence-projet.json`, #680) ; Josef : MSR 141.
 */
function presetDuPaquet(id: string): PresetPnj {
  const preset = paquetDuJeu(diligenceCampaign).narratif.presetsPnj.find((p) => p.id === id);
  if (!preset) throw new Error(`preset « ${id} » absent du paquet de la Diligence`);
  return preset;
}

function construireNarratif(): NarratifBlock {
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
          { id: 'destinee', spec: 'Une soif insatiable vous poussera à la noyade' },
          { id: 'pecheur' },
          { id: 'sens-de-l-orientation' },
          { id: 'tres-fort' },
        ],
      },
    },
    ...['edo-knud-cratinx', 'edo-phillipe-descartes'].map(presetDuPaquet),
  ];
  return { ...emptyNarratif(), presetsPnj };
}


function construireScene(): Scene {
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
  return scene;
}

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
  construire: () => ({
    party: pregenParty(PREGEN.soldat, PREGEN.chasseur, PREGEN.pretre),
    scene: construireScene(),
    narratif: construireNarratif(),
  }),
};
