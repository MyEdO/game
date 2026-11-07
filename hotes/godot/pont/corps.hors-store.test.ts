/**
 * LE CORPS D'UN COMBATTANT (#3253 ; `CONTRAT.md`, section « Corps d'un combattant ») : la vue compose chaque combattant
 * dessiné sur la seule base servie par le dernier `modeles`, comme l'atelier compose une composition ; sans `modeles` ou
 * devant plusieurs bases, elle refuse et aucun combattant n'a de corps ; un combattant sans portée n'en a pas ; une
 * apparence variante, née du contexte de carrière, monte l'élément de sa racine.
 */
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { baseDeTest } from '../asset/modeles.testkit.ts';
import { listage } from '../servir.mjs';
import { tableTotale } from '../../../src/lib/tableTotale';
import { suiteDe, table, type Reponse } from './pont.testkit';
import type { CombattantProjete } from '../../../src/hote/projection';
import type { VueDuPont } from './pont';

/** Le listage des modèles commités du projet Godot, tel que `GET /modeles/` le sert. */
const COMMITES = listage(join(import.meta.dirname, '../projet/modeles'));

const { appel } = table();
const vueDe = (r: Reponse): VueDuPont => (r as { vue: VueDuPont }).vue;
/** `modeles` sur `manifestes`, chacun avec les os de ses meshes rigides au listage commité. */
const servir = (manifestes: Record<string, unknown>) =>
  expect(appel('modeles', { manifestes, osDesRigides: tableTotale(Object.keys(manifestes), (id) => COMMITES.osDesRigides[id] ?? []) })).toMatchObject({ ok: true });

describe('le corps des combattants dans la vue', () => {
  let vue: VueDuPont;
  let dessines: CombattantProjete[];
  let heros: CombattantProjete;
  let sansPortee: CombattantProjete;
  beforeAll(() => {
    ({ vue } = suiteDe(appel('demarrer', { scenario: 'bestiaire', graine: 7 })));
    dessines = vue.projection.combat!.voisins.liste;
    heros = dessines.find((c) => c.id === 'pregen-101')!;
    sansPortee = dessines.find((c) => c.portee === null)!;
  });

  it('sans modeles : un refus, et aucun combattant n’a de corps', () => {
    expect(vue.corps.refus).toMatch(/^\[sans-modeles\] /);
    expect(vue.corps.combattants).toEqual(Object.fromEntries(dessines.map((c) => [c.id, null])));
  });

  it('après modeles sur les manifestes commités : le héros humain se compose sur humanoide, sa tête montée', () => {
    expect(heros.portee?.portees.map((p) => p.cle)).toContainEqual({ champ: 'tete', id: 'humain' });
    servir(COMMITES.manifestes);
    const { corps } = vueDe(appel('vue'));
    expect(corps.refus).toBeNull();
    expect(corps.combattants[heros.id]?.base).toBe('humanoide');
    expect(corps.combattants[heros.id]?.montes).toContainEqual({ ligne: 'ligne/tete', element: 'humanoide--tete--humain' });
  });

  it('le Soldat de carrière tient l’épée de soldat, variante née de sa carrière : l’élément de sa racine la monte', () => {
    const epee = heros.portee?.portees.find((p) => p.point === 'main');
    expect(epee?.cle).toEqual({ champ: 'apparence', id: 'epee_soldat', racine: 'epee' });
    servir(COMMITES.manifestes);
    expect(vueDe(appel('vue')).corps.combattants[heros.id]?.montes).toContainEqual({ ligne: 'main', element: 'humanoide--rigide--epee' });
  });

  it('un combattant sans portée n’a pas de corps', () => {
    servir(COMMITES.manifestes);
    expect(vueDe(appel('vue')).corps.combattants[sansPortee.id]).toBeNull();
  });

  it('deux bases servies : base ambiguë, aucun combattant n’a de corps', () => {
    servir({ ...COMMITES.manifestes, nain: baseDeTest('nain') });
    const { corps } = vueDe(appel('vue'));
    expect(corps.refus).toMatch(/^\[base-ambigue\] 2 base\(s\) servie\(s\)/);
    expect(Object.values(corps.combattants).every((c) => c === null)).toBe(true);
  });
});
