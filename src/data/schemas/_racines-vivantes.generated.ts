// GÉNÉRÉ par scripts/gen-espaces.mts (phase 2 de `npm run gen`) — NE PAS ÉDITER À LA MAIN.
// Régénérer : `npm run gen` (un import par document de l'image de `DATASET_FICHIER_DERIVE`).
import r0 from '../activities.json';
import r1 from '../advancementCosts.json';
import r2 from '../arcane-phenomena.json';
import r3 from '../artillery-misfire.json';
import r4 from '../astrology.json';
import r5 from '../axes.json';
import r6 from '../books.json';
import r7 from '../breath-types.json';
import r8 from '../buildings.json';
import r9 from '../calendarIntercalary.json';
import r10 from '../calendarMonths.json';
import r11 from '../calendarPhases.json';
import r12 from '../calendarWeekdays.json';
import r13 from '../careerLevels.json';
import r14 from '../careers.json';
import r15 from '../characteristics.json';
import r16 from '../classes.json';
import r17 from '../combat-stakes.json';
import r18 from '../creatures.json';
import r19 from '../crew-morale.json';
import r20 from '../crew-roles.json';
import r21 from '../crew-test-types.json';
import r22 from '../criticals.json';
import r23 from '../damage-types.json';
import r24 from '../defauts-de-compilation.json';
import r25 from '../details.json';
import r26 from '../disponibilite.json';
import r27 from '../domains.json';
import r28 from '../driving-mishap.json';
import r29 from '../drunkenness.json';
import r30 from '../encumbranceTiers.json';
import r31 from '../etats.json';
import r32 from '../eyes.json';
import r33 from '../flow-stakes.json';
import r34 from '../gods.json';
import r35 from '../grapple.json';
import r36 from '../groups.json';
import r37 from '../hairs.json';
import r38 from '../incidents-monture.json';
import r39 from '../interludeEvents.json';
import r40 from '../land-cargo.json';
import r41 from '../lightLevels.json';
import r42 from '../lightTones.json';
import r43 from '../locations.json';
import r44 from '../maladies.json';
import r45 from '../maneuvers.json';
import r46 from '../mass-battle.json';
import r47 from '../materials.json';
import r48 from '../miscast.json';
import r49 from '../montures.json';
import r50 from '../mutationTables.json';
import r51 from '../mutations.json';
import r52 from '../names.json';
import r53 from '../naval-ports.json';
import r54 from '../naval-progression.json';
import r55 from '../naval-traits.json';
import r56 from '../night-stakes.json';
import r57 from '../obsessions.json';
import r58 from '../oups.json';
import r59 from '../peripeties.json';
import r60 from '../pregens.json';
import r61 from '../problemes-vehicule.json';
import r62 from '../props.json';
import r63 from '../psychology.json';
import r64 from '../qualities.json';
import r65 from '../qualitySubtypes.json';
import r66 from '../qualityTypes.json';
import r67 from '../raceAppearance.json';
import r68 from '../reglesOptionnelles.json';
import r69 from '../rencontres-edoc.json';
import r70 from '../river-criticals.json';
import r71 from '../river-navigation.json';
import r72 from '../river-perils.json';
import r73 from '../sea-cargo.json';
import r74 from '../sea-events.json';
import r75 from '../sea-navigation.json';
import r76 from '../sea-perils.json';
import r77 from '../sea-shanties.json';
import r78 from '../sea-weather.json';
import r79 from '../semences-de-scene.json';
import r80 from '../ship-construction.json';
import r81 from '../ship-criticals.json';
import r82 from '../ship-stations.json';
import r83 from '../sizes.json';
import r84 from '../skills.json';
import r85 from '../species.json';
import r86 from '../spells.json';
import r87 from '../stars.json';
import r88 from '../steam-breakdown.json';
import r89 from '../structure-criticals.json';
import r90 from '../structures.json';
import r91 from '../surincantation.json';
import r92 from '../symptoms.json';
import r93 from '../talents.json';
import r94 from '../tavernGames.json';
import r95 from '../terrains.json';
import r96 from '../traits.json';
import r97 from '../trappings.json';
import r98 from '../traumas.json';
import r99 from '../vehicles.json';
import r100 from '../vents-tourbillonnants.json';
import r101 from '../voyage-stakes.json';
import r102 from '../water-exposure.json';
import r103 from '../weaponGroups.json';
import r104 from '../weather.json';

/** RACINES VIVANTES : fichier → racine du document, pour chaque document qui porte une clé de dataset
 *  (l'image de `DATASET_FICHIER_DERIVE`, `exposition-derivee.ts`) — le module JSON singleton que le
 *  seam mute EN PLACE (`src/data/overrides.ts`). */
export const RACINES_VIVANTES: Readonly<Record<string, unknown>> = {
  'activities.json': r0,
  'advancementCosts.json': r1,
  'arcane-phenomena.json': r2,
  'artillery-misfire.json': r3,
  'astrology.json': r4,
  'axes.json': r5,
  'books.json': r6,
  'breath-types.json': r7,
  'buildings.json': r8,
  'calendarIntercalary.json': r9,
  'calendarMonths.json': r10,
  'calendarPhases.json': r11,
  'calendarWeekdays.json': r12,
  'careerLevels.json': r13,
  'careers.json': r14,
  'characteristics.json': r15,
  'classes.json': r16,
  'combat-stakes.json': r17,
  'creatures.json': r18,
  'crew-morale.json': r19,
  'crew-roles.json': r20,
  'crew-test-types.json': r21,
  'criticals.json': r22,
  'damage-types.json': r23,
  'defauts-de-compilation.json': r24,
  'details.json': r25,
  'disponibilite.json': r26,
  'domains.json': r27,
  'driving-mishap.json': r28,
  'drunkenness.json': r29,
  'encumbranceTiers.json': r30,
  'etats.json': r31,
  'eyes.json': r32,
  'flow-stakes.json': r33,
  'gods.json': r34,
  'grapple.json': r35,
  'groups.json': r36,
  'hairs.json': r37,
  'incidents-monture.json': r38,
  'interludeEvents.json': r39,
  'land-cargo.json': r40,
  'lightLevels.json': r41,
  'lightTones.json': r42,
  'locations.json': r43,
  'maladies.json': r44,
  'maneuvers.json': r45,
  'mass-battle.json': r46,
  'materials.json': r47,
  'miscast.json': r48,
  'montures.json': r49,
  'mutationTables.json': r50,
  'mutations.json': r51,
  'names.json': r52,
  'naval-ports.json': r53,
  'naval-progression.json': r54,
  'naval-traits.json': r55,
  'night-stakes.json': r56,
  'obsessions.json': r57,
  'oups.json': r58,
  'peripeties.json': r59,
  'pregens.json': r60,
  'problemes-vehicule.json': r61,
  'props.json': r62,
  'psychology.json': r63,
  'qualities.json': r64,
  'qualitySubtypes.json': r65,
  'qualityTypes.json': r66,
  'raceAppearance.json': r67,
  'reglesOptionnelles.json': r68,
  'rencontres-edoc.json': r69,
  'river-criticals.json': r70,
  'river-navigation.json': r71,
  'river-perils.json': r72,
  'sea-cargo.json': r73,
  'sea-events.json': r74,
  'sea-navigation.json': r75,
  'sea-perils.json': r76,
  'sea-shanties.json': r77,
  'sea-weather.json': r78,
  'semences-de-scene.json': r79,
  'ship-construction.json': r80,
  'ship-criticals.json': r81,
  'ship-stations.json': r82,
  'sizes.json': r83,
  'skills.json': r84,
  'species.json': r85,
  'spells.json': r86,
  'stars.json': r87,
  'steam-breakdown.json': r88,
  'structure-criticals.json': r89,
  'structures.json': r90,
  'surincantation.json': r91,
  'symptoms.json': r92,
  'talents.json': r93,
  'tavernGames.json': r94,
  'terrains.json': r95,
  'traits.json': r96,
  'trappings.json': r97,
  'traumas.json': r98,
  'vehicles.json': r99,
  'vents-tourbillonnants.json': r100,
  'voyage-stakes.json': r101,
  'water-exposure.json': r102,
  'weaponGroups.json': r103,
  'weather.json': r104,
};
