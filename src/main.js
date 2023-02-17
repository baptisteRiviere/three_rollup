import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Capsule } from 'three/examples/jsm/math/Capsule.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';


// INIT SPECIFICS TO BUCKET GAME

const STEPS_PER_FRAME = 4;
let playerCollider;
let playerDirection = new THREE.Vector3();
const SPHERE_RADIUS = 0.2;
const GRAVITY = 60;
const BUCKET_POSITION = new THREE.Vector3(0, -2, -6)
const TARGET_SPHERE_RADIUS = 1.2;
let IMPULSE = 30;
const worldOctree = new Octree();

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
    //camera.lookAt(x, y, z);
    //targetCollider = new THREE.Sphere(BUCKET_POSITION, TARGET_SPHERE_RADIUS);
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
  velocity: new THREE.Vector3(),
  hold: true
};

// CONTROLLER 

let controller = renderer.xr.getController(0); // click on phone
controller.addEventListener('select', throwBall);
scene.add(controller);

// EVENT LISTENER
window.addEventListener('resize', onWindowResize);

// SPECIFICS FUNCTION TO THREE EXAMPLE

const geometry = new THREE.CylinderGeometry(0, 0.05, 0.2, 32).rotateX(Math.PI / 2);

function onSelect() {
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff * Math.random() });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, - 0.3).applyMatrix4(controller.matrixWorld);
  mesh.quaternion.setFromRotationMatrix(controller.matrixWorld);
  scene.add(mesh);
}

function onWindowResize() {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

}


// PHYSICS

function throwBall() {
  console.log(sphere.mesh.position)
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

/*
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
*/

// SPAWN

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

const clock = new THREE.Clock();
spawn(0, 1.6, 0);
animate();

// ANIMATION AND RENDERER

function animate() {


  renderer.setAnimationLoop(render);

}

function render() {

  const deltaTime = Math.min(0.05, clock.getDelta()) / STEPS_PER_FRAME;

  if (!sphere.hold) {
    updateSphere(deltaTime);
    //groundIntersected(sphere);
  }

  renderer.render(scene, camera);

}


