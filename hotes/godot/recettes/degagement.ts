/**
 * LE DÉGAGEMENT FIGÉ (#3948) : ce que la recette native du dégagement (`projet/recettes/degagement-du-combat.gd`) lit,
 * figé par la sonde (`construire.mjs --sonde`) dans la copie du projet qu'elle importe. L'atelier figé sans modèle, sa
 * partie rendue au noyau (`figerUnePartie`), l'adresse de la partie (`parametres`), puis, sur son pont, « La fenêtre des
 * écuries » jouée comme le combat (`projet/scripts/combat.gd`) la joue : `demarrer`, chaque fenêtre de l'entrée par
 * son geste en focus (`jouer`), chacun sous la clé de l'entrée que Godot envoie ; le manifeste du monde de la scène (`monde`), la géométrie de toutes
 * ses clés (`morceaux`, source `partie`), le masque du regard (`retrait`), la vision du groupe (`vision`), les arêtes
 * (`aretes`) et les zones du salon que le combat relit après chaque suite (`salon`) ; puis le clic du champ sur `CASE_DEGAGEE` (`jouer`), qui change l'empreinte du masque
 * (`plateau.cleDuRetrait`) sans changer la clé du monde (`plateau.cleDuMonde`) ni celle des arêtes
 * (`plateau.cleDesAretes`), le masque d'après (`retraitDuClic`) et la vision d'après (`visionDuClic`) ;
 * enfin une case d'un morceau que le masque d'après retire et que celui d'avant gardait (`retireeParLeClic`), et
 * l'inverse (`rendueParLeClic`), `null` sans elle : `{ case, rangee }`, la rangée du plan de ce morceau. Il
 * lève si l'une des clés bouge avant le clic, si le clic change la scène, la clé du monde ou celle des arêtes, ou s'il
 * laisse l'empreinte du masque : le cas ne prouverait plus rien.
 */
import type { Bouton } from '../../../src/hote/elements';
import type { MorceauDuMonde, RetraitDuMonde } from '../../../src/noyau/index';
import { depuisBase64 } from '../../../src/lib/base64';
import type { MondeDuPont, MorceauxDuPont, Suite } from '../pont/pont';
import { figerUnePartie, type Listage } from './atelier';
import { toutesLesCles } from './ecran';
import { cleDEntree } from './vehicule';

/** La case de l'écurie que le groupe gagne en descendant de la fenêtre : le regard y retire autre chose du monde. */
const CASE_DEGAGEE = { x: 1, y: 1 };

/** L'adresse de la partie, comme `PontDuNoyau.parametre` la lit : `graine` en texte. */
const PARAMETRES = { scenario: 'fenetre-ecuries', graine: '7' };

/** Ce que les clés du plateau de `s` posent, que le combat compare d'une suite à l'autre. */
const clesDe = ({ vue }: Suite) => ({
  monde: `${vue.projection.scene?.id}|${vue.plateau?.cleDuMonde}`,
  retrait: `${vue.projection.scene?.id}|${vue.plateau?.cleDuRetrait}`,
  aretes: `${vue.projection.scene?.id}|${vue.plateau?.cleDesAretes}`,
});

/** La première case d'un morceau de `morceaux` que le masque `apres` retire et que `avant` laisse, `{ case, rangee }`
 *  (`VolumeDeScene.retiree`), `null` sans elle ; `h` rangées par plan. */
function caseRetireeDe(avant: RetraitDuMonde, apres: RetraitDuMonde, morceaux: readonly MorceauDuMonde[], h: number) {
  const [a, b] = [avant, apres].map(({ masque }) => depuisBase64(masque));
  for (const { rangee } of morceaux) {
    for (let i = rangee * avant.largeur; i < (rangee + h) * avant.largeur; i++) {
      if (b[i] && !a[i]) return { case: { x: i % avant.largeur, y: Math.floor(i / avant.largeur) - rangee }, rangee };
    }
  }
  return null;
}

/** Le dégagement figé, sans modèle. */
export function figerLeDegagement(listage: Listage) {
  return figerUnePartie(listage, () => false, ({ fige, appel }) => {
    const jouer: Record<string, Suite> = {};
    const suivre = (methode: string, entree: unknown): Suite => {
      const r = appel(methode, entree) as unknown as { ok: boolean } & Suite;
      if (!r.ok) throw new Error(`dégagement figé : ${methode} ${JSON.stringify(entree)} : ${JSON.stringify(r)}`);
      return r;
    };
    const demarrer = { scenario: PARAMETRES.scenario, graine: Number(PARAMETRES.graine) };
    let s = suivre('demarrer', demarrer);
    const cles = clesDe(s);
    const avant = { [cleDEntree(demarrer)]: s };
    for (let pas = 0; s.vue.projection.fenetre; pas++) {
      if (pas > 10) throw new Error(`dégagement figé : fenêtres sans fin : ${JSON.stringify(s.vue.zones['fenetre.titre'])}`);
      const { jeu } = s.vue.zones['fenetre.gestes'].find((g): g is Bouton => g.type === 'bouton' && g.focus)!;
      s = suivre('jouer', jeu);
      jouer[cleDEntree(jeu)] = s;
      if (JSON.stringify(clesDe(s)) !== JSON.stringify(cles)) throw new Error(`dégagement figé : les clés du plateau bougent avant le clic : ${JSON.stringify(cles)} puis ${JSON.stringify(clesDe(s))}`);
    }
    const monde = appel('monde') as unknown as MondeDuPont;
    const entreeDesMorceaux = toutesLesCles(monde);
    const morceaux = appel('morceaux', entreeDesMorceaux) as unknown as MorceauxDuPont;
    const retrait = appel('retrait') as unknown as RetraitDuMonde;
    const vision = appel('vision');
    const aretes = appel('aretes');
    const salon = appel('salon');
    const occupant = s.vue.occupants[`${CASE_DEGAGEE.x},${CASE_DEGAGEE.y},0`];
    const clic = { type: s.vue.champ, args: occupant ? [CASE_DEGAGEE, occupant] : [CASE_DEGAGEE] };
    if (clic.type === null) throw new Error('dégagement figé : le champ ne se clique pas après les fenêtres');
    const apres = suivre('jouer', clic);
    jouer[cleDEntree(clic)] = apres;
    const clesDuClic = clesDe(apres);
    if (clesDuClic.monde !== cles.monde || clesDuClic.aretes !== cles.aretes || clesDuClic.retrait === cles.retrait) {
      throw new Error(`dégagement figé : le clic de ${JSON.stringify(CASE_DEGAGEE)} doit garder le monde et les arêtes et changer le retrait : ${JSON.stringify(cles)} puis ${JSON.stringify(clesDuClic)}`);
    }
    const retraitDuClic = appel('retrait') as unknown as RetraitDuMonde;
    const visionDuClic = appel('vision');
    const retireeParLeClic = caseRetireeDe(retrait, retraitDuClic, morceaux.volume, apres.vue.plateau!.h);
    if (!retireeParLeClic) throw new Error('dégagement figé : le masque du clic ne retire aucune case qu’il laissait');
    return {
      ...fige,
      parametres: PARAMETRES,
      demarrer: avant,
      jouer,
      monde: { null: monde },
      morceaux: { [cleDEntree(entreeDesMorceaux)]: morceaux },
      retrait: { null: retrait },
      vision: { null: vision },
      aretes: { null: aretes },
      salon: { null: salon },
      retraitDuClic: { null: retraitDuClic },
      visionDuClic: { null: visionDuClic },
      case: CASE_DEGAGEE,
      retireeParLeClic,
      rendueParLeClic: caseRetireeDe(retraitDuClic, retrait, morceaux.volume, apres.vue.plateau!.h),
    };
  });
}
