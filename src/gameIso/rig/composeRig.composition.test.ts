/**
 * CONTRAT : la COMPOSITION d'un rig (parts, palette, squelette, échelles, profondeurs) ne dépend que du
 * PERSONNAGE ; seule la POSE dépend de l'instant. Une composition RETENUE par son appelant (`RigToken`,
 * sujets de `sceneMeshes`) et posée image après image rend le MÊME SVG qu'une composition faite à neuf
 * pour la même pose — sinon la retenir serait un bug d'affichage.
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
      it(`${c.nom} / ${nomPose} : composition retenue et déjà posée ≡ composition faite à neuf`, () => {
        // Chemin RETENU : la composition a déjà servi à une image précédente (repos).
        const retenue = rigComposition(c.appearance, c.equip, c.tenue, c.view, c.overlays, c.mirror ?? false);
        poseRig(retenue, POSES.repos);
        const reutilise = bonesToSvg(poseRig(retenue, pose));
        const neuf = rendu(c, pose, { ...c.appearance });
        expect(reutilise).toBe(neuf);
        expect(reutilise.length).toBeGreaterThan(0);
      });
    }
  }

  it('poseRig rend le même SVG que resolveRig pour la même pose', () => {
    const c = CAS[0];
    const comp = rigComposition(c.appearance, c.equip, c.tenue, c.view, c.overlays, false);
    expect(bonesToSvg(poseRig(comp, POSES.marche))).toBe(rendu(c, POSES.marche));
  });
});

describe('composition ⊥ pose — une apparence changée se dessine', () => {
  const base = CAS[0];
  it('une apparence RECOMPOSÉE rend le SVG de son nouvel état, jamais celui de l’ancien', () => {
    const avant = rendu(base, POSES.repos);
    const apres = rendu({ ...base, appearance: app('humain', 'M', 7, { colors: { peau: '#4a7a3a' } }) }, POSES.repos);
    expect(apres).not.toBe(avant);
  });
});
