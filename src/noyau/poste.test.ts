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
    expect(p.skills).toEqual(def.skills ?? []);
  });

  it("activityAsPoste : une Activité sans skills (Récupérer) projette skills=[]", () => {
    const def = activitiesFor('voyage').find((a) => a.id === 'recuperer')!;
    expect(def).toBeTruthy();
    const p = activityAsPoste(def);
    expect(p.skills).toEqual([]);
  });

  it('crewRoleAsPoste projette un rôle d’équipage en Poste, sans icône', () => {
    const r = findCrewRoleById('capitaine')!;
    expect(r).toBeTruthy();
    const p = crewRoleAsPoste(r);
    expect(p.id).toBe('capitaine');
    expect(p.label).toBe(r.label);
    expect(p.icon).toBeUndefined(); // les rôles d'équipage n'ont pas d'icône
    expect(p.skills).toEqual(r.skills);
  });

  it('crewRoleAsPoste : le Mousse (2 compétences) conserve les deux', () => {
    const r = findCrewRoleById('mousse')!;
    const p = crewRoleAsPoste(r);
    expect(p.skills.map((s) => s.id)).toEqual(['voile', 'ramer']);
  });

  it('stationAsPoste projette une STATION à bord en Poste, SANS compétence', () => {
    const st = findShipStation('avirons')!;
    expect(st).toBeTruthy();
    const p = stationAsPoste(st);
    expect(p.id).toBe('avirons');
    expect(p.label).toBe(st.label);
    expect(p.icon).toBeUndefined();
    // Aucune Compétence ne qualifie une PRÉSENCE : le livre demande qui s'y TROUVE (MDG 13 l.751),
    // pas qui sait y servir — l'inférence « auto » de la surface partagée n'a rien à proposer.
    expect(p.skills).toEqual([]);
  });

  it('les CINQ stations se projettent sans exception, et aucune ne porte de compétence', () => {
    const postes: Poste[] = shipStations.map(stationAsPoste);
    expect(postes.map((p) => p.id)).toEqual(['pont', 'greement', 'nid-de-pie', 'avirons', 'cale']);
    for (const p of postes) {
      expect(p.label, p.id).toBeTruthy();
      expect(p.skills, p.id).toEqual([]);
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
const h = (id: string, label: string): Combatant => ({ id, label, kind: 'hero' } as Combatant);

describe('reposAsPoste — « Repos » est une LIGNE ÉPINGLABLE du roster', () => {
  it('son id EST la constante de résolution (source unique de la valeur)', () => {
    expect(reposAsPoste().id).toBe(BENCHED);
  });

  it('il reste HORS du catalogue MDG 14 : les 9 rôles du livre n’en comptent pas un dixième', () => {
    expect(crewRoles.some((r) => r.id === BENCHED), 'le dataset d’un livre ne reçoit pas d’entrée maison').toBe(false);
    expect(crewRoles.length).toBe(9);
  });

  it('aucune compétence : aucun Test d’équipage ne recrute au repos', () => {
    expect(reposAsPoste().skills).toEqual([]);
    expect(reposAsPoste().label).toBe('Repos');
  });
});

describe('postesOccupes — INVERSION héros→poste (PURE, sans DOM)', () => {
  const postes: Poste[] = [
    { id: 'pont', label: 'Pont', skills: [] },
    { id: 'cale', label: 'Cale', skills: [] },
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
