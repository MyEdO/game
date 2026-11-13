/**
 * LA VUE LIT CE QUE LE JEU LIT (#2898, M4, sondes `distance` et `mvt` du juge promues ; lot C) : la distance d'un
 * combattant à l'actif est celle du ciblage (`distanceDeCombat` : empreinte et relief), et le Mouvement du Tour est celui
 * de la jauge de la console (`mouvementDuTour`). `pastilles-entite` porte une monture dont l'empreinte écarte la distance
 * de combat de la distance de case ; `ecuries-clayonnage`, un actif dont le budget du Tour n'est pas sa caractéristique.
 * La fenêtre nomme les verbes de chaque étape de cascade (`cascade-dome.jsonl`), le jet lancé se lit avant sa
 * confirmation (`pendingAttack.result`), l'aperçu du premier clic, les cases peintes et les entités de l'exploration se
 * lisent ; le journal ne se recopie pas à la défaite (`defaite-dome.jsonl`) et respecte la largeur.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { activeCombatant, distanceDeCombat, mouvementDuTour, porteesDuTour, CLIC_DU_CHAMP, cleDuGeste, type GesteDuJeu } from '../noyau/index';
import { lireLeFichier, rejouer, type LigneNumerotee, type PartieRejouee } from './partieTexte';
import { nouvelEntete, ouvrirLaPartie } from '../hote/partie';
import type { Geste } from '../hote/geste';
import { casesAtteignables, projeter as projeterLaPartie } from '../hote/projection';
import { BORNES, borner, ligneDeCombattant, pageDeLaCarte, projeter, rendreLaCarte, rendreLaVue, rendreLeJournal, rendreLesCases } from './vue';
import { fermerLaTable, partie, verbe } from './hote.testkit';
import { t } from '../i18n';

/** La partie du scénario, sa pause de Round confirmée, puis `gestes` ; fermée après `faire`. */
function auPremierTour(scenario: string, faire: (r: PartieRejouee) => void, ...gestes: Geste[]) {
  const r = rejouer(nouvelEntete(scenario, { graine: 7 }), [{ type: 'fenetreValider', args: ['debutDuRound'] }, ...gestes]);
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
  it('la distance de chaque combattant est sa distance de combat à l’actif (`distanceDeCombat`)', { timeout: 120_000 }, () => {
    auPremierTour('pastilles-entite', (r) => {
      const etat = r.partie.etat();
      const b = etat.battle!;
      const actif = activeCombatant(b)!;
      const { combattants } = pageDeLaCarte(etat);
      expect(combattants.length, 'témoin : la carte liste les combattants').toBe(b.combatants.length);
      for (const c of combattants) {
        const vrai = distanceDeCombat(actif, b.combatants.find((x) => x.id === c.id)!);
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
  it('l’étape de déviation sur table (`cascade-dome.jsonl`) : les verbes de jet du flux `cascadeTirage`, le pid de l’étape', { timeout: 120_000 }, () => {
    aLaFixture('cascade-dome.jsonl', (r) => {
      const f = projeter(r.partie.etat(), r.gestes.length, r.journal.length).fenetre!;
      expect(f.etape?.interaction, 'témoin : l’étape courante est un tirage sur table').toBe('table');
      expect(f.pid).toBe(f.etape!.id);
      expect(f.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['jetLancer@cascadeTirage', 'jetImposerLeResultat@cascadeTirage', 'jetValider@cascade']));
      // La vue replie une ligne trop large en continuations indentées de deux espaces (`BORNES.largeur`).
      expect(rendreLaVue(projeter(r.partie.etat(), r.gestes.length, r.journal.length)).join('\n').split('\n  ').join(' ')).toContain(`verbes (pid ${f.pid}) : jetLancer(flux: "cascadeTirage", pid?: id de rangée) · jetImposerLeResultat(flux: "cascadeTirage", roll: nombre, pid?: id de rangée)`);
      expect(rendreLaVue(projeter(r.partie.etat(), r.gestes.length, r.journal.length)).join('\n'), 'la table se lit avant son tirage').toMatch(/^jet cascadeTirage : \S+ .+ à tirer$/m);
    });
  });
  it('l’étape-jet d’un Test déclenché (`test-declenche-dome.jsonl`) : la vue rend TOUS ses verbes par leur signature, repliés à la largeur', { timeout: 240_000 }, () => {
    aLaFixture('test-declenche-dome.jsonl', (r) => {
      const p = projeter(r.partie.etat(), r.gestes.length, r.journal.length);
      const f = p.fenetre!;
      expect(f.gestes.length, 'témoin : une étape aux gestes nombreux').toBeGreaterThan(8);
      const vue = rendreLaVue(p);
      expect(vue.some((l) => l.endsWith('…')), 'une ligne de la vue est coupée').toBe(false);
      expect(Math.max(...vue.map((l) => l.length))).toBeLessThanOrEqual(BORNES.largeur);
      const lus = vue.join(' ').split(/[\s,:·()]+/);
      // Un geste ouvert se lit par sa signature (son verbe, son flux en valeur), un geste fermé par son identité.
      const lu = (g: GesteDuJeu) => lus.includes(cleDuGeste(g)) || (lus.includes(g.verbe) && (!g.flux || lus.includes(`"${g.flux}"`)));
      expect(f.gestes.filter((g) => !lu(g)).map(cleDuGeste), 'des gestes de la fenêtre manquent à la vue').toEqual([]);
    });
  });
  it('l’étape-jet d’attaque nomme la pose du dé de son flux (`jetImposerLeResultat` sur `attaque`)', { timeout: 120_000 }, () => {
    auPremierTour('dome', (r) => {
      expect(projeter(r.partie.etat(), r.gestes.length, r.journal.length).fenetre!.gestes.map(cleDuGeste)).toEqual(expect.arrayContaining(['jetLancer@attaque', 'jetValider@attaque', 'jetImposerLeResultat@attaque']));
    }, { type: 'armerLIntention', args: ['charge'] }, { type: 'cliquerLaCase', args: [{ x: 7, y: 5 }, 'enemy-enc-dome-1'] });
  });
});

describe('le jet se lit avant sa confirmation', () => {
  it('après `jetLancer@attaque`, la vue rend les rangées du jet (d100, cible, DR), la gagnante et le DR net, ceux de `pendingAttack.result`', { timeout: 120_000 }, () => {
    auPremierTour('dome', (r) => {
      const res = r.partie.etat().pendingAttack!.result!;
      const p = projeter(r.partie.etat(), r.gestes.length, r.journal.length);
      const [jet] = p.jets;
      expect(jet).toMatchObject({ flux: 'attaque', oppose: { drNet: res.netSL } });
      expect(jet.lignes[0]).toMatchObject({ genre: 'test', jet: { d100: res.attackerDetail!.roll, dr: res.attackerDetail!.sl, reussi: res.attackerDetail!.success } });
      expect(jet.lignes).toHaveLength(res.defenderDetail ? 2 : 1);
      expect(rendreLaVue(p).join('\n')).toMatch(/^jet attaque : .* · (gagne : \S+|égalité) · DR net [+-]?\d+$/m);
    }, { type: 'armerLIntention', args: ['charge'] }, { type: 'cliquerLaCase', args: [{ x: 7, y: 5 }, 'enemy-enc-dome-1'] }, { type: 'jetLancer', args: ['attaque'] });
  });
});

describe('le champ et l’exploration se lisent', () => {
  it('l’aperçu du premier clic : sa case et son coût', { timeout: 120_000 }, () => {
    auPremierTour('siege-enceinte', (r) => {
      expect(rendreLaVue(projeter(r.partie.etat(), r.gestes.length, r.journal.length)).join('\n')).toMatch(/^aperçu : deplacement → \(12,44\) · coût 1/m);
    }, { type: 'cliquerLaCase', args: [{ x: 12, y: 44 }] });
  });
  it('les cases sont celles que le champ peint (`porteesDuTour`), et `cases` les borne', { timeout: 120_000 }, () => {
    auPremierTour('siege-enceinte', (r) => {
      const etat = r.partie.etat();
      const cases = casesAtteignables(etat, true);
      expect(cases.length, 'témoin : l’actif a des cases à marcher').toBe(porteesDuTour(() => etat, true).marche.size);
      expect(rendreLesCases(cases).slice(0, 2)).toEqual([`zones : marche ${cases.length}`, expect.stringMatching(/^marche : \(\d+,\d+\)·\d/)]);
    });
  });
  it('une Course armée : `cases` donne sa zone avant la marche, et la vue nomme le clic du champ qui la commet', { timeout: 120_000 }, () => {
    auPremierTour('dome', (r) => {
      const etat = r.partie.etat();
      const cases = casesAtteignables(etat, true);
      expect(porteesDuTour(() => etat, true).course.size, 'témoin : la Course armée a sa zone').toBeGreaterThan(0);
      expect(cases[0].zone).toBe('course');
      expect(rendreLesCases(cases)[0]).toMatch(/^zones : course \d+ · marche \d+$/);
      const vue = rendreLaVue(projeter(etat, r.gestes.length, r.journal.length)).join(' ');
      expect(vue).toContain(`${CLIC_DU_CHAMP}(`);
      expect(vue).toMatch(/intention armée : course \(un clic du champ la commet\)/);
    }, { type: 'armerLIntention', args: ['course'] });
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
      expect(r.partie.etat().battle?.over, 'témoin : la partie va jusqu’à la défaite').toBe('defaite');
      expect(textes.filter((t) => t.startsWith('Le combat commence')), 'le journal du combat est recopié après la défaite').toHaveLength(1);
      const log = r.partie.etat().battle!.log;
      expect(log.some((e) => / — Résistance : /.test(e.text)), 'la défaite efface du journal du combat les Tests de fin de combat').toBe(true);
      expect(log, 'le journal du combat et ses lignes captées divergent').toHaveLength(textes.length);
    });
  });
  it('une entrée plus haute que la page se lit seule, par ses lignes (`ligne`), jusqu’à la dernière', () => {
    const entree = (n: number, texte: string): LigneNumerotee => ({ n, pas: 1, ligne: { de: 'journal', texte, heure: 0 }, differee: false });
    const haute = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n');
    const journal = [entree(0, 'A'), entree(1, haute), entree(2, 'C')];
    expect(rendreLeJournal(journal, 0)).toEqual(['0 [pas 1] A', '+2 : `lire {"quoi":"journal","depuis":1}`']);
    const premiere = rendreLeJournal(journal, 1);
    expect(premiere[0]).toBe('1 [pas 1] l0');
    const suite = /`lire \{"quoi":"journal","depuis":1,"ligne":(\d+)\}`$/.exec(premiere[premiere.length - 1]);
    expect(suite, premiere.join('\n')).not.toBeNull();
    const m = Number(suite![1]);
    expect(premiere.slice(0, -1).map((l) => l.replace(/^1 \[pas 1\] /, ''))).toEqual(haute.split('\n').slice(0, m));
    expect(rendreLeJournal(journal, 1, m)).toEqual([...haute.split('\n').slice(m), '2 [pas 1] C']);
  });
  it('un saut de ligne interne se coupe comme une ligne', () => {
    expect(borner(['un\ndeux', 'trois'], 'journal')).toEqual(['un', 'deux', 'trois']);
  });
});

describe('projection des positions', () => {
  it('un combattant porte sa case et sa couche, que l’hôte texte écrit hors du sol', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const base = partie.etat();
      const [sol, etage] = base.battle!.combatants;
      const combatants = base.battle!.combatants.map((c) => (c.id === sol.id ? { ...c, pos: { x: 2, y: 3 } } : c.id === etage.id ? { ...c, pos: { x: 4, y: 5, z: 1 } } : c));
      const vue = projeterLaPartie({ ...base, battle: { ...base.battle!, combatants } }, 0, 0, { autres: 100, offres: 100, cibles: 100, gestes: 100, entites: 100 });
      const projete = (id: string) => vue.combat!.voisins.liste.find((c) => c.id === id)!;
      expect(projete(sol.id).pos).toEqual([2, 3, 0]);
      expect(projete(etage.id).pos).toEqual([4, 5, 1]);
      expect(ligneDeCombattant(projete(sol.id))).toContain('(2,3)');
      expect(ligneDeCombattant(projete(sol.id))).not.toContain('étage');
      expect(ligneDeCombattant(projete(etage.id))).toContain('(4,5) étage 1');
    } finally {
      partie.fermer();
    }
  });
});

describe('ce que le groupe ne voit pas (#3950, `embuscade-fluviale` : 5 ennemis hors de vue au départ)', () => {
  it('`carte` liste les seuls combattants en vue ; la `fiche` d’un ennemi hors de vue se refuse en mots du joueur', { timeout: 120_000 }, () => {
    const table = partie('embuscade-fluviale', verbe('fenetreValider', 'debutDuRound'));
    try {
      const listes = table.lire('carte').lignes.map((l) => l.slice(2).split(' ')[0]).sort();
      expect(listes, 'la carte : les quatre héros et la barge alliée').toEqual(['chasseur-de-test', 'enemy-enc-fluvial-5', 'soldat-de-test', 'sorcier-de-test', 'tueur-de-test']);
      const fiche = table.lire('fiche', { id: 'enemy-enc-fluvial-1' });
      expect([fiche.erreur, fiche.texte], 'la fiche d’un pirate hors de vue').toEqual(['validation', expect.stringContaining(`fiche : ${t('vision.ficheHorsDeVue')}`)]);
    } finally {
      fermerLaTable();
    }
  });
});
