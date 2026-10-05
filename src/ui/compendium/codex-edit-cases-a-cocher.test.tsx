// @vitest-environment jsdom
/**
 * CHARTE : une case à cocher est un CARRÉ de 18 px (charbon bordé, marque or) — `base.css`, boîte
 * `!important` (#1792). Deux nappes de module l'attrapaient à spécificité égale, importées APRÈS
 * base.css par `styles.css` : `.codex-edit-form input { width: 100% }` (barres pleine largeur, constat
 * de recette 2026-08-26) et `.dr input { width: 44px }` (rectangles plats de l'atelier, #1792).
 *
 * Ce test rejoue la CASCADE RÉELLE : TOUTES les feuilles du dépôt, injectées dans l'ordre de leurs
 * `@import` dans `styles.css`, sur le markup réel des deux sites. La boîte attendue est LUE dans
 * `base.css`, jamais écrite en dur. La garde statique de la classe (toute propriété de boîte posée par
 * un module sur un `input` non typé) vit dans `src/ui/ui-ratchets.test.ts` (xx).
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';

const CSS = (f: string) => readFileSync(`src/ui/styles/${f}`, 'utf8');
const STYLES = readFileSync('src/ui/styles.css', 'utf8');
/** Les feuilles dans l'ordre de cascade de `styles.css`. */
const FEUILLES = [...STYLES.matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1]);

/** Boîte DÉCLARÉE par la charte (bloc case/radio de base.css), valeurs calculées attendues. */
function boiteDeLaCharte(): { width: string; height: string } {
  const sans = CSS('base.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const bloc = [...sans.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(
    (m) => /\[type=["']checkbox["']\]/.test(m[1]) && /\[type=["']radio["']\]/.test(m[1]),
  );
  expect(bloc, 'le bloc de charte des cases a disparu de base.css').toBeTruthy();
  const lit = (prop: string) => {
    const m = bloc![2].match(new RegExp(`(?:^|;)\\s*${prop}:\\s*([^;]+);`));
    expect(m, `la charte ne déclare plus de \`${prop}\` pour les cases`).toBeTruthy();
    return m![1].replace(/\s*!important\s*$/, '').trim();
  };
  return { width: lit('width'), height: lit('height') };
}

function poseLesFeuilles(fichiers: string[]) {
  document.head.innerHTML = '';
  for (const f of fichiers) {
    const style = document.createElement('style');
    style.textContent = CSS(f);
    document.head.appendChild(style);
  }
}

/** Markup réel des deux sites : case de l'atelier du Codex (`Field`, `kind === 'checkbox'`) et
 *  case courte de l'éditeur d'op (`GameOpEditor`, `<label class="dr">`). */
const SITES: Record<string, string> = {
  'codex-edit .ed-check': '<div class="codex-edit-form"><label class="ed-check"><input type="checkbox" /><span>Maison</span></label></div>',
  'atelier .dr': '<div class="row"><label class="dr"><input type="checkbox" /> chaque Round</label></div>',
};
function poseUneCase(site: keyof typeof SITES): HTMLInputElement {
  document.body.innerHTML = SITES[site];
  return document.querySelector('input[type="checkbox"]') as HTMLInputElement;
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe('cases à cocher — la boîte de la charte tient contre TOUTES les feuilles', () => {
  it('l’ordre de cascade lu dans styles.css commence par base.css', () => {
    expect(FEUILLES[0]).toBe('base.css');
    expect(FEUILLES.length).toBeGreaterThan(1);
  });

  it('la charte SEULE donne la case carrée (référence de la mesure)', () => {
    poseLesFeuilles(['base.css']);
    const boite = boiteDeLaCharte();
    const css = getComputedStyle(poseUneCase('codex-edit .ed-check'));
    expect({ width: css.width, height: css.height }).toEqual(boite);
  });

  for (const site of Object.keys(SITES)) {
    it(`avec TOUTES les feuilles par-dessus, la case « ${site} » garde la boîte de la charte`, () => {
      poseLesFeuilles(FEUILLES);
      const boite = boiteDeLaCharte();
      const css = getComputedStyle(poseUneCase(site));
      expect(
        { width: css.width, height: css.height, paddingLeft: css.paddingLeft },
        `une nappe de module a repris la case « ${site} » — la boîte de la charte n’est plus immune (#1792)`,
      ).toEqual({ ...boite, paddingLeft: '0px' });
    });
  }

  it('les VRAIES saisies de l’atelier gardent, elles, la pleine largeur', () => {
    poseLesFeuilles(FEUILLES);
    document.body.innerHTML = '<div class="codex-edit-form"><label class="ed-field"><span>Libellé</span><input /></label></div>';
    const texte = document.querySelector('.ed-field input') as HTMLInputElement;
    expect(getComputedStyle(texte).width).toBe('100%');
  });
});
