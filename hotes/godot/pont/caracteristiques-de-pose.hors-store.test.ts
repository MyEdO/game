import { expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { suiteDe, table } from './pont.testkit';
import type { Bouton, Element } from '../../../src/hote/elements';
import { findCreatureById } from '../../../src/data';
import { statblockDeLaCreature } from '../../../src/data/valeursNeuves';
import { randomizeChars } from '../../../src/engine/statblock';
import { CHAR_KEYS, type Characteristics } from '../../../src/engine/types';
import { emptyNarratif } from '../../../src/noyau/monde/campaignNarratif';
import { presetDuNarratif } from '../../../src/noyau/monde/resolveursDuNarratif';
import { emptyScene, type SceneEntity } from '../../../src/noyau/monde/scene';
import { ficheDEntite } from '../../../src/noyau/monde/sceneNpc';
import { parseProject } from '../../../src/noyau/worldMap';
import { campagneDeTest } from '../../../src/scenes/fixtures/contenuDuCommun';
import { paquetDuJeu } from '../../../src/noyau/index';

type Edition = { vue: { zones: Record<string, Element[]> }; depot?: { texte: string } };

const CONTROLE = 'valeur/combat/randomChars';
const servi = paquetDuJeu(campagneDeTest);
const preset = { id: 'preset-temoin', base: { id: 'humain' } };
const narratif = { ...emptyNarratif(), presetsPnj: [preset] };
const statblock = statblockDeLaCreature(findCreatureById('humain')!);
const entites: SceneEntity[] = [
  { kind: 'personnage', id: 'carriere', pos: { x: 1, y: 1 }, creature: { id: 'humain' } },
  { kind: 'personnage', id: 'preset', pos: { x: 2, y: 1 }, presetId: preset.id },
  { kind: 'personnage', id: 'statbloc', pos: { x: 3, y: 1 }, statblock },
];
const scene = {
  ...emptyScene('caracteristiques-de-pose', 6, 6),
  entities: [{ kind: 'heroStart' as const, id: 'depart', pos: { x: 0, y: 1 } }, ...entites],
};
const projet = { ...servi, worldMap: undefined, narratif, scenes: [scene] };
const resoudre = presetDuNarratif(narratif);
const fiche = (pose: SceneEntity) => ficheDEntite(pose, resoudre);

it.each(entites)('le réglage de $id s’écrit au même contrôle, se duplique et se retrouve en reprenant la partie', (ent) => {
  const kit = table();
  let { appel } = kit;
  let e: Edition;
  function editer(gestes: unknown) {
    const reponse = appel('editer', gestes);
    expect(reponse.ok, JSON.stringify(reponse).slice(0, 400)).toBe(true);
    e = reponse as unknown as Edition;
    return e;
  }
  function bouton(id: string): Bouton {
    const gestes = Object.values(e.vue.zones).flat().flatMap((el) =>
      el.type === 'bouton' ? [el] : el.type === 'choix' || el.type === 'liste' ? el.valeurs : []);
    const b = gestes.find((geste) => geste.id === id);
    expect(b, id).toBeDefined();
    return b!;
  }
  function bascule(libelle: 'Oui' | 'Non') {
    const controles = e.vue.zones['editeur.inspecteur'].filter((el) => el.id.endsWith('/randomChars'));
    expect(controles.map((el) => el.id)).toEqual([CONTROLE]);
    const controle = controles[0];
    if (controle.type !== 'choix') throw new Error('la bascule doit être un choix');
    return controle.valeurs.find((b) => b.libelle === libelle)!;
  }
  function selectionner() {
    const point = { case: ent.pos, f: ent.pos };
    editer({ edition: { geste: 'appui', point } });
    editer({ edition: { geste: 'relache', point } });
  }
  function ouvrir(texte: string) {
    editer({ ouvrir: servi.id, projet: texte });
    selectionner();
  }
  function enregistrer() {
    const texte = editer(bouton('enregistrer').jeu).depot!.texte;
    const document = parseProject(JSON.parse(texte));
    const pose = document.scenes[0].entities.find((c) => c.id === ent.id)!;
    return { texte, pose, document };
  }
  function profilDansLaPartie() {
    const vue = suiteDe(appel('fiche', { fiche: { porteur: ent.id } })).vue;
    const profil = vue.zones['fiche.profil'].filter((c) => c.id.startsWith('carac/'));
    expect(profil).toHaveLength(CHAR_KEYS.length);
    return profil.map((c) => [c.id, c.valeur]);
  }

  ouvrir(JSON.stringify(projet));
  if (ent.id === 'carriere') {
    editer(bouton('carriere/ajouter/soldat').jeu);
    editer(bouton('carriere/soldat/niveau/2').jeu);
    expect(bouton('carriere/soldat/niveau/2').presse).toBe(true);
  }
  editer(bouton('valeur/combat/ajouter').jeu);
  editer(bascule('Oui').jeu);
  expect(bascule('Oui').presse).toBe(true);
  editer(bouton('dupliquer').jeu);
  expect(bascule('Oui').presse, 'la copie hérite du réglage').toBe(true);

  const oui = enregistrer();
  expect(oui.pose.combat?.randomChars).toBe(true);
  const copie = oui.document.scenes[0].entities.find((c) => !scene.entities.some((initiale) => initiale.id === c.id))!;
  expect(copie).toMatchObject({ combat: { randomChars: true } });

  ({ appel } = table(kit.stockage));
  ouvrir(oui.texte);
  expect(bascule('Oui').presse).toBe(true);

  editer(bouton('tester').jeu);
  expect(appel('demarrer', { essai: true, graine: 7 }).ok).toBe(true);
  const avant = profilDansLaPartie();
  expect(appel('sauvegarder', { sauvegarder: 1 }).ok).toBe(true);
  expect(appel('quitter').ok).toBe(true);
  ({ appel } = table(kit.stockage));
  expect(appel('charger', { charger: 1, graine: 17 }).ok).toBe(true);
  expect(profilDansLaPartie()).toEqual(avant);
  expect(appel('quitter').ok).toBe(true);

  ouvrir(oui.texte);
  editer(bascule('Non').jeu);
  const non = enregistrer();
  expect(non.pose.combat?.randomChars).toBe(false);
  ({ appel } = table());
  ouvrir(non.texte);
  expect(bascule('Non').presse).toBe(true);

  const fixe = fiche(non.pose);
  const base = fiche({ ...non.pose, carrieres: undefined }).characteristics;
  function avecLeParcours(chars: Characteristics) {
    const resultat = { ...chars };
    for (const cle of CHAR_KEYS) resultat[cle] += fixe.characteristics[cle] - base[cle];
    return resultat;
  }
  const tirage = randomizeChars(base, ent.id);
  expect(fiche(oui.pose).characteristics, 'un seul tirage puis les Augmentations de carrière').toEqual(avecLeParcours(tirage));
  expect(fiche(oui.pose).characteristics).not.toEqual(avecLeParcours(randomizeChars(tirage, ent.id)));
  expect(fiche(oui.pose).characteristics, 'Non retrouve les valeurs fixes').not.toEqual(fixe.characteristics);
  expect(fiche(oui.pose).skills, 'les Augmentations de Compétences restent les mêmes').toEqual(fixe.skills);
  const copieTiree = fiche(copie).characteristics;
  expect(copieTiree).toEqual(avecLeParcours(randomizeChars(base, copie.id)));
  expect(copieTiree).not.toEqual(fiche(oui.pose).characteristics);
});

it('un ancien projet doit passer par le filtre avant de retrouver le même tirage à sa pose', () => {
  const pose = { ...entites[2], combat: { randomChars: false } };
  const ancienne = { ...pose, statblock: { ...statblock, randomChars: true } };
  const ancienProjet = { ...projet, scenes: [{ ...scene, entities: [ancienne] }] };
  expect(() => parseProject(ancienProjet)).toThrow(/randomChars/);

  const script = fileURLToPath(new URL('../../../scripts/campagne/migrer-caracteristiques-de-pose.mjs', import.meta.url));
  const migre = execFileSync(process.execPath, [script], { input: JSON.stringify(ancienProjet), encoding: 'utf8', timeout: 5_000 });
  const [nouvelle] = parseProject(JSON.parse(migre)).scenes[0].entities;
  expect(nouvelle).toMatchObject({ id: pose.id, combat: { randomChars: true }, statblock });
  expect(nouvelle.statblock).not.toHaveProperty('randomChars');
  expect(fiche(nouvelle).characteristics).toEqual(randomizeChars(fiche(pose).characteristics, pose.id));
});
