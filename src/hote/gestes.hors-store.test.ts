/**
 * CHAQUE ARGUMENT D'UN VERBE DE FENÊTRE SE DESSINE EN MOTS DU JOUEUR (#2928) : pour chaque verbe que `fenetreDuJeu`
 * peut offrir (`VERBES_DES_FENETRES`), chacun de ses paramètres (`VERBES`), et chaque champ d'un objet, a son libellé
 * (`libelleDuParametre`), hormis l'id que la fenêtre pose (`pid`) ; chaque valeur littérale que sa forme énumère a le
 * sien (`libelleDuLitteral`) ; chaque désignation qu'elle cite est une désignation du noyau (`DESIGNATIONS`), qui
 * nomme ses éléments. `fenetreADessiner` dessine ainsi, sans id à l'écran, toute fenêtre ouverte.
 */
import { describe, it, expect } from 'vitest';
import { DESIGNATIONS, libelleDuLitteral, libelleDuParametre } from '../noyau/index';
import { VERBES_DES_FENETRES } from '../noyau/fenetres.testkit';
import type { Forme } from './formes';
import { VERBES } from './verbes.generated';

/** Ce qui manque à la forme `f` de l'argument `ou` du verbe `verbe` pour se dessiner. */
function fautes(verbe: string, nom: string, f: Forme, ou: string): string[] {
  const ici = [
    ...(nom !== 'pid' && libelleDuParametre(verbe, nom) === null ? [`${ou} : ni \`parametre.${verbe}.${nom}\` ni \`parametre.${nom}\``] : []),
  ];
  const dans = (g: Forme): string[] => {
    switch (g.genre) {
      case 'litteral': return libelleDuLitteral(g.valeur, nom) === null ? [`${ou} : valeur ${JSON.stringify(g.valeur)} sans \`valeur.${nom}.<v>\` ni \`valeur.<v>\``] : [];
      case 'chaine': return g.designe && !(g.designe.cle in DESIGNATIONS) ? [`${ou} : désignation ${g.designe.cle} hors de DESIGNATIONS`] : [];
      case 'union': return g.membres.filter((m) => m.genre !== 'objet').flatMap(dans);
      case 'objet': return (g.champs ?? []).flatMap((c) => fautes(verbe, c.nom, c.forme, `${ou}.${c.nom}`));
      default: return [];
    }
  };
  return [...ici, ...dans(f)];
}

describe('chaque argument d’un verbe de fenêtre se dessine en mots du joueur', () => {
  it('le relevé couvre les verbes des fenêtres', () => {
    expect(VERBES_DES_FENETRES.size, 'témoin : les verbes des fenêtres').toBeGreaterThan(300);
    expect([...VERBES_DES_FENETRES].filter((v) => !(v in VERBES)), 'verbe de fenêtre hors de VERBES').toEqual([]);
  });

  it.each([...VERBES_DES_FENETRES].filter((v) => VERBES[v]?.length).map((v) => [v] as const))('%s', (verbe) => {
    expect(VERBES[verbe].flatMap((p) => fautes(verbe, p.nom, p.forme, `${verbe}.${p.nom}`))).toEqual([]);
  });
});
