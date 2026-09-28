/**
 * Contrat du DÉTECTEUR de fuite des registres d'art (`rigArtRegistrySignatures`, src/test-setup.ts).
 *
 * Deux propriétés, mesurées ici plutôt que supposées :
 * 1. une mutation d'un registre d'art CASSE VRAIMENT le rendu des autres fichiers du worker
 *    (`isolate: false`) — on l'établit sur le chemin de prod du golden de combat ;
 * 2. le détecteur voit une SUBSTITUTION de valeur sous une clé existante (pas seulement un jeu de
 *    clés), et il voit les registres AUTRES que `ARMOUR`/`TENUE_BY_ID` (couverture structurelle).
 *
 * Toute mutation faite ici est reprise en `finally` : sinon l'`afterEach` global échouerait ICI.
 */
import { VIEWS } from './facing';
import { describe, it, expect } from 'vitest';
import { creatures } from '../../data';
import { creatureToCombatant } from '../../state/spawn';
import { enemyRigProfile } from './enemyProfile';
import { combatantAppearance, combatantOverlays } from './parts/combatantVisuals';
import { resolveRig } from './composeRig';
import { bonesToSvg } from './renderBones';
import { ARMOUR } from './parts/armour';
import { HAIRSTYLE_DEFS } from './parts/hairstyles';
import { rigArtRegistrySignatures } from '../../test-setup';

type Case = { name: string; render: () => string };

/** Les cas du golden de combat (`golden/creature-combat-render-golden.test.ts`), montés par le MÊME
 *  chemin de prod : spawn → `enemyRigProfile` → visuels d'état → SVG. */
const combatRenderCases = (): Case[] => {
  const out: Case[] = [];
  for (const cr of creatures) {
    const c = creatureToCombatant(cr, `g-${cr.label}`, { x: 0, y: 0 });
    const prof = enemyRigProfile(c);
    if (!prof) continue; // non-bipède → chemin plan, hors périmètre du golden de combat
    for (const view of VIEWS)
      out.push({
        name: `${cr.label} / ${view}`,
        render: () => bonesToSvg(
          resolveRig(combatantAppearance(prof.appearance, c), prof.equip, {}, prof.tenue, view, combatantOverlays(c)),
        ),
      });
  }
  return out;
};

describe('détecteur de fuite des registres d’art du rig', () => {
  it('une amputation de ARMOUR.plaque.{pied,main,cou} fait diverger 78 rendus de combat, et la remise les restaure', () => {
    const cases = combatRenderCases();
    expect(cases.length).toBe(1026); // 1020 → 1026 : +2 créatures à rendu de combat (Mouton, Cochon — EDOC 07 folio 24, #673 L1) × 3 rendus
    const before = cases.map((c) => c.render());

    const P = ARMOUR.plaque as Record<string, unknown>;
    const saved = { pied: P.pied, main: P.main, cou: P.cou };
    expect(Object.values(saved).every((v) => v !== undefined)).toBe(true); // la plaque DÉCLARE bien ces 3 zones
    let during: string[] = [];
    try {
      delete P.pied; delete P.main; delete P.cou;
      during = cases.map((c) => c.render());
    } finally {
      Object.assign(P, saved);
    }

    expect(cases.filter((_, i) => during[i] !== before[i]).length).toBe(78);
    expect(cases.map((c) => c.render())).toEqual(before); // remise → rendus identiques à l'origine
  });

  it('l’amputation est VUE par le détecteur (signature de ARMOUR)', () => {
    const before = rigArtRegistrySignatures().get('armour/index.ts#ARMOUR');
    expect(before).toBeTruthy();
    const P = ARMOUR.plaque as Record<string, unknown>;
    const saved = P.pied;
    try {
      delete P.pied;
      expect(rigArtRegistrySignatures().get('armour/index.ts#ARMOUR')).not.toBe(before);
    } finally {
      P.pied = saved;
    }
    expect(rigArtRegistrySignatures().get('armour/index.ts#ARMOUR')).toBe(before);
  });

  it('une SUBSTITUTION de valeur sous une clé existante est VUE par le détecteur', () => {
    const before = rigArtRegistrySignatures().get('armour/index.ts#ARMOUR');
    const P = ARMOUR.plaque as Record<string, unknown>;
    const saved = P.pied;
    try {
      P.pied = '<g id="test-soleret"/>'; // même clé, valeur substituée : invisible à une empreinte de CLÉS
      expect(rigArtRegistrySignatures().get('armour/index.ts#ARMOUR')).not.toBe(before);
    } finally {
      P.pied = saved;
    }
    expect(rigArtRegistrySignatures().get('armour/index.ts#ARMOUR')).toBe(before);
  });

  it('la couverture dépasse ARMOUR/TENUE_BY_ID : une pollution de HAIRSTYLE_DEFS est VUE', () => {
    const key = 'hairstyles/_registry.generated.ts#HAIRSTYLE_DEFS';
    const sigs = rigArtRegistrySignatures();
    const before = sigs.get(key);
    expect(before).toBeTruthy();
    const h = HAIRSTYLE_DEFS[0];
    const saved = h.front;
    try {
      h.front = '<g id="test-cheveux"/>';
      expect(rigArtRegistrySignatures().get(key)).not.toBe(before);
    } finally {
      h.front = saved;
    }
    expect(rigArtRegistrySignatures().get(key)).toBe(before);
  });

  it('tout module d’art de parts/ est énuméré (aucune famille hors couverture)', () => {
    const families = new Set([...rigArtRegistrySignatures().keys()].map((k) => k.split('/')[0]));
    expect([...families].sort()).toEqual([
      'appendages', 'armour', 'bodies', 'capes', 'elements', 'eyes', 'hairstyles',
      'heads', 'monster', 'prosthesis', 'shields', 'tenues', 'weapons', 'wings',
    ]);
  });
});
