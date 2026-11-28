import { describe, it, expect, vi } from 'vitest';
import * as fiches from '../noyau/ficheDuPorteur';
import { nouvelEntete, ouvrirLaPartie } from './partieDeTest';
import { lignesDuJournal, TETE_DU_ROUND_SUIVANT, zonesDeLEcran } from './ecran';
import { SANS_ROSTER } from './roster';
import { fenetreADessiner } from './gestes';
import { projeter } from './projection';
import { ACTIONS, dayIndex, formatJourImperial, ligneDeTexte, type Jeu, type LigneDuJournal } from '../noyau/index';
import { ev } from '../noyau/combatLog';
import { MINUTES_PER_DAY } from '../engine/clock';
import { turnEconomyStamp } from '../noyau/endTurnGuard';
import { choixPiegeLame, finishVictory } from '../noyau/combatFlow';
import { choiceStep } from '../noyau/rollSeam';
import { estUneCle, t } from '../i18n';
import type { Bouton, Entite } from './elements';
import { ouvrirLeBanc } from '../noyau/banc.testkit';
import { avanceEtapeCascade } from '../noyau/cascade.testkit';
import { auContact, heroDuDuel } from '../noyau/combatDeTest.testkit';
import { buildSeaPlan } from '../noyau/seaVoyageFlow';
import type { CampaignVessel } from '../noyau/etat';
import { resetSceneRegistry } from '../noyau/monde/registreDesScenes';
import { emptyScene } from '../noyau/monde/scene';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { testScene } from '../scenes/test-fixture';
import { fixtureText } from '../i18n/fixtureText';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { lancerLeScenario } from '../noyau/lancementDeScenario';
import { lancementDuScenario } from '../scenes/test-scenarios/_shared';
import { createHero } from '../engine/character';
import { withBourseMoney } from '../engine/bourse';
import { isRation } from '../engine/provisions';
import { addCondition } from '../engine/conditions';
import { itemFromTrappingById, itemLabel } from '../engine/items';
import { resetRule, setRule } from '../engine/policy';
import type { QualiteDeRepos } from '../data/schemas/grammaire/valeurs';
import { ouvrirDialogue } from '../noyau/dialogue';
import type { Dialogue } from '../noyau/monde/scene';
import { bancDeLInterlude } from '../noyau/interlude.testkit';
import { craftCatalog, learnableTalents, orderCatalog } from '../engine/activities';
import { formatMoney, fromBrass } from '../engine/money';
import type { Choix } from './elements';
import { catalogueDeLaPartie } from './contenu';

const CATALOGUE = catalogueDeLaPartie([]);

describe('le journal de l’écran (`journal.lignes`)', () => {
  it('une ligne par événement, ses sous-lignes (`detail`, sans marque au texte) à son détail, le ton dit ce qu’il pèse et pour quel camp', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const etat = partie.etat();
      const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
      const ennemi = etat.battle!.combatants.find((c) => c.kind === 'ennemi')!;
      const jour = dayIndex(etat.gameTime);
      const heure = etat.gameTime;
      const combat = (kind: Extract<LigneDuJournal, { de: 'combat' }>['evenement']['kind'], text: string, actorId?: string, targetId?: string, h = heure): LigneDuJournal =>
        ({ de: 'combat', evenement: ev(kind, text, actorId, targetId), heure: h });
      const { lignes, jour: dernier } = lignesDuJournal(etat, 3, [
        { de: 'journal', entree: ligneDeTexte('Vous entrez.'), heure },
        combat('round', 'Round 2'),
        combat('attaque', 'Coup porté.', heros.id, ennemi.id),
        combat('detail', 'Tête, 4 Blessures'),
        combat('detail', 'Sonné'),
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
      expect(lignesDuJournal(etat, 0, [combat('detail', 'Seule')], jour).lignes, 'une sous-ligne sans ligne avant elle dans l’appel reste une ligne').toMatchObject([{ texte: 'Seule', detail: null }]);
      const lendemain = heure + MINUTES_PER_DAY;
      expect(lignesDuJournal(etat, 0, [{ de: 'journal', entree: ligneDeTexte('Premier mot.'), heure }, { de: 'journal', entree: ligneDeTexte('Au matin.'), heure: lendemain }], null), 'chaque jour s’ouvre sur sa date, le premier compris').toMatchObject({
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

describe('la pastille d’une offre par candidat (`combat.offres`)', () => {
  it('le catalogue nomme court chaque action qui s’offre par candidat (`ecran.offre.<id>`)', () => {
    const parCandidat = ACTIONS.filter((a) => a.candidates).map((a) => a.id);
    expect(parCandidat, 'des actions s’offrent par candidat').toContain('incantation');
    expect(parCandidat.filter((id) => !estUneCle(`ecran.offre.${id}`))).toEqual([]);
  });
});

describe('les modificateurs de visibilité dans l’écran de jet (MDG 13 l.234–243)', () => {
  const brouillard = { type: 'puce', libelle: 'Brouillard', valeur: '−2 DR' };
  const vessel = (): CampaignVessel => ({
    vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] },
    meteosImposees: [{ label: 'Brouillard', jusqua: 30 * MINUTES_PER_DAY, meteo: { visibilite: { id: 'brouillard' } } }],
  });
  const zones = (etat: Jeu) => zonesDeLEcran(
    etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, [],
  );

  it('l’Orientation joue deux rangées et montre une seule puce de DR pour tout l’équipage', () => {
    const banc = ouvrirLeBanc();
    const [navigateur, vigie] = tousLesHerosDeScenario(idsDeTest);
    banc.setState({
      party: [{ ...navigateur, shipRole: 'navigateur' }, { ...vigie, shipRole: 'vigie' }],
      scene: emptyScene('port-a', 2, 2), lieu: 'A', gameTime: 8 * 60, vessel: vessel(),
      worldMap: {
        id: 'mer', label: 'Mer des Griffes',
        places: [
          { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
          { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' } },
        ],
        routes: [{ id: 'vers-b', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
      },
    });
    banc.getState().ensemencerLeTirage(1);
    banc.getState().partirEnVoyage('vers-b', 'mer', { cadence: 'jourParJour' });
    const etape = () => {
      const c = banc.getState().pendingCascade;
      return c?.participants[c.cursor];
    };
    for (let i = 0; i < 30 && etape() && etape()?.kind !== 'equipage-orientation'; i++) avanceEtapeCascade(banc.getState);
    const orientation = etape();
    expect(orientation?.kind).toBe('equipage-orientation');
    expect(orientation?.participants).toHaveLength(2);
    const ecran = zones(banc.getState());
    expect(ecran['fenetre.corps'].filter((e) => e.type === 'puce' && e.libelle === 'Brouillard')).toEqual([expect.objectContaining(brouillard)]);
    const jets = ecran['groupe.heros'].flatMap((h) => h.elements.filter((e) => e.type === 'jet'));
    expect(jets).toHaveLength(2);
    for (const part of orientation!.participants!) {
      expect(jets.find((j) => j.combattant === part.id)).toMatchObject({ cible: `≤ ${part.target}`, modificateurs: [] });
    }
  });

  it('le tir à 12 m dans le brouillard montre la puce avant et après le jet avec la même cible', () => {
    const banc = ouvrirLeBanc();
    const jouer = banc.getState;
    banc.setState({ party: [heroDuDuel()] });
    jouer().lancerLaScene({ ...testScene(), metresPerTile: 2 });
    banc.setState({ gameTime: 8 * 60, vessel: vessel() });
    const plan = buildSeaPlan(jouer, 'vers-b', 'A', 'B', { km: 550, seaHeading: 'est' })!;
    banc.setState({ travelPlan: { ...plan, interrupted: true } });
    jouer().lancerLeCombat('enc-mutants');
    jouer().fenetreValider('debutDuRound');
    banc.abandonner();
    const { H, E, patch } = auContact(jouer());
    H.weapons = [{ label: 'Projectile de test', type: 'distance', damage: { plusBF: false, flat: 3 }, range: 20, qualities: [] }];
    E.pos = { x: 16, y: 10 };
    banc.setState(patch);
    expect(jouer().travelPlan?.sea?.weather.visibilite).toBe('brouillard');
    jouer().cliquerLaCase(E.pos, E.id, { confirm: true });
    const jet = () => zones(jouer())['fenetre.corps'].filter((e) => e.type === 'jet').find((e) => e.id === 'jet');
    const avant = jet();
    expect(avant).toMatchObject({ resultat: null, modificateurs: expect.arrayContaining([expect.objectContaining(brouillard)]) });
    jouer().jetLancer('attaque');
    expect(jet()).toMatchObject({ cible: avant?.cible, resultat: expect.any(String), modificateurs: expect.arrayContaining([expect.objectContaining(brouillard)]) });
  });
});

describe('la fenêtre du Destin (`fenetre.corps`, `fenetre.gestes`)', () => {
  it('ce qui emporte le héros et ses Points de Destin ; le coup ne s’évite que s’il porte', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const heros = partie.etat().battle!.combatants.find((c) => c.kind === 'heros')!;
      const ecran = (source: NonNullable<Jeu['pendingFateSave']>['source']) => {
        const etat: Jeu = { ...partie.etat(), pendingFateSave: source === 'hit' ? { heroId: heros.id, source, avantLeCoup: structuredClone(heros) } : { heroId: heros.id, source } };
        const fenetre = fenetreADessiner(etat);
        return zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetre, null, SANS_ROSTER, []);
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
  it.each([['hors de vue', false], ['en vue', true]] as const)('un Griffon vaincu %s : la ligne et la valeur de « Dépecer » le nomment comme la vue (#4017)', (_cas, enVue) => {
    const banc = ouvrirLeBanc();
    lancerLeScenario(banc.getState, banc.setState, lancementDuScenario(CATALOGUE.find((s) => s.id === 'melee-dans-le-noir')!, idsDeTest));
    const battle = banc.getState().battle!;
    const pres = battle.combatants.find((c) => (enVue ? c.kind !== 'ennemi' : c.kind === 'ennemi'))!;
    const griffon = combattantDeTest({ id: 'griffon-de-test', label: 'Griffon', kind: 'ennemi', creatureId: 'griffon', pos: { ...pres.pos! } });
    banc.setState({ battle: { ...battle, combatants: [...battle.combatants, griffon].map((c) => (c.kind === 'ennemi' ? { ...c, wounds: { ...c.wounds, current: 0 }, dead: true } : c)) } });
    finishVictory(banc.getState, banc.setState);
    const etat = banc.getState() as unknown as Jeu;
    const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
    const nom = enVue ? 'Griffon' : t('vision.horsDeVue');
    expect(etat.pendingVictory!.defeated.find((d) => d.creatureId === 'griffon'), 'témoin : le Griffon est vaincu, sous la vue de sa case').toMatchObject({ nom, enVue });
    const depecer = zones['fenetre.reglages'].find((g) => g.id === 'fenetreChoisir@victoire#depecer');
    expect(depecer?.type === 'choix' ? depecer.valeurs.map((v) => v.libelle) : [], 'la valeur de « Dépecer » porte le nom de la ligne').toEqual([nom]);
    expect(JSON.stringify(zones).includes('Griffon'), 'le nom du Griffon ne sort que s’il est en vue').toBe(enVue);
    expect(JSON.stringify(zones).includes('Gobelin'), 'les gobelins, hors de vue, ne sont pas nommés').toBe(false);
  });

  it('l’Expérience, l’argent, chaque adversaire vaincu et chaque message ; aucun dépeçage sans créature à dépecer', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const etat: Jeu = { ...partie.etat(), pendingVictory: { xp: 30, gold: { gold: 0, silver: 5, brass: 0 }, defeated: [{ nom: fixtureText('Gobelin'), count: 2, enVue: true }, { nom: fixtureText('Chef'), count: 1, enVue: true }], messages: ['La foule acclame.'] } };
      const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
      expect(zones['fenetre.corps'], 'en puces ce qui est gagné, puis les vaincus et les messages').toMatchObject([
        { id: 'victoire/xp', valeur: '+30' }, { id: 'victoire/argent', valeur: '5/–' },
        { id: 'victoire/vaincu/0', texte: 'Gobelin ×2' }, { id: 'victoire/vaincu/1', texte: 'Chef' }, { id: 'victoire/message/0', texte: 'La foule acclame.' },
      ]);
      const dessines = (z: typeof zones) => [...z['fenetre.gestes'], ...z['fenetre.reglages']].map((g) => g.id);
      expect(dessines(zones), 'un choix sans valeur ne se dessine pas').not.toContain('fenetreChoisir@victoire#depecer');
      const aDepecer: Jeu = { ...etat, pendingVictory: { ...etat.pendingVictory!, defeated: [{ nom: fixtureText('Griffon'), count: 1, creatureId: 'griffon', enVue: true }] } };
      const temoin = zonesDeLEcran(aDepecer, projeter(aDepecer, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(aDepecer), null, SANS_ROSTER, []);
      expect(temoin['fenetre.reglages'].map((g) => g.id), 'témoin : une créature à dépecer se dessine en réglage de la fenêtre').toContain('fenetreChoisir@victoire#depecer');
    } finally {
      partie.fermer();
    }
  });
});

describe('le panneau du combat (`combat.avis`)', () => {
  it('la fin du tour armée par un premier geste qui laisse l’Action intacte se lit, et rien avant', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const b = partie.etat().battle!;
      const avis = (battle: typeof b) => {
        const etat: Jeu = { ...partie.etat(), pendingRoundStart: null, battle };
        expect(fenetreADessiner(etat), 'témoin : aucune fenêtre ne tient la main').toBeNull();
        return zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), null, null, SANS_ROSTER, [])['combat.avis'];
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
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const debut = partie.etat();
      const zones = (etat: Jeu) => zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
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

describe('l’ordre du tour (`combat.ordre`)', () => {
  it('le héros qui agit en premier ce Round reprend au Round suivant sa place de l’ordre canonique', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const debut = partie.etat().battle!;
      const base = debut.baseOrder ?? debut.order;
      const promu = [...base].reverse().find((id) => debut.combatants.find((c) => c.id === id)?.kind === 'heros')!;
      expect(base.indexOf(promu), 'témoin : le héros promu n’ouvre pas l’ordre canonique').toBeGreaterThan(0);
      partie.envoyer({ type: 'fenetreChoisir', args: ['debutDuRound', 'promouvoir', promu] });
      partie.envoyer({ type: 'fenetreValider', args: ['debutDuRound'] });
      const etat = partie.etat();
      expect(etat.battle!.order[0], 'témoin : il ouvre le Round courant').toBe(promu);
      const colonne = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), null, null, SANS_ROSTER, [])['combat.ordre'];
      const enVue = new Set(colonne.flatMap((r) => (r.id.startsWith('ordre/') ? [r.id.slice('ordre/'.length)] : [])));
      expect(enVue.size, 'témoin : plus de combattants en vue que la tête du round suivant n’en montre').toBeGreaterThan(TETE_DU_ROUND_SUIVANT);
      expect(colonne.filter((r) => r.id.startsWith('suite/')).map((r) => r.id).reverse(), 'la tête du round suivant, de bas en haut : l’ordre canonique')
        .toEqual(base.filter((id) => enVue.has(id)).slice(0, TETE_DU_ROUND_SUIVANT).map((id) => `suite/${id}`));
      expect(colonne.find((r) => r.id === 'round'), 'sous lui, le round qui commence').toMatchObject({ type: 'ligne', texte: t('ecran.round', { round: etat.battle!.round + 1 }) });
    } finally {
      partie.fermer();
    }
  });
});

describe('ce que l’étape de la cascade annonce (`fenetre.corps`)', () => {
  it('le choix d’une parade Piège-lame dit sa portée et son issue avant qu’on tranche', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const combattants = partie.etat().battle!.combatants;
      const heros = combattants.find((c) => c.kind === 'heros')!;
      const ennemi = combattants.find((c) => c.kind === 'ennemi')!;
      const lame = ennemi.weapons[0];
      const parade = heros.weapons[0];
      const etape = choiceStep(choixPiegeLame({ defenderId: heros.id, attackerId: ennemi.id, weapon: lame, parryWeaponUid: parade.uid!, defSL: 2, roll: 34 }, heros, ennemi, parade))!;
      const etat: Jeu = { ...partie.etat(), pendingCascade: { title: t('step.paradePiegerLame'), icon: 'objet/arme', purpose: 'combat', cursor: 0, participants: [etape], seq: 1 } };
      const corps = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, [])['fenetre.corps'];
      expect(corps.filter((e) => e.id.startsWith('issue/')).map((e) => 'texte' in e && e.texte), 'ses deux lignes, dans l’ordre du flux').toEqual(etape.outcome!.map((l) => l.entree.texte));
    } finally {
      partie.fermer();
    }
  });
});

describe('la carte d’un héros lit l’en-tête de sa fiche, pas la fiche (#3975)', () => {
  it('dessiner l’écran sans fiche ouverte ne calcule aucune fiche', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'porte-close', { graine: 7 }), () => {});
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
      const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
      expect(zones['groupe.heros'].length, 'aucune carte de héros dessinée').toBeGreaterThan(0);
      expect(appels).toEqual([]);
    } finally {
      partie.fermer();
    }
  });
});

describe('l’établissement fermé à l’écran du lieu (`fenetre.corps`, #4277 B3)', () => {
  it('il reste dessiné, chacun de ses boutons fermé par la raison de l’auteur', () => {
    resetSceneRegistry();
    const banc = ouvrirLeBanc();
    const place = emptyScene('place', 6, 6);
    place.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } });
    banc.getState().fixerLeGroupe(tousLesHerosDeScenario(idsDeTest));
    banc.getState().chargerLeProjet({ scenes: [place], entryId: 'place', projet: null, worldMap: {
      id: 'carte', label: 'Carte', routes: [],
      places: [{ id: 'bourg', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: { id: 'place' }, services: [
        { id: 'club', kind: { id: 'auberge' }, label: 'Le Club', when: { kind: 'flag', expr: 'membre' }, refus: { texte: 'Réservé aux membres.' } },
      ] }],
    } });
    banc.getState().ouvrirLeLieu();
    const etat = banc.getState();
    const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
    const club = zones['fenetre.corps'].find((e) => e.id === 'service/club') as Entite;
    expect(club.elements.filter((e): e is Bouton => e.type === 'bouton').map((b) => [b.id, b.refus])).toEqual([
      ['dormir', 'Réservé aux membres.'], ['informations', 'Réservé aux membres.'],
    ]);
  });
});

describe('le récit du voyage à l’écran (`Projection.recit`, #4574)', () => {
  const recit = (travelRecap: Jeu['travelRecap']) => {
    const banc = ouvrirLeBanc();
    banc.setState({
      scene: emptyScene('bourg', 2, 2), mode: 'exploration', battle: null, travelRecap,
      worldMap: {
        id: 'carte', label: 'Carte',
        places: [
          { id: 'pa', label: 'Altdorf', pos: { x: 0, y: 0 }, scene: { id: 'bourg' } },
          { id: 'pb', label: 'Bourg B', pos: { x: 10, y: 0 }, scene: { id: 'bourg' } },
        ],
        routes: [{ id: 'r1', a: { id: 'pa' }, b: { id: 'pb' }, km: 30, modes: ['pied'] }],
      },
    });
    const etat = banc.getState();
    const corps = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, [])['fenetre.corps'];
    return corps.filter((e) => e.id.startsWith('recit/')).map((e) => e.type === 'entite'
      ? [e.id, e.nom, e.elements.map((l) => (l.type === 'ligne' ? [l.texte, l.ton] : l.type))]
      : [e.id, ...(e.type === 'ligne' ? [e.texte, e.ton] : [e.type])]);
  };
  const base = { depart: 'pa', arrivee: 'pb', route: 'r1', mode: 'pied' } as const;
  const jour = { kmFrom: 0, kmTo: 11.7, hours: 5.6, lines: [{ entree: ligneDeTexte('Une ornière casse l’allure.', { ton: 'echec' }) }, { entree: ligneDeTexte('La route est calme.') }] };

  it('arrivée : le titre, la route élidée, la durée exacte du voyage, sans les journées ni la suite', () => {
    expect(recit({ ...base, status: 'arrived', km: 30, kmDone: 30, days: [jour], dureeMin: 160 })).toEqual([
      ['recit/issue', 'Arrivée à Bourg B', 'reussite'],
      ['recit/route', 'Parti d’Altdorf pour Bourg B · 30 km, à pied', 'neutre'],
      ['recit/duree', 'Voyage de 2 h 40 min.', 'neutre'],
    ]);
  });

  it('interruption à moins d’un demi-km : aux portes de l’arrivée, chaque journée et ses lignes à leur ton, la suite', () => {
    expect(recit({ ...base, status: 'interrupted', km: 12, kmDone: 11.7, days: [jour] })).toEqual([
      ['recit/issue', 'Voyage interrompu !', 'alerte'],
      ['recit/route', 'Parti d’Altdorf pour Bourg B · 12 km, à pied · aux portes de Bourg B', 'neutre'],
      ['recit/jour/0', 'Jour 1 — 12 km en 6 h de route', [['Une ornière casse l’allure.', 'echec'], ['La route est calme.', 'neutre']]],
      ['recit/suite', 'Le voyage pourra reprendre depuis la carte du monde.', 'neutre'],
    ]);
  });

  it('arrêt : ce qui reste, arrondi, et la surcharge', () => {
    expect(recit({ ...base, status: 'stalled', km: 30, kmDone: 12.5, days: [] })).toEqual([
      ['recit/issue', "Le convoi s'arrête", 'alerte'],
      ['recit/route', 'Parti d’Altdorf pour Bourg B · 30 km, à pied · 18 km restants', 'neutre'],
      ['recit/suite', 'Le groupe est trop chargé pour avancer — allégez les sacs, puis reprenez depuis la carte.', 'neutre'],
    ]);
  });

  it('embuscade : le titre, ce qui reste, la journée, et il faut faire face', () => {
    const then = { kind: 'ambush', scene: 'bourg', encounter: 'enc', noSurprise: true } as const;
    expect(recit({ ...base, status: 'interrupted', km: 24, kmDone: 11.7, days: [jour], then })).toEqual([
      ['recit/issue', 'Embuscade en chemin !', 'echec'],
      ['recit/route', 'Parti d’Altdorf pour Bourg B · 24 km, à pied · 12 km restants', 'neutre'],
      ['recit/jour/0', 'Jour 1 — 12 km en 6 h de route', [['Une ornière casse l’allure.', 'echec'], ['La route est calme.', 'neutre']]],
      ['recit/suite', 'Impossible de poursuivre : il faut faire face. Le voyage pourra reprendre ensuite depuis la carte.', 'neutre'],
    ]);
  });
});

describe('la nuit à régler à l’écran (`Projection.repos`, #4574)', () => {
  /** La nuit d'Anna au campement (sauf `places`), sous le temps `weather`, et ce que l'écran en dit : la tête de la
   *  scène, le temps, la note, et les alertes de sa carte. */
  const nuit = (o: { places?: Record<string, boolean>; weather?: string; tente?: boolean; days?: number; quality?: QualiteDeRepos; hemorragique?: boolean; rien?: boolean }) => {
    const anna = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Anna', seed: 11 }), { gold: 0, silver: 2, brass: 0 }, idsDeTest);
    anna.items = [...(anna.items ?? []).filter((i) => !isRation(i)), ...(o.tente ? [itemFromTrappingById('tente', idsDeTest)!] : [])];
    if (o.hemorragique) addCondition(anna, 'hemorragique', 1);
    if (o.tente) setRule('exposition-tente-annule', true);
    try {
      const banc = ouvrirLeBanc({ graine: 7, etat: { party: [anna], ...(o.weather ? { scene: { ...emptyScene('s', 4, 4), weather: o.weather } } : {}) } as Partial<Jeu> });
      banc.getState().offrirLeRepos({ lieu: { nom: fixtureText('Le relais') }, places: o.places ?? { camp: true }, ...(o.days ? { days: o.days } : {}), ...(o.quality ? { quality: o.quality } : {}) });
      if (o.rien) banc.actions.fenetreChoisir('repos', 'pitance', 'rien', anna.id);
      const etat = banc.getState();
      const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
      const carte = zones['groupe.heros'].find((h) => h.id === `heros/${anna.id}`)!;
      return {
        corps: zones['fenetre.corps'].filter((e) => /^(scene\/moment|repos\/)/.test(e.id)).map((e) => [e.id, 'texte' in e ? e.texte : null, 'ton' in e ? e.ton : null]),
        alertes: carte.elements.filter((e) => e.id.startsWith('alerte/')).map((e) => ('libelle' in e ? e.libelle : null)),
      };
    } finally {
      resetRule('exposition-tente-annule');
    }
  };

  it('la tempête au campement : le temps de chien en alerte, puis ce qui attend la dormeuse, dans l’ordre', () => {
    expect(nuit({ weather: 'tempete', hemorragique: true, rien: true })).toEqual({
      corps: [['scene/moment', 'Campement — Le relais', 'neutre'], ['repos/temps', 'Temps de chien', 'alerte']],
      alertes: ['à stabiliser (pas de repos réparateur)', 'Ventre vide', 'Exposition ×4'],
    });
  });

  it('la pluie sous la tente : le mauvais temps, et la tente qui abritera le camp', () => {
    expect(nuit({ weather: 'pluie', tente: true })).toEqual({
      corps: [['scene/moment', 'Campement — Le relais', 'neutre'], ['repos/temps', 'Mauvais temps — la tente abritera le camp', 'alerte']],
      alertes: ['Ventre vide'],
    });
  });

  it('trois nuits chez soi, de piètre qualité : la tête de la scène les dit', () => {
    expect(nuit({ places: { maison: true }, days: 3, quality: 'pietre' })).toEqual({ corps: [['scene/moment', 'Nuit chez soi — Le relais · 3 nuits · piètre', 'neutre']], alertes: [] });
  });
});

describe('la conversation à l’écran (`Projection.conversation`, #4574)', () => {
  it('chaque réponse en bouton : son Test annoncé, son libellé, puis son coût ; l’orateur par son nom', () => {
    const gustav = withBourseMoney(createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Gustav', seed: 11 }), { gold: 0, silver: 0, brass: 0 }, idsDeTest);
    const scene = { ...emptyScene('s', 4, 4), entities: [{ id: 'aubergiste', kind: 'personnage', creature: { id: 'humain' }, label: 'Isolde', pos: { x: 1, y: 1 } }] } as Jeu['scene'];
    const banc = ouvrirLeBanc({ graine: 7, etat: { party: [gustav], scene } as Partial<Jeu> });
    const sonder = { kind: 'test', test: { skill: { id: 'intuition' }, difficulty: 'difficile', label: 'Quelque chose cloche' }, reussite: { kind: 'sequence', etapes: [] }, echec: { kind: 'sequence', etapes: [] } };
    const dialogue = { id: 'd', start: { id: 'n1' }, nodes: [{ id: 'n1', desc: 'Une chambre ?', choices: [
      { id: 'sonder', label: 'La sonder', flow: sonder },
      { id: 'chambre', label: 'Prendre une chambre', cost: { silver: 5 } },
      { id: 'partir', label: 'Partir' },
    ] }] } as unknown as Dialogue;
    banc.setState({ dialogue: ouvrirDialogue(banc.getState(), dialogue, 'aubergiste') });
    const etat = banc.getState();
    const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
    expect(zones['dialogue.orateur'].map((l) => l.texte)).toEqual(['Isolde']);
    expect(zones['dialogue.reponses'].map((b) => [b.id, b.libelle, b.refus])).toEqual([
      ['reponse/sonder', '[Intuition — Difficile (−20)] La sonder', null],
      ['reponse/chambre', 'Prendre une chambre 5/–', 'Pas assez d’argent pour cette option.'],
      ['reponse/partir', 'Partir', null],
    ]);
  });
});

describe('l’interlude à l’écran (`Projection.interlude`, #4574)', () => {
  /** Le héros de l'interlude à l'écran, chacun de ses choix par son libellé. */
  const choixDuHeros = (etat: Jeu, id: string) => {
    const zones = zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), null, SANS_ROSTER, []);
    const heros = zones['fenetre.corps'].find((e): e is Entite => e.id === `repit/${id}`)!;
    return (id: string) => heros.elements.find((e): e is Choix => e.id === id)!.valeurs.map((v) => v.libelle);
  };

  it('chaque valeur dite avec son coût, en PX ou en prix, par le même composeur que l’échoppe', () => {
    const { banc, id } = bancDeLInterlude();
    const article = (nom: string, prix: string) => t('ecran.aCout', { nom, prix });
    expect(choixDuHeros(banc.getState(), id)('order'), 'chaque Commande et son prix').toEqual(orderCatalog().map((o) => article(o.label, formatMoney(fromBrass(o.priceBrass)))));
    banc.actions.fenetreChoisir('interlude', 'activite', 'craft', id);
    expect(choixDuHeros(banc.getState(), id)('ouvrage'), 'chaque ouvrage et ses matériaux').toEqual(craftCatalog().map((o) => article(o.label, formatMoney(fromBrass(o.materialsBrass)))));
    banc.actions.fenetreChoisir('interlude', 'activite', 'learn', id);
    const talents = learnableTalents(banc.getState().party[0]);
    expect(choixDuHeros(banc.getState(), id)('talent'), 'chaque Talent et ses PX').toEqual(talents.map((o) => article(o.label, t('ecran.px', { px: o.xpCost }))));
  });
});

describe('la fiche à l’écran compose ses données (`fiche.porteur`, `fiche.objet`, #4574)', () => {
  it('la bourse et l’argent d’une possession en monnaie, le contenant par son nom', () => {
    const { partie } = ouvrirLaPartie(CATALOGUE, nouvelEntete(CATALOGUE, 'dome', { graine: 7 }), () => {});
    try {
      const etat = partie.etat();
      const heros = etat.battle!.combatants.find((c) => c.kind === 'heros')!;
      let n = 0;
      const fab = () => `ecran-fiche-${++n}`;
      const bourse = { ...itemFromTrappingById('bourse', fab)!, money: { gold: 1, silver: 2, brass: 3 } };
      const besace = itemFromTrappingById('besace', fab)!;
      const dague = { ...itemFromTrappingById('dague', fab)!, inside: besace.uid };
      for (const c of [heros, ...etat.party.filter((h) => h.id === heros.id)]) c.items = [bourse, besace, dague];
      const zones = (objet: string) => zonesDeLEcran(etat, projeter(etat, 0, 0, { autres: 0, offres: 0, cibles: 0, gestes: 0, entites: 0 }), fenetreADessiner(etat), { fiche: { porteur: heros.id, objet } }, SANS_ROSTER, []);
      const enMonnaie = formatMoney({ gold: 1, silver: 2, brass: 3 });
      const z = zones(bourse.uid);
      expect(z['fiche.porteur'][0].elements.find((e) => e.id === 'bourse'), 'la bourse du héros').toMatchObject({ libelle: t('ecran.bourse'), valeur: enMonnaie });
      expect(z['fiche.objet'][0].elements.find((e) => e.id === 'argent'), 'l’argent de la Bourse').toMatchObject({ libelle: enMonnaie });
      expect(zones(dague.uid)['fiche.objet'][0].elements.find((e) => e.id === 'contenant'), 'le contenant de la dague')
        .toMatchObject({ libelle: t('ecran.objet.contenant', { contenant: itemLabel(besace) }) });
    } finally {
      partie.fermer();
    }
  });
});
