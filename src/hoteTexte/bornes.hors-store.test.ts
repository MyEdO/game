/**
 * LES BORNES DE SORTIE DE L'HÔTE TEXTE (#2898, M2) : chaque sortie tient ses lignes ET ses caractères (`BORNES`), sur le
 * pire scénario mesuré (`ecuries-clayonnage` : 673 combattants, une ligne de cibles de 13 649 caractères avant les
 * bornes) et sur `siege-enceinte` (23 combattants). Les commandes passent par l'entrée `executer`, sur un disque en
 * mémoire, telles qu'un agent les tape.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { executer, type Disque } from './cli';
import { BORNES, caracteresAuPlus, type Commande } from './vue';

/** Une table : un disque en mémoire, son fichier de partie posé à `texte`, et l'appel d'une commande sur ce fichier. */
function table(texte?: string) {
  const fichiers = new Map<string, string>(texte === undefined ? [] : [['partie.jsonl', texte]]);
  const disque: Disque = {
    lire: (chemin) => fichiers.get(chemin) ?? null,
    ecrire: (chemin, texte) => void fichiers.set(chemin, texte),
    ajouter: (chemin, texte) => void fichiers.set(chemin, (fichiers.get(chemin) ?? '') + texte),
  };
  return (...argv: string[]) => executer(['--partie', 'partie.jsonl', ...argv], disque);
}

/** La sortie texte d'une commande tient ses bornes : lignes, largeur de chaque ligne, caractères. */
function tientSesBornes(nom: string, commande: Commande, sortie: { texte: string; code: number }) {
  expect(sortie.code, `${nom} : ${sortie.texte}`).toBe(0);
  const lignes = sortie.texte.trimEnd().split('\n');
  expect(lignes.length, `${nom} : lignes\n${sortie.texte}`).toBeLessThanOrEqual(BORNES.lignes[commande]);
  expect(Math.max(...lignes.map((l) => l.length)), `${nom} : la ligne la plus longue`).toBeLessThanOrEqual(BORNES.largeur);
  expect(sortie.texte.length, `${nom} : caractères`).toBeLessThanOrEqual(caracteresAuPlus(commande));
}

/** La sortie `--json` d'une commande tient son plafond de caractères. */
function jsonBorne(nom: string, sortie: { texte: string; code: number }) {
  expect(sortie.code, `${nom} : ${sortie.texte.slice(0, 200)}`).toBe(0);
  expect(sortie.texte.length, `${nom} : caractères du JSON`).toBeLessThanOrEqual(BORNES.json);
}

describe.each(['ecuries-clayonnage', 'siege-enceinte'])('les bornes de sortie sur `%s`', (scenario) => {
  it('vue, offres, carte, fiche, journal, réponse et `--json` tiennent leurs bornes', { timeout: 240_000 }, () => {
    const appel = table();
    tientSesBornes('nouvelle', 'nouvelle', appel('nouvelle', scenario, '--graine', '7'));
    tientSesBornes('confirmRoundStart', 'reponse', appel('jouer', 'confirmRoundStart'));
    const vue = appel('vue');
    tientSesBornes('vue', 'vue', vue);
    expect(vue.texte, 'témoin : la vue est celle d’un tour de combat').toMatch(/^R1 tour \d+\/\d+ · actif /);
    tientSesBornes('offres', 'offres', appel('offres'));
    tientSesBornes('offres --toutes', 'offres', appel('offres', '--toutes'));
    tientSesBornes('carte', 'carte', appel('carte'));
    tientSesBornes('carte --depuis 15', 'carte', appel('carte', '--depuis', '15'));
    tientSesBornes('journal', 'journal', appel('journal'));
    tientSesBornes('cases', 'cases', appel('cases'));
    jsonBorne('cases --json', appel('cases', '--json'));
    const actif = (JSON.parse(appel('vue', '--json').texte) as { projection: { combat: { actif: { id: string } } } }).projection.combat.actif.id;
    tientSesBornes('fiche', 'fiche', appel('fiche', actif));
    for (const commande of ['vue', 'offres', 'carte', 'journal']) jsonBorne(`${commande} --json`, appel(commande, '--json'));
    tientSesBornes('offre end-turn', 'reponse', appel('offre', 'end-turn'));
    jsonBorne('offre end-turn --json', appel('offre', 'end-turn', '--json'));
  });
});

describe('les bornes des sorties de l’exploration, des scénarios et du journal', () => {
  it('`scenarios`, `carte` et `vue` en exploration tiennent leurs bornes', { timeout: 120_000 }, () => {
    const appel = table();
    tientSesBornes('scenarios', 'scenarios', appel('scenarios'));
    tientSesBornes('scenarios --depuis 15', 'scenarios', appel('scenarios', '--depuis', '15'));
    jsonBorne('scenarios --json', appel('scenarios', '--json'));
    tientSesBornes('nouvelle', 'nouvelle', appel('nouvelle', 'fenetre-ecuries'));
    tientSesBornes('carte', 'carte', appel('carte'));
    tientSesBornes('vue', 'vue', appel('vue'));
    jsonBorne('carte --json', appel('carte', '--json'));
  });
  it('une erreur tient ses bornes, sur les verbes aux types les plus larges (`startCombat`, `setParty`)', { timeout: 120_000 }, () => {
    const appel = table();
    expect(appel('nouvelle', 'dome').code).toBe(0);
    for (const argv of [['jouer', 'startCombat', '[1]'], ['jouer', 'setParty', '[1]'], ['jouer', 'partyAddHero', '[1]']]) {
      const sortie = appel(...argv);
      expect(sortie.code, sortie.texte).toBe(1);
      const lignes = sortie.texte.trimEnd().split('\n');
      expect(lignes.length, argv.join(' ')).toBeLessThanOrEqual(BORNES.lignes.erreur);
      expect(Math.max(...lignes.map((l) => l.length)), `${argv.join(' ')} : la ligne la plus longue`).toBeLessThanOrEqual(BORNES.largeur);
      expect(sortie.texte, `${argv.join(' ')} : l’erreur se replie, elle n’est pas coupée`).not.toMatch(/…$/m);
    }
  });
  it('le journal d’une défaite, aux entrées à saut de ligne, tient ses bornes page par page (`defaite-dome.jsonl`)', { timeout: 240_000 }, () => {
    const appel = table(readFileSync(new URL('./defaite-dome.jsonl', import.meta.url), 'utf8'));
    for (const depuis of ['0', '15', '30', '45', '60']) tientSesBornes(`journal --depuis ${depuis}`, 'journal', appel('journal', '--depuis', depuis));
  });
});
