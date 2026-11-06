import { describe, it, expect } from 'vitest';
import { roofMaterial } from './index';
import { matieresDe } from '../../../data';
import { MISSING_ID, MISSING_TONE } from '../../../noyau/monde/volume/missing';

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

  it('les matériaux de couverture portent liseré + recette de rangs (consommés par builder + backend)', () => {
    for (const id of ['tuile', 'chaume', 'toit-ardoise']) {
      const m = roofMaterial(id);
      expect(m.line, id).toBeTruthy();
      expect(m.detail?.courses?.hM ?? 0, id).toBeGreaterThan(0); // pas métrique des rangs (source unique)
      expect(m.detail?.courses?.joint, id).toBeTruthy(); // couleur des rangs
    }
    // Bardeaux (blocs décalés nuancés) sur les couvertures rigides ; rangs ORGANIQUES sur le chaume.
    expect(roofMaterial('tuile').detail?.courses?.blockWM).toBeDefined();
    expect(roofMaterial('toit-ardoise').detail?.courses?.blockWM).toBeDefined();
    expect(roofMaterial('chaume').detail?.courses?.blockWM).toBeUndefined();
    expect(roofMaterial('chaume').detail?.courses?.edgeWobble ?? 0).toBeGreaterThan(0);
    expect(roofMaterial('chaume').detail?.tufts).toBeDefined(); // balayage de paille
  });

  it('avant-toit (VOLUME) : débord + soffite sur les 3 couvertures ; fascia dure sauf chaume ; couronnement tuile/ardoise', () => {
    for (const id of ['tuile', 'chaume', 'toit-ardoise']) {
      const m = roofMaterial(id);
      expect(m.eaveOverhangM ?? 0, id).toBeGreaterThan(0); // le toit déborde des murs
      expect(m.soffite, id).toBeTruthy(); // ton du dessous ombré
    }
    // Chaume = bord arrondi : PAS de fascia dure ni de couronnement de faîte (crête molle).
    expect(roofMaterial('chaume').fasciaDropM).toBeUndefined();
    expect(roofMaterial('chaume').fascia).toBeUndefined();
    expect(roofMaterial('chaume').ridgeCap).toBeUndefined();
    // Tuile & ardoise : fascia dure (planche de rive) + couronnement de faîte.
    for (const id of ['tuile', 'toit-ardoise']) {
      expect(roofMaterial(id).fasciaDropM ?? 0, id).toBeGreaterThan(0);
      expect(roofMaterial(id).fascia, id).toBeTruthy();
      expect(roofMaterial(id).ridgeCap, id).toBeTruthy();
    }
  });

  it('plan vu du dessus (vue carrée)', () => {
    expect(roofMaterial('plan').planBody).toBe('#6e4f3a');
    expect(roofMaterial('plan').planEdge).toBe('#241a12');
  });

  it('id absent du registre → entrée de REPLI VISIBLE au ton d’alarme (#877)', () => {
    const missing = roofMaterial('inconnu');
    expect(missing.id).toBe(MISSING_ID);
    expect([missing.N, missing.E, missing.S, missing.O]).toEqual([MISSING_TONE, MISSING_TONE, MISSING_TONE, MISSING_TONE]);
    expect(matieresDe('roof').map((m) => m.id)).not.toContain(MISSING_ID); // hors registre : jamais posable
  });
});
