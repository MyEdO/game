import { describe, expect, it } from 'vitest';
import {
  acheter, acheterUneArme, acheterUneArmure, acheterUneProvision, ameliorer, armesEnVente, armuresEnVente, nouvellePartie,
  panoplie, panoplieDe, prixDe, provisionsEnVente, provisionsPortees, recrue, ARMES_DE_LA_FORGE, MUNITIONS, PANOPLIES, PROFILS, type Etat,
} from './index';
import { articleDuCatalogue, doter, objetsEnRayon, protection } from '../noyau';
import { equipConflicts } from '../../../src/engine/items';

/** Les Disponibilités qu'ouvre chaque palier de la forge et de l'hospice (arbitrage du 2026-11-23, `CONCEPTION.md`). */
const OUVERTES = [['commune'], ['commune', 'limitee'], ['commune', 'limitee', 'rare'], ['commune', 'limitee', 'rare', 'exotique']];
const DISPONIBILITE = new Map(objetsEnRayon().map((o) => [o.id, o.disponibilite]));
const profilDe = (id: string) => PROFILS.find((p) => p.id === id)!;
/** Une partie riche, la forge et l'hospice bâtis par le jeu (`ameliorer`) jusqu'aux paliers donnés. */
function auHameau(graine: number, forge: number, temple = 0): Etat {
  const e = nouvellePartie(graine);
  e.or = 10_000; e.trophees = 10;
  for (let i = 0; i < forge; i++) expect(ameliorer(e, 'forge')).toBeNull();
  for (let i = 0; i < temple; i++) expect(ameliorer(e, 'temple')).toBeNull();
  return e;
}

describe('la sélection de la forge', () => {
  it('chaque arme de la table est une arme du catalogue de son Groupe, et la sélection couvre chaque Disponibilité', () => {
    for (const [groupe, ids] of Object.entries(ARMES_DE_LA_FORGE)) {
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) expect([id, articleDuCatalogue(id).groupe, DISPONIBILITE.has(id)]).toEqual([id, groupe, true]);
    }
    const disponibilites = new Set(Object.values(ARMES_DE_LA_FORGE).flat().map((id) => DISPONIBILITE.get(id)));
    expect([...disponibilites].sort()).toEqual([...OUVERTES[3]].sort());
  });

  it('chaque palier ouvre une Disponibilité de plus de la sélection, dans les Groupes du héros', () => {
    const vendues = [0, 1, 2, 3].map((palier) => {
      const e = auHameau(2, palier);
      return armesEnVente(e, recrue(e, profilDe('ingenieur'))).map((a) => a.id).sort();
    });
    expect(vendues).toEqual([
      ['arbalete', 'arme-simple', 'bouclier'],
      ['arbalete', 'arme-simple', 'arquebuse', 'bouclier', 'pique-d-armes'],
      ['arbalete', 'arme-simple', 'arquebus-a-repetition', 'arquebuse', 'bouclier', 'pique-d-armes', 'pistolet', 'pistolet-a-repetition'],
      ['arbalete', 'arme-simple', 'arquebus-a-repetition', 'arquebuse', 'bouclier', 'long-fusil-d-hochland', 'pique-d-armes', 'pistolet', 'pistolet-a-repetition'],
    ]);
  });
});

describe('la forge filtre par les Compétences du héros', () => {
  const groupesVendus = (e: Etat, carriere: string) => [...new Set(armesEnVente(e, recrue(e, profilDe(carriere))).map((a) => a.groupe))].sort();

  it('un Soldat sans Projectiles voit les armes de Base et l’arbalète, rien d’autre', () => {
    const e = auHameau(1, 3);
    expect(groupesVendus(e, 'soldat')).toEqual(['arbalete', 'base']);
    const h = recrue(e, profilDe('soldat'));
    e.roster.push(h);
    expect(acheterUneArme(e, h.c.id, 'arquebuse')).toBe('La forge ne la lui vend pas.');
  });

  it('un Duelliste voit la Parade de sa carrière, et à distance la seule Poudre noire avec l’arbalète', () => {
    const e = auHameau(1, 3);
    expect(groupesVendus(e, 'duelliste')).toEqual(expect.arrayContaining(['base', 'parade']));
    const aDistance = armesEnVente(e, recrue(e, profilDe('duelliste'))).filter((a) => a.categorie === 'distance');
    expect([...new Set(aDistance.map((a) => a.groupe))].sort()).toEqual(['arbalete', 'poudre-noire']);
  });

  it('un Chasseur de primes voit les Entraves et l’arbalète de sa carrière', () => {
    expect(groupesVendus(auHameau(1, 3), 'chasseur-de-primes')).toEqual(['arbalete', 'base', 'entraves']);
  });
});

describe('les achats de la forge', () => {
  it('l’Ingénieur achète une arme d’ingénierie au palier rare, avec ses munitions', () => {
    const e = auHameau(2, 2);
    const h = recrue(e, profilDe('ingenieur'));
    e.roster.push(h);
    expect(acheterUneArme(e, h.c.id, 'pistolet-a-repetition')).toBeNull();
    expect(panoplie(h).tir).toMatchObject({ id: 'pistolet-a-repetition', munitions: { label: 'Balle et Poudre' } });
    expect(panoplie(h).tir?.munitions?.nombre).toBeGreaterThan(0);
  });

  it('une arme à distance dont la fiche ne nomme aucune munition reçoit celle de sa famille', () => {
    const e = auHameau(3, 1);
    const h = recrue(e, profilDe('ingenieur'));
    e.roster.push(h);
    expect(acheterUneArme(e, h.c.id, 'arquebuse')).toBeNull();
    expect(MUNITIONS.arquebuse).toBe('balle-et-poudre');
    expect(panoplie(h).tir?.munitions?.nombre).toBeGreaterThan(0);
  });

  it('l’arbalète va au set de tir d’un héros sans Projectiles et lui laisse son arme de mêlée', () => {
    const e = auHameau(7, 0);
    const h = recrue(e, profilDe('soldat'));
    e.roster.push(h);
    const melee = panoplie(h).main!.id;
    expect(acheterUneArme(e, h.c.id, 'arbalete')).toBeNull();
    expect(panoplie(h)).toMatchObject({ main: { id: melee }, tir: { id: 'arbalete' } });
  });

  it('le Duelliste de niveau 3 qui manie deux armes achète un second pistolet, tenu en main secondaire du set de tir', () => {
    const e = auHameau(6, 2);
    for (let i = 0; i < 2; i++) expect(ameliorer(e, 'salle')).toBeNull();
    const h = recrue(e, { ...profilDe('duelliste'), niveau: 3 });
    e.roster.push(h);
    h.c.xp = 1000;
    expect(acheter(e, h.c.id, { genre: 'talent', ref: { id: 'maniement-de-deux-armes' } })).toBeNull();
    const premier = panoplie(h).tir!.id!;
    expect(acheterUneArme(e, h.c.id, 'pistolet')).toBeNull();
    const tir = h.c.loadouts!.find((l) => h.c.items!.find((i) => i.uid === l.main)?.trappingId === premier)!;
    expect(h.c.items!.find((i) => i.uid === tir.secondaire)?.trappingId).toBe('pistolet');
  });
});

describe('panoplies de la forge', () => {
  it('chaque panoplie s’ouvre au palier de la Disponibilité de sa pièce la plus rare', () => {
    expect([0, 1, 2, 3].map((palier) => armuresEnVente(auHameau(1, palier)).map((a) => a.id))).toEqual([
      ['legere'], ['legere', 'moyenne'], ['legere', 'moyenne', 'lourde'], ['legere', 'moyenne', 'lourde'],
    ]);
  });

  it('une panoplie couvre les quatre zones sans pièce de même couche sur une même localisation', () => {
    for (const p of PANOPLIES) {
      const portees: ReturnType<typeof doter> = [];
      for (const piece of doter(p.pieces, p.id)) {
        expect(equipConflicts({ items: portees }, { ...piece, equipped: true })).toEqual([]);
        portees.push({ ...piece, equipped: true });
      }
    }
    for (const a of armuresEnVente(auHameau(1, 2))) expect(a.pa.every((z) => z.pa > 0)).toBe(true);
  });

  it('l’offre dit le prix et l’Encombrement de ses pièces, et leurs Défauts', () => {
    const lourde = armuresEnVente(auHameau(1, 2)).find((a) => a.id === 'lourde')!;
    const pieces = PANOPLIES.find((p) => p.id === 'lourde')!.pieces;
    expect(lourde.prix).toBe(pieces.reduce((n, id) => n + prixDe(id), 0));
    expect(lourde.enc).toBe(19);
    expect(lourde.qualites.filter((q) => q.defaut).map((q) => q.nom)).toContain('Points faibles');
    expect(new Set(lourde.qualites.map((q) => q.nom)).size).toBe(lourde.qualites.length);
  });

  it('l’achat laisse toute l’armure portée au forgeron et revêt la panoplie, aux PA de l’offre', () => {
    const e = auHameau(4, 1);
    const h = recrue(e, profilDe('soldat'));
    e.roster.push(h);
    expect(h.c.items!.some((i) => i.trappingId === 'plastron-de-cuir')).toBe(true);
    const or = e.or;
    const moyenne = armuresEnVente(e).find((a) => a.id === 'moyenne')!;
    expect(acheterUneArmure(e, h.c.id, 'moyenne')).toBeNull();
    expect(e.or).toBe(or - moyenne.prix);
    const armures = h.c.items!.filter((i) => i.kind === 'armor');
    expect(armures.map((i) => i.trappingId).sort()).toEqual([...PANOPLIES.find((p) => p.id === 'moyenne')!.pieces].sort());
    expect(armures.every((i) => i.equipped)).toBe(true);
    expect(protection(h.c)).toEqual(moyenne.pa);
    expect(panoplie(h).armure).toMatchObject({ label: 'Armure de mailles', panoplie: 'moyenne' });
    expect(acheterUneArmure(e, h.c.id, 'moyenne')).toBe('Il la porte déjà.');
    expect(acheterUneArmure(e, h.c.id, 'legere')).toBeNull();
    expect(h.c.items!.filter((i) => i.kind === 'armor').map((i) => i.trappingId).sort()).toEqual([...PANOPLIES.find((p) => p.id === 'legere')!.pieces].sort());
    expect(panoplieDe(h)?.id).toBe('legere');
  });
});

describe('potions et remèdes à l’Hospice de Shallya', () => {
  it('le relais ne vend pas la potion de guérison ; l’hospice relevé la vend', () => {
    const e = auHameau(5, 0);
    for (let i = 0; i < 2; i++) expect(ameliorer(e, 'relais')).toBeNull();
    const h = recrue(e, profilDe('soldat'));
    e.roster.push(h);
    expect(acheterUneProvision(e, h.c.id, 'potion-de-guerison')).toBe('L’hospice n’en vend pas encore.');
    expect(ameliorer(e, 'temple')).toBeNull();
    expect(provisionsEnVente(e).map((a) => a.id)).toContain('potion-de-guerison');
    expect(acheterUneProvision(e, h.c.id, 'potion-de-guerison')).toBeNull();
    expect(provisionsPortees(h).map((p) => p.id)).toEqual(['potion-de-guerison']);
  });

  it('chaque palier de l’hospice relevé ouvre une Disponibilité de plus de sa sélection', () => {
    expect([1, 2, 3].map((palier) => provisionsEnVente(auHameau(1, 0, palier)).map((a) => a.id).sort())).toEqual([
      ['cataplasme-de-guerison', 'potion-de-guerison', 'potion-de-vitalite', 'soude-commune'],
      ['cataplasme-de-guerison', 'potion-de-guerison', 'potion-de-vitalite', 'racine-des-tombes', 'soude-commune'],
      ['cataplasme-de-guerison', 'faxtoryll', 'potion-de-guerison', 'potion-de-vitalite', 'racine-des-tombes', 'soude-commune'],
    ]);
  });
});
