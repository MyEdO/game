import type { PartArt } from '../types';
import type { PaletteDeclaree } from '../../palette';
import type { RigOverlay } from '../../bones';

/**
 * Slots habillables d'une tenue. Valeurs = PartArt (SVG dans le repère LOCAL de l'os porteur).
 * Le slot `tete` recouvre le visage cosmétique (`heads/defs/*.ts` champ `visage`, PROFILE_FACE de
 * `cosmetic.ts`) ET les cheveux (champ `cheveux`) : x ≈ -9..9 (visage), -11..11 (cheveux) ;
 * y ≈ -2..17 (visage, front→menton), -12..-2 (cheveux, mèches→racine). Un casque/chapeau calé
 * uniquement sur -2..17 laisse la chevelure (jusqu'à y≈-12) à nu.
 */
// `pied`/`main`/`cou` : habit de ces zones d'extrémité (chausse, gant/manche longue, col) — pilote la
// part par-dessus le repli de chair d'espèce (extremites.ts), au même titre que torse/jambes/tete.
export type TenueSet = Partial<Record<'torse' | 'jambes' | 'bras' | 'avantBras' | 'tete' | 'pied' | 'main' | 'cou', PartArt>>;

/**
 * Une tenue = un fichier `defs/<Nom>.ts`. SEULE source (plus d'AUTO/MANUAL/merge). `label` = le
 * NOM authoré, slugifié en id de lookup par `tenueFor` :
 *   - nom d'une CLASSE WFRP (Guerriers, Lettrés, Roublards…) → archétype de classe, repli quand
 *     une carrière n'a pas de tenue dédiée. La taxonomie des classes (careers.json) discrimine
 *     seule « archétype de classe » vs « tenue spécifique » — aucun flag à porter ;
 *   - nom d'une CARRIÈRE / CRÉATURE / PNJ → tenue spécifique (prioritaire par id) ;
 *   - 'Nu' pour le corps de chair sans vêtement (torse/jambes en @peau, le token suit l'espèce).
 * Les slots portent une string (FRONT) ou les 3 vues `{front, back, profile}`. Ajouter un
 * humanoïde habillé = DÉPOSER ce fichier (+ un def de race/PNJ pointant `tenue: '<name>'`).
 *
 * `palette` : couleurs par défaut des `@tokens` de l'art (PaletteDeclaree = hex exact) → rendu
 * sans perte + recoloriage cohérent. Résolue par `tenuePaletteFor` (tenue > classe).
 * Elle pilote aussi les parts SYSTÈME du pied/main (`CLAWFOOT`/`PLAINFOOT`/`HAND` de
 * `bodies/extremites.ts`, `BOTTE_CUIR` de `botte-gabarit.ts`, #426) : `botte` (cuir de la botte ;
 * `semelle` et `botteDos` la suivent) et `griffe` (pied nu griffu). Non
 * déclarés → pied système (botte brune / griffes sombres). Chaque membre se déclare aussi SEUL
 * (`botteDos` sans `botte`) : la base déclarée est honorée, son ombre se DÉRIVE, les autres
 * restent système — aucune combinaison partielle n'est interdite ni silencieuse. MÊME contrat
 * pour la palette d'une RACE (`races/`), couche empilée sous la tenue. Clés suiveuses :
 * `clesDePalette.ts` ; empilage : `couchesDuRig` (career.ts) ;
 * garde `parts/shared-parts-palette.test.ts`.
 *
 * Une tenue qui ne chausse pas (corps 'Nu', squelette décharné, pagne du Sanguinaire…) ne
 * déclare simplement PAS `pied` dans son `set` : le repli devient alors le Nu de l'ESPÈCE
 * (`race.extremites`/`perso.extremites`, 'lisses' civilisé ou 'griffues' monstrueux — #736 Lot 1,
 * `resolve.ts`).
 */
export type TenueDef = {
  /** id STABLE de la tenue (slug, clé de `TENUE_BY_ID`) — explicite et OBLIGATOIRE, jamais dérivé du
   *  `label` (affichage multilangue) au runtime (cf. #637). */
  id: string;
  /** Libellé d'AFFICHAGE (nom authoré, slugifié une fois en `id`). N'est PAS la clé. */
  label: string;
  set: TenueSet;
  palette?: PaletteDeclaree;
  /** Calques ASYMÉTRIQUES attachés à un os précis (pauldron/fourrure qui déborde une SEULE
   *  épaule) — même vocabulaire que `dorsalOverlays`/`monsterInjection` (`RigOverlay`, `plane`
   *  pour échapper au z inégal des bras epauleG/epauleD, `view` pour une vue). Optionnel :
   *  absent = comportement inchangé (les 117 tenues existantes ne déclarent rien). */
  overlays?: RigOverlay[];
};
