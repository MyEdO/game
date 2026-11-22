import { describe, it, expect } from 'vitest';
import { roofMaterial } from './matieres';
import { matieresDe } from '../../../data';
import { MISSING_ID, MISSING_TONE } from './missing';

// Le couplage donnée → rendu (teintes par pan, liseré, rangs) est testé côté backend
// (`authoring/roofsSvg.test.ts`) ; ici, la DONNÉE seule.
describe('apparence de toit (JSON pur iso/plan)', () => {
  it('les 4 matériaux sont présents', () => {
    const ids = matieresDe('roof').map((m) => m.id).sort();
    expect(ids).toEqual(['chaume', 'plan', 'toit-ardoise', 'tuile']);
  });

  it('résolution par id + teintes de couverture', () => {
    expect(roofMaterial('tuile').N).toBe('#a04836');
    expect(roofMaterial('chaume').N).toBe('#b0904a');
    expect(roofMaterial('toit-ardoise').N).toBe('#63727f');
  });

  it('la COUVERTURE est une DONNÉE : les 3 matériaux de pan la déclarent, le plan vu du dessus ne la porte pas', () => {
    expect(matieresDe('roof').filter((m) => m.couverture).map((m) => m.id).sort()).toEqual(['chaume', 'toit-ardoise', 'tuile']);
    expect(roofMaterial('plan').couverture).toBeUndefined();
  });

  it('les matériaux de couverture portent leur liseré (repli de la planche de rive)', () => {
    for (const id of ['tuile', 'chaume', 'toit-ardoise']) expect(roofMaterial(id).line, id).toBeTruthy();
  });

  it('avant-toit (VOLUME) : débord + soffite et faîtière sur les 3 couvertures ; fascia dure sauf chaume', () => {
    for (const id of ['tuile', 'chaume', 'toit-ardoise']) {
      const m = roofMaterial(id);
      expect(m.eaveOverhangM ?? 0, id).toBeGreaterThan(0); // le toit déborde des murs
      expect(m.soffite, id).toBeTruthy(); // ton du dessous ombré
    }
    // Chaume = bord arrondi : PAS de fascia dure.
    expect(roofMaterial('chaume').fasciaDropM).toBeUndefined();
    expect(roofMaterial('chaume').fascia).toBeUndefined();
    // Tuile & ardoise : fascia dure (planche de rive).
    for (const id of ['tuile', 'toit-ardoise']) {
      expect(roofMaterial(id).fasciaDropM ?? 0, id).toBeGreaterThan(0);
      expect(roofMaterial(id).fascia, id).toBeTruthy();
    }
  });

  it('chaque couverture nomme la famille du kit de sa faîtière et sa teinte (#4471)', () => {
    for (const m of matieresDe('roof').filter((x) => x.couverture)) {
      expect(m.kit, m.id).toBeTruthy();
      expect(m.ridgeCap, m.id).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('id absent du registre → entrée de REPLI VISIBLE au ton d’alarme (#877)', () => {
    const missing = roofMaterial('inconnu');
    expect(missing.id).toBe(MISSING_ID);
    expect([missing.N, missing.E, missing.S, missing.O]).toEqual([MISSING_TONE, MISSING_TONE, MISSING_TONE, MISSING_TONE]);
    expect(matieresDe('roof').map((m) => m.id)).not.toContain(MISSING_ID); // hors registre : jamais posable
  });
});
