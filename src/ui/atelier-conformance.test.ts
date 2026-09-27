import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { echapperRegex } from '../lib/regex';

/**
 * Garde de MATIÈRE (#414) — la primitive `.modal` (components.css)
 * porte la peau « Atelier du scribe » (planche ratifiée de la fiche, `.sheet-modal`) : halo or
 * radial en tête + dégradé bois chaud, bandeau or 4px, bordures chaudes, ombre profonde. jsdom ne
 * calcule pas la cascade des fichiers CSS externes (pas de `<link>` chargé) — on parse donc le bloc
 * `.modal` SOURCE, comme `ui-ratchets`/`component-conformance`, plutôt que de monter du DOM.
 * Cliquet : si `.modal` retombe à l'aplat (`background: var(--panel)` nu, sans bandeau), la CI rougit.
 */

const COMPONENTS = fileURLToPath(new URL('./styles/components.css', import.meta.url));
const css = readFileSync(COMPONENTS, 'utf8');

/** Isole le bloc `{...}` d'un sélecteur EXACT (ex. `.modal {`) — pas `.modal.wide`/`.modal-overlay`. */
function ruleBlock(src: string, selector: string): string {
  const re = new RegExp(`(?:^|\\n)${echapperRegex(selector)}\\s*\\{`);
  const m = re.exec(src);
  if (!m) throw new Error(`sélecteur introuvable : ${selector}`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
  }
  return src.slice(start, i - 1);
}

describe('#414 — garde de matière « Atelier du scribe » (.modal)', () => {
  const modal = ruleBlock(css, '.modal');

  it('dégradé composé (halo or radial + dégradé linéaire bois), pas un aplat', () => {
    expect(modal).toMatch(/radial-gradient\(/);
    expect(modal).toMatch(/linear-gradient\(/);
    expect(modal).not.toMatch(/background:\s*var\(--panel\)\s*;/);
  });

  it('bandeau or 4px en tête (`.sheet-modal` ne le redéclare pas — cf. sheet.css)', () => {
    expect(modal).toMatch(/border-top:\s*4px solid var\(--gold\)/);
  });

  it('bordures latérales/basse chaudes (famille `--atelier-wood-*`, pas `--border` générique)', () => {
    expect(modal).toMatch(/border:\s*1px solid var\(--atelier-wood-liseret\)/);
  });

  it('ombre profonde (pas de modale plate)', () => {
    expect(modal).toMatch(/box-shadow:\s*[^;]*rgba\(0, 0, 0,/);
    expect(modal).not.toMatch(/box-shadow:\s*none/);
  });

  it('référence — `.panel` (autre primitive de surface) reste sur ses tokens gravés (non-régression)', () => {
    const panel = ruleBlock(css, '.panel');
    expect(panel).toMatch(/linear-gradient\(/);
    expect(panel).toMatch(/var\(--border\)/);
  });
});
