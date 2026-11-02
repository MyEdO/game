import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import knight from '../projet/modeles/Knight.manifeste.json';
import { lireMontage, type ManifesteMontable, type Montage } from '../asset/montage';
import { indexDesApparences, premierModele } from './equipement';
import { lexemesGdscript } from '../../../scripts/guards/lib/gdscript.mjs';

const manifeste = knight as unknown as ManifesteMontable;
const MASQUER: keyof Montage = 'masquer';

/** Le corps de la fonction `nom` du script GDScript `src` : son code (`lexemesGdscript`) et ses chaînes. */
function corpsDeFonction(src: string, nom: string): { code: string; chaines: string[] } {
  const { code, chaines } = lexemesGdscript(src);
  const lignes = code.split('\n');
  const debut = lignes.findIndex((l) => l.startsWith(`func ${nom}(`));
  const fin = lignes.findIndex((l, i) => i > debut && /^\S/.test(l));
  return {
    code: debut < 0 ? '' : lignes.slice(debut, fin < 0 ? undefined : fin).join('\n'),
    chaines: chaines.filter(({ ligne }) => debut >= 0 && ligne > debut && (fin < 0 || ligne <= fin)).map(({ texte }) => texte),
  };
}

describe('boucliers du Knight', () => {
  it('le bouclier rond garde un seul composant prioritaire parmi les géométries de la même apparence', () => {
    const choix = premierModele(['rond'], indexDesApparences([manifeste]), { emplacement: 'tenues', main: 'off' });
    expect(choix).toEqual({
      apparence: 'rond',
      composants: [{ modele: 'Knight.glb', composant: 'bouclier_rond', pieces: ['Round_Shield'] }],
    });
  });

  it('le montage lu transmet le masquage de l’écu', () => {
    const { montage, erreurs } = lireMontage(knight.montage);
    expect(erreurs).toEqual([]);
    expect(montage?.[MASQUER]).toContain('Badge_Shield');
  });

  it('`masquer_armes` masque les nœuds de `montage.masquer`', () => {
    const corps = corpsDeFonction(readFileSync(new URL('../projet/scripts/montage_equipement.gd', import.meta.url), 'utf8'), 'masquer_armes');
    expect(corps.code, 'témoin : la fonction est lue').toContain('func masquer_armes(');
    expect(corps.code).toMatch(/\bmontage\.get\(/);
    expect(corps.chaines).toContain(MASQUER);
  });
});
