import { describe, it, expect } from 'vitest';
import {
  MOUNT_INCIDENTS, VEHICLE_PROBLEMS, encounterTable,
  rollMountIncident, rollVehicleProblem, rollEncounter,
  type TravelTableEntry, type EncounterCategory,
} from './travelTables';

/** Une table d100 bien formée couvre 1..100 de façon CONTIGUË (pas de trou ni de chevauchement). */
function expectContiguous(entries: TravelTableEntry[]) {
  const sorted = [...entries].sort((a, b) => a.min - b.min);
  expect(sorted[0].min).toBe(1);
  expect(sorted[sorted.length - 1].max).toBe(100);
  for (let i = 1; i < sorted.length; i++) expect(sorted[i].min).toBe(sorted[i - 1].max + 1);
  for (const e of entries) expect(e.id && e.label && e.desc).toBeTruthy();
}

describe('tables de voyage EDOC (data-driven, JSON)', () => {
  it('Incidents de monte : table d100 contiguë (EDOC 07 l.150-155)', () => {
    expectContiguous(MOUNT_INCIDENTS);
    expect(rollMountIncident(1).id).toBe('sangle-cassee');
    expect(rollMountIncident(40).id).toBe('sangle-cassee');
    expect(rollMountIncident(41).id).toBe('perte-d-un-fer');
    expect(rollMountIncident(86).id).toBe('boiteux');
    expect(rollMountIncident(99).id).toBe('patte-brisee');
    expect(rollMountIncident(100).id).toBe('patte-brisee');
  });

  it('Problèmes de véhicule : table d100 contiguë + Dégâts au véhicule (EDOC 07 l.259-264)', () => {
    expectContiguous(VEHICLE_PROBLEMS);
    expect(rollVehicleProblem(50).id).toBe('incontrolable');
    expect(rollVehicleProblem(51).id).toBe('endommage');
    expect(rollVehicleProblem(80).id).toBe('casse');
    expect(rollVehicleProblem(96).id).toBe('accident');
    // Le crochet véhicule-à-PV : Cassé inflige 1d10, Accident 2d10 ; Incontrôlable/Endommagé n'endommagent pas.
    expect(rollVehicleProblem(80).vehicleWounds).toEqual({ dice: { n: 1, sides: 10 } });
    expect(rollVehicleProblem(96).vehicleWounds).toEqual({ dice: { n: 2, sides: 10 } });
    expect(rollVehicleProblem(1).vehicleWounds).toBeNull();
    // Dégâts aux OCCUPANTS en GameOp : Cassé = 1 Blessure ignorant BE et PA (EDOC 07 l.259-264) ;
    // Accident = 2d10 modifiées par BE et PA, min 1 (verbatim EDOC 7). Mitigation DÉCLARÉE des deux côtés.
    expect(rollVehicleProblem(80).occupantOps).toEqual([{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }]);
    expect(rollVehicleProblem(96).occupantOps).toEqual([{ op: 'wounds', amount: { dice: { n: 2, sides: 10 } }, ignoreTB: false, ignoreAP: false, min: 1 }]);
    expect(rollVehicleProblem(1).occupantOps).toBeUndefined();
  });

  it('Rencontres : 3 tables d100 contiguës (EDOC 8 l.186-233)', () => {
    for (const cat of ['positives', 'fortuites', 'dangereuses'] as EncounterCategory[]) {
      expectContiguous(encounterTable(cat));
    }
    expect(rollEncounter('positives', 75).id).toBe('temps-libre');
    expect(rollEncounter('positives', 75).stageOutcome).toBe('extraActivity');
    expect(rollEncounter('positives', 96).stageOutcome).toBe('fullRecovery');
    expect(rollEncounter('dangereuses', 70).stageOutcome).toBe('worsenWeather');
    expect(rollEncounter('fortuites', 100).id).toBe('ami-dans-le-besoin');
  });
});
