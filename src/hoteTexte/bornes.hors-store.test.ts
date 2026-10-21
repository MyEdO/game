/**
 * LES BORNES DE SORTIE DE L'HÔTE TEXTE (#2898, M2) : chaque sortie tient ses lignes ET ses caractères (`BORNES`), sur le
 * pire scénario mesuré (`ecuries-clayonnage` : 673 combattants, une ligne de cibles de 13 649 caractères avant les
 * bornes) et sur `siege-enceinte` (23 combattants). Les commandes passent par l'entrée `executer`, sur un disque en
 * mémoire, telles qu'un agent les tape.
 */
import { describe, it, expect } from 'vitest';
import { executer, type Disque } from './cli';
import { BORNES, caracteresAuPlus, type Commande } from './vue';

/** Une table : un disque en mémoire et l'appel d'une commande sur son fichier de partie. */
function table() {
  const fichiers = new Map<string, string>();
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
    const actif = (JSON.parse(appel('vue', '--json').texte) as { projection: { combat: { actif: { id: string } } } }).projection.combat.actif.id;
    tientSesBornes('fiche', 'fiche', appel('fiche', actif));
    for (const commande of ['vue', 'offres', 'carte', 'journal']) jsonBorne(`${commande} --json`, appel(commande, '--json'));
    tientSesBornes('offre end-turn', 'reponse', appel('offre', 'end-turn'));
    jsonBorne('offre end-turn --json', appel('offre', 'end-turn', '--json'));
  });
});
