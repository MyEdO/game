import { describe, it, expect } from 'vitest';
import { resolveParts } from './resolve';
import { genericPart } from './generic';
import { TENUE_BY_ID, type TenueSet } from './tenues';
import { dominantCloth, avantBrasBase, splitBrasSvg, deriveProfileBras, deriveBackBras } from './derive';
import { ARMOUR, ARMOUR_PALETTES } from './armour';
import { buildTokenMap, applyTokenMap, applyTokenMapArt } from '../palette';
import type { EquipCtx } from './equipment';
import type { PartArt } from './types';

/** Enregistre une tenue FIXTURE sous un id à elle, la sert au test, puis la retire du registre.
 *  `tenueFor` lit `TENUE_BY_ID` à l'APPEL : le chemin exercé est le vrai (résolution par id de
 *  garde-robe), sans mock de module — la suite tourne en `isolate: false` (config Vitest), où le
 *  graphe de modules est partagé par worker et où un `vi.mock` n'atteint pas un `./resolve` déjà
 *  évalué par un fichier précédent. */
function withTenue<T>(id: string, set: TenueSet, run: () => T): T {
  TENUE_BY_ID[id] = set;
  try { return run(); } finally { delete TENUE_BY_ID[id]; }
}

const NO_EQUIP: EquipCtx = { weapons: [], armour: [] };
const frontOf = (art: PartArt): string => (typeof art === 'string' ? art : art.front);
const viewOf = (art: PartArt, v: 'front' | 'back' | 'profile'): string =>
  typeof art === 'string' ? (v === 'front' ? art : '') : (art[v] ?? '');
const resolve = (tenueKey: string | undefined) =>
  resolveParts('humain', 'M', tenueKey, NO_EQUIP, {}, 0, 'front');

const PLAQUE: EquipCtx = {
  weapons: [],
  armour: [
    { id: 'harnois-qc', kind: 'armor', equipped: true, label: 'Harnois de plaque', pa: 5,
      locs: ['corps', 'brasG', 'brasD', 'jambeG', 'jambeD'] } as unknown as EquipCtx['armour'][number],
  ],
};

// Contrat POSITIF (#633 D1, Lot 2) : le membre supérieur se résout en UNITÉ — l'avant-bras est le BAS
// de l'art `bras` pleine longueur découpé au coude, jamais un rect de peau nu plaqué par-dessus.
describe('resolveParts — membre supérieur (bras + avantBras) en unité', () => {
  it('Soldat (tenue.bras pleine longueur) : bras = .haut clippé, avantBras = .bas (manche, pas peau nue)', () => {
    const out = resolve('soldat');
    const brasFront = frontOf(TENUE_BY_ID.soldat.bras!);

    // bras = haut de la manche, clippé dans le repère épaule (aucun rebasage).
    expect(out.bras!.svg).toContain('clip-path="url(#rigCutBrasHaut)"');
    expect(out.bras!.svg).not.toContain('translate(0,-18)');
    expect(out.bras!.svg).toContain(brasFront); // l'art de manche est bien présent, clippé

    // avantBras = bas de la MÊME manche, rebasé sous le coude → PAS le rect de peau générique.
    expect(out.avantBras!.svg).toContain('translate(0,-18)');
    expect(out.avantBras!.svg).toContain('clip-path="url(#rigCutBrasBas)"');
    expect(out.avantBras!.svg).toContain(brasFront); // tissu de la manche, pas un rect de peau
    expect(out.avantBras!.svg).not.toBe(frontOf(genericPart('avantBras')));

    // COUVERTURE PLEINE (Lot 2, décision 2026-07-22) : sous-couche = silhouette d'avant-bras REMPLIE de
    // la matière dominante du bras (manche), PAS @peau seule. Tenue → tokens gardés (composeRig résout).
    const dom = dominantCloth(brasFront);
    expect(dom).not.toBe('peau'); // manche habillée → matière ≠ chair
    expect(out.avantBras!.svg).toContain(avantBrasBase(dom).front); // base = rect matière (ici @cuir)
  });

  it('Sorcier : manche scindée (avantBras porte le bas de l’art bras, pas un rect nu)', () => {
    const out = resolve('sorcier');
    const brasFront = frontOf(TENUE_BY_ID.sorcier.bras!);
    expect(out.bras!.svg).toContain('clip-path="url(#rigCutBrasHaut)"');
    expect(out.avantBras!.svg).toContain('translate(0,-18)');
    expect(out.avantBras!.svg).toContain('clip-path="url(#rigCutBrasBas)"');
    expect(out.avantBras!.svg).toContain(brasFront);
  });

  it('tenue SANS bras (Nu, winner générique) : bras + avantBras génériques (ni sliver, ni translate)', () => {
    const out = resolve('nu');
    // Le générique `bras` est déjà court (épaule→coude) → laissé tel quel, aucun clip de découpe.
    expect(out.bras!.svg).toBe(frontOf(genericPart('bras')));
    expect(out.bras!.svg).not.toContain('clip-path');
    // avantBras = rect de peau dédié (PAS le bas d'un art court, qui donnerait un sliver 16..18).
    // Couverture pleine (Lot 2) : bras de chair → avant-bras RESTE peau (dominante = peau), inchangé.
    expect(out.avantBras!.svg).toBe(frontOf(genericPart('avantBras')));
    expect(out.avantBras!.svg).toContain('@peau');
    expect(out.avantBras!.svg).not.toContain('translate');
    expect(out.avantBras!.svg).not.toContain('clip-path="url(#rigCutBrasBas)"');
  });

  it('Plaque (armure gagnante) : base d’avant-bras FRONT en matière de PLAQUE, pas peau (tue l’incohérence front↔profil)', () => {
    const out = resolveParts('humain', 'M', 'soldat', PLAQUE, {}, 0, 'front');

    // Matière dominante lue sur l'art RAW de l'armure (tokens @metal intacts), résolue contre LA palette
    // de plaque — comme le bras (armourPart), donc couverture ET vambrace de la même matière steel.
    const rawBras = ARMOUR.plaque.bras as string;
    const dom = dominantCloth(rawBras);
    expect(dom).toBe('metal');
    const map = buildTokenMap([ARMOUR_PALETTES.plaque]);
    const expectedBase = (applyTokenMapArt(avantBrasBase(dom), map) as { front: string }).front;

    expect(out.avantBras!.svg).toContain(expectedBase); // base = rect matière de plaque résolue
    expect(out.avantBras!.svg).not.toContain('@peau');  // aucune peau nue de FACE
  });

  it('def avec avantBras EXPLICITE (écoutille C) : override honoré tel quel, aucune découpe', () => {
    const brasFull = '<path d="M-4 -2 L4 -2 L4 34 L-4 34 Z" fill="@vet1"/>';
    const avantExplicite = '<rect x="-3" y="-2" width="6" height="16" rx="2" fill="@vet2" data-explicite="1"/>';
    const fabricated: TenueSet = { bras: brasFull, avantBras: avantExplicite };
    // Id de garde-robe à elle : aucun def du registre ne déclare `avantBras`, la fixture porte le cas.
    const out = withTenue('fixture-ecoutille-c', fabricated, () => resolve('fixture-ecoutille-c'));

    // bras pleine longueur → toujours découpé au coude.
    expect(out.bras!.svg).toContain('clip-path="url(#rigCutBrasHaut)"');
    expect(out.bras!.svg).toContain(brasFull);

    // avantBras explicite → SERVI TEL QUEL : aucun rebasage/clip de découpe, aucune sous-couche.
    expect(out.avantBras!.svg).toBe(avantExplicite);
    expect(out.avantBras!.svg).not.toContain('translate(0,-18)');
    expect(out.avantBras!.svg).not.toContain('clip-path="url(#rigCutBrasBas)"');
  });

  // Lot 2c : cohérence 3 vues de l'avant-bras ARMURÉ. L'art `bras` de plaque est front-only (string) →
  // le détail `.bas` n'existe QU'EN FRONT ; en profil/dos, l'avant-bras = la couverture-matière d'acier
  // SEULE, PAS un détail fabriqué par `toViewSet` retombant sur un fallback @vet1 (brun). Contrat anti-incohérence.
  for (const v of ['profile', 'back'] as const) {
    it(`Plaque : vue ${v} de l'avant-bras = matière d'ACIER (token plaque résolu), pas fallback @vet1/@peau`, () => {
      const out = resolveParts('humain', 'M', 'soldat', PLAQUE, {}, 0, v);

      const dom = dominantCloth(ARMOUR.plaque.bras as string);
      expect(dom).toBe('metal');
      const map = buildTokenMap([ARMOUR_PALETTES.plaque]);
      const expectedBase = (applyTokenMapArt(avantBrasBase(dom), map) as Record<typeof v, string>)[v];

      expect(out.avantBras!.svg).toContain(expectedBase);      // couverture d'acier de plaque, résolue
      expect(out.avantBras!.svg).not.toContain('@vet1');       // aucun fallback brun de silhouette fabriquée
      expect(out.avantBras!.svg).not.toContain('@peau');       // aucune peau nue
      // Art `bras` front-only → PAS de détail `.bas` fabriqué à ces vues (la matière d'acier suffit).
      expect(out.avantBras!.svg).not.toContain('clip-path="url(#rigCutBrasBas)"');
    });
  }

  // Lot 2d : cohérence 3 vues du BRAS HAUT ARMURÉ (épaule→coude). L'art `bras` de plaque est front-only
  // (string @metal) → en profil/dos, la silhouette du bras haut se DÉRIVE de l'art RAW (dominantCloth voit
  // @metal), puis est résolue en matière de plaque — PAS un fallback @vet1/brun (l'art déjà résolu en hex
  // faisait retomber dominantCloth sur @vet1, le défaut jugé). Contrat qui tue l'incohérence front↔profil du haut.
  for (const v of ['profile', 'back'] as const) {
    it(`Plaque : vue ${v} du BRAS HAUT = matière d'ACIER (token plaque résolu), pas fallback @vet1/@peau`, () => {
      const out = resolveParts('humain', 'M', 'soldat', PLAQUE, {}, 0, v);

      const dom = dominantCloth(ARMOUR.plaque.bras as string);
      expect(dom).toBe('metal');
      const map = buildTokenMap([ARMOUR_PALETTES.plaque]);
      // silhouette du bras haut dérivée de l'art RAW (haut découpé au coude), résolue en acier de plaque.
      const hautRaw = splitBrasSvg(ARMOUR.plaque.bras as string).haut;
      const expectedSil = applyTokenMap(v === 'profile' ? deriveProfileBras(hautRaw) : deriveBackBras(hautRaw), map);

      expect(out.bras!.svg).toBe(expectedSil);            // silhouette d'acier de plaque, résolue
      expect(out.bras!.svg).toContain(map.metal);         // teinte d'acier présente
      expect(out.bras!.svg).not.toContain('@vet1');       // aucun fallback brun de silhouette fabriquée
      expect(out.bras!.svg).not.toContain('@peau');       // aucune peau nue
    });
  }

  // Soldat : art `bras` OBJET déclarant front/back/profile → chaque vue porte SON propre `.bas`, la
  // couverture-matière (manche, `@cuir`) reste cohérente avec le front aux 3 vues.
  for (const v of ['profile', 'back'] as const) {
    it(`Soldat : vue ${v} de l'avant-bras = couverture de manche + détail .bas de la vue déclarée (cohérent avec le front)`, () => {
      const out = resolveParts('humain', 'M', 'soldat', NO_EQUIP, {}, 0, v);

      const dom = dominantCloth(frontOf(TENUE_BY_ID.soldat.bras!)); // matière lue sur le FRONT (couverture)
      expect(dom).not.toBe('peau');
      const base = avantBrasBase(dom) as Record<typeof v, string>;
      expect(out.avantBras!.svg).toContain(base[v]);           // couverture-matière (manche) présente

      // Vue déclarée par l'art `bras` objet → son détail `.bas` est overlayé (découpe au coude).
      const declared = viewOf(TENUE_BY_ID.soldat.bras!, v);
      expect(declared).not.toBe('');
      expect(out.avantBras!.svg).toContain('translate(0,-18)');
      expect(out.avantBras!.svg).toContain('clip-path="url(#rigCutBrasBas)"');
      expect(out.avantBras!.svg).toContain(declared);          // le tissu de la manche de CETTE vue
    });
  }

  it('z/layers inchangés : bras et avantBras restent des Part sur leurs slots respectifs', () => {
    const out = resolve('soldat');
    expect(out.bras).not.toBeNull();
    expect(out.avantBras).not.toBeNull();
    expect(typeof out.bras!.svg).toBe('string');
    expect(typeof out.avantBras!.svg).toBe('string');
  });
});
