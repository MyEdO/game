import { describe, it, expect } from 'vitest';
import { shipCrewAssignments, shipMoraleScore, shipDefaultRoles, crewTestContributors } from './shipCrew';
import { traumaById } from '../engine/trauma';
import type { Combatant, SkillInstance } from '../engine/types';
import type { Get } from './flowTypes';

// Marin minimal (carac d'instance = Dex → valeur prévisible = Dex + avances), calqué sur crew-roles.test.ts.
const mk = (id: string, dex: number, skills: { id: string; advances: number; spec?: string }[] = [], shipRole?: string): Combatant =>
  ({
    id, name: id, kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: dex, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    skills: skills.map((s) => ({ ...s, characteristic: 'dexterite' }) as SkillInstance),
    conditions: [], talents: [], wounds: { current: 10, max: 10, base: 10 }, shipRole,
  }) as unknown as Combatant;

const hull = (crewIds: string[], creatureId = 'cogue'): Combatant =>
  ({ id: 'ship', name: 'Navire', kind: 'npc', bodyShape: 'vehicule', creatureId, crewIds, conditions: [], wounds: { current: 50, max: 50, base: 50 } }) as unknown as Combatant;

const getWith = (vessel: unknown): Get => (() => ({ vessel })) as unknown as Get;

describe('shipCrewAssignments — équipage → rôles pour un Test (MDG 14)', () => {
  it('rôle ÉPINGLÉ respecté ; rôle HORS du type de Test exclu', () => {
    const timonier = mk('t', 50, [{ id: 'voile', advances: 30 }], 'timonier');
    const artilleur = mk('g', 50, [{ id: 'projectiles', advances: 30, spec: 'poudre-noire' }], 'artilleur');
    const ship = hull(['t', 'g']);
    const a = shipCrewAssignments(ship, [ship, timonier, artilleur], 'manoeuvre'); // 'manoeuvre' n'inclut PAS artilleur
    expect(a.map((x) => x.roleId)).toEqual(['timonier']);
    expect(a[0].crew.id).toBe('t');
  });

  it('plusieurs membres au MÊME rôle (MDG 14 l.9 « plusieurs Personnages peuvent contribuer ») → tous contribuent', () => {
    const c1 = mk('a', 30, [{ id: 'voile', advances: 20 }], 'timonier'); // Voile 50
    const c2 = mk('b', 60, [{ id: 'voile', advances: 20 }], 'timonier'); // Voile 80
    const ship = hull(['a', 'b']);
    const a = shipCrewAssignments(ship, [ship, c1, c2], 'manoeuvre');
    expect(a).toHaveLength(2); // les DEUX au poste de Timonier (DR sommés), pas « le meilleur seul »
    expect(a.every((x) => x.roleId === 'timonier')).toBe(true);
  });

  it('inférence quand le rôle n’est pas épinglé', () => {
    const cap = mk('cap', 30, [{ id: 'commandement', advances: 40 }]); // inféré → capitaine (dans 'manoeuvre')
    const ship = hull(['cap']);
    expect(shipCrewAssignments(ship, [ship, cap], 'manoeuvre')).toEqual([{ crew: cap, roleId: 'capitaine' }]);
  });
});

describe('shipDefaultRoles — défaut GLOBAL : essentiel rempli en 1er + PJ étalés (MDG 14)', () => {
  it('remplit l’ESSENTIEL d’abord puis étale (pas 2 sur le même poste spécifique)', () => {
    const cap = mk('cap', 50, [{ id: 'commandement', advances: 30 }]); // → Capitaine
    const nav = mk('nav', 50, [{ id: 'orientation', advances: 30 }]);   // → Navigateur
    const helm = mk('helm', 30, [{ id: 'voile', advances: 10 }]);       // seul à la Voile → Timonier (essentiel)
    const m2 = mk('m2', 40, [{ id: 'ramer', advances: 0 }]);            // Ramer → Mousse (catch-all)
    const roles = shipDefaultRoles([cap, nav, helm, m2], 'manoeuvre');
    expect(roles.get('helm')).toBe('timonier');  // essentiel rempli EN PREMIER
    expect(roles.get('cap')).toBe('capitaine');
    expect(roles.get('nav')).toBe('navigateur'); // étalé — PAS un 2e Capitaine
    expect(roles.get('m2')).toBe('mousse');
  });

  it('un Mousse Inconscient ne compte pas : il ne peut pas tenter le Test (LDB 16 l.113)', () => {
    const cap = mk('cap', 50, [{ id: 'commandement', advances: 30 }]);
    const helm = mk('helm', 30, [{ id: 'voile', advances: 10 }]);
    const ko = { ...mk('ko', 40, [{ id: 'ramer', advances: 0 }]), conditions: [{ id: 'inconscient', value: 1 }] } as unknown as Combatant;
    const roles = shipDefaultRoles([cap, helm, ko], 'manoeuvre');
    expect(roles.get('helm')).toBe('timonier');
    expect(roles.has('ko'), 'l’Inconscient n’est pas posté Mousse').toBe(false);
  });

  it('un rôle ÉPINGLÉ est respecté et peut être MULTI (l.9)', () => {
    const a = mk('a', 50, [{ id: 'voile', advances: 20 }], 'timonier');
    const b = mk('b', 60, [{ id: 'voile', advances: 20 }], 'timonier');
    const roles = shipDefaultRoles([a, b], 'manoeuvre');
    expect(roles.get('a')).toBe('timonier');
    expect(roles.get('b')).toBe('timonier'); // 2 épinglés au même poste = OK
  });
});

describe('shipMoraleScore — pont campagne → combat', () => {
  it('coque = navire de campagne → Moral du vaisseau ; sinon défaut 75', () => {
    const ship = hull([], 'cogue');
    expect(shipMoraleScore(getWith({ vehicleId: 'cogue', morale: { score: 60 } }), ship)).toBe(60);
    expect(shipMoraleScore(getWith({ vehicleId: 'knarr', morale: { score: 60 } }), ship)).toBe(75);
    expect(shipMoraleScore(getWith(null), ship)).toBe(75);
  });
});

describe('crewTestContributors — sens transmis au RANKING du marin représentant (#158)', () => {
  it('Test VISUEL (phare, sense "vue") : ne pénalise pas un marin sourd dans le choix du représentant', () => {
    // Deux marins « vigie », aucun PJ → UN représentant choisi par crewRoleValue (l.39/41).
    const deaf = { ...mk('deaf', 40, [{ id: 'perception', advances: 0 }], 'vigie'), traumas: [traumaById('surdite', undefined, 'tete')] } as Combatant;
    const hearing = mk('hearing', 30, [{ id: 'perception', advances: 0 }], 'vigie');
    const ship = hull([deaf.id, hearing.id]);
    const crew = [deaf, hearing];
    const noPJ = new Set<string>();
    // Sans sens : la Surdité pénalise (conservateur) → deaf 20 < hearing 30 → le NON-sourd représente.
    expect(crewTestContributors(ship, crew, 'perception', noPJ).find((a) => a.roleId === 'vigie')!.crew.id).toBe('hearing');
    // Sens 'vue' : la Surdité ne vise QUE l'ouïe → deaf 40 > hearing 30 → le SOURD (meilleur) représente.
    expect(crewTestContributors(ship, crew, 'perception', noPJ, 'vue').find((a) => a.roleId === 'vigie')!.crew.id).toBe('deaf');
  });
});
