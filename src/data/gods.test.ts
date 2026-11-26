import { describe, it, expect } from 'vitest';
import { gods, cultIds, blessingsOf, miraclesOf, findGodById, godLabel } from './index';
import { slugId } from './schemas/slug';

/** Invariants STRUCTURELS du dataset (pas de longueurs figées : la donnée est éditable au Codex).
 *  Deux familles d'entrées : cultes À PRIÈRES (LDB 41-42 + NADJ — six Bénédictions chacun) et fiches
 *  de SAVEUR (dieux nains/elfes/halflings LDB 36-39, provinciaux LDB 24, Puissances de la Ruine) —
 *  « sans Bénédictions ni Miracles » (LDB 37 l.17 ; LDB 36 l.9). */
describe('Cultes (dataset gods.json, façade data, éditable au Codex)', () => {
  it('id/label : ids uniques slugifiés, label présent, desc non vide, source présente', () => {
    expect(new Set(gods.map((g) => g.id)).size).toBe(gods.length);
    for (const g of gods) {
      expect(g.id, g.label).toBe(slugId(g.label)); // id = slug du label (convention id/label commune)
      expect(g.label, g.id).toBeTruthy();
      if (g.desc != null) expect(g.desc, g.id).toBeTruthy(); // desc OPTIONNELLE (GodData.desc?) — non vide si présente
      expect(g.source?.book, g.id).toBeTruthy();
      expect(g.source?.page, g.id).toBeGreaterThan(0);
    }
  });
  it('cultes à Miracles = cultes à prières : six Bénédictions chacun (LDB 41 « reçoit les SIX »)', () => {
    for (const g of gods.filter((x) => x.miracles.length > 0)) expect(g.blessings, g.id).toHaveLength(6);
  });
  it('fiches de saveur : 0 Bénédiction ET 0 Miracle (LDB 37 l.17 / 36 l.9) — et il en existe', () => {
    const flavor = gods.filter((g) => g.blessings.length === 0);
    expect(flavor.length).toBeGreaterThan(0);
    for (const g of flavor) expect(g.miracles, g.id).toHaveLength(0);
  });
  it('cultIds() = cultes à Bénédictions SEULEMENT (choix « Béni (Au choix) » dérivé de la donnée)', () => {
    expect(cultIds()).toEqual(gods.filter((g) => g.blessings.length > 0).map((g) => g.id).sort());
    expect(cultIds()).toContain('sigmar');
    expect(cultIds()).toContain('evawn'); // NADJ : dieux gnomes à prières
    expect(cultIds()).not.toContain('khorne'); // Puissance de la Ruine = saveur
    expect(cultIds()).not.toContain('grungni'); // dieu ancêtre nain = saveur
  });
  it('blessingsOf/miraclesOf = IDS de sort (le runtime compare par id) ; culte inconnu → []', () => {
    expect(blessingsOf('sigmar')).toContain('benediction-de-protection');
    expect(miraclesOf('sigmar')).toContain('marteau-ardent-de-sigmar'); // LDB : sort d'Invocation (id)
    expect(miraclesOf('evawn')).toContain('invitation'); // NADJ : colonne god (id)
    expect(blessingsOf('khaine')).toEqual([]); // fiche de saveur : culte CONNU, 0 Bénédiction
    expect(blessingsOf('inexistant-xyz')).toEqual([]);
    expect(findGodById('sigmar')?.title).toBeTruthy();
    expect(godLabel('sigmar')).toBe('Sigmar'); // id → libellé affiché
    expect(godLabel('deesse-araignee')).toBe('Déesse-Araignée');
    expect(godLabel('inexistant-xyz')).toBe('inexistant-xyz'); // id inconnu → l'id
  });
});
