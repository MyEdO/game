/** Le Bourg de l'Arène — TOUT-EN-SCÈNE, une seule scène. */
import { scene, P, NPC, hero, resetIds, flowOf, flagWhen, testNode } from '../campagne/lib.mjs';

// ── Modèle TOUT-EN-SCÈNE ────────────────────────────────────────────────────────────────────
// Les quatre corps architecturaux portent leurs sections de toit, murs d'arête et zones intérieures.

// ── Dialogues du Bourg ──────────────────────────────────────────────────────────────────────

/** Porte d'une zone de l'échelle : visible quand la précédente est nettoyée, pas la suivante. */
const porte = (n, nom) => ({
  label: `Entrer — ${nom}.`,
  icon: 'action/attack',
  when: flagWhen(n === 1 ? '!zone1_clear' : `zone${n - 1}_clear,!zone${n}_clear`),
  flow: flowOf([{ type: 'transition', scene: `arene-zone${n}` }]),
});

/** Contrat d'expédition : proposition (gated progression) puis paiement au retour (flag _fait). */
const contrat = (key, cond, propose, fait, gold, xp) => [
  {
    label: propose,
    icon: 'file/document',
    when: flagWhen(`${cond},!contrat_${key}`),
    flow: flowOf([
      { type: 'setFlag', flag: `contrat_${key}` },
      { type: 'journal', desc: `Contrat accepté — ouvrez la carte du monde pour voyager. ${fait}` },
    ]),
  },
  {
    label: `Toucher la prime — ${propose.replace(/^.*?: /, '')}`,
    icon: 'resource/gold-purse',
    when: flagWhen(`contrat_${key}_fait,!contrat_${key}_paye`),
    flow: flowOf([
      { type: 'setFlag', flag: `contrat_${key}_paye` },
      { type: 'giveMoney', montant: { gold } },
      { type: 'giveXp', amount: xp },
      { type: 'journal', desc: 'Le Maître compte les couronnes sans sourciller. « Du travail propre. »' },
    ]),
  },
];

const dlgHub = {
  id: 'dlg-hub',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'Tu saignes encore ? Parfait, le sable boit tout. L’échelle t’attend — et pour les plus gourmands, j’ai des contrats au-delà de la palissade.',
      choices: [
        { label: 'L’échelle de l’arène.', icon: 'action/attack', next: 'echelle' },
        { label: 'Les contrats d’expédition.', icon: 'file/document', next: 'contrats' },
        {
          label: 'Crocheter le vieux coffre du maître.',
          icon: 'ui/lock',
          when: flagWhen('!coffre_pris'),
          flow: testNode(
            { skill: { id: 'crochetage' }, difficulty: 'intermediaire', label: 'Crocheter le coffre', stake: { authored: 'Forcer la serrure : 5 couronnes dans le coffre, sinon le mécanisme rouillé tient bon.' } },
            [
              { type: 'setFlag', flag: 'coffre_pris' },
              { type: 'giveMoney', montant: { gold: 5 } },
              { type: 'journal', desc: 'Le coffre cède : 5 couronnes !' },
            ],
            [{ type: 'journal', desc: 'Le mécanisme rouillé résiste — peut-être plus tard.' }],
          ),
        },
        {
          label: 'Réclamer ton titre de CHAMPION.',
          icon: 'scenario/arena',
          when: flagWhen('zone13_clear,!champion_fete'),
          flow: flowOf([
            { type: 'setFlag', flag: 'champion_fete' },
            { type: 'giveXp', amount: 300 },
            { type: 'journal', desc: 'Le Maître s’incline, et tout le Bourg avec lui : « CHAMPION DE L’ARÈNE ! »' },
            {
              type: 'document',
              title: 'Titre de Champion de l’Arène',
              desc: 'Par la présente, le porteur est proclamé CHAMPION DE L’ARÈNE DU BOURG — vainqueur de la Cour, des Ruines, des Égouts, du Charnier, des Lices, du Marais, du Nid, de la Fosse, de la Caverne, du Nid de Vermine, du Cercle Maudit, du Sépulcre… et du Dragon des ténèbres lui-même. Que les tavernes lui servent à boire et que les routes s’écartent.',
            },
            { type: 'interlude', weeks: 2 },
            { type: 'endDialogue' },
          ]),
        },
        {
          label: 'Savourer ta gloire de champion.',
          icon: 'scenario/arena',
          when: flagWhen('champion_fete'),
          flow: flowOf([
            { type: 'journal', desc: 'Le maître s’incline : « CHAMPION DE L’ARÈNE ! »' },
            { type: 'endDialogue' },
          ]),
        },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'echelle',
      desc: 'Treize portes, treize bourses. On ouvre la suivante quand la précédente est nettoyée. Équipe-toi avant d’entrer — le sable ne rend rien.',
      choices: [
        porte(1, 'La Cour (échauffement)'),
        porte(2, 'Les Ruines'),
        porte(3, 'Les Égouts'),
        porte(4, 'Le Charnier'),
        porte(5, 'Les Lices'),
        porte(6, 'Le Marais'),
        porte(7, 'Le Nid'),
        porte(8, 'La Fosse'),
        porte(9, 'La Caverne du Troll'),
        porte(10, 'Le Nid de Vermine'),
        porte(11, 'Le Cercle Maudit'),
        porte(12, 'Le Sépulcre'),
        porte(13, 'L’Antre du Dragon'),
        { label: '↩ Revenir.', next: 'accueil' },
      ],
    },
    {
      id: 'contrats',
      desc: 'Le Bourg paie pour ce qui rôde au-delà de la palissade. Accepte, puis prends la route par la carte du monde. Emporte des RATIONS — la Tavernière en vend : la route creuse l’estomac.',
      choices: [
        ...contrat('foret', 'zone4_clear', 'La Vieille Futaie : des hommes-bêtes ont dressé un camp — et la bande de Bella la Noire détrousse les convois.', 'Méfie-toi : la futaie a des yeux.', 3, 160),
        ...contrat('marais', 'zone6_clear', 'La Tourbière Noire : quelque chose de FABRIQUÉ y traîne les voyageurs sous l’eau.', 'Reste sur les pontons.', 4, 200),
        ...contrat('village', 'zone8_clear', 'Felsbach : le village ne répond plus depuis un mois. Brûle ce qui marche encore.', 'Ne bois pas l’eau du puits.', 5, 240),
        { label: '↩ Revenir.', next: 'accueil' },
      ],
    },
  ],
};

const dlgMedecin = {
  id: 'dlg-medecin',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'Encore vivant ? Bien. J’ai des potions, du faxtoryll pour les saignements, des membres de rechange… et la scie, si vraiment il faut OPÉRER.',
      choices: [
        { label: 'Voir les remèdes et prothèses.', icon: 'medical/aid', flow: flowOf([{ type: 'openMerchant', entityId: 'medecin' }]) },
        {
          label: 'Passer sur la table (actes payants).',
          icon: 'medical/scalpel',
          // « Une simple visite coûte 4-6 pistoles pour une aide médicale » (LDB 75 l.34) — tarif PAR ACTE.
          flow: flowOf([{
            type: 'medicalAid',
            acts: [
              { act: 'wounds', cost: { silver: 4 } },
              { act: 'bleed', cost: { silver: 4 } },
              { act: 'trauma', cost: { silver: 5 } },
              { act: 'surgery', cost: { silver: 6 } },
            ],
            entityId: 'medecin',
          }]),
        },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgForgeron = {
  id: 'dlg-forgeron',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'Le sable bouffe le fil des lames plus vite que les monstres. Montre-moi ton acier — je vends, je rachète, je RÉPARE.',
      choices: [
        { label: 'Armes, armures et réparations.', icon: 'merchant/cart', flow: flowOf([{ type: 'openMerchant', entityId: 'forgeron' }]) },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgEchoppier = {
  id: 'dlg-echoppier',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'Onguents, herbes, cordages, torches — tout ce qui manque quand la nuit tombe sur la route. Entrez, entrez : ma boutique a tout ce que le sable n’a pas encore mangé.',
      choices: [
        { label: 'Voir l’étal (herbes, potions, fournitures).', icon: 'merchant/cart', flow: flowOf([{ type: 'openMerchant', entityId: 'echoppiere' }]) },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgTaverne = {
  id: 'dlg-taverne',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'Bienvenue au Trophée ! Table, chambre, et de quoi remplir les sacoches — la route ne nourrit personne, prenez des RATIONS avant de voyager.',
      choices: [
        { label: 'Voir le garde-manger (rations, vivres, pintes).', icon: 'rest/stew', flow: flowOf([{ type: 'openMerchant', entityId: 'taverniere' }]) },
        {
          // Repas de MIDI (sans dormir) : prix de groupe d'auteur — la nuit passe par la modale de Repos.
          label: 'Repas chaud pour le groupe.',
          icon: 'rest/stew',
          cost: { silver: 4 },
          flow: flowOf([{ type: 'mealParty' }, { type: 'journal', desc: 'Ragoût, pain noir et bière : le groupe est nourri pour la journée.' }]),
        },
        {
          // Nuit au Trophée : la modale de repos porte chambre, repas par héros et prix.
          label: 'Prendre des chambres pour la nuit.',
          icon: 'rest/bed',
          flow: flowOf([{ type: 'rest', lodging: 'auberge' }]),
        },
        { label: 'Écouter la salle.', icon: 'expedition/rumor', next: 'rumeurs' },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'rumeurs',
      desc: 'On entend de tout ici, surtout après la troisième pinte…',
      choices: [
        { label: '« Et l’arène ? »', next: 'rumeur-arene' },
        { label: '« Et les routes ? »', next: 'rumeur-routes' },
        { label: '↩ Revenir.', next: 'accueil' },
      ],
    },
    {
      id: 'rumeur-arene',
      desc: 'Elle essuie une chope, l’œil en coin. « Personne n’a jamais passé la treizième porte. Et entre nous : le Maître fait descendre des carcasses ENTIÈRES là-dessous. On ne nourrit pas un trophée. »',
      choices: [
        { label: '« Bon à savoir. »', flow: flowOf([{ type: 'journal', desc: 'Rumeur du Trophée : personne n’a passé la 13e porte — le Maître NOURRIT quelque chose là-dessous.' }, { type: 'endDialogue' }]) },
        { label: '↩ Une autre rumeur.', next: 'rumeurs' },
      ],
    },
    {
      id: 'rumeur-routes',
      desc: '« La diligence de Felsbach n’est jamais arrivée le mois dernier. Et les charognards qu’on croise en lisière de la Futaie… portent des cottes de voyageurs. Prenez des rations, et voyagez armés. »',
      choices: [
        { label: '« Merci du tuyau. »', flow: flowOf([{ type: 'journal', desc: 'Rumeur du Trophée : la diligence de Felsbach a disparu — la Futaie détrousse les convois.' }, { type: 'endDialogue' }]) },
        { label: '↩ Une autre rumeur.', next: 'rumeurs' },
      ],
    },
  ],
};

const dlgFrere = {
  id: 'dlg-frere',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'Sigmar garde les braves — et recoud les imprudents. Approche : la chapelle soigne, bénit, et accepte les dons.',
      choices: [
        {
          label: 'Recevoir des soins (actes payants).',
          icon: 'medical/aid',
          flow: flowOf([{ type: 'medicalAid', acts: [{ act: 'wounds', cost: { silver: 5 } }, { act: 'bleed', cost: { silver: 5 } }], entityId: 'frere' }]),
        },
        {
          label: 'Recevoir la bénédiction du départ (retrouver la Chance).',
          icon: 'faith/prayer',
          when: flagWhen('!benediction_recue'),
          flow: flowOf([
            { type: 'restoreFortune' },
            { type: 'setFlag', flag: 'benediction_recue' },
            { type: 'journal', desc: 'Frère Anselm trace la comète sur vos fronts : la Chance vous revient.' },
          ]),
        },
        {
          label: 'Faire un don au tronc.',
          icon: 'resource/gold-purse',
          cost: { gold: 1 },
          flow: flowOf([{ type: 'journal', desc: 'La pièce sonne au fond du tronc. Frère Anselm hoche la tête, sincèrement ému.' }]),
        },
        {
          label: 'Piller le tronc des offrandes.',
          icon: 'action/pick-up',
          when: flagWhen('!tronc_pille'),
          flow: testNode(
            { skill: { id: 'discretion' }, difficulty: 'difficile', label: 'Piller le tronc sous l’œil de Sigmar', stake: { authored: 'Faire main basse sans être vu : 30 pistoles à la clé ; pris sur le fait, le tronc bascule et vous gagnez 1 Point de Péché.' } },
            [
              { type: 'setFlag', flag: 'tronc_pille' },
              { type: 'giveMoney', montant: { silver: 30 } },
              { type: 'journal', desc: 'Trente pistoles d’offrandes glissent dans votre poche. Personne n’a rien vu. Sauf, peut-être, Sigmar.' },
            ],
            [
              { type: 'setFlag', flag: 'tronc_pille' },
              { type: 'giveSin', amount: 1 },
              { type: 'journal', desc: 'Le tronc bascule avec fracas — le regard de Frère Anselm vous transperce. La honte (et le Péché) vous colle à la peau.' },
            ],
          ),
        },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
  ],
};

const dlgGarde = {
  id: 'dlg-garde',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'L’arène est au sud, derrière la porte. La route de l’est mène à la Futaie, à la Tourbière et à Felsbach — si tu tiens à tes jambes, voyage de jour et le ventre plein.',
      choices: [
        { label: '« Rien à signaler ? »', next: 'signalements' },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'signalements',
      desc: 'Il hausse les épaules. « Des hurlements dans la Futaie, la nuit. Et plus une lumière à Felsbach depuis un mois. Si tu veux mon avis : reste du bon côté de la palissade. »',
      choices: [
        { label: '« Merci du conseil. »', flow: flowOf([{ type: 'journal', desc: 'Le garde : hurlements nocturnes dans la Futaie, Felsbach éteint depuis un mois.' }, { type: 'endDialogue' }]) },
        { label: '↩ Autre chose.', next: 'accueil' },
      ],
    },
  ],
};

const dlgRumeurs = {
  id: 'dlg-rumeurs',
  start: 'accueil',
  nodes: [
    {
      id: 'accueil',
      desc: 'Vous êtes les nouveaux gladiateurs ? On parie sur vous au lavoir. Enfin… certains.',
      choices: [
        { label: '« Qu’est-ce qui se raconte ? »', next: 'lavoir' },
        { label: 'Plus tard.', flow: flowOf([{ type: 'endDialogue' }]) },
      ],
    },
    {
      id: 'lavoir',
      desc: 'Elle baisse la voix. « Le Maître garde un vieux coffre dont il a perdu la clef — il dit que c’est sans valeur, mais il dort dessus. Et passez voir Frère Anselm à la chapelle : il bénit ceux qui descendent sur le sable. »',
      choices: [
        { label: '« Intéressant… »', flow: flowOf([{ type: 'journal', desc: 'Rumeur du lavoir : le coffre « sans valeur » du Maître, et la bénédiction de Frère Anselm avant le combat.' }, { type: 'endDialogue' }]) },
        { label: '↩ Autre chose.', next: 'accueil' },
      ],
    },
  ],
};

// ── La carte du Bourg (50×40, extérieur, TOUT-EN-SCÈNE) ──────────────────────────────────────
// Une PLACE PAVÉE centrale (maître d'arène, puits, étals, tente du médecin) d'où RAYONNENT des rues
// pavées vers les 4 bâtiments (aux 4 coins), la porte SUD (arène) et la porte EST (route/monde). Chaque
// corps architectural est une GRANDE empreinte dont l'intérieur (sol peint ci-dessous + PNJ/marchand/props)
// tient DEDANS. Les 4 empreintes :
//   taverne  x3..17  y3..12  (15×10, NO) — porte S (10,12)
//   chapelle x34..46 y3..13  (13×11, NE) — porte S (40,13)
//   forge    x3..13  y27..35 (11×9,  SO) — porte N (8,27)
//   échoppe  x36..46 y27..35 (11×9,  SE) — porte N (41,27)
// La grille peint le SOL des intérieurs (`b`=plancher, `m`=marbre, `d`=dalle).

const W = 50;
const H = 40;

/** Rect inclusif [x0,x1]×[y0,y1] rempli d'un char (dans la grille). */
function fillRect(grid, x0, y0, x1, y1, ch) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y][x] = ch;
}

function buildRows() {
  // Base = terre ('.'), bordée d'une palissade '#'.
  const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
  for (let x = 0; x < W; x++) { grid[0][x] = '#'; grid[H - 1][x] = '#'; }
  for (let y = 0; y < H; y++) { grid[y][0] = '#'; grid[y][W - 1] = '#'; }

  // Ceinture d'herbe autour de la place et aux abords des bâtiments (verdure de bourg).
  fillRect(grid, 1, 1, W - 2, H - 2, 'h');

  // Place pavée centrale.
  fillRect(grid, 18, 14, 33, 26, 'p');
  // Rues pavées reliant la place aux 4 portes de bâtiment + aux 2 portes de rempart.
  fillRect(grid, 10, 12, 11, 15, 'p'); // vers la porte de la TAVERNE (10,12) — remonte à la place
  fillRect(grid, 10, 14, 18, 15, 'p'); // rue NO → place
  fillRect(grid, 40, 13, 41, 16, 'p'); // vers la porte de la CHAPELLE (40,13)
  fillRect(grid, 33, 15, 41, 16, 'p'); // rue NE → place
  fillRect(grid, 8, 24, 9, 27, 'p');   // vers la porte de la FORGE (8,27)
  fillRect(grid, 8, 24, 18, 25, 'p');  // rue SO → place
  fillRect(grid, 41, 24, 42, 27, 'p'); // vers la porte de l'ÉCHOPPE (41,27)
  fillRect(grid, 33, 24, 42, 25, 'p'); // rue SE → place
  fillRect(grid, 24, 26, 25, 38, 'p'); // rue SUD → porte de l'arène
  fillRect(grid, 33, 19, 48, 20, 'p'); // rue EST → porte de la route

  // Intérieurs : sol peint dans la couche z0.
  fillRect(grid, 3, 3, 17, 12, 'b');   // taverne : plancher
  fillRect(grid, 3, 27, 13, 35, 'b');  // forge : plancher
  fillRect(grid, 36, 27, 46, 35, 'b'); // échoppe : plancher
  // Chapelle : nef de marbre centrale bordée de dalle.
  fillRect(grid, 34, 3, 46, 13, 'd');  // dallage
  fillRect(grid, 37, 5, 43, 11, 'm');  // nef de marbre

  // Portes de rempart (tuiles `porte`).
  grid[H - 1][24] = 'D'; grid[H - 1][25] = 'D'; // porte SUD (arène)
  grid[19][W - 1] = 'D'; grid[20][W - 1] = 'D'; // porte EST (route)

  return grid.map((r) => r.join(''));
}

const ROWS = buildRows();

function perimeterWalls(foot, door) {
  const runs = [
    Array.from({ length: foot.w }, (_, i) => ({ x: foot.x + i, y: foot.y, side: 'N' })),
    Array.from({ length: foot.w }, (_, i) => ({ x: foot.x + i, y: foot.y + foot.h - 1, side: 'S' })),
    Array.from({ length: foot.h }, (_, i) => ({ x: foot.x, y: foot.y + i, side: 'O' })),
    Array.from({ length: foot.h }, (_, i) => ({ x: foot.x + foot.w - 1, y: foot.y + i, side: 'E' })),
  ];
  return runs.flatMap((run) => run.map((wall, i) => {
    if (wall.x === door.x && wall.y === door.y && wall.side === door.side) return { ...wall, door: true };
    return {
      ...wall,
      structure: 'mur-en-bois',
      ...(i > 0 && i < run.length - 1 && i % 3 === 1 ? { window: true } : {}),
    };
  }));
}

// `validateBuildingMasses` (state/mapSpec.ts) exige qu'à un étage donné, TOUT le plancher intérieur de
// la SCÈNE appartienne aux masses d'UN SEUL corps — quatre corps séparés (un par bâtiment) échoueraient
// chacun à couvrir le plancher des trois autres. Le Bourg est donc UN corps portant quatre masses
// disjointes (une par bâtiment), storeys/facades restant listés PAR bâtiment à l'intérieur de ce corps.
const HUB_ARCHITECTURE = [
  {
    id: 'bourg',
    label: 'Le Bourg de l’Arène',
    storeys: [
      { id: 'taverne-z0', z: 0, parts: [{ id: 'taverne-volume', foot: { x: 3, y: 3, w: 15, h: 10 } }], roomZoneIds: ['piece-taverne'] },
      { id: 'chapelle-z0', z: 0, parts: [{ id: 'chapelle-volume', foot: { x: 34, y: 3, w: 13, h: 11 } }], roomZoneIds: ['piece-chapelle'] },
      { id: 'forge-z0', z: 0, parts: [{ id: 'forge-volume', foot: { x: 3, y: 27, w: 11, h: 9 } }], roomZoneIds: ['piece-forge'] },
      { id: 'echoppe-z0', z: 0, parts: [{ id: 'echoppe-volume', foot: { x: 36, y: 27, w: 11, h: 9 } }], roomZoneIds: ['piece-echoppe'] },
    ],
    facades: [
      { id: 'taverne-facade-sud', z: 0, edges: [{ x: 10, y: 13, side: 'N' }], appearance: 'auberge-relais-imperiale', roomZoneIds: ['piece-taverne'], features: [{ id: 'enseigne-taverne', kind: 'sign', edge: { x: 10, y: 13, side: 'N' }, offset: 0.5, width: 1.2 }] },
      { id: 'chapelle-facade-sud', z: 0, edges: [{ x: 40, y: 14, side: 'N' }], appearance: 'chapelle', roomZoneIds: ['piece-chapelle'], features: [{ id: 'clocheton-chapelle', kind: 'belfry', edge: { x: 40, y: 14, side: 'N' }, offset: 0.5 }] },
      { id: 'forge-facade-ouest', z: 0, edges: [{ x: 2, y: 31, side: 'E' }], appearance: 'forge', roomZoneIds: ['piece-forge'], features: [{ id: 'cheminee-forge-du-bourg', kind: 'chimney', edge: { x: 2, y: 31, side: 'E' }, offset: 0.5 }] },
    ],
    masses: [
      { id: 'taverne', z: 0, footprint: [{ x: 3, y: 3, w: 15, h: 10 }], levels: 1, profile: 'gable', pitchDeg: 30, material: 'tuile' },
      { id: 'chapelle', z: 0, footprint: [{ x: 34, y: 3, w: 13, h: 11 }], levels: 1, profile: 'gable', pitchDeg: 30, material: 'toit-ardoise' },
      { id: 'forge', z: 0, footprint: [{ x: 3, y: 27, w: 11, h: 9 }], levels: 1, profile: 'gable', pitchDeg: 30, material: 'toit-ardoise' },
      { id: 'echoppe', z: 0, footprint: [{ x: 36, y: 27, w: 11, h: 9 }], levels: 1, profile: 'gable', pitchDeg: 38, material: 'chaume' },
    ],
  },
];

const HUB_WALLS = [
  ...perimeterWalls({ x: 3, y: 3, w: 15, h: 10 }, { x: 10, y: 12, side: 'S' }),
  ...perimeterWalls({ x: 34, y: 3, w: 13, h: 11 }, { x: 40, y: 13, side: 'S' }),
  ...perimeterWalls({ x: 3, y: 27, w: 11, h: 9 }, { x: 8, y: 27, side: 'N' }),
  ...perimeterWalls({ x: 36, y: 27, w: 11, h: 9 }, { x: 41, y: 27, side: 'N' }),
];

const HUB_ROOMS = [
  { id: 'piece-taverne', label: 'Taverne « Au Trophée »', presentation: 'interior', area: { kind: 'rect', x: 3, y: 3, w: 15, h: 10 }, z: 0 },
  { id: 'piece-chapelle', label: 'Chapelle de Sigmar', presentation: 'interior', area: { kind: 'rect', x: 34, y: 3, w: 13, h: 11 }, z: 0 },
  { id: 'piece-forge', label: 'Forge du Bourg', presentation: 'interior', area: { kind: 'rect', x: 3, y: 27, w: 11, h: 9 }, z: 0 },
  { id: 'piece-echoppe', label: 'Échoppe « Le Bric-à-Broc »', presentation: 'interior', area: { kind: 'rect', x: 36, y: 27, w: 11, h: 9 }, z: 0 },
];

export function makeHub() {
  resetIds();
  return scene({
    id: 'arene-hub',
    rest: { auberge: true }, // la taverne du Bourg (tout-en-scène) offre le couchage
    label: 'Le Bourg de l’Arène',
    desc: 'Le bourg fortifié qui vit de son arène : taverne, chapelle, forge, échoppe — quatre bâtiments GRANDS ouverts sur une place, et treize portes vers le sable.',
    ambiance: 'exterieur',
    music: { ambient: 'musique-ville' },
    startMessage:
      'LE BOURG DE L’ARÈNE. Une place pavée, quatre bâtiments et treize portes. Le Maître d’arène (au centre) ouvre l’échelle et les contrats. Entrez dans la Taverne (repos, repas, rations), la Chapelle (soins, bénédiction), la Forge (armes, réparations) ou l’Échoppe (herbes, fournitures) — le toit se lève quand vous y pénétrez. La route de l’est part vers le monde.',
    rows: ROWS,
    base: 'terre',
    legend: { p: 'pave', h: 'herbe', b: 'plancher', m: 'marbre', d: 'dalle' },
    architecture: HUB_ARCHITECTURE,
    walls: HUB_WALLS,
    effectZones: HUB_ROOMS,
    entities: [
      hero(24, 24),
      { id: 'orn-echoppe-etal', kind: 'prop', pos: { x: 41, y: 26 }, facing: 'N', ref: 'etal-marche' },
      // ── Place centrale ──────────────────────────────────────────────────────────────────────
      NPC('maitre', 25, 20, 'Maître d’arène', {
        facing: 'S',
        dialogueId: 'dlg-hub',
        appearance: { species: 'humains-reiklander', tenue: 'repurgateur', sex: 'M', build: 0.62 },
        weapon: 'epee-batarde',
      }),
      NPC('garde', 25, 34, 'Garde du Bourg', {
        facing: 'S',
        dialogueId: 'dlg-garde',
        appearance: { species: 'humains-reiklander', tenue: 'soldat', sex: 'M', build: 0.58 },
        weapon: 'hallebarde',
      }),
      NPC('villageoise', 21, 22, 'Villageoise', { facing: 'S', dialogueId: 'dlg-rumeurs', anim: 'standing', appearance: { species: 'humains-reiklander', tenue: 'mendiant', sex: 'F' } }),
      NPC('villageois-1', 30, 22, 'Villageois', { anim: 'standing', appearance: { species: 'humains-reiklander', tenue: 'mendiant' } }),
      NPC('villageois-2', 29, 17, 'Badaud', { anim: 'cowering', facing: 'E', appearance: { species: 'humains-reiklander', tenue: 'bourgeois' } }),
      P(20, 18, 'puits'),
      P(28, 16, 'coffre', { label: 'Le coffre du maître' }),
      P(19, 15, 'lampadaire'),
      P(32, 25, 'lampadaire'),
      P(22, 24, 'etal-marche'),
      P(31, 19, 'etal-marche'),
      P(22, 16, 'gibet'),
      P(30, 24, 'pilori'),
      // Médecin : sous sa tente d'infirmerie, au nord de la place (extérieur) — soins & prothèses.
      NPC('medecin', 26, 15, 'Médecin', {
        facing: 'S',
        // Sa FICHE (bestiaire) porte sa Guérison et son Int : l'effet `medicalAid` ne recopie rien.
        ref: 'medecin',
        dialogueId: 'dlg-medecin',
        merchant: { archetype: 'medecin' },
        appearance: { species: 'humains-reiklander', tenue: 'apothicaire', sex: 'M', build: 0.46 },
      }),
      P(27, 14, 'tente', { label: 'Infirmerie' }),
      // Coin entraînement (herbe, ouest de la place)
      P(15, 20, 'mannequin'),
      P(15, 22, 'rack-lances'),
      // Panneau vers la porte de l'arène (sud)
      P(23, 30, 'panneau', { label: '« L’ARÈNE — treize portes, une gloire »' }),
      P(22, 38, 'palissade'),
      P(27, 38, 'palissade'),

      // ── Intérieur : TAVERNE « Au Trophée » (empreinte x3..17 y3..12) ──────────────────────────
      NPC('taverniere', 9, 5, 'Tavernière', {
        facing: 'S',
        dialogueId: 'dlg-taverne',
        merchant: { archetype: 'taverniere' },
        appearance: { species: 'humains-reiklander', tenue: 'bourgeois', sex: 'F', build: 0.55 },
      }),
      NPC('client-1', 5, 8, 'Client', { anim: 'feeding', facing: 'E', appearance: { species: 'nains', tenue: 'batelier' } }),
      NPC('client-2', 14, 9, 'Habitué', { anim: 'standing', facing: 'O', appearance: { species: 'humains-reiklander', tenue: 'mendiant' } }),
      NPC('client-3', 6, 10, 'Buveur', { anim: 'standing', facing: 'E', appearance: { species: 'humains-reiklander', tenue: 'soldat', sex: 'M' } }),
      P(4, 4, 'feu-camp', { label: 'Âtre' }),
      P(12, 4, 'etagere'),
      P(13, 4, 'tonneau'),
      P(14, 4, 'tonneau'),
      P(15, 4, 'crane-monstre', { label: 'LE Trophée' }),
      P(6, 7, 'tonneau', { label: 'Table' }),
      P(12, 7, 'tonneau', { label: 'Table' }),
      P(9, 9, 'tonneau', { label: 'Table' }),
      P(4, 11, 'caisse'),
      P(16, 11, 'tas-foin'),
      P(4, 6, 'tas-foin'),

      // ── Intérieur : CHAPELLE de Sigmar (empreinte x34..46 y3..13, nef de marbre) ──────────────
      NPC('frere', 40, 5, 'Frère Anselm', {
        facing: 'S',
        ref: 'pretre-de-sigmar',
        dialogueId: 'dlg-frere',
        appearance: { species: 'humains-reiklander', tenue: 'pretre', sex: 'M', build: 0.5 },
      }),
      NPC('fidele', 38, 10, 'Fidèle en prière', { anim: 'cowering', facing: 'N', appearance: { species: 'humains-reiklander', tenue: 'mendiant', sex: 'F' } }),
      P(40, 4, 'autel'),
      P(38, 4, 'chandelier'),
      P(42, 4, 'chandelier'),
      P(35, 7, 'statue', { label: 'Sigmar Heldenhammer' }),
      P(45, 7, 'statue', { label: 'La Comète à deux queues' }),
      P(35, 11, 'brasero'),
      P(45, 11, 'brasero'),
      P(36, 5, 'urne'),
      P(44, 5, 'urne'),
      P(44, 12, 'coffre', { label: 'Tronc des offrandes' }),

      // ── Intérieur : FORGE du Bourg (empreinte x3..13 y27..35) ─────────────────────────────────
      NPC('forgeron', 8, 33, 'Forgeron', {
        facing: 'N',
        dialogueId: 'dlg-forgeron',
        merchant: { archetype: 'armurier' },
        appearance: { species: 'nains', tenue: 'artisan', sex: 'M', build: 0.7 },
        weapon: 'marteau-de-guerre',
      }),
      NPC('apprenti', 11, 31, 'Apprenti', { anim: 'standing', facing: 'O', appearance: { species: 'humains-reiklander', tenue: 'artisan', sex: 'M', build: 0.4 } }),
      P(4, 28, 'feu-camp', { label: 'Le foyer' }),
      P(6, 30, 'etabli', { label: 'Établi & enclume' }),
      P(4, 32, 'tonneau', { label: 'Cuve à trempe' }),
      P(12, 28, 'rack-armes'),
      P(12, 29, 'rack-lances'),
      P(12, 34, 'caisse'),
      P(4, 34, 'tonneaux-pile'),

      // ── Intérieur : ÉCHOPPE « Le Bric-à-Broc » (empreinte x36..46 y27..35) ────────────────────
      NPC('echoppiere', 41, 33, 'Échoppière', {
        facing: 'N',
        dialogueId: 'dlg-echoppier',
        merchant: { archetype: 'herboriste' },
        appearance: { species: 'humains-reiklander', tenue: 'bourgeois', sex: 'F', build: 0.48 },
      }),
      NPC('chaland', 44, 32, 'Chaland', { anim: 'standing', facing: 'O', appearance: { species: 'humains-reiklander', tenue: 'mendiant' } }),
      P(37, 28, 'etal-marche', { label: 'Comptoir' }),
      P(45, 28, 'etagere'),
      P(38, 30, 'etagere'),
      P(45, 30, 'etagere'),
      P(37, 32, 'tonneau'),
      P(45, 34, 'caisse'),
      P(37, 34, 'caisse'),
      P(45, 32, 'tonneaux-pile'),
    ],
    dialogues: [dlgHub, dlgMedecin, dlgGarde, dlgRumeurs, dlgTaverne, dlgFrere, dlgForgeron, dlgEchoppier],
    triggers: [
      // Porte EST (la route) : franchir la porte ouvre la carte du monde — la sortie du Bourg EST le
      // voyage (#T2). Posé sur les tuiles de porte (x49), pas sur l'entryPoint `route` → pas de
      // réouverture intempestive au retour de voyage.
      { id: 'porte-route', rect: { x: 49, y: 19, w: 1, h: 2 }, flow: flowOf([{ type: 'openWorldMap' }]) },
      // Porte SUD (l'arène) : on n'y entre que sur ordre du Maître — rappel in-world.
      {
        id: 'porte-arene-rappel',
        rect: { x: 24, y: 38, w: 2, h: 1 },
        flow: flowOf([{ type: 'journal', desc: 'Les portes de l’arène sont barrées de l’intérieur — elles ne s’ouvrent que sur ordre du Maître d’arène (place centrale).' }]),
      },
    ],
    encounters: [],
    entryPoints: { 'porte-arene': { x: 24, y: 37 }, route: { x: 48, y: 20 }, entree: { x: 24, y: 24 } },
    flags: {},
  });
}
