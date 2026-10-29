import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { previewAttack } from './combatFlow';
import { rollCrewRole } from './shipManeuver';
import { crewRoleTestMods, resolveCrewTestByRoles } from '../engine/crewMorale';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { findCrewRoleById } from '../data';
import { RULE_REF } from '../engine/ruleRefs';
import { lignesDe } from '../engine/modLine.testkit';
import type { Combatant, ModLine, Weapon } from '../engine/types';
import type { RNG } from '../engine/dice';
import type { TravelPlan } from './travelFlow';
import { propulsionDuNavire } from '../engine/shipBuild';
import { desEnSuite } from '../engine/dice.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Compétence de Navigation d'une Cogue (`propulsionDuNavire`, MDG 13 l.18-19). */
const NAVIGATION = propulsionDuNavire('cogue', undefined, 'maritime')!.competence;

/** MDG 13 l.185-200 · LDB 62 l.180 */
const PISTOLET = { label: 'Pistolet', type: 'ranged', subType: 'poudre-noire', damage: { plusBF: false, flat: 8 }, range: 20, qualities: [] } as unknown as Weapon;
const ARC = { label: 'Arc', type: 'ranged', subType: 'arc', damage: { plusBF: true, flat: 3 }, range: 50, qualities: [] } as unknown as Weapon;

const seaPlan = (): TravelPlan => ({
  routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 8, km: 100, kmDone: 0,
  sea: {
    heading: 'ouest', windFrom: 'ouest', daysToEvent: 5, daysAtSea: 0, step: 'meteo', lines: [], milesToday: 0,
    weather: { precipitations: 'tres-abondantes', temperature: 'mediane', visibilite: 'degage', vent: 'brise-fraiche' },
  },
} as unknown as TravelPlan);

const meteo = (mods: ModLine[]): number[] => lignesDe(mods, RULE_REF['meteo-maritime']).map((m) => m.value);
const meteoApercu = (H: Combatant, E: Combatant): number[] => { const p = previewAttack(banc.getState, H, E); return meteo([...p.mods, ...(p.difficultyParts ?? [])]); };
const seq = (values: number[]): RNG => desEnSuite(values);

describe('Précipitations Très abondantes au combat ouvert pendant un voyage en mer (MDG 13 l.185)', () => {
  beforeEach(() => { banc.setState({ battle: null, travelPlan: null }); });

  function ouvreLeCombat(): { H: Combatant; E: Combatant } {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.setState({ travelPlan: seaPlan() });
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const E = b.combatants.find((c) => c.kind === 'enemy')!;
    b.combatants.filter((c) => c.kind === 'enemy' && c !== E).forEach((c) => { c.dead = true; });
    H.pos = { x: 5, y: 5 };
    E.pos = { x: 5, y: 8 };
    return { H, E };
  }

  const tireur = (H: Combatant, weapon: Weapon, spec: string): void => {
    H.weapons = [weapon];
    H.skills = [{ id: 'projectiles', spec, characteristic: 'capacite-de-tir', advances: 10 } as Combatant['skills'][number]];
  };

  it('l’estampille est posée sur chaque combattant', () => {
    ouvreLeCombat();
    const vivants = banc.getState().battle!.combatants;
    expect(vivants.length).toBeGreaterThan(1);
    expect(vivants.map((c) => c.envPrecipitation)).toEqual(vivants.map(() => 'tres-abondantes'));
  });

  it('arme à poudre, tireur qui a la spé Poudre noire : −30', () => {
    const { H, E } = ouvreLeCombat();
    tireur(H, PISTOLET, 'poudre-noire');
    expect(meteoApercu(H, E)).toEqual([-30]);
  });

  it('arme à poudre, tireur SANS la spé (LDB 62 l.180) : −10, la spé du Groupe n’est pas testée', () => {
    const { H, E } = ouvreLeCombat();
    tireur(H, PISTOLET, 'arc');
    expect(meteoApercu(H, E)).toEqual([-10]);
  });

  it('arc : −10', () => {
    const { H, E } = ouvreLeCombat();
    tireur(H, ARC, 'arc');
    expect(meteoApercu(H, E)).toEqual([-10]);
  });

  it('Test d’équipage de combat : la cible porte la ligne, et le résolveur headless joue la même cible que le joueur', () => {
    const { H } = ouvreLeCombat();
    tireur(H, PISTOLET, 'poudre-noire');
    const role = findCrewRoleById('artilleur')!;
    expect(meteo(crewRoleTestMods(H, role, NAVIGATION))).toEqual([-30]);
    const joueur = rollCrewRole(H, 'artilleur', NAVIGATION, seq([45]))!.result;
    const headless = resolveCrewTestByRoles([{ crew: H, roleId: 'artilleur' }], 'batterie', 'intermediaire', 80, NAVIGATION, seq([45]));
    expect(headless.contributions[0].sl).toBe(joueur.sl);
  });
});
