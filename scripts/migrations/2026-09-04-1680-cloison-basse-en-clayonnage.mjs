/**
 * Migration #1680 ligne 15-B — les six SÉPARATIONS DE BOX des Écuries de La Diligence deviennent des
 * CLÔTURES EN CLAYONNAGE.
 *
 * Ces six arêtes sont les cloisons qui séparent les box à chevaux de la zone « Écuries & remise »
 * (`zone-E-z0`/`zone-e-z0`). Elles portent `structure: mur-a-ossature-en-bois` — le mur d'HABITATION
 * d'AA 10 l.76, « typique de beaucoup de résidences du Vieux Monde », à ossature garnie de briques ou
 * de pierre — avec une surcharge d'apparence `cloison-basse-a-ossature-en-bois`, laquelle est ce même
 * mur à l'octet près plus un `wallHeightM: 1.25`. La HAUTEUR n'existe qu'au RENDU : aucune règle ne la
 * lit. La donnée disait donc « mur de maison » à la règle et « cloison à hauteur de taille » à l'œil.
 *
 * Or AA 10 l.65 donne la structure qui correspond à CE que ces arêtes sont : la clôture en clayonnage,
 * qui « conv[ient] davantage pour des enclos d'animaux que pour des fortifications ». Une séparation de
 * box EST un enclos d'animaux — la migration nomme la bonne Structure, elle ne cherche pas un effet.
 *
 * L'APPARENCE EST CONSERVÉE : le dessin ne bouge pas d'un pixel (`wallApp` lit `seg.appearance` en
 * priorité, `src/gameIso/catalog/structures/index.ts:30-36`). Le PASSAGE non plus : une arête non
 * occultante reste infranchissable.
 *
 * CE QUE LE PROFIL AA CHANGE, MESURÉ (`mur-a-ossature-en-bois` → `cloture-en-clayonnage`) — quatre
 * deltas, tous assumés parce qu'ils sont le profil de la Structure réelle, aucun n'est un gain :
 *   1. `couvertPenalty` Complexe (−10) → Intermédiaire (+0) : la cible abritée par une de ces arêtes
 *      PERD son couvert (`couvertDArete` rend `imparfaite` avant, `none` après). Une cloison de box à
 *      hauteur de taille n'abritait pas un homme : elle ne le protège plus.
 *   2. `occulte` absent → `false` : l'arête cesse de couper la Ligne de Vue. L'opacité n'est PAS au
 *      folio : c'est la décision MAISON portée par `cloture-en-clayonnage.maison` (`structures.json`),
 *      déduite de la nature de la clôture que décrit AA 10 l.65.
 *   3. `char` BE 4 / B 20 → BE 2 / B 10 : au siège, ces six arêtes sont deux fois plus fragiles
 *      (la capacité `structure` de `src/noyau/aretes.ts` les cible) — une clôture tressée n'encaisse
 *      pas comme un colombage.
 *   4. `encLimit` 30 → absent : plus de Limite d'Encombrement (AA ne la donne pas au clayonnage) ;
 *      on ne pose plus d'arme sur cette cloison, là où le rebord de fenêtre d'AA 10 l.76 l'autorisait.
 *
 * ENTRÉES : `src/scenes/diligence/diligence-projet.json`, scène d'id `la-diligence` (seule donnée lue et
 * écrite). Six arêtes touchées.
 *
 * FORME D'AVANT SEULE : seule une des six arêtes nommées, portant l'apparence de cloison basse ET
 * `structure: mur-a-ossature-en-bois`, est migrée ; une scène ou une arête absente, migrée ou révisée
 * depuis, est laissée telle quelle. Rejoué sur l'état final, le script n'écrit rien.
 *
 * FAIL-FAST (porte de lecture, avant toute écriture) : racine sans `scenes` → rien n'est écrit, sortie 1.
 * FORMATAGE PRÉSERVÉ : le fichier est EXACTEMENT `JSON.stringify(doc, null, 1) + '\n'`, vérifié AVANT écriture.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { porteLaTranche } from './lib/formeDAvant.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CIBLE = path.join(ROOT, 'src/scenes/diligence/diligence-projet.json');

const APPARENCE = 'cloison-basse-a-ossature-en-bois';
const STRUCTURE_AVANT = 'mur-a-ossature-en-bois';
const STRUCTURE_APRES = 'cloture-en-clayonnage';
const SCENE = 'la-diligence';
/** Les six arêtes attendues, en `x,y,side` — cardinal FIGÉ : la migration ne touche rien d'autre. */
const ARETES = ['21,29,E', '21,30,E', '19,32,E', '19,31,E', '23,29,E', '23,30,E'];

const echec = (m) => {
  console.error(`[2026-09-04-1680-cloison-basse-en-clayonnage] ${m}`);
  process.exit(1);
};

const brut = fs.readFileSync(CIBLE, 'utf8');
const doc = JSON.parse(brut);
if (!Array.isArray(doc?.scenes)) echec('racine sans tableau `scenes`');
if (brut !== `${JSON.stringify(doc, null, 1)}\n`) echec('formatage non canonique en entrée');

const porteuses = doc.scenes
  .filter((s) => s?.id === SCENE)
  .flatMap((s) => (Array.isArray(s.walls) ? s.walls : []))
  .filter((w) => porteLaTranche(w, { appearance: APPARENCE, structure: STRUCTURE_AVANT }) && ARETES.includes(`${w.x},${w.y},${w.side}`));
if (!porteuses.length) {
  console.log('[2026-09-04-1680-cloison-basse-en-clayonnage] aucune arête à la forme d\'avant — rien à écrire');
  process.exit(0);
}

for (const w of porteuses) w.structure = STRUCTURE_APRES;

fs.writeFileSync(CIBLE, `${JSON.stringify(doc, null, 1)}\n`);
console.log(
  `[2026-09-04-1680-cloison-basse-en-clayonnage] ${porteuses.length} arêtes migrées : ${STRUCTURE_AVANT} → ${STRUCTURE_APRES} (apparence \`${APPARENCE}\` conservée)`,
);
