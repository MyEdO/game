import { describe, it, expect } from 'vitest';
import { activityAsPoste, crewRoleAsPoste, stationAsPoste, reposAsPoste, postesOccupes, type Poste } from './poste';
import { BENCHED } from './shipCrew';
import type { Combatant } from '../engine/types';
import { activitiesFor } from '../engine/activities';
import { crewRoles, findCrewRoleById, findShipStation, shipStations } from '../data';

describe('poste — adaptateurs de projection (donnée-vue commune)', () => {
  it('activityAsPoste projette une Activité de voyage en Poste', () => {
    const def = activitiesFor('voyage').find((a) => a.id === 'plein-air')!;
    expect(def).toBeTruthy();
    const p = activityAsPoste(def);
    expect(p.id).toBe('plein-air');
    expect(p.label).toBe(def.label);
    expect(p.icon).toBe(def.icon); // les activités portent une icône
  });

  it('crewRoleAsPoste projette un rôle d’équipage en Poste, sans icône', () => {
    const r = findCrewRoleById('capitaine')!;
    expect(r).toBeTruthy();
    const p = crewRoleAsPoste(r);
    expect(p.id).toBe('capitaine');
    expect(p.label).toBe(r.label);
    expect(p.icon).toBeUndefined(); // les rôles d'équipage n'ont pas d'icône
  });

  it('stationAsPoste projette une STATION à bord en Poste', () => {
    const st = findShipStation('avirons')!;
    expect(st).toBeTruthy();
    const p = stationAsPoste(st);
    expect(p.id).toBe('avirons');
    expect(p.label).toBe(st.label);
    expect(p.icon).toBeUndefined();
  });

  it('les stations se projettent sans exception', () => {
    const postes: Poste[] = shipStations.map(stationAsPoste);
    expect(postes.map((p) => p.id)).toEqual(shipStations.map((s) => s.id));
    for (const p of postes) {
      expect(p.label, p.id).toBeTruthy();
    }
  });

  it('tous les rôles d’équipage se projettent sans exception (id/label stables)', () => {
    const postes: Poste[] = crewRoles.map(crewRoleAsPoste);
    expect(postes.length).toBe(crewRoles.length);
    for (const p of postes) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
    }
  });
});

/** Deux héros nus : `postesOccupes` ne lit qu'un id de poste, jamais une caractéristique. */
const h = (id: string, label: string): Combatant => ({ id, label, kind: 'heros' } as Combatant);

describe('reposAsPoste — « Repos » est une LIGNE ÉPINGLABLE du roster', () => {
  it('son id EST la constante de résolution (source unique de la valeur)', () => {
    expect(reposAsPoste().id).toBe(BENCHED);
  });

  it('il reste HORS du catalogue MDG 14 : aucun rôle du livre ne porte son id', () => {
    expect(crewRoles.map((r) => r.id), 'le dataset d’un livre ne reçoit pas d’entrée maison').not.toContain(BENCHED);
  });

  it('son libellé est « Repos »', () => {
    expect(reposAsPoste().label).toBe('Repos');
  });
});

describe('postesOccupes — INVERSION héros→poste (PURE, sans DOM)', () => {
  const postes: Poste[] = [
    { id: 'pont', label: 'Pont' },
    { id: 'cale', label: 'Cale' },
  ];

  it('range chaque héros dans la ligne de SON poste, et garde les lignes VIDES', () => {
    const { parPoste, sansPoste } = postesOccupes([h('a', 'Ansmann'), h('b', 'Brenner')], postes, (x) => (x.id === 'a' ? 'pont' : null));
    expect([...parPoste.keys()], 'toutes les lignes du catalogue, dans son ORDRE').toEqual(['pont', 'cale']);
    expect(parPoste.get('pont')!.map((c) => c.id)).toEqual(['a']);
    expect(parPoste.get('cale'), 'une ligne vide EXISTE — rien ne glisse').toEqual([]);
    expect(sansPoste.map((c) => c.id)).toEqual(['b']);
  });

  it('le BANC naît de la MESURE : sans poste épinglé, le héros n’est sur aucune ligne', () => {
    const { parPoste, sansPoste } = postesOccupes([h('a', 'Ansmann')], postes, () => undefined);
    expect([...parPoste.values()].flat()).toEqual([]);
    expect(sansPoste.map((c) => c.id)).toEqual(['a']);
  });

  it('PLUSIEURS héros sur la même ligne (MDG 14 l.9 « plusieurs Personnages peuvent contribuer »)', () => {
    const { parPoste } = postesOccupes([h('a', 'A'), h('b', 'B')], postes, () => 'pont');
    expect(parPoste.get('pont')!.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('un poste HORS catalogue ne PERD pas son porteur : il tombe au banc', () => {
    const { sansPoste } = postesOccupes([h('a', 'A')], postes, () => 'poste-inconnu');
    expect(sansPoste.map((c) => c.id)).toEqual(['a']);
  });
});
