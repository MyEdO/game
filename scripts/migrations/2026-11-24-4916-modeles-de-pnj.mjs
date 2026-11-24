/**
 * Migration #4916 — les modèles de carrière, les profils de héros et les rôles de bête du *Bestiaire non officiel*
 * (Le Ratier Bretonnien, v2.03, p.4-5) entrent au catalogue `modeles-de-pnj.json`, un document par entrée, sa sorte
 * en `kind`. Fiche `user-arbitrage-bestiaire-non-officiel` ; VO : fiche
 * `user-doctrine-vo-fournit-la-donnee-mecanique-absente-de-la-vf`.
 *
 * ENTRÉES DE CONVERSION : `TPL`, `HERO` et `BEAST` de la page v1 de l'Atelier des PNJ (PR #3633,
 * `outils/atelier-pnj/template.html`), recopiés ci-dessous aux ids du dépôt, avec les écarts relevés à la VO
 * (`Source/Homebrew & Fan Material/Unofficial Bestiary 2.0/01 - Unofficial Bestiary 2.0.md`), chacun à sa ligne.
 *
 * GESTES, joués une seule fois (NO-OP dès que `modeles-de-pnj.json` existe : le catalogue s'édite ensuite au
 * Compendium) :
 *  1. un document `modele` par modèle de carrière : Caractéristiques, Compétences, Talents, Traits facultatifs,
 *     possessions (une personne en mention de nature `personne`, #4053) ; la bourse `[n, unité]` devient une somme `{ monnaie, count: { roll: n d10 } }` ;
 *  2. un document `heros` par profil de héros : modificateurs par Caractéristique (le « — » imprimé : aucun), Arme +N,
 *     Armure +N, Traits ;
 *  3. un document `bete` par rôle de bête : Compétence, bonus, Talent.
 *
 * ENTRÉES : écrite — `src/data/modeles-de-pnj.json` ; lues — `characteristics.json`, `skills.json`, `talents.json`,
 * `traits.json`, `trappings.json`.
 * FAIL-FAST — avant toute écriture, sortie 1 : réf (Caractéristique, Compétence, Talent, Trait, objet) absente de son
 * catalogue, unité de bourse inconnue, `modeles-de-pnj.json` présent hors `serializeDataset`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDataset } from '../../src/data/serialize.ts';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DATA = (rel) => path.join(ROOT, 'src/data', rel);
const CIBLE = DATA('modeles-de-pnj.json');
const TYPE = 'modeles-de-pnj';
const source = (page) => ({ book: 'bestiaire-non-officiel', page });

if (fs.existsSync(CIBLE)) {
  const texte = fs.readFileSync(CIBLE, 'utf8');
  if (serializeDataset(JSON.parse(texte)) !== texte) {
    console.error('#4916 — modeles-de-pnj.json : formatage hors serializeDataset, rien n’est écrit.');
    process.exit(1);
  }
  console.log('#4916 — modeles-de-pnj.json déjà présent : rien à faire.');
  process.exit(0);
}

const lire = (rel) => JSON.parse(fs.readFileSync(DATA(rel), 'utf8'));
const ids = (rel) => new Set(lire(rel).map((e) => e.id));
const CARACS = lire('characteristics.json').filter((c) => c.nature === 'roll').map((c) => c.id);
const SKILLS = ids('skills.json');
const TALENTS = ids('talents.json');
const TRAITS = ids('traits.json');
const OBJETS = ids('trappings.json');
const MONNAIES = { CO: 'gold', pa: 'silver', s: 'brass' };

/** [id, libellé, aussi pour, Caractéristiques (rang 0 = CC), Compétences, Talents, Traits facultatifs, possessions
 *  (`i` objet du catalogue, `m` personne, `t` texte), bourse] */
const TPL = [
  ['assassin', 'Assassin', 'Duelliste, Espion', [0, 4, 5, 6], [['escalade'], ['corps-a-corps', 'base'], ['projectiles', 'lancer'], ['discretion']], [['ambidextre'], ['discret'], ['frappe-blessante'], ['frappe-assommante']], ['vision-nocturne', 'furtif', 'venin', 'grimpant'], [{ i: 'dague' }, { i: 'flechette' }, { i: 'veste-de-cuir' }, { t: 'Fiole de poison' }], [5, 'pa']],
  ['chef', 'Chef', 'Général, Commandant, Seigneur de guerre', [0, 3, 8, 9], [['esquive'], ['intimidation'], ['commandement'], ['perception']], [['maitrise-du-combat'], ['desarmer'], ['sixieme-sens'], ['coup-puissant']], ['champion', 'elite', 'endurant', 'meneur'], [{ i: 'plastron' }, { i: 'heaume' }, { i: 'bouclier' }, { i: 'arme-simple' }, { m: 'Troupes' }, { i: 'uniforme' }], [1, 'CO']],
  // VO l.152
  ['diplomate', 'Diplomate', 'Émissaire, Messager, Porte-étendard', [3, 4, 5, 9], [['charme'], ['resistance'], ['savoir', 'region'], ['chevaucher', 'cheval']], [['fuite'], ['sociable'], ['lire-ecrire'], ['pas-de-cote']], ['intelligent', 'ruse', 'rapide', 'endurant'], [{ i: 'dague' }, { i: 'livree' }, { i: 'parchemin' }, { i: 'etui-a-parchemin' }, { i: 'necessaire-d-ecriture' }], [1, 'pa']],
  ['fanatique', 'Fanatique', 'Flagellant, Tueur', [0, 2, 3, 8], [['esquive'], ['resistance'], ['intimidation'], ['corps-a-corps', 'base']], [['sans-peur'], ['frenesie'], ['assaut-feroce'], ['dur-a-cuire']], ['champion', 'peur', 'haine', 'insensible-a-la-douleur'], [{ t: 'Hache ou fléau' }, { i: 'symbole-religieux' }, { t: 'Vêtements en lambeaux' }], [1, 's']],
  ['chasseur', 'Chasseur', 'Archer, Pisteur', [1, 2, 3, 4], [['survie-en-exterieur'], ['projectiles', 'arc'], ['piegeage'], ['pistage']], [['tir-precis'], ['dur-a-cuire'], ['oeil-du-chasseur'], ['nomade']], ['arboricole', 'elite', 'vision-nocturne', 'pisteur'], [{ i: 'piege-a-animaux' }, { i: 'arc' }, { i: 'dague' }, { t: 'Peaux' }], [4, 's']],
  // VO l.181
  ['marchand', 'Marchand', 'Colporteur, Commerçant', [4, 5, 7, 9], [['conduite-d-attelage'], ['marchandage'], ['intuition'], ['savoir', 'region']], [['baratiner'], ['negociateur'], ['savoir-vivre', 'guildes'], ['lire-ecrire']], ['rapide', 'intelligent', 'nerveux'], [{ i: 'boulier' }, { i: 'licence-de-guilde' }, { t: 'Mule et charrette' }, { t: 'Biens de commerce' }], [5, 'pa']],
  // VO l.192, l.194, l.196
  ['noble', 'Noble', 'Seigneur, Politicien', [4, 7, 8, 9], [['ragot'], ['commandement'], ['savoir', 'politique'], ['corps-a-corps', 'base']], [['savoir-vivre', 'nobles'], ['noblesse'], ['orateur'], ['lire-ecrire']], ['intelligent', 'meneur', 'prejuge', 'studieux-bno'], [{ i: 'dague' }, { i: 'fleuret' }, { t: 'Vêtements de qualité' }, { m: 'Serviteur' }, { i: 'necessaire-d-ecriture' }], [3, 'CO']],
  // VO l.205
  ['medecin', 'Médecin', 'Barbier-chirurgien, Guérisseur', [6, 7, 8, 9], [['guerison'], ['savoir', 'anatomie'], ['savoir', 'medecine'], ['metier', 'barbier']], [['pansement-de-fortune'], ['lire-ecrire'], ['frappe-assommante'], ['chirurgie']], ['ruse', 'maladie', 'prejuge', 'studieux-bno'], [{ i: 'bandages' }, { i: 'licence-de-guilde' }, { i: 'outils-professionnels-medecin' }], [3, 'pa']],
  // VO l.216
  ['pretre', 'Prêtre', 'Moine, Nonne, Chaman', [6, 7, 8, 9], [['charme'], ['resistance'], ['savoir', 'theologie'], ['priere']], [['beni'], ['invocation'], ['ame-pure'], ['lire-ecrire']], ['beni', 'ruse', 'miracles', 'studieux-bno'], [{ t: 'Livres' }, { t: 'Dague de cérémonie' }, { i: 'symbole-religieux' }, { i: 'robes' }], [1, 'pa']],
  ['voleur', 'Voleur', 'Éclaireur, Tirailleur, Sournois', [2, 4, 5, 6], [['escalade'], ['corps-a-corps', 'base'], ['crochetage'], ['discretion']], [['effraction'], ['criminel'], ['grimpeur'], ['pas-de-cote']], ['rapide', 'vision-nocturne', 'furtif', 'venin'], [{ i: 'pied-de-biche' }, { i: 'dague' }, { i: 'veste-de-cuir' }, { i: 'outils-de-crochetage' }], [3, 'pa']],
  ['guerrier', 'Guerrier', 'Garde, Soldat', [0, 1, 3, 4], [['esquive'], ['savoir', 'guerre'], ['corps-a-corps', 'base'], ['projectiles', 'arbalete']], [['vigilance'], ['porte-bouclier'], ['inebranlable']], ['belliqueux', 'champion', 'elite', 'coriace'], [{ i: 'plastron' }, { i: 'arbalete' }, { i: 'heaume' }, { i: 'arme-simple' }, { i: 'uniforme' }], [3, 'pa']],
  // VO l.249
  ['sorcier', 'Sorcier', 'Sorcière, Magicien', [0, 4, 7, 8], [['focalisation'], ['intuition'], ['langue', 'magick'], ['savoir', 'magie']], [['magie-des-arcanes'], ['detection-d-artefact'], ['lire-ecrire'], ['seconde-vue']], ['intelligent', 'lanceur-de-sorts', 'studieux-bno'], [{ i: 'grimoire' }, { t: 'Licence magique' }, { i: 'baton-de-combat' }, { i: 'robes' }], [3, 'pa']],
];

/** [id, libellé, modificateurs (rang 0 = CC), Arme +N, Armure +N, Traits] */
const HERO = [
  ['chef', 'Chef d’unité', [15, 10, 5, 5, 10, 5, 0, 5, 10, 10]],
  ['mineur', 'Héros mineur', [30, 20, 10, 10, 20, 10, 5, 10, 20, 20], 1, 1, ['champion']],
  // VO l.299
  ['majeur', 'Héros majeur', [45, 30, 20, 20, 30, 20, 10, 20, 30, 30], 2, 2, ['champion', 'endurant', 'pisteur']],
];

/** [id, libellé, Compétence, bonus, Talent] — VO l.256 */
const BEAST = [
  ['predateur', 'Prédateur', ['corps-a-corps', 'bagarre'], 20, 'frappe-blessante'],
  ['proie', 'Proie', ['perception'], 20, 'fuite'],
];

const fautes = [];
const verifie = (catalogue, id, quoi, ou) => {
  if (!catalogue.has(id)) fautes.push(`${ou} : ${quoi} « ${id} » absent du catalogue`);
  return id;
};
const designe = ([id, spec]) => (spec ? { id, spec } : { id });

const documents = [
  ...TPL.map(([id, label, aussiPour, caracs, competences, talents, traits, possessions, [des, unite]]) => {
    const ou = `modèle ${id}`;
    if (!(unite in MONNAIES)) fautes.push(`${ou} : unité de bourse « ${unite} » inconnue`);
    return {
      id: `modele-${id}`, type: TYPE, label, kind: 'modele', aussiPour,
      caracteristiques: caracs.map((k) => CARACS[k]),
      competences: competences.map((r) => designe([verifie(SKILLS, r[0], 'Compétence', ou), r[1]])),
      talents: talents.map((r) => designe([verifie(TALENTS, r[0], 'Talent', ou), r[1]])),
      traitsFacultatifs: traits.map((t) => verifie(TRAITS, t, 'Trait', ou)),
      dotations: [
        ...possessions.map((p) => (p.i ? { id: verifie(OBJETS, p.i, 'objet', ou) } : p.m ? { label: p.m, nature: 'personne' } : { text: p.t })),
        { monnaie: MONNAIES[unite], count: { roll: { n: des, sides: 10 } } },
      ],
      source: source(4),
    };
  }),
  ...HERO.map(([id, label, mods, arme, armure, traits = []]) => ({
    id: `heros-${id}`, type: TYPE, label, kind: 'heros',
    modificateurs: Object.fromEntries(mods.flatMap((v, k) => (v ? [[CARACS[k], v]] : []))),
    ...(arme ? { arme } : {}),
    ...(armure ? { armure } : {}),
    ...(traits.length ? { traits: traits.map((t) => verifie(TRAITS, t, 'Trait', `héros ${id}`)) } : {}),
    source: source(5),
  })),
  ...BEAST.map(([id, label, competence, bonus, talent]) => ({
    id: `bete-${id}`, type: TYPE, label, kind: 'bete',
    competence: designe([verifie(SKILLS, competence[0], 'Compétence', `bête ${id}`), competence[1]]),
    bonus,
    talent: { id: verifie(TALENTS, talent, 'Talent', `bête ${id}`) },
    source: source(5),
  })),
];
if (CARACS.length !== 10) fautes.push(`characteristics.json : ${CARACS.length} Caractéristiques de jet, 10 attendues`);

if (fautes.length) {
  console.error(`#4916 — rien n'est écrit :\n  ${fautes.join('\n  ')}`);
  process.exit(1);
}
fs.writeFileSync(CIBLE, serializeDataset(documents));
console.log(`#4916 — modeles-de-pnj.json : ${documents.length} document(s).`);
