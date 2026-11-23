// La tenue d'un preset résolue par la chaîne du pont, et ses GLB locaux (#4338), sur les modèles commités.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { modelesCommites } from '../pont/pont.testkit';
import { avecModelesCommites } from './modelesCommites.testkit.ts';
import { lireLocales, tenueDesGlb } from './posesDesRanges.mjs';
import { tenueDuPreset } from './tenue';

const TENUE_DU_GLADIATEUR = [
  'humanoide--tete--humain',
  'humanoide--pilosite--barbe-courte',
  'humanoide--vetement--haut-de-chausses-ample',
  'humanoide--vetement--bottes-a-revers',
  'humanoide--armure--masque-de-cuir',
  'humanoide--armure--brassards-cloutes',
  'humanoide--accessoire--plumet-simple',
  'humanoide--accessoire--baudrier-sur-torse-nu',
  'humanoide--accessoire--ceinture-large',
  'humanoide--rigide--grande_hache',
  'humanoide--rigide--epee',
  'humanoide--rigide--dague',
];

const temporaires: string[] = [];
afterAll(() => { for (const d of temporaires) rmSync(d, { recursive: true, force: true }); });

/** Le GLB publié `id` de `dossier` copié en élément local sous un dossier de production, à côté de son `<id>.element.json`. */
function copieLocale(dossier: string, id: string): string {
  const production = join(mkdtempSync(join(tmpdir(), 'tenue-locale-')), id);
  temporaires.push(production);
  mkdirSync(production);
  copyFileSync(join(dossier, `${id}.glb`), join(production, `${id}.glb`));
  copyFileSync(join(dossier, `${id}.manifeste.json`), join(production, `${id}.element.json`));
  return join(production, `${id}.glb`);
}

describe('la tenue d’un preset (#4338)', () => {
  it('rend les éléments du gladiateur dans l’ordre de ses lignes : tête, coiffure, pièces, objet tenu, objets rangés', async () => {
    const { manifestes, osDesRigides } = await modelesCommites();
    expect(tenueDuPreset('gladiateur', 'humanoide', manifestes, osDesRigides)).toEqual(TENUE_DU_GLADIATEUR);
    expect(() => tenueDuPreset('inconnu', 'humanoide', manifestes, osDesRigides)).toThrow(/« inconnu » n’en est aucun/);
  }, 180_000);

  it('substitue une pièce locale à sa place, ajoute à la fin celle que le preset ne monte pas, refuse un id en double ou hors du nom du GLB', async () => {
    await avecModelesCommites(async (dossier) => {
      const hache = copieLocale(dossier, 'humanoide--rigide--grande_hache');
      const baton = copieLocale(dossier, 'humanoide--rigide--baton');
      const locales = lireLocales([`humanoide--rigide--grande_hache=${hache}`, `humanoide--rigide--baton=${baton}`]);
      const attendus = TENUE_DU_GLADIATEUR.map((id) => (id === 'humanoide--rigide--grande_hache' ? hache : join(dossier, `${id}.glb`)));
      expect(await tenueDesGlb({ manifeste: join(dossier, 'humanoide.manifeste.json'), preset: 'gladiateur', locales })).toEqual([...attendus, baton]);
      expect(() => lireLocales([`humanoide--rigide--baton=${baton}`, `humanoide--rigide--baton=${baton}`])).toThrow(/une fois par id/);
      expect(() => lireLocales([`humanoide--rigide--epee=${baton}`])).toThrow(/attendu humanoide--rigide--epee\.glb à côté/);
    });
  }, 180_000);

  it('refuse une paire --local sans GLB', () => {
    expect(() => lireLocales(['humanoide--rigide--epee'])).toThrow(/attendu <id>=<glb>/);
    expect(() => lireLocales(['humanoide--rigide--epee=/nulle/part/humanoide--rigide--epee.glb'])).toThrow(/attendu humanoide--rigide--epee\.glb à côté/);
  });
});
