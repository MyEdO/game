import type { View } from '../facing';
import { describe, it, expect } from 'vitest';
import { planById, resolveRender } from '../bodyPlan';
import { landPlan, landArtOf } from './composeLand';
import { MISSING_ART } from '../viewArt';

const svgOf = (view: View) =>
  landPlan.resolve('chariot-moyen', view, landPlan.restPose()).map((b) => b.parts.map((p) => p.svg).join('')).join('');

describe('Gabarit TERRESTRE — chariot/attelage via le système de plans (réutilisé)', () => {
  it('enregistré dans le registre des plans (auto-découverte plans/defs/)', () => {
    expect(planById('terrestre')).toBe(landPlan);
    expect(landPlan.id).toBe('terrestre');
  });

  it('art par id (chariot-moyen) : roues + caisse ; palette à jetons entièrement résolue', () => {
    const svg = svgOf('profile');
    expect(svg).toContain('<circle'); // roues (wheelFace)
    expect(svg).not.toContain('@'); // aucun jeton @bois/@fer/@bache résiduel
  });

  it('id FUTUR sans art dédié → REPLI VISIBLE (#223) ; face/dos REPLIENT sur le profil (mono-vue)', () => {
    // Un id inconnu tombe sur la silhouette d'erreur partagée (repli VISIBLE #223), mono-vue →
    // face/dos replient dessus (nearestView/foldView) — jamais un générique silencieux.
    expect(landArtOf('espece-inconnue-xyz')).toBe(MISSING_ART);
    const repliSvgOf = (view: View) =>
      landPlan.resolve('espece-inconnue-xyz', view, landPlan.restPose()).map((b) => b.parts.map((p) => p.svg).join('')).join('');
    expect(repliSvgOf('profile')).toContain('#ff2fb0'); // magenta d'alarme
    expect(repliSvgOf('front')).toBe(repliSvgOf('profile'));
    expect(repliSvgOf('back')).toBe(repliSvgOf('profile'));
  });

  it('chariot-moyen (art 3-vues dédié) : face/dos NE REPLIENT PLUS sur le profil', () => {
    expect(svgOf('front')).not.toBe(svgOf('profile'));
    expect(svgOf('back')).not.toBe(svgOf('profile'));
  });

  it('poses : cahot au roulage, versé à la mort', () => {
    expect(landPlan.deathPose().cahot).toBe(20);
    expect(landPlan.walkPose(0.25).cahot).toBeGreaterThan(0);
  });
});

describe('routage : un véhicule TERRESTRE → gabarit terrestre, JAMAIS la coque de navire', () => {
  it('diligence & charrette (hull.propulsion=terrestre) → plan « terrestre », pas « navire »', () => {
    for (const id of ['diligence', 'charrette']) {
      const r = resolveRender(undefined, undefined, id);
      expect(r.kind).toBe('plan');
      expect(r.plan).toBe('terrestre');
      expect(r.plan).not.toBe('navire'); // le repli accidentel vers le bateau est mort
    }
  });

  it('un véhicule maritime/fluvial reste routé vers la coque de navire (aiguillage par propulsion)', () => {
    expect(resolveRender(undefined, undefined, 'cogue').plan).toBe('navire'); // maritime
    expect(resolveRender(undefined, undefined, 'barge-fluviale').plan).toBe('navire'); // fluvial
  });
});
