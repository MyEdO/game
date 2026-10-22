/**
 * UN TOUR COMPLET JOUÉ PAR LE PONT (#2928, `CONTRAT.md`, plan critère 4) sur le combat de l'hôte texte (`dome`) : le
 * round ouvert par le verbe de sa fenêtre, l'attaque d'un héros par les intentions de la modale lues dans la fenêtre
 * d'attaque (`fenetreDAttaque`), le déplacement d'un second héros vers une case de la vue, puis, ses jetons repris,
 * l'attaque adverse que joue le noyau et la Défense du héros. Chaque cible, chaque case et chaque Localisation se lit
 * dans la vue, chaque verbe d'une fenêtre parmi ses verbes ; le test ne calcule rien.
 */
import { describe, it, expect } from 'vitest';
import { drainer, table } from './pont.testkit';
import type { Suite } from './pont';
import type { LigneDuJournal } from '../../../src/noyau/index';

const { appel } = table();

/** Le geste joué, ses jetons repris : la dernière suite et toutes les lignes de journal. */
const jouer = (geste: Record<string, unknown>) => drainer(appel, appel('jouer', geste));

/** Le verbe de la fenêtre ouverte dont le nom commence par `debut`. */
const verbeDe = (s: Suite, debut: string): string => {
  const v = s.vue.projection.fenetre?.verbes.find((x) => x.startsWith(debut));
  if (!v) throw new Error(`aucun verbe ${debut}… dans la fenêtre ${JSON.stringify(s.vue.projection.fenetre)}`);
  return v;
};

const actifDe = (s: Suite) => s.vue.projection.combat!.actif!;

/** La fin du tour par son offre, confirmée par la même offre quand la vue la dit armée (`finDeTourArmee`). */
function finirLeTour(): { suite: Suite; journal: LigneDuJournal[] } {
  const arme = jouer({ offre: 'end-turn' });
  if (!arme.suite.vue.projection.combat!.finDeTourArmee) return arme;
  const fin = jouer({ offre: 'end-turn' });
  return { suite: fin.suite, journal: [...arme.journal, ...fin.journal] };
}

describe('un tour complet par le pont', () => {
  it('attaque d’un héros par la modale, déplacement, attaque adverse jouée par le noyau, Défense', { timeout: 240_000 }, () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    ({ suite } = jouer({ type: verbeDe(suite, 'confirmRound'), args: [] }));

    const heros = actifDe(suite);
    expect(heros.camp).toBe('hero');
    expect(suite.vue.projection.combat!.barre).toEqual({ forme: 'ouverte', raison: null });
    const [cible] = suite.vue.projection.combat!.cibles.liste;
    ({ suite } = jouer({ offre: 'charge' }));
    expect(suite.vue.projection.combat!.intention, 'l’offre arme son intention').toBe('charge');
    ({ suite } = jouer({ type: 'battleClickEntity', args: [cible] }));
    expect(suite.vue.attaque, 'la charge ouvre la fenêtre d’attaque').toMatchObject({ attaquantId: heros.id, cibleId: cible, jete: false });

    const lieu = suite.vue.attaque!.localisation!.options.find((o) => o.valeur !== '')!.valeur;
    ({ suite } = jouer({ type: 'attackSetLocation', args: [lieu] }));
    expect(suite.vue.attaque!.localisation!.choisie).toBe(lieu);
    ({ suite } = jouer({ type: 'attackSetLocation', args: [null] }));
    expect(suite.vue.attaque!.localisation!.choisie, 'au hasard').toBe('');
    ({ suite } = jouer({ type: verbeDe(suite, 'attackRoll'), args: [] }));
    expect(suite.vue.attaque!.jete).toBe(true);
    expect(suite.vue.attaque!.issue, 'le jet tombé dit son issue').not.toBeNull();
    const issue = suite.vue.attaque!.issue!.ligne;
    let journal: LigneDuJournal[];
    ({ suite, journal } = jouer({ type: verbeDe(suite, 'attackConfirm'), args: [] }));
    expect(suite.vue.attaque, 'confirmée, la fenêtre d’attaque se ferme').toBeNull();
    expect(journal.some((l) => l.de === 'combat' && l.evenement.text === issue), 'l’issue confirmée entre au journal').toBe(true);
    ({ suite } = finirLeTour());

    const second = actifDe(suite);
    expect(second.id).not.toBe(heros.id);
    const vers = suite.vue.cases.find((c) => c.zone === 'marche' && c.cout === 1)!.case;
    ({ suite } = jouer({ type: 'battleClickTile', args: [vers] }));
    expect(suite.vue.projection.combat!.apercu, 'le premier clic montre l’aperçu').toMatchObject({ genre: 'move', cible: null, case: [vers.x, vers.y] });
    ({ suite } = jouer({ type: 'battleClickTile', args: [vers] }));
    expect(actifDe(suite).pos, 'le second clic déplace le héros').toEqual([vers.x, vers.y]);

    ({ suite, journal } = finirLeTour());
    const adversaire = actifDe(suite);
    expect(adversaire.camp, 'les jetons repris, le noyau joue l’adversaire').toBe('enemy');
    const defense = suite.vue.projection.fenetre!;
    expect(defense, 'la fenêtre de la Défense : l’étape du jet de Défense de la cascade').toMatchObject({ cle: 'cascade', etape: { genre: 'defenseJet' } });
    const lignes = [...journal];
    ({ suite, journal } = jouer({ type: verbeDe(suite, 'defenseRoll'), args: [] }));
    lignes.push(...journal);
    ({ suite, journal } = jouer({ type: verbeDe(suite, 'defenseConfirm'), args: [] }));
    lignes.push(...journal);
    expect(suite.vue.projection.fenetre?.cle === defense.cle && suite.vue.projection.fenetre.verbes.some((v) => v.startsWith('defense')), 'la Défense confirmée, sa fenêtre se ferme').toBe(false);
    const attaque = lignes.find((l) => l.de === 'combat' && l.evenement.actorId === adversaire.id && l.evenement.targetId);
    expect(attaque, 'l’attaque adverse entre au journal, sa cible nommée').toBeDefined();
    const vise = suite.vue.projection.combat!.voisins.liste.find((v) => attaque!.de === 'combat' && v.id === attaque!.evenement.targetId)!;
    expect(vise.camp, 'l’adversaire vise un héros').toBe('hero');
    expect(defense.proprietaire, 'la Défense est au héros attaqué').toBe(vise.nom);
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [] });
  });
});
