/**
 * ESSAI #2819 (branche `poc/three-gltf`, jamais fusionnée) : les combattants rendus par des modèles
 * glTF animés (KayKit, CC0, `public/modeles/`) à la place de leur billboard. Couche à part du monde :
 * `GameStage3D` la pose à chaque image, sur les boards qu'il a déjà posés.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DIR8_DELTA, type Dir8 } from '../../state/dir8';

export type ModeleGltf = 'Knight' | 'Skeleton_Warrior';
export type GesteGltf = 'Idle' | 'Walking_A' | '1H_Melee_Attack_Chop' | 'Hit_A' | 'Block' | 'Death_A';

const GESTES: readonly GesteGltf[] = ['Idle', 'Walking_A', '1H_Melee_Attack_Chop', 'Hit_A', 'Block', 'Death_A'];
const UNE_FOIS: ReadonlySet<GesteGltf> = new Set(['1H_Melee_Attack_Chop', 'Hit_A', 'Block', 'Death_A']);
/** L'arme tenue : celle du Knight ; le Skeleton_Warrior n'en porte aucune, il reçoit la même. */
const ARME = '1H_Sword';
const ARMES_ET_BOUCLIERS = ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '1H_Sword', '2H_Sword'];
const FONDU_S = 0.15;

const chargeur = new GLTFLoader();
const sources = new Map<ModeleGltf, Promise<GLTF>>();
function charger(m: ModeleGltf): Promise<GLTF> {
  let p = sources.get(m);
  if (!p) {
    p = chargeur.loadAsync(`${import.meta.env.BASE_URL}modeles/${m}.glb`);
    sources.set(m, p);
  }
  return p;
}

interface ActeurGltf {
  racine: THREE.Group;
  mixer: THREE.AnimationMixer;
  actions: Map<GesteGltf, THREE.AnimationAction>;
  geste: GesteGltf | null;
  /** Hauteur du modèle à l'échelle 1, mesurée à l'instanciation. */
  hauteur: number;
}

/** Ce que la passe d'image dit d'un combattant. */
export interface PoseGltf {
  cid: string;
  modele: ModeleGltf;
  pieds: THREE.Vector3;
  /** Cap en radians autour de +Y (0 = +Z, le sud du monde). */
  cap: number;
  hauteurM: number;
  geste: GesteGltf;
  visible: boolean;
}

export const capDeDir8 = (d: Dir8): number => Math.atan2(DIR8_DELTA[d].gx, DIR8_DELTA[d].gy);

function instancier(gltf: GLTF, epee: THREE.Object3D | null): ActeurGltf {
  const racine = cloneSkinned(gltf.scene) as THREE.Group;
  const aRetirer: THREE.Object3D[] = [];
  racine.traverse((o) => {
    if (ARMES_ET_BOUCLIERS.includes(o.name) && o.name !== ARME) aRetirer.push(o);
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.frustumCulled = false;
    }
  });
  for (const o of aRetirer) o.removeFromParent();
  if (epee && !racine.getObjectByName(ARME)) {
    const parent = epee.parent && racine.getObjectByName(epee.parent.name);
    if (parent) {
      const copie = epee.clone();
      copie.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
      parent.add(copie);
    }
  }
  const hauteur = new THREE.Box3().setFromObject(racine).getSize(new THREE.Vector3()).y || 1;
  const enfant = new THREE.Group();
  enfant.add(racine);
  const mixer = new THREE.AnimationMixer(racine);
  const actions = new Map<GesteGltf, THREE.AnimationAction>();
  for (const g of GESTES) {
    const clip = THREE.AnimationClip.findByName(gltf.animations, g);
    if (!clip) continue;
    const a = mixer.clipAction(clip);
    if (UNE_FOIS.has(g)) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    actions.set(g, a);
  }
  return { racine: enfant, mixer, actions, geste: null, hauteur };
}

export class CoucheGltf {
  readonly racine = new THREE.Group();
  private readonly acteurs = new Map<string, ActeurGltf>();
  private readonly enCours = new Set<string>();
  private dernier = performance.now();

  constructor(private readonly surPret: () => void) {
    this.racine.name = 'gltf-acteurs';
  }

  /** L'objet à donner au rayon de picking pour ce combattant, s'il est monté. */
  objet(cid: string): THREE.Object3D | undefined {
    return this.acteurs.get(cid)?.racine;
  }

  /** Pose l'image : rend les cids effectivement dessinés par un modèle (leur billboard s'éteint). */
  poser(poses: readonly PoseGltf[]): ReadonlySet<string> {
    const now = performance.now();
    const dt = Math.min(0.1, Math.max(0, (now - this.dernier) / 1000));
    this.dernier = now;
    const dessinés = new Set<string>();
    const voulus = new Set(poses.map((p) => p.cid));
    for (const [cid, a] of this.acteurs) {
      if (voulus.has(cid)) continue;
      a.racine.removeFromParent();
      a.mixer.stopAllAction();
      this.acteurs.delete(cid);
    }
    for (const p of poses) {
      const a = this.acteurs.get(p.cid);
      if (!a) {
        this.monter(p);
        continue;
      }
      a.racine.visible = p.visible;
      // Un gisant n'est ni cible ni écran du rayon (même loi que les billboards, `GameStage3D` picker).
      a.racine.userData.gisant = p.geste === 'Death_A';
      a.racine.position.copy(p.pieds);
      a.racine.rotation.set(0, p.cap, 0);
      a.racine.scale.setScalar(p.hauteurM / a.hauteur);
      this.jouer(a, p.geste);
      a.mixer.update(dt);
      dessinés.add(p.cid);
    }
    return dessinés;
  }

  private monter(p: PoseGltf): void {
    if (this.enCours.has(p.cid)) return;
    this.enCours.add(p.cid);
    Promise.all([charger(p.modele), charger('Knight')]).then(
      ([gltf, knight]) => {
        this.enCours.delete(p.cid);
        if (this.acteurs.has(p.cid)) return;
        const a = instancier(gltf, knight.scene.getObjectByName(ARME) ?? null);
        this.acteurs.set(p.cid, a);
        this.racine.add(a.racine);
        this.surPret();
      },
      (raison: unknown) => {
        this.enCours.delete(p.cid);
        console.warn(`gltfActeurs: modèle « ${p.modele} » non chargé :`, raison);
      },
    );
  }

  private jouer(a: ActeurGltf, geste: GesteGltf): void {
    if (a.geste === geste) return;
    const suivante = a.actions.get(geste);
    if (!suivante) return;
    const précédente = a.geste ? a.actions.get(a.geste) : undefined;
    suivante.reset().setEffectiveWeight(1).fadeIn(FONDU_S).play();
    if (précédente && précédente !== suivante) précédente.fadeOut(FONDU_S);
    a.geste = geste;
  }

  disposer(): void {
    for (const a of this.acteurs.values()) a.mixer.stopAllAction();
    this.acteurs.clear();
    this.racine.removeFromParent();
    this.racine.clear();
  }
}
