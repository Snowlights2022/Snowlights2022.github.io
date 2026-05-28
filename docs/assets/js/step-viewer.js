/**
 * STEP File Viewer for Jekyll/GitHub Pages
 * Uses Three.js (ES module) + occt-import-js to render .step/.stp 3D models
 * with interactive orbit controls (drag to rotate, scroll to zoom).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const OCCT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/occt-import-js/dist/';

// Global OCCT instance (loaded once)
let occtInstance = null;
let occtLoading = false;

/** Promise wrapper with timeout */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

/**
 * Load and initialize occt-import-js WASM module.
 * Passes locateFile so the WASM is fetched from the CDN explicitly.
 */
async function getOcct(onProgress) {
  if (occtInstance) return occtInstance;

  if (typeof window.occtimportjs !== 'function') {
    throw new Error('occt-import-js library not loaded. Check that the <script> tag is present.');
  }

  if (occtLoading) {
    // Another viewer is already loading – poll until ready
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 500));
      if (occtInstance) return occtInstance;
    }
    throw new Error('occt-import-js initialisation did not complete in time.');
  }

  occtLoading = true;
  onProgress?.('Loading OCCT WASM kernel (~7 MB)...');

  try {
    const module = await withTimeout(
      window.occtimportjs({
        locateFile: (file) => OCCT_CDN_BASE + file,
      }),
      60000,                       // 60-second hard timeout
      'OCCT WASM load'
    );
    occtInstance = module;
    return occtInstance;
  } finally {
    occtLoading = false;
  }
}

async function loadStepFile(url, onProgress) {
  onProgress?.('Downloading STEP file...');
  const occt = await getOcct(onProgress);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
  const buffer = await response.arrayBuffer();
  const fileBuffer = new Uint8Array(buffer);
  onProgress?.(`Parsing STEP file (${(fileBuffer.byteLength / 1048576).toFixed(1)} MB)...`);
  return occt.ReadStepFile(fileBuffer, null);
}

function createMeshFromResult(result) {
  const group = new THREE.Group();

  for (let i = 0; i < result.meshes.length; i++) {
    const mesh = result.meshes[i];
    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3)
    );

    if (mesh.attributes.normal) {
      geometry.setAttribute(
        'normal',
        new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3)
      );
    }

    if (mesh.index) {
      geometry.setIndex(new THREE.BufferAttribute(mesh.index.array, 1));
    }

    let material;
    if (mesh.color) {
      material = new THREE.MeshPhongMaterial({
        color: new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]),
        side: THREE.DoubleSide,
      });
    } else {
      material = new THREE.MeshPhongMaterial({
        color: 0xb0b0b0,
        side: THREE.DoubleSide,
      });
    }

    group.add(new THREE.Mesh(geometry, material));
  }

  return group;
}

function centerAndScale(group) {
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);

  if (maxDim === 0) return;

  group.position.sub(center);
  group.scale.multiplyScalar(3 / maxDim);
}

async function initStepViewer(container) {
  const src = container.dataset.src;
  if (!src) {
    console.error('Step viewer: missing data-src attribute');
    return;
  }

  const canvasWrapper = container.querySelector('.step-canvas-wrapper');
  const loadingEl = container.querySelector('.step-loading');
  const infoEl = container.querySelector('.step-info');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  const camera = new THREE.PerspectiveCamera(
    45,
    canvasWrapper.clientWidth / canvasWrapper.clientHeight,
    0.1,
    1000
  );
  camera.position.set(4, 3, 4);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(canvasWrapper.clientWidth, canvasWrapper.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  canvasWrapper.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 2.0;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight1.position.set(5, 10, 7);
  scene.add(dirLight1);

  const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
  dirLight2.position.set(-5, -3, -5);
  scene.add(dirLight2);

  scene.add(new THREE.GridHelper(10, 20, 0xcccccc, 0xeeeeee));

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  const resizeObserver = new ResizeObserver(() => {
    const width = canvasWrapper.clientWidth;
    const height = canvasWrapper.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resizeObserver.observe(canvasWrapper);

  try {
    loadingEl.textContent = 'Initializing...';
    const result = await loadStepFile(src, (msg) => { loadingEl.textContent = msg; });
    const modelGroup = createMeshFromResult(result);
    centerAndScale(modelGroup);
    scene.add(modelGroup);

    const meshCount = result.meshes.length;
    if (infoEl) {
      infoEl.textContent = `${meshCount} mesh${meshCount !== 1 ? 'es' : ''} loaded`;
    }
    loadingEl.style.display = 'none';

    container._modelGroup = modelGroup;
    container._controls = controls;
    container._camera = camera;
  } catch (err) {
    loadingEl.textContent = 'Failed to load 3D model: ' + err.message;
    loadingEl.style.color = '#c00';
    console.error('Step viewer error:', err);
  }
}

function setupControls(container) {
  const resetBtn = container.querySelector('.step-btn-reset');
  const autoRotateBtn = container.querySelector('.step-btn-autorotate');
  const wireframeBtn = container.querySelector('.step-btn-wireframe');

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (container._camera) {
        container._camera.position.set(4, 3, 4);
        container._camera.lookAt(0, 0, 0);
      }
      if (container._controls) {
        container._controls.reset();
      }
    });
  }

  if (autoRotateBtn) {
    let rotating = false;
    autoRotateBtn.addEventListener('click', () => {
      rotating = !rotating;
      if (container._controls) {
        container._controls.autoRotate = rotating;
      }
      autoRotateBtn.textContent = rotating ? '⏹ Stop Rotate' : '🔄 Auto Rotate';
    });
  }

  if (wireframeBtn) {
    let wireframe = false;
    wireframeBtn.addEventListener('click', () => {
      wireframe = !wireframe;
      if (container._modelGroup) {
        container._modelGroup.traverse((child) => {
          if (child.isMesh) {
            child.material.wireframe = wireframe;
          }
        });
      }
      wireframeBtn.textContent = wireframe ? '🔲 Solid' : '🔲 Wireframe';
    });
  }
}

function initAllStepViewers() {
  document.querySelectorAll('.step-viewer-container').forEach((container) => {
    initStepViewer(container);
    setupControls(container);
  });
}

// ES modules are deferred, so DOM is ready when this runs
initAllStepViewers();
