/**
 * CONTRAT : la COMPOSITION d'un rig (parts, palette, squelette, échelles, profondeurs) ne dépend
 * que du PERSONNAGE ; seule la POSE dépend de l'instant. Deux volets, indissociables :
 *  1. la composition est RÉUTILISÉE d'une image à l'autre (elle ne se recalcule pas par image) ;
 *  2. réutilisée, elle rend le MÊME SVG que recomposée à neuf — sinon le gain serait un bug d'affichage.
 * Le volet 2 est la non-régression visuelle : il compare, pour une même pose, le chemin qui réutilise
 * la composition et le chemin qui la reconstruit (réf d'apparence neuve → aucune réutilisation possible).
 */
import { describe, it, expect } from 'vitest';
import { resolveRig, rigComposition, poseRig } from './composeRig';
import { bonesToSvg } from './renderBones';
import type { Appearance } from './appearance';
import { asRigSpeciesId } from './appearance';
import type { EquipCtx } from './parts/equipment';
import type { RigOverlay } from './bones';
import type { View } from './facing';
import type { Pose } from './poses';
import type { Sexe } from '../../data/schemas/grammaire/valeurs';

const sword = { label: 'Épée', type: 'melee' as const, damage: { plusBF: true, flat: 4 }, qualities: [] };
const equipNu: EquipCtx = { weapons: [], armour: [] };
const equipArme: EquipCtx = { weapons: [sword], armour: [] };

const app = (species: string, sex: Sexe, seed: number, extra: Partial<Appearance> = {}): Appearance =>
  ({ species: asRigSpeciesId(species), sex, build: 0.5, seed, ...extra });

/** Calques d'ÉTAT tels que `combatantOverlays` en produit : blessure superposée, membre remplacé, plan dorsal. */
const blessure: RigOverlay[] = [{ bone: 'torse', svg: '<path d="M0 0h4v9z" fill="#7d1d1d"/>' }];
const amputation: RigOverlay[] = [{ bone: 'avantBrasG', svg: '', replace: true }];
const dorsal: RigOverlay[] = [{ bone: 'torse', svg: '<path d="M0 0h9v4z" fill="#3a2b1b"/>', plane: 'fond' }];

/** Poses d'instants distincts : repos, marche, À Terre, cadavre (RigToken). */
const POSES: Record<string, Pose> = {
  repos: {},
  marche: { epauleG: 22, epauleD: -22, cuisseG: 18, cuisseD: -18 },
  aTerre: { tete: -30, cou: -8, torse: -4, epauleD: -38, avantBrasD: -52, cuisseG: 12 },
  cadavre: { tete: 18, torse: 6, epauleG: -30, epauleD: 24, cuisseG: 14, tibiaG: 18 },
};

interface Cas { nom: string; appearance: Appearance; equip: EquipCtx; tenue?: string; view: View; overlays?: RigOverlay[]; mirror?: boolean }

/** Personnages ET états couverts : espèces, sexes, tenues, 3 directions, miroir, blessure/amputation/dorsal. */
const CAS: Cas[] = [
  { nom: 'humain soldat de face', appearance: app('humain', 'M', 7), equip: equipArme, tenue: 'soldat', view: 'front' },
  { nom: 'humaine noble de profil', appearance: app('humain', 'F', 3), equip: equipNu, tenue: 'noble', view: 'profile' },
  { nom: 'humaine noble de profil, miroir', appearance: app('humain', 'F', 3), equip: equipArme, tenue: 'noble', view: 'profile', mirror: true },
  { nom: 'nain de dos', appearance: app('nain', 'M', 11), equip: equipArme, view: 'back' },
  { nom: 'elfe, tenue différente', appearance: app('elfe-sylvain', 'F', 5), equip: equipNu, tenue: 'mage', view: 'front' },
  { nom: 'ogre armé', appearance: app('ogre', 'M', 2), equip: equipArme, view: 'front' },
  { nom: 'humain BLESSÉ', appearance: app('humain', 'M', 7), equip: equipArme, tenue: 'soldat', view: 'front', overlays: blessure },
  { nom: 'humain AMPUTÉ', appearance: app('humain', 'M', 7), equip: equipArme, tenue: 'soldat', view: 'front', overlays: amputation },
  { nom: 'humain à calque DORSAL', appearance: app('humain', 'M', 9), equip: equipNu, view: 'front', overlays: dorsal },
  { nom: 'humain recoloré', appearance: app('humain', 'M', 7, { colors: { peau: '#8a6a4a', vet1: '#204a20' } }), equip: equipNu, tenue: 'soldat', view: 'front' },
  { nom: 'humain au visage retourné', appearance: app('humain', 'M', 7, { faceFlip: true }), equip: equipNu, view: 'front' },
];

const rendu = (c: Cas, pose: Pose, appearance: Appearance = c.appearance) =>
  bonesToSvg(resolveRig(appearance, c.equip, pose, c.tenue, c.view, c.overlays, c.mirror ?? false));

describe('composition ⊥ pose — non-régression visuelle', () => {
  for (const c of CAS) {
    for (const [nomPose, pose] of Object.entries(POSES)) {
      it(`${c.nom} / ${nomPose} : composition réutilisée ≡ composition reconstruite`, () => {
        // Chemin RÉUTILISÉ : la même réf d'apparence a déjà servi (image précédente).
        rendu(c, POSES.repos);
        const reutilise = rendu(c, pose);
        // Chemin RECONSTRUIT : réf d'apparence neuve → composition rebâtie de zéro pour cette image.
        const reconstruit = rendu(c, pose, { ...c.appearance });
        expect(reutilise).toBe(reconstruit);
        expect(reutilise.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('composition ⊥ pose — la composition ne se recalcule pas par image', () => {
  it('deux images consécutives PARTAGENT les parts composées, et ne diffèrent que par les matrices', () => {
    const c = CAS[0];
    const a = resolveRig(c.appearance, c.equip, POSES.repos, c.tenue, c.view, c.overlays, false);
    const b = resolveRig(c.appearance, c.equip, POSES.marche, c.tenue, c.view, c.overlays, false);
    expect(b.length).toBe(a.length);
    // Les parts (SVG résolu, palette appliquée) sont le MÊME objet : elles n'ont pas été refabriquées.
    for (let i = 0; i < a.length; i++) {
      expect(b[i].id).toBe(a[i].id);
      expect(b[i].parts).toBe(a[i].parts);
      expect(b[i].scale).toBe(a[i].scale);
    }
    // La POSE, elle, a bien bougé : au moins un os porte une matrice différente.
    expect(a.some((bone, i) => bone.matrix.join() !== b[i].matrix.join())).toBe(true);
  });

  it('la composition d’un personnage inchangé est la MÊME d’une image à l’autre', () => {
    const c = CAS[0];
    const c1 = rigComposition(c.appearance, c.equip, c.tenue, c.view, c.overlays, false);
    const c2 = rigComposition(c.appearance, c.equip, c.tenue, c.view, c.overlays, false);
    expect(c2).toBe(c1);
  });

  it('poseRig rend le même SVG que resolveRig pour la même pose', () => {
    const c = CAS[0];
    const comp = rigComposition(c.appearance, c.equip, c.tenue, c.view, c.overlays, false);
    expect(bonesToSvg(poseRig(comp, POSES.marche))).toBe(rendu(c, POSES.marche));
  });
});

describe('composition ⊥ pose — ce qui doit la RECOMPOSER', () => {
  const base = CAS[0];
  const comp = () => rigComposition(base.appearance, base.equip, base.tenue, base.view, base.overlays, false);

  it('changer de TENUE recompose', () => {
    expect(rigComposition(base.appearance, base.equip, 'noble', base.view, base.overlays, false)).not.toBe(comp());
  });
  it('changer de DIRECTION (vue) recompose', () => {
    expect(rigComposition(base.appearance, base.equip, base.tenue, 'profile', base.overlays, false)).not.toBe(comp());
  });
  it('changer de SENS (miroir) recompose', () => {
    expect(rigComposition(base.appearance, base.equip, base.tenue, base.view, base.overlays, true)).not.toBe(comp());
  });
  it('un calque d’ÉTAT (blessure) recompose', () => {
    expect(rigComposition(base.appearance, base.equip, base.tenue, base.view, blessure, false)).not.toBe(comp());
  });
  it('changer d’ÉQUIPEMENT recompose', () => {
    expect(rigComposition(base.appearance, equipNu, base.tenue, base.view, base.overlays, false)).not.toBe(comp());
  });
  it('changer d’APPARENCE recompose', () => {
    const mute = app('humain', 'M', 7, { colors: { peau: '#4a7a3a' } });
    expect(rigComposition(mute, base.equip, base.tenue, base.view, base.overlays, false)).not.toBe(comp());
  });

  it('une apparence RECOMPOSÉE rend le SVG de son nouvel état, jamais celui de l’ancien', () => {
    const avant = rendu(base, POSES.repos);
    const apres = rendu({ ...base, appearance: app('humain', 'M', 7, { colors: { peau: '#4a7a3a' } }) }, POSES.repos);
    expect(apres).not.toBe(avant);
  });
});
