import { describe, it, expect } from 'vitest';
import { injuryOverlaysFor, injuryAppearance } from './injuries';
import { traumaById } from '../../../engine/trauma';
import type { Combatant, Trauma, ItemInstance } from '../../../engine/types';
import type { Appearance } from '../appearance';

const mk = (traumas: Trauma[], items: ItemInstance[] = []): Combatant =>
  ({ id: 'h1', name: 'H', kind: 'hero', traumas, items }) as unknown as Combatant;
const t = (over: Partial<Trauma>): Trauma => ({ label: 'x', location: 'tete', ...over });
// Prothèse PORTÉE par `trappingId` STABLE (≠ libellé) — c'est ce que `worn()` matche désormais.
const item = (trappingId: string, equipped = true): ItemInstance =>
  ({ uid: trappingId, trappingId, name: trappingId, kind: 'misc', qualities: [], enc: 0, equipped }) as unknown as ItemInstance;

const MAIN_D = t({ label: 'Main/bras amputé (brasD)', location: 'brasD', ops: [{ op: 'maxWeaponHands', hands: 1 }] });
// Fiches réelles (traumas.json) via traumaById() : label + traumaId + ops COHÉRENTS avec le catalogue.
const JAMBE_G = traumaById('membre-inferieur-ampute', undefined, 'jambeG');

describe('visuels des amputations/prothèses (injuries)', () => {
  it('sans trauma → rien', () => {
    expect(injuryOverlaysFor(mk([]))).toEqual([]);
  });

  it('main amputée : moignon → crochet → main mécanique selon la prothèse PORTÉE', () => {
    expect(injuryOverlaysFor(mk([MAIN_D]))[0]).toMatchObject({ bone: 'mainD', replace: true });
    expect(injuryOverlaysFor(mk([MAIN_D]))[0].svg).toContain('data-injury="moignon"');
    expect(injuryOverlaysFor(mk([MAIN_D], [item('crochet')]))[0].svg).toContain('data-injury="crochet"');
    expect(injuryOverlaysFor(mk([MAIN_D], [item('merveille-d-ingenierie')]))[0].svg).toContain('data-injury="main-mecanique"');
    // au sac (non porté) : pas de prothèse → moignon
    expect(injuryOverlaysFor(mk([MAIN_D], [item('crochet', false)]))[0].svg).toContain('data-injury="moignon"');
  });

  it('jambe amputée : invisible sans prothèse ; Fausse jambe portée → jambe de bois + pied effacé', () => {
    expect(injuryOverlaysFor(mk([JAMBE_G]))).toEqual([]);
    const ovs = injuryOverlaysFor(mk([JAMBE_G], [item('fausse-jambe')]));
    expect(ovs.some((o) => o.bone === 'cuisseG' && o.replace && o.svg.includes('data-injury="jambe-de-bois"'))).toBe(true);
    expect(ovs.some((o) => o.bone === 'piedG' && o.replace && o.svg === '')).toBe(true);
  });

  it('œil perdu : REMPLACE l’œil peint en place (cicatrice → cache-œil → œil de verre)', () => {
    const APP = { species: 'humains-reiklander', sex: 'M', build: 0.5 } as Appearance;
    const eye = traumaById('oeil-perdu', undefined, 'tete');
    expect(injuryAppearance(APP, mk([eye])).eyes?.G).toContain('data-injury="oeil-perdu"');
    expect(injuryAppearance(APP, mk([eye], [item('cache-oeil')])).eyes?.G).toContain('data-injury="cache-oeil"');
    expect(injuryAppearance(APP, mk([eye], [item('oeil-de-verre')])).eyes?.G).toContain('data-injury="oeil-de-verre"');
    expect(injuryAppearance(APP, mk([]))).toBe(APP); // même référence sans blessure d'œil
    expect(injuryOverlaysFor(mk([eye]))).toEqual([]); // plus de calque d'œil
  });

  it('Cécité : bandage sur le visage (et pas de remplacement d’œil)', () => {
    const APP = { species: 'humains-reiklander', sex: 'M', build: 0.5 } as Appearance;
    const eye = traumaById('oeil-perdu', undefined, 'tete');
    const blindT = [eye, eye, traumaById('cecite', undefined, 'tete')];
    const blind = injuryOverlaysFor(mk(blindT));
    expect(blind.filter((o) => o.bone === 'tete').length).toBe(1);
    expect(blind[0].svg).toContain('data-injury="cecite"');
    expect(blind[0].view).toBe('front');
    expect(injuryAppearance(APP, mk(blindT))).toBe(APP);
  });

  it('nez : trou sombre, ou nez doré si porté', () => {
    const nez = traumaById('nez-ampute', undefined, 'tete');
    expect(injuryOverlaysFor(mk([nez]))[0].svg).toContain('data-injury="nez-ampute"');
    expect(injuryOverlaysFor(mk([nez], [item('nez-dore')]))[0].svg).toContain('data-injury="nez-dore"');
  });

  it('le calque est DÉCLARÉ par la fiche (`TraumaFiche.rig`) : sans déclaration, aucun visuel', () => {
    // #1318 E4/C-γ : le rig ne nomme plus aucune séquelle. Une séquelle réelle SANS `rig` (langue) ne
    // produit rien ; une séquelle À `rig` produit l'os, la vue et l'art DÉCLARÉS (et l'os effacé).
    expect(injuryOverlaysFor(mk([traumaById('langue-amputee', undefined, 'tete')]))).toEqual([]);
    const nez = injuryOverlaysFor(mk([traumaById('nez-ampute', undefined, 'tete')]));
    expect(nez).toHaveLength(1);
    expect(nez[0]).toMatchObject({ bone: 'tete', view: 'front' });
    const jambe = injuryOverlaysFor(mk([traumaById('membre-inferieur-ampute', undefined, 'jambeD')], [item('merveille-d-ingenierie')]));
    expect(jambe.map((o) => o.bone)).toEqual(['cuisseD', 'piedD']); // `bone` + `hidesBone`, latéralisés
  });

  it('un `traumaId` ORPHELIN (entrée supprimée/renommée au Codex) reste INERTE — jamais un crash de scène', () => {
    // Le canal d'affichage lit `findTraumaFiche` (tolérant) : une save portant une séquelle dont l'entrée
    // n'existe plus rend la scène SANS visuel, au lieu de faire lever le rendu (`traumaFicheById`).
    const orphelin = t({ label: 'Séquelle disparue', traumaId: 'sequelle-supprimee-v2', location: 'jambeD' });
    expect(() => injuryOverlaysFor(mk([orphelin]))).not.toThrow();
    expect(injuryOverlaysFor(mk([orphelin]))).toEqual([]);
    // …et une séquelle VALIDE présente à côté continue de rendre son calque.
    const ovs = injuryOverlaysFor(mk([orphelin, traumaById('nez-ampute', undefined, 'tete')]));
    expect(ovs[0].svg).toContain('data-injury="nez-ampute"');
  });

  it('pilotage par `traumaId`, PAS par le libellé (garde anti-régression i18n)', () => {
    // DÉCOY : libellé bidon/anglais, traumaId correct → l'overlay/apparence doit quand même sortir.
    const decoyJambe: Trauma = { ...traumaById('membre-inferieur-ampute', undefined, 'jambeD'), label: 'GARBAGE_LEG_LABEL' };
    const ovs = injuryOverlaysFor(mk([decoyJambe], [item('fausse-jambe')]));
    expect(ovs.some((o) => o.bone === 'cuisseD' && o.svg.includes('data-injury="jambe-de-bois"'))).toBe(true);

    const decoyNez: Trauma = { ...traumaById('nez-ampute', undefined, 'tete'), label: 'NOT_A_REAL_LABEL' };
    expect(injuryOverlaysFor(mk([decoyNez]))[0].svg).toContain('data-injury="nez-ampute"');

    const decoyOeil: Trauma = { ...traumaById('oeil-perdu', undefined, 'tete'), label: 'WRONG_LABEL_EYE' };
    const APP = { species: 'humains-reiklander', sex: 'M', build: 0.5 } as Appearance;
    expect(injuryAppearance(APP, mk([decoyOeil])).eyes?.G).toContain('data-injury="oeil-perdu"');

    const decoyCecite: Trauma = { ...traumaById('cecite', undefined, 'tete'), label: 'WRONG_LABEL_BLIND' };
    const blindOverlay = injuryOverlaysFor(mk([decoyCecite]));
    expect(blindOverlay.some((o) => o.svg.includes('data-injury="cecite"'))).toBe(true);

    // Inverse : libellé FR correct mais SANS traumaId → ne doit PLUS suffire (pas de repli sur le libellé).
    const rightLabelNoId = t({ label: 'Nez amputé', location: 'tete' });
    expect(injuryOverlaysFor(mk([rightLabelNoId]))).toEqual([]);
  });
});
