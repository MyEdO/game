/**
 * LE CORPS D'UN COMBATTANT (#3253 ; `CONTRAT.md`, section « Corps d'un combattant ») : la vue compose chaque combattant
 * dessiné sur la seule base servie par le dernier `modeles`, comme l'atelier compose une composition ; sans `modeles` ou
 * devant plusieurs bases, elle refuse et aucun combattant n'a de corps ; un combattant sans portée n'en a pas.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baseDeTest } from '../asset/modeles.testkit.ts';
import { tableTotale } from '../../../src/lib/tableTotale';
import { suiteDe, table, type Reponse } from './pont.testkit';
import type { VueDuPont } from './pont';

const DOSSIER = join(import.meta.dirname, '../projet/modeles');
const SUFFIXE = '.manifeste.json';
/** Les manifestes commités du projet Godot, par id de modèle. */
const COMMITES: Record<string, unknown> = Object.fromEntries(readdirSync(DOSSIER).filter((f) => f.endsWith(SUFFIXE))
  .map((f) => [f.slice(0, -SUFFIXE.length), JSON.parse(readFileSync(join(DOSSIER, f), 'utf8'))]));

const { appel } = table();
const vueDe = (r: Reponse): VueDuPont => (r as { vue: VueDuPont }).vue;
const servir = (manifestes: Record<string, unknown>) =>
  expect(appel('modeles', { manifestes, osDesRigides: tableTotale(Object.keys(manifestes), () => []) })).toMatchObject({ ok: true });

describe('le corps des combattants dans la vue', () => {
  const { vue } = suiteDe(appel('demarrer', { scenario: 'bestiaire', graine: 7 }));
  const dessines = vue.projection.combat!.voisins.liste;
  const heros = dessines.find((c) => c.id === 'pregen-101')!;
  const sansPortee = dessines.find((c) => c.portee === null)!;

  it('sans modeles : un refus, et aucun combattant n’a de corps', () => {
    expect(vue.corps.refus).toMatch(/^\[sans-modeles\] /);
    expect(vue.corps.combattants).toEqual(Object.fromEntries(dessines.map((c) => [c.id, null])));
  });

  it('après modeles sur les manifestes commités : le héros humain se compose sur humanoide, sa tête montée', () => {
    expect(heros.portee?.portees.map((p) => p.cle)).toContainEqual({ champ: 'tete', id: 'humain' });
    servir(COMMITES);
    const { corps } = vueDe(appel('vue'));
    expect(corps.refus).toBeNull();
    expect(corps.combattants[heros.id]?.base).toBe('humanoide');
    expect(corps.combattants[heros.id]?.montes).toContainEqual({ ligne: 'ligne/tete', element: 'humanoide--tete--humain' });
  });

  it('un combattant sans portée n’a pas de corps', () => {
    servir(COMMITES);
    expect(vueDe(appel('vue')).corps.combattants[sansPortee.id]).toBeNull();
  });

  it('deux bases servies : base ambiguë, aucun combattant n’a de corps', () => {
    servir({ ...COMMITES, nain: baseDeTest('nain') });
    const { corps } = vueDe(appel('vue'));
    expect(corps.refus).toMatch(/^\[base-ambigue\] 2 base\(s\) servie\(s\)/);
    expect(Object.values(corps.combattants).every((c) => c === null)).toBe(true);
  });
});
