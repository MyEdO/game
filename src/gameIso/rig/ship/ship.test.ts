import { describe, it, expect } from 'vitest';
import { planById } from '../bodyPlan';
import { shipPlan, shipArtOf } from './composeShip';
import { MISSING_ART } from '../viewArt';

const svgOf = (id: string) =>
  shipPlan.resolve(id, 'profile', shipPlan.restPose()).map((b) => b.parts.map((p) => p.svg).join('')).join('');

describe('Gabarit NAVIRE — rendu via le système de plans (réutilisé, pas dupliqué)', () => {
  it('enregistré dans le registre des plans (auto-découverte plans/defs/)', () => {
    expect(planById('navire')).toBe(shipPlan);
    expect(shipPlan.id).toBe('navire');
  });

  it('la coque est routée PAR ID (art dédié SHIP_ARTS) ; palette à jetons entièrement résolue', () => {
    const svg = svgOf('cogue');
    expect(svg.length).toBeGreaterThan(0);
    expect(svg).not.toContain('@'); // tous les jetons @coque/@toileDeVoile/@mat substitués par la palette
  });

  it('id FUTUR sans art dédié → REPLI VISIBLE (#223), jamais un générique silencieux', () => {
    // Plus de silhouette procédurale par gréement : un id inconnu tombe sur la silhouette d'erreur partagée.
    expect(shipArtOf('id-de-navire-inconnu-xyz')).toBe(MISSING_ART);
    expect(svgOf('id-de-navire-inconnu-xyz')).toContain('#ff2fb0'); // magenta d'alarme du repli
  });

  it('poses réutilisées : roulis au repos, gîte à la mort (delta sur l’os « coque »)', () => {
    expect(shipPlan.idlePose!(0.25).coque).toBeGreaterThan(0); // roule
    expect(shipPlan.deathPose().coque).toBe(22); // sombre/chavire
    expect(shipPlan.hasView('navire', 'profile')).toBe(true);
  });
});

describe('routage : un véhicule à coque → gabarit navire (resolveRender, data-driven)', () => {
  it('résout par ID SEUL vers le plan navire + ID comme espèce (route l’art de coque SHIP_ARTS)', async () => {
    const { resolveRender } = await import('../bodyPlan');
    const byId = resolveRender(undefined, undefined, 'cogue'); // voile, 25 m
    expect(byId.kind).toBe('plan');
    expect(byId.plan).toBe('navire');
    expect(byId.species).toBe('cogue'); // id → art de coque dédié
    expect(byId.scale).toBeGreaterThan(1); // 25 m → > 1
    const byId2 = resolveRender(undefined, undefined, 'langskip'); // mixte
    expect(byId2.plan).toBe('navire');
    expect(byId2.species).toBe('langskip');
    // un véhicule TERRESTRE (diligence) n'est PAS un navire → gabarit terrestre (cf. land.test.ts).
    expect(resolveRender(undefined, undefined, 'diligence').plan).not.toBe('navire');
  });

  it('un LABEL de véhicule (ids stables uniquement, doctrine ids) ne résout PAS le plan navire', async () => {
    const { resolveRender } = await import('../bodyPlan');
    // « Langskip » est le LABEL (affichage) de l'id `langskip` — passer le label ne doit PAS
    // matcher la coque (jumelle du garde `tokenBodyKind.tsx:161-162` : la ref doit être un id stable).
    expect(resolveRender(undefined, undefined, 'Langskip').plan).not.toBe('navire');
  });
});
