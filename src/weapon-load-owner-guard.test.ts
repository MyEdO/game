import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { alternationDe } from './lib/regex';

/**
 * GARDE STRUCTURELLE — PROPRIÉTAIRE UNIQUE de l'état de charge : charger une arme sélectionne sa munition,
 * et deux armes à distance gèrent chacune leur rechargement et leur munition (LDB 62 l.335 pour le Test
 * étendu, l.229/231 pour le chargeur À répétition).
 *
 * L'état de charge (`loaded`, `loadedAmmoUid`, `reloadProgress`, `chambered`, `ammoUid`) vit dans un
 * REGISTRE résolu par `engine/weaponLoad.loadRegister` (objet possédé > instance d'arme > pièce servie).
 * Une affectation DIRECTE hors des deux ÉCRIVAINS (`loadWeapon`/`unloadWeapon`, `engine/items.ts`) écrit
 * à côté du registre : l'état posé est perdu au prochain re-dérivage du set, ou reste sur un porteur que
 * personne ne relit.
 *
 * PÉRIMÈTRE : `src/**\/*.ts(x)` de PRODUCTION.
 * EXEMPTS, et pourquoi :
 *   - `src/engine/items.ts` (les écrivains) et `src/engine/weaponLoad.ts` (le résolveur de registre) ;
 *   - les fichiers de TEST (`*.test.ts(x)`) : une fixture CONSTRUIT un état initial, elle ne le mute pas
 *     en cours de partie — c'est l'angle mort assumé de cette garde.
 * ANGLES MORTS (énoncés, pas contournés) : une écriture via alias (`const reg = ...; reg.loaded = ...`)
 * n'est vue que si l'alias vient de `loadRegister` (autorisé) — un alias fabriqué autrement passerait ;
 * une écriture par index (`obj['loaded'] = …`) passerait aussi. Le scan est TEXTUEL (pas d'AST) : il
 * couvre la forme `x.champ = …`.
 */

/** Champs de l'état de charge — mêmes noms sur `Weapon`, `ItemInstance` et `ShipPoste`. */
export const LOAD_FIELDS = ['loaded', 'loadedAmmoUid', 'reloadProgress', 'chambered', 'ammoUid'] as const;

/** Fichiers de PRODUCTION exempts : les propriétaires de l'état de charge, et eux seuls. */
export const OWNER_FILES = ['src/engine/items.ts', 'src/engine/weaponLoad.ts'];

/** Une affectation directe `qqch.<champ> = …` (hors `==`/`===`/`=>`), commentaires de ligne exclus. */
export function loadWritesIn(rel: string, source: string): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  const re = new RegExp(String.raw`[\w\]\)]\s*\.\s*(${alternationDe(LOAD_FIELDS)})\s*=(?!=)`);
  source.split(/\r?\n/).forEach((raw, i) => {
    const code = raw.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (re.test(code)) hits.push({ file: rel, line: i + 1, text: raw.trim() });
  });
  return hits;
}

describe('PROPRIÉTAIRE UNIQUE de l’état de charge (verrou par construction)', () => {
  it('aucune affectation directe hors `loadWeapon`/`unloadWeapon` (le registre est le SEUL porteur)', () => {
    const found: { file: string; line: number; text: string }[] = [];
    for (const { rel, text } of readCorpus(['src'])) {
      if (OWNER_FILES.includes(rel)) continue;
      found.push(...loadWritesIn(rel, text));
    }
    expect(
      found.map((f) => `${f.file}:${f.line} ${f.text}`),
      'Écriture hors registre : passer par `loadWeapon`/`unloadWeapon` (engine/items.ts), ou écrire dans `loadRegister(c, arme)`.',
    ).toEqual([]);
  });

  it('le détecteur voit la forme réelle et ne crie pas sur une comparaison', () => {
    expect(loadWritesIn('x.ts', 'a.loaded = true;')).toHaveLength(1);
    expect(loadWritesIn('x.ts', 'c.weapons[0].reloadProgress = 0;')).toHaveLength(1);
    expect(loadWritesIn('x.ts', 'loadRegister(c, w).chambered = 3;')).toHaveLength(1); // écriture DANS le registre : vue aussi
    expect(loadWritesIn('x.ts', 'if (p.loaded === false) return;')).toEqual([]);
    expect(loadWritesIn('x.ts', 'const x = a.ammoUid ?? b.ammoUid;')).toEqual([]);
    expect(loadWritesIn('x.ts', '// a.loaded = true (exemple en commentaire)')).toEqual([]);
  });
});
