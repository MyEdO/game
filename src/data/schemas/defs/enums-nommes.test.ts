/**
 * #1694 train B1 — CONTRAT POSITIF des enums de def NOMMÉS : chaque vocabulaire migré rend, depuis son
 * NŒUD, la totalité de ses options ET le libellé FR attendu pour chacune. La table du nœud est la SEULE
 * (`grammaire/records-de-libelles.test.ts` refuse tout Record UI qui la doublerait), et le site
 * d'affichage ne fait que la lire (`libelleDeValeur`).
 *
 * L'ordre compte : les options SONT les clés de la table, donc l'ordre du `select` de l'atelier et
 * celui des sous-titres du Codex se lisent ici.
 */
import { describe, it, expect } from 'vitest';
import { valeursDe, libelleDeValeur } from '../grammaire/meta';
import {
  outcomeOnSchema,
  battleCondSchema,
  battleOutcomeTargetSchema,
  battleOutcomeScaleSchema,
  battleSideSchema,
  sceneKindSchema,
} from './activities';
import { phenomenonKindSchema, phenomenonTestSchema, saturationTierSchema } from './arcane-phenomena';
import { drivingMishapOutcomeSchema } from './driving-mishap';
import { drunkennessOutcomeSchema } from './drunkenness';
import { progressionModeSchema } from './naval-progression';
import { missileBypassSchema } from './domains';
import { waterAppliesToSchema, waterTableSchema } from './water-exposure';
import { rigSchema, posteSideSchema } from './vehicles';
import { attackKindSchema } from './maneuvers';
import { trappingCategorieSchema } from './trappings';
import { critTableSchema } from './criticals';
import { favorLevelSchema } from '../defs-scenes/effets';
import { entityKindSchema, roofProfileSchema, sceneWeatherSchema } from '../defs-scenes/scene';
import { windDirectionSchema } from '../defs-scenes/worldmap';
import {
  availabilitySchema, classeDeCouvertSchema, genreDeBlessureSchema, genreDeTraumaSchema, harvestRaritySchema,
  natureDePossessionSchema, natureDonnableSchema, settlementSchema, statusTierSchema,
} from '../grammaire/valeurs';
import { dispoPctAvailabilitySchema } from './disponibilite';
import { AVAILABILITIES, TESTED_AVAILABILITIES } from '../../../engine/types';

/** Paliers dont le libellé EST l'id (Disponibilité, LDB 11 ; rareté de récolte, ZI 13 l.286) : le tuple canon les donne. */
const nommesParEuxMemes = (paliers: readonly string[]): Record<string, string> =>
  Object.fromEntries(paliers.map((palier) => [palier, palier]));

/** Un vocabulaire migré : son nœud, et la table FR ATTENDUE — dans l'ordre de ses options. */
const MIGRES: readonly [string, unknown, Record<string, string>][] = [
  ['activities.outcomes[].on', outcomeOnSchema, { success: 'Succès', failure: 'Échec', fumble: 'Maladresse' }],
  ['activities.outcomes[].when', battleCondSchema, {
    generalDown: 'Général ennemi tombé', intervention: 'Un autre PJ a frappé',
    noIntervention: 'Aucune intervention', combatWon: 'Combat gagné', combatLost: 'Combat perdu',
  }],
  ['activities.outcomes[].battle[].target', battleOutcomeTargetSchema, {
    might: 'Puissance courante', startMight: 'Puissance de départ',
    allyTestMod: 'Mod. Tests alliés (permanent)', firstRoundBonus: 'Bonus au 1er Round',
    planningBonus: 'Bonus au prochain Test de Planification',
  }],
  ['activities.outcomes[].battle[].scale', battleOutcomeScaleSchema, {
    fixed: 'Plat', perDR: '× DR', perHit: '× touches', perKill: '× ennemis tués',
  }],
  ['activities.outcomes[].battle[].side', battleSideSchema, { ally: 'Armée alliée', enemy: 'Armée ennemie' }],
  ['activities.sceneKind', sceneKindSchema, {
    test: 'Test', combat: 'Combat', threat: 'Menace', hold: 'Tenue', rally: 'Rassemblement',
  }],
  ['arcane-phenomena.phenomena[].kind', phenomenonKindSchema, {
    'ligne-de-force': 'Ligne de force', 'pierre-gardienne': 'Pierre gardienne', vortex: 'Vortex',
    nexus: 'Jonction tellurique', 'appui-arcanique': 'Appui arcanique', tempete: 'Tempête de magie',
    corruption: 'Corruption', site: 'Site',
  }],
  ['arcane-phenomena.testMods[].tests[]', phenomenonTestSchema, {
    incantation: 'Incantation', focalisation: 'Focalisation', dissipation: 'Dissipation',
  }],
  ['arcane-phenomena.windSaturationEffects[].effects[].tier', saturationTierSchema, {
    premier: 'Premier signe', courant: 'Signe courant', extreme: 'Signe extrême',
  }],
  ['driving-mishap.outcome', drivingMishapOutcomeSchema, {
    harness: 'Harnais cassé', jolt: 'Cahots de la route', wheel: 'Roue brisée', crash: 'Essieu cassé (Accidenté)',
  }],
  ['drunkenness.outcome', drunkennessOutcomeSchema, {
    bravoure: 'Bravoure du Marienburgher', ami: 'Meilleur ami', staggering: 'La pièce tourne',
    belligerent: 'Tous, un par un', blackout: 'Trou noir (gueule de bois)',
  }],
  ['naval-progression.mode', progressionModeSchema, {
    plus2: 'Progression maximale (M+2)', plus1: 'Bonne progression (M+1)', normal: 'Progression normale (M)',
    minus1: 'Progression lente (M−1)', half: 'Lutte pour avancer (M÷2)',
  }],
  ['domains.missile.bypass', missileBypassSchema, { metal: 'PA métalliques', nonMagic: 'PA non magiques' }],
  ['water-exposure.modifiers[].table', waterTableSchema, {
    'source-d-eau': 'Source d’eau', 'blessures-et-etats': 'Blessures et États',
  }],
  ['water-exposure.modifiers[].appliesTo[]', waterAppliesToSchema, {
    ingestion: 'Ingestion', immersion: 'Immersion',
  }],
  ['rigDuNavire (gréement dérivé)', rigSchema, { avirons: 'Avirons', voile: 'Voile', mixte: 'Mixte (voile et avirons)' }],
  ['vehicles.deck.postes[].side', posteSideSchema, {
    proue: 'Proue', tribord: 'Tribord', poupe: 'Poupe', babord: 'Bâbord',
  }],
  ['maneuvers.kind', attackKindSchema, {
    arme: 'Arme / griffes', morsure: 'Morsure', caudale: 'Attaque caudale', cornes: 'Cornes',
    souffle: 'Souffle', vomi: 'Vomissement', tentacules: 'Tentacules', etreinte: 'Étreinte',
    regard: 'Regard pétrifiant', langue: 'Langue préhensile', hurlement: 'Hurlement', pietinement: 'Piétinement',
  }],
  ['trappings.categorie', trappingCategorieSchema, {
    melee: 'Armes de mêlée', ranged: 'Armes à distance', ammunition: 'Munitions',
    armor: 'Armures', trapping: 'Équipement',
  }],
  ['criticals.localisation', critTableSchema, {
    tete: 'Tête', bras: 'Bras', corps: 'Corps', jambe: 'Jambe',
  }],
  ['effets.favor.level', favorLevelSchema, {
    mineure: 'Faveur Mineure', majeure: 'Faveur Majeure', importante: 'Faveur Importante',
  }],
  ['scene.entities[].kind', entityKindSchema, {
    heroStart: 'Départ héros', personnage: 'Personnage', prop: 'Décor',
  }],
  ['scene.architecture[].masses[].profile', roofProfileSchema, {
    hip: 'Croupe (hip) — 4 pans', gable: 'Pignon (gable) — 2 pans + faîte',
    shed: 'Appentis (shed) — 1 pan', flat: 'Terrasse (flat) — plat',
  }],
  ['scene.weather', sceneWeatherSchema, {
    clair: 'Ciel clair', pluie: 'Pluie', brouillard: 'Brouillard', neige: 'Haute épaisseur de neige', tempete: 'Tempête',
  }],
  ['worldmap.routes[].windFrom (WindDirection)', windDirectionSchema, {
    nord: 'Nord', sud: 'Sud', est: 'Est', ouest: 'Ouest',
  }],
  ['Availability (disponibilite, creatures, vehicles, trappings)', availabilitySchema, nommesParEuxMemes(AVAILABILITIES)],
  ['HarvestRarity (creatures[].harvest)', harvestRaritySchema, nommesParEuxMemes([...AVAILABILITIES, 'Unique'])],
  ['disponibilite.pct (TestedAvailability)', dispoPctAvailabilitySchema, nommesParEuxMemes(TESTED_AVAILABILITIES)],
  ['Settlement (merchants.settlement, scene.settlement)', settlementSchema, { village: 'Village', ville: 'Ville', cite: 'Cité' }],
  ['DeckCoverClass (props, vehicles, naval-traits)', classeDeCouvertSchema, {
    imparfaite: 'Couverture imparfaite', moyenne: 'Couverture moyenne', totale: 'Couverture totale',
  }],
  ['effets.inflictTrauma.kind', genreDeBlessureSchema, { dechirure: 'Déchirure', fracture: 'Fracture', amputation: 'Amputation' }],
  ['traumas.kind (TraumaKind)', genreDeTraumaSchema, { dechirure: 'Déchirure', fracture: 'Fracture' }],
  ['Possession.nature', natureDePossessionSchema, {
    bete: 'Bête', serviteur: 'Serviteur', vehicule: 'Véhicule', navire: 'Navire', immeuble: 'Immeuble',
  }],
  ['effets.givePossession.nature', natureDonnableSchema, { bete: 'Bête', serviteur: 'Serviteur', vehicule: 'Véhicule' }],
  ['Status.tier', statusTierSchema, { Bronze: 'Bronze', Argent: 'Argent', Or: 'Or' }],
];

describe('enums de def NOMMÉS (#1694 B1) — le libellé de chaque VALEUR vit sur son nœud', () => {
  for (const [chemin, noeud, attendu] of MIGRES) {
    it(`${chemin} : toutes ses options portent leur libellé FR`, () => {
      const valeurs = valeursDe(noeud);
      expect(valeurs, `${chemin} n’est pas un enum NOMMÉ`).toBeDefined();
      expect(Object.keys(valeurs!)).toEqual(Object.keys(attendu));
      expect(valeurs).toEqual(attendu);
      for (const [v, l] of Object.entries(attendu)) expect(libelleDeValeur(noeud, v)).toBe(l);
    });
  }

  it('les options d’un enum nommé SONT les clés de sa table — aucun libellé orphelin', () => {
    for (const [chemin, noeud] of MIGRES) {
      const options = (noeud as { options: string[] }).options;
      expect(options, chemin).toEqual(Object.keys(valeursDe(noeud)!));
    }
  });

  it('une valeur HORS de l’univers se rend BRUTE, jamais vide', () => {
    expect(libelleDeValeur(attackKindSchema, 'hors-univers')).toBe('hors-univers');
  });
});
