// La tenue d'une portée résolue par la chaîne du pont, et ses GLB locaux (#4338), sur les modèles commités et une
// composition de fixture.
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { lireComposition, porteeDeComposition } from '../../../src/noyau/index';
import { modelesCommites } from '../pont/pont.testkit';
import { avecModelesCommites } from './modelesCommites.testkit.ts';
import { lireLocales, tenueDesGlb } from './posesDesRanges.mjs';
import { porteeDuPreset, tenueDeLaPortee } from './tenue';

/** Une tête, une coiffure, une pièce sous sa variante, un objet tenu et un objet rangé, lue au schéma (`lireComposition`). */
const COMPOSITION = (() => {
  const lue = lireComposition({
    race: { id: 'humain' },
    sex: 'M',
    tete: { id: 'humain' },
    coiffure: { id: 'barbe-courte' },
    pieces: ['bottes'],
    variantesPieces: { bottes: { id: 'bottes-a-revers' } },
    prises: { main: { id: 'grande-hache' } },
    objets: ['dague'],
  });
  if (!lue.ok) throw new Error(`composition de fixture refusée : ${JSON.stringify(lue.fautes)}`);
  return lue.valeur;
})();

/** Les éléments publiés que monte `COMPOSITION`, dans l'ordre des lignes : tête, coiffure, pièces, objet tenu, objets
 *  rangés (`porteeDeComposition`). */
const TENUE = [
  'humanoide--tete--humain',
  'humanoide--pilosite--barbe-courte',
  'humanoide--vetement--bottes-a-revers',
  'humanoide--rigide--grande_hache',
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

describe('la tenue d’une portée (#4338)', () => {
  it('rend les éléments de la composition dans l’ordre de ses lignes : tête, coiffure, pièces, objet tenu, objets rangés', async () => {
    const { manifestes, osDesRigides } = await modelesCommites();
    expect(tenueDeLaPortee(porteeDeComposition(COMPOSITION), 'humanoide', manifestes, osDesRigides)).toEqual(TENUE);
    expect(() => porteeDuPreset('inconnu')).toThrow(/« inconnu » n’en est aucun/);
  }, 180_000);

  it('substitue une pièce locale à sa place, ajoute à la fin celle que la portée ne monte pas, refuse un id en double ou hors du nom du GLB', async () => {
    await avecModelesCommites(async (dossier) => {
      const hache = copieLocale(dossier, 'humanoide--rigide--grande_hache');
      const baton = copieLocale(dossier, 'humanoide--rigide--baton');
      const locales = lireLocales([`humanoide--rigide--grande_hache=${hache}`, `humanoide--rigide--baton=${baton}`]);
      const attendus = TENUE.map((id) => (id === 'humanoide--rigide--grande_hache' ? hache : join(dossier, `${id}.glb`)));
      expect(await tenueDesGlb({ manifeste: join(dossier, 'humanoide.manifeste.json'), portee: porteeDeComposition(COMPOSITION), locales })).toEqual([...attendus, baton]);
      expect(() => lireLocales([`humanoide--rigide--baton=${baton}`, `humanoide--rigide--baton=${baton}`])).toThrow(/une fois par id/);
      expect(() => lireLocales([`humanoide--rigide--epee=${baton}`])).toThrow(/attendu humanoide--rigide--epee\.glb à côté/);
    });
  }, 180_000);

  it('refuse une paire --local sans GLB', () => {
    expect(() => lireLocales(['humanoide--rigide--epee'])).toThrow(/attendu <id>=<glb>/);
    expect(() => lireLocales(['humanoide--rigide--epee=/nulle/part/humanoide--rigide--epee.glb'])).toThrow(/attendu humanoide--rigide--epee\.glb à côté/);
  });
});
