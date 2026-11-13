/**
 * Les héros des scénarios de test : huit fiches figées littérales, une par rôle (soldat, tueur, sorcier, prêtre,
 * chasseur, apothicaire, voleur, répurgateur). Aucune donnée de `pregens.json`, aucune graine ; ids et labels par rôle.
 * Rendus par `heroDeFiche`.
 */
import type { Combatant } from '../../engine/types';
import type { FabriqueDId } from '../../engine/fabriqueDId';
import type { FicheDeHeros } from '../../engine/heroDeFiche';
import { heroDeFiche } from '../../engine/heroDeFiche';
import type { IdDeHerosDuRoster } from '../../lib/idDeHerosDuRoster';

export const HEROS_DE_SCENARIO = {
  soldat: {
    speciesId: "humains-reiklander",
    parcours: { carrieres: { "soldat": 1 } },
    id: "soldat-de-test",
    label: "Soldat",
    initiales: { "capacite-de-combat": 30, "capacite-de-tir": 25, force: 35, endurance: 35, initiative: 32, agilite: 34, dexterite: 27, intelligence: 33, "force-mentale": 30, sociabilite: 23 },
    charAdvances: { "capacite-de-combat": 2, endurance: 2, "force-mentale": 1 },
    skills: [{ id: "athletisme", advances: 5 }, { id: "calme", advances: 10 }, { id: "corps-a-corps", spec: "base", advances: 8 }, { id: "escalade", advances: 5 }, { id: "esquive", advances: 5 }, { id: "langue", spec: "bataille", advances: 5 }, { id: "musicien", spec: "tambour", advances: 5 }, { id: "resistance", advances: 5 }, { id: "charme", advances: 5 }, { id: "commandement", advances: 5 }, { id: "evaluation", advances: 3 }, { id: "langue", spec: "bretonnien", advances: 3 }],
    talents: [{ id: "perspicace", times: 1 }, { id: "destinee", times: 1 }, { id: "fuite", times: 1 }, { id: "vision-nocturne", times: 1 }, { id: "imitation", times: 1 }, { id: "guerrier-ne", times: 1 }],
    trappings: [{ id: "vetements", qte: 1 }, { id: "arme-simple", qte: 1 }, { id: "dague", qte: 2 }, { id: "bourse", qte: 1 }, { id: "plastron-de-cuir", qte: 1 }, { id: "uniforme", qte: 1 }],
    spells: [],
    fate: 4,
    resilience: 2,
    xp: 0,
    motivation: "Devoir",
    apparence: { sex: "M" },
  },
  tueur: {
    speciesId: "nains",
    parcours: { carrieres: { "tueur": 1 } },
    id: "tueur-de-test",
    label: "Tueur",
    initiales: { "capacite-de-combat": 45, "capacite-de-tir": 29, force: 35, endurance: 45, initiative: 27, agilite: 17, dexterite: 41, intelligence: 33, "force-mentale": 49, sociabilite: 19 },
    charAdvances: { "capacite-de-combat": 2, force: 2, "force-mentale": 1 },
    skills: [{ id: "calme", advances: 10 }, { id: "corps-a-corps", spec: "base", advances: 10 }, { id: "esquive", advances: 5 }, { id: "guerison", advances: 5 }, { id: "pari", advances: 5 }, { id: "resistance", advances: 5 }, { id: "resistance-a-l-alcool", advances: 5 }, { id: "savoir", spec: "trolls", advances: 5 }, { id: "divertissement", spec: "narration", advances: 5 }, { id: "evaluation", advances: 3 }, { id: "intimidation", advances: 3 }, { id: "langue", spec: "khazalid", advances: 3 }],
    talents: [{ id: "costaud", times: 1 }, { id: "determine", times: 1 }, { id: "lire-ecrire", times: 1 }, { id: "resistance-a-la-magie", times: 1 }, { id: "vision-nocturne", times: 1 }, { id: "frenesie", times: 1 }],
    trappings: [{ id: "vetements", qte: 1 }, { id: "arme-simple", qte: 1 }, { id: "dague", qte: 1 }, { id: "bourse", qte: 1 }, { id: "arme-simple", spec: "Hache", qte: 1 }, { id: "flasque", spec: "Alcool", qte: 1 }, { id: "tatouage", qte: 1 }],
    spells: [],
    fate: 1,
    resilience: 3,
    xp: 0,
    motivation: "Honte (Malédiction du Tueur)",
    apparence: { sex: "M" },
  },
  sorcier: {
    speciesId: "humains-reiklander",
    parcours: { carrieres: { "sorcier": 1 } },
    id: "sorcier-de-test",
    label: "Sorcier",
    initiales: { "capacite-de-combat": 31, "capacite-de-tir": 30, force: 26, endurance: 23, initiative: 32, agilite: 34, dexterite: 32, intelligence: 34, "force-mentale": 31, sociabilite: 29 },
    charAdvances: { "capacite-de-combat": 2, intelligence: 2, "force-mentale": 1 },
    skills: [{ id: "corps-a-corps", spec: "armes-d-hast", advances: 5 }, { id: "corps-a-corps", spec: "base", advances: 8 }, { id: "esquive", advances: 5 }, { id: "focalisation", spec: "feu", advances: 5 }, { id: "intuition", advances: 5 }, { id: "langue", spec: "magick", advances: 5 }, { id: "perception", advances: 5 }, { id: "savoir", spec: "magie", advances: 5 }, { id: "metier", spec: "alchimiste", advances: 0 }, { id: "calme", advances: 5 }, { id: "charme", advances: 5 }, { id: "commandement", advances: 5 }, { id: "evaluation", advances: 3 }, { id: "langue", spec: "bretonnien", advances: 3 }],
    talents: [{ id: "perspicace", times: 1 }, { id: "destinee", times: 1 }, { id: "maitre-artisan", spec: "alchimiste", times: 1 }, { id: "imitation", times: 1 }, { id: "linguistique", times: 1 }, { id: "magie-mineure", times: 1 }],
    trappings: [{ id: "vetements", qte: 1 }, { id: "dague", qte: 1 }, { id: "bourse", qte: 1 }, { id: "besace", qte: 1 }, { id: "necessaire-d-ecriture", qte: 1 }, { id: "parchemin", qte: 7 }, { id: "grimoire", qte: 1 }, { id: "baton-de-combat", qte: 1 }],
    spells: ["flechette", "choc", "alerte"],
    fate: 4,
    resilience: 2,
    xp: 0,
    motivation: "Connaissance",
    apparence: { sex: "F" },
  },
  pretre: {
    speciesId: "humains-reiklander",
    parcours: { carrieres: { "pretre": 1 } },
    id: "pretre-de-test",
    label: "Prêtre",
    initiales: { "capacite-de-combat": 38, "capacite-de-tir": 27, force: 38, endurance: 39, initiative: 22, agilite: 31, dexterite: 27, intelligence: 35, "force-mentale": 30, sociabilite: 30 },
    charAdvances: { endurance: 2, agilite: 2, "force-mentale": 1 },
    skills: [{ id: "athletisme", advances: 5 }, { id: "calme", advances: 10 }, { id: "intuition", advances: 5 }, { id: "perception", advances: 5 }, { id: "priere", advances: 5 }, { id: "recherche", advances: 5 }, { id: "resistance", advances: 5 }, { id: "savoir", spec: "theologie", advances: 5 }, { id: "charme", advances: 5 }, { id: "commandement", advances: 5 }, { id: "corps-a-corps", spec: "base", advances: 3 }, { id: "evaluation", advances: 3 }, { id: "langue", spec: "bretonnien", advances: 3 }],
    talents: [{ id: "perspicace", times: 1 }, { id: "destinee", times: 1 }, { id: "guerrier-ne", times: 1 }, { id: "tres-fort", times: 1 }, { id: "lire-ecrire", times: 1 }, { id: "beni", spec: "sigmar", times: 1 }],
    trappings: [{ id: "vetements", qte: 1 }, { id: "dague", qte: 1 }, { id: "bourse", qte: 1 }, { id: "besace", qte: 1 }, { id: "necessaire-d-ecriture", qte: 1 }, { id: "parchemin", qte: 9 }, { id: "symbole-religieux", qte: 1 }, { id: "robes", qte: 1 }],
    spells: ["benediction-de-bataille", "benediction-de-courage", "benediction-de-droiture", "benediction-de-puissance", "benediction-de-protection", "benediction-de-vigueur"],
    fate: 4,
    resilience: 2,
    xp: 0,
    motivation: "Foi",
    apparence: { sex: "M" },
  },
  chasseur: {
    speciesId: "elfes-sylvains",
    parcours: { carrieres: { "chasseur": 1 } },
    id: "chasseur-de-test",
    label: "Chasseur",
    initiales: { "capacite-de-combat": 49, "capacite-de-tir": 42, force: 24, endurance: 34, initiative: 50, agilite: 44, dexterite: 41, intelligence: 44, "force-mentale": 42, sociabilite: 30 },
    charAdvances: { force: 2, endurance: 2, dexterite: 1 },
    skills: [{ id: "emprise-sur-les-animaux", advances: 5 }, { id: "escalade", advances: 8 }, { id: "perception", advances: 5 }, { id: "piegeage", advances: 5 }, { id: "projectiles", spec: "fronde", advances: 5 }, { id: "resistance", advances: 5 }, { id: "savoir", spec: "betes-sauvages", advances: 5 }, { id: "survie-en-exterieur", advances: 5 }, { id: "athletisme", advances: 5 }, { id: "corps-a-corps", spec: "base", advances: 5 }, { id: "discretion", spec: "rurale", advances: 5 }, { id: "divertissement", spec: "chant", advances: 3 }, { id: "intimidation", advances: 3 }],
    talents: [{ id: "dur-a-cuire", times: 1 }, { id: "lire-ecrire", times: 1 }, { id: "nomade", times: 1 }, { id: "sens-aiguise", spec: "vue", times: 1 }, { id: "vision-nocturne", times: 1 }, { id: "bon-marcheur", spec: "littoral", times: 1 }],
    trappings: [{ id: "cape", qte: 1 }, { id: "vetements", qte: 1 }, { id: "dague", qte: 1 }, { id: "bourse", qte: 1 }, { id: "besace", qte: 1 }, { id: "ration", qte: 1 }, { id: "arme-simple", qte: 1 }, { id: "bottes", qte: 1 }, { id: "fronde", qte: 1 }, { id: "projectile-de-pierre", qte: 10 }],
    spells: [],
    fate: 1,
    resilience: 1,
    xp: 0,
    motivation: "Nature",
    apparence: { sex: "M" },
  },
  apothicaire: {
    speciesId: "humains-reiklander",
    parcours: { carrieres: { "apothicaire": 1 } },
    id: "apothicaire-de-test",
    label: "Apothicaire",
    initiales: { "capacite-de-combat": 35, "capacite-de-tir": 29, force: 33, endurance: 28, initiative: 28, agilite: 36, dexterite: 31, intelligence: 36, "force-mentale": 25, sociabilite: 32 },
    charAdvances: { endurance: 2, dexterite: 2, intelligence: 1 },
    skills: [{ id: "guerison", advances: 5 }, { id: "langue", spec: "classique", advances: 5 }, { id: "metier", spec: "apothicaire", advances: 5 }, { id: "metier", spec: "empoisonneur", advances: 5 }, { id: "resistance-a-l-alcool", advances: 5 }, { id: "savoir", spec: "chimie", advances: 5 }, { id: "savoir", spec: "remedes", advances: 5 }, { id: "savoir", spec: "plantes", advances: 5 }, { id: "calme", advances: 5 }, { id: "charme", advances: 5 }, { id: "commandement", advances: 5 }, { id: "corps-a-corps", spec: "base", advances: 3 }, { id: "evaluation", advances: 3 }, { id: "langue", spec: "bretonnien", advances: 3 }],
    talents: [{ id: "perspicace", times: 1 }, { id: "destinee", times: 1 }, { id: "resistance", spec: "chaos", times: 1 }, { id: "guerrier-ne", times: 1 }, { id: "reflexes-foudroyants", times: 1 }, { id: "concocter", times: 1 }],
    trappings: [{ id: "vetements", qte: 1 }, { id: "dague", qte: 1 }, { id: "bourse", qte: 1 }, { id: "besace", qte: 1 }, { id: "necessaire-d-ecriture", qte: 1 }, { id: "parchemin", qte: 8 }, { id: "potion-de-guerison", qte: 1 }, { id: "justaucorps-de-cuir", qte: 1 }, { id: "pilon-et-mortier", qte: 1 }],
    spells: [],
    fate: 4,
    resilience: 2,
    xp: 0,
    motivation: "Connaissance",
    apparence: { sex: "F" },
  },
  voleur: {
    speciesId: "halflings",
    parcours: { carrieres: { "voleur": 1 } },
    id: "voleur-de-test",
    label: "Voleur",
    initiales: { "capacite-de-combat": 24, "capacite-de-tir": 47, force: 25, endurance: 30, initiative: 31, agilite: 37, dexterite: 34, intelligence: 35, "force-mentale": 46, sociabilite: 40 },
    charAdvances: { initiative: 2, agilite: 2, "force-mentale": 1 },
    skills: [{ id: "athletisme", advances: 5 }, { id: "calme", advances: 5 }, { id: "discretion", spec: "urbaine", advances: 5 }, { id: "escalade", advances: 5 }, { id: "esquive", advances: 8 }, { id: "intuition", advances: 8 }, { id: "perception", advances: 5 }, { id: "resistance", advances: 5 }, { id: "charme", advances: 5 }, { id: "discretion", spec: "rurale", advances: 5 }, { id: "escamotage", advances: 5 }, { id: "langue", spec: "halfling", advances: 3 }],
    talents: [{ id: "petit", times: 1 }, { id: "resistance", spec: "corruption", times: 1 }, { id: "sens-aiguise", spec: "gout", times: 1 }, { id: "vision-nocturne", times: 1 }, { id: "chanceux", times: 1 }, { id: "costaud", times: 1 }, { id: "chat-de-gouttiere", times: 1 }],
    trappings: [{ id: "vetements", qte: 1 }, { id: "dague", qte: 1 }, { id: "bourse", qte: 1 }, { id: "besace", qte: 1 }, { id: "bougie", qte: 2 }, { id: "pied-de-biche", qte: 1 }, { id: "veste-de-cuir", qte: 1 }, { id: "sac", qte: 1 }],
    spells: [],
    fate: 2,
    resilience: 3,
    xp: 0,
    motivation: "Curiosité",
    apparence: { sex: "M" },
  },
  repurgateur: {
    speciesId: "humains-reiklander",
    parcours: { carrieres: { "repurgateur": 1 } },
    id: "repurgateur-de-test",
    label: "Répurgateur",
    initiales: { "capacite-de-combat": 23, "capacite-de-tir": 29, force: 30, endurance: 24, initiative: 37, agilite: 30, dexterite: 35, intelligence: 35, "force-mentale": 30, sociabilite: 32 },
    charAdvances: { "capacite-de-combat": 2, endurance: 2, "force-mentale": 1 },
    skills: [{ id: "charme", advances: 10 }, { id: "corps-a-corps", spec: "bagarre", advances: 5 }, { id: "guerison", advances: 5 }, { id: "intimidation", advances: 5 }, { id: "intuition", advances: 5 }, { id: "perception", advances: 5 }, { id: "resistance-a-l-alcool", advances: 5 }, { id: "savoir", spec: "torture", advances: 5 }, { id: "calme", advances: 5 }, { id: "commandement", advances: 5 }, { id: "corps-a-corps", spec: "base", advances: 3 }, { id: "evaluation", advances: 3 }, { id: "langue", spec: "bretonnien", advances: 3 }],
    talents: [{ id: "perspicace", times: 1 }, { id: "destinee", times: 1 }, { id: "doue-en-calcul", times: 1 }, { id: "resistance", spec: "chaos", times: 1 }, { id: "sens-de-l-orientation", times: 1 }, { id: "determine", times: 1 }],
    trappings: [{ id: "cape", qte: 1 }, { id: "vetements", qte: 1 }, { id: "dague", qte: 1 }, { id: "bourse", qte: 1 }, { id: "sac-a-dos", qte: 1 }, { id: "boite-a-amadou", qte: 1 }, { id: "couverture", qte: 1 }, { id: "ration", qte: 1 }, { id: "arme-simple", qte: 1 }],
    spells: [],
    fate: 4,
    resilience: 2,
    xp: 0,
    motivation: "Foi",
    apparence: { sex: "M" },
  },
} satisfies Record<string, FicheDeHeros>;

export type RoleDeScenario = keyof typeof HEROS_DE_SCENARIO;

const ORDRE = ['soldat', 'tueur', 'sorcier', 'pretre', 'chasseur', 'apothicaire', 'voleur', 'repurgateur'] as const satisfies readonly RoleDeScenario[];

/** L'id STABLE du héros de scénario `role`. */
export const idDuHerosDeScenario = (role: RoleDeScenario): IdDeHerosDuRoster => HEROS_DE_SCENARIO[role].id as IdDeHerosDuRoster;

/** Le héros de scénario `role`, copie fraîche. */
export const herosDeScenario = (idNeuf: FabriqueDId, role: RoleDeScenario): Combatant => heroDeFiche(HEROS_DE_SCENARIO[role], idNeuf);

/** Les héros de scénario `roles`, dans l'ordre des arguments. */
export const groupeDeScenario = (idNeuf: FabriqueDId, ...roles: RoleDeScenario[]): Combatant[] => roles.map((r) => herosDeScenario(idNeuf, r));

/** Les huit héros de scénario. */
export const tousLesHerosDeScenario = (idNeuf: FabriqueDId): Combatant[] => groupeDeScenario(idNeuf, ...ORDRE);

/** Soldat, Tueur, Sorcier, Chasseur. */
export const groupeVitrineDeScenario = (idNeuf: FabriqueDId): Combatant[] => groupeDeScenario(idNeuf, 'soldat', 'tueur', 'sorcier', 'chasseur');
