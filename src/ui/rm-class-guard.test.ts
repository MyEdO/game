import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../detenteur.testkit';

/**
 * Garde STRUCTURELLE (#1117) — une classe `rm-*` posée dans le markup DOIT avoir une règle CSS.
 * Une classe sans règle ne fait rien : soit le style manque (le rendu ment sur son intention),
 * soit le `className` est mort. Les deux se corrigent, aucun ne se tolère.
 */
const css = detenteur(() => readCorpus(['src'], { exts: ['.css'], tests: true }).map(({ text }) => text).join('\n'));

describe('classes rm-* — aucune classe fantôme', () => {
  const used = new Map<string, string>();
  for (const { rel, text } of readCorpus(['src'])) {
    for (const m of text.matchAll(/className="([^"{}]+)"/g))
      for (const c of m[1].split(/\s+/)) if (c.startsWith('rm-') && !used.has(c)) used.set(c, rel);
  }

  it('le balayage VOIT une classe qu’on sait posée (la garde ne peut pas être vide par accident)', () => {
    expect(used.get('rm-range')).toBe('src/ui/OptionChooser.tsx');
  });

  /** Recherche SANS regex construite : un sélecteur `.classe` suivi d'un caractère qui termine le nom. */
  const hasRule = (cls: string): boolean => {
    const needle = `.${cls}`;
    const feuilles = css();
    for (let i = feuilles.indexOf(needle); i >= 0; i = feuilles.indexOf(needle, i + 1)) {
      const next = feuilles[i + needle.length] ?? ' ';
      if (!/[-\w]/.test(next)) return true;
    }
    return false;
  };

  it('chaque classe rm-* utilisée porte au moins une règle CSS', () => {
    const phantom = [...used].filter(([c]) => !hasRule(c));
    expect(phantom.map(([c, f]) => `${c} (${f})`)).toEqual([]);
  });

  it('la recherche de règle est FERMÉE : un préfixe plus long ne compte pas', () => {
    expect(hasRule('rm-options')).toBe(true);
    expect(hasRule('rm-optio')).toBe(false);
  });
});
