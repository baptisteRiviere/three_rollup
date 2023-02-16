import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controller;

init();
animate();

function init() {

  // CONTAINER - SCENE - CAMERA

  const container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // LIGHT

  var hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3);
  hemiLight.position.set(0, 300, 0);
  scene.add(hemiLight);

  // RENDERER

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  // SPECIFICS TO BUCKET GAME

  const STEPS_PER_FRAME = 5;
  let playerCollider;
  let playerDirection = new THREE.Vector3();
  let targetCollider;
  let message = document.getElementById("message");

  const GRAVITY = 60;
  const CAMERA_HEIGHT = 5;
  const BUCKET_POSITION = new THREE.Vector3(0, -2, -6)
  const TARGET_SPHERE_RADIUS = 1.2;
  let IMPULSE = 30;

  // BUTTON

  document.body.appendChild(ARButton.createButton(renderer));

  // LOADING OBJECTS

  let loader = new GLTFLoader().setPath('assets/models/');

  const bucketLoadingPromise = new Promise((resolve, reject) => {
    loader.load('myBucket.glb', (gltf) => {
      let model = null;
      model = gltf.scene;
      if (model != null) {
        resolve(model);
      } else {
        reject("load Failed");
      }
    })
  })
    .then(bucket => {
      const x = BUCKET_POSITION.x;
      const y = BUCKET_POSITION.y;
      const z = BUCKET_POSITION.z;
      bucket.position.set(x, y, z);
      //worldOctree.fromGraphNode(bucket);
      camera.lookAt(x, y, z);
      targetCollider = new THREE.Sphere(BUCKET_POSITION, TARGET_SPHERE_RADIUS);
      scene.add(bucket);
    })

  // SPECIFICS TO THREE EXAMPLE

  const geometry = new THREE.CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2);

  function onSelect() {

    const material = new THREE.MeshPhongMaterial({ color: 0xffffff * Math.random() });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, - 0.3).applyMatrix4(controller.matrixWorld);
    mesh.quaternion.setFromRotationMatrix(controller.matrixWorld);
    scene.add(mesh);

  }

  controller = renderer.xr.getController(0); // click on phone
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  // 

  window.addEventListener('resize', onWindowResize);

}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

}

//

function animate() {

  renderer.setAnimationLoop(render);

}

function render() {

  renderer.render(scene, camera);

}
