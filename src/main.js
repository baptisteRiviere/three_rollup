import * as THREE from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Stats } from 'three/examples/jsm/libs/stats.module.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { OctreeHelper } from 'three//examples/jsm/helpers/OctreeHelper.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';


// INIT

const scene = new THREE.Scene();
const worldOctree = new Octree();
const STEPS_PER_FRAME = 5;
let playerCollider;
let playerDirection = new THREE.Vector3();
let targetCollider;
let message = document.getElementById("message");

// PARAMETERS INITIALISATION

const GRAVITY = 60;
const CAMERA_HEIGHT = 5;
const BUCKET_POSITION = new THREE.Vector3(2, 0.8, -6)
const TARGET_SPHERE_RADIUS = 1.2;

let IMPULSE = 30;

// CAMERA

const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);

// RENDERER

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// LIGHTS AND BACKGROUND

var hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3);
hemiLight.position.set(0, 300, 0);
scene.add(hemiLight);

var dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(75, 300, -75);
scene.add(dirLight);

scene.fog = new THREE.Fog(0xffffff, 0.015, 100);
scene.background = new THREE.Color(0x87CEEB)

// CONTROLS

const controlsTypes = {
  ORBIT: "orbit",
  POINTERLOCK: "pointerLock"
};

let controlsType = controlsTypes.POINTERLOCK;
let controls;

if (controlsType === controlsTypes.ORBIT) {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.listenToKeyEvents(window);
} else if (controlsType === controlsTypes.POINTERLOCK) {
  controls = new PointerLockControls(camera, renderer.domElement);
  controls.lock();
  controls.addEventListener('lock', function () { menuPanel.style.display = 'none'; });
  controls.addEventListener('unlock', function () { menuPanel.style.display = 'block'; });
} else {
  console.log("erreur: controls non défini")
}

// MENU PANEL

const menuPanel = document.getElementById('menuPanel');
const startButton = document.getElementById('startButton');
startButton.addEventListener('click', function () {
  if (controlsType === controlsTypes.ORBIT) {
    menuPanel.style.display = 'none';
  } else if (controlsType === controlsTypes.POINTERLOCK) {
    controls.lock()
  }
}, false)

// LOADER

let loader = new GLTFLoader().setPath('assets/models/');

// LOADING BUCKET

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
    worldOctree.fromGraphNode(bucket);
    camera.lookAt(x, y, z);
    targetCollider = new THREE.Sphere(BUCKET_POSITION, TARGET_SPHERE_RADIUS);
    scene.add(bucket);
  })


// LOADING GARDEN

const gardenLoadingPromise = new Promise((resolve, reject) => {
  loader.load('garden.glb', (gltf) => {
    let model = null;
    model = gltf.scene;
    if (model != null) {
      resolve(model);
    } else {
      reject("load Failed");
    }
  })
})
  .then(garden => {
    let root = garden.getObjectByName('gardengltf').getObjectByName('gardenglb').getObjectByName('Sketchfab_model').getObjectByName('Root');
    let ground = root.getObjectByName('Ground').getObjectByName('Ground_0');
    worldOctree.fromGraphNode(garden);
    scene.add(garden);
  })

// OBJECT MANAGEMENT

const SPHERE_RADIUS = 0.2;

const sphereGeometry = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 5);
const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xbbbb44 });

const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphereMesh.castShadow = true;
sphereMesh.receiveShadow = true;
scene.add(sphereMesh);

let sphere = {
  mesh: sphereMesh,
  collider: new THREE.Sphere(new THREE.Vector3(3, 5, 2), SPHERE_RADIUS),
  velocity: new THREE.Vector3(),
  hold: true
};

// SPAWN INITIALISATION

function spawn(x, y, z) {
  // camera 
  camera.position.set(x, y, z);
  //camera.lookAt(bucket)
  // player collider
  let capsuleStart = new THREE.Vector3(0, -0.3, 0).add(camera.position);
  let capsuleEnd = new THREE.Vector3(0.3, -0.1, 0).add(camera.position);
  playerCollider = new Capsule(capsuleStart, capsuleEnd, 0.35);
  // object
  sphere.collider.center.set(x, y, z)
  sphere.mesh.position.copy(sphere.collider.center);
  sphere.hold = true;
}

// EVENT LISTENERS

let startTimer;
let endTimer;

document.addEventListener('mousedown', () => {
  startTimer = new Date();
});

document.addEventListener('mouseup', () => {
  endTimer = new Date()
  let mouseTime = endTimer - startTimer;
  IMPULSE = 15 + 200 * mouseTime * 0.0001;
  if (document.pointerLockElement !== null) throwBall();
});

// PHYSICS

function throwBall() {
  sphere.hold = false;
  camera.getWorldDirection(playerDirection);
  playerDirection.y += 0.5; // permit to give a smooth curve to the ball
  sphere.collider.center.copy(playerCollider.end).addScaledVector(playerDirection, playerCollider.radius * 1.5);
  sphere.velocity.copy(playerDirection).multiplyScalar(IMPULSE);
}

function updateSphere(deltaTime) {
  sphere.collider.center.addScaledVector(sphere.velocity, deltaTime);
  const result = worldOctree.sphereIntersect(sphere.collider);
  if (result) {
    sphere.velocity.addScaledVector(result.normal, - result.normal.dot(sphere.velocity) * 1.5);
    sphere.collider.center.add(result.normal.multiplyScalar(result.depth));
  } else {
    sphere.velocity.y -= GRAVITY * deltaTime;
  }
  const damping = Math.exp(- 1.5 * deltaTime) - 1;
  sphere.velocity.addScaledVector(sphere.velocity, damping);
  sphere.mesh.position.copy(sphere.collider.center);
}

function targetReached(target, object) {
  // checking if the target is reached by the object
  const d2 = target.center.distanceToSquared(object.collider.center);
  const r = target.radius + object.collider.radius;
  const r2 = r * r;
  return (d2 < r2);
}

function groundIntersected(object) {
  if (object.collider.center.y - object.collider.radius < 1) {
    let x = object.collider.center.x;
    let z = object.collider.center.z;
    spawn(x, CAMERA_HEIGHT, z);
  }
}

// CLOCK

const clock = new THREE.Clock();

// Main loop

const animation = () => {

  renderer.setAnimationLoop(animation); // requestAnimationFrame() replacement, compatible with XR 

  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;
  if (!sphere.hold) {
    updateSphere(deltaTime);
    groundIntersected(sphere);
  }

  //console.log(targetCollider);
  if (targetReached(targetCollider, sphere)) {
    spawn(2, 5, 5);
    controls.unlock()
    message.innerText = "Congratulations ! As I see you would have been the best bucketball player in the middle age. Play as you want !";
    menuPanel.style.display = 'block';
  };

  renderer.render(scene, camera);

};

// PLAYING

Promise.all([gardenLoadingPromise, bucketLoadingPromise])
  .then(result => {
    console.log(result);
    spawn(2, 5, 5);
    animation();
  })


