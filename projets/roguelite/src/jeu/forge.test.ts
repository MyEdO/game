import { beforeAll, describe, expect, it } from 'vitest';
import {
  acheter, acheterUneArme, acheterUneArmure, acheterUneProvision, ameliorer, armesEnVente, armuresEnVente, nouvellePartie,
  allure, panoplie, prixDe, voieDe, provisionsEnVente, provisionsPortees, recrue, ARMES_DE_LA_FORGE, MUNITIONS, PROFILS, type Etat,
} from './index';
import { articleDuCatalogue, DISPONIBILITES, doter, objetsEnRayon, porterAuNiveau, protection, poserLesReglesDuRoguelite } from '../noyau';

beforeAll(() => poserLesReglesDuRoguelite());

/** Les Disponibilités qu'ouvre chaque palier de la forge et de l'hospice (arbitrage du 2026-11-23, MyEdO/game#4947). */
const OUVERTES = [1, 2, 3, 4].map((n) => DISPONIBILITES.slice(0, n));
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
      ['arbalete', 'arc', 'arme-simple', 'bouclier'],
      ['arbalete', 'arc', 'arc-long', 'arme-simple', 'arquebuse', 'bouclier', 'pique-d-armes'],
      ['arbalete', 'arc', 'arc-long', 'arme-simple', 'arquebus-a-repetition', 'arquebuse', 'bouclier', 'pique-d-armes', 'pistolet', 'pistolet-a-repetition'],
      ['arbalete', 'arc', 'arc-elfique', 'arc-long', 'arme-simple', 'arquebus-a-repetition', 'arquebuse', 'bouclier', 'long-fusil-d-hochland', 'pique-d-armes', 'pistolet', 'pistolet-a-repetition'],
    ]);
  });
});

describe('la forge filtre par les Compétences du héros', () => {
  const groupesVendus = (e: Etat, carriere: string) => [...new Set(armesEnVente(e, recrue(e, profilDe(carriere))).map((a) => a.groupe))].sort();

  it('un Soldat humain voit les armes de Base, l’arbalète et l’arc de ses Projectiles (Arc) d’espèce, rien d’autre', () => {
    const e = auHameau(1, 3);
    const h = recrue(e, profilDe('soldat'));
    expect([h.espece, h.c.skills.filter((s) => s.id === 'projectiles').map((s) => s.spec)]).toEqual(['humains-reiklander', ['arc']]);
    expect([...new Set(armesEnVente(e, h).map((a) => a.groupe))].sort()).toEqual(['arbalete', 'arc', 'base']);
    e.roster.push(h);
    expect(acheterUneArme(e, h.c.id, 'arquebuse')).toBe('La forge ne la lui vend pas.');
  });

  it('un Duelliste voit la Parade de sa carrière, et à distance la Poudre noire et l’arbalète de sa carrière avec l’arc de ses Compétences d’espèce', () => {
    const e = auHameau(1, 3);
    expect(groupesVendus(e, 'duelliste')).toEqual(expect.arrayContaining(['base', 'parade']));
    const aDistance = armesEnVente(e, recrue(e, profilDe('duelliste'))).filter((a) => a.categorie === 'distance');
    expect([...new Set(aDistance.map((a) => a.groupe))].sort()).toEqual(['arbalete', 'arc', 'poudre-noire']);
  });

  it('un Chasseur de primes voit les Entraves et l’arbalète de sa carrière, l’arc de ses Compétences d’espèce', () => {
    expect(groupesVendus(auHameau(1, 3), 'chasseur-de-primes')).toEqual(['arbalete', 'arc', 'base', 'entraves']);
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

describe('armures de la forge', () => {
  const soldat = (e: Etat) => { const h = recrue(e, profilDe('soldat')); e.roster.push(h); return h; };
  const partout = (n: number) => ['Tête', 'Bras', 'Corps', 'Jambes'].map((zone) => ({ zone, pa: n }));
  const armuresDe = (h: ReturnType<typeof soldat>) => h.c.items!.filter((i) => i.kind === 'armor').map((i) => i.trappingId).sort();
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

  it('la forge vend exactement les trois armures de l’option, chacune au palier de sa Disponibilité (LDB 63 l.101-103)', () => {
    expect([0, 1, 2, 3].map((palier) => { const e = auHameau(1, palier); return armuresEnVente(e, soldat(e)).map((a) => a.id); })).toEqual([
      ['armure-legere'], ['armure-legere', 'armure-moyenne'], ['armure-legere', 'armure-moyenne', 'armure-lourde'], ['armure-legere', 'armure-moyenne', 'armure-lourde'],
    ]);
  });

  it('l’achat laisse au forgeron l’armure par pièces et revêt l’armure d’une pièce sur toutes les Localisations', () => {
    const e = auHameau(4, 1);
    const h = soldat(e);
    expect(h.c.items!.some((i) => i.trappingId === 'plastron-de-cuir')).toBe(true);
    const or = e.or;
    const moyenne = armuresEnVente(e, h).find((a) => a.id === 'armure-moyenne')!;
    expect(acheterUneArmure(e, h.c.id, 'armure-moyenne')).toBeNull();
    expect(e.or).toBe(or - moyenne.prix);
    expect(armuresDe(h)).toEqual(['armure-moyenne']);
    expect(h.c.items!.find((i) => i.kind === 'armor')!.equipped).toBe(true);
    expect(protection(h.c)).toEqual(partout(2));
    expect(protection(h.c)).toEqual(moyenne.pa);
    expect(panoplie(h).armure).toMatchObject({ label: 'Armure moyenne', enc: moyenne.enc });
    expect(allure(h).armure).toEqual({ poids: 'armure-moyenne', bras: true, jambes: true });
    expect(acheterUneArmure(e, h.c.id, 'armure-moyenne')).toBe('Il la porte déjà.');
    expect(armuresEnVente(e, h).map((a) => a.id)).toEqual(['armure-legere']);
  });

  it('une armure Flexible se garde sous la lourde ; deux Flexibles ne se superposent pas (LDB 63 l.74)', () => {
    const porte = (ids: string[]) => {
      const e = auHameau(2, 2), h = soldat(e);
      for (const id of ids) expect(acheterUneArmure(e, h.c.id, id)).toBeNull();
      return { armures: armuresDe(h), pa: protection(h.c) };
    };
    expect(porte(['armure-legere', 'armure-lourde'])).toEqual({ armures: ['armure-legere', 'armure-lourde'], pa: partout(4) });
    expect(porte(['armure-lourde', 'armure-moyenne'])).toEqual({ armures: ['armure-lourde', 'armure-moyenne'], pa: partout(5) });
    expect(porte(['armure-moyenne', 'armure-legere'])).toEqual({ armures: ['armure-legere'], pa: partout(1) });
  });

  it('l’offre dit ce que le héros porterait : PA, Encombrement et Défauts de l’armure et de ce qu’il garde dessous', () => {
    const e = auHameau(1, 2), h = soldat(e);
    expect(acheterUneArmure(e, h.c.id, 'armure-moyenne')).toBeNull();
    const lourde = armuresEnVente(e, h).find((a) => a.id === 'armure-lourde')!;
    expect(lourde.prix).toBe(prixDe('armure-lourde'));
    expect(lourde.pa).toEqual(partout(5));
    expect(lourde.enc).toBeGreaterThan(panoplie(h).armure!.enc);
    expect(lourde.qualites.filter((q) => q.defaut).map((q) => q.nom)).toContain('Points faibles');
    expect(new Set(lourde.qualites.map((q) => q.nom)).size).toBe(lourde.qualites.length);
  });

  it('une sauvegarde qui porte une ancienne panoplie de mailles se charge, se lit en armure moyenne et se remplace à la forge', () => {
    const e = auHameau(3, 2), h = soldat(e);
    h.c.items = [...h.c.items!.filter((i) => i.kind !== 'armor'), ...doter(['coiffe-de-mailles', 'cotte-de-mailles', 'chausses-de-mailles'], 'v2').map((i) => ({ ...i, equipped: true }))];
    const relue = JSON.parse(JSON.stringify(e)) as Etat, r = relue.roster.find((x) => x.c.id === h.c.id)!;
    expect(allure(r).armure?.poids).toBe('armure-moyenne');
    expect(armuresEnVente(relue, r).map((a) => a.id)).toEqual(['armure-legere', 'armure-moyenne', 'armure-lourde']);
    expect(acheterUneArmure(relue, r.c.id, 'armure-lourde')).toBeNull();
    expect([armuresDe(r), protection(r.c)]).toEqual([['armure-lourde'], partout(3)]);
  });

  it('la forge refuse au Pyromancien toute armure, et vend à l’Alchimiste les armures de métal', () => {
    const refus = (id: string) => {
      const { e, h } = mage(id);
      return ['armure-legere', 'armure-moyenne', 'armure-lourde'].map((a) => acheterUneArmure(structuredClone(e), h.c.id, a)?.match(/−\d DR/)?.[0] ?? null);
    };
    expect(refus('pyromancien')).toEqual(['−1 DR', '−2 DR', '−3 DR']);
    expect(refus('alchimiste')).toEqual(['−1 DR', null, null]);
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
