/**
 * Golden master du rendu bipède par espèce/rôle + cas équipés — filet anti-régression de migration
 * gabarit/race.
 *
 * CE QUE LES SNAPSHOTS `back` FIGENT — ce n'est PAS une couverture d'art (#559). Sans art `back`
 * dédié sur une part, `parts/resolve.ts` (~l.185-189) FABRIQUE une silhouette dorsale générique en
 * jetons (`BACK_TORSE`/`BACK_JAMBE`/`BACK_CRANE`). Mesuré sur cette suite : 29 snapshots `back`, dont
 * 11 (38 %) portent au moins une part dorsale inventée (11 torse, 6 jambe, 0 tête). Ces snapshots
 * figent donc le REPLI, pas un dos authoré : ils protègent d'une régression de composition, ils
 * n'attestent d'aucune intention d'artiste. Ils ont vocation à être REMPLACÉS à mesure que #559 vide
 * son stock de slots front-only (167 mesurés) — un churn de ces snapshots y est ATTENDU, pas suspect.
 */
import { describe, it, expect } from 'vitest';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { entityRigProfile } from '../enemyProfile';
import { findCreatureById } from '../../../data';
import { weaponFromId } from '../../../engine/creatureEquip';
import { resolveSpecies } from '../bodyPlan';
import { slugId } from '../../../data/slug';
import { VIEWS } from '../facing';
import type { Appearance } from '../appearance';
import { asRigSpeciesId } from '../appearance';
import { bouclierDeDessin, equipDe, type EquipCtx } from '../parts/equipment';

// Espèces bipèdes couvertes (LIBELLÉS canoniques) + rôles génériques. Comme un outil, on part d'un
// libellé → on le slugue → espèce EXPLICITE (resolveSpecies(slug) : id de def, ou Humain si rôle
// générique sans def) — plus aucun repli implicite par le nom dans entityRigProfile.
const NAMES = ['Humain', 'Nain', 'Halfling', 'Haut-Elfe', 'Elfe sylvain', 'Gnome', 'Ogre',
  'Skaven', 'Orc', 'Gobelin', 'Snotling', 'Homme-bête', 'Minotaure', 'Squelette', 'Zombie',
  'Goule', 'Troll', 'Vampire', 'Démon', 'Liche', 'Démonette', 'Fimir', 'Géant',
  'Guerrier du Chaos'];
// Entrées de BESTIAIRE (IDS de record `creatures.json`) — ce ne sont pas des espèces : leur espèce ET
// leur garde-robe viennent du RECORD (cultiste → {species humain, tenue cultiste, armurePortee} ;
// mutant → {species humain, tenue mendiant}). Elles se rendent par la voie record d'`entityRigProfile`
// (`findCreatureById` → `resolveRender(undefined, rec.traits, id)`, = `resolveById`), sans espèce en
// opts : un slug de LIBELLÉ ne résout aucun record.
const RECORDS = ['cultiste', 'mutant'];

describe('golden master — rendu bipède (anti-régression migration gabarit/race)', () => {
  for (const name of NAMES)
    for (const view of VIEWS) {
      it(`${name} / ${view} stable`, () => {
        const prof = entityRigProfile(name, 7, { species: resolveSpecies(slugId(name)).species });
        const svg = prof ? bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view, [])) : '∅';
        expect(svg).toMatchSnapshot();
      });
    }
  it('RECORDS sont des IDS de record, jamais des libellés', () => {
    for (const id of RECORDS) expect(findCreatureById(id), `« ${id} » ne résout aucun record`).toBeTruthy();
  });
  // `armurePortee` du record est INERTE dans ce golden : `entityRigProfile(id, 7)` est appelé sans
  // combattant enrôlé → traits [] → PA 0 → aucune pièce d'armure synthétisée. Les snapshots de RECORDS
  // figent la TENUE, jamais une armure.
  it('voie record sans enrôlement : aucune armure synthétisée (les snapshots figent la tenue)', () => {
    for (const id of RECORDS) expect(entityRigProfile(id, 7)!.equip.armour.length, id).toBe(0);
  });
  for (const id of RECORDS)
    for (const view of VIEWS) {
      it(`${id} / ${view} stable`, () => {
        const prof = entityRigProfile(id, 7);
        const svg = prof ? bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view, [])) : '∅';
        expect(svg).toMatchSnapshot();
      });
    }
});

// ---------------------------------------------------------------------------
// Cas équipés — couvre les chemins de code arme/bouclier/armure/couleurs
// ---------------------------------------------------------------------------

describe('golden master — héros équipés (anti-régression chemins arme/armure/couleur)', () => {
  // (a) Porteur d'arme de mêlée : chemin os `arme` + twist de pose profil mêlée
  const appSoldat: Appearance = { species: asRigSpeciesId('humain'), sex: 'M', build: 0.5, seed: 3 };
  const equipSoldat: EquipCtx = equipDe([weaponFromId('arme-simple')!], []);
  for (const view of VIEWS) {
    it(`Humain-Soldat-épée / ${view} stable`, () => {
      const svg = bonesToSvg(resolveRig(appSoldat, equipSoldat, {}, 'soldat', view));
      expect(svg).toMatchSnapshot();
    });
  }

  // (b) Bouclier + armure corporelle : chemin os `bouclier` + parts armure
  const appGuardien: Appearance = { species: asRigSpeciesId('humain'), sex: 'F', build: 0.6, seed: 11 };
  const equipGuardien: EquipCtx = {
    ...equipDe([weaponFromId('grande-hache')!], [
      { locs: ['corps'], materiau: 'maille' },
      { locs: ['tete'], materiau: 'plaque' },
    ]),
    shield: bouclierDeDessin({ label: 'Bouclier rondache', type: 'melee' as const, damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'protectrice', value: 1 }] }),
  };
  for (const view of VIEWS) {
    it(`Humain-Noble-bouclier-armure / ${view} stable`, () => {
      const svg = bonesToSvg(resolveRig(appGuardien, equipGuardien, {}, 'noble', view));
      expect(svg).toMatchSnapshot();
    });
  }

  // (c) Surcharge de couleur (appearance.colors) : chemin tokenMap couleur personnalisée
  const appMercenaire: Appearance = {
    species: asRigSpeciesId('humain'), sex: 'M', build: 0.45, seed: 17,
    colors: { vet1: '#3a5a7a' },
  };
  const equipMercenaire: EquipCtx = equipDe([weaponFromId('grande-hache')!], []);
  for (const view of VIEWS) {
    it(`Humain-Voleur-couleur-override / ${view} stable`, () => {
      const svg = bonesToSvg(resolveRig(appMercenaire, equipMercenaire, {}, 'voleur', view));
      expect(svg).toMatchSnapshot();
    });
  }
});
