import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { declarations, reglesCss } from '../../scripts/guards/lib/cssCouches.mjs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

/**
 * #1993 F3 — l'état INVALIDE d'un champ (`aria-invalid="true"`, posé par NumberField, RefField,
 * SourceRefField, les clés de record du Codex…) a UN style, sur la peau de champ de la charte
 * (`base.css`) : sans lui, une page refusée garde le filet de l'état valide et le bandeau qui
 * renvoie au « champ signalé » ne désigne rien. Le rendu au pixel se prouve au kit CDP.
 */
const CIBLES = ["input[aria-invalid='true']", "select[aria-invalid='true']", "textarea[aria-invalid='true']"];
/** Ce qui NOMME un état invalide de CHAMP : l'attribut, la pseudo-classe, une classe `…invalid…`, ou une
 *  classe d'erreur posée sur le contrôle lui-même. Un message d'erreur (`.save-error`) n'est pas un champ. */
const ETAT_INVALIDE = /invalid|(?:input|select|textarea)\S*[.-](?:err|erreur|error)\b/i;

describe('état invalide d’un champ — un style canonique', () => {
  it('la peau de champ de `base.css` marque input, select et textarea `aria-invalid` du filet d’alerte', () => {
    const regles = reglesCss(readFileSync(new URL('./styles/base.css', import.meta.url), 'utf8'))
      .filter((r) => r.media === null);
    for (const cible of CIBLES) {
      const decl = regles.filter((r) => r.selecteurs.includes(cible)).flatMap((r) => declarations(r.corps));
      expect(decl.find((d) => d.prop === 'border-color')?.valeur, cible).toBe('var(--danger)');
    }
  });

  it('aucun autre module ne redéclare l’état invalide, ni par l’attribut ni par une classe', () => {
    const ailleurs: string[] = [];
    for (const { rel, text } of readCorpus(['src/ui'], { exts: ['.css'] })) {
      if (rel.endsWith('/styles/base.css')) continue;
      for (const r of reglesCss(text)) {
        for (const s of r.selecteurs) if (ETAT_INVALIDE.test(s)) ailleurs.push(`${rel} : ${s}`);
      }
    }
    expect(ailleurs).toEqual([]);
  });

  it('aucun composant ne pose l’état invalide par une classe conditionnelle : il pose `aria-invalid`', () => {
    const classes: string[] = [];
    for (const { rel, text } of readCorpus(['src/ui'], { exts: ['.tsx'] })) {
      for (const m of text.matchAll(/className=\{[^}]*\?[^}]*\}/g)) if (ETAT_INVALIDE.test(m[0])) classes.push(`${rel} : ${m[0]}`);
    }
    expect(classes).toEqual([]);
  });
});
