import { describe, expect, it } from 'vitest';
import {
  acheter, acheterUneArme, acheterUneArmure, acheterUneProvision, ameliorer, armesEnVente, armuresEnVente, nouvellePartie,
  panoplie, panoplieDe, prixDe, voieDe, provisionsEnVente, provisionsPortees, recrue, ARMES_DE_LA_FORGE, MUNITIONS, PANOPLIES, PROFILS, type Etat,
} from './index';
import { articleDuCatalogue, doter, objetsEnRayon, porterAuNiveau, protection } from '../noyau';
import { equipConflicts, wornArmourPoints } from '../../../src/engine/items';

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
  const soldat = (e: Etat) => { const h = recrue(e, profilDe('soldat')); e.roster.push(h); return h; };
  /** Un lanceur de sorts de la carrière `id`, sa Voie apprise au jeu (`acheter`), à la forge de palier 2. */
  const mage = (id: string) => {
    const e = auHameau(11, 2);
    expect(ameliorer(e, 'salle')).toBeNull();
    const h = recrue(e, profilDe(id));
    h.c = porterAuNiveau(h.c, 2, 99);
    h.c.xp = 1000;
    e.roster.push(h);
    const voie = voieDe(id, h.c)!;
    expect(acheter(e, h.c.id, { genre: 'talent', ref: { id: voie.talent, spec: voie.spec } })).toBeNull();
    return { e, h };
  };

  it('chaque panoplie s’ouvre au palier de la Disponibilité de sa pièce la plus rare', () => {
    expect([0, 1, 2, 3].map((palier) => { const e = auHameau(1, palier); return armuresEnVente(e, soldat(e)).map((a) => a.id); })).toEqual([
      ['pa-1'], ['pa-1', 'pa-2', 'pa-3'], ['pa-1', 'pa-2', 'pa-3', 'pa-4', 'pa-5'], ['pa-1', 'pa-2', 'pa-3', 'pa-4', 'pa-5'],
    ]);
  });

  it('chaque composition de la panoplie pa-N porte N PA sur chaque localisation, sans pièce de même couche sur une même localisation', () => {
    for (const [n, p] of PANOPLIES.entries()) {
      expect(p.id).toBe(`pa-${n + 1}`);
      for (const x of p.compositions) {
        const portees: ReturnType<typeof doter> = [];
        for (const piece of doter(x.pieces, p.id)) {
          expect(equipConflicts({ items: portees }, { ...piece, equipped: true })).toEqual([]);
          portees.push({ ...piece, equipped: true });
        }
        expect([x.label, wornArmourPoints(portees)]).toEqual([x.label, { tete: n + 1, brasG: n + 1, brasD: n + 1, corps: n + 1, jambeG: n + 1, jambeD: n + 1 }]);
      }
      const e = auHameau(1, 2);
      const h = soldat(e);
      expect(acheterUneArmure(e, h.c.id, p.id)).toBeNull();
      expect(h.c.armour).toEqual({ tete: n + 1, brasG: n + 1, brasD: n + 1, corps: n + 1, jambeG: n + 1, jambeD: n + 1 });
    }
  });

  it('au guerrier, la forge vend à chaque niveau la composition la plus légère : le niveau 4 ne pèse pas plus que le 5', () => {
    const e = auHameau(1, 2);
    const offres = armuresEnVente(e, soldat(e));
    const [pa4, pa5] = ['pa-4', 'pa-5'].map((id) => offres.find((a) => a.id === id)!);
    expect(pa4.label).toBe(PANOPLIES.find((p) => p.id === 'pa-4')!.compositions[0].label);
    expect(pa4.enc).toBeLessThanOrEqual(pa5.enc);
    expect(pa4.prix).toBeLessThanOrEqual(pa5.prix);
  });

  it('à l’Alchimiste, la forge vend le niveau 4 tout métal, qu’il porte sans perdre de DR', () => {
    const { e, h } = mage('alchimiste');
    const pa4 = armuresEnVente(e, h).find((a) => a.id === 'pa-4')!;
    const metal = PANOPLIES.find((p) => p.id === 'pa-4')!.compositions.find((x) => x.label === pa4.label)!;
    expect(metal.pieces.map((id) => articleDuCatalogue(id).groupe).filter((g) => g !== 'mailles' && g !== 'plate')).toEqual([]);
    expect(acheterUneArmure(e, h.c.id, 'pa-4')).toBeNull();
    expect(panoplieDe(h)).toMatchObject({ id: 'pa-4', label: pa4.label });
  });

  it('l’offre dit le prix de ses pièces, leur Encombrement une fois revêtues, et leurs Défauts', () => {
    const e = auHameau(1, 2);
    const harnois = armuresEnVente(e, soldat(e)).find((a) => a.id === 'pa-5')!;
    const pieces = PANOPLIES.find((p) => p.id === 'pa-5')!.compositions[0].pieces;
    expect(harnois.prix).toBe(pieces.reduce((n, id) => n + prixDe(id), 0));
    expect(harnois.enc).toBe(10);
    expect(harnois.qualites.filter((q) => q.defaut).map((q) => q.nom)).toContain('Points faibles');
    expect(new Set(harnois.qualites.map((q) => q.nom)).size).toBe(harnois.qualites.length);
  });

  it('l’offre dit les pénalités de port que le noyau cumule pièce à pièce, chacune une fois par Compétence', () => {
    const { e, h } = mage('alchimiste');
    const noms = armuresEnVente(e, h).find((a) => a.id === 'pa-4')!.qualites.map((q) => q.nom);
    expect(noms.filter((n) => n.includes('% en'))).toEqual(['-70 % en discretion', '-20 % en perception']);
  });

  it('l’achat laisse toute l’armure portée au forgeron et revêt la panoplie, aux PA de l’offre', () => {
    const e = auHameau(4, 1);
    const h = soldat(e);
    expect(h.c.items!.some((i) => i.trappingId === 'plastron-de-cuir')).toBe(true);
    const or = e.or;
    const mailles = armuresEnVente(e, h).find((a) => a.id === 'pa-2')!;
    expect(acheterUneArmure(e, h.c.id, 'pa-2')).toBeNull();
    expect(e.or).toBe(or - mailles.prix);
    const armures = h.c.items!.filter((i) => i.kind === 'armor');
    expect(armures.map((i) => i.trappingId).sort()).toEqual([...PANOPLIES.find((p) => p.id === 'pa-2')!.compositions[0].pieces].sort());
    expect(armures.every((i) => i.equipped)).toBe(true);
    expect(protection(h.c)).toEqual(mailles.pa);
    expect(panoplie(h).armure).toMatchObject({ label: 'Mailles', panoplie: 'pa-2', enc: mailles.enc });
    expect(acheterUneArmure(e, h.c.id, 'pa-2')).toBe('Il la porte déjà.');
    expect(acheterUneArmure(e, h.c.id, 'pa-1')).toBeNull();
    expect(h.c.items!.filter((i) => i.kind === 'armor').map((i) => i.trappingId).sort()).toEqual([...PANOPLIES.find((p) => p.id === 'pa-1')!.compositions[0].pieces].sort());
    expect(panoplieDe(h)?.id).toBe('pa-1');
  });

  it('la forge refuse au Pyromancien toute panoplie, et vend à l’Alchimiste les panoplies tout métal', () => {
    const refus = (id: string) => {
      const { e, h } = mage(id);
      return PANOPLIES.map((p) => acheterUneArmure(structuredClone(e), h.c.id, p.id)?.match(/−\d DR/)?.[0] ?? null);
    };
    expect(refus('pyromancien')).toEqual(['−1 DR', '−2 DR', '−3 DR', '−4 DR', '−5 DR']);
    expect(refus('alchimiste')).toEqual(['−1 DR', null, '−1 DR', null, '−3 DR']);
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
