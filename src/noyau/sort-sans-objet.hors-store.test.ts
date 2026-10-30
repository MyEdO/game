/**
 * UN SORT RÉUSSI SANS OBJET SUR SA CIBLE LE DIT, sans store (#3059 S5) : le lancer reste permis et payé ;
 * sur une réussite, la cible dont l'effet certain n'a rien à changer reçoit la raison de `opSansObjet` au
 * journal, que l'application des ops tait. Une cible sur laquelle l'effet porte n'en reçoit aucune. LDB 46
 */
import { describe, it, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { pregenParty, PREGEN } from '../data/pregens';
import { addCondition } from '../engine/conditions';
import type { Combatant } from '../engine/types';

/** La raison que dit `opSansObjet` pour un retrait d'État sur une cible qui n'en porte aucun. */
const aucunEtat = (nom: string) => `${nom} n'a aucun État à retirer.`;

/** Un banc hors combat : un Prêtre capable de prier et son allié, la fiche de l'allié ajustée par `allie`. */
function auTemple(allie: (h: Combatant) => void = () => {}): { banc: Banc; pretre: Combatant; cible: Combatant } {
  const [pretre, cible] = pregenParty(PREGEN.pretre, PREGEN.soldat);
  const priere = pretre.skills.find((s) => s.id === 'priere');
  if (priere) priere.advances = Math.max(priere.advances, 5);
  else pretre.skills.push({ id: 'priere', characteristic: 'sociabilite', advances: 5 });
  allie(cible);
  const banc = ouvrirLeBanc({ graine: 7, etat: { party: [pretre, cible] } });
  return { banc, pretre, cible };
}

/** Lance la Bénédiction de Ténacité sur la cible, réussie, et rend les lignes que le lancer a dites. */
function benir(banc: Banc, pretreId: string, cibleId: string): string[] {
  const avant = banc.getState().journal.length;
  banc.getState().oocCastSpell(pretreId, 'benediction-de-tenacite', cibleId);
  expect(banc.getState().pendingCast?.targetId, 'témoin : le lancer s’ouvre sur la cible').toBe(cibleId);
  banc.getState().castRoll();
  if (!banc.getState().pendingCast!.result!.cast) {
    const p = banc.getState().party.find((c) => c.id === pretreId)!;
    p.resilience = (p.resilience ?? 0) + 1;
    banc.getState().castForceSuccess();
  }
  expect(banc.getState().pendingCast!.result!.cast, 'témoin : la Bénédiction réussit').toBe(true);
  banc.getState().castConfirm();
  return banc.getState().journal.slice(avant);
}

describe('Sort réussi sans objet sur sa cible', () => {
  it('cible sans État : la Bénédiction de Ténacité dit qu’elle n’a rien à retirer', () => {
    const { banc, pretre, cible } = auTemple();
    expect(benir(banc, pretre.id, cible.id)).toContain(aucunEtat(cible.label));
  });

  it('cible Exténuée : l’État part, aucune raison sans objet n’est dite', () => {
    const { banc, pretre, cible } = auTemple((h) => addCondition(h, 'extenue', 1));
    const lignes = benir(banc, pretre.id, cible.id);
    expect(lignes).not.toContain(aucunEtat(cible.label));
    expect(banc.getState().party.find((c) => c.id === cible.id)!.conditions.some((c) => c.id === 'extenue')).toBe(false);
  });
});
