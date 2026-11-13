import { describe, it, expect, vi } from 'vitest';
import * as fiches from '../noyau/ficheDuPorteur';
import { nouvelEntete, ouvrirLaPartie } from './partie';
import { lignesDuJournal, zonesDeLEcran } from './ecran';
import { SANS_ROSTER } from './roster';
import { fenetreADessiner } from './gestes';
import { projeter } from './projection';
import { dayIndex, formatJourImperial, type Jeu, type LigneDuJournal } from '../noyau/index';
import { MINUTES_PER_DAY } from '../engine/clock';
import { turnEconomyStamp } from '../noyau/endTurnGuard';
import { choixPiegeLame } from '../noyau/combatFlow';
import { choiceStep } from '../noyau/rollSeam';
import { t } from '../i18n';

describe('le journal de l’écran (`journal.lignes`)', () => {
  it('une ligne par événement, ses sous-lignes à son détail, le ton dit ce qu’il pèse et pour quel camp', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const etat = partie.etat();
      const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
      const ennemi = etat.battle!.combatants.find((c) => c.kind === 'ennemi')!;
      const jour = dayIndex(etat.gameTime);
      const heure = etat.gameTime;
      const combat = (kind: Extract<LigneDuJournal, { de: 'combat' }>['evenement']['kind'], text: string, actorId?: string, targetId?: string, h = heure): LigneDuJournal =>
        ({ de: 'combat', evenement: { kind, text, actorId, targetId }, heure: h });
      const { lignes, jour: dernier } = lignesDuJournal(etat, 3, [
        { de: 'journal', texte: 'Vous entrez.', heure },
        combat('round', 'Round 2'),
        combat('attaque', 'Coup porté.', heros.id, ennemi.id),
        combat('detail', '  ↳ Tête, 4 Blessures'),
        combat('detail', '  ↳ Sonné'),
        combat('critique', 'Critique au bras.', ennemi.id, heros.id),
        combat('mort', 'Hors de combat.', ennemi.id),
        combat('information', ''),
      ], jour);
      expect(lignes.map(({ id, ton, texte, detail }) => ({ id, ton, texte, detail }))).toEqual([
        { id: 'journal/3', ton: 'neutre', texte: 'Vous entrez.', detail: null },
        { id: 'journal/4', ton: 'alerte', texte: 'Round 2', detail: null },
        { id: 'journal/5', ton: 'neutre', texte: 'Coup porté.', detail: 'Tête, 4 Blessures\nSonné' },
        { id: 'journal/8', ton: 'echec', texte: 'Critique au bras.', detail: null },
        { id: 'journal/9', ton: 'reussite', texte: 'Hors de combat.', detail: null },
      ]);
      expect(dernier, 'le jour de la dernière ligne').toBe(jour);
      expect(lignesDuJournal(etat, 0, [combat('detail', '↳ Seule')], jour).lignes, 'une sous-ligne sans ligne avant elle dans l’appel reste une ligne').toMatchObject([{ texte: '↳ Seule', detail: null }]);
      const lendemain = heure + MINUTES_PER_DAY;
      expect(lignesDuJournal(etat, 0, [{ de: 'journal', texte: 'Premier mot.', heure }, { de: 'journal', texte: 'Au matin.', heure: lendemain }], null), 'chaque jour s’ouvre sur sa date, le premier compris').toMatchObject({
        lignes: [
          { id: `journal/jour/${jour}`, ton: 'alerte', texte: formatJourImperial(heure) },
          { id: 'journal/0', texte: 'Premier mot.' },
          { id: `journal/jour/${jour + 1}`, ton: 'alerte', texte: formatJourImperial(lendemain) },
          { id: 'journal/1', texte: 'Au matin.' },
        ],
        jour: jour + 1,
      });
    } finally {
      partie.fermer();
    }
  });
});

describe('la fenêtre du Destin (`fenetre.corps`, `fenetre.gestes`)', () => {
  it('ce qui emporte le héros et ses Points de Destin ; le coup ne s’évite que s’il porte', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const heros = partie.etat().battle!.combatants.find((c) => c.kind === 'heros')!;
      const ecran = (source: NonNullable<Jeu['pendingFateSave']>['source']) => {
        const etat = { ...partie.etat(), pendingFateSave: { heroId: heros.id, source } };
        const fenetre = fenetreADessiner(etat);
        return zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetre, null, SANS_ROSTER);
      };
      const lent = ecran('slow');
      expect(lent['fenetre.corps'], 'l’enjeu en alerte, puis les Points de Destin du héros').toMatchObject([{ id: 'destin/enjeu', ton: 'alerte' }, { id: 'destin/points', valeur: String(heros.fate ?? 0) }]);
      const issues = (zones: ReturnType<typeof ecran>) => zones['fenetre.gestes'].flatMap((g) => ('valeurs' in g ? g.valeurs.map((v) => ('args' in v.jeu ? v.jeu.args : null)) : []));
      expect(lent['fenetre.gestes'].map((g) => g.id), 'un seul choix, qui clôt la fenêtre').toEqual(['fenetreChoisir@destin#issue']);
      expect(issues(lent), 'une mort lente ne s’évite pas : survivre ou l’accepter (LDB 17 l.31)').toEqual([['destin', 'issue', 'survivre'], ['destin', 'issue', 'accepter']]);
      expect(issues(ecran('hit')), 'un coup qui porte s’évite aussi (LDB 17 l.32)').toEqual([['destin', 'issue', 'eviter'], ['destin', 'issue', 'survivre'], ['destin', 'issue', 'accepter']]);
    } finally {
      partie.fermer();
    }
  });
});

describe('la fenêtre de la victoire (`fenetre.corps`, `fenetre.gestes`)', () => {
  it('l’Expérience, l’argent, chaque adversaire vaincu et chaque message ; aucun dépeçage sans créature à dépecer', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const etat: Jeu = { ...partie.etat(), pendingVictory: { xp: 30, gold: { gold: 0, silver: 5, brass: 0 }, defeated: [{ label: 'Gobelin', count: 2 }, { label: 'Chef', count: 1 }], messages: ['La foule acclame.'] } };
      const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER);
      expect(zones['fenetre.corps'], 'en puces ce qui est gagné, puis les vaincus et les messages').toMatchObject([
        { id: 'victoire/xp', valeur: '+30' }, { id: 'victoire/argent', valeur: '5/–' },
        { id: 'victoire/vaincu/0', texte: 'Gobelin ×2' }, { id: 'victoire/vaincu/1', texte: 'Chef' }, { id: 'victoire/message/0', texte: 'La foule acclame.' },
      ]);
      const dessines = (z: typeof zones) => [...z['fenetre.gestes'], ...z['fenetre.reglages']].map((g) => g.id);
      expect(dessines(zones), 'un choix sans valeur ne se dessine pas').not.toContain('fenetreChoisir@victoire#depecer');
      const aDepecer: Jeu = { ...etat, pendingVictory: { ...etat.pendingVictory!, defeated: [{ label: 'Griffon', count: 1, creatureId: 'griffon' }] } };
      const temoin = zonesDeLEcran(aDepecer, projeter(aDepecer, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(aDepecer), null, SANS_ROSTER);
      expect(temoin['fenetre.reglages'].map((g) => g.id), 'témoin : une créature à dépecer se dessine en réglage de la fenêtre').toContain('fenetreChoisir@victoire#depecer');
    } finally {
      partie.fermer();
    }
  });
});

describe('le panneau du combat (`combat.avis`)', () => {
  it('la fin du tour armée par un premier geste qui laisse l’Action intacte se lit, et rien avant', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const b = partie.etat().battle!;
      const avis = (battle: typeof b) => {
        const etat: Jeu = { ...partie.etat(), pendingRoundStart: null, battle };
        expect(fenetreADessiner(etat), 'témoin : aucune fenêtre ne tient la main').toBeNull();
        return zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), null, null, SANS_ROSTER)['combat.avis'];
      };
      expect(avis(b).map((l) => l.id)).not.toContain('finDeTourArmee');
      expect(avis({ ...b, endTurnArmed: turnEconomyStamp(b) }), 'le second geste finit le tour : l’écran le dit').toContainEqual(expect.objectContaining({ id: 'finDeTourArmee', ton: 'alerte', texte: t('ecran.finDeTourArmee') }));
    } finally {
      partie.fermer();
    }
  });
});

describe('le début du Round (`fenetre.gestes`)', () => {
  it('seul ou en réseau, un geste le valide (le quorum lance) ; sans tireur, aucune visée de Tir rapide', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const debut = partie.etat();
      const zones = (etat: Jeu) => zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER);
      const dessines = (etat: Jeu) => { const z = zones(etat); return { gestes: z['fenetre.gestes'].map((g) => g.id), reglages: z['fenetre.reglages'].map((g) => g.id) }; };
      expect(debut.pendingRoundStart, 'le combat du dôme s’ouvre sur la pause de Round').not.toBeNull();
      const seul = { gestes: ['fenetreValider@debutDuRound'], reglages: ['fenetreChoisir@debutDuRound#promouvoir'] };
      expect(dessines(debut), 'seul : qui agit en premier, en réglage, et le lancer').toEqual(seul);
      expect(dessines({ ...debut, net: { ...debut.net, mode: 'hote' } }), 'en réseau : le même geste, qui marque le siège prêt').toEqual(seul);
    } finally {
      partie.fermer();
    }
  });
});

describe('ce que l’étape de la cascade annonce (`fenetre.corps`)', () => {
  it('le choix d’une parade Piège-lame dit sa portée et son issue avant qu’on tranche', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const combattants = partie.etat().battle!.combatants;
      const heros = combattants.find((c) => c.kind === 'heros')!;
      const ennemi = combattants.find((c) => c.kind === 'ennemi')!;
      const lame = ennemi.weapons[0];
      const parade = heros.weapons[0];
      const etape = choiceStep(choixPiegeLame({ defenderId: heros.id, attackerId: ennemi.id, weapon: lame, parryWeaponUid: parade.uid!, defSL: 2, roll: 34 }, heros, ennemi, parade))!;
      const etat: Jeu = { ...partie.etat(), pendingCascade: { title: t('step.paradePiegerLame'), icon: 'objet/arme', purpose: 'combat', cursor: 0, log: [], participants: [etape], seq: 1 } };
      const corps = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER)['fenetre.corps'];
      expect(corps.filter((e) => e.id.startsWith('issue/')).map((e) => 'texte' in e && e.texte), 'ses deux lignes, dans l’ordre du flux').toEqual(etape.outcome!.map((l) => l.text));
    } finally {
      partie.fermer();
    }
  });
});

describe('la carte d’un héros lit l’en-tête de sa fiche, pas la fiche (#3975)', () => {
  it('dessiner l’écran sans fiche ouverte ne calcule aucune fiche', () => {
    const { partie } = ouvrirLaPartie(nouvelEntete('dome', { graine: 7 }), () => {});
    try {
      const etat = partie.etat();
      const ns = fiches as unknown as Record<string, unknown>;
      const appels: string[] = [];
      for (const nom of ['ficheDuPorteur', 'ficheDuCombattant']) {
        const vrai = ns[nom] as (...a: unknown[]) => unknown;
        vi.spyOn(ns, nom, 'get').mockReturnValue((...a: unknown[]) => {
          appels.push(nom);
          return vrai(...a);
        });
      }
      const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER);
      expect(zones['groupe.heros'].length, 'aucune carte de héros dessinée').toBeGreaterThan(0);
      expect(appels).toEqual([]);
    } finally {
      partie.fermer();
    }
  });
});
