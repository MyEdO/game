/**
 * LA MARCHE À L'ÉTAGE (#3775 ; `CONTRAT.md`, section « Vue ») : « Tester la scène » de La Diligence, le groupe monté à
 * l'étage de la maison par son escalier. La vue s'y rend dans le même ordre de durée qu'au rez : les gestes
 * d'exploration (`gestesDExploration`) rejoignent chaque dénivelé de l'étage par un seul parcours depuis la case du
 * groupe (`cheminsDepuis`), jamais par un parcours de la carte par dénivelé.
 */
import { describe, expect, it } from 'vitest';
import { suiteDe, table, vueDe, type Reponse } from './pont.testkit';
import { CLIC_DU_CHAMP } from '../../../src/noyau/index';
import type { Bouton, Choix, Formulaire, Ligne } from '../../../src/hote/elements';

const { appel } = table();

/** La plus courte de trois durées (ms) de `f` : la moins bruitée par la charge de la machine. */
const duree = (f: () => unknown): number => Math.min(...[0, 1, 2].map(() => {
  const debut = performance.now();
  f();
  return performance.now() - debut;
}));

/** L'exploration de la vue après le clic du champ sur la case `(x, y)` de la couche `z`. */
const marcher = (x: number, y: number, z: number) => vueDe(appel('jouer', { type: CLIC_DU_CHAMP, args: [{ x, y, z }] })).projection.exploration;

describe('la marche à l’étage de La Diligence mise à l’essai', () => {
  it('à l’étage, la vue se rend dans le même ordre de durée qu’au rez', { timeout: 120_000 }, () => {
    const ouverte = appel('editer', { ouvrir: 'la-diligence' }) as Reponse & { vue: { zones: Record<string, (Ligne | Choix | Bouton | Formulaire)[]> } };
    const tester = Object.values(ouverte.vue.zones).flat().find((el): el is Bouton => el.type === 'bouton' && el.id === 'tester');
    expect(appel('editer', tester!.jeu), 'la scène ouverte se met à l’essai').toMatchObject({ ok: true, essai: true });
    expect(suiteDe(appel('demarrer', { essai: true })).vue.projection.scene?.id).toBe('la-diligence');

    expect(marcher(20, 21, 0), 'le groupe au pied de l’escalier').toMatchObject({ groupe: [20, 21], etage: 0 });
    const auRez = duree(() => appel('vue'));
    expect(marcher(18, 18, 1), 'le groupe monté à l’étage').toMatchObject({ groupe: [18, 18], etage: 1 });
    const aLEtage = duree(() => appel('vue'));
    expect(aLEtage, `vue à l’étage ${aLEtage.toFixed(0)} ms, au rez ${auRez.toFixed(0)} ms`).toBeLessThan(4 * auRez);
  });
});
