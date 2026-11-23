import { describe, expect, it } from 'vitest';
import { acheter, acheterUneArmure, ameliorer, dieuDe, nouvellePartie, offresDeCarriere, panoplie, recrue, roleDe, voieDe, PROFILS, type Etat, type Heros } from './index';
import { porterAuNiveau } from '../noyau';

const profilDe = (id: string) => PROFILS.find((p) => p.id === id)!;
/** Une partie au relais `palier`, bâti par le jeu (`ameliorer`). */
function auRelais(graine: number, palier: number): Etat {
  const e = nouvellePartie(graine);
  e.or = 10_000; e.trophees = 10;
  for (let i = 0; i < palier; i++) expect(ameliorer(e, 'relais')).toBeNull();
  return e;
}

describe('recrues du relais', () => {
  it('une recrue de niveau 2 sort du noyau au niveau 2, son niveau 1 complété, sans PX restant', () => {
    const h = recrue(nouvellePartie(3), profilDe('repurgateur'));
    const o = offresDeCarriere(h);
    expect(h.c.careerLevel).toBe(2);
    expect(h.c.xp ?? 0).toBe(0);
    expect(o.niveau).toBe(2);
    expect(o.suivant?.niveau).toBe(3);
    for (const k of ['capacite-de-combat', 'endurance', 'force-mentale'] as const) expect(h.c.charAdvances?.[k] ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('les candidats d’un même tirage ont des rôles distincts', () => {
    for (let graine = 1; graine <= 10; graine++) {
      for (const palier of [0, 1, 2]) {
        const e = auRelais(graine, palier);
        const roles = e.candidats.map((c) => roleDe(c.carriere));
        expect(roles).toHaveLength(2 + palier);
        expect(new Set(roles).size).toBe(roles.length);
      }
    }
  });

  it('la recrue tire une espèce que sa carrière admet', () => {
    const e = nouvellePartie(5);
    for (let i = 0; i < 6; i++) {
      expect(recrue(e, profilDe('tueur')).espece).toBe('nains');
      expect(recrue(e, profilDe('nonne')).espece).toBe('humains-reiklander');
    }
  });

  it('l’Ingénieur s’engage au niveau 2, Artilleur, un pistolet et ses balles au set de tir', () => {
    const h = recrue(nouvellePartie(4), profilDe('ingenieur'));
    expect(h.c.careerLevel).toBe(2);
    expect(h.c.talents.some((t) => t.talentId === 'artilleur')).toBe(true);
    const tir = panoplie(h).tir;
    expect(tir?.id).toBe('pistolet');
    expect(tir?.munitions?.nombre).toBeGreaterThan(0);
  });

  it('le Répurgateur reçoit la dotation de son niveau 2, une seule arme à feu ou de poing tirée', () => {
    const e = nouvellePartie(6);
    for (let i = 0; i < 6; i++) {
      const h = recrue(e, profilDe('repurgateur'));
      const tirs = (h.c.items ?? []).filter((x) => x.trappingId === 'pistolet' || x.trappingId === 'arbalete-de-poing');
      expect(tirs).toHaveLength(1);
      expect(panoplie(h).tir?.id).toBe(tirs[0].trappingId);
    }
  });

  it('le Tueur tient sa hache de carrière ; Maniement de deux armes acquis, sa meilleure autre arme à une main va en main secondaire', () => {
    const e = auRelais(8, 1);
    expect(ameliorer(e, 'salle')).toBeNull();
    const h = recrue(e, profilDe('tueur'));
    e.roster.push(h);
    const tenue = (uid?: string) => h.c.items?.find((i) => i.uid === uid);
    const melee = () => h.c.loadouts!.find((l) => tenue(l.main)?.kind === 'melee')!;
    expect(tenue(melee().main)?.spec).toBe('Hache');
    expect(tenue(melee().secondaire)?.trappingId).toBe('dague');
    h.c.xp = 1000;
    expect(acheter(e, h.c.id, { genre: 'talent', ref: { id: 'maniement-de-deux-armes' } })).toBeNull();
    expect(tenue(melee().main)?.spec).toBe('Hache');
    expect(tenue(melee().secondaire)?.trappingId).toBe('arme-simple');
  });

  it('le lanceur est une carrière de Collège, sa voie la Magie des Arcanes de son domaine, et la partie en tire un au relais 0', () => {
    const colleges = PROFILS.filter((p) => p.role === 'lanceur');
    expect(colleges.map((p) => p.id).sort()).toEqual(['alchimiste', 'chamane', 'druide', 'hierophante', 'pyromancien', 'spirite']);
    for (const palier of [0, 1, 2]) expect(colleges.some((p) => p.relais === palier)).toBe(true);
    const feu = voieDe('pyromancien', { talents: [] })!;
    expect(feu).toMatchObject({ talent: 'magie-des-arcanes', spec: 'feu' });
    expect(feu.sorts).toContainEqual({ id: 'cauteriser', niveau: 2 });
    const tires = new Set(Array.from({ length: 12 }, (_, g) => nouvellePartie(g).roster[3].carriere));
    expect([...tires].sort()).toEqual(colleges.filter((p) => p.relais === 0).map((p) => p.id).sort());
  });

  it('le Prêtre-guerrier tire son dieu parmi Sigmar, Ulric et Myrmidia ; son Béni et sa voie le suivent', () => {
    const e = nouvellePartie(9);
    const dieux = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const h = recrue(e, profilDe('pretre-guerrier'));
      const dieu = dieuDe(h.c)!;
      dieux.add(dieu);
      expect(voieDe(h.carriere, h.c)).toMatchObject({ talent: 'invocation', spec: dieu });
      expect(voieDe(h.carriere, h.c)!.sorts.length).toBeGreaterThan(0);
    }
    expect([...dieux].sort()).toEqual(['myrmidia', 'sigmar', 'ulric']);
  });
});

describe('forge : l’armure qui gêne l’Incantation', () => {
  /** Un mage du Collège `id` au niveau 2, sa Magie des Arcanes achetée à la salle d'armes, la forge au palier 1. */
  function mage(id: string): { e: Etat; h: Heros } {
    const e = auRelais(11, 0);
    expect(ameliorer(e, 'salle')).toBeNull();
    expect(ameliorer(e, 'forge')).toBeNull();
    const h = recrue(e, profilDe(id));
    h.c = porterAuNiveau(h.c, 2, 99);
    h.c.xp = 1000;
    e.roster.push(h);
    const voie = voieDe(id, h.c)!;
    expect(acheter(e, h.c.id, { genre: 'talent', ref: { id: voie.talent, spec: voie.spec } })).toBeNull();
    return { e, h };
  }

  it('l’armure se refuse sur la panoplie entière : l’Alchimiste porte les mailles, le Chamane le cuir', () => {
    const alchimiste = mage('alchimiste');
    expect(acheterUneArmure(alchimiste.e, alchimiste.h.c.id, 'moyenne')).toBeNull();
    expect(acheterUneArmure(alchimiste.e, alchimiste.h.c.id, 'legere')).toMatch(/^Armure de cuir : −1 DR/);
    const chamane = mage('chamane');
    expect(acheterUneArmure(chamane.e, chamane.h.c.id, 'legere')).toBeNull();
    const or = chamane.e.or;
    expect(acheterUneArmure(chamane.e, chamane.h.c.id, 'moyenne')).toMatch(/^Armure de mailles : −2 DR/);
    expect(chamane.e.or).toBe(or);
  });
});
