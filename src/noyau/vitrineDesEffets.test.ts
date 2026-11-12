import { describe, expect, it } from 'vitest';
import { breathTypes, domains, etats, lightTones, maneuvers, rendus, siegeEngines } from '../data';
import { allMusicDefs } from '../data/sons/musique';
import { sonsDEffet } from '../data/sons/registre';
import { TEINTE_DU_FLOTTANT, vitrineDesEffets, type Effet, type GenreDeFlottant } from './effetsDeLAppel';

const coupDe = (e: Effet) => {
  if (e.quoi !== 'coup') throw new Error(`un coup attendu, reçu ${e.quoi}`);
  return e;
};
const zoneDe = (e: Effet) => {
  if (e.quoi !== 'zone') throw new Error(`une zone attendue, reçu ${e.quoi}`);
  return e;
};

describe('la vitrine des effets de l’atelier (#3777, #3783, #3825, #3822)', () => {
  const v = vitrineDesEffets();

  it('chaque engin de siège attaque par le rendu de son objet', () => {
    const sansRendu = siegeEngines().filter((t) => !t.rendu).map((t) => t.id);
    expect(sansRendu).toEqual([]);
    expect(Object.keys(v.attaques).sort()).toEqual(siegeEngines().map((t) => t.id).sort());
  });

  it('le tir d’un engin de siège est celui de son objet, sur la distance de la vitrine', () => {
    const canon = coupDe(v.attaques['canon-ade2']);
    expect(canon).toMatchObject({ de: v.de, vers: v.vers, issue: 'touche', depart: { visuel: 'eclair-de-bouche' }, trajet: { projectile: 'boulet' }, arrivee: { visuel: 'explosion' } });
    expect(canon.trajet!.dureeS).toBeCloseTo(v.distanceM / 90);
    expect(coupDe(v.attaques['trebuchet-ade2']).trajet!.projectile).toBe('pierre');
    expect(coupDe(v.attaques['canon-a-repetition-feu-d-enfer-ade2']).trajet!.projectile).toBe('balle');
    expect(coupDe(v.attaques['belier-ade2'])).toMatchObject({ trajet: null, arrivee: { visuel: 'poussiere' } });
  });

  it('une arme montre l’impact, le manque, et sa parade seulement quand son rendu en porte une', () => {
    const lame = v.armes.find((a) => a.id === 'arme-blanche')!;
    expect(lame.variantes.map((x) => x.variante)).toEqual(['touche', 'manque', 'pare']);
    expect(coupDe(lame.variantes[2].effet).arrivee?.visuel).toBe('etincelles');
    expect(v.armes.find((a) => a.id === 'arc')!.variantes.map((x) => x.variante)).toEqual(['touche', 'manque']);
  });

  it('chaque Domaine se teint de sa couleur, la Prière a son halo, aucun rendu de sort parmi les armes', () => {
    expect(v.sorts.map((s) => s.id)).toEqual([...domains.map((d) => d.id), 'sort-arcane', 'priere']);
    const feu = v.sorts.find((s) => s.id === 'feu')!;
    expect(feu.variantes.map((x) => x.variante)).toEqual(['touche', 'manque', 'incantation', 'incantation-ratee', 'zone']);
    expect(coupDe(feu.variantes[0].effet)).toMatchObject({ couleur: '#ff5a2a', arrivee: { visuel: 'gerbe-de-flammes' } });
    expect(feu.variantes[3].effet).toMatchObject({ quoi: 'incantation', reussie: false, arrivee: null });
    expect(v.sorts.find((s) => s.id === 'priere')!.variantes[2].effet).toMatchObject({ arrivee: { visuel: 'halo' } });
    expect(v.armes.map((a) => a.id)).not.toContain('sort-de-feu');
  });

  it('la zone d’un sort couvre la case de la cible ; celle du Feu y pose sa nappe de flammes, celle des Vents son impact', () => {
    const cible = { x: v.distanceM / v.metresParCase, y: 0 };
    const feu = zoneDe(v.sorts.find((s) => s.id === 'feu')!.variantes[4].effet);
    expect(feu).toMatchObject({ de: v.de, centre: cible, couleur: '#ff5a2a', nappe: { visuel: 'nappe-de-flammes' } });
    expect(feu.cases).toContainEqual(cible);
    expect(zoneDe(v.sorts.find((s) => s.id === 'sort-arcane')!.variantes[4].effet).nappe?.visuel).toBe('eclat-magique');
  });

  it('chaque manœuvre de zone et chaque Type de Souffle a son rendu ; le hurlement se centre sur son auteur', () => {
    const deZone = maneuvers.filter((m) => ['zone', 'adversairesAutour', 'toutAutour'].includes(m.ciblage));
    expect(deZone.filter((m) => !m.rendu).map((m) => m.id)).toEqual([]);
    expect(v.manoeuvres.map((m) => m.id)).toEqual(deZone.map((m) => m.id));
    expect(zoneDe(v.manoeuvres.find((m) => m.id === 'hurlement-fantomatique')!.effet)).toMatchObject({ centre: { x: 0, y: 0 }, trajet: null, nappe: { visuel: 'onde' } });
    expect(v.souffles.map((s) => s.id)).toEqual(breathTypes.map((b) => b.id));
    expect(zoneDe(v.souffles.find((s) => s.id === 'feu')!.effet)).toMatchObject({ trajet: { projectile: 'jet-de-flammes' }, nappe: { visuel: 'nappe-de-flammes' } });
    expect(zoneDe(v.souffles.find((s) => s.id === 'froid')!.effet)).toMatchObject({ trajet: { projectile: 'jet-de-souffle' }, nappe: { visuel: 'nuage' } });
    const rendusDeZone = new Set([...deZone.map((m) => m.rendu!.id), ...breathTypes.map((b) => b.rendu.id)]);
    expect(v.armes.filter((a) => rendusDeZone.has(a.id)).map((a) => a.id)).toEqual([]);
  });

  it('chaque ton de lumière se pose au lieu de la cible, avec sa flamme et son son en boucle', () => {
    expect(v.lumieres.map((l) => l.id)).toEqual(lightTones.map((t) => t.id));
    expect(v.lumieres.find((l) => l.id === 'flamme')!.source).toMatchObject({ x: v.distanceM / v.metresParCase, y: 0, visuel: 'feu', son: { id: 'crepitement' }, scintillement: { hz: expect.any(Number) } });
    expect(v.lumieres.find((l) => l.id === 'magique')!.source).toMatchObject({ visuel: 'lueur', son: null, scintillement: null });
  });

  it('chaque son d’effet du registre se joue, musique exclue', () => {
    expect(v.sons.map((s) => s.id)).toEqual(sonsDEffet.map((d) => d.id));
    expect(v.sons.every((s) => s.effet.quoi === 'son' && s.effet.son.fichiers.length > 0)).toBe(true);
  });

  it('chaque genre de flottant se montre sur la cible, et les Blessures d’un Coup Critique ; un coup dit son issue', () => {
    const genres = v.flottants.flatMap((f) => (f.effet.quoi === 'flottant' && f.effet.sur === v.vers ? [f.effet.flottant.genre] : []));
    expect(new Set(genres)).toEqual(new Set(Object.keys(TEINTE_DU_FLOTTANT) as GenreDeFlottant[]));
    expect(v.flottants.some((f) => f.effet.quoi === 'flottant' && f.effet.flottant.critique)).toBe(true);
    expect(v.armes.every((a) => a.variantes.every((x) => x.effet.quoi === 'coup' && x.effet.flottants.length > 0))).toBe(true);
  });

  it('chaque musique de fond se joue, ses pistes du registre', () => {
    expect(v.musiques.map((m) => [m.id, m.musique.pistes.map((p) => p.id)])).toEqual(allMusicDefs().map((d) => [d.id, [d.id]]));
  });

  it('chaque rendu qu’une zone qui dure peut porter se pose autour de la cible ; chaque État montre sa marque', () => {
    expect(v.zonesQuiDurent.map((z) => z.id)).toEqual(rendus.filter((r) => r.zoneVisuel ?? r.impactVisuel).map((r) => r.id));
    expect(v.zonesQuiDurent.every((z) => z.zone.visuel !== null && z.zone.cases.some((c) => c.x === v.distanceM / v.metresParCase && c.y === 0))).toBe(true);
    expect(v.marques.map((m) => [m.id, m.marque.texte])).toEqual(etats.map((e) => [e.id, e.label]));
  });

  it('l’auteur parcourt un chemin qui tourne depuis sa case, chaque pas à sa longueur sur le sol plat (#3822)', () => {
    const d = v.metresParCase;
    expect(v.deplacement).toEqual({ quoi: 'deplacement', qui: v.de, cases: [
      { x: 0, y: 0, z: 0, metres: 0 }, { x: 1, y: 0, z: 0, metres: d }, { x: 2, y: 1, z: 0, metres: Math.SQRT2 * d }, { x: 2, y: 2, z: 0, metres: d },
    ] });
  });
});
