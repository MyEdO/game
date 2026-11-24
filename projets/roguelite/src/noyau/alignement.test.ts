import { describe, expect, it } from 'vitest';
import { ESPECES, estUtile, PROFILS, type Profil } from '../jeu';
import { makeRNG, nouvelleRecrue, porterAuNiveau, progression, tirerUneEspece } from './index';
import { levelsForCareer } from '../../../../src/data';

const GRAINES = [1, 2, 3, 4, 5];
/** Les espèces que `tirerUneEspece` donne à la carrière de `p`, sur 300 tirages. */
const especesDe = (p: Profil) => [...new Set(Array.from({ length: 300 }, (_, i) => tirerUneEspece(makeRNG(i), p.id, Object.keys(ESPECES))))];
const recrues = PROFILS.flatMap((p) => especesDe(p).flatMap((espece) => GRAINES.map((graine) => {
  const identite = p.dieux ? { ...p.identite, talent: { ...p.identite.talent, spec: p.dieux[graine % p.dieux.length] } } : p.identite;
  return { p, espece, graine, c: nouvelleRecrue(graine, p.id, espece, 'Essai', identite, estUtile) };
})));
const sommet = (carriere: string) => Math.max(...levelsForCareer(carriere).map((l) => l.level));
/** Les Augmentations hors d'un multiple de 5 de chaque Caractéristique et Compétence que la carrière offre à son
 *  sommet (`progression`). */
const desalignees = (c: Parameters<typeof progression>[0]) => {
  const p = progression({ ...c, careerLevel: sommet(c.career ?? '') });
  return [...p.caracs.map((k) => [k.id, k.points] as const), ...p.competences.map((k) => [`${k.ref.id}:${k.ref.spec ?? ''}`, k.points] as const)].filter(([, n]) => n % 5);
};

describe('les Augmentations de création au pas de 5', () => {
  it('chaque Caractéristique et chaque Compétence de la carrière, tous niveaux, en compte un multiple de 5, à la recrue et au niveau où elle s’engage', () => {
    const ecarts = recrues.flatMap(({ p, espece, graine, c }) => {
      const engagee = porterAuNiveau(c, p.niveau, graine);
      return [...desalignees(c), ...desalignees(engagee)].map(([cle, n]) => `${p.id} × ${espece} @${graine} : ${cle} = ${n}`);
    });
    expect(ecarts).toEqual([]);
  });

  it('les 40 Augmentations de carrière sont toutes dépensées, en plus des 3 × 5 et 3 × 3 d’espèce', () => {
    const totaux = recrues.map(({ p, espece, graine, c }) => `${p.id} × ${espece} @${graine} : ${c.skills.reduce((n, s) => n + s.advances, 0) - (3 * 5 + 3 * 3)}`);
    expect(totaux.filter((t) => !t.endsWith(': 40'))).toEqual([]);
  });

  it('les 5 Augmentations de Caractéristique vont à une seule Caractéristique du niveau 1', () => {
    const ecarts = recrues.flatMap(({ p, espece, graine, c }) => {
      const premieres: readonly string[] = levelsForCareer(p.id).find((l) => l.level === 1)!.characteristics;
      const portees = Object.entries(c.charAdvances ?? {}).filter(([, n]) => n);
      return portees.length === 1 && portees[0][1] === 5 && premieres.includes(portees[0][0]) ? [] : [`${p.id} × ${espece} @${graine} : ${JSON.stringify(c.charAdvances)}`];
    });
    expect(ecarts).toEqual([]);
  });
});
