/**
 * LES CONSÉQUENCES D'UNE ÉTAPE EN FAITS (#4574 lot 3, PR 2a), par le chemin produit (banc du noyau) :
 *  - la fenêtre d'une Blessure critique PRÉVOIT les faits que « Subir » appliquera (`faitsDeLEtape`), sans en stocker
 *    aucun avant l'application, et l'étape validée porte exactement ceux-là ; « Dévier » n'en publie que l'armure entamée ;
 *  - la révélation d'une Incantation Imparfaite porte les faits de ses ops et de sa Corruption de Sorcellerie, et ne
 *    redit pas leurs lignes ;
 *  - l'étape de reprise d'une Fuite prévoit puis applique ses États Brisés.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { applyAttackResult, applyMiscast } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { critTableRows, critTableKeyFor } from '../engine/critical';
import { blessuresDeLaLigne } from '../engine/critical.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import { createHero } from '../engine/character';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { texteDuFait, type FaitApplique, type FaitAvecLigne } from '../engine/faits';
import { nomDe } from '../engine/nom';
import { emptyScene } from './monde/scene';
import { faitsDeLEtape, jetsEnVue } from './jetsEnVue';
import { pushDisplay } from './rollSeam';
import type { AttackResult } from '../engine/combat';
import type { Combatant, HitLocation, Weapon } from '../engine/types';
import type { CascadeStep } from './pendings';
import { fixtureText } from '../i18n/fixtureText';

/** Les genres que le journal dit par leur ligne (`texteDuFait`) : le contrat positif. */
const GENRES_AVEC_LIGNE: readonly FaitApplique['genre'][] = ['blessures', 'avantage', 'etat', 'corruption', 'argent'];
const avecLigne = (f: FaitApplique): f is FaitAvecLigne => GENRES_AVEC_LIGNE.includes(f.genre);

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const CHARS = { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 40, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 };

const mk = (kind: Combatant['kind'], id: string, over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id, name: id, label: id, kind, important: true, characteristics: { ...CHARS },
    wounds: blessuresDeBase(30), advantage: 0, conditions: [], traumas: [], criticalWounds: 0,
    weapons: [], items: [], skills: [], talents: [], traits: [], movement: 4, bodyShape: 'humanoide',
    pos: { x: 0, y: 0 }, fate: 0, engagedWith: [], size: 'moyenne',
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  }) as unknown as Combatant);

function setBattle(combatants: Combatant[]): void {
  const battle = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: emptyScene('scene-test'), gameTime: 720, party: [], journal: [], pendingCascade: null, pendingFateSave: null, pendingLogQueue: [] });
}

const etapes = (): CascadeStep[] => banc.getState().pendingCascade?.participants ?? [];
const etape = (id: string): CascadeStep => etapes().find((s) => s.id === id)!;

/** Valide l'étape courante et rend l'étape `id` telle que son commit l'a posée : une étape d'affichage muette
 *  (`issueDuPiegeALame`) la suit, pour que la séquence reste ouverte. */
function validee(id: string): CascadeStep | undefined {
  pushDisplay(banc.setState, { id: `garde-${id}`, kind: 'issueDuPiegeALame', worldOwner: true, icon: 'melee/fuir', label: fixtureText('Garde') });
  banc.getState().jetValider('cascade');
  return etapes().find((x) => x.id === id && x.committed);
}

/** « Gourdin » d'Ulrich l'ennemi, sur Hilda, héroïne à 3 PB et 3 PA au Corps : un dépassement de 5 (LDB 18 l.17). */
const gourdin: Weapon = { label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] };
const depassement = (): AttackResult =>
  ({ hit: true, attackerRoll: 30, netSL: 2, location: 'corps', damage: 12, woundsLost: 8, critical: false, advantageTo: null, defenderDefeated: false, log: 'dépassement (corps)' });

/** La ligne de la table de `lieu` sans dé ni mort qui retire le plus de PB. */
const ligneSansDe = (lieu: HitLocation, mod: number) => critTableRows('ldb', critTableKeyFor(lieu))
  .filter((e) => !e.lethal && e.max - mod >= 1 && !JSON.stringify(e.ops ?? []).includes('"dice"'))
  .reduce((a, e) => (blessuresDeLaLigne(e.ops) > blessuresDeLaLigne(a.ops) ? e : a));

/** Pose sur la fenêtre `fenetre` le dé qui atteint la ligne `entryId`, et rend la fenêtre posée. */
function poserLaLigne(fenetre: CascadeStep, entryId: string): CascadeStep {
  const mod = fenetre.table!.mod ?? 0;
  const ligne = critTableRows('ldb', critTableKeyFor(fenetre.critSeverity!.location)).find((e) => e.id === entryId)!;
  banc.getState().jetImposerLeResultat('cascadeTirage', ligne.max - mod, fenetre.id);
  const posee = etape(fenetre.id);
  expect(posee.deviation?.crit.entryId, 'le dé posé atteint la ligne choisie').toBe(entryId);
  return posee;
}

/** Le Coup Critique d'Ulrich sur Hilda (3 PB, 3 PA à `lieu` : la Déviation est offerte) à `lieu`, qui la dépasse
 *  aussi : deux Blessures critiques, deux fenêtres (LDB 13 l.161 ; LDB 18 l.17, l.53 ; LDB 63 l.30). Rend la fenêtre
 *  de la première. */
function deuxCritiquesSurHilda(lieu: HitLocation): CascadeStep {
  seedBattleRng(31);
  const armour = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0, [lieu]: 3 };
  setBattle([mk('ennemi', 'ulrich', { weapons: [gourdin], pos: { x: 1, y: 0 } }), mk('heros', 'hilda', { armour, wounds: blessuresDeBase(15, 3) })]);
  const g = banc.getState;
  applyAttackResult(g, banc.setState, g().battle!.combatants[0], g().battle!.combatants[1], gourdin, { ...depassement(), attackerRoll: 22, location: lieu, critical: true });
  return etapes().find((s) => s.kind === 'deviation')!;
}

const fenetreSuivante = (avant: string): CascadeStep => etapes().find((s) => s.kind === 'deviation' && s.id !== avant && !s.committed)!;

/** La fenêtre de la Blessure critique de dépassement d'Hilda, son dé posé sur la ligne de Corps qui retire le plus de
 *  PB sans dé ni mort : celle dont la prévision sans les Blessures du coup diffère. */
function fenetreDeHilda(): CascadeStep {
  seedBattleRng(31);
  setBattle([mk('ennemi', 'ulrich', { weapons: [gourdin], pos: { x: 1, y: 0 } }), mk('heros', 'hilda', { armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 }, wounds: blessuresDeBase(15, 3) })]);
  const g = banc.getState;
  applyAttackResult(g, banc.setState, g().battle!.combatants[0], g().battle!.combatants[1], gourdin, depassement());
  const [fenetre] = etapes().filter((s) => s.kind === 'deviation');
  const mod = fenetre.table!.mod ?? 0;
  const ligne = critTableRows('ldb', critTableKeyFor(fenetre.critSeverity!.location))
    .filter((e) => !e.lethal && e.max - mod >= 1 && !JSON.stringify(e.ops ?? []).includes('"dice"'))
    .reduce((a, e) => (blessuresDeLaLigne(e.ops) > blessuresDeLaLigne(a.ops) ? e : a));
  expect(blessuresDeLaLigne(ligne.ops), 'la ligne retire des PB').toBeGreaterThan(0);
  g().jetImposerLeResultat('cascadeTirage', ligne.max - mod, fenetre.id);
  const posee = etape(fenetre.id);
  expect(posee.deviation?.crit.entryId, 'le dé posé atteint la ligne choisie').toBe(ligne.id);
  return posee;
}

describe('la fenêtre d’une Blessure critique prévoit ce que « Subir » applique', () => {
  it('dépassement sur un porteur blindé : les faits prévus sont ceux de l’étape validée', () => {
    const fenetre = fenetreDeHilda();
    expect(fenetre.faits, 'aucun fait stocké avant l’application').toBeUndefined();
    const prevus = faitsDeLEtape(banc.getState(), fenetre);
    expect(prevus[0]).toEqual({ genre: 'localisation', cible: 'hilda', camp: 'groupe', valeur: 'corps' });
    expect(prevus.some((f) => f.genre === 'blessures'), 'les Blessures du coup ont déjà mis Hilda à 0 PB').toBe(false);
    expect(prevus.length, 'les États de la ligne').toBeGreaterThan(1);
    const ligneDuTirage = jetsEnVue(banc.getState()).flatMap((j) => j.lignes).find((l) => l.genre === 'table');
    expect(ligneDuTirage?.consequences?.map((c) => [c.genre, c.valeur]), 'la rangée du tirage les publie').toEqual(prevus.map((f) => [f.genre, f.valeur]));
    banc.getState().jetRegler('cascade', 'choix', 'subir', fenetre.id);
    expect(validee(fenetre.id)?.faits).toEqual(prevus);
  });

  it('« Dévier » : l’étape validée publie exactement l’armure entamée, aucun fait de Blessure critique', () => {
    const fenetre = fenetreDeHilda();
    banc.getState().jetRegler('cascade', 'choix', 'devier', fenetre.id);
    const devie = validee(fenetre.id)!;
    expect(devie.committed).toBe(true);
    expect(faitsDeLEtape(banc.getState(), devie)).toEqual([{ genre: 'objet', cible: 'hilda', camp: 'groupe', objet: { armure: 'corps' }, valeur: -1, issue: 'usee' }]);
  });
});

describe('un coup à deux Blessures critiques : chaque fenêtre prévoit SA Blessure, qui va à son étape', () => {
  it('Coup Critique et dépassement au Corps : prévu(fenêtre k) == faits de l’étape k, une fois la dernière reprise appliquée', () => {
    const f1 = deuxCritiquesSurHilda('corps');
    const p1 = poserLaLigne(f1, ligneSansDe('corps', f1.table!.mod ?? 0).id);
    const prevus1 = faitsDeLEtape(banc.getState(), p1);
    expect(prevus1[0]).toEqual({ genre: 'localisation', cible: 'hilda', camp: 'groupe', valeur: 'corps' });
    banc.getState().jetRegler('cascade', 'choix', 'subir', f1.id);
    expect(validee(f1.id)?.faits, '« Subir » à la fenêtre 1 n’applique rien : la fenêtre 2 suspend le coup').toBeUndefined();
    const f2 = fenetreSuivante(f1.id);
    const p2 = poserLaLigne(f2, ligneSansDe('corps', f2.table!.mod ?? 0).id);
    const prevus2 = faitsDeLEtape(banc.getState(), p2);
    expect(prevus2.filter((f) => f.genre === 'localisation'), 'la fenêtre 2 ne prévoit que sa Blessure').toHaveLength(1);
    banc.getState().jetRegler('cascade', 'choix', 'subir', f2.id);
    expect(validee(f2.id)?.faits).toEqual(prevus2);
    expect(etape(f1.id).faits, 'la reprise pose les faits de la Blessure 1 sur l’étape 1').toEqual(prevus1);
  });

  it('une op à dé de la Blessure 1 (Commotion cérébrale) borne la prévision de la fenêtre 2 à sa Localisation', () => {
    const f1 = deuxCritiquesSurHilda('tete');
    poserLaLigne(f1, 'commotion-cerebrale');
    banc.getState().jetRegler('cascade', 'choix', 'subir', f1.id);
    validee(f1.id);
    const f2 = fenetreSuivante(f1.id);
    const p2 = poserLaLigne(f2, ligneSansDe('tete', f2.table!.mod ?? 0).id);
    expect(faitsDeLEtape(banc.getState(), p2)).toEqual([{ genre: 'localisation', cible: 'hilda', camp: 'groupe', valeur: 'tete' }]);
  });
});

describe('la révélation d’une Incantation Imparfaite porte ses faits, sans redire leurs lignes', () => {
  it('« Terrible affaiblissement » (LDB 46) d’un sorcier : Corruption, À Terre, Exténué, et la Corruption de Sorcellerie (LDB 49 l.5)', () => {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Mage', seed: 3, id: 'mage' });
    h.wounds = blessuresDeBase(200, 200, h);
    banc.setState({ battle: null, party: [h], pendingCascade: null, suspendedCascades: [], pendingLogQueue: [] });
    const g = banc.getState;
    applyMiscast(g, banc.setState, g().party[0], 'majeure', { sorceryCorruption: true });
    const table = etapes().find((s) => s.kind === 'tableDIncantationImparfaite')!;
    g().jetImposerLeResultat('cascadeTirage', 82 - (table.table!.mod ?? 0), table.id);
    g().jetValider('cascade');
    const revelation = etapes().find((s) => s.kind === 'incantationImparfaite')!;
    const faits = revelation.faits ?? [];
    expect(faits.map((f) => [f.genre, f.genre === 'etat' ? f.id : f.valeur])).toEqual([['corruption', 1], ['etat', 'a-terre'], ['etat', 'extenue'], ['corruption', 1]]);
    const lignesDesFaits = faits.filter(avecLigne).map((f) => texteDuFait(f, nomDe(g().party[0]), revelation.reveal!.title));
    expect(revelation.reveal!.lines.map((l) => l.texte).filter((l) => lignesDesFaits.includes(l)), 'aucune ligne d’un fait dans la révélation').toEqual([]);
  });
});

describe('l’étape de reprise d’une Fuite prévoit puis applique ses États Brisés (LDB 15 l.66)', () => {
  it('Brisé +2 : prévu à la lecture, appliqué à la validation', () => {
    setBattle([mk('heros', 'fuyard'), mk('ennemi', 'poursuivant', { pos: { x: 1, y: 0 } })]);
    pushDisplay(banc.setState, { id: 'flee-move-fuyard', kind: 'mouvementDeFuite', actorId: 'fuyard', icon: 'melee/fuir', label: fixtureText('Fuite'), fuite: { moverId: 'fuyard', foeId: 'poursuivant', broken: 2 } });
    const reprise = etape('flee-move-fuyard');
    const brise = { genre: 'etat', cible: 'fuyard', camp: 'groupe', id: 'brise', valeur: 2 };
    expect(reprise.faits).toBeUndefined();
    expect(faitsDeLEtape(banc.getState(), reprise)).toEqual([brise]);
    expect(validee('flee-move-fuyard')?.faits).toEqual([brise]);
  });
});
