/**
 * L'EXPLORATION PAR L'HÔTE TEXTE (#2898 lot D) : la vue donne chaque geste du groupe prêt à jouer (`gestesDExploration`),
 * et chacun se joue tel qu'écrit, dans tout scénario de test qui commence en exploration ; un pas qui vise la case
 * voisine sans son étage se refuse en le nommant ; un accès ouvert ne s'actionne pas, il se franchit ; la fenêtre qui
 * tient la main se lit hors combat.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireLeFichier, ligneDuFichier, rejouer } from './partieTexte';
import { nouvelEntete } from '../../src/hote/partieDeTest';
import { fermerLaTable, table, verbe } from './hote.testkit';
import { gestesDExploration } from '../../src/noyau/index';
import { catalogueDeLaPartie } from '../../src/hote/contenu';
import type { Jeu } from '../../src/noyau/etat';
import { t as message } from '../../src/i18n';

const CATALOGUE = catalogueDeLaPartie([]);

afterEach(fermerLaTable);

/** Un fichier de partie committé à côté de ce test. */
const DOSSIER = fileURLToPath(new URL('.', import.meta.url));
const fixture = (nom: string): string => readFileSync(join(DOSSIER, nom), 'utf8');

/** L'état de la partie que ce texte rejoue, lu par `lire`. */
function lireLeTexte<T>(texte: string, lire: (etat: Jeu) => T): T {
  const { entete, gestes } = lireLeFichier(CATALOGUE, texte);
  const r = rejouer(CATALOGUE, entete, gestes);
  try {
    return lire(r.partie.etat());
  } finally {
    r.partie.fermer();
  }
}

/** Les gestes d'exploration de la partie que ce texte rejoue. */
const gestesDuTexte = (texte: string) => lireLeTexte(texte, gestesDExploration);

/** L'étape d'entrée en scène tient-elle la main ? */
const enEntreeEnScene = (etat: Jeu): boolean => etat.pendingCascade?.participants[etat.pendingCascade.cursor]?.kind === 'entreeEnScene';

/** Le texte de la partie, sa séquence d'entrée en scène validée (`jetValider('cascade')`) : la main au groupe. */
function apresLEntreeEnScene(texte: string): string {
  const t = table(texte);
  for (let i = 0; i < 10 && lireLeTexte(t.fichier() || texte, enEntreeEnScene); i++) t.jouer(verbe('jetValider', 'cascade'));
  const fichier = t.fichier() || texte;
  fermerLaTable();
  return fichier;
}

/** Les parties à l'ouverture de chaque scénario de test sans combat d'entrée, et la croisée des écuries. */
const PARTIES = [
  ...CATALOGUE.filter((s) => !s.autoCombat).map((s) => [s.id, ligneDuFichier(nouvelEntete(CATALOGUE, s.id, {}))] as const),
  ['croisee-ecuries', fixture('croisee-ecuries.jsonl')] as const,
].map(([id, texte]) => [id, apresLEntreeEnScene(texte)] as const);

describe('chaque geste d’exploration que la vue donne se joue tel qu’écrit', () => {
  it.each(PARTIES)('%s', { timeout: 120_000 }, (_, texte) => {
    for (const g of gestesDuTexte(texte)) {
      const t = table(texte);
      const r = t.jouer(...g.gestes.map((x) => verbe(x.verbe, ...x.args)));
      if (!g.refus) expect(r.erreur, `${g.libelle} : ${r.texte}`).toBeNull();
      else expect([r.erreur, r.texte.includes(g.refus)], `${g.libelle} : le refus de l’offre est celui du verbe : ${r.texte}`).toEqual(['regle', true]);
    }
  });

  it('au moins une offre `jouerAction` s’ouvre, une fois la main au groupe, et se joue sans erreur', () => {
    const ouvertes = PARTIES.flatMap(([, texte]) => gestesDuTexte(texte).filter((g) => !g.refus && g.gestes[0]?.verbe === 'jouerAction').map((g) => [texte, g] as const));
    expect(ouvertes.length).toBeGreaterThan(0);
    const [texte, g] = ouvertes[0];
    const r = table(texte).jouer(...g.gestes.map((x) => verbe(x.verbe, ...x.args)));
    expect(r.erreur, `${g.libelle} : ${r.texte}`).toBeNull();
  });

  it('témoin : la croisée des écuries offre le saut par la fenêtre, et la vue l’écrit prêt à jouer', () => {
    const croisee = apresLEntreeEnScene(fixture('croisee-ecuries.jsonl'));
    const [saut] = gestesDuTexte(croisee).filter((g) => !g.refus && g.gestes.length === 1 && g.gestes[0].verbe === 'franchirLArete');
    expect(saut, 'aucun geste d’arête depuis la croisée').toBeDefined();
    expect(saut.libelle, 'le saut par la fenêtre').toMatch(/^Sauter en bas/);
    const t = table(croisee);
    const vue = t.lire('vue').texte.split('\n  ').join(' ');
    expect(vue).toContain(`${saut.libelle} : \`jouer {"gestes":[`);
    expect(vue).toMatch(/groupe \(7,2\) étage 1 · cap /);
  });
});

describe('le groupe en exploration', () => {
  it('un accès ouvert ne s’actionne pas : le refus dit qu’il se franchit en marchant, et la vue le donne en marche', () => {
    const texte = fixture('porte-ouverte.jsonl');
    const { entete, gestes } = lireLeFichier(CATALOGUE, texte);
    const [id] = gestes.flatMap((g) => ('type' in g && g.type === 'actionnerLaPorte' ? g.args : []));
    if (typeof id !== 'string') throw new Error('la partie n’ouvre aucune porte');
    expect(gestesDuTexte(texte).map((g) => g.gestes.length)).toContain(1);
    const t = table(texte);
    const avant = t.fichier();
    const r = t.jouer(verbe('actionnerLaPorte', id));
    expect(r.erreur, r.texte).toBe('regle');
    expect(r.texte.split('\n  ').join(' ')).toMatch(/le groupe le franchit en marchant/);
    expect(t.fichier()).toBe(avant);
    expect(entete.scenario).toBe('porte-close');
  });

  it('un geste qui part d’ailleurs à l’étage se donne avec le clic de la case qui mène le groupe jusqu’à lui (`cliquerLaCase`)', () => {
    const lointains = gestesDuTexte(ligneDuFichier(nouvelEntete(CATALOGUE, 'fenetre-ecuries', {}))).filter((g) => g.gestes.length === 2);
    expect(lointains.map((g) => g.gestes.map((x) => x.verbe))).toContainEqual(['cliquerLaCase', 'franchirLArete']);
  });

  it('le clic d’une case qu’aucun chemin n’atteint se refuse en la nommant, et rien ne s’écrit', () => {
    const t = table(fixture('croisee-ecuries.jsonl'));
    const avant = t.fichier();
    const r = t.jouer(verbe('cliquerLaCase', { x: 99, y: 99 }));
    expect(r.erreur, r.texte).toBe('regle');
    expect(r.texte.split('\n  ').join(' ')).toMatch(/Marche refusée : aucun chemin du groupe ne mène à \(99,99\)/);
    expect(t.fichier()).toBe(avant);
  });

  it('la chute de groupe : le jet attend que chaque tombant ait déclaré, le refus les nomme, et le pid de la fenêtre est le prochain à déclarer', () => {
    const [saut] = gestesDuTexte(fixture('croisee-ecuries.jsonl')).filter((g) => g.gestes.length === 1 && g.gestes[0].verbe === 'franchirLArete');
    const t = table(fixture('croisee-ecuries.jsonl'));
    t.jouer(...saut.gestes.map((x) => verbe(x.verbe, ...x.args)));
    const pid = /pid (\S+)\)/.exec(t.lire('vue').texte)![1];
    const r = t.jouer(verbe('jetLancer', 'chute', pid));
    expect(r.erreur, r.texte).toBe('regle');
    expect(r.texte.split('\n  ').join(' ')).toMatch(new RegExp(`chaque tombant déclare d’abord s’il tente le Test et s’il se suspend d’abord ; reste à déclarer : [^(]+ \\(${pid}\\)`));
    expect(t.jouer(verbe('jetRegler', 'chute', 'suspendre', false, pid), verbe('jetRegler', 'chute', 'tenter', false, pid)).erreur).toBeNull();
    expect(/pid (\S+)\)/.exec(t.lire('vue').texte)?.[1], 'le pid passe au tombant suivant').not.toBe(pid);
  });

  it('la carte d’exploration nomme les héros du groupe avec leur id', () => {
    const t = table(fixture('croisee-ecuries.jsonl'));
    expect(t.lire('carte').texte).toMatch(/^groupe \(\d+,\d+\) · \d+ héros · \d+ entité\(s\)\n {2}soldat-de-test · heros · Soldat$/m);
  });

  it('la fenêtre qui tient la main se lit hors combat, avec ses verbes', () => {
    const r = table(fixture('croisee-ecuries.jsonl')).lire('vue');
    expect(r.erreur, r.texte).toBeNull();
    expect(r.texte.split('\n  ').join(' '), 'une offre refusée se lit fermée, avec son refus').toContain(`(fermé : ${message('jouerAction.refus.mainTenue')})`);
    expect(r.texte).toMatch(/^fenêtre \S+ \(à /m);
    expect(r.texte).toMatch(/^verbes/m);
  });
});
