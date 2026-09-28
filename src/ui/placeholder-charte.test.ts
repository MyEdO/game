import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { detenteur } from '../detenteur.testkit';

/**
 * Le TEXTE FANTÔME d'un champ de saisie (consigne, ou valeur effective héritée quand le champ est
 * vide — `NumberField` de Pente/Comble de l'inspecteur) se distingue AU COUP D'ŒIL d'une valeur
 * saisie : encre atténuée `--muted`, jamais l'encre `--text`. La règle est UNIQUE et
 * globale (`styles/base.css`) — aucun écran ne la redéclare.
 *
 * jsdom ne calcule pas les pseudo-éléments (`getComputedStyle(el, '::placeholder')` y rend le style
 * de l'élément) : la couleur RENDUE se mesure au navigateur (recette #1715 b), ce banc verrouille
 * l'UNICITÉ de la règle et son TOKEN.
 */
const STYLES = 'src/ui/styles';
const feuilles = detenteur(() =>
  readCorpus([STYLES], { exts: ['.css'] }).map(({ rel, text }) => ({
    nom: rel.slice(STYLES.length + 1),
    css: text,
  })),
);

describe('charte — texte fantôme des champs de saisie', () => {
  it('base.css pose la règle globale input/textarea en encre atténuée', () => {
    const base = feuilles().find((f) => f.nom === 'base.css')?.css ?? '';
    const regle = /input::placeholder,\s*\ntextarea::placeholder\s*\{([^}]*)\}/.exec(base)?.[1];
    expect(regle, 'la règle globale ::placeholder existe dans base.css').toBeTruthy();
    expect(regle).toMatch(/color:\s*var\(--muted\)/);
    expect(regle, 'l’encre du fantôme n’est pas celle d’une valeur posée').not.toMatch(/var\(--text\)/);
  });

  it('aucune autre feuille ne redéclare ::placeholder', () => {
    const autres = feuilles().filter((f) => f.nom !== 'base.css' && f.css.includes('::placeholder'));
    expect(autres.map((f) => f.nom)).toEqual([]);
  });
});
