import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHEMIN_DU_CATALOGUE, catalogue } from '../../catalogue';
import {
  acheter,
  acheterUneArme,
  ameliorer,
  nouvellePartie,
  offresDeCarriere,
  panoplie,
  recrue,
  sortsProposes,
  PROFILS,
  SORTS_DES_VOIES,
  SORTS_MINEURS,
} from './index';
import { sortsDeLaVoie, nomDeSort, porterAuNiveau } from '../noyau';

const profilDe = (id: string) => PROFILS.find((p) => p.id === id)!;

describe('le catalogue', () => {
  it('CATALOGUE.md est la génération de valeurs.ts (npx tsx projets/roguelite/catalogue.ts)', () => {
    expect(readFileSync(CHEMIN_DU_CATALOGUE, 'utf8')).toBe(catalogue());
  });

  it('chaque sort retenu existe et appartient à sa voie ; chaque voie du roster a sa liste', () => {
    const voies = [...PROFILS.flatMap((p) => (p.voie ? [p.voie] : [])), ...['sigmar', 'ulric', 'myrmidia'].map((spec) => ({ talent: 'invocation' as const, spec }))];
    expect(Object.keys(SORTS_DES_VOIES).sort()).toEqual(voies.map((v) => v.spec).sort());
    for (const v of voies) {
      const sorts = Object.values(SORTS_DES_VOIES[v.spec]).flat();
      expect(sorts.length, v.spec).toBeGreaterThan(0);
      if (v.talent === 'magie-des-arcanes') expect(sorts.length, v.spec).toBeLessThanOrEqual(6);
      expect(sorts.filter((id) => !sortsDeLaVoie(v.talent, v.spec).includes(id)), v.spec).toEqual([]);
    }
    for (const id of SORTS_MINEURS) expect(nomDeSort(id)).not.toBe(id);
  });
});

describe('la Salle d’armes et les sorts de la voie', () => {
  it('propose à un Pyromancien de niveau 2 les seuls sorts de niveau 2, et refuse ceux du niveau 3', () => {
    const e = nouvellePartie(3);
    e.or = 1e5; e.trophees = 10; ameliorer(e, 'salle');
    const h = recrue(e, profilDe('pyromancien'));
    h.c = porterAuNiveau(h.c, 2, 7); h.c.xp = 5000; e.roster.push(h);
    expect(acheter(e, h.c.id, { genre: 'talent', ref: { id: 'magie-des-arcanes', spec: 'feu' } })).toBeNull();
    const { 2: niveau2, 3: niveau3 } = SORTS_DES_VOIES.feu;
    expect(sortsProposes(h)).toEqual(niveau2);
    expect(acheter(e, h.c.id, { genre: 'sort', id: niveau3[0] })).toBe('La salle d’armes n’enseigne pas ce sort à ce héros.');
    expect(acheter(e, h.c.id, { genre: 'sort', id: niveau2[0] })).toBeNull();
    expect(h.c.spells).toContain(niveau2[0]);
  });
});

describe('les emplacements « (Au choix) » désignés à la recrue', () => {
  it('le Duelliste tient Corps à corps (Escrime), jamais (Armes d’hast)', () => {
    const e = nouvellePartie(1);
    for (let i = 0; i < 4; i++) {
      const h = recrue(e, profilDe('duelliste'));
      const cac = h.c.skills.filter((k) => k.id === 'corps-a-corps').map((k) => k.spec);
      expect(cac).toContain('escrime');
      expect(cac).not.toContain('armes-d-hast');
    }
  });

  it('le Répurgateur de niveau 2 a Projectiles (Poudre noire) à sa carrière et achète un second pistolet', () => {
    const e = nouvellePartie(6);
    e.or = 10_000; e.trophees = 10;
    expect(ameliorer(e, 'salle')).toBeNull();
    for (let i = 0; i < 2; i++) expect(ameliorer(e, 'forge')).toBeNull();
    const h = recrue(e, profilDe('repurgateur'));
    e.roster.push(h);
    h.c.xp = 1000;
    expect(offresDeCarriere(h).competences.map((k) => `${k.ref.id}:${k.ref.spec ?? ''}`)).toContain('projectiles:poudre-noire');
    expect(acheter(e, h.c.id, { genre: 'talent', ref: { id: 'maniement-de-deux-armes' } })).toBeNull();
    const premier = panoplie(h).tir!.id!;
    expect(acheterUneArme(e, h.c.id, 'pistolet')).toBeNull();
    const tir = h.c.loadouts!.find((l) => h.c.items!.find((i) => i.uid === l.main)?.trappingId === premier)!;
    expect(h.c.items!.find((i) => i.uid === tir.secondaire)?.trappingId).toBe('pistolet');
  });
});
