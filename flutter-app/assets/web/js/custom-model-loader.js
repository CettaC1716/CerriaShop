import * as THREE from 'three';

let gltfLoaderInstance = null;
let objLoaderInstance = null;
const modelCache = new Map();

async function getGltfLoader() {
  if (!gltfLoaderInstance) {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    gltfLoaderInstance = new GLTFLoader();
  }
  return gltfLoaderInstance;
}

async function getObjLoader() {
  if (!objLoaderInstance) {
    const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
    objLoaderInstance = new OBJLoader();
  }
  return objLoaderInstance;
}

/**
 * Loads a .glb, .gltf, or .obj 3D model from URL, normalizes its scale & center
 * so it fits cleanly on a Cerria Town product turntable, and attaches it to targetGroup.
 */
export async function loadNormalizedCustom3DModel(modelUrl, targetSize = 1.65) {
  if (!modelUrl) throw new Error('Empty modelUrl');

  const ext = modelUrl.split('?')[0].split('.').pop().toLowerCase();
  let sourceRoot;

  if (modelCache.has(modelUrl)) {
    sourceRoot = modelCache.get(modelUrl).clone(true);
  } else {
    if (ext === 'obj') {
      const loader = await getObjLoader();
      const obj = await new Promise((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject);
      });
      sourceRoot = obj;
    } else {
      const loader = await getGltfLoader();
      const gltf = await new Promise((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject);
      });
      sourceRoot = gltf.scene || gltf.scenes?.[0];
    }
    if (!sourceRoot) throw new Error('Invalid 3D scene in model');
    modelCache.set(modelUrl, sourceRoot.clone(true));
  }

  const wrapper = new THREE.Group();
  wrapper.name = 'CustomUploaded3DModel';

  sourceRoot.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (!child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: '#e2e8f0',
          roughness: 0.42,
          metalness: 0.15
        });
      }
    }
  });

  sourceRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sourceRoot);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = targetSize / maxDim;

  sourceRoot.scale.multiplyScalar(scale);
  sourceRoot.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

  const pedMat = new THREE.MeshStandardMaterial({ color: '#FAF3E8', roughness: 0.45, metalness: 0.08 });
  const rimMat = new THREE.MeshStandardMaterial({ color: '#E2B458', roughness: 0.28, metalness: 0.72 });
  const pedY = -(size.y * scale) / 2 - 0.06;
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.04, 0.1, 36), pedMat);
  baseDisc.position.y = pedY;
  const baseRim = new THREE.Mesh(new THREE.TorusGeometry(0.97, 0.022, 12, 48), rimMat);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = pedY + 0.05;

  wrapper.add(baseDisc, baseRim, sourceRoot);
  return wrapper;
}

/**
 * Replaces the procedural meshes inside a store turntable group with the custom uploaded 3D model.
 */
export function attachCustomModel3DToGroup(targetGroup, modelUrl, targetSize = 1.65) {
  if (!targetGroup || !modelUrl) return;
  const normalizedUrl = modelUrl.startsWith('/') ? `.${modelUrl}` : modelUrl;
  loadNormalizedCustom3DModel(normalizedUrl, targetSize)
    .then(customGroup => {
      while (targetGroup.children.length > 0) {
        targetGroup.remove(targetGroup.children[0]);
      }
      targetGroup.add(customGroup);
    })
    .catch(err => {
      console.warn('[Cerria 3D] Gagal memuat model 3D kustom, menggunakan model bawaan:', err);
    });
}
