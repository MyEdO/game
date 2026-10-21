/**
 * LA VUE LIT CE QUE LE JEU LIT (#2898, M4, sondes `distance` et `mvt` du juge promues ; lot C) : la distance d'un
 * combattant à l'actif est celle du ciblage (`combatDistance` : empreinte et relief), et le Mouvement du Tour est celui
 * de la jauge de la console (`mouvementDuTour`). `pastilles-entite` porte une monture dont l'empreinte écarte la distance
 * de combat de la distance de case ; `ecuries-clayonnage`, un actif dont le budget du Tour n'est pas sa caractéristique.
 * La fenêtre nomme les verbes de chaque étape de cascade (`cascade-dome.jsonl`), le jet lancé se lit avant sa
 * confirmation (`pendingAttack.result`), l'aperçu du premier clic, les cases peintes et les entités de l'exploration se
 * lisent ; le journal ne se recopie pas à la défaite (`defaite-dome.jsonl`) et respecte la largeur.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { activeCombatant, combatDistance, mouvementDuTour, porteesDuTour } from '../noyau/index';
import { lireLeFichier, nouvelEntete, rejouer, type Geste, type LigneNumerotee, type PartieRejouee } from './partieTexte';
import { BORNES, borner, casesAtteignables, pageDeLaCarte, projeter, rendreLaCarte, rendreLaVue, rendreLeJournal, rendreLesCases } from './vue';

/** La partie du scénario, sa pause de Round confirmée, puis `gestes` ; fermée après `faire`. */
function auPremierTour(scenario: string, faire: (r: PartieRejouee) => void, ...gestes: Geste[]) {
  const r = rejouer(nouvelEntete(scenario, { graine: 7 }), [{ type: 'confirmRoundStart', args: [] }, ...gestes]);
  enPartie(r, faire);
}

/** La partie committée `nom`, rejouée jusqu'à sa ligne `lignes` (toutes par défaut) ; fermée après `faire`. */
function aLaFixture(nom: string, faire: (r: PartieRejouee) => void, lignes?: number) {
  const texte = readFileSync(new URL(`./${nom}`, import.meta.url), 'utf8');
  const { entete, gestes } = lireLeFichier(lignes === undefined ? texte : `${texte.split('\n').slice(0, lignes).join('\n')}\n`);
  enPartie(rejouer(entete, gestes), faire);
}

function enPartie(r: PartieRejouee, faire: (r: PartieRejouee) => void) {
  try {
    faire(r);
  } finally {
    r.partie.fermer();
  }
}

describe('la projection lit les lecteurs du jeu', () => {
  it('la distance de chaque combattant est sa distance de combat à l’actif (`combatDistance`)', { timeout: 120_000 }, () => {
    auPremierTour('pastilles-entite', (r) => {
      const etat = r.partie.etat();
      const b = etat.battle!;
      const actif = activeCombatant(b)!;
      const { combattants } = pageDeLaCarte(etat);
      expect(combattants.length, 'témoin : la carte liste les combattants').toBe(b.combatants.length);
      for (const c of combattants) {
        const vrai = combatDistance(actif, b.combatants.find((x) => x.id === c.id)!);
        expect(c.distance, `${c.id} : distance de la vue`).toBe(Number.isFinite(vrai) ? vrai : null);
      }
    });
  });

  it('le Mouvement de l’actif est celui de la jauge (`mouvementDuTour`)', { timeout: 120_000 }, () => {
    auPremierTour('ecuries-clayonnage', (r) => {
      const etat = r.partie.etat();
      const b = etat.battle!;
      const actif = activeCombatant(b)!;
      const jauge = mouvementDuTour(b, actif);
      expect(projeter(etat, 1, r.journal.length).combat!.actif!.mouvement).toEqual([jauge.restant, jauge.total]);
    });
  });
});

describe('la fenêtre nomme ses verbes, et le pid qu’ils attendent, à chaque étape de cascade', () => {
  it('l’étape de déviation sur table (`cascade-dome.jsonl`) : cascadeTableRoll, cascadeTableSetForcedRoll, le pid de l’étape', { timeout: 120_000 }, () => {
    aLaFixture('cascade-dome.jsonl', (r) => {
      const f = projeter(r.partie.etat(), r.gestes.length, r.journal.length).combat!.fenetre!;
      expect(f.etape?.interaction, 'témoin : l’étape courante est un tirage sur table').toBe('table');
      expect(f.pid).toBe(f.etape!.id);
      expect(f.verbes).toEqual(expect.arrayContaining(['cascadeTableRoll', 'cascadeTableSetForcedRoll', 'cascadeNext']));
      expect(rendreLaVue(projeter(r.partie.etat(), r.gestes.length, r.journal.length)).join('\n')).toContain(`verbes (pid ${f.pid}) : cascadeTableRoll, cascadeTableSetForcedRoll`);
    });
  });
  it('l’étape-jet d’un Test déclenché (`defaite-dome.jsonl`, 66 lignes) : la vue rend TOUS ses verbes, repliés à la largeur', { timeout: 240_000 }, () => {
    aLaFixture('defaite-dome.jsonl', (r) => {
      const p = projeter(r.partie.etat(), r.gestes.length, r.journal.length);
      const f = p.combat!.fenetre!;
      expect(f.verbes.length, 'témoin : une étape aux verbes nombreux').toBeGreaterThan(8);
      const vue = rendreLaVue(p);
      expect(vue.some((l) => l.endsWith('…')), 'une ligne de la vue est coupée').toBe(false);
      expect(Math.max(...vue.map((l) => l.length))).toBeLessThanOrEqual(BORNES.largeur);
      const lus = vue.join(' ').split(/[\s,:]+/);
      expect(f.verbes.filter((v) => !lus.includes(v)), 'des verbes de la fenêtre manquent à la vue').toEqual([]);
    }, 66);
  });
  it('l’étape-jet d’attaque nomme la pose du dé de son flux (`attackSetForcedRoll`)', { timeout: 120_000 }, () => {
    auPremierTour('dome', (r) => {
      expect(projeter(r.partie.etat(), r.gestes.length, r.journal.length).combat!.fenetre!.verbes).toEqual(expect.arrayContaining(['attackRoll', 'attackConfirm', 'attackSetForcedRoll']));
    }, { offre: 'charge' }, { type: 'battleClickEntity', args: ['enemy-enc-dome-1'] });
  });
});

describe('le jet se lit avant sa confirmation', () => {
  it('après `attackRoll`, la vue rend les rangées du jet (d100, cible, DR) et le DR net, ceux de `pendingAttack.result`', { timeout: 120_000 }, () => {
    auPremierTour('dome', (r) => {
      const res = r.partie.etat().pendingAttack!.result!;
      const jet = projeter(r.partie.etat(), r.gestes.length, r.journal.length).combat!.jet!;
      expect(jet.dr).toBe(res.netSL);
      expect(jet.lignes[0]).toMatchObject({ d100: res.attackerDetail!.roll, cible: res.attackerDetail!.target, dr: res.attackerDetail!.sl, reussi: res.attackerDetail!.success });
      expect(jet.lignes).toHaveLength(res.defenderDetail ? 2 : 1);
      expect(rendreLaVue(projeter(r.partie.etat(), r.gestes.length, r.journal.length)).join('\n')).toMatch(/^jet : .* DR net [+-]?\d+$/m);
    }, { offre: 'charge' }, { type: 'battleClickEntity', args: ['enemy-enc-dome-1'] }, { type: 'attackRoll', args: [] });
  });
});

describe('le champ et l’exploration se lisent', () => {
  it('l’aperçu du premier clic : sa case et son coût', { timeout: 120_000 }, () => {
    auPremierTour('siege-enceinte', (r) => {
      expect(rendreLaVue(projeter(r.partie.etat(), r.gestes.length, r.journal.length)).join('\n')).toMatch(/^aperçu : move → \(12,44\) · coût 1/m);
    }, { type: 'battleClickTile', args: [{ x: 12, y: 44 }] });
  });
  it('les cases sont celles que le champ peint (`porteesDuTour`), et `cases` les borne', { timeout: 120_000 }, () => {
    auPremierTour('siege-enceinte', (r) => {
      const etat = r.partie.etat();
      const cases = casesAtteignables(etat, true);
      expect(cases.length, 'témoin : l’actif a des cases à marcher').toBe(porteesDuTour(() => etat, true).marche.size);
      expect(rendreLesCases(cases)[0]).toMatch(/^marche : \(\d+,\d+\)·\d/);
    });
  });
  it('`carte` en exploration liste les entités et les PNJ de la scène', { timeout: 120_000 }, () => {
    const r = rejouer(nouvelEntete('fenetre-ecuries', { graine: 7 }), []);
    enPartie(r, () => {
      const p = projeter(r.partie.etat(), 0, r.journal.length);
      expect(rendreLaCarte(r.partie.etat(), p).join('\n')).toMatch(/homme-de-main · personnage · Homme de main · \(6,1\)/);
      expect(p.exploration!.entites.liste.map((e) => e.id)).toContain('homme-de-main');
    });
  });
});

describe('le journal', () => {
  it('la défaite ne recopie pas le journal du combat (`defaite-dome.jsonl`)', { timeout: 240_000 }, () => {
    aLaFixture('defaite-dome.jsonl', (r) => {
      const textes = r.journal.flatMap((l) => (l.ligne.de === 'combat' ? [l.ligne.evenement.text] : []));
      expect(r.partie.etat().battle?.over, 'témoin : la partie va jusqu’à la défaite').toBe('defeat');
      expect(textes.filter((t) => t.startsWith('Le combat commence')), 'le journal du combat est recopié après la défaite').toHaveLength(1);
      const log = r.partie.etat().battle!.log;
      expect(log.some((e) => / — Résistance : /.test(e.text)), 'la défaite efface du journal du combat les Tests de fin de combat').toBe(true);
      expect(log, 'le journal du combat et ses lignes captées divergent').toHaveLength(textes.length);
    });
  });
  it('une entrée plus haute que la page se lit seule, par ses lignes (`--ligne`), jusqu’à la dernière', () => {
    const entree = (n: number, texte: string): LigneNumerotee => ({ n, pas: 1, ligne: { de: 'journal', texte }, differee: false });
    const haute = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n');
    const journal = [entree(0, 'A'), entree(1, haute), entree(2, 'C')];
    expect(rendreLeJournal(journal, 0)).toEqual(['0 [pas 1] A', '+2 : `journal --depuis 1`']);
    const premiere = rendreLeJournal(journal, 1);
    expect(premiere[0]).toBe('1 [pas 1] l0');
    const suite = /`journal --depuis 1 --ligne (\d+)`$/.exec(premiere[premiere.length - 1]);
    expect(suite, premiere.join('\n')).not.toBeNull();
    const m = Number(suite![1]);
    expect(premiere.slice(0, -1).map((l) => l.replace(/^1 \[pas 1\] /, ''))).toEqual(haute.split('\n').slice(0, m));
    expect(rendreLeJournal(journal, 1, m)).toEqual([...haute.split('\n').slice(m), '2 [pas 1] C']);
  });
  it('un saut de ligne interne se coupe comme une ligne', () => {
    expect(borner(['un\ndeux', 'trois'], 'journal')).toEqual(['un', 'deux', 'trois']);
  });
});
