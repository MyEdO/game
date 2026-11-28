/**
 * LES FAITS APPLIQUÉS (#4574 lot 3) : chaque ligne de la classe que rend `applyOps` (Blessures, Avantage, État,
 * Corruption, argent) naît de son fait. Les lignes attendues sont celles que rendait le journal avant les faits,
 * à l'octet ; les faits sont le contrat positif de chaque genre.
 */
import { describe, it, expect } from 'vitest';
import { idsDeTest } from './idsDeTest.testkit';
import type { Combatant, Weapon } from './types';
import { applyOps, type OpsCtx, type GameOp } from './ops';
import { addCondition, syncDerivedConditions, COND } from './conditions';
import { texteDuFait, type Applique, type FaitApplique, type FaitAvecLigne } from './faits';
import { poserLeNommeur } from './nom';
import { ligneDeTexte } from './journal';
import { fixtureText } from '../i18n/fixtureText';
import { desDuTest } from './dice.testkit';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

/** Les genres que le journal dit par leur ligne (`texteDuFait`) : le contrat positif. */
const GENRES_AVEC_LIGNE: readonly FaitApplique['genre'][] = ['blessures', 'avantage', 'etat', 'corruption', 'argent'];
const avecLigne = (f: FaitApplique): f is FaitAvecLigne => GENRES_AVEC_LIGNE.includes(f.genre);

function heros(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'h', label: 'Cobaye', kind: 'heros',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 35 },
    wounds: blessuresDeBase(20, 10), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], items: [], diseases: [],
    ...p,
  }) as Combatant;
}
const ctx = (x: Partial<OpsCtx> = {}): OpsCtx => ({ idNeuf: idsDeTest, rng: desDuTest, now: 0, ...x });
const EPEE = { label: 'Épée', type: 'melee', damage: { flat: 4, plusBF: true }, qualities: [], reach: 'Moyenne' } as unknown as Weapon;
const appliquer = (ops: GameOp[], c = heros(), x: Partial<OpsCtx> = {}): Applique => applyOps(c, ops, ctx(x));
const sur = { cible: 'h', camp: 'groupe' } as const;

/** `source` : le libellé du lot (`OpsCtx.label`) que la ligne nomme, argument de rendu jamais porté par le fait. */
interface Cas { nom: string; jouer: () => Applique; lignes: string[]; faits: FaitApplique[]; source?: string }

const CORPUS: Cas[] = [
  { nom: 'Blessures d’un coup d’arme', jouer: () => appliquer([{ op: 'wounds', amount: 12, weaponHit: true }], heros(), { weapon: EPEE, location: 'corps' }),
    lignes: ['Cobaye subit 6 Blessure(s).'], faits: [{ genre: 'blessures', ...sur, valeur: -6 }] },
  { nom: 'Blessures sans atténuation', jouer: () => appliquer([{ op: 'wounds', amount: 3 }]),
    lignes: ['Cobaye subit 3 Blessure(s) (ignorant BE et PA).'], faits: [{ genre: 'blessures', ...sur, valeur: -3, mitigation: 'sans' }] },
  { nom: 'Blessures après PA et BE', jouer: () => appliquer([{ op: 'wounds', amount: 9, ignoreTB: false, ignoreAP: false }]),
    lignes: ['Cobaye subit 3 Blessure(s) (PA, BE déduit).'], faits: [{ genre: 'blessures', ...sur, valeur: -3, mitigation: { pa: 'touches', be: 'deduit' } }] },
  { nom: 'Blessures après PA seuls', jouer: () => appliquer([{ op: 'wounds', amount: 9, ignoreAP: false }]),
    lignes: ['Cobaye subit 7 Blessure(s) (PA, BE ignoré).'], faits: [{ genre: 'blessures', ...sur, valeur: -7, mitigation: { pa: 'touches', be: 'ignore' } }] },
  { nom: 'Blessures après BE seule', jouer: () => appliquer([{ op: 'wounds', amount: 9, ignoreTB: false }]),
    lignes: ['Cobaye subit 5 Blessure(s) (PA ignorés, BE déduit).'], faits: [{ genre: 'blessures', ...sur, valeur: -5, mitigation: { pa: 'ignores', be: 'deduit' } }] },
  { nom: 'soin', jouer: () => appliquer([{ op: 'heal', amount: 4 }]),
    lignes: ['Cobaye regagne 4 Blessure(s).'], faits: [{ genre: 'blessures', ...sur, valeur: 4 }] },
  { nom: 'soin plafonné', jouer: () => appliquer([{ op: 'heal', amount: 40 }]),
    lignes: ['Cobaye regagne 10 Blessure(s).'], faits: [{ genre: 'blessures', ...sur, valeur: 10 }] },
  { nom: 'soin du lanceur', jouer: () => appliquer([{ op: 'healCaster', amount: 3 }], heros({ id: 't', label: 'Cible' }), { caster: heros() }),
    lignes: ['Cobaye regagne 3 Blessure(s).'], faits: [{ genre: 'blessures', ...sur, valeur: 3 }] },
  { nom: 'vol de vie', jouer: () => appliquer([{ op: 'lifeSteal', num: 1, den: 2 }], heros({ id: 'v', label: 'Victime', kind: 'ennemi' }), { caster: heros(), woundsDealt: 6 }),
    lignes: ['Cobaye draine 3 Blessure(s).'], faits: [{ genre: 'blessures', ...sur, valeur: 3, vol: true }] },
  { nom: 'soin qui lève un verrou', jouer: () => {
    const c = heros();
    addCondition(c, COND.hemorragique, 1, undefined, undefined, undefined, undefined, { unlockBy: 'medicalAid' });
    return appliquer([{ op: 'heal', amount: 1 }], c);
  }, lignes: ['Cobaye regagne 1 Blessure(s).', "Cobaye : l'État Hémorragique est levé par le soin (Blessure critique).", 'Cobaye reçoit 1 État Exténué.'],
  faits: [{ genre: 'blessures', ...sur, valeur: 1 }, { genre: 'etat', ...sur, id: COND.hemorragique, valeur: -1, verrouLeve: true }, { genre: 'etat', ...sur, id: COND.extenue, valeur: 1 }] },
  { nom: 'gain d’Avantage', jouer: () => appliquer([{ op: 'gainAdvantage', amount: 2 }]),
    lignes: ['Cobaye gagne 2 Avantages.'], faits: [{ genre: 'avantage', ...sur, valeur: 2, total: 2 }] },
  { nom: 'gain d’un Avantage', jouer: () => appliquer([{ op: 'gainAdvantage', amount: 1 }]),
    lignes: ['Cobaye gagne 1 Avantage.'], faits: [{ genre: 'avantage', ...sur, valeur: 1, total: 1 }] },
  { nom: 'Avantage complété', jouer: () => appliquer([{ op: 'topUpAdvantage', amount: 3 }], heros({ advantage: 1 })),
    lignes: ['Cobaye porte son Avantage à 3.'], faits: [{ genre: 'avantage', ...sur, valeur: 2, total: 3, complete: true }] },
  { nom: 'État sans durée', jouer: () => appliquer([{ op: 'condition', id: { id: COND.sonne }, value: 2 }]),
    lignes: ['Cobaye reçoit 2 État Sonné.'], faits: [{ genre: 'etat', ...sur, id: COND.sonne, valeur: 2 }] },
  { nom: 'État en Rounds', jouer: () => appliquer([{ op: 'condition', id: { id: COND.aveugle }, durationRounds: 3 }]),
    lignes: ['Cobaye reçoit 1 État Aveuglé (3 Rounds).'], faits: [{ genre: 'etat', ...sur, id: COND.aveugle, valeur: 1, duree: { rounds: 3 } }] },
  { nom: 'État d’un Round', jouer: () => appliquer([{ op: 'condition', id: { id: COND.aveugle }, durationRounds: 1 }]),
    lignes: ['Cobaye reçoit 1 État Aveuglé (1 Round).'], faits: [{ genre: 'etat', ...sur, id: COND.aveugle, valeur: 1, duree: { rounds: 1 } }] },
  { nom: 'État en minutes', jouer: () => appliquer([{ op: 'condition', id: { id: COND.empetre }, durationMinutes: 30 }]),
    lignes: ['Cobaye reçoit 1 État Empêtré (30 min).'], faits: [{ genre: 'etat', ...sur, id: COND.empetre, valeur: 1, duree: { minutes: 30 } }] },
  { nom: 'État en heures', jouer: () => appliquer([{ op: 'condition', id: { id: COND.empetre }, durationHours: 3 }]),
    lignes: ['Cobaye reçoit 1 État Empêtré (3 heures).'], faits: [{ genre: 'etat', ...sur, id: COND.empetre, valeur: 1, duree: { minutes: 180 } }] },
  { nom: 'annonce d’un État par Round', jouer: () => appliquer([{ op: 'condition', id: { id: COND.extenue }, perRound: true }], heros(), { label: 'Brume' }),
    lignes: ['Cobaye subira 1 État Exténué par Round (Brume).'], faits: [{ genre: 'etat', ...sur, id: COND.extenue, valeur: 0, duree: { parRound: 1 } }], source: 'Brume' },
  { nom: 'annonce d’un État par Round sans libellé', jouer: () => appliquer([{ op: 'condition', id: { id: COND.extenue }, perRound: true, value: 2 }]),
    lignes: ['Cobaye subira 2 État Exténué par Round (Effet).'], faits: [{ genre: 'etat', ...sur, id: COND.extenue, valeur: 0, duree: { parRound: 2 } }] },
  { nom: 'État qui dépense l’Avantage', jouer: () => appliquer([{ op: 'condition', id: { id: COND.sonne } }], heros({ advantage: 3 })),
    lignes: ['Cobaye reçoit 1 État Sonné.', 'Cobaye perd tous ses Avantages.'],
    faits: [{ genre: 'etat', ...sur, id: COND.sonne, valeur: 1 }, { genre: 'avantage', ...sur, valeur: -3, total: 0 }] },
  { nom: 'État non cumulable déjà porté', jouer: () => { const c = heros(); addCondition(c, COND.aTerre); return appliquer([{ op: 'condition', id: { id: COND.aTerre } }], c); },
    lignes: [], faits: [] },
  { nom: 'État non cumulable déjà porté, en Rounds', jouer: () => { const c = heros(); addCondition(c, COND.inconscient); return appliquer([{ op: 'condition', id: { id: COND.inconscient }, durationRounds: 2 }], c); },
    lignes: [], faits: [] },
  { nom: 'Avantage dépensé à la perte du tour', jouer: () => appliquer([{ op: 'spendAdvantage' }], heros({ advantage: 3 })),
    lignes: ['Cobaye perd tous ses Avantages.'], faits: [{ genre: 'avantage', ...sur, valeur: -3, total: 0 }] },
  { nom: 'État porté', jouer: () => appliquer([{ op: 'condition', id: { id: COND.sonne }, carried: true }], heros(), { label: 'Sort', defaultDurationRounds: 2 }),
    lignes: ['Cobaye gagne l’État Sonné — un mal qu’il traîne (2 Rounds).'], faits: [{ genre: 'etat', ...sur, id: COND.sonne, valeur: 1, porte: {}, duree: { rounds: 2 } }] },
  { nom: 'État porté à durée d’op', jouer: () => appliquer([{ op: 'condition', id: { id: COND.inconscient }, carried: true, durationRounds: 4 }], heros(), { label: 'Contrecoup', defaultDurationRounds: 2 }),
    lignes: ['Cobaye gagne l’État Inconscient — un mal qu’il traîne (4 Rounds).'], faits: [{ genre: 'etat', ...sur, id: COND.inconscient, valeur: 1, porte: {}, duree: { rounds: 4 } }] },
  { nom: 'État porté par un effet permanent', jouer: () => {
    const c = heros();
    c.activeEffects = [{ label: 'Forme', effectId: 'forme', bonus: 0, duration: { scale: 'permanent' }, passive: [{ op: 'condition', id: { id: COND.sonne }, value: 1 }] }];
    return appliquer([], c);
  }, lignes: ['Cobaye gagne l’État Sonné — un mal qu’il traîne.'], faits: [{ genre: 'etat', ...sur, id: COND.sonne, valeur: 1, porte: {} }] },
  { nom: 'État porté qui part avec son effet', jouer: () => {
    const c = heros();
    c.activeEffects = [{ label: 'Forme', effectId: 'forme', bonus: 0, duration: { scale: 'permanent' }, passive: [{ op: 'condition', id: { id: COND.sonne }, value: 1 }] }];
    syncDerivedConditions(c);
    return appliquer([{ op: 'endTransform', tag: 'forme' }], c);
  }, lignes: ['Cobaye reprend sa forme (forme).', 'Cobaye perd l’État Sonné — un mal qu’il traîne ne le porte plus.', 'Cobaye reçoit 1 État Exténué.'],
  faits: [{ genre: 'etat', ...sur, id: COND.sonne, valeur: -1, porte: {} }, { genre: 'etat', ...sur, id: COND.extenue, valeur: 1 }] },
  { nom: 'tout l’État retiré', jouer: () => { const c = heros(); addCondition(c, COND.extenue, 3); return appliquer([{ op: 'removeCondition', id: { id: COND.extenue }, all: true }], c); },
    lignes: ["Cobaye retire tout l'État Exténué."], faits: [{ genre: 'etat', ...sur, id: COND.extenue, valeur: -3, tous: true }] },
  { nom: 'pions d’État retirés', jouer: () => { const c = heros(); addCondition(c, COND.extenue, 3); return appliquer([{ op: 'removeCondition', id: { id: COND.extenue }, value: 2 }], c); },
    lignes: ['Cobaye retire 2 État Exténué.'], faits: [{ genre: 'etat', ...sur, id: COND.extenue, valeur: -2 }] },
  { nom: 'Corruption retirée', jouer: () => appliquer([{ op: 'corruption', amount: -2 }], heros({ corruption: 5 })),
    lignes: ['Cobaye : -2 Point(s) de Corruption (total 3).'], faits: [{ genre: 'corruption', ...sur, valeur: -2, total: 3 }] },
  { nom: 'Corruption ajoutée', jouer: () => appliquer([{ op: 'corruption', amount: 1 }], heros({ corruption: 2 })),
    lignes: ['Cobaye : +1 Point de Corruption (total 3).'], faits: [{ genre: 'corruption', ...sur, valeur: 1, total: 3 }] },
  { nom: 'Corruptions ajoutées', jouer: () => appliquer([{ op: 'corruption', amount: 2 }], heros({ corruption: 2 })),
    lignes: ['Cobaye : +2 Points de Corruption (total 4).'], faits: [{ genre: 'corruption', ...sur, valeur: 2, total: 4 }] },
  { nom: 'argent gagné', jouer: () => appliquer([{ op: 'money', montant: { brass: 250 } }]),
    lignes: ['Cobaye gagne 1 CO 10 sc (Effet).'], faits: [{ genre: 'argent', ...sur, valeur: 250 }] },
  { nom: 'argent perdu', jouer: () => {
    const c = heros();
    appliquer([{ op: 'money', montant: { brass: 500 } }], c);
    return appliquer([{ op: 'money', montant: { brass: -30 } }], c, { label: 'Péage' });
  }, lignes: ['Cobaye perd 2/6 (Péage).'], faits: [{ genre: 'argent', ...sur, valeur: -30 }], source: 'Péage' },
];

describe('applyOps rend ses faits et leurs lignes', () => {
  it.each(CORPUS.map((c) => [c.nom, c] as const))('%s : les lignes du journal, à l’octet, et leurs faits', (_nom, cas) => {
    const { lignes, faits } = cas.jouer();
    expect(lignes).toEqual(cas.lignes.map((x) => ligneDeTexte(x)));
    expect(faits).toEqual(cas.faits);
  });

  it('chaque fait se lit en une ligne rendue, dans l’ordre des faits', () => {
    for (const cas of CORPUS) {
      const { lignes, faits } = cas.jouer();
      const lues = faits.filter(avecLigne).map((f) => texteDuFait(f, 'Cobaye', cas.source));
      expect(lignes.filter((l) => lues.includes(l.texte)).map((e) => e.texte), cas.nom).toEqual(lues);
    }
  });

  it('une application imbriquée rend ses faits à l’application qui la contient', () => {
    const { faits } = appliquer([{ op: 'rollTable', die: { n: 1, sides: 10 }, entries: [{ min: 1, max: 10, ops: [{ op: 'condition', id: { id: COND.aveugle } }] }] }]);
    expect(faits).toEqual([{ genre: 'etat', ...sur, id: COND.aveugle, valeur: 1 }]);
  });

  it('le camp de la cible est figé dans le fait', () => {
    const hostile = appliquer([{ op: 'wounds', amount: 3 }], heros({ id: 'e', kind: 'ennemi' })).faits;
    const neutre = appliquer([{ op: 'wounds', amount: 3 }], heros({ id: 'p', kind: 'pnj' })).faits;
    expect([...hostile, ...neutre]).toEqual([
      { genre: 'blessures', cible: 'e', camp: 'hostile', valeur: -3, mitigation: 'sans' },
      { genre: 'blessures', cible: 'p', camp: 'neutre', valeur: -3, mitigation: 'sans' },
    ]);
  });

  it('la ligne nomme la cible par le nommeur posé, jamais par son libellé (#4017)', () => {
    const avant = poserLeNommeur((id) => (id === 'h' ? fixtureText('Silhouette') : null));
    try {
      const { lignes } = appliquer([{ op: 'wounds', amount: 3 }, { op: 'gainAdvantage', amount: 1 }, { op: 'corruption', amount: 1 }]);
      expect(lignes).toEqual([
        'Silhouette subit 3 Blessure(s) (ignorant BE et PA).',
        'Silhouette gagne 1 Avantage.',
        'Silhouette : +1 Point de Corruption (total 1).',
      ].map((x) => ligneDeTexte(x)));
    } finally {
      poserLeNommeur(avant);
    }
  });
});
