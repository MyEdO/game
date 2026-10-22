/**
 * UN TOUR COMPLET JOUÉ PAR LE PONT (#2928, `CONTRAT.md`, plan critère 4) sur le combat de l'hôte texte (`dome`) : le
 * round ouvert, l'attaque d'un héros, le déplacement d'un second héros vers une case de la vue, puis, ses jetons
 * repris, l'attaque adverse que joue le noyau et la Défense du héros. Chaque geste se joue comme Godot le joue : par le
 * geste que la vue dessine pour un verbe de la fenêtre (`vue.fenetre.gestes`), ses arguments posés ou choisis parmi les
 * valeurs qu'elle nomme. À chaque réponse, chaque verbe de la fenêtre ouverte a son geste et chacun de ses arguments
 * (`fautesDeLaFenetre`) ; le test ne calcule rien.
 */
import { describe, it, expect } from 'vitest';
import { argsDe, drainer, fautesDeLaFenetre, gesteDe, table, type Reponse } from './pont.testkit';
import type { Suite } from './pont';
import type { LigneDuJournal } from '../../../src/noyau/index';

const { appel: appelNu } = table();

/** Les fenêtres vues au fil du tour, par leur clé et l'étape de séquence qu'elles tiennent. */
const vues = new Set<string>();

/** L'appel du pont, chaque vue rendue contrôlée : la fenêtre ouverte se dessine verbe par verbe. */
const appel = (methode: string, entree?: unknown): Reponse => {
  const r = appelNu(methode, entree);
  if (r.ok && r.vue) {
    const f = r.vue.projection.fenetre;
    expect(fautesDeLaFenetre(r.vue), `la fenêtre ${f?.cle ?? 'aucune'} se dessine verbe par verbe`).toEqual([]);
    if (f) vues.add(f.etape ? `${f.cle}:${f.etape.genre}` : f.cle);
  }
  return r;
};

/** Le geste joué, ses jetons repris : la dernière suite et toutes les lignes de journal. */
const jouer = (geste: Record<string, unknown>) => drainer(appel, appel('jouer', geste));

/** Le geste du verbe `verbe` joué comme Godot le joue : ses arguments posés par la fenêtre, puis `saisies`. */
const jouerLeGeste = (s: Suite, verbe: string, ...saisies: unknown[]) => {
  const g = gesteDe(s.vue, verbe);
  return jouer({ type: g.verbe, args: argsDe(g, ...saisies) });
};

/** Le verbe du geste que la fenêtre attend maintenant. */
const attendu = (s: Suite): string => {
  const g = s.vue.fenetre?.gestes.filter((x) => x.attendu) ?? [];
  expect(g.length, `un seul geste attendu dans ${JSON.stringify(s.vue.fenetre?.gestes.map((x) => x.verbe))}`).toBe(1);
  return g[0].verbe;
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
  it('attaque d’un héros par ses gestes, déplacement, attaque adverse jouée par le noyau, Défense', { timeout: 240_000 }, () => {
    let { suite } = drainer(appel, appel('demarrer', { scenario: 'dome', graine: 7 }));
    expect(gesteDe(suite.vue, 'confirmRoundStart'), 'l’ouverture du round : un bouton nommé').toMatchObject({ libelle: 'Commencer le round', rendu: 'bouton' });
    ({ suite } = jouerLeGeste(suite, 'confirmRoundStart'));

    const heros = actifDe(suite);
    expect(heros.camp).toBe('hero');
    expect(suite.vue.projection.combat!.barre).toEqual({ forme: 'ouverte', raison: null });
    expect(suite.vue.panneau!.offres.charge, 'chaque offre de la barre a son libellé').toMatch(/^Charger/);
    expect(suite.vue.panneau!.fiche[0], 'la fiche nomme l’actif').toBe(heros.nom);
    const [cible] = suite.vue.projection.combat!.cibles.liste;
    ({ suite } = jouer({ offre: 'charge' }));
    expect(suite.vue.projection.combat!.intention, 'l’offre arme son intention').toBe('charge');
    ({ suite } = jouer({ type: suite.vue.champ.combattant, args: [cible] }));
    expect(suite.vue.attaque, 'la charge ouvre la fenêtre d’attaque').toMatchObject({ attaquantId: heros.id, cibleId: cible, jete: false });
    expect(attendu(suite), 'avant le jet, le jet est attendu').toBe('attackRoll');

    const localiser = gesteDe(suite.vue, 'attackSetLocation');
    expect(localiser.rendu, 'la Localisation : un choix nommé').toMatch(/^(choix|liste)$/);
    const lieu = localiser.arguments[0].valeurs!.find((v) => v.valeur !== null)!;
    ({ suite } = jouerLeGeste(suite, 'attackSetLocation', lieu.valeur));
    expect(suite.vue.attaque!.localisation!.choisie).toBe(lieu.valeur);
    expect(gesteDe(suite.vue, 'attackSetLocation').arguments[0].valeur, 'le geste dit la Localisation retenue').toBe(lieu.valeur);
    ({ suite } = jouerLeGeste(suite, 'attackSetLocation', null));
    expect(suite.vue.attaque!.localisation!.choisie, 'au hasard').toBeNull();
    ({ suite } = jouerLeGeste(suite, attendu(suite)));
    expect(suite.vue.attaque!.jete).toBe(true);
    expect(suite.vue.attaque!.issue, 'le jet tombé dit son issue').not.toBeNull();
    expect(attendu(suite), 'le jet tombé, la confirmation est attendue').toBe('attackConfirm');
    const issue = suite.vue.attaque!.issue!.ligne;
    let journal: LigneDuJournal[];
    ({ suite, journal } = jouerLeGeste(suite, attendu(suite)));
    expect(suite.vue.attaque, 'confirmée, la fenêtre d’attaque se ferme').toBeNull();
    expect(journal.some((l) => l.de === 'combat' && l.evenement.text === issue), 'l’issue confirmée entre au journal').toBe(true);
    ({ suite } = finirLeTour());

    const second = actifDe(suite);
    expect(second.id).not.toBe(heros.id);
    const vers = suite.vue.cases.find((c) => c.zone === 'marche' && c.cout === 1)!.case;
    ({ suite } = jouer({ type: suite.vue.champ.case, args: [vers] }));
    expect(suite.vue.projection.combat!.apercu, 'le premier clic montre l’aperçu').toMatchObject({ genre: 'move', cible: null, case: [vers.x, vers.y] });
    ({ suite } = jouer({ type: suite.vue.champ.case, args: [vers] }));
    expect(actifDe(suite).pos, 'le second clic déplace le héros').toEqual([vers.x, vers.y]);

    ({ suite, journal } = finirLeTour());
    const adversaire = actifDe(suite);
    expect(adversaire.camp, 'les jetons repris, le noyau joue l’adversaire').toBe('enemy');
    const defense = suite.vue.projection.fenetre!;
    expect(defense, 'la fenêtre de la Défense : l’étape du jet de Défense de la cascade').toMatchObject({ cle: 'cascade', etape: { genre: 'defenseJet' } });
    expect(suite.vue.defense, 'la Défense dit qui attaque qui').toMatchObject({ attaquantId: adversaire.id, jete: false });
    expect(suite.vue.fenetre!.proprietaire, 'la Défense est au héros attaqué').toBe(suite.vue.projection.combat!.voisins.liste.find((v) => v.id === suite.vue.defense!.defenseurId)!.nom);
    expect(attendu(suite), 'avant le jet de Défense, le jet est attendu').toBe('defenseRoll');
    const lignes = [...journal];
    ({ suite, journal } = jouerLeGeste(suite, attendu(suite)));
    lignes.push(...journal);
    expect(attendu(suite), 'le jet de Défense tombé, sa confirmation est attendue').toBe('defenseConfirm');
    ({ suite, journal } = jouerLeGeste(suite, attendu(suite)));
    lignes.push(...journal);
    expect(suite.vue.defense, 'la Défense confirmée, sa fenêtre se ferme').toBeNull();
    const attaque = lignes.find((l) => l.de === 'combat' && l.evenement.actorId === adversaire.id && l.evenement.targetId);
    expect(attaque, 'l’attaque adverse entre au journal, sa cible nommée').toBeDefined();
    const vise = suite.vue.projection.combat!.voisins.liste.find((v) => attaque!.de === 'combat' && v.id === attaque!.evenement.targetId)!;
    expect(vise.camp, 'l’adversaire vise un héros').toBe('hero');
    expect(defense.proprietaire, 'la Défense est au héros attaqué').toBe(vise.nom);
    expect([...vues], 'les fenêtres du tour, chacune dessinée verbe par verbe').toEqual(expect.arrayContaining(['roundStart', 'cascade:attackJet', 'cascade:defenseJet']));
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [] });
  });
});
