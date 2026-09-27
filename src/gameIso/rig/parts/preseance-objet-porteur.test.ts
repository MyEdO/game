/**
 * PRÉSÉANCE objet/porteur et dégradé dérivé (#1903 D2). Question : une clé de sorte porteur (`@peau`,
 * ou un `dg-` qui en contient une) peinte par un OBJET se résout-elle sur le porteur qui le tient ?
 * Primitive : `tableDObjet` (passe d'objet) puis `buildTokenMap` (passe du porteur), `applyTokenMap`
 * pour les deux. Le rendu final entièrement résolu : `references-degrade.test.ts` (0).
 */
import { afterEach, describe, it, expect } from 'vitest';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { buildTokenMap } from '../palette';
import { couchesDuRig } from './career';
import { racePalette } from '../races';
import { weaponPart, shieldPart, armourPart, objetSansPorteur } from './equipment';
import { ARMOUR } from './armour';
import { WEAPON_DEFS } from './weapons/_registry.generated';
import { SHIELD_DEFS } from './shields/_registry.generated';
import { asRigSpeciesId } from '../appearance';
import type { ItemInstance, Weapon } from '../../../engine/types';
import type { PartArt } from './types';

const ARO = /@[a-zA-Z]/;
const HUMAIN = asRigSpeciesId('humain');
const LOCS = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];
const arme = (shape: string) => ({ label: shape, type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [], shape }) as unknown as Weapon;
const plaque = (skin?: Record<string, string>) => ({ uid: 'p', kind: 'armor', label: 'Plastron de plaque', locs: LOCS, equipped: true, qualities: [], enc: 0, ...(skin && { skin }) }) as unknown as ItemInstance;
const vues = (a: PartArt) => (typeof a === 'string' ? [a] : [a.front, a.back, a.profile].filter((v): v is string => v != null));

describe('préséance objet/porteur (#1903 D2)', () => {
  it('un poing tenu par un porteur à peau #3a2a1a peint le dégradé dérivé de CETTE peau', () => {
    const app = { species: HUMAIN, sex: 'M' as const, build: 0.5, seed: 1, colors: { peau: '#3a2a1a' } };
    const t = buildTokenMap(couchesDuRig(racePalette('humain', 'M'), 'nu'), app.colors);
    const id = `dg-v-${t.peauH.slice(1)}-${t.peauO.slice(1)}`;
    const armeSvg = resolveRig(app, { weapons: [arme('poing')], armour: [] }, {}, 'nu', 'front').find((b) => b.id === 'arme')!.parts.map((p) => p.svg).join('');
    expect(armeSvg).toContain(`url(#${id})`);
    expect(armeSvg).toContain(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${t.peauH}"/><stop offset="100%" stop-color="${t.peauO}"/>`);
  });

  it('la part d’arme garde ses clés porteur en jeton pour la passe du porteur', () => {
    expect(vues(weaponPart(arme('poing'))).join('')).toContain('url(#dg-v-@peauH-@peauO)');
  });

  it('un objet rendu SANS porteur ne garde aucun `@` ni `dg-` à `@` (armes, boucliers, armures)', () => {
    const fautes: string[] = [];
    for (const d of WEAPON_DEFS) if (vues(objetSansPorteur(weaponPart(arme(d.slug)))).some((v) => ARO.test(v))) fautes.push(`arme:${d.slug}`);
    for (const d of SHIELD_DEFS) if (vues(objetSansPorteur(shieldPart({ ...arme('bouclier'), shape: d.slug }))).some((v) => ARO.test(v))) fautes.push(`bouclier:${d.slug}`);
    for (const slot of ['tete', 'torse', 'bras', 'jambes'] as const) {
      const p = armourPart(plaque(), slot);
      if (p && vues(objetSansPorteur(p)).some((v) => ARO.test(v))) fautes.push(`armure:plaque:${slot}`);
    }
    expect(fautes).toEqual([]);
    const poing = vues(objetSansPorteur(weaponPart(arme('poing')))).join('');
    const d = buildTokenMap([]);
    expect(poing).toContain(`url(#dg-v-${d.peauH.slice(1)}-${d.peauO.slice(1)})`);
  });

  describe('armure à skin : `dg-` résolu à la passe d’objet puis repassé par la table du porteur', () => {
    const avant = { bras: ARMOUR.plaque.bras, torse: ARMOUR.plaque.torse };
    afterEach(() => { ARMOUR.plaque.bras = avant.bras; ARMOUR.plaque.torse = avant.torse; });

    it('un seul `<linearGradient>` par id et par fragment, contenu identique partout', () => {
      const dg = '<path d="M0 0h4v4z" fill="url(#dg-v3-@metalH-@metal-@metalO)" stroke="@peau"/>';
      ARMOUR.plaque.bras = dg + (typeof avant.bras === 'string' ? avant.bras : avant.bras?.front ?? '');
      ARMOUR.plaque.torse = dg + (typeof avant.torse === 'string' ? avant.torse : avant.torse?.front ?? '');
      const bones = resolveRig({ species: HUMAIN, sex: 'M', build: 0.5, seed: 1 }, { weapons: [], armour: [plaque({ metal: '#ff0000' })] }, {}, 'soldat', 'front');
      const contenus = new Map<string, Set<string>>();
      let vus = 0;
      for (const b of bones) for (const p of b.parts) {
        const ids = [...p.svg.matchAll(/<linearGradient id="(dg-[^"]+)"[^>]*>.*?<\/linearGradient>/g)];
        const parId = new Map<string, number>();
        for (const [tout, id] of ids) { parId.set(id, (parId.get(id) ?? 0) + 1); (contenus.get(id) ?? contenus.set(id, new Set()).get(id)!).add(tout); vus++; }
        expect([...parId.values()].every((n) => n === 1), `${b.id} : id émis deux fois`).toBe(true);
      }
      expect(vus).toBeGreaterThan(0);
      for (const [id, s] of contenus) expect(s.size, id).toBe(1);
      expect(bonesToSvg(bones)).not.toMatch(ARO);
    });
  });
});
