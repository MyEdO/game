/** #1853 sur les paquets livrés : une créature NÉE avec une mutation la porte comme celle qui l'a GAGNÉE en jeu
 *  (`src/noyau/spawnMutations.testkit.ts`). LDB 85 l.245 ; EDO 11 l.190-196. */
import { describe, expect, it } from 'vitest';
import { listerProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../../scripts/source/projetLivre.mjs';
import { parseProject } from '../../../src/noyau/worldMap';
import { mutationById } from '../../../src/data/mutations';
import { attachMutation } from '../../../src/engine/corruption';
import { effectiveChar } from '../../../src/engine/characteristics';
import { weaponFromTrait } from '../../../src/engine/creatureEquip';
import { makeRNG } from '../../../src/engine/dice';
import { fautesDuPorteur, porteursDuPaquet } from '../../../src/noyau/spawnMutations.testkit';

describe('mutations au spawn — garde de propriété sur les paquets livrés (#1853)', () => {
  const porteurs = listerProjetsLivres().flatMap((rel) => porteursDuPaquet(rel, parseProject(lireProjetLivre(rel))));

  it('chaque porteur : arg résolu, nombre = indice, acquisitions uniques et provenancées, armes, Blessures', () => {
    expect(porteurs.some((p) => p.ou.includes('-projet.json › preset')), 'aucun preset porteur : la propriété serait vraie à vide').toBe(true);
    expect(porteurs.flatMap(fautesDuPorteur)).toEqual([]);
  });

  it('(f) le spawn n’attache jamais deux fois : Knud Cratinx, Écailles épineuses (EDO 02 ; EDO 11 l.192-196)', () => {
    const knud = porteurs.find((p) => p.ou.includes('preset edo-knud-cratinx'))!;
    const c = knud.spawn();
    expect(effectiveChar(c, 'dexterite')).toBe(19);
    expect(effectiveChar(c, 'sociabilite')).toBe(20);
    attachMutation(c, mutationById('ecailles-epineuses-edoc')!, makeRNG(1));
    expect(effectiveChar(c, 'dexterite'), 'contre-épreuve : une seconde attache se verrait').toBe(9);
  });
  it('Mikael, Tête bestiale (Chien) : Morsure, arme Morsure, Sens aiguisé, Int 20 (EDO 02 ; EDO 11)', () => {
    const mikael = porteurs.find((p) => p.ou.includes('preset edo-mutant-mikael'))!;
    const c = mikael.spawn();
    const morsure = c.traits?.find((t) => t.id === 'morsure' && t.src?.id === 'tete-bestiale-chien');
    expect(morsure).toMatchObject({ id: 'morsure', uid: expect.any(String), value: 5, src: { kind: 'mutation', id: 'tete-bestiale-chien' } });
    expect(c.weapons).toContainEqual(expect.objectContaining({
      uid: morsure?.uid, label: weaponFromTrait({ id: 'morsure', value: 5 })!.label,
    }));
    expect(c.talents).toContainEqual({ talentId: 'sens-aiguise', spec: 'odorat', times: 1 });
    expect(effectiveChar(c, 'intelligence')).toBe(20);
  });
  it('Terenz, Crétin : Int 30 − 40, jusqu’à un minimum de 10 (EDO 11 l.190 ; arbitrage #1853 du 2026-10-04)', () => {
    const terenz = porteurs.find((p) => p.ou.includes('preset edo-mutant-terenz'))!;
    expect(terenz.traits.some((t) => t.id === 'mutation' && t.arg === 'cretin')).toBe(true);
    expect(effectiveChar(terenz.spawn(), 'intelligence')).toBe(10);
  });

  it('déterminisme : même id, même résultat', () => {
    for (const p of porteurs) expect(p.spawn().mutations, p.ou).toEqual(p.spawn().mutations);
  });
});
