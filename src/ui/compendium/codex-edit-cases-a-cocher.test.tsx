// @vitest-environment jsdom
// #1792 ; src/ui/styles/base.css ; src/ui/ui-ratchets.test.ts
import { readFileSync } from 'node:fs';
import { describe, it, expect, afterEach } from 'vitest';

const CSS = (f: string) => readFileSync(`src/ui/styles/${f}`, 'utf8');
const STYLES = readFileSync('src/ui/styles.css', 'utf8');
/** Les feuilles dans l'ordre de cascade de `styles.css`. */
const FEUILLES = [...STYLES.matchAll(/@import '\.\/styles\/([^']+)'/g)].map((m) => m[1]);
const styles: HTMLStyleElement[] = [];
let host: HTMLDivElement | null = null;

function retirerFeuilles() {
  for (const style of styles.splice(0)) style.remove();
}

function poseMarkup(markup: string): HTMLDivElement {
  host?.remove();
  host = document.createElement('div');
  host.innerHTML = markup;
  document.body.appendChild(host);
  return host;
}

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
  retirerFeuilles();
  for (const f of fichiers) {
    const style = document.createElement('style');
    style.textContent = CSS(f);
    document.head.appendChild(style);
    styles.push(style);
  }
}

/** Markup réel des deux sites : case de l'atelier du Codex (`Field`, `kind === 'checkbox'`) et
 *  case courte de l'éditeur d'op (`GameOpEditor`, `<label class="dr">`). */
const SITES: Record<string, string> = {
  'codex-edit .ed-check': '<div class="codex-edit-form"><label class="ed-check"><input type="checkbox" /><span>Maison</span></label></div>',
  'atelier .dr': '<div class="row"><label class="dr"><input type="checkbox" /> chaque Round</label></div>',
};
function poseUneCase(site: keyof typeof SITES): HTMLInputElement {
  return poseMarkup(SITES[site]).querySelector('input[type="checkbox"]') as HTMLInputElement;
}

afterEach(() => {
  host?.remove();
  host = null;
  retirerFeuilles();
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
    const conteneur = poseMarkup('<div class="codex-edit-form"><label class="ed-field"><span>Libellé</span><input /></label></div>');
    const texte = conteneur.querySelector('.ed-field input') as HTMLInputElement;
    expect(getComputedStyle(texte).width).toBe('100%');
  });
});
