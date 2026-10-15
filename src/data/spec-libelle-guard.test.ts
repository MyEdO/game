import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitesSpecLibelle } from '../../scripts/guards/lib/specLibelle.mjs';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { skills, talents } from '.';

/**
 * Garde « spécialisation écrite en LIBELLÉ » (#1595, JS §3 ; doctrine `user-doctrine-ids-stables-labels-affichage`) :
 * une fixture `{ id: 'metier', spec: 'Cartographe' }` ne désigne pas Métier (Cartographe) — le moteur la lit
 * par id (`cartographe`) — et le test qui la lit passe par accident. Corpus : tout `src/`, tests compris.
 * Stock : ZÉRO. Exemption AU SITE (`fichier#id:spec`), chacune jugée par sa raison.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const EXEMPTIONS: Record<string, string> = {
  'src/data/schemas/grammaire/grammaire.test.ts#sens-aiguise:Ouïe': 'contre-épreuve : la grammaire REFUSE une spécialisation arrêtée en libellé',
};

const catalogue = new Map<string, { id: string; label: string }[]>();
for (const e of [...skills, ...talents] as { id: string; specs?: unknown }[]) {
  if (Array.isArray(e.specs)) catalogue.set(e.id, [...(catalogue.get(e.id) ?? []), ...(e.specs as { id: string; label: string }[])]);
}

describe('garde « spécialisation écrite en libellé »', () => {
  it('INVENTAIRE : aucune spécialisation en libellé dans src/, hors exemption au site', { timeout: 120_000 }, () => {
    const fichiers = listerArbre(join(ROOT, 'src'), { filtre: (rel: string) => /\.tsx?$/.test(rel) })
      .map((rel: string) => ({ rel: `src/${rel}`, text: readFileSync(join(ROOT, 'src', rel), 'utf8') }))
      .filter((f: { text: string }) => /\bspec\b/.test(f.text));
    const sites = sitesSpecLibelle(fichiers, catalogue);
    const cle = (s: { rel: string; id: string; spec: string }) => `${s.rel}#${s.id}:${s.spec}`;
    const nus = sites.filter((s) => !(cle(s) in EXEMPTIONS)).map((s) => `${s.rel}:${s.ligne} ${s.id} spec='${s.spec}' → '${s.specId}'`);
    expect(nus, 'spécialisation en LIBELLÉ : écrire son id').toEqual([]);
    const perimees = Object.keys(EXEMPTIONS).filter((k) => !sites.some((s) => cle(s) === k));
    expect(perimees, 'exemption sans site').toEqual([]);
  });

  it('contre-épreuve : le libellé est vu, sur une ou plusieurs lignes ; l’id et le texte libre ne le sont pas', () => {
    const text = [
      "const a = { id: 'metier', spec: 'Cartographe', advances: 1 };",
      'const b = {',
      "  skill: 'metier',",
      "  spec: 'Cartographe',",
      '};',
      "const c = { id: 'metier', spec: 'cartographe' };",
      "const d = { id: 'savoir', spec: 'Plombiers du Reik' };",
    ].join('\n');
    expect(sitesSpecLibelle([{ rel: 'x.ts', text }], catalogue).map((s) => [s.ligne, s.specId])).toEqual([[1, 'cartographe'], [2, 'cartographe']]);
  });
});
