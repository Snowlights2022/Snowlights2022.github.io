/**
 * STEP File Viewer for Jekyll/GitHub Pages
 * Uses Three.js + occt-import-js to render .step/.stp 3D models
 * with interactive orbit controls (drag to rotate, scroll to zoom).
 */
(function () {
  'use strict';

  // Global OCCT instance (loaded once)
  let occtInstance = null;

  /**
   * Initialize the OCCT import module
   */
  async function getOcct() {
    if (occtInstance) return occtInstance;
    occtInstance = await OcctImportJs();
    return occtInstance;
  }

  /**
   * Load a STEP file and return the parsed result
   */
  async function loadStepFile(url) {
    const occt = await getOcct();
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();
    const fileBuffer = new Uint8Array(buffer);
    const result = occt.ReadStepFile(fileBuffer, null);
    return result;
  }

  /**
   * Create Three.js mesh from OCCT result
   */
  function createMeshFromResult(result) {
    const group = new THREE.Group();

    for (let meshIndex = 0; meshIndex < result.meshes.length; meshIndex++) {
      const mesh = result.meshes[meshIndex];

      const geometry = new THREE.BufferGeometry();

      // Vertices
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(mesh.attributes.position.array, 3)
      );

      // Normals
      if (mesh.attributes.normal) {
        geometry.setAttribute(
          'normal',
          new THREE.Float32BufferAttribute(mesh.attributes.normal.array, 3)
        );
      }

      // Index
      if (mesh.index) {
        geometry.setIndex(new THREE.BufferAttribute(mesh.index.array, 1));
      }

      // Color
      let material;
      if (mesh.color) {
        const color = new THREE.Color(mesh.color[0], mesh.color[1], mesh.color[2]);
        material = new THREE.MeshPhongMaterial({
          color: color,
          side: THREE.DoubleSide,
        });
      } else {
        material = new THREE.MeshPhongMaterial({
          color: 0xb0b0b0,
          side: THREE.DoubleSide,
        });
      }

      const threeMesh = new THREE.Mesh(geometry, material);
      group.add(threeMesh);
    }

    return group;
  }

  /**
   * Center and scale the model to fit the view
   */
  function centerAndScale(group) {
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim === 0) return;

    group.position.sub(center);
    const scale = 3 / maxDim;
    group.scale.multiplyScalar(scale);
  }

  /**
   * Initialize a STEP viewer for a given container element
   */
  async function initStepViewer(container) {
    const src = container.dataset.src;
    if (!src) {
      console.error('Step viewer: missing data-src attribute');
      return;
    }

    const canvasWrapper = container.querySelector('.step-canvas-wrapper');
    const loadingEl = container.querySelector('.step-loading');
    const infoEl = container.querySelector('.step-info');

    // Create Three.js scene
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

    // Orbit controls
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enableZoom = true;
    controls.enablePan = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 2.0;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 7);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, -3, -5);
    scene.add(directionalLight2);

    // Grid helper
    const gridHelper = new THREE.GridHelper(10, 20, 0xcccccc, 0xeeeeee);
    scene.add(gridHelper);

    // Animation loop
    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      const width = canvasWrapper.clientWidth;
      const height = canvasWrapper.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    resizeObserver.observe(canvasWrapper);

    // Load STEP file
    try {
      loadingEl.textContent = 'Loading 3D model...';
      const result = await loadStepFile(src);
      const modelGroup = createMeshFromResult(result);
      centerAndScale(modelGroup);
      scene.add(modelGroup);

      // Update info
      const meshCount = result.meshes.length;
      if (infoEl) {
        infoEl.textContent = `${meshCount} mesh${meshCount !== 1 ? 'es' : ''} loaded`;
      }

      // Hide loading
      loadingEl.style.display = 'none';

      // Store reference for controls
      container._modelGroup = modelGroup;
      container._controls = controls;
      container._camera = camera;
    } catch (err) {
      loadingEl.textContent = 'Failed to load 3D model: ' + err.message;
      loadingEl.style.color = '#c00';
      console.error('Step viewer error:', err);
    }
  }

  /**
   * Button handlers
   */
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

  /**
   * Initialize all step viewers on the page
   */
  function initAllStepViewers() {
    const containers = document.querySelectorAll('.step-viewer-container');
    containers.forEach((container) => {
      initStepViewer(container);
      setupControls(container);
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllStepViewers);
  } else {
    initAllStepViewers();
  }
})();
