import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';


// INIT SPECIFICS TO BUCKET GAME

let playerDirection = new THREE.Vector3();
let targetCollider;
const worldOctree = new Octree();

const STEPS_PER_FRAME = 2;
const SPHERE_RADIUS = 0.2;
const GRAVITY = 60;
const FLOOR_HEIGHT = -3;
const BUCKET_POSITION = new THREE.Vector3(0, FLOOR_HEIGHT, -8);
const TARGET_SPHERE_RADIUS = 1.2;
let IMPULSE = 30;
let NB_TRIES = 0;

// CONTAINER - SCENE - CAMERA - OCTREE

const container = document.createElement('div');
document.body.appendChild(container);
let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

// LIGHT

var hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3);
hemiLight.position.set(0, 300, 0);
scene.add(hemiLight);

// RENDERER

let renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
container.appendChild(renderer.domElement);

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
    worldOctree.fromGraphNode(bucket);
    targetCollider = new THREE.Sphere(BUCKET_POSITION, TARGET_SPHERE_RADIUS);
    scene.add(bucket);
  })

// SPHERE MANAGEMENT

const sphereGeometry = new THREE.IcosahedronGeometry(SPHERE_RADIUS, 5);
const sphereMaterial = new THREE.MeshLambertMaterial({ color: 0xbbbb44 });
const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
sphereMesh.castShadow = true;
sphereMesh.receiveShadow = true;
scene.add(sphereMesh);

let sphere = {
  mesh: sphereMesh,
  collider: new THREE.Sphere(new THREE.Vector3(3, 5, 2), SPHERE_RADIUS),
  velocity: new THREE.Vector3()
};

// CONTROLLER 

let controller = renderer.xr.getController(0); // click on phone
controller.addEventListener('select', throwBall);
scene.add(controller);

// EVENT LISTENER
window.addEventListener('resize', onWindowResize);


// FLOOR

var geometry = new THREE.PlaneGeometry(1000, 1000, 1, 1);
var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
var floor = new THREE.Mesh(geometry, material);
floor.material.side = THREE.DoubleSide;
floor.rotation.x = - Math.PI / 2;
floor.position.y = FLOOR_HEIGHT;
floor.visible = false;
scene.add(floor);
worldOctree.fromGraphNode(floor);

// WINDOW RESIZE

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

}

// PHYSICS

function throwBall() {
  NB_TRIES += 1;
  sphere.visible = true;
  let elements = controller.matrixWorld.elements;
  playerDirection = new THREE.Vector3(-elements[8], -elements[9], -elements[10]).normalize()
  playerDirection.y += 0.5; // permit to give a smooth curve to the ball
  sphere.collider.center.copy(camera.position)
  sphere.velocity.copy(playerDirection).multiplyScalar(IMPULSE);
  sphere.collider.center.set(0, 0, - 0.3).applyMatrix4(controller.matrixWorld);
  sphere.mesh.position.copy(sphere.collider.center);
  sphere.mesh.quaternion.setFromRotationMatrix(controller.matrixWorld);
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

function targetReached(target) {
  // checking if the target is reached by the object
  const d2 = target.center.distanceToSquared(sphere.collider.center);
  const r = target.radius + sphere.collider.radius;
  const r2 = r * r;
  return (d2 < r2);
}

function returnSphereToPlayer() {
  sphere.collider.center.copy(camera.position);
  sphere.mesh.position.copy(sphere.collider.center);
  sphere.visible = false;
}

// ACTION

const clock = new THREE.Clock();
bucketLoadingPromise.then(() => {
  console.log("logged")
  returnSphereToPlayer();
  animate();
})


// ANIMATION AND RENDERER

function animate() {
  renderer.setAnimationLoop(render);
}

function render() {

  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

  if (sphere.visible) {
    updateSphere(deltaTime);
  }

  if (targetReached(targetCollider)) {
    returnSphereToPlayer();
    console.log("You won by trying " + NB_TRIES + " times, continue training to become the new bucketball great master");
    NB_TRIES = 0;
  };

  renderer.render(scene, camera);

}




