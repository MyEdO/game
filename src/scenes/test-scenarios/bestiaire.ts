import type { FabriqueDId } from '../../engine/fabriqueDId';
import { groupeVitrineDeScenario } from './_heros';
import { mutationAt } from '../../data/mutations';
import { battleRng } from '../../noyau/battleRng';
import { attachMutation } from '../../engine/corruption';
import { recomputeLoadout } from '../../engine/items';
import { makePriest } from './_casters';
import type { Combatant } from '../../engine/types';
import { buildScene } from '../../noyau/mapSpec';
import type { TestScenario } from './_shared';
import type { Scene } from '../../noyau/monde/scene';

/**
 * « Bestiaire, traits & états » : une ménagerie qui réunit les anciens tests Traits de créature,
 * Créatures personnalisées, États & contrôle et Visuels de mutation. Le groupe = les 4 pré-tirés MUTÉS
 * (vitrine des 19 mutations physiques) + une Prêtresse de Shallya (purge/soin pour le volet
 * États). Le bestiaire couvre traits (Éthéré/Démoniaque/Régénération/Toile…), infligeurs d'états
 * (Toile→Empêtré, regard pétrifiant, débuffs), une Énorme (Piétinement) et des statblocs d'auteur.
 */

// Les 19 mutations physiques (LDB 19) attachées en dur aux 4 pré-tirés (jets forcés → donnée verbatim).
const LOTS: number[][] = [
  [83, 23, 63, 38, 3], // Cornes asymétriques, Œil énorme, Langue pendante, Tentacule épais, Pattes d'animaux
  [93, 68, 78, 8], // Groin poilu, Plumes éparses, Écailles épineuses, Corpulent
  [53, 58, 13, 73], // Visage inversé, Peau d'acier, Doigts distendus, Court sur pattes
  [48, 33, 43, 88, 28, 18], // Beauté surnaturelle, Bouche supplémentaire, Peau brillante, Suintement de pus, Articulation, Émacié
];

function mutate(c: Combatant, rolls: number[]): Combatant {
  for (const r of rolls) attachMutation(c, mutationAt('physique', r), battleRng());
  recomputeLoadout(c); // PA naturels (Peau d'acier, Écailles…)
  return c;
}

function groupe(idNeuf: FabriqueDId): Combatant[] {
  const heroes = groupeVitrineDeScenario(idNeuf).map((c, i) => mutate(c, LOTS[i] ?? [])); // 4 héros mutés
  const shallya = makePriest(idNeuf, 'h-shallya', 'Sœur Greta, Prêtresse de Shallya', 'shallya', { sociabilite: 66, 'force-mentale': 60, force: 40, endurance: 44 });
  return [...heroes, shallya];
}

const construireScene = (): Scene => buildScene({
  id: 'test-bestiaire',
  label: 'Bestiaire, traits & états',
  desc: 'Arène de test.',
  size: [26, 20],
  heroStart: [3, 10],
  startMessage:
    { texte: 'Grande ménagerie. Le groupe porte à lui seul les 19 mutations physiques (vérifiez les calques/morpho sur ' +
    'les pions et les portraits du HUD) ; Sœur Greta de Shallya peut purger les états. Le Fantôme est Éthéré ' +
    '(frappez-le avec un sort !) et Instable ; la Démonette sauvegarde (Démoniaque), riposte (Champion), perturbe ' +
    '(−20 à 4 m) et expose à la Corruption en fin de combat ; le Troll régénère (Stupide) ; l’Araignée emmaillote ' +
    '(Toile→Empêtré, Venin) ; la Cockatrice pétrifie du regard (Redoutable) ; le Griffon est Énorme (Piétinement) ; ' +
    'la Pieuvre frappe de ses 8 tentacules (gratuites, Empêtré) ; le Sorcier mutant lance Fléchette ; le Squelette ' +
    'est un facultatif « Élite » aux Caractéristiques aléatoires ; Babrakkos lance ses sorts et cause Terreur 3.' },
  encounters: [
    {
      id: 'enc-bestiaire',
      enemies: [
        // Traits de créature (LDB 85).
        { creature: { id: 'fantome' }, pos: { x: 14, y: 4 } }, // Éthéré + Instable + Peur
        { creature: { id: 'demonette-de-slaanesh' }, pos: { x: 16, y: 7 } }, // Démoniaque/Champion/Perturbant/Corruption
        { creature: { id: 'troll' }, pos: { x: 15, y: 12 } }, // Régénération/Stupide/Infecté
        // Infligeurs d'états + Énorme.
        { creature: { id: 'araignee-geante' }, pos: { x: 18, y: 15 } }, // Toile→Empêtré, Bestial, Venin
        { creature: { id: 'cockatrice' }, pos: { x: 20, y: 5 } }, // regard pétrifiant + Redoutable
        { creature: { id: 'griffon' }, pos: { x: 22, y: 10 } }, // Énorme → Piétinement (l'arène 26×20 lui laisse la place)
        { creature: { id: 'babrakkos' }, pos: { x: 24, y: 12 } }, // 6 sorts + Terreur
        // Statblocs d'auteur (LDB 76/78/85).
        { creature: { id: 'pieuvre-des-tourbieres' }, pos: { x: 18, y: 18 } }, // « 8 Tentacules +9 » gratuites, Empêtré
        {
          statblock: { type: 'statblock',
            label: 'Sorcier mutant',
            char: { M: 4, 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 40, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 45, sociabilite: 30 },
            traits: [{ id: 'arme', value: 4, arg: 'dague' }, { id: 'lanceur-de-sorts', arg: 'sorcellerie' }, { id: 'corruption', arg: 'mineure' }],
            spells: ['flechette'], // id de sort (CustomStatblock.spells = string[] d'ids)
          },
          appearance: { species: 'humains-reiklander' },
          pos: { x: 23, y: 6 },
        },
        { creature: { id: 'squelette' }, pos: { x: 20, y: 15 }, optionals: [{ id: 'elite' }], randomChars: true }, // facultatif Élite + caracs aléatoires
        { creature: { id: 'mutant' }, pos: { x: 16, y: 17 } }, // Mutant ennemi → visuels de mutation tirés au hasard du même registre
      ],
    },
  ],
});

export const scenario: TestScenario = {
  id: 'bestiaire',
  order: 5,
  category: 'creatures',
  icon: 'scenario/bestiaire',
  title: 'Bestiaire, traits & états',
  tests:
    'Ménagerie : traits (Éthéré/Instable, Démoniaque/Champion/Perturbant, Régénération/Stupide, Toile/Bestial/Venin, ' +
    'Corruption), états des deux camps + purge Shallya (Empêtré, regard pétrifiant, débuffs), Énorme/Piétinement ' +
    '(Griffon), statblocs d’auteur (Pieuvre 8-tentacules, Sorcier mutant lanceur, Squelette facultatif Élite + ' +
    'Caractéristiques aléatoires), 19 mutations physiques sur les héros (calques/morpho/portraits), Psychologie.',
  partyNote: '4 pré-tirés MUTÉS (19 mutations) + Sœur Greta, Prêtresse de Shallya (purge)',
  construire: (idNeuf) => ({ party: groupe(idNeuf), scene: construireScene() }),
  autoCombat: 'enc-bestiaire',
};
