/**
 * #1466 L1a T4 — l'atelier affiche un LIBELLÉ, plus la clé technique brute : le CANAL atelier→picker de réf
 * (`RefField` reçoit le libellé, pas la clé) et le nœud que `CodexEdit` passe à chaque `GenericArrayField`.
 * La cascade du libellé, le canal registre→atelier et la convention d'export :
 * `src/noyau/codex/libelles-de-champs.hors-store.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { inferFields } from '../../noyau/codex/editFields';
import { RefField, refFieldCfg } from './refField/RefField';
import { editableEntries, isEditableCategory } from '../../data/atelierDuCodex';
import { CODEX } from '../../noyau/codex/registry';
import { metaPourFichier } from '../../data/schemas/validate';

describe('canal atelier → picker de référence (`RefField`)', () => {
  it('un champ à config REF affiche le LIBELLÉ reçu, jamais sa clé technique', () => {
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'qualityTypes', single: true }} fieldKey="type" label="Type de document" value="" onChange={() => {}} />);
    expect(html).toContain('Type de document');
    expect(html).not.toContain('<span>type<');
  });

  it('sans libellé, le picker retombe sur la clé (appelants qui ne connaissent que la clé)', () => {
    const html = renderToStaticMarkup(<RefField cfg={{ ds: 'qualityTypes', single: true }} fieldKey="subType" value="" onChange={() => {}} />);
    expect(html).toContain('subType');
  });

  /**
   * BUG de recette (2026-08-26) : la config de `skills.characteristic` peuplait ses options par
   * `abr` alors que `skills.json` stocke l'`id` — le select rendait « dexterite (inconnu) » sur une
   * donnée VALIDE, et les 7 `abr` vides collidaient en une même clé React.
   */
  it('`skills.characteristic` : la valeur STOCKÉE est une option, et les clés d’option sont uniques', () => {
    const skills = editableEntries('skills') as Record<string, unknown>[];
    const stockees = [...new Set(skills.map((s) => String(s.characteristic ?? '')))].filter(Boolean);
    expect(stockees.length, 'la population `characteristic` a disparu de skills.json').toBeGreaterThan(0);
    const cfg = refFieldCfg('skills', 'characteristic')!;
    for (const v of stockees) {
      const html = renderToStaticMarkup(<RefField cfg={cfg} fieldKey="characteristic" label="Caractéristique" value={v} onChange={() => {}} />);
      expect(html, `valeur stockée « ${v} » rendue « (inconnu) » — la config du select ne parle pas la langue de la donnée`).not.toContain('(inconnu)');
      expect(html).toContain(`value="${v}"`);
    }
    const valeursDOption = [...renderToStaticMarkup(<RefField cfg={cfg} fieldKey="characteristic" label="Caractéristique" value={stockees[0]} onChange={() => {}} />).matchAll(/<option value="([^"]*)"/g)].map((m) => m[1]);
    const doublons = valeursDOption.filter((v, i) => valeursDOption.indexOf(v) !== i);
    expect(doublons, `clés d’option dupliquées (warning React « same key ») : ${doublons.join(', ')}`).toEqual([]);
  });

  it('les champs à config REF des catégories réelles sont bien porteurs d’un libellé (même projection que `CodexEdit`)', () => {
    const refs = CODEX.filter((c) => isEditableCategory(c.key)).flatMap((c) =>
      inferFields(editableEntries(c.key) as Record<string, unknown>[], { meta: metaPourFichier(`${c.key}.json`) })
        .filter((f) => refFieldCfg(c.key, f.key))
        .map((f) => ({ cat: c.key, key: f.key, label: f.label })),
    );
    expect(refs.length, 'aucun champ à config REF trouvé — la projection a changé de forme').toBeGreaterThan(0);
    const nus = refs.filter((r) => !r.label);
    expect(nus, `champ REF sans libellé : ${nus.map((r) => `${r.cat}.${r.key}`).join(', ')}`).toEqual([]);
  });
});

describe('atelier — le nœud de chaque champ dédié', () => {
  it('chaque `GenericArrayField` dédié de tableau d’objets reçoit le nœud de SON champ', () => {
    const src = readFileSync(join(process.cwd(), 'src/ui/editor/codex/CodexEdit.tsx'), 'utf8');
    const balises = src.match(/<GenericArrayField\b[\s\S]*?\/>/g) ?? [];
    expect(balises.length, 'le matcher voit les balises du fichier').toBeGreaterThan(20);
    const sansNoeud: string[] = [];
    for (const balise of balises) {
      const champ = /value=\{entry\.([A-Za-z_$][\w$]*)\b/.exec(balise)?.[1];
      if (!champ) continue;
      if (!balise.includes(`noeud={noeudDe('${champ}')}`)) sansNoeud.push(champ);
    }
    expect(sansNoeud, 'ces champs dédiés rendraient un select ANONYME en profondeur').toEqual([]);
  });
});
