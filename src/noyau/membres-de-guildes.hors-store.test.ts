import { afterEach, describe, expect, it, vi } from 'vitest';
import { findMerchantArchetypeById } from '../data';
import { giveTrappingSchema } from '../data/schemas/defs-scenes/effets';
import { withBourseMoney } from '../engine/bourse';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { estDisponibiliteTestee } from '../engine/disponibilite';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { setRule } from '../engine/policy';
import { zonesDeLEcran } from '../hote/ecran';
import type { Bouton } from '../hote/elements';
import { fenetreADessiner } from '../hote/gestes';
import { projeter } from '../hote/projection';
import { SANS_ROSTER } from '../hote/roster';
import { battleRng } from './battleRng';
import { imposerLesD100 } from './battleRng.testkit';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { fenetreDuJeu } from './combatAuto';
import { applyEffects } from './combatEffects';
import { initialNet } from './etat';
import { appliquerLIntentionDUnSiege } from './intentionsDeSiege';
import { catalogEntryOf } from './merchantFlow';
import { emptyScene } from './monde/scene';
import { intentAllowedFor } from './netOwnership';

const MEDECIN = 'medecin-du-bourg';
const LICENCE = 'licence-guilde-des-medecins';
const PORTEUR = 'porteur';
const JOUR = 8 * 60;

type Lire = Banc['getState'];

afterEach(() => vi.restoreAllMocks());

function monterMarche({ licence = LICENCE, actif = true, coop = false, gmSeat, settlement = 'village', restockDays }: {
  licence?: string | null;
  actif?: boolean;
  coop?: boolean;
  gmSeat?: number;
  settlement?: 'village' | 'ville';
  restockDays?: number;
} = {}): Lire {
  const banc = ouvrirLeBanc();
  const g = banc.getState;
  const scene = emptyScene('bourg', 4, 4);
  scene.entities.push({
    id: MEDECIN, kind: 'personnage', creature: { id: 'humain' }, pos: { x: 1, y: 1 }, label: 'Médecin',
    merchant: { archetype: { id: 'medecin' }, settlement, restockDays },
  });
  const hote = withBourseMoney(combattantDeTest({
    id: 'hote', label: 'Marchand', kind: 'heros', career: 'marchand', characteristics: { sociabilite: 90 },
  }), { gold: 100, silver: 0, brass: 0 }, idsDeTest);
  const porteur = combattantDeTest({
    id: PORTEUR, label: 'Médecin', kind: 'heros', skills: [{ id: 'ragot', characteristic: 'sociabilite', advances: 20 }],
  });
  const net = coop ? {
    ...initialNet(), mode: 'hote' as const, seatNames: { 0: 'Hôte', 1: 'Invité', 2: 'Meneur' },
    ownership: { hote: 0, [PORTEUR]: 1 }, slots: [0, 1, 2, 0], gmSeat,
  } : initialNet();
  banc.setState({ party: [hote, porteur], scene, gameTime: JOUR, net });
  setRule('marche-membres-de-guildes', actif);
  if (licence !== null) {
    applyEffects(g, banc.setState, [giveTrappingSchema.parse({
      type: 'giveTrapping', objet: { id: licence }, heroId: PORTEUR,
    })]);
    expect(g().party.find((h) => h.id === PORTEUR)?.items?.map((i) => i.trappingId)).toContain(licence);
  }

  g().ouvrirLeMarchand(MEDECIN);
  if (gmSeat !== undefined) {
    expect(etape(g)?.kind).toBe('stockDuMarchand');
    expect(appliquerLIntentionDUnSiege(g, 0, 'jetValider', ['cascade'])).toBe('appliquee');
    fermerBilan(g);
  }
  expect(fenetreDuJeu(g())?.cle).toBe('marchand');
  return g;
}

function etape(g: Lire) {
  const p = g().pendingCascade;
  return p?.participants[p.cursor];
}

function fermerBilan(g: Lire) {
  if (g().pendingCascade) {
    expect(etape(g), 'aucune étape restante au bilan').toBeUndefined();
    g().fenetreFermer('cascade');
  }
}

function articleDeLEtal(g: Lire, id: string): Bouton | undefined {
  const etat = g();
  const projection = projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 });
  const zones = zonesDeLEcran(etat, projection, fenetreADessiner(etat), null, SANS_ROSTER);
  return zones['fenetre.corps'].flatMap((e) => e.type === 'entite' ? e.elements : [])
    .find((e): e is Bouton => e.type === 'bouton' && e.id === id);
}

function echecRare(g: Lire, seuil = 25) {
  const echec = g().merchantStocks[MEDECIN].echecs?.find((e) => e.availability === 'rare' && catalogEntryOf(e.id)?.price);
  expect(echec, 'un article Rare du catalogue réel a raté sa Disponibilité').toBeDefined();
  expect(echec!.roll).toBeGreaterThan(echec!.target);
  expect(echec!.target, 'seuil Rare du lieu avec +10 % du Marchand (LDB 59 l.50)').toBe(seuil);
  return echec!;
}

function tenter(g: Lire, id: string) {
  const bouton = articleDeLEtal(g, id);
  expect(bouton).toMatchObject({ refus: null, jeu: { type: 'fenetreChoisir', args: ['marchand', 'ajouterAuPanier', id] } });
  g().fenetreChoisir('marchand', 'ajouterAuPanier', id);
}

function ouvrirChoix(g: Lire, id: string) {
  tenter(g, id);
  expect(fenetreDuJeu(g())?.cle).toBe('cascade');
  const choix = etape(g);
  expect(choix).toMatchObject({ kind: 'marchand-contact-choix', actorId: PORTEUR });
  expect(choix!.options?.map((o) => o.key)).toEqual(expect.arrayContaining(['consulter', 'renoncer']));
  return choix!.id;
}

const jouerDe = (g: Lire) => g().jetLancer('cascade', etape(g)!.id);

describe('Membres de Guildes — achat et Disponibilité (LDB 68 l.46–48)', () => {
  it.each([
    { actif: false, licence: LICENCE, motif: 'option désactivée' },
    { actif: true, licence: null, motif: 'sans licence' },
    { actif: true, licence: 'licence-guilde-de-droit', motif: 'licence d’une autre Guilde' },
    { actif: true, licence: 'licence-de-guilde', motif: 'licence sans émetteur identifié' },
  ])('l’étal et le geste refusent l’article indisponible — $motif', ({ actif, licence }) => {
    const g = monterMarche({ actif, licence });
    const { id } = echecRare(g);
    expect(articleDeLEtal(g, id)).toBeUndefined();
    g().fenetreChoisir('marchand', 'ajouterAuPanier', id);
    expect(g().pendingCascade).toBeNull();
    expect(g().merchant?.cart).toEqual([]);
  });

  it('la réussite initiale d’un Test de Disponibilité donne le panier ordinaire', () => {
    const g = monterMarche();
    const curated = findMerchantArchetypeById('medecin')?.curated ?? [];
    const ligne = g().merchant?.stock.find(({ id, qty }) =>
      qty > 0 && estDisponibiliteTestee(catalogEntryOf(id)?.availability) && !curated.some((cur) => cur === id));
    expect(ligne).toBeDefined();
    tenter(g, ligne!.id);
    expect(g().pendingCascade).toBeNull();
    expect(g().merchant?.cart).toEqual([{ id: ligne!.id, qty: 1 }]);
  });

  it.each([
    { choix: 'renoncer', succesRagot: false, relance: null },
    { choix: 'consulter', succesRagot: false, relance: null },
    { choix: 'consulter', succesRagot: true, relance: 40 },
    { choix: 'consulter', succesRagot: true, relance: 20 },
  ] as const)('$choix · succès du Ragot $succesRagot · dé de relance $relance', ({ choix, succesRagot, relance }) => {
    const g = monterMarche({ restockDays: choix === 'renoncer' ? 0 : undefined });
    const { id, target } = echecRare(g);
    const avant = g().merchant!.stock;
    const bourse = g().party[0].items;
    imposerLesD100(succesRagot ? 4 : 84, relance ?? 100);
    const rang = ouvrirChoix(g, id);
    expect(g().merchant?.cart).toEqual([]);
    expect(vi.mocked(battleRng().int).mock.calls).toHaveLength(0);

    g().jetRegler('cascade', 'choix', choix, rang);
    g().jetValider('cascade');
    if (choix === 'consulter') {
      expect(etape(g)).toMatchObject({ kind: 'marchand-contact-ragot', actorId: PORTEUR, target: 50, result: null });
      jouerDe(g);
      expect(etape(g)?.result).toMatchObject({ success: succesRagot });
      g().jetValider('cascade');
    }
    if (relance !== null) {
      expect(etape(g)).toMatchObject({ kind: 'marchand-contact-relance', evaluation: 'seuil', target, result: null });
      jouerDe(g);
      expect(etape(g)?.result).toMatchObject({ roll: relance, target, success: relance <= target });
      g().jetValider('cascade');
    }
    fermerBilan(g);

    const attendu = relance !== null && relance <= target;
    expect(vi.mocked(battleRng().int).mock.calls.filter(([min, max]) => min === 1 && max === 100))
      .toHaveLength((choix === 'consulter' ? 1 : 0) + (relance === null ? 0 : 1));
    expect(fenetreDuJeu(g())?.cle).toBe('marchand');
    expect(g().gameTime).toBe(JOUR);
    expect(g().merchantStocks[MEDECIN].rolledAt).toBe(JOUR);
    expect(g().merchant?.stock.filter((l) => l.id !== id)).toEqual(avant);
    expect(g().merchant?.stock.find((l) => l.id === id)?.qty).toBe(attendu ? 1 : undefined);
    expect(g().party[0].items).toEqual(bourse);
    expect(g().merchant?.cart).toEqual([]);

    g().fenetreFermer('marchand');
    g().ouvrirLeMarchand(MEDECIN);
    expect(fenetreDuJeu(g())?.cle).toBe('marchand');
    expect(g().merchantStocks[MEDECIN].echecs?.some((e) => e.id === id), 'même minute, y compris avec réassort à 0 jour').toBe(false);
    if (attendu) {
      tenter(g, id);
      expect(g().merchant?.cart).toEqual([{ id, qty: 1 }]);
    } else {
      expect(articleDeLEtal(g, id)).toBeUndefined();
      g().fenetreChoisir('marchand', 'ajouterAuPanier', id);
    }
    expect(g().pendingCascade).toBeNull();
  });

  it.each([undefined, 2])('les sièges pilotent l’achat, le choix, le Ragot et le monde (siège MJ %s)', (gmSeat) => {
    const enVille = gmSeat !== undefined;
    const g = monterMarche({ coop: true, gmSeat, settlement: enVille ? 'ville' : 'village' });
    const { id } = echecRare(g, enVille ? 40 : 25);
    const admis = (verbe: string, ...args: unknown[]) => [0, 1, 2].filter((s) => intentAllowedFor(g(), s, verbe, args));
    const jouer = (siege: number, verbe: string, ...args: unknown[]) =>
      expect(appliquerLIntentionDUnSiege(g, siege, verbe, args)).toBe('appliquee');
    const achat = ['marchand', 'ajouterAuPanier', id];
    expect(admis('fenetreChoisir', ...achat)).toEqual([0]);
    jouer(0, 'fenetreChoisir', ...achat);

    const choix = ['cascade', 'choix', 'consulter', etape(g)!.id];
    expect(admis('jetRegler', ...choix)).toEqual([1]);
    jouer(1, 'jetRegler', ...choix);
    jouer(1, 'jetValider', 'cascade');
    expect(etape(g)).toMatchObject({ kind: 'marchand-contact-ragot', actorId: PORTEUR });

    imposerLesD100(4, 20, 71);
    expect(admis('jetLancer', 'cascade', etape(g)!.id)).toEqual([1]);
    jouer(1, 'jetLancer', 'cascade', etape(g)!.id);
    jouer(1, 'jetValider', 'cascade');
    expect(etape(g)?.kind).toBe('marchand-contact-relance');

    const monde = gmSeat ?? 0;
    expect(admis('jetLancer', 'cascade', etape(g)!.id)).toEqual([monde]);
    jouer(monde, 'jetLancer', 'cascade', etape(g)!.id);
    jouer(monde, 'jetValider', 'cascade');
    if (enVille) {
      expect(etape(g)).toMatchObject({ kind: 'marchand-contact-quantite', worldOwner: true });
      expect(g().merchant?.stock.some((l) => l.id === id)).toBe(false);
      const quantite = ['cascadeTirage', etape(g)!.id];
      expect(admis('jetLancer', ...quantite)).toEqual([monde]);
      jouer(monde, 'jetLancer', ...quantite);
      expect(etape(g)?.de?.result).toMatchObject({ roll: 8 });
      jouer(monde, 'jetValider', 'cascade');
    }
    fermerBilan(g);
    expect(g().merchant?.stock).toContainEqual({ id, qty: enVille ? 4 : 1 });
  });
});
