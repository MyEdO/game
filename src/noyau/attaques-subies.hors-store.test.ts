/**
 * La série d'attaques subies hors bataille (#3892) : l'op `attaquesSubies` appliquée par l'effet de scène `ops`, `battle`
 * nul, ouvre son dé `nombre` à la porte (`nombreDAttaquesSubies`) ; le dé tombé, la Défense du héros s'ouvre par la
 * chaîne d'une attaque d'ennemi (`doAttack` → `maybeOpenDefense`) et se ferme par `jetValider('defense')` ; refusée, le coup
 * se résout par `resolveAttack`. MDG 15
 * l.163-164, l.177-178 ; `.claude/rules/moteur-et-flux.md:13`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { horsBataille } from './coupHorsBataille.testkit';
import { imposerLesD100 } from './battleRng.testkit';
import { battleRng } from './battleRng';
import { applyEffects, EFFECT_HANDLERS, type EffectRefCtx } from './combatEffects';
import { ouvrirLeBanc, type Banc, type EntreesDuBanc } from './banc.testkit';
import { heroFaceAUnEnnemi } from './combatDeTest.testkit';
import { fermerLaSerieSubie } from './combatFlow';
import { refusDeSauvegarde } from './persistance/save';
import { applyOps } from '../engine/ops';
import { touchActors } from './combatOrParty';
import { fenetreDeDefense } from './fenetreDeDefense';
import { porteurParId } from './monde/combatants';
import { markFixedDie } from './fixedDieMark';
import { testScene } from '../scenes/test-fixture';
import { entreeEnRencontre } from '../engine/persistence';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { t } from '../i18n';
import { gameOpSchema } from '../data/schemas/grammaire/mecanique';
import { ligneDuCoup } from '../engine/combat';
import { resetRule, setRule } from '../engine/policy';
import { nomDe } from '../engine/nom';

afterEach(() => {
  vi.restoreAllMocks();
  resetRule('combat-cible-inconsciente');
  resetRule('maladie-mode');
});

const rats = { type: 'statblock', label: 'Rats géants', char: { 'capacite-de-combat': 35 }, traits: [{ id: 'arme', value: 5 }] };
const op = gameOpSchema.parse({ op: 'attaquesSubies', assaillant: { statblock: rats }, nombre: { dice: { n: 1, sides: 10 } } });
const attaques = (on: 'heros' | 'groupe', heroId?: string): Effect => ({ type: 'ops', on, ...(heroId ? { heroId } : {}), ops: [op] });

/** Trois Blessures au héros `heroId` : l'Effet authoré qui SUIT l'op dans la liste. */
const troisBlessures = (heroId: string): Effect => ({ type: 'ops', on: 'heros', heroId, ops: [gameOpSchema.parse({ op: 'wounds', amount: 3 })] });

/** Le héros du groupe, aucune bataille, l'op appliquée (puis les Effets `suivants`) : le dé `nombre` ouvert à la porte, non tombé. */
function deOuvert(suivants: (heroId: string) => Effect[] = () => [], reglesMaison?: EntreesDuBanc['reglesMaison']) {
  const { banc, H } = horsBataille(testScene(), reglesMaison);
  applyEffects(banc.getState, banc.setState, [attaques('heros', H.id), ...suivants(H.id)]);
  return { banc, H, etape: banc.getState().pendingCascade!.participants[0] };
}

/** La série ouverte : le dé `nombre` POSÉ à `nombre` (7) à la porte, les d100 de la série imposés (`des`). */
function serieOuverte(des: number[] = [65, 23], nombre = 7, suivants?: (heroId: string) => Effect[], reglesMaison?: EntreesDuBanc['reglesMaison']) {
  const { banc, H, etape } = deOuvert(suivants, reglesMaison);
  imposerLesD100(...des);
  banc.getState().jetImposerLeResultat('cascadeTirage', nombre, etape.id);
  banc.getState().jetValider('cascade');
  return { banc, H };
}

/** L'état que l'application de l'op ne doit pas toucher quand elle est refusée. */
const etatTouche = (s: ReturnType<Banc['getState']>) =>
  ({ party: s.party, battle: s.battle, serieSubie: s.serieSubie, pendingCascade: s.pendingCascade, pendingDefense: s.pendingDefense });

describe('série d’attaques subies hors bataille (#3892)', () => {
  it('le dé `nombre` passe par la porte : étape à dé nu du héros, aucune série avant qu’il tombe', () => {
    const { banc, H, etape } = deOuvert();
    expect(etape).toMatchObject({ kind: 'nombreDAttaquesSubies', actorId: H.id, de: { spec: { n: 1, sides: 10 } } });
    expect(etape.meta).toMatchObject({ differeLaSuite: true, attaquesSubies: [op] });
    expect(banc.getState().serieSubie).toBeNull();
    expect(banc.getState().party[0]).toBe(H);
  });

  it('pose `serieSubie` au dé tombé : l’assaillant né du statbloc, `restantes` = le d10 posé, le héros sous sa forme de rencontre', () => {
    const { banc, H } = serieOuverte();
    const s = banc.getState();
    expect(s.battle).toBeNull();
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 7, avant: H });
    expect(s.serieSubie!.assaillant).toMatchObject({ label: 'Rats géants', kind: 'ennemi' });
    expect(s.serieSubie!.assaillant.pos).toBeUndefined();
    expect(s.party[0]).not.toBe(H);
    expect(s.party[0]).toEqual(entreeEnRencontre(H));
  });

  it('`porteurParId` rend l’assaillant de la série', () => {
    const { banc } = serieOuverte();
    const s = banc.getState();
    expect(porteurParId(s, s.serieSubie!.assaillant.id)).toBe(s.serieSubie!.assaillant);
  });

  it('la Défense du héros s’ouvre : `pendingDefense` posé, fenêtre de Défense non nulle', () => {
    const { banc, H } = serieOuverte();
    const s = banc.getState();
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
    expect(fenetreDeDefense(s)).toMatchObject({ attaquantId: s.serieSubie!.assaillant.id, defenseurId: H.id });
  });

  it('deux cibles (« on: party », deux héros) : refus, aucun état posé', () => {
    const { banc, H } = horsBataille(testScene());
    banc.setState({ party: [H, { ...structuredClone(H), id: 'second', label: 'Second' }] });
    expect(() => applyEffects(banc.getState, banc.setState, [attaques('groupe')])).toThrow(t('eff.attaquesSubiesSansCibleUnique', { on: 'groupe' }));
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
  });

  it('`attaquesSubies` accompagnée dans sa feuille : refus, au lancer comme à l’éditeur', () => {
    const { banc, H } = horsBataille(testScene());
    const feuille: Extract<Effect, { type: 'ops' }> = { type: 'ops', on: 'heros', heroId: H.id, ops: [op, gameOpSchema.parse({ op: 'wounds', amount: 3 })] };
    const message = t('eff.attaquesSubiesSeuleDansSaFeuille', { on: 'heros', ops: 'attaquesSubies, wounds' });
    expect(EFFECT_HANDLERS.ops.refs!(feuille, {} as EffectRefCtx)).toEqual([{ level: 'error', message }]);
    const avant = etatTouche(banc.getState());
    expect(() => applyEffects(banc.getState, banc.setState, [feuille])).toThrow(message);
    expect(etatTouche(banc.getState())).toEqual(avant);
  });

  it('en bataille : refus nommé, aucun état posé', () => {
    const banc = ouvrirLeBanc();
    const { H } = heroFaceAUnEnnemi(banc, testScene());
    const avant = etatTouche(banc.getState());
    expect(() => applyEffects(banc.getState, banc.setState, [attaques('heros', H.id)])).toThrow(t('eff.attaquesSubiesSerieEngagee'));
    expect(etatTouche(banc.getState())).toEqual(avant);
  });

  it('une série déjà ouverte : refus nommé, la série en cours n’est pas écrasée', () => {
    const { banc, H } = serieOuverte();
    const avant = etatTouche(banc.getState());
    expect(() => applyEffects(banc.getState, banc.setState, [attaques('heros', H.id)])).toThrow(t('eff.attaquesSubiesSerieEngagee'));
    expect(etatTouche(banc.getState())).toEqual(avant);
  });

  it('la sortie rend au groupe le héros d’avant, augmenté de ce qui sort de la rencontre', () => {
    const { banc, H } = serieOuverte();
    const enRencontre = banc.getState().party[0];
    enRencontre.engagedWith = ['quelquun'];
    enRencontre.wounds = { ...enRencontre.wounds, current: enRencontre.wounds.current - 2 };
    fermerLaSerieSubie(banc.getState, banc.setState);
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].engagedWith).toEqual(H.engagedWith);
    expect(s.party[0].wounds.current).toBe(H.wounds.current - 2);
  });

  /** Le héros lance sa Défense dans la fenêtre, le d100 `defense` POSÉ, puis la valide : rend le coup tranché. */
  function defendre(banc: Banc, defense: number) {
    const g = banc.getState;
    g().jetLancer('defense');
    g().jetImposerLeResultat('defense', defense);
    const res = g().pendingDefense!.result!;
    g().jetValider('defense');
    return res;
  }

  it('Défense surfacée perdue : le coup s’applique hors bataille, Blessures retirées, ligne au journal', () => {
    const { banc, H } = serieOuverte([20, 23]);
    const avant = banc.getState().party[0].wounds.current;
    const res = defendre(banc, 97);
    const s = banc.getState();
    expect(res.hit && !!res.woundsLost).toBe(true);
    expect(s.party[0].wounds.current).toBe(avant - res.woundsLost!);
    expect(s.journal).toContain(ligneDuCoup(res));
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 6 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
  });

  it('Défense surfacée gagnée : aucune Blessure, la ligne du coup au journal', () => {
    const { banc, H } = serieOuverte([20, 23]);
    const avant = banc.getState().party[0].wounds.current;
    const res = defendre(banc, 5);
    const s = banc.getState();
    expect(res.hit).toBe(false);
    expect(s.party[0].wounds.current).toBe(avant);
    expect(s.journal).toContain(ligneDuCoup(res));
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 6 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
  });

  it('l’Effet suivant attend la fin de la série, Défense perdue : ses 3 Blessures tombent après la fermeture', () => {
    const { banc, H } = serieOuverte([20, 23], 1, (id) => [troisBlessures(id)]);
    expect(banc.getState().party[0].wounds.current).toBe(H.wounds.current);
    const res = defendre(banc, 97);
    const s = banc.getState();
    expect(res.hit && !!res.woundsLost).toBe(true);
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].wounds.current).toBe(Math.max(0, H.wounds.current - res.woundsLost! - 3));
  });

  it('l’Effet suivant attend la fin de la série, Défense gagnée : ses 3 Blessures tombent après la fermeture', () => {
    const { banc, H } = serieOuverte([20, 23], 1, (id) => [troisBlessures(id)]);
    expect(banc.getState().party[0].wounds.current).toBe(H.wounds.current);
    expect(defendre(banc, 5).hit).toBe(false);
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].wounds.current).toBe(H.wounds.current - 3);
  });

  /** L'étape de Blessure critique de la séquence : sa sévérité POSÉE à `severite`, puis la voie `choix` tranchée et
   *  validée. Rend l'étape avant validation (le pli y a posé le Critique). */
  function trancherLeCritique(banc: Banc, severite: number, choix: 'subir' | 'devier') {
    const g = banc.getState;
    const id = g().pendingCascade!.participants.find((x) => x.kind === 'deviation')!.id;
    g().jetImposerLeResultat('cascadeTirage', severite, id);
    const etape = g().pendingCascade!.participants.find((x) => x.id === id)!;
    g().jetRegler('cascade', 'choix', choix, id);
    g().jetValider('cascade');
    return etape;
  }

  it('l’Effet suivant attend pendant la Déviation d’un Critique, puis « Subir » : Critique encaissé, série poursuivie et fermée, ses 3 Blessures tombent', () => {
    const { banc, H } = serieOuverte([22, 23, 50, 20], 2, (id) => [troisBlessures(id)]);
    const coup = defendre(banc, 97);
    let s = banc.getState();
    expect(s.pendingCascade!.participants.find((x) => x.kind === 'deviation')?.options).toBeTruthy();
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 2 });
    expect(s.party[0].wounds.current).toBe(H.wounds.current);
    const etape = trancherLeCritique(banc, 1, 'subir');
    s = banc.getState();
    expect(etape.deviation, 'le pli pose le Critique hors bataille').toBeTruthy();
    expect(s.party[0].criticalWounds).toBe(1);
    expect(s.party[0].wounds.current).toBe(H.wounds.current - coup.woundsLost! - 1);
    expect(s.journal.some((l) => l.includes(etape.table!.result!.lines[0]))).toBe(true);
    expect(s.serieSubie).toMatchObject({ restantes: 1 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
    expect(defendre(banc, 5).hit).toBe(false);
    s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].wounds.current).toBe(H.wounds.current - coup.woundsLost! - 1 - 3);
  });

  it('Déviation d’un Critique « Dévier » : 1 PA sacrifiée, Critique ignoré, série fermée, ses 3 Blessures tombent : LDB 63 l.30', () => {
    const { banc, H } = serieOuverte([22, 23, 50], 1, (id) => [troisBlessures(id)]);
    const coup = defendre(banc, 97);
    trancherLeCritique(banc, 1, 'devier');
    const s = banc.getState();
    expect(s.journal).toContain(markFixedDie(t('cf.critiqueDevieSurLArmure', { name: nomDe(H) })));
    expect(s.party[0].criticalWounds ?? 0).toBe(0);
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].wounds.current).toBe(H.wounds.current - coup.woundsLost! - 3);
  });

  /** La série de 2 attaques d'où le héros sort après un Critique encaissé (« Subir ») à la première, la sévérité POSÉE à
   *  `severite`, la localisation au d100 `lieu`, sa révélation validée, la seconde attaque parée : la série fermée. */
  function serieFermeeApresUnCritique(severite: number, lieu: number, reglesMaison?: EntreesDuBanc['reglesMaison']) {
    const { banc, H } = serieOuverte([22, 23, lieu, 20], 2, undefined, reglesMaison);
    defendre(banc, 97);
    const etape = trancherLeCritique(banc, severite, 'subir');
    const pc = banc.getState().pendingCascade!;
    if (pc.participants[pc.cursor].kind === 'critique') banc.getState().jetValider('cascade');
    expect(defendre(banc, 5).hit).toBe(false);
    expect(banc.getState().serieSubie).toBeNull();
    return { banc, H, etape };
  }

  /** Les étapes de fin de rencontre ouvertes (Contraction, Exposition à la Corruption). */
  const etapesDeFinDeRencontre = (s: ReturnType<Banc['getState']>) =>
    (s.pendingCascade?.participants ?? []).filter((x) => x.kind === 'maladieDeFinDeCombat' || x.kind === 'corruptionDeFinDeCombat');

  it('Critique encaissé pendant la série, maladies « full » : l’Infection mineure s’ouvre à la fermeture et frappe le héros rendu au groupe : LDB 20 l.90', () => {
    const { banc, H } = serieFermeeApresUnCritique(1, 50, { 'maladie-mode': 'full' });
    const [etape, ...autres] = etapesDeFinDeRencontre(banc.getState());
    expect(autres).toEqual([]);
    expect(etape).toMatchObject({ kind: 'maladieDeFinDeCombat', meta: { entry: 'infection', disease: 'infection-mineure' } });
    expect(etape.participants!.map((p) => p.id)).toEqual([H.id]);
    expect(banc.getState().party[0].tookCriticalThisFight).toBeUndefined();
    imposerLesD100(99);
    banc.getState().jetLancer('cascadeEnBande', H.id);
    banc.getState().jetValider('cascade');
    expect(banc.getState().party[0].diseases?.map((d) => d.id)).toContain('infection-mineure');
  });

  it('Critique encaissé pendant la série, maladies « off » : aucune étape de fin de rencontre : LDB 20 l.90', () => {
    const { banc } = serieFermeeApresUnCritique(1, 50, { 'maladie-mode': 'off' });
    expect(etapesDeFinDeRencontre(banc.getState())).toEqual([]);
    expect(banc.getState().party[0].diseases ?? []).toEqual([]);
  });

  /** La seule étape encore ouverte de la séquence, un `testDeclenche`. */
  function seuleEtapeOuverte(banc: Banc) {
    const ouvertes = banc.getState().pendingCascade!.participants.filter((x) => !x.committed);
    expect(ouvertes.map((x) => x.kind)).toEqual(['testDeclenche']);
    return ouvertes[0];
  }

  /** Lance l'étape `id` de la séquence au d100 `de` POSÉ, puis la valide. */
  function lancerLEtape(banc: Banc, id: string, de: number) {
    imposerLesD100(de);
    banc.getState().jetLancer('cascade', id);
    banc.getState().jetValider('cascade');
  }

  it('« Coupure à l’orteil » encaissée pendant la série : le Test s’ouvre à la fermeture en étape de la séquence, son échec ampute le héros rendu au groupe : LDB 18 l.171', () => {
    const { banc, H, etape } = serieFermeeApresUnCritique(46, 85);
    expect(etape.table?.result?.id).toBe('coupure-a-l-orteil');
    let s = banc.getState();
    const pc = s.pendingCascade!;
    const test = pc.participants[pc.cursor];
    expect(test).toMatchObject({ kind: 'testDeclenche', actorId: H.id, difficulty: 'intermediaire', rollLabel: 'Résistance' });
    expect(s.pendingTest).toBeNull();
    expect(s.party[0].traumas?.some((t) => t.pendingAmputation)).toBe(false);
    lancerLEtape(banc, test.id, 99);
    const amputation = banc.getState().pendingCascade!.participants.find((x) => x.kind === 'testDeclenche' && !x.committed)!;
    expect(amputation).toMatchObject({ actorId: H.id, difficulty: 'accessible', label: 'Amputation' });
    lancerLEtape(banc, amputation.id, 5);
    s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].traumas?.find((t) => t.traumaId === 'orteil-ampute')).toMatchObject({ location: 'jambeG', count: 1 });
  });

  it('« Orteil contusionné » encaissé pendant la série : son Test est la seule fenêtre, sa clôture ouvre la Défense suivante, la série se ferme au compte juste : criticals.json `orteil-contusionne`, LDB 18 l.161 ; #4011', () => {
    const { banc, H } = serieOuverte([22, 23, 85, 20], 2);
    defendre(banc, 97);
    const etape = trancherLeCritique(banc, 1, 'subir');
    expect(etape.table?.result?.id).toBe('orteil-contusionne');
    const pc = banc.getState().pendingCascade!;
    if (pc.participants[pc.cursor].kind === 'critique') banc.getState().jetValider('cascade');
    let s = banc.getState();
    const test = seuleEtapeOuverte(banc);
    expect(test).toMatchObject({ actorId: H.id, difficulty: 'accessible', rollLabel: 'Résistance' });
    expect(s.pendingTest).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.serieSubie).toMatchObject({ restantes: 2 });
    lancerLEtape(banc, test.id, 99);
    s = banc.getState();
    expect(s.serieSubie).toMatchObject({ restantes: 1 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
    expect(defendre(banc, 5).hit).toBe(false);
    s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
  });

  it('Crampes abdominales, Défense ratée à DR −5 : Sonné, le Test de Force Mentale est la seule fenêtre, sa clôture ouvre la Défense suivante, la série se ferme : MSRC 16 l.152-158 ; #4011', () => {
    const { banc, H } = horsBataille(testScene());
    banc.setState({ party: [{ ...H, diseases: [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }] }] });
    applyEffects(banc.getState, banc.setState, [attaques('heros', H.id)]);
    imposerLesD100(20, 23, 99, 96);
    banc.getState().jetImposerLeResultat('cascadeTirage', 2, banc.getState().pendingCascade!.participants[0].id);
    banc.getState().jetValider('cascade');
    expect(defendre(banc, 75).defenderDetail).toMatchObject({ success: false, sl: -5 });
    let s = banc.getState();
    const test = seuleEtapeOuverte(banc);
    expect(test).toMatchObject({ actorId: H.id, label: 'Force Mentale (crampes)' });
    expect(s.party[0].conditions).toContainEqual({ id: 'sonne', value: 1 });
    expect(s.pendingTest).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.serieSubie).toMatchObject({ restantes: 2 });
    banc.getState().jetLancer('cascade', test.id);
    banc.getState().jetValider('cascade');
    s = banc.getState();
    expect(s.party[0].conditions).toContainEqual({ id: 'a-terre', value: 1 });
    expect(s.serieSubie).toMatchObject({ restantes: 1 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
    expect(defendre(banc, 5).hit).toBe(false);
    s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
  });

  it('série sans Critique : aucune étape de fin de rencontre', () => {
    const { banc } = serieOuverte([20, 23], 1, undefined, { 'maladie-mode': 'full' });
    expect(defendre(banc, 5).hit).toBe(false);
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(etapesDeFinDeRencontre(s)).toEqual([]);
    expect(s.pendingTest).toBeNull();
  });

  /** Un Critique LÉTAL encaissé pendant la série (sévérité 100, « Subir ») au héros à Destin : la mort suspendue au
   *  Destin (`pendingFateSave`), la série en attente, ses 3 Blessures non tombées. */
  function critiqueLetalPendantLaSerie() {
    const { banc, H } = serieOuverte([22, 23, 50, 20], 2, (id) => [troisBlessures(id)]);
    expect(H.fate ?? 0).toBeGreaterThan(0);
    const coup = defendre(banc, 97);
    trancherLeCritique(banc, 100, 'subir');
    const s = banc.getState();
    expect(s.pendingFateSave).toMatchObject({ heroId: H.id, foeId: s.serieSubie!.assaillant.id });
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 2 });
    expect(s.pendingDefense).toBeNull();
    return { banc, H, coup };
  }

  it('Critique létal, Destin « Comment ça a pu rater ? » : la série reprend, Défense suivante ouverte, puis se ferme et ses 3 Blessures tombent : LDB 17 l.32', () => {
    const { banc, H } = critiqueLetalPendantLaSerie();
    banc.getState().fenetreChoisir('destin', 'issue', 'eviter');
    let s = banc.getState();
    expect(s.pendingFateSave).toBeNull();
    expect(s.party[0].fate).toBe((H.fate ?? 0) - 1);
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 1 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
    expect(defendre(banc, 5).hit).toBe(false);
    s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.party[0].dead).toBeFalsy();
    expect(s.party[0].wounds.current).toBe(H.wounds.current - 3);
  });

  it('Critique létal, Destin « Meurs un autre jour » : le héros Inconscient, hors d’action, la série se ferme : LDB 17 l.31', () => {
    const { banc, H } = critiqueLetalPendantLaSerie();
    banc.getState().fenetreChoisir('destin', 'issue', 'survivre');
    const s = banc.getState();
    expect(s.pendingFateSave).toBeNull();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].fate).toBe((H.fate ?? 0) - 1);
    expect(s.party[0].conditions).toContainEqual({ id: 'inconscient', value: 1 });
    expect(s.party[0].dead).toBeFalsy();
  });

  it('Critique létal, Destin refusé : le seul héros meurt, la série se ferme sur la défaite du groupe : LDB 17 l.29', () => {
    const { banc, H } = critiqueLetalPendantLaSerie();
    banc.getState().fenetreChoisir('destin', 'issue', 'accepter');
    const s = banc.getState();
    expect(s.pendingFateSave).toBeNull();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].fate).toBe(H.fate);
    expect(s.party[0].dead).toBe(true);
    expect(s.partyWiped).toBe(true);
  });

  /** La série d'un assaillant à la dague (« Arme (dague) », `bladed` au catalogue) contre le héros armé d'un Brise-épée
   *  (Piège-lame) : sa Parade au Brise-épée, réussie sur un double (11), ouvre l'étape de choix « piège-lame », tranchée
   *  `choix`. LDB 62 l.278-280 */
  function piegeALameOuvert() {
    const { banc, H } = horsBataille(testScene());
    const briseEpee = { label: 'Brise-épée', type: 'melee' as const, damage: { plusBF: true, flat: 3 }, qualities: [{ id: 'piege-lame' }], bladed: true, uid: 'brise-epee' };
    banc.setState({ party: [{ ...H, weapons: [briseEpee, ...H.weapons] }] });
    const coupeJarret = { type: 'statblock', label: 'Coupe-jarret', char: { 'capacite-de-combat': 35 }, traits: [{ id: 'arme', value: 5, arg: 'dague' }] };
    const opDague = gameOpSchema.parse({ op: 'attaquesSubies', assaillant: { statblock: coupeJarret }, nombre: { dice: { n: 1, sides: 10 } } });
    applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'heros', heroId: H.id, ops: [opDague] }]);
    imposerLesD100(65, 23);
    banc.getState().jetImposerLeResultat('cascadeTirage', 2, banc.getState().pendingCascade!.participants[0].id);
    banc.getState().jetValider('cascade');
    const g = banc.getState;
    g().jetRegler('defense', 'reaction', 'parade');
    g().jetRegler('defense', 'armeDeParade', briseEpee.uid);
    expect(defendre(banc, 11)).toMatchObject({ hit: false, parryWeapon: { uid: briseEpee.uid } });
    const etape = g().pendingCascade!.participants.find((x) => x.kind === 'piegeALame')!;
    expect(etape.piegeLame).toMatchObject({ defenderId: H.id, attackerId: g().serieSubie!.assaillant.id });
    return { banc, H, etape };
  }

  function piegeALameDansLaSerie(choix: 'piege' | 'critique') {
    const { banc, H, etape } = piegeALameOuvert();
    banc.getState().jetRegler('cascade', 'choix', choix, etape.id);
    banc.getState().jetValider('cascade');
    return { banc, H };
  }

  it('Piège-lame en Parade : la série attend le choix Piéger ou Critique, aucune Défense suivante avant lui : LDB 62 l.278-280 ; #4011', () => {
    const { banc } = piegeALameOuvert();
    const s = banc.getState();
    expect(s.pendingDefense).toBeNull();
    expect(s.serieSubie).toMatchObject({ restantes: 2 });
    const pc = s.pendingCascade!;
    expect(pc.participants[pc.cursor].kind).toBe('piegeALame');
  });

  it('Piège-lame en Parade, « Coup Critique » : le Critique placé sur l’assaillant se dit, la série se poursuit : LDB 62 l.278, LDB 14 l.3', () => {
    const { banc, H } = piegeALameDansLaSerie('critique');
    const s = banc.getState();
    expect(s.journal).toContain(t('cf.critiqueEnDefense', { name: nomDe(H) }));
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 1 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
  });

  it('Piège-lame en Parade, « Piéger » gagné : la dague arrachée des mains de l’assaillant, la série se poursuit : LDB 62 l.280', () => {
    const { banc, H } = piegeALameDansLaSerie('piege');
    const g = banc.getState;
    const test = g().pendingCascade!.participants.find((x) => x.kind === 'testDeclenche')!;
    g().jetLancer('cascade', test.id);
    g().jetValider('cascade');
    const s = g();
    const assaillant = s.serieSubie!.assaillant;
    const issue = s.pendingCascade!.participants.find((x) => x.kind === 'issueDuPiegeALame')!;
    expect(issue.outcome).toContainEqual(expect.objectContaining({ text: t('cf.armeLachee', { name: nomDe(assaillant), weapon: 'Dague' }) }));
    expect(assaillant.weapons.some((w) => w.label === 'Dague')).toBe(false);
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 1 });
    expect(s.pendingDefense).toMatchObject({ attackerId: assaillant.id, defenderId: H.id });
  });

  /** La série de 2 attaques d'un assaillant au Marteau à bec-de-corbin (Assommante, LDB 62 l.235), dont la 1ʳᵉ touche la
   *  Tête du héros (d100 20 → 02) : la Défense perdue, l'étape `testDeclenche` de l'Atout ouverte. */
  function assommanteALaTete() {
    const { banc, H } = horsBataille(testScene());
    const brute = { type: 'statblock', label: 'Brute', char: { 'capacite-de-combat': 35, force: 60 }, traits: [{ id: 'arme', value: 5, arg: 'marteau-a-bec-de-corbin' }] };
    const opBrute = gameOpSchema.parse({ op: 'attaquesSubies', assaillant: { statblock: brute }, nombre: { dice: { n: 1, sides: 10 } } });
    applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'heros', heroId: H.id, ops: [opBrute] }]);
    imposerLesD100(20, 23, 20, 23, 20);
    banc.getState().jetImposerLeResultat('cascadeTirage', 2, banc.getState().pendingCascade!.participants[0].id);
    banc.getState().jetValider('cascade');
    const coup = defendre(banc, 97);
    expect(coup).toMatchObject({ hit: true, location: 'tete' });
    return { banc, H };
  }

  it('Assommante à la Tête : le Test de l’Atout s’ouvre SEUL, sa clôture ouvre la Défense suivante, la série se ferme au compte juste : LDB 62 l.235 ; #4011', () => {
    const { banc } = assommanteALaTete();
    let s = banc.getState();
    const ouvertes = s.pendingCascade!.participants.filter((x) => !x.committed);
    expect(ouvertes.map((x) => x.kind)).toEqual(['testDeclenche']);
    expect(s.pendingDefense).toBeNull();
    expect(s.serieSubie).toMatchObject({ restantes: 2 });
    banc.getState().jetLancer('cascade', ouvertes[0].id);
    banc.getState().jetValider('cascade');
    s = banc.getState();
    expect(s.serieSubie).toMatchObject({ restantes: 1 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id });
    expect(defendre(banc, 5).hit).toBe(false);
    s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
  });

  it('héros Inconscient, régime « critique » : le Critique du coup se tranche et s’applique, puis la série se ferme : LDB 16 l.113', () => {
    const { banc, H } = horsBataille(testScene());
    setRule('combat-cible-inconsciente', 'critique');
    const inconscient = gameOpSchema.parse({ op: 'condition', id: { id: 'inconscient' }, value: 1 });
    applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'heros', heroId: H.id, ops: [inconscient] }, attaques('heros', H.id)]);
    imposerLesD100(20);
    banc.getState().jetImposerLeResultat('cascadeTirage', 2, banc.getState().pendingCascade!.participants[0].id);
    banc.getState().jetValider('cascade');
    expect(banc.getState().serieSubie).toMatchObject({ cibleId: H.id, restantes: 2 });
    trancherLeCritique(banc, 1, 'subir');
    const s = banc.getState();
    expect(s.party[0].criticalWounds).toBe(1);
    expect(s.serieSubie).toBeNull();
    expect(s.partyWiped).toBe(true);
  });

  it('série de 3 attaques jusqu’à son terme : une Défense par attaque, puis le héros rendu au groupe, Blessures reportées', () => {
    const { banc, H } = serieOuverte([20, 20, 20], 3);
    const perdue = defendre(banc, 97);
    expect(banc.getState().serieSubie).toMatchObject({ restantes: 2 });
    expect(defendre(banc, 5).hit).toBe(false);
    expect(banc.getState().serieSubie).toMatchObject({ restantes: 1 });
    expect(defendre(banc, 5).hit).toBe(false);
    const s = banc.getState();
    expect(perdue.hit && !!perdue.woundsLost).toBe(true);
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].engagedWith).toEqual(H.engagedWith);
    expect(s.party[0].wounds.current).toBe(H.wounds.current - perdue.woundsLost!);
  });

  it('l’assaillant qui perd son Action (`loseTurn`) : l’attaque suivante est décomptée sans être jouée', () => {
    const { banc } = serieOuverte([20, 20], 3);
    applyOps(banc.getState().serieSubie!.assaillant, [{ op: 'loseTurn', what: 'action' }], { idNeuf: banc.getState().forgerUnId, rng: battleRng() });
    banc.setState(touchActors(banc.getState()));
    defendre(banc, 5);
    const s = banc.getState();
    expect(s.serieSubie).toMatchObject({ restantes: 1 });
    expect(s.serieSubie!.assaillant.loseNextAction).toBe(false);
    expect(s.journal).toContain(t('cf.perdLAction', { name: nomDe(s.serieSubie!.assaillant) }));
    expect(s.pendingDefense).not.toBeNull();
    defendre(banc, 5);
    expect(banc.getState().serieSubie).toBeNull();
  });

  /** La ligne d'Oups ! de `nom` pour l'entrée `effet` du Tableau des Oups !. */
  const ligneDOups = (nom: string, effet: string) => (l: string) => l.startsWith(t('cf.oups', { name: nom, effet: '' })) && l.includes(effet.slice(0, 20));

  it('Maladresse de l’assaillant (66, double raté), Oups ! 75 : son attaque suivante est décomptée sans jet : LDB 14 l.19, l.28', () => {
    const { banc } = serieOuverte([66, 23, 75], 3);
    defendre(banc, 5);
    const s = banc.getState();
    const nom = nomDe(s.serieSubie!.assaillant);
    expect(s.journal.some(ligneDOups(nom, 'Vous ne tenez pas votre arme')), s.journal.join(' | ')).toBe(true);
    expect(s.journal).toContain(t('cf.perdLAction', { name: nom }));
    expect(s.serieSubie).toMatchObject({ restantes: 1 });
    expect(s.serieSubie!.assaillant.loseNextAction).toBe(false);
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id });
  });

  it('Maladresse de l’assaillant, Oups ! 95, personne à distance : il se frappe et devient Sonné : LDB 14 l.30 ; #3892 P2', () => {
    const { banc } = serieOuverte([66, 23, 95], 3);
    defendre(banc, 5);
    const s = banc.getState();
    expect(s.journal).toContain(t('cf.maladresseSeSonne'));
    expect(s.serieSubie!.assaillant.conditions).toContainEqual({ id: 'sonne', value: 1 });
    expect(s.serieSubie).toMatchObject({ restantes: 2 });
  });

  /** La Défense du héros perdue sur un double raté (99) : l'étape de Maladresse du héros, son Oups ! lancé au d100 imposé. */
  function maladresseDuHeros(banc: Banc) {
    defendre(banc, 99);
    const pc = banc.getState().pendingCascade!;
    expect(pc.participants[pc.cursor]).toMatchObject({ jet: 'maladresse', actorId: banc.getState().party[0].id });
    banc.getState().jetLancer('maladresse');
    banc.getState().jetValider('maladresse');
  }

  it('Maladresse du héros sur sa Défense (99, double raté), Oups ! 75 : la ligne s’applique, la série se poursuit : LDB 14 l.13, l.28', () => {
    const { banc, H } = serieOuverte([20, 23, 75], 3);
    maladresseDuHeros(banc);
    const s = banc.getState();
    expect(s.journal.some(ligneDOups(H.label, 'Vous ne tenez pas votre arme')), s.journal.join(' | ')).toBe(true);
    expect(s.party[0].loseNextAction).toBe(true);
    expect(s.serieSubie).toMatchObject({ restantes: 2 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
  });

  it('Maladresse du héros sur une arme Bâclée : le dé de Sauvegarde Solide s’ouvre ; posé à 3, l’arme se brise et la série se poursuit : LDB 60 l.30, l.50', () => {
    const { banc, H } = horsBataille(testScene());
    const arme = { ...H.weapons[0], qualities: [{ id: 'bacle' }, { id: 'solide', value: 1 }] };
    banc.setState({ party: [{ ...H, weapons: [arme, ...H.weapons.slice(1)] }] });
    applyEffects(banc.getState, banc.setState, [attaques('heros', H.id)]);
    imposerLesD100(20, 23, 75);
    banc.getState().jetImposerLeResultat('cascadeTirage', 3, banc.getState().pendingCascade!.participants[0].id);
    banc.getState().jetValider('cascade');
    maladresseDuHeros(banc);
    const pc = banc.getState().pendingCascade!;
    const casse = pc.participants[pc.cursor];
    expect(casse).toMatchObject({ kind: 'casseDArme', actorId: H.id, de: { seuil: { indice: 9 } } });
    expect(banc.getState().serieSubie).toMatchObject({ restantes: 3 });
    banc.getState().jetImposerLeResultat('cascadeTirage', 3, casse.id);
    banc.getState().jetValider('cascade');
    const s = banc.getState();
    expect(s.journal).toContain(markFixedDie(t('store.toolBroken', { tool: arme.label, name: nomDe(H) })));
    expect(s.serieSubie).toMatchObject({ restantes: 2 });
    expect(s.pendingDefense).toMatchObject({ attackerId: s.serieSubie!.assaillant.id, defenderId: H.id });
  });

  it('la cible hors d’action avant la fin : la série se ferme au terme du coup en cours', () => {
    const { banc, H } = serieOuverte([20, 20]);
    const inconscient = gameOpSchema.parse({ op: 'condition', id: { id: 'inconscient' }, value: 1 });
    applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'heros', heroId: H.id, ops: [inconscient] }]);
    expect(banc.getState().serieSubie).toMatchObject({ restantes: 7 });
    defendre(banc, 5);
    const s = banc.getState();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].conditions).toContainEqual({ id: 'inconscient', value: 1 });
  });

  it('la sauvegarde est refusée pendant la série', () => {
    const { banc } = serieOuverte();
    expect(refusDeSauvegarde(banc.getState(), 0)).toBe('combat');
  });

  it('héros qui ne peut pas se défendre (Inconscient, mort-auto) : aucune fenêtre, le coup résolu hors bataille : LDB 16 l.113', () => {
    const { banc, H } = horsBataille(testScene());
    setRule('combat-cible-inconsciente', 'mort-auto');
    const inconscient = gameOpSchema.parse({ op: 'condition', id: { id: 'inconscient' }, value: 1 });
    applyEffects(banc.getState, banc.setState, [{ type: 'ops', on: 'heros', heroId: H.id, ops: [inconscient] }, attaques('heros', H.id)]);
    imposerLesD100(20);
    banc.getState().jetImposerLeResultat('cascadeTirage', 7, banc.getState().pendingCascade!.participants[0].id);
    banc.getState().jetValider('cascade');
    const s = banc.getState();
    const assaillant = s.serieSubie!.assaillant;
    expect(s.pendingDefense).toBeNull();
    expect(s.party[0].wounds.current).toBe(0);
    expect(s.journal.join(' ')).toContain(t('cf.achevementSansDefense', { name: nomDe(assaillant), foe: nomDe(H) }));
    expect(s.pendingFateSave).toMatchObject({ heroId: H.id, foeId: assaillant.id });
    expect(s.serieSubie).toMatchObject({ cibleId: H.id, restantes: 7 });
  });
});
