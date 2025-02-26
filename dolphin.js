import * as THREE from "three";
import { GUI } from "dat.gui";
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

let scene, camera, renderer, dolphin, skeletonHelper, gui;
let bones = [], controls = {};

class WavePath extends THREE.Curve {
    constructor(freqX = 3, freqY = 2, phaseShift = Math.PI / 2, magnitude = 10) {
        super();
        this.freqX = freqX;
        this.freqY = freqY;
        this.phaseShift = phaseShift;
        this.magnitude = magnitude;
    }

    getPoint(progress) {
        let coordX = Math.sin(this.freqX * Math.PI * progress + this.phaseShift);
        let coordY = Math.sin(this.freqY * Math.PI * progress);
        let coordZ = Math.cos(2 * Math.PI * progress);
        return new THREE.Vector3(coordX, coordY, coordZ).multiplyScalar(this.magnitude);
    }
}

let swimRoute = new WavePath(3, 2, Math.PI / 2, 10);

let swimTime = 0;
let swimSpeed = 0.0005;

initOcean();
animateDolphin();

function initOcean() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeeeeee);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(20, 10, 20);
    camera.lookAt(0, 0, 0);

    const softGlow = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(softGlow);

    const sunbeam = new THREE.DirectionalLight(0xffffff, 1);
    sunbeam.position.set(10, 10, 10);
    scene.add(sunbeam);

    loadDolphin();
    controls = new GUI();
    window.addEventListener("resize", onResize, true);
}

function createSkeleton() {
    bones = [];

    const rootBone = new THREE.Bone();
    rootBone.name = "Root";
    rootBone.position.set(0, 0, 0);
    bones.push(rootBone);

    let parent = rootBone;

    let upperSpine = new THREE.Bone();
    upperSpine.name = "Upper Spine";
    upperSpine.position.set(-2.5, 0, -0.5);
    parent.add(upperSpine);
    bones.push(upperSpine);
    parent = upperSpine;

    let middleSpine = new THREE.Bone();
    middleSpine.name = "Middle Spine";
    middleSpine.position.set(0.5, 0, 0);
    parent.add(middleSpine);
    bones.push(middleSpine);
    parent = middleSpine;

    let lowerSpine = new THREE.Bone();
    lowerSpine.name = "Lower Spine";
    lowerSpine.position.set(4.5, 0, 0);
    parent.add(lowerSpine);
    bones.push(lowerSpine);
    parent = lowerSpine;

    const tailBone = new THREE.Bone();
    tailBone.name = "Tail Fin";
    tailBone.position.set(5.5, 0, 0);
    parent.add(tailBone);
    bones.push(tailBone);

    const leftFlipper = new THREE.Bone();
    leftFlipper.name = "Left Flipper";
    leftFlipper.position.set(-1.5, 0.4, -1);
    rootBone.add(leftFlipper);
    bones.push(leftFlipper);

    const rightFlipper = new THREE.Bone();
    rightFlipper.name = "Right Flipper";
    rightFlipper.position.set(-1.5, -0.4, -1);
    rootBone.add(rightFlipper);
    bones.push(rightFlipper);

    const dorsalFin = new THREE.Bone();
    dorsalFin.name = "Dorsal Fin";
    dorsalFin.position.set(0, 0, 3);
    lowerSpine.add(dorsalFin);
    bones.push(dorsalFin);

    const skeleton = new THREE.Skeleton(bones);
    skeletonHelper = new THREE.SkeletonHelper(rootBone);
    scene.add(skeletonHelper);

    return { bones, skeleton };
}

function loadDolphin() {
    const loader = new OBJLoader();
    loader.load("/dolphin_color.obj", function (object) {
        dolphin = object;

        dolphin.traverse((child) => {
            if (child.isMesh) {

                const geometry = child.geometry;
                const { skeleton, bones } = createSkeleton();
                const position = geometry.attributes.position;

                const vertexCount = position.count;
                const skinIndices = [];
                const skinWeights = [];
                
                for (let i = 0; i < vertexCount; i++) {
                    let y = position.getY(i);

                    let boneIndex = Math.floor((y + 10) / 5); 
                    let boneWeight = ((y + 10) % 5) / 5; 

                    skinIndices.push(boneIndex, boneIndex + 1, 0, 0);
                    skinWeights.push(1 - boneWeight, boneWeight, 0, 0);
                }

                geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
                geometry.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));

                const skinnedMesh = new THREE.SkinnedMesh(geometry, child.material);
                skinnedMesh.add(skeleton.bones[0]);
                skinnedMesh.bind(skeleton);

                scene.add(skinnedMesh);
                dolphin = skinnedMesh;
            }
        });

        const box = new THREE.Box3().setFromObject(object);
		const boxSize = box.getSize(new THREE.Vector3());
		const boxSizeln = Math.max(boxSize.x, boxSize.y, boxSize.z);
		const boxCenter = box.getCenter(new THREE.Vector3());
		dolphin.position.set(-2.0 * boxCenter.x / boxSizeln, 
							 -2.0 * boxCenter.y / boxSizeln, 
							 -2.0 * boxCenter.z / boxSizeln );
		dolphin.scale.set(2.0 / boxSizeln, 2.0 / boxSizeln, 2.0 / boxSizeln);

        dolphin.rotation.x = -Math.PI / 2;
        scene.add(dolphin);

        controlsGUI();
    }, undefined, function (error) {
        console.error("Error loading OBJ:", error);
    });
}

function controlsGUI() {
    let gui = new GUI();

    // Loop through the bones array and create a folder for each bone.
    bones.forEach((bone, index) => {
        if (bone) {  // Check if bone exists
            let folder = gui.addFolder(bone.name);
            // Apply the rotation controls directly to the bone using Euler angles for each axis.
            folder.add(bone.rotation, "x", -Math.PI, Math.PI).name("Rotation X");
            folder.add(bone.rotation, "y", -Math.PI, Math.PI).name("Rotation Y");
            folder.add(bone.rotation, "z", -Math.PI, Math.PI).name("Rotation Z");
        }
    });
}


function animateDolphin() {
    requestAnimationFrame(animateDolphin);
    const currentTimeInSeconds = Date.now() * 0.001;
    swimTime += swimSpeed;
    let pathProgress = (swimTime % 1);

    let currentPosition = swimRoute.getPoint(pathProgress);
    let currentTangent = swimRoute.getTangent(pathProgress).normalize();

    if (dolphin) {
        dolphin.position.copy(currentPosition);

        let rotationQuaternion = new THREE.Quaternion();
        rotationQuaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), currentTangent);

        let flipQuaternion = new THREE.Quaternion();
        flipQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

        dolphin.quaternion.multiplyQuaternions(rotationQuaternion, flipQuaternion);
    }

    const swayAmplitude = 0.4;
    const swaySpeed = 1.3;

    if (bones[0]) {
        bones[0].rotation.y = Math.sin(currentTimeInSeconds * swaySpeed) * swayAmplitude; //upper spine
    }
    if (bones[1]) {
        bones[1].rotation.y = Math.sin(currentTimeInSeconds * swaySpeed * 1.2) * swayAmplitude; //middle spine
    }
    if (bones[2]) {
        bones[2].rotation.y = Math.sin(currentTimeInSeconds * swaySpeed * 1.5) * swayAmplitude; //lower spine
    }

    const bobAmplitude = 0.15;
    const bobSpeed = 0.7;
    if (bones[0]) {
        bones[0].position.y = Math.sin(currentTimeInSeconds * bobSpeed) * bobAmplitude; // upperSpine
    }
    if (bones[1]) {
        bones[1].position.y = Math.sin(currentTimeInSeconds * bobSpeed * 0.9) * bobAmplitude; // middleSpine
    }
    if (bones[2]) {
        bones[2].position.y = Math.sin(currentTimeInSeconds * bobSpeed * 0.8) * bobAmplitude; //lowerSpine
    }

    //tail wag
    if (bones[3]) {
        bones[3].rotation.x = Math.sin(currentTimeInSeconds * 2.5) * 0.6; //tail
    }

     // Animate the flippers with fluid motion
    const flipperAmplitude = 0.7;
    const flipperSpeed = 2.2;
    if (bones[4]) {
        bones[4].rotation.x = Math.sin(currentTimeInSeconds * flipperSpeed) * flipperAmplitude; //left flipper
    }
    if (bones[5]) {
        bones[5].rotation.x = Math.sin(currentTimeInSeconds * flipperSpeed) * flipperAmplitude; //right flipper
    }

    //dorsal fin shake
    if (bones[6]) {
        bones[6].rotation.z = Math.sin(currentTimeInSeconds * 1.3) * 0.12; //dorsal fin
    }

    renderer.render(scene, camera);
}

function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}