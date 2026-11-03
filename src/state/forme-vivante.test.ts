/**
 * `validerFormeVivante` (#2001, `data/schemas/validate.ts`), côté web : la modale « Avancé » de l'éditeur
 * (`lireBlocsAvances`) passe la même porte. Ses trois sites du noyau se jouent en
 * `src/noyau/forme-vivante.hors-store.test.ts`.
 */
import { describe, it, expect } from 'vitest';
import { lireBlocsAvances } from '../ui/editor/Editor';
import type { DescRef } from '../data/schemas/grammaire/valeurs';

const DESC_REF = {
  book: 'ennemi-dans-l-ombre',
  ch: '01',
  parts: [{ kind: 'blocs', sec: 'le-proprietaire', secOcc: 2, b0: 0, b1: 0, sum: '38e48aee36c04e9f' }],
} satisfies DescRef;
const TEXTE = 'Le propriétaire essuie un gobelet.';
const MATERIALISE = { desc: TEXTE, descRef: DESC_REF };


describe('la modale « Avancé » (`lireBlocsAvances`), la même porte', () => {
  const blocs = (noeud: Record<string, unknown>) => ({ dialogues: [{ id: 'dlg', start: 'n1', nodes: [{ id: 'n1', choices: [], ...noeud }] }] });

  it('P1 : un nœud adressé MATÉRIALISÉ (la forme de l’éditeur) fait l’aller-retour, son texte gardé', () => {
    const porte = lireBlocsAvances(blocs(MATERIALISE));
    expect(porte.ok).toBe(true);
    expect(porte.ok && porte.lu.dialogues?.[0].nodes[0]).toMatchObject(MATERIALISE);
  });

  it('P2 : la forme DISQUE (adresse sans texte) est refusée, au chemin du nœud', () => {
    const porte = lireBlocsAvances(blocs({ descRef: DESC_REF }));
    expect(porte.ok).toBe(false);
    expect(porte.ok ? '' : porte.rapport).toContain('passage adressé sans son texte.');
  });
});
