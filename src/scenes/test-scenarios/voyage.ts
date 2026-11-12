import type { FabriqueDId } from '../../engine/fabriqueDId';
import { flowFromEffects } from '../../noyau/monde/flow';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { contractDisease } from '../../engine/disease';
import { contexteDeNaissanceDObjet, itemFromTrappingById } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { especeDApparence } from '../../data';
import { WorldMap } from '../../noyau/worldMap';
import { buildScene } from '../../noyau/mapSpec';
import { renforcerCompetence, type TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';

/**
 * « Voyage & temps long » : tout le temps long en un trajet. Réunit le Voyage & Nourriture (carte du
 * monde, haltes de nuit, récupération des blessés, faim/maladie/cauchemars/Exposition, péripéties +
 * embuscade), le Voyage par ÉTAPES EDOC (postes d'Activité PERSISTANTS par héros + règle `voyage-etapes`
 * activable au panneau Règles maison) et l'Entre-deux-aventures (interlude d'Activités à l'arrivée).
 */
/** Quatre héros, chacun à son POSTE de voyage (Étapes EDOC) ; Greta cumule le « mauvais état » qui fait
 *  parler le bilan de nuit (blessée, sans rations, Vérole contagieuse, cauchemars). */
function groupe(idNeuf: FabriqueDId): Combatant[] {
  // Chasseur — Plein air (Survie) : sa réussite dispense le groupe d'Exposition. Porte les rations du groupe.
  const bjorn = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'chasseur', label: 'Bjorn (test)', motivation: 'Test', seed: 2401, id: 'bjorn' });
  bjorn.travelRole = { activityId: 'plein-air' };
  renforcerCompetence(bjorn, 'survie-en-exterieur', 60);
  bjorn.items = [...(bjorn.items ?? []), itemFromTrappingById('ration', idNeuf, undefined, contexteDeNaissanceDObjet(bjorn))!, itemFromTrappingById('ration', idNeuf, undefined, contexteDeNaissanceDObjet(bjorn))!, itemFromTrappingById('ration', idNeuf, undefined, contexteDeNaissanceDObjet(bjorn))!];
  bjorn.appearance = { species: especeDApparence('humains-reiklander'), sex: 'M' };

  // Éclaireuse — Rester aux aguets (Perception) : le groupe ne peut être surpris cette Étape.
  const mira = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'eclaireur', label: 'Mira (test)', motivation: 'Test', seed: 2402, id: 'mira' });
  mira.travelRole = { activityId: 'rester-aux-aguets' };
  renforcerCompetence(mira, 'perception', 50);
  mira.appearance = { species: especeDApparence('humains-reiklander'), sex: 'F' };

  // Érudit — Établir des cartes (Métier Cartographe) : Test étendu cumulé ; PX pour l'Apprentissage (interlude).
  const aldric = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'erudit', label: 'Aldric (test)', motivation: 'Test', seed: 2403, id: 'aldric' });
  aldric.travelRole = { activityId: 'etablir-cartes' };
  renforcerCompetence(aldric, 'metier', 70, 'cartographe');
  aldric.xp = 300;
  aldric.appearance = { species: especeDApparence('humains-reiklander'), sex: 'M' };

  // Soldate — Approvisionnement (Survie FAIBLE → Rencontres dangereuses) ET « mauvais état » : blessée,
  // SANS rations (faim RAW), Vérole Urticante contagieuse (LDB 20), cauchemars (Test de Calme/nuit).
  const greta = createHero({ idNeuf, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Greta Hartmann', motivation: 'Ramener sa compagnie vivante — quel qu’en soit le prix.', seed: 1502, id: 'greta' });
  greta.travelRole = { activityId: 'approvisionnement' };
  renforcerCompetence(greta, 'survie-en-exterieur', 0);
  greta.wounds.current = Math.max(1, greta.wounds.max - 6);
  greta.nightmares = true;
  greta.diseases = [contractDisease('verole-urticante', makeRNG(1503), { incubation: 0, duration: 5 })!];
  greta.appearance = { species: especeDApparence('humains-reiklander'), sex: 'F' };
  bjorn.wounds.current = Math.max(1, bjorn.wounds.max - 8); // un blessé de plus → jet de Récupération de nuit

  return [bjorn, mira, aldric, greta];
}

// ── Scènes : village de départ (auberge), hameau, bourg, cité d'arrivée (interlude), embuscade ──
const construireVillage = (): Scene => buildScene({
  id: 'test-voyage-village',
  label: 'Village de Weiler',
  desc: 'Arène de test.',
  size: [14, 9],
  terrain: 'herbe',
  heroStart: [3, 4],
  weather: 'pluie', // nuit dehors = Exposition (la météo de la scène de départ suit le voyage)
  rest: { auberge: true },
  startMessage:
    { texte: 'L’aubergiste essuie un verre en jaugeant le groupe. « La route du hameau (24 km) n’est pas sûre, mais le bourg ' +
    '(30 km) a ses relais et sa diligence — et depuis le hameau, la longue route d’Altdorf (96 km) vous prendra trois ' +
    'nuits. » Chacun tient déjà son poste de voyage : Bjorn au plein air, Mira aux aguets, Aldric cartographie, Greta ' +
    'fourrage. Le groupe part blessé : chaque nuit apportera son lot de récupération, de faim, de Vérole et de ' +
    'cauchemars. À Altdorf, un cercle au sol ouvrira le répit entre deux aventures. (Ouvrez la carte du monde pour ' +
    'voyager.)' },
  entities: [
    { id: 'aubergiste', kind: 'personnage', creature: { id: 'humain' }, label: 'Aubergiste', pos: { x: 8, y: 3 }, appearance: { species: 'humains-reiklander' }, dialogueId: { id: 'dlg-auberge' } },
  ],
  dialogues: [
    {
      id: 'dlg-auberge',
      start: { id: 'accueil' },
      nodes: [
        {
          id: 'accueil',
          desc: 'Une table, une chope, un lit ? Tout se paie, mais tout est bon.',
          choices: [
            { id: 'prendre-chambres', label: 'Prendre des chambres pour la nuit.', flow: flowFromEffects([{ type: 'rest', lodging: 'auberge' }]) },
            { id: 'juste-repas', label: 'Juste un repas.', cost: { brass: 4 }, flow: flowFromEffects([{ type: 'mealParty' }]) },
            { id: 'autre-fois-partir', label: 'Une autre fois. (Partir)' },
          ],
        },
      ],
    },
  ],
});

const construireHameau = (): Scene => buildScene({
  id: 'test-voyage-hameau',
  label: 'Hameau de Federholz',
  desc: 'Arène de test.',
  size: [12, 8],
  terrain: 'herbe',
  heroStart: [3, 4],
  weather: 'pluie', // la longue route part d'ici : camper sous la pluie expose
  startMessage: { texte: 'Vous voilà à Federholz. (Reprenez la carte pour repartir — la LONGUE route d’Altdorf part d’ici.)' },
});

const construireBourg = (): Scene => buildScene({
  id: 'test-voyage-bourg',
  label: 'Bourg de Steinbruck',
  desc: 'Arène de test.',
  size: [12, 8],
  terrain: 'herbe',
  heroStart: [3, 4],
  startMessage: { texte: 'Steinbruck, ses quais et sa halle. (Reprenez la carte pour repartir.)' },
});

// Cité d'arrivée + INTERLUDE (Entre deux aventures) : marcher sur le cercle ouvre les Activités.
const construireCite = (): Scene => buildScene({
  id: 'test-voyage-cite',
  label: 'Altdorf, la capitale',
  desc: 'Arène de test.',
  size: [12, 8],
  terrain: 'herbe',
  heroStart: [3, 4],
  startMessage: { texte: 'Altdorf, au bout de la longue route. Marchez sur le cercle runique pour l’entre-deux-aventures (Activités).' },
  entities: [
    { id: 'cercle', kind: 'prop', decor: { id: 'cercle-runique' }, pos: { x: 6, y: 4 } },
  ],
  triggers: [
    {
      id: 'interlude',
      rect: { x: 5, y: 3, w: 3, h: 3 },
      once: true,
      flow: flowFromEffects([
        { type: 'giveMoney', montant: { gold: 30 } },
        { type: 'journal', desc: 'Au bout de la route, vous touchez votre dû — 30 couronnes pour cet entre-deux. Le reste s’évaporera.' },
        { type: 'interlude', weeks: 3 },
      ]),
    },
  ],
});

const construireEmbuscade = (): Scene => buildScene({
  id: 'test-voyage-embuscade',
  label: 'Sous-bois — embuscade',
  desc: 'Arène de test.',
  size: [14, 9],
  terrain: 'herbe',
  heroStart: [2, 4],
  encounters: [{
    id: 'enc-vembuscade',
    // embuscade de route : invisibles jusqu'au combat (hidden par ennemi, l'EncounterSpec n'a pas de hidden global)
    enemies: [
      { creature: { id: 'gobelin' }, pos: { x: 9, y: 3 }, hidden: true },
      { creature: { id: 'gobelin' }, pos: { x: 10, y: 5 }, hidden: true },
    ],
    surprise: 'groupe', // annulée si la Perception du voyage est réussie (« le groupe les voit venir »)
  }],
});

// ── Carte du monde : Weiler ↔ Federholz (piste dangereuse), Weiler ↔ Steinbruck (diligence), longue route ──
const construireCarte = (): WorldMap => ({
  id: 'test-voyage-carte',
  label: 'Marches de Weiler (test)',
  places: [
    { id: 'p-village', label: 'Weiler', pos: { x: 24, y: 62 }, scene: { id: 'test-voyage-village' }, icon: 'scenario/village',
      prose: 'Une rue de boue, un puits, une auberge dont l’enseigne grince. Weiler vit de ses champs et de ceux qui passent : la piste s’enfonce sous les arbres vers Federholz, la route descend vers le bourg de Steinbruck.' },
    { id: 'p-hameau', label: 'Federholz', pos: { x: 72, y: 30 }, scene: { id: 'test-voyage-hameau' }, icon: 'scenario/hameau',
      prose: 'Quelques toits de chaume serrés contre la lisière. Les bûcherons de Federholz regardent passer les étrangers sans hâte ; après la dernière clôture commence la longue route d’Altdorf.' },
    { id: 'p-bourg', label: 'Steinbruck', pos: { x: 70, y: 78 }, scene: { id: 'test-voyage-bourg' }, icon: 'scenario/port', services: [{ kind: { id: 'auberge' }, rest: { auberge: true } }, { kind: { id: 'forgeron' } }],
      prose: 'Un bourg de pierre grise au carrefour des routes, où les diligences changent de chevaux. L’auberge et la forge se font face sur la place, et l’on entend le marteau jusque dans la cour du relais.' },
    // id 'altdorf' (pas juste 'p-cite') : les Activités d'Altdorf (ACE Annexe I) gatées `where:['altdorf']`
    // (activities.json — Pénitence, Entraînement, Tester des objets…) lisent le `lieu` du groupe par son id.
    { id: 'altdorf', label: 'Altdorf', pos: { x: 90, y: 20 }, scene: { id: 'test-voyage-cite' }, icon: 'scenario/siege',
      prose: 'La capitale s’annonce par l’odeur de son fleuve bien avant ses murs. Passé la porte, la foule, les étals et les crieurs avalent le voyageur : ici tout s’achète, et tout se sait.' },
  ],
  routes: [
    {
      id: 'r-piste',
      a: { id: 'p-village' }, b: { id: 'p-hameau' },
      km: 24, // 1 jour plein à M4 (6 h/jour RAW) — nuit de camp garantie au-delà
      modes: ['pied'],
      perils: [{
        label: 'Des silhouettes vertes jaillissent des fourrés !',
        chancePct: 90,
        effects: [
          { type: 'transition', scene: { id: 'test-voyage-embuscade' } },
          { type: 'startCombat', encounter: 'enc-vembuscade' },
        ],
      }],
      ambush: { scene: { id: 'test-voyage-embuscade' }, encounter: 'enc-vembuscade' }, // cible du « Attaqués ! » (d10)
    },
    {
      id: 'r-grandroute',
      a: { id: 'p-village' }, b: { id: 'p-bourg' },
      km: 30,
      modes: ['pied', 'diligence'],
      perilDie: 0,
      provenances: { perilDie: { maison: 'grand-route sûre du scénario de test : aucun d10 de péripétie' } },
      inns: true, // relais de diligence : la halte de nuit propose l'auberge (modale de Repos)
    },
    {
      // LONG voyage (96 km à M4 = 4 jours / 3 nuits à pied) : récupération nocturne, rations qui fondent,
      // faim de Greta, postes d'Étapes répétés — relais d'auberges en chemin (ou belle étoile, au choix).
      id: 'r-longue',
      a: { id: 'p-hameau' }, b: { id: 'altdorf' },
      km: 96,
      modes: ['pied', 'diligence'],
      inns: true,
      ambush: { scene: { id: 'test-voyage-embuscade' }, encounter: 'enc-vembuscade' },
    },
  ],
});

export const scenario: TestScenario = {
  id: 'voyage',
  order: 6,
  category: 'survie',
  icon: 'scenario/voyage',
  title: 'Voyage & temps long',
  tests:
    'Carte du monde, voyage à pied/diligence, postes d’Étapes PERSISTANTS par héros (Plein air/Aguets/Cartes/' +
    'Fourrage, règle voyage-etapes activable), HALTES de nuit (modale de Repos), LONG voyage 96 km = 3 nuits, ' +
    'bilan de nuit COMPLET (récupération des blessés, faim RAW, Vérole de Greta + contagion, cauchemars, ' +
    'Exposition sous la pluie), péripéties + embuscade + reprise, et INTERLUDE d’Activités à l’arrivée (Revenus/' +
    'Artisanat/banque/Apprentissage, le temps passe) — la cité d’arrivée est le lieu `altdorf` de la carte : ' +
    'les Activités d’Altdorf (ACE Annexe I : Pénitence, Entraînement inhabituel, Tester des objets, Mécénat, ' +
    'Recherche universitaire), gatées `where`, y deviennent atteignables.',
  partyNote: 'Bjorn (plein air) · Mira (aguets) · Aldric (cartographe, 300 PX) · Greta (fourrage faible, blessée, Vérole, cauchemars)',
  construire: (idNeuf) => ({
    party: groupe(idNeuf),
    scene: construireVillage(),
    extraScenes: [construireHameau(), construireBourg(), construireCite(), construireEmbuscade()],
    worldMap: construireCarte(),
  }),
  rules: { 'voyage-etapes': true }, // mode Étapes EDOC pré-activé (coupable au panneau Règles maison)
  money: { gold: 6, silver: 10, brass: 0 },
};
