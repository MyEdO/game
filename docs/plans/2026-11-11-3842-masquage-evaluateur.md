# Masquage des faces couvertes dans l'évaluateur : diff de l'expérience (#3842, 2026-11-11)

Ticket: #3842

Cette archive est datée. Le diff n'est pas appliqué ; il s'applique sur `d4b44ce6a` (`git apply`), pas sur `fcbb35b5d`. L'expérience et ses mesures sont décrites dans `docs/plans/2026-11-11-3842-couches-de-vetements.md`.

````diff
diff --git a/hotes/godot/asset/evaluateur/evaluer.ts b/hotes/godot/asset/evaluateur/evaluer.ts
index bf7ee3389..60e4cce4a 100644
--- a/hotes/godot/asset/evaluateur/evaluer.ts
+++ b/hotes/godot/asset/evaluateur/evaluer.ts
@@ -32,7 +32,7 @@ import { mesurerSilhouettes, sousLesFormes, type MesuresDesSilhouettes } from '.
 import { etenduesDesSegments, gardeSegments, type MesuresDesSegments } from './gardes/segments.ts';
 import { gardeSuiviDuCorps } from './gardes/suiviDuCorps.ts';
 import { suivreLesAmplitudes } from './gardes/amplitude.ts';
-import { gardeTraversee, lierLesCouches, mesurerTraversee, sansLesZonesMasquees, type TraverseeDUnEchantillon } from './gardes/traversee.ts';
+import { gardeDecouverte, gardeTraversee, lierLesCouches, mesurerDecouverte, mesurerTraversee, sansLesZonesMasquees, type LiaisonDeCouverture, type MesureDesCouches } from './gardes/traversee.ts';
 import { COUCHES, RANG_DU_CORPS, type Couche } from '../element.ts';
 
 /** Ce qu'un élément déclare de sa place sur le corps : sa couche, et les zones du corps qu'il masque. */
@@ -79,6 +79,8 @@ export interface FicheDeMesures {
   readonly mesures: {
     /** Les triangles assemblés, et ceux de chaque mesh de la base puis des éléments, dans leur ordre, sous son libellé (`libellesDesMeshes`). */
     readonly triangles: { readonly total: number; readonly parMesh: readonly { readonly mesh: string; readonly triangles: number }[] };
+    /** Les triangles masqués au repos de chaque mesh qui en a, sous son libellé (`gardes/traversee.ts`). */
+    readonly masques: readonly { readonly mesh: string; readonly triangles: number }[];
     readonly sommets: number;
     readonly os: number;
     readonly images: number;
@@ -225,9 +227,11 @@ export async function evaluer(entree: EntreeDEvaluation): Promise<FicheDeMesures
   const surfaces = manifeste ? surfacesDesPieds(corpsSkinne, manifeste.appuis.pieds) : [];
   const posesDesPieds: PoseDuPied[] = [];
   const couches = lierLesCouches(corpsMontre, declareesMontrees, repos);
-  const traversees: TraverseeDUnEchantillon[] = [];
+  const traversees: MesureDesCouches[] = [];
+  const decouvertes: MesureDesCouches<LiaisonDeCouverture>[] = [];
   for (const e of echantillonner(base.scene, meshes, clips, pas, gabarit)) {
-    traversees.push(...mesurerTraversee(couches, e));
+    traversees.push(...mesurerTraversee(couches.traversee, e));
+    decouvertes.push(...mesurerDecouverte(couches.decouverte, e));
     niveaux.push({ clip: e.clip, t: e.t, plusBas: plusBas(e.positions, corps) });
     etirements.push(mesurerEtirement(aretes, sansCles, e));
     suiviDesChaines.echantillon(e);
@@ -236,13 +240,14 @@ export async function evaluer(entree: EntreeDEvaluation): Promise<FicheDeMesures
   }
   const appuis = mesurerAppuis(posesDesPieds, manifeste ? { [manifeste.clips.walk]: manifeste.appuis.vitesseAuSol * (pose?.echelleDeVitesse ?? 1) } : {});
   ecarts.push(...appuis.ecarts);
-  ecarts.push(...gardePiedsAuSol(niveaux, new Set(entree.clipsAuSol ?? [])), ...gardeEtirement(etirements, libelle), ...gardeTraversee(traversees, libelle), ...amplitudes.ecarts());
+  ecarts.push(...gardePiedsAuSol(niveaux, new Set(entree.clipsAuSol ?? [])), ...gardeEtirement(etirements, libelle), ...gardeTraversee(traversees, libelle), ...gardeDecouverte(decouvertes, libelle), ...amplitudes.ecarts());
 
   const parMesh = meshes.map((m) => ({ mesh: libelle(m), triangles: trianglesDe(m) }));
   return {
     ecarts,
     mesures: {
       triangles: { total: parMesh.reduce((s, m) => s + m.triangles, 0), parMesh },
+      masques: [...couches.masques].map(([m, triangles]) => ({ mesh: libelle(m), triangles })),
       sommets: meshes.reduce((s, m) => s + m.geometry.attributes.position.count, 0),
       os: base.squelette?.bones.length ?? 0,
       images: contenus.reduce((s, c) => s + c.images, 0),
diff --git a/hotes/godot/asset/evaluateur/gardes/traversee.hors-store.test.ts b/hotes/godot/asset/evaluateur/gardes/traversee.hors-store.test.ts
index 113839a60..dc9bc3cd6 100644
--- a/hotes/godot/asset/evaluateur/gardes/traversee.hors-store.test.ts
+++ b/hotes/godot/asset/evaluateur/gardes/traversee.hors-store.test.ts
@@ -3,13 +3,17 @@ import { describe, expect, it } from 'vitest';
 import { BufferAttribute, BufferGeometry, Mesh, SkinnedMesh } from 'three';
 import type { Echantillon } from '../echantillonnage.ts';
 import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
-import { gardeTraversee, lierLesCouches, lierSous, mesurerTraversee, PORTEE_DE_COUVERTURE_M, sansLesZonesMasquees } from './traversee.ts';
+import { gardeDecouverte, gardeTraversee, lierLesCouches, lierSous, mesurerDecouverte, mesurerTraversee, PORTEE_DE_COUVERTURE_M, sansLesZonesMasquees } from './traversee.ts';
 import { RANG_DU_CORPS } from '../../element.ts';
 
-/** Un carré de 0,2 m de côté à la hauteur `z`, en grille 3 × 3. */
-function carre(z: number): Float32Array {
-  return Float32Array.from([-1, 0, 1].flatMap((y) => [-1, 0, 1].flatMap((x) => [x * 0.1, y * 0.1, z])));
+/** Une nappe de x0 à x1 et de y0 à y1 à la hauteur `z`, en grille 3 × 3. */
+function nappe(x0: number, x1: number, y0: number, y1: number, z: number): Float32Array {
+  return Float32Array.from([0, 0.5, 1].flatMap((j) => [0, 0.5, 1].flatMap((i) => [x0 + (x1 - x0) * i, y0 + (y1 - y0) * j, z])));
 }
+/** Un carré de 0,2 m de côté à la hauteur `z`, en grille 3 × 3. */
+const carre = (z: number): Float32Array => nappe(-0.1, 0.1, -0.1, 0.1, z);
+/** Un carré de 0,4 m de côté à la hauteur `z` : sous un `carre`, seul son sommet central est couvert, rien n'est masqué. */
+const ample = (z: number): Float32Array => nappe(-0.2, 0.2, -0.2, 0.2, z);
 /** Le mesh de `Type` sur `positions`, ses triangles tournés vers +Z, ou vers −Z si `retourne`. */
 function maillage<M extends Mesh>(Type: new (g: BufferGeometry) => M, positions: Float32Array, retourne = false): M {
   const g = new BufferGeometry();
@@ -18,7 +22,7 @@ function maillage<M extends Mesh>(Type: new (g: BufferGeometry) => M, positions:
   g.setIndex(faces);
   return new Type(g);
 }
-const decaler = (p: Float32Array, dz: number) => p.map((v, i) => (i % 3 === 2 ? v + dz : v));
+const decaler = (p: Float32Array, dz: number, dx = 0) => p.map((v, i) => (i % 3 === 2 ? v + dz : i % 3 === 0 ? v + dx : v));
 const libelle = (m: Mesh) => m.name;
 const echantillon = (positions: Map<Mesh, Float32Array>, t = 0.5): Echantillon => ({ clip: 'Coup', t, positions, os: new Map() });
 
@@ -40,12 +44,13 @@ describe('traversee', () => {
   });
 
   it('VERT : la couche suit sa couverture ; ROUGE : elle passe devant au-delà de la tolérance, un écart à son pire instant', () => {
-    const liaisons = lierLesCouches([peau], [{ rang: 1, meshes: [tissu] }], { positions: repos });
-    const suit = mesurerTraversee(liaisons, echantillon(new Map([[peau, decaler(carre(0), 0.3)], [tissu, decaler(carre(0.01), 0.3)]])));
+    const debord = maillage(Mesh, ample(0));
+    const liaisons = lierLesCouches([debord], [{ rang: 1, meshes: [tissu] }], { positions: new Map<Mesh, Float32Array>([[debord, ample(0)], [tissu, carre(0.01)]]) }).traversee;
+    const suit = mesurerTraversee(liaisons, echantillon(new Map([[debord, decaler(ample(0), 0.3)], [tissu, decaler(carre(0.01), 0.3)]])));
     expect(suit).toEqual([]);
-    const tolere = mesurerTraversee(liaisons, echantillon(new Map([[peau, carre(0.01 + ECART_DE_SUIVI_M * 0.9)], [tissu, carre(0.01)]])));
+    const tolere = mesurerTraversee(liaisons, echantillon(new Map([[debord, ample(0.01 + ECART_DE_SUIVI_M * 0.9)], [tissu, carre(0.01)]])));
     expect(tolere).toEqual([]);
-    const mesures = [0.02, 0.04].flatMap((z, k) => mesurerTraversee(liaisons, echantillon(new Map([[peau, carre(z)], [tissu, carre(0.01)]]), k)));
+    const mesures = [0.02, 0.04].flatMap((z, k) => mesurerTraversee(liaisons, echantillon(new Map([[debord, ample(z)], [tissu, carre(0.01)]]), k)));
     const ecarts = gardeTraversee(mesures, libelle);
     expect(ecarts).toHaveLength(1);
     expect(ecarts[0]).toMatchObject({ garde: 'traversee', code: 'couche-traversee', mesh: 'tissu', clip: 'Coup', t: 1, seuil: -ECART_DE_SUIVI_M });
@@ -53,11 +58,11 @@ describe('traversee', () => {
   });
 
   it('un élément ne couvre que les couches plus intérieures : ni lui-même, ni un élément de même couche', () => {
-    const autre = maillage(SkinnedMesh, carre(0.005));
-    const positions = { positions: new Map<Mesh, Float32Array>([...repos, [autre, carre(0.005)]]) };
-    const liaisons = lierLesCouches([], [{ rang: 1, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions);
+    const autre = maillage(SkinnedMesh, ample(0.005));
+    const positions = { positions: new Map<Mesh, Float32Array>([...repos, [autre, ample(0.005)]]) };
+    const liaisons = lierLesCouches([], [{ rang: 1, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions).traversee;
     expect(liaisons).toEqual([]);
-    expect(lierLesCouches([], [{ rang: 2, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions).map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
+    expect(lierLesCouches([], [{ rang: 2, meshes: [tissu] }, { rang: 1, meshes: [autre] }], positions).traversee.map((l) => [l.sujet, l.couverture])).toEqual([[autre, tissu]]);
   });
 
   it('un mesh de zone est masqué par un élément de couche plus extérieure qui couvre sa zone, pas par un de même couche', () => {
@@ -68,4 +73,41 @@ describe('traversee', () => {
     expect(montre([torse, bras, libre], 1)).toEqual([torse, libre]);
     expect(montre([torse, bras, libre], 2)).toEqual([torse, bras, libre]);
   });
+
+  describe('masquage des couches couvertes', () => {
+    const large = maillage(SkinnedMesh, nappe(-0.15, 0.15, -0.15, 0.15, 0.01));
+    large.name = 'large';
+    const sous = (z: number) => lierLesCouches([peau], [{ rang: 1, meshes: [large] }], { positions: new Map<Mesh, Float32Array>([[peau, carre(z)], [large, nappe(-0.15, 0.15, -0.15, 0.15, 0.01)]]) });
+
+    it('une nappe entièrement sous une couverture plus large, derrière ou la perçant de moins de la portée, est masquée et ne traverse plus', () => {
+      for (const z of [0, 0.015]) {
+        const liees = sous(z);
+        expect(liees.masques.get(peau)).toBe(8);
+        expect(liees.traversee).toEqual([]);
+        expect(liees.decouverte.map((l) => [l.sujet, l.couverture, l.sommets.length])).toEqual([[peau, large, 9]]);
+      }
+      const devant = new Map<Mesh, Float32Array>([[peau, carre(0.04)], [large, nappe(-0.15, 0.15, -0.15, 0.15, 0.01)]]);
+      expect(mesurerTraversee(sous(0).traversee, echantillon(devant))).toEqual([]);
+    });
+
+    it('une nappe qui dépasse le bord de sa couverture garde visibles ses triangles du bord, et leurs sommets couverts en traversée', () => {
+      const etroite = maillage(SkinnedMesh, nappe(-0.15, 0.05, -0.15, 0.15, 0.01));
+      const liees = lierLesCouches([peau], [{ rang: 1, meshes: [etroite] }], { positions: new Map<Mesh, Float32Array>([[peau, carre(0)], [etroite, nappe(-0.15, 0.05, -0.15, 0.15, 0.01)]]) });
+      expect(liees.masques.get(peau)).toBe(4);
+      expect([...liees.decouverte[0].sommets]).toEqual([0, 3, 6]);
+      expect([...liees.traversee[0].sommets]).toEqual([1, 4, 7]);
+    });
+
+    it('VERT : la couverture glisse dans sa demi-arête ; ROUGE : elle s\'écarte latéralement, ou s\'envole, un écart à son pire instant', () => {
+      const { decouverte } = sous(0);
+      const pose = (dx: number, dz = 0) => new Map<Mesh, Float32Array>([[peau, carre(0)], [large, decaler(nappe(-0.15, 0.15, -0.15, 0.15, 0.01), dz, dx)]]);
+      expect(mesurerDecouverte(decouverte, echantillon(pose(0.05)))).toEqual([]);
+      const mesures = [0.15, 0.25].flatMap((dx, k) => mesurerDecouverte(decouverte, echantillon(pose(dx), k)));
+      const ecarts = gardeDecouverte(mesures, libelle);
+      expect(ecarts).toHaveLength(1);
+      expect(ecarts[0]).toMatchObject({ garde: 'traversee', code: 'couche-decouverte', mesh: 'large', clip: 'Coup', t: 1, seuil: 0 });
+      expect(ecarts[0].valeur).toBeCloseTo(0.25 - ECART_DE_SUIVI_M - Math.hypot(0.15, 0.15) / 2, 6);
+      expect(mesurerDecouverte(decouverte, echantillon(pose(0, 2.5 * PORTEE_DE_COUVERTURE_M)))[0].pire).toBeCloseTo(0.5 * PORTEE_DE_COUVERTURE_M + 0.01, 6);
+    });
+  });
 });
diff --git a/hotes/godot/asset/evaluateur/gardes/traversee.ts b/hotes/godot/asset/evaluateur/gardes/traversee.ts
index 615cb48d8..5e2245327 100644
--- a/hotes/godot/asset/evaluateur/gardes/traversee.ts
+++ b/hotes/godot/asset/evaluateur/gardes/traversee.ts
@@ -11,6 +11,15 @@
  * ne couvre rien. À chaque échantillon, l'écart signé e(v) = (p − v)·n, n la normale du triangle posé :
  * `couche-traversee` si un sommet a e(v) < −`ECART_DE_SUIVI_M`, un écart par (sujet, couverture, clip), à son pire
  * instant. Un sommet devant sa couverture dès le repos n'est lié à rien : il relève du montage, pas du mouvement.
+ *
+ * Masquage des couches couvertes (#3842) : au repos, un sommet d'un sujet est couvert par un mesh d'élément de couche
+ * plus extérieure s'il a sous lui un triangle de ce mesh tourné du même côté, sa projection dans le triangle, à un écart
+ * signé |e| ≤ `PORTEE_DE_COUVERTURE_M`, derrière ou devant. Un triangle du sujet dont les trois sommets sont couverts,
+ * par un ou plusieurs meshes, est masqué : non dessiné, il ne traverse rien. Un sommet dont tous les triangles sont
+ * masqués est caché : il sort des liaisons de `couche-traversee` et se lie à sa couverture la plus proche en |e|. À
+ * chaque échantillon, un sommet caché est découvert si sa projection sur le plan du triangle lié posé s'éloigne du point
+ * lié de plus de `ECART_DE_SUIVI_M` plus la demi-plus-grande arête de ce triangle au repos, ou si e dépasse
+ * 2·`PORTEE_DE_COUVERTURE_M` : `couche-decouverte`, un écart par (sujet, couverture, clip), à son pire instant.
  */
 import { Triangle, Vector3, type Mesh, type SkinnedMesh } from 'three';
 import type { Ecart, LibelleDeMesh } from '../ecart.ts';
@@ -33,15 +42,6 @@ export interface LiaisonDeCouches {
   readonly barycentres: Float32Array;
 }
 
-export interface TraverseeDUnEchantillon {
-  readonly liaison: LiaisonDeCouches;
-  readonly clip: string;
-  readonly t: number;
-  /** Le nombre de sommets au-delà de la tolérance, et l'écart signé le plus négatif. */
-  readonly sommets: number;
-  readonly pire: number;
-}
-
 const positionsDe = (pose: Pick<Pose, 'positions'>, m: Mesh): Float32Array => {
   const p = pose.positions.get(m);
   if (!p) throw new Error(`${GARDE} : mesh absent ${m.name}`);
@@ -98,17 +98,36 @@ function normalesDe(m: Mesh, p: Float32Array): Float32Array {
   return normales;
 }
 
-/** La liaison de `sujet` sous `couverture` dans la pose `repos`, ou `null` si aucun sommet n'est couvert. */
-export function lierSous(sujet: Mesh, couverture: SkinnedMesh, repos: Pick<Pose, 'positions'>): LiaisonDeCouches | null {
-  const ps = positionsDe(repos, sujet), pc = positionsDe(repos, couverture);
-  const ns = normalesDe(sujet, ps);
-  const indices = indicesDe(couverture, pc.length / 3);
-  const grille = grilleDe(pc, indices);
-  const sommets: number[] = [], triangles: number[] = [], barycentres: number[] = [];
+/** Un mesh d'élément au repos, prêt à couvrir : ses positions, ses indices et sa grille (`grilleDe`). */
+interface Cible {
+  readonly mesh: SkinnedMesh;
+  readonly p: Float32Array;
+  readonly indices: ArrayLike<number>;
+  readonly grille: Map<string, number[]>;
+}
+
+function cibleDe(mesh: SkinnedMesh, repos: Pick<Pose, 'positions'>): Cible {
+  const p = positionsDe(repos, mesh), indices = indicesDe(mesh, p.length / 3);
+  return { mesh, p, indices, grille: grilleDe(p, indices) };
+}
+
+/** Les sommets liés d'un sujet sous une cible, l'écart signé de chacun au repos. */
+interface Liens {
+  readonly sommets: number[];
+  readonly triangles: number[];
+  readonly barycentres: number[];
+  readonly ecarts: number[];
+}
+
+/** Chaque sommet du sujet (positions `ps`, normales `ns`) lié au triangle de `cible` le plus proche en |e| dont l'écart
+ *  signé e est `dedans`, tourné du même côté, sa projection dans le triangle. */
+function lier(ps: Float32Array, ns: Float32Array, cible: Cible, dedans: (e: number) => boolean): Liens {
+  const { p: pc, indices, grille } = cible;
+  const liens: Liens = { sommets: [], triangles: [], barycentres: [], ecarts: [] };
   for (let s = 0; s < ps.length / 3; s++) {
     v.set(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2]);
     const [nx, ny, nz] = [ns[s * 3], ns[s * 3 + 1], ns[s * 3 + 2]];
-    let retenu = -1, distance = Infinity, bx = 0, by = 0, bz = 0;
+    let retenu = -1, distance = Infinity, ecart = 0, bx = 0, by = 0, bz = 0;
     const [ci, cj, ck] = [cellule(v.x), cellule(v.y), cellule(v.z)];
     const vus = new Set<number>();
     for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
@@ -117,19 +136,31 @@ export function lierSous(sujet: Mesh, couverture: SkinnedMesh, repos: Pick<Pose,
         vus.add(t);
         if (!poserTriangle(pc, indices[t], indices[t + 1], indices[t + 2]) || normale.x * nx + normale.y * ny + normale.z * nz <= 0) continue;
         const e = projection.subVectors(forme.a, v).dot(normale);
-        if (e <= 0 || e > PORTEE_DE_COUVERTURE_M || e >= distance) continue;
+        if (!dedans(e) || Math.abs(e) >= distance) continue;
         projection.copy(v).addScaledVector(normale, e);
         if (!forme.getBarycoord(projection, coordonnees) || coordonnees.x < 0 || coordonnees.y < 0 || coordonnees.z < 0) continue;
-        retenu = t; distance = e; bx = coordonnees.x; by = coordonnees.y; bz = coordonnees.z;
+        retenu = t; distance = Math.abs(e); ecart = e; bx = coordonnees.x; by = coordonnees.y; bz = coordonnees.z;
       }
     }
     if (retenu < 0) continue;
-    sommets.push(s);
-    triangles.push(indices[retenu], indices[retenu + 1], indices[retenu + 2]);
-    barycentres.push(bx, by, bz);
+    liens.sommets.push(s);
+    liens.triangles.push(indices[retenu], indices[retenu + 1], indices[retenu + 2]);
+    liens.barycentres.push(bx, by, bz);
+    liens.ecarts.push(ecart);
   }
-  if (!sommets.length) return null;
-  return { sujet, couverture, sommets: Uint32Array.from(sommets), triangles: Uint32Array.from(triangles), barycentres: Float32Array.from(barycentres) };
+  return liens;
+}
+
+const derriere = (e: number): boolean => e > 0 && e <= PORTEE_DE_COUVERTURE_M;
+const aPortee = (e: number): boolean => Math.abs(e) <= PORTEE_DE_COUVERTURE_M;
+
+const liaison = (sujet: Mesh, couverture: SkinnedMesh, { sommets, triangles, barycentres }: Pick<Liens, 'sommets' | 'triangles' | 'barycentres'>): LiaisonDeCouches | null =>
+  sommets.length ? { sujet, couverture, sommets: Uint32Array.from(sommets), triangles: Uint32Array.from(triangles), barycentres: Float32Array.from(barycentres) } : null;
+
+/** La liaison de `sujet` sous `couverture` dans la pose `repos`, ou `null` si aucun sommet n'est couvert. */
+export function lierSous(sujet: Mesh, couverture: SkinnedMesh, repos: Pick<Pose, 'positions'>): LiaisonDeCouches | null {
+  const ps = positionsDe(repos, sujet);
+  return liaison(sujet, couverture, lier(ps, normalesDe(sujet, ps), cibleDe(couverture, repos), derriere));
 }
 
 /** Par zone, le rang le plus extérieur des éléments de `elements` qui la couvrent ; rend les meshes d'un rang donné
@@ -149,43 +180,161 @@ export interface CoucheDElement {
   readonly meshes: readonly SkinnedMesh[];
 }
 
-/** Les liaisons au repos du corps sous chaque élément, et de chaque élément sous ceux de couche plus extérieure. */
-export function lierLesCouches(corps: readonly Mesh[], elements: readonly CoucheDElement[], repos: Pick<Pose, 'positions'>): LiaisonDeCouches[] {
-  return elements.flatMap(({ rang, meshes }) => {
-    const sujets = [...corps, ...elements.filter((e) => e.rang < rang).flatMap((e) => e.meshes)];
-    return meshes.flatMap((couverture) => sujets.flatMap((sujet) => lierSous(sujet, couverture, repos) ?? []));
-  });
+/** Une liaison de sommets cachés à leur couverture la plus proche, et pour chacun la demi-plus-grande arête au repos
+ *  du triangle lié. */
+export interface LiaisonDeCouverture extends LiaisonDeCouches {
+  readonly demiAretes: Float32Array;
+}
+
+export interface CouchesLiees {
+  /** Les liaisons de `couche-traversee`, sans les sommets cachés. */
+  readonly traversee: readonly LiaisonDeCouches[];
+  /** Les liaisons de `couche-decouverte`, une par (sujet, couverture) qui cache au moins un sommet. */
+  readonly decouverte: readonly LiaisonDeCouverture[];
+  /** Le nombre de triangles masqués de chaque sujet qui en a. */
+  readonly masques: ReadonlyMap<Mesh, number>;
 }
 
-/** La traversée de chaque liaison dans l'échantillon `e` ; une liaison sans sommet au-delà de la tolérance n'y figure pas. */
-export function mesurerTraversee(liaisons: readonly LiaisonDeCouches[], e: Echantillon): TraverseeDUnEchantillon[] {
+/** Les liens de rangs `rangs` parmi `liens`. */
+const choisir = (liens: Liens, rangs: readonly number[]): Pick<Liens, 'sommets' | 'triangles' | 'barycentres'> => ({
+  sommets: rangs.map((i) => liens.sommets[i]),
+  triangles: rangs.flatMap((i) => liens.triangles.slice(i * 3, i * 3 + 3)),
+  barycentres: rangs.flatMap((i) => liens.barycentres.slice(i * 3, i * 3 + 3)),
+});
+
+const demiAreteDe = (p: Float32Array, a: number, b: number, c: number): number => {
+  const d = (i: number, j: number) => Math.hypot(p[i * 3] - p[j * 3], p[i * 3 + 1] - p[j * 3 + 1], p[i * 3 + 2] - p[j * 3 + 2]);
+  return Math.max(d(a, b), d(b, c), d(c, a)) / 2;
+};
+
+/** Au repos, le corps sous chaque élément, et chaque élément sous ceux de couche plus extérieure : les liaisons de
+ *  traversée, le masquage et les liaisons des sommets cachés. */
+export function lierLesCouches(corps: readonly Mesh[], elements: readonly CoucheDElement[], repos: Pick<Pose, 'positions'>): CouchesLiees {
+  const cibles = new Map(elements.flatMap((e) => e.meshes).map((m) => [m, cibleDe(m, repos)]));
+  const sujets = [...corps.map((mesh) => ({ rang: RANG_DU_CORPS, mesh })), ...elements.flatMap(({ rang, meshes }) => meshes.map((mesh) => ({ rang, mesh })))];
+  const traversee: LiaisonDeCouches[] = [], decouverte: LiaisonDeCouverture[] = [];
+  const masques = new Map<Mesh, number>();
+  for (const { rang, mesh: sujet } of sujets) {
+    const couvertures = elements.filter((e) => e.rang > rang).flatMap((e) => e.meshes).map((m) => cibles.get(m) as Cible);
+    if (!couvertures.length) continue;
+    const ps = positionsDe(repos, sujet), ns = normalesDe(sujet, ps);
+    const n = ps.length / 3;
+    const plusProche = new Float64Array(n).fill(Infinity), choix = new Int32Array(n).fill(-1), rangDuLien = new Int32Array(n);
+    const derrieres = couvertures.map((c) => lier(ps, ns, c, derriere));
+    const couverts = couvertures.map((c, k) => {
+      const liens = lier(ps, ns, c, aPortee);
+      liens.sommets.forEach((s, i) => {
+        if (Math.abs(liens.ecarts[i]) >= plusProche[s]) return;
+        plusProche[s] = Math.abs(liens.ecarts[i]); choix[s] = k; rangDuLien[s] = i;
+      });
+      return liens;
+    });
+    const indices = indicesDe(sujet, n);
+    const visibles = new Uint8Array(n), utilises = new Uint8Array(n);
+    let masquesDuSujet = 0;
+    for (let t = 0; t + 2 < indices.length; t += 3) {
+      const sommets = [indices[t], indices[t + 1], indices[t + 2]];
+      for (const s of sommets) utilises[s] = 1;
+      if (sommets.every((s) => choix[s] >= 0)) masquesDuSujet++;
+      else for (const s of sommets) visibles[s] = 1;
+    }
+    if (masquesDuSujet) masques.set(sujet, masquesDuSujet);
+    const cache = (s: number): boolean => utilises[s] === 1 && visibles[s] === 0;
+    const cachesPar = couvertures.map((): number[] => []);
+    for (let s = 0; s < n; s++) if (cache(s)) cachesPar[choix[s]].push(s);
+    couvertures.forEach((c, k) => {
+      const lie = liaison(sujet, c.mesh, choisir(derrieres[k], derrieres[k].sommets.flatMap((s, i) => (cache(s) ? [] : [i]))));
+      if (lie) traversee.push(lie);
+      const lieCachee = liaison(sujet, c.mesh, choisir(couverts[k], cachesPar[k].map((s) => rangDuLien[s])));
+      if (lieCachee) decouverte.push({ ...lieCachee, demiAretes: Float32Array.from(lieCachee.sommets, (_, i) => demiAreteDe(c.p, lieCachee.triangles[i * 3], lieCachee.triangles[i * 3 + 1], lieCachee.triangles[i * 3 + 2])) });
+    });
+  }
+  return { traversee, decouverte, masques };
+}
+
+/** Ce qu'une garde des couches mesure d'une liaison dans un échantillon. */
+export interface MesureDesCouches<L extends LiaisonDeCouches = LiaisonDeCouches> {
+  readonly liaison: L;
+  readonly clip: string;
+  readonly t: number;
+  /** Le nombre de sommets au-delà de la tolérance. */
+  readonly sommets: number;
+  /** En traversée, l'écart signé le plus négatif ; en découverte, le plus grand dépassement. */
+  readonly pire: number;
+}
+
+/** Pose le triangle lié du i-ième sommet de `liaison` aux positions `pc` de sa couverture : `projection` reçoit le point
+ *  lié, `normale` la normale du triangle ; faux sur un triangle dégénéré. */
+function poserLePointLie(liaison: LiaisonDeCouches, i: number, pc: Float32Array): boolean {
+  if (!poserTriangle(pc, liaison.triangles[i * 3], liaison.triangles[i * 3 + 1], liaison.triangles[i * 3 + 2])) return false;
+  const [u, w, x] = [liaison.barycentres[i * 3], liaison.barycentres[i * 3 + 1], liaison.barycentres[i * 3 + 2]];
+  projection.set(0, 0, 0).addScaledVector(forme.a, u).addScaledVector(forme.b, w).addScaledVector(forme.c, x);
+  return true;
+}
+
+/** La mesure de chaque liaison de `liaisons` dans l'échantillon `e` : `exces` rend, pour le i-ième sommet lié, le point
+ *  lié dans `projection`, le sommet posé dans `v` et la normale dans `normale`, son dépassement s'il est hors tolérance
+ *  (plus grand est pire), sinon `null`. Une liaison sans sommet hors tolérance n'y figure pas. */
+function mesurer<L extends LiaisonDeCouches>(liaisons: readonly L[], e: Echantillon, exces: (liaison: L, i: number) => number | null, pire: (a: number, b: number) => number): MesureDesCouches<L>[] {
   return liaisons.flatMap((liaison) => {
     const ps = positionsDe(e, liaison.sujet), pc = positionsDe(e, liaison.couverture);
-    let sommets = 0, pire = 0;
+    let sommets = 0, auPire = 0;
     liaison.sommets.forEach((s, i) => {
-      const [a, b, c] = [liaison.triangles[i * 3], liaison.triangles[i * 3 + 1], liaison.triangles[i * 3 + 2]];
-      if (!poserTriangle(pc, a, b, c)) return;
-      const [u, w, x] = [liaison.barycentres[i * 3], liaison.barycentres[i * 3 + 1], liaison.barycentres[i * 3 + 2]];
-      projection.set(0, 0, 0).addScaledVector(forme.a, u).addScaledVector(forme.b, w).addScaledVector(forme.c, x);
-      const ecart = projection.sub(v.set(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2])).dot(normale);
-      if (ecart >= -ECART_DE_SUIVI_M) return;
+      if (!poserLePointLie(liaison, i, pc)) return;
+      v.set(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2]);
+      const d = exces(liaison, i);
+      if (d === null) return;
+      auPire = sommets ? pire(auPire, d) : d;
       sommets++;
-      pire = Math.min(pire, ecart);
     });
-    return sommets ? [{ liaison, clip: e.clip, t: e.t, sommets, pire }] : [];
+    return sommets ? [{ liaison, clip: e.clip, t: e.t, sommets, pire: auPire }] : [];
   });
 }
 
-/** Un écart par (sujet, couverture, clip), à l'instant de son écart signé le plus négatif. */
-export function gardeTraversee(mesures: readonly TraverseeDUnEchantillon[], libelle: LibelleDeMesh): Ecart[] {
-  const pires = new Map<string, TraverseeDUnEchantillon>();
+/** La traversée de chaque liaison dans l'échantillon `e`. */
+export function mesurerTraversee(liaisons: readonly LiaisonDeCouches[], e: Echantillon): MesureDesCouches[] {
+  return mesurer(liaisons, e, () => {
+    const ecart = projection.sub(v).dot(normale);
+    return ecart < -ECART_DE_SUIVI_M ? ecart : null;
+  }, Math.min);
+}
+
+/** La découverte de chaque liaison de sommets cachés dans l'échantillon `e` : le dépassement d'un sommet est le plus
+ *  grand de son écart latéral au-delà de `ECART_DE_SUIVI_M` plus sa demi-arête, et de son écart signé au-delà de
+ *  2·`PORTEE_DE_COUVERTURE_M`. */
+export function mesurerDecouverte(liaisons: readonly LiaisonDeCouverture[], e: Echantillon): MesureDesCouches<LiaisonDeCouverture>[] {
+  return mesurer(liaisons, e, (liaison, i) => {
+    const d = v.sub(projection);
+    const ecart = -d.dot(normale);
+    const laterale = d.addScaledVector(normale, ecart).length();
+    const depassement = Math.max(laterale - ECART_DE_SUIVI_M - liaison.demiAretes[i], ecart - 2 * PORTEE_DE_COUVERTURE_M);
+    return depassement > 0 ? depassement : null;
+  }, Math.max);
+}
+
+/** Un écart par (sujet, couverture, clip), à l'instant de la mesure la plus grave selon `gravite`. */
+function auPireInstant<L extends LiaisonDeCouches>(mesures: readonly MesureDesCouches<L>[], libelle: LibelleDeMesh, gravite: (m: MesureDesCouches<L>) => number): MesureDesCouches<L>[] {
+  const pires = new Map<string, MesureDesCouches<L>>();
   for (const m of mesures) {
     const k = `${libelle(m.liaison.sujet)}|${libelle(m.liaison.couverture)}|${m.clip}`;
     const avant = pires.get(k);
-    if (!avant || m.pire < avant.pire) pires.set(k, m);
+    if (!avant || gravite(m) > gravite(avant)) pires.set(k, m);
   }
-  return [...pires.values()].map((m): Ecart => ({
+  return [...pires.values()];
+}
+
+/** Un écart `couche-traversee` par (sujet, couverture, clip), à l'instant de son écart signé le plus négatif. */
+export function gardeTraversee(mesures: readonly MesureDesCouches[], libelle: LibelleDeMesh): Ecart[] {
+  return auPireInstant(mesures, libelle, (m) => -m.pire).map((m): Ecart => ({
     garde: GARDE, code: 'couche-traversee', mesh: libelle(m.liaison.couverture), clip: m.clip, t: m.t, valeur: m.pire, seuil: -ECART_DE_SUIVI_M,
     detail: `${m.sommets} sommet(s) de ${libelle(m.liaison.sujet)}, sur ${m.liaison.sommets.length} couverts, passent devant la couverture : écart signé le plus négatif, en m`,
   }));
 }
+
+/** Un écart `couche-decouverte` par (sujet, couverture, clip), à l'instant de son plus grand dépassement. */
+export function gardeDecouverte(mesures: readonly MesureDesCouches<LiaisonDeCouverture>[], libelle: LibelleDeMesh): Ecart[] {
+  return auPireInstant(mesures, libelle, (m) => m.pire).map((m): Ecart => ({
+    garde: GARDE, code: 'couche-decouverte', mesh: libelle(m.liaison.couverture), clip: m.clip, t: m.t, valeur: m.pire, seuil: 0,
+    detail: `${m.sommets} sommet(s) caché(s) de ${libelle(m.liaison.sujet)}, sur ${m.liaison.sommets.length}, sortent de leur couverture : plus grand dépassement, en m`,
+  }));
+}
diff --git a/hotes/godot/asset/evaluer.mjs b/hotes/godot/asset/evaluer.mjs
index 0cacbbadc..f74ec8695 100644
--- a/hotes/godot/asset/evaluer.mjs
+++ b/hotes/godot/asset/evaluer.mjs
@@ -122,8 +122,9 @@ const entree = {
 }
 
 function afficherFiche(fiche) {
-  const { triangles, sommets, os, images, corps, clips } = fiche.mesures
+  const { triangles, masques, sommets, os, images, corps, clips } = fiche.mesures
   console.log(`${triangles.total} triangles (${triangles.parMesh.map(({ mesh, triangles: t }) => `${mesh} ${t}`).join(', ')}), ${sommets} sommets, ${os} os, ${images} image(s) ; corps : ${corps.join(', ') || 'aucun'}`)
+  if (masques.length) console.log(`triangles masqués : ${masques.map(({ mesh, triangles: t }) => `${mesh} ${t}/${triangles.parMesh.find((p) => p.mesh === mesh).triangles}`).join(', ')}`)
   for (const c of clips) {
     console.log(`clip ${c.nom} : ${c.duree.toFixed(3)} s, ${c.echantillons} échantillon(s), sommet le plus bas ${c.plusBas.min.toFixed(4)} à ${c.plusBas.max.toFixed(4)} m`)
     if (c.appuis) {
````
