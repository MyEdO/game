import { makePregens } from '../../data/pregens';
import type { SceneEntity, CustomStatblock } from '../../state/scene';
import type { MapSpec } from '../../state/mapSpec';
import { buildScene } from '../../state/mapSpec';
import type { TestScenario } from './_shared';
import { flowFromEffects, testFlow, type Flow } from '../../state/flow';

// Profil des deux étudiants saboteurs : de jeunes civils paniqués, vifs mais fragiles (pas de combattants).
const ETUDIANT: CustomStatblock = { type: 'statblock',
  label: 'Étudiant', char: { M: 4, 'capacite-de-combat': 32, 'capacite-de-tir': 38, force: 30, endurance: 30, initiative: 35, agilite: 38, dexterite: 35, intelligence: 42, 'force-mentale': 28, sociabilite: 35, B: 11 },
  weaponDamage: '+BF+2', armour: 0,
};

/**
 * « Une nuit à l'Opéra » — le Théâtre Staatsoper, reconstitué d'après le PLAN du scénario (NADJ 8,
 * source 08 l.28-41). Carte DÉCLARÉE en `MapSpec` → compilée par `buildScene` (100 % en données, éditable) :
 * la grille reste authorée en ASCII (une par étage, comme l'arène), la logique d'intrigue vit dans les
 * champs `triggers`/`dialogues`/`encounters` du spec.
 *
 *  Rez-de-chaussée (couche 0) : coulisses + coursive (mur arrière) → scène (SURÉLEVÉE +1 m) → PARTERRE
 *  (auditorium) → HALL (foyer) → vestibule d'entrée ; deux RAMPES jumelles aux angles du hall montent à
 *  l'étage (cases de hauteur croissante 0→1→2 m, AUCUN escalier : le moteur fabrique la pente).
 *  Étage supérieur (couche 1, à 2 m) : galerie moquettée desservant les LOGES (de chaque côté) + la LOGE
 *  ROYALE et son ANTICHAMBRE au fond-centre (où les agents de Dammenblatz posent la bombe, l.62/131).
 *
 *  Légende : # mur (tuile pleine) · = planches (coulisses/coursive) · S plancher (scène, +1 m) · M marbre
 *  (parterre) · H dalle (hall/vestibule) · E plancher (RAMPE vers l'étage) · L plancher (galerie/loges) ·
 *  D porte. Le `.`/l'espace = terrain de base (mur en tuile pleine au z0, vide au z1).
 */
const LEGEND: Record<string, string> = {
  '#': 'mur', D: 'porte', '=': 'planches',
  M: 'marbre', S: 'plancher', H: 'dalle', E: 'plancher', L: 'plancher',
};

const Z0 = [
  '#####################',
  '#===================#', // coursive le long du mur arrière (accès coulisses/acteurs)
  '#===#SSSSSSSSSSS#===#', // coulisses gauche (loges d'artistes/salle verte) | SCÈNE | coulisses droite (ateliers)
  '#===#SSSSSSSSSSS#===#',
  '#===DSSSSSSSSSSSD===#', // portes de scène
  '#...MMMMMMMMMMMMM...#', // PARTERRE (auditorium, face à la scène)
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#...MMMMMMMMMMMMM...#',
  '#EEHHHHHHHHHHHHHHHEE#', // escaliers jumeaux (E) flanquant le HALL d'entrée
  '#EEHHHHHHHHHHHHHHHEE#',
  '#..HHHHHHHHHHHHHHH..#',
  '#......HHHHHHH......#', // vestibule (Porte des Dames / des Seigneurs, entrée du groupe)
].join('\n');

const Z1 = [
  '.....................',
  '.....................',
  '.....................',
  '.....................',
  '.LLL.............LLL.', // loges latérales : 4 à gauche, 4 à droite, surplombant le parterre
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '.LLL.............LLL.',
  '...LLLLLLLLLLLLLLL...', // galerie moquettée (relie loges et loge royale) ; les RAMPES percent les angles (cols 1-2 / 18-19 → vide)
  '...LLLLLLLLLLLLLLL...',
  '...LLLLLLLLLLLLLLL...', // ANTICHAMBRE de la loge royale (la plante piégée y est livrée)
  '.....................',
].join('\n');

const W = 21, H = 17;

const ents: SceneEntity[] = [
  // Scène (z0) : rideau au fond, pupitre du chef devant.
  { id: 'rideau-g', kind: 'prop', ref: 'rideau-scene', pos: { x: 7, y: 2 } },
  { id: 'rideau-c', kind: 'prop', ref: 'rideau-scene', pos: { x: 10, y: 2 } },
  { id: 'rideau-d', kind: 'prop', ref: 'rideau-scene', pos: { x: 13, y: 2 } },
  { id: 'pupitre', kind: 'prop', ref: 'pupitre-chef', pos: { x: 10, y: 5 }, facing: 'N' },

  // Parterre (z0) : rangées de fauteuils face à la scène (allée centrale x10), colonnes, statue.
  { id: 'sieges-1g', kind: 'prop', ref: 'rangee-sieges', pos: { x: 5, y: 7 }, facing: 'N' },
  { id: 'sieges-1d', kind: 'prop', ref: 'rangee-sieges', pos: { x: 11, y: 7 }, facing: 'N' },
  { id: 'sieges-2g', kind: 'prop', ref: 'rangee-sieges', pos: { x: 5, y: 10 }, facing: 'N' },
  { id: 'sieges-2d', kind: 'prop', ref: 'rangee-sieges', pos: { x: 11, y: 10 }, facing: 'N' },
  { id: 'colonne-g', kind: 'prop', ref: 'colonne-brisee', pos: { x: 4, y: 6 } },
  { id: 'colonne-d', kind: 'prop', ref: 'colonne-brisee', pos: { x: 16, y: 6 } },
  { id: 'statue', kind: 'prop', ref: 'statue', pos: { x: 4, y: 12 } },
  // Professeur Pakker et son épouse, près de l'allée centrale (source 08 l.158) — cible des pétards.
  { id: 'pakker', kind: 'personnage', ref: 'villageois', label: 'Professeur Pakker', pos: { x: 9, y: 8 }, facing: 'N' },
  // Les deux étudiants, repliés vers l'arrière de la salle près de la porte (l.158) — combat optionnel.
  { id: 'etudiant-1', kind: 'personnage', label: 'Étudiant nerveux', pos: { x: 5, y: 15 }, facing: 'S', appearance: { species: 'humains-reiklander' }, dialogueId: 'dlg-etudiants', statblock: ETUDIANT },
  { id: 'etudiant-2', kind: 'personnage', label: 'Étudiant fébrile', pos: { x: 6, y: 15 }, facing: 'S', appearance: { species: 'humains-reiklander' }, statblock: ETUDIANT },

  // Lustre pendu au-dessus du parterre qu'il éclaire (la recette porte la hauteur, patron `applique-murale`).
  { id: 'lustre', kind: 'prop', ref: 'lustre-opera', pos: { x: 10, y: 8 } },

  // Loges gauche (z1) : balustrade côté parterre, fauteuils, applique, un spectateur. Le garde-corps se
  // pose à la CASE (`props.json`) : une travée par case du bord de loge, cap sur le vide du parterre.
  ...[5, 6, 7].map((y): SceneEntity => ({ id: `bal-g-${y}`, kind: 'prop', ref: 'balustrade-loge', pos: { x: 3, y }, facing: 'E', z: 1 })),
  { id: 'ft-g1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 1, y: 6 }, z: 1 },
  { id: 'ft-g2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 1, y: 8 }, z: 1 },
  { id: 'app-g', kind: 'prop', ref: 'applique-murale', pos: { x: 1, y: 5 }, z: 1 },
  { id: 'spect-g', kind: 'personnage', ref: 'villageois', label: 'Spectatrice', pos: { x: 2, y: 7 }, z: 1, facing: 'E' },

  // Loges droite (z1).
  ...[5, 6, 7].map((y): SceneEntity => ({ id: `bal-d-${y}`, kind: 'prop', ref: 'balustrade-loge', pos: { x: 17, y }, facing: 'O', z: 1 })),
  { id: 'ft-d1', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 19, y: 6 }, z: 1 },
  { id: 'ft-d2', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 19, y: 8 }, z: 1 },
  { id: 'app-d', kind: 'prop', ref: 'applique-murale', pos: { x: 19, y: 5 }, z: 1 },
  { id: 'spect-d', kind: 'personnage', ref: 'villageois', label: 'Spectateur', pos: { x: 18, y: 7 }, z: 1, facing: 'O' },

  // LOGE ROYALE (z1, fond-centre de la galerie) : balustrade face à la scène, fauteuil, la Comtesse, appliques.
  // Les deux volées couvrent 6-8 et 12-14, une travée par case, et laissent 9-11 ouvert au centre de la loge.
  ...[6, 7, 8, 12, 13, 14].map((x): SceneEntity => ({ id: `bal-royale-${x}`, kind: 'prop', ref: 'balustrade-loge', pos: { x, y: 13 }, facing: 'N', z: 1 })),
  { id: 'fauteuil-royal', kind: 'prop', ref: 'fauteuil-loge', pos: { x: 10, y: 14 }, z: 1 },
  { id: 'comtesse', kind: 'personnage', ref: 'villageois', label: 'Comtesse Emmanuelle', pos: { x: 10, y: 13 }, z: 1, facing: 'N', dialogueId: 'dlg-comtesse' },
  { id: 'app-royale-g', kind: 'prop', ref: 'applique-murale', pos: { x: 7, y: 14 }, z: 1 },
  { id: 'app-royale-d', kind: 'prop', ref: 'applique-murale', pos: { x: 13, y: 14 }, z: 1 },
  // INTRIGUE n°1 (source 08 l.131/166) : « grande plante en pot remplie de poudre à canon, détonateur
  // caché », livrée dans l'ANTICHAMBRE de la loge royale (z1). Désamorçage = retirer le détonateur.
  {
    id: 'plante-bombe', kind: 'prop', ref: 'plante-pot', pos: { x: 10, y: 15 }, z: 1,
    usable: { actions: [{ id: 'fouiller', unique: true, consume: false,
      flow: testFlow(
        {
          skill: { id: 'perception' }, difficulty: 'complexe',
          easierIf: { hasSkill: { id: 'projectiles', spec: 'poudre-noire' }, steps: 1 },
          label: 'Examiner la plante en pot',
          stake: { authored: 'Trouver le détonateur sous le feuillage : sinon la charge de l’antichambre reste amorcée, et la loge royale saute à l’heure dite.' },
        },
        flowFromEffects([
          { type: 'journal', desc: 'Sous le feuillage : le pot est bourré de poudre à canon, relié à un détonateur. Vous arrachez le détonateur — la bombe est neutralisée.' },
          { type: 'setFlag', flag: 'bombeDesamorcee' },
          { type: 'giveXp', amount: 50 }, // déjouer le complot de la bombe de Dammenblatz (source 08 l.275)
        ]),
        flowFromEffects([{ type: 'journal', desc: 'Une grande plante en pot, sans rien de particulier.' }]),
      ) }] },
  },

  // Pas d'objet escalier : les deux RAMPES d'angle (cases 'E' de hauteur croissante) montent à la galerie ;
  // la pente est rendue par le relief (parois douces de `groundTile`).
];

const spec: MapSpec = {
  id: 'test-opera-theatre',
  label: 'Opéra — Le théâtre',
  desc: 'Le Théâtre Staatsoper d\'après le plan du scénario : coulisses, scène (surélevée), parterre, hall et rampes jumelles ; galerie de loges et loge royale à l\'étage (couche surélevée à 2 m).',
  size: [W, H],
  ambiance: 'interieur',
  // Couche 0 = mur en tuile pleine par défaut (le `.`/l'espace y valent 'mur', comme le char '#') ; couche 1 = vide.
  terrain: 'mur',
  legend: LEGEND,
  // Deux COUCHES d'empilement : parterre (z0, scène +1 m) + galerie/loges (z1, 2 m). Les rampes d'angle
  // relient les deux par leur dénivelé (surfaceLink) — plus aucun escalier explicite.
  levels: { z0: Z0, z1: Z1 },
  // HAUTEURS MÉTRIQUES. Couche 0 : la SCÈNE est surélevée de 1 m (Δ1 ⇒ rampe douce depuis le parterre/les
  // coulisses) ; les deux RAMPES d'angle (cases 'E') montent 0→1→2 m pour rejoindre la galerie. Couche 1 :
  // galerie/loges à 2 m (la rampe l'y rejoint à hauteur égale). Aucun escalier.
  relief: [
    { rect: [5, 2, 15, 4], height: 1, z: 0 }, // scène surélevée +1 m
    // rampes jumelles (haut 2 m en y=13 / bas 1 m en y=14) → galerie
    { cell: [1, 13], height: 2, z: 0 }, { cell: [2, 13], height: 2, z: 0 }, { cell: [18, 13], height: 2, z: 0 }, { cell: [19, 13], height: 2, z: 0 },
    { cell: [1, 14], height: 1, z: 0 }, { cell: [2, 14], height: 1, z: 0 }, { cell: [18, 14], height: 1, z: 0 }, { cell: [19, 14], height: 1, z: 0 },
    { rect: [0, 0, W - 1, H - 1], height: 2, z: 1 }, // étage (galerie/loges) à 2 m
  ],
  entities: ents,
  heroStart: { x: 10, y: 16 }, // vestibule d'entrée
  dialogues: [
    {
      id: 'dlg-comtesse',
      start: 'n0',
      nodes: [
        {
          id: 'n0',
          desc: 'La Comtesse Emmanuelle vous toise depuis sa loge. « On ne vous a pas conviés dans ma loge. Qu’est-ce qui peut bien valoir cette intrusion ? »',
          choices: [
            { label: '« Excellence — un attentat vous visait. Il est déjoué. »', when: { kind: 'flag', expr: 'bombeDesamorcee' }, next: 'merci' },
            { label: '« Excellence, l’antichambre n’est peut-être pas sûre ce soir. »', when: { kind: 'flag', expr: '!bombeDesamorcee' }, next: 'n1' },
            { label: 'S’incliner et se retirer.', flow: flowFromEffects([{ type: 'endDialogue' }]) },
          ],
        },
        {
          id: 'n1',
          desc: '« Pas sûre ? » Un sourire glacé. « Mes gardes en jugeront. Mais examinez donc, puisque vous y tenez — discrètement. »',
          choices: [{ label: 'Remercier et examiner les lieux.', flow: flowFromEffects([{ type: 'endDialogue' }]) }],
        },
        {
          id: 'merci',
          desc: 'Le masque de hauteur se fissure une seconde. « …Un attentat ? Dans MA loge ? » Elle se ressaisit, mais son regard s’est radouci. « L’Empire saura que la maison von Liebwitz a une dette envers vous. Prenez ceci — et discrétion. »',
          choices: [
            {
              label: 'S’incliner et accepter.',
              flow: flowFromEffects([
                { type: 'giveMoney', montant: { gold: 5 } },
                { type: 'setFlag', flag: 'faveurComtesse' },
                { type: 'endDialogue' },
              ]),
            },
          ],
        },
      ],
    },
    {
      id: 'dlg-etudiants',
      start: 'e0',
      nodes: [
        {
          id: 'e0',
          desc: 'Deux jeunes gens nerveux, dissimulés près de la porte, manipulent un petit pot à feu et un chapelet de pétards. L’un d’eux blêmit en vous voyant approcher.',
          choices: [
            { label: '« Lâchez ça. Vous êtes en état d’arrestation. »', next: 'e1' },
            { label: 'Les laisser filer.', flow: flowFromEffects([{ type: 'journal', desc: 'Vous détournez le regard ; les étudiants se fondent dans la foule.' }, { type: 'endDialogue' }]) },
          ],
        },
        {
          id: 'e1',
          desc: '« On… on ne faisait rien ! » Ils refusent de se rendre et tentent de forcer le passage.',
          choices: [{ label: 'Les maîtriser.', flow: flowFromEffects([{ type: 'endDialogue' }, { type: 'startCombat', encounter: 'enc-etudiants' }]) }],
        },
      ],
    },
  ],
  triggers: [
    {
      // Entrer dans l'auditorium ARME l'intrigue (la plante est en place, l.20h02) : la mèche brûle,
      // l'explosion frappe l'antichambre de la loge royale sauf si on retire le détonateur.
      id: 'armer-bombe',
      rect: { x: 4, y: 5, w: 13, h: 8 },
      once: true,
      flow: flowFromEffects([
        { type: 'journal', desc: 'Les lumières de la salle baissent, le rideau se lève — la représentation commence.' },
        { type: 'setLight', level: 0.35 },
        { type: 'journal', desc: 'Une âcre odeur de poudre flotte depuis la galerie des loges…' },
        // INTRIGUE n°2 (source 08 l.158-162) : à 20h30, deux étudiants jettent des pétards sur le siège
        // de Pakker. Flash de la mèche, pétards, spectacle interrompu SANS panique ; Glimbrin vole.
        {
          type: 'delayedEffect', afterMinutes: 10,
          // Séquence d'échéance : ambiance + souffle des pétards, PUIS un Test de Perception (le vol de Glimbrin).
          flow: {
            kind: 'seq',
            steps: [
              { kind: 'do', effect: { type: 'journal', desc: 'Près de l’allée centrale, la lueur d’une mèche embrase la pénombre…' } },
              { kind: 'do', effect: { type: 'setLight', level: 0.8 } },
              { kind: 'do', effect: { type: 'zoneBlast', center: { x: 9, y: 8 }, radius: 1, ops: [{ op: 'wounds', amount: 2 }] } },
              { kind: 'do', effect: { type: 'journal', desc: 'Une volée de pétards éclate sur le siège du professeur Pakker ! Le spectacle s’interrompt dans les cris — mais sans panique. Dans le brouhaha, une petite silhouette se faufile sous son fauteuil…' } },
              testFlow(
                {
                  skill: { id: 'perception' }, difficulty: 'difficile', label: 'Repérer le voleur dans le brouhaha',
                  stake: { authored: 'Repérer la silhouette glissée sous le fauteuil du professeur Pakker : sinon les clés de l’École impériale d’artillerie partent avec elle.' },
                },
                flowFromEffects([
                  { type: 'journal', desc: 'Vous surprenez un gnome glissé sous le fauteuil du professeur — il détale les mains vides. Les clés de l’École d’artillerie sont sauves.' },
                  { type: 'setFlag', flag: 'glimbrinDejoue' },
                  { type: 'giveXp', amount: 15 }, // empêcher le vol des clés du professeur Pakker (source 08 l.297)
                ]),
                flowFromEffects([
                  { type: 'journal', desc: 'Plus tard, le professeur Pakker s’aperçoit avec effroi que les clés de l’École impériale d’artillerie ont disparu de sa poche…' },
                  { type: 'setFlag', flag: 'clesVolees' },
                ]),
              ),
            ] as Flow[],
          },
        },
        { type: 'delayedEffect', afterMinutes: 11, flow: flowFromEffects([{ type: 'setLight', level: 0.35 }]) },
        {
          type: 'delayedEffect', afterMinutes: 60, cancelFlag: 'bombeDesamorcee',
          flow: flowFromEffects([
            { type: 'journal', desc: 'UNE EXPLOSION DÉCHIRE L’ANTICHAMBRE DE LA LOGE ROYALE !' },
            { type: 'zoneBlast', center: { x: 10, y: 14 }, radius: 6, ops: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10, plus: 15 } } }, { op: 'condition', id: 'en-flammes' }] },
          ]),
        },
      ]),
    },
  ],
  // La rencontre « enc-etudiants » enrôle les DEUX étudiants DÉJÀ posés dans `entities` (visibles, avec
  // dialogue/statblock) via `members` : `MapSpec.encounters` fusionne les `members` pré-déclarés avec les
  // `enemies` terses — plus de `scene.encounters.push` impératif.
  encounters: [
    {
      id: 'enc-etudiants',
      members: [{ entityId: 'etudiant-1' }, { entityId: 'etudiant-2' }],
      onVictory: flowFromEffects([
        { type: 'journal', desc: 'Les deux étudiants sont maîtrisés et remis à la garde — ils passeront la nuit en cellule.' },
        { type: 'setFlag', flag: 'etudiantsArretes' },
        { type: 'giveXp', amount: 10 }, // les étudiants en artillerie contrecarrés (source 08 l.277)
      ]),
    },
  ],
  flags: {},
  startMessage:
    'Le Théâtre Staatsoper. Du vestibule, le hall s’ouvre sur le parterre face à la scène surélevée ; deux rampes d’angle montent à la galerie des loges, où siège la Comtesse dans la loge royale.',
};

const scene = buildScene(spec);

export const scenario: TestScenario = {
  id: 'opera',
  order: 9,
  category: 'scenarios',
  icon: 'scenario/opera',
  title: 'Opéra',
  tests:
    'Théâtre Staatsoper multi-couches en ASCII (coulisses/scène SURÉLEVÉE/parterre/hall couche 0, RAMPES ' +
    'd\'angle → galerie/loges/loge royale couche 1 à 2 m). Intrigues authorées : BOMBE à minuterie de la loge ' +
    'royale (delayedEffect ' +
    '→ zoneBlast, désamorçage facilité par la Poudre noire, cancelFlag), pétards + vol des clés par Glimbrin ' +
    '(Test caché à deux issues), étudiants saboteurs (combat optionnel), dialogue gaté de la Comtesse, PX canoniques.',
  partyNote: 'Pré-tirés',
  makeParty: () => makePregens(),
  scene,
};
