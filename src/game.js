import { zzfx } from 'zzfx';

import { simFactory, RECTANGLE, CIRCLE, SPRING, REPULSIVE, HINGE, FIXED } from './xem-physics-factory.js';
import { particles } from './particles.js';
import { draw, setCam, wheelZoom, incZoom, getZoom, setZoom, ROYGB, setZoomSpeed } from './canvas-renderer.js';
import {
	PLANET_RADIUS, PLANET_CENTER,
	calcPressurePercentAtRadius,
	setDampeningForPressure, calcAltitude, calcPlanetGravity,
} from './planet.js';
import { checkCollisions, enableJoint, disableJoint, joinAnchors,
	makeCompound,
} from './physics-extensions.js';
import {
	setPos, subtractVectors, clamp, rand, lerp,
	PI, X, Y, angle2Vector, distance, magnitude, TWO_PI, addVectors, polar2Vector,
	scale, perpendicular,
} from './utils.js';
import { missions } from './missions.js';
import { clouds } from './clouds.js';
import { rainbows } from './rainbows.js';

// ---------- Sounds ----------

const SOUNDS = [
	[1,,507,.05,.19,.13,1,.7,-3,,-174,.17,,.4,,,.13,.8,.24,,958], // 0 = Refueling
	[1,,329.6276,,.2,.4,4,,5,1,,,,1,,1.3,.43,.1,.2], // 1 = thrust
	[1,,222,.02,.05,.07,3,.9,-6,-23,,,,.4,,,,.62,.08,,867], // 2 = reset
	[,,97.99886,.02,.17,.09,3,3.5,10,49,,,,,,,.1,.56,.06], // 3 = objective complete
	[1,,461,.01,.05,.02,1,2.3,-10,,,,,.2,18,.1,.18,.54,,,330], // 4 = bump
	[2,,130.8128,.01,.17,.4,4,1.4,-6,,,,,1.7,,.6,.39,.5,.12], // 5 = explode
];
let soundOn = 1;
function playSound(i, vol) {
	const s = [...SOUNDS[i]];
	if (soundOn && s) {
		if (vol !== undefined) s[0] = vol;
		zzfx(...s);
	}
}

// ---------- World ----------

const sims = [simFactory([0,0])]; // , simFactory()]; // You can have multiple simulations
const s1 = sims[0];
let look = [0, -PLANET_RADIUS];
let lookCooldown = 0;
setCam(look, true);
let titleOn = 1;
const TITLE_ZOOM = .019;
setZoom(TITLE_ZOOM);
// s1.G[Y] = 0; // 0.005;
// const rect = (w, h, cx, cy, w, h, m) => s1.shape(RECTANGLE, [400, 700], 0, 800, 30),
const rect = (x, y, w, h) => s1.shape(RECTANGLE, [x, y], w * h, w, h);
const circle = (x, y, r) => s1.shape(CIRCLE, [x, y], PI * r * r, r);


// Keys by Xem - https://xem.github.io/articles/jsgamesinputs.html
// u=r=d=l=0;
// onkeydown=onkeyup=e=>this['lurd************************l**r************l*d***u**u'[e.which-37]]=e.type[5]

const lookAtObj = (i) => {
	lookCooldown = 2e3;
	look = missions.current().objectives[i]?.pos;
};

// -------------------------- Interactions --------------------------------------------------------

function setTimeZoom(arr) {
	arr.forEach(([spd, wait]) => {
		setTimeout(() => setZoomSpeed(spd), wait);
	});
}
function turnTitleOff() {
	titleOn = 0;
	setZoomSpeed(.002);
	setZoom(1, 1);
	setTimeZoom([
		[.005, 500],
		[.01, 750],
		[.05, 1e3],
		[.1, 2e3],
		[undefined, 6e3],
	]);
}
function turnTitleOn() {
	titleOn = 1;
	setZoomSpeed(.1);
	setZoom(TITLE_ZOOM, 1);
}
let kbOn = 1;
let touchOn = 1;
const commandQueue = [];
// Maintain keys pressed down
const ks = {}; // { u: 0, r: 0, d: 0, l: 0, S: 0 }; 
const kt = { // Click events
	'-': () => incZoom(-.1),
	'=': () => incZoom(.1),
	'+': () => incZoom(.1),
	T: () => rocket.engineOn ^= 1, // Bitwise NOT operator to flip from 0 <-> 1
	B: () => commandQueue.push('reset'),
	r: () => commandQueue.push('reset'),
	z: () => rocket.setThrottle(1),
	x: () => rocket.setThrottle(0),
	E: () => {
		if (titleOn) turnTitleOff();
		if (missions.next()) { reset(); lookAtObj(0); }
	},
	c: () => oc.classList.toggle('show'),
	o: () => soundOn = !soundOn,
	X: () => {
		if (titleOn) turnTitleOff();
		else turnTitleOn();
	},
	b: () => rocket.breakMe(),
	f: () => commandQueue.push('fix'),
};
onkeydown = onkeyup = e => {
	ks['BT***E**HC*********X****S****LURD************************LbcR*f********o*qrD***Ux*z***'[e.which-8]]=e.type[5]?1:0;
	// ks[e.key]=e.type[5]?1:0;
	if (e.which > 186) ks['+*-'[e.which-187]]=e.type[5]?1:0;
	e.preventDefault()
	Object.keys(kt).forEach(k => ks[k] && kt[k]?.());
	// console.log(e.key, e.key.charCodeAt(), e.which, JSON.stringify(ks));
	kbOn = 1;
}

onclick=e=>{
	kbOn = e.pointerType === 'mouse';
	touchOn = e.pointerType === 'touch';
	// if (Math.random() < 0.5) {
	// 	rect(...s2w(e.pageX, e.pageY), 20, 20);
	// } else {
	// 	circle(...s2w(e.pageX, e.pageY), 10);
	// }
	const { nodeName, dataset } = e.target;
	if (nodeName === 'U' && dataset.key && kt[dataset.key]) kt[dataset.key]();

	// If we clicked on an objective then look at it
	const objIndex = e.target?.dataset?.obj;
	if (objIndex?.length) lookAtObj(Number(objIndex));
	// console.log(e.target);
};
const pinchEvents = [];
let pinchPrevDiff = null;
const getClickKey = e => e.target.nodeName === 'U' && e.target.dataset.key;
onpointerdown=e=>{
	const k = getClickKey(e);
	if (k) {
		ks[k] = 1;
	} else {
		pinchEvents.push(e); // For pinch-zoom
	}
};
onpointerout = onpointercancel = onpointerleave = onpointerup = e => {
	const k = getClickKey(e);
	if (k) {
		ks[k] = 0;
	}
	{ // For pinch-zoom
		// Remove this event from the target's cache
		const index = pinchEvents.findIndex(ev => ev.pointerId === e.pointerId);
		pinchEvents.splice(index, 1);
		// If the number of pointers down is less than two then reset diff tracker
		if (pinchEvents.length < 2) {
			pinchPrevDiff = null;
		}
	}
};
onpointermove = e => {
	// 2-pointer horizontal pinch/zoom gesture - update pincheven with this event
	const index = pinchEvents.findIndex(ev => ev.pointerId === e.pointerId);
	pinchEvents[index] = e;
	// If two pointers are down, check for pinch gestures
	if (pinchEvents.length === 2) {
		// Calculate the distance between the two pointers
		const [e1, e2] = pinchEvents;
		const curDiff = distance([e1.clientX, e1.clientY], [e2.clientX, e2.clientY]);
		if (pinchPrevDiff === null) {
			pinchPrevDiff = curDiff;
			return;
		}
		const dd = curDiff - pinchPrevDiff;
		incZoom(dd / 120);
		// Cache the distance for the next move event
		pinchPrevDiff = curDiff;
	}
};

onwheel = (e) => { /* e.preventDefault(); */ wheelZoom(e.deltaY); }

// ----------------------------- Make Physical Entities -------------------------------------------

// TODO: Debug weird bug where first shape created is not moving
// Make the physical planet
const planet = s1.shape(CIRCLE, PLANET_CENTER, 0, PLANET_RADIUS);
planet.color = '#0000'; // Transparent - draw as a special thing in the renderer
// Non-Physical Rectangles
const npr = (x, y, w, h, em, ems, c, line) => {
	const r = s1.shape(RECTANGLE, [x, y], 0, w, h);
	r.f = 0.1;
	r.emoji = em;
	r.emojiSize = ems;
	r.color = c;
	if (line) r.line = line;
	return r;
};
npr(0, -PLANET_RADIUS, 440, 40, '🚀Launchpad', 18, '#aaa', [4, '#1113']); // Platform
npr(330, -PLANET_RADIUS - 110, 180, 250, '🦄HQ', 50, '#ddd', [3, '#1113']); // Building
npr(330, -PLANET_RADIUS - 245, 20, 20, '🏰', 70, '#ddd'); // Building
npr(-340, -PLANET_RADIUS, 20, 20, '📡', 90, '#999'); // Dish
npr(-1750, -PLANET_RADIUS + 140, 400, 160, '🌈 Generator', 42, '#aaa', [3, '#1113']);

const LAUNCHPAD_RESET_POS = [0, -PLANET_RADIUS - 70];

const MODE_NAMES = ['Burst', 'Sustained Burn'];
const NOZ_H = 16;
const rocket = {
	compound: makeCompound(s1,
		[
			[8, 16], // nose cone
			[16, 8], // probe core
			[16, 50, 0, 0], // body
			[16, 16, 0, 25], // engine base
			[12, NOZ_H], // engine nozzle
			[6, 50, 20, 0], // Landing gear right
			[6, 50, -20, 0], // Landing gear left
		],
		0, -PLANET_RADIUS * 1.1
	),
	joints: [],
	assemble() {
		const r = this;
		// Give names for the various parts
		['nose', 'core', 'body', 'engine', 'nozzle', 'landingR', 'landingL'].forEach((k, i) => {
			r[k] = r.compound.parts[i];
			r[k].partName = k;
			r[k].line = [1, '#545'];
		});
		r.compound.parts.forEach(p => p.rocketPart = 1);

		function rocketJoin(part1, part2, x1, y1, x2, y2, type, str, len) {
			const { j } = joinAnchors(s1, r[part1], r[part2], x1, y1, x2, y2, type, str, len);
			r.joints.push(j);
		}

		rocketJoin('nose', 'core', 0, 8, 0, -4);
		rocketJoin('core', 'body', 0, 4, 0, -25);
		rocketJoin('body', 'engine', 0, 25, 0, -8);
		rocketJoin('engine', 'nozzle', 0, 8, 0, -7);
		// rocketJoin('body', 'landingR', 8, 20, -3, -25);
		// rocketJoin('body', 'landingL', -8, 20, 3, -25);
		rocketJoin('body', 'landingR', 8, 20, -3, -25, HINGE);
		rocketJoin('body', 'landingL', -8, 20, 3, -25, HINGE);
		// rocketJoin('engine', 'landingR', 0, 0, 0, -10, REPULSIVE, .2, 15);
		// rocketJoin('engine', 'landingR', 0, 0, 0, -10, SPRING, .2, 15);

		rocketJoin('landingL', 'landingR', 0, 20, 0, 20, REPULSIVE, .2, 45);
		rocketJoin('landingL', 'landingR', 0, 20, 0, 20, SPRING, 1, 35);

		r.engine.color = '#ccc';
		r.nozzle.color = '#bbb';
		r.nose.color = '#fcf';
		r.body.emoji = '🦄';
	},
	hasDamage() {
		return this.compound.parts.reduce((bool, p) => bool || p.damaged, 0);
	},
	damage(part, pos) {
		this.joints.forEach(j => {
			if (j.A === part || j.B === part) {
				if (!part.damaged) {
					playSound(5);
					part.F[X] += rand(-2, 2);
					part.F[Y] += rand(-2, 2);
					for (let i = 0; i < 10; i++) {
						particles.new(.7, pos, [rand(-3, 3), rand(-3, 3), rand(-1, 1)], 4, [255, 150, 0, 100], [0, 0, 0, 0]);
					}
				}
				disableJoint(s1, j);
			}
		});
		if (['nozzle', 'engine', 'body'].includes(part.partName)) this.engineOn = 0;
		part.damaged = 1;
	},
	breakMe() {
		this.joints.forEach(j => {
			j.A.damaged = 1;
			j.B.damaged = 1;
			disableJoint(s1, j);
		});
	},
	halt() {
		this.compound.parts.forEach(p => {
			// Cut the velocity and angular velocity
			p.v = [0, 0];
			p.A = 0;
		});
	},
	fixMe() {
		this.halt();
		this.joints.forEach(j => {
			j.A.damaged = 0;
			j.B.damaged = 0;
			enableJoint(s1, j);
		});
	},
	resetTo(pos) {
		const offset = subtractVectors(pos, this.nozzle.c);
		this.halt();
		this.compound.parts.forEach(p => {
			const desiredAngle = 0;
			const da = desiredAngle - p.a; // Difference between desired angle and current angle (a)
			// console.log(p.a, da);
			// Note: transform only updates the geometry (vertices, etc),
			// and not the rotation state (a)
			s1.transform(p, offset, da);
			// ...so we need to set the angle manually.
			p.a = desiredAngle;
		});
		// This is kind of hacky - running the sim here and re-halting - but it appears to work
		s1.run();
		this.halt();
		rocket.engineOn = 0;
	},
	gim: 0,
	deltaGim: .02,
	rotateLand() {
		// TODO: Rotate the base of the rocket to the land
	},
	rotate(dir) { // Handle user input to move the ship left (-1) or right (1)
		this.gimbalCooldown = 50;
		this.gimbal(-dir);
		this.core.A += .07 * dir;
	},
	gimbal(n) {
		const ogGim = this.gim;
		this.gim = clamp(this.gim + n * this.deltaGim, -.9, .9);
		const dg = ogGim - this.gim;
		this.nozzle.a += dg;
		// console.log(this.nozzle.a, this.engine.a);
	},
	fuel: 1e3,
	maxFuel: 1e3,
	setFuel(t) { this.fuel = clamp(t, 0, this.maxFuel);	},
	refuel(dr) {
		if (dr > 0) playSound(0)
		this.setFuel(this.fuel + dr);
	},
	engineOn: 0,
	enginePower: 0.4,
	throttle: 1, // 0.4,
	lastAppliedEnginePower: 0,
	maxThrottle: 1,
	setThrottle(t) { this.throttle = clamp(t, 0, this.maxThrottle);	},
	increaseThrottle(dt) { this.setThrottle(this.throttle + dt); },
	thrust() {
		this.applyThrust();
	},
	applyThrust() {
		this.refuel(-.3 * this.throttle);
		if (this.fuel <= 0) return 0;
		const noz = this.nozzle;
		const vec = angle2Vector(noz.a + this.gim - PI/2);
		this.lastAppliedEnginePower = this.throttle * this.enginePower;
		noz.F[X] = vec[X] * this.lastAppliedEnginePower;
		noz.F[Y] = vec[Y] * this.lastAppliedEnginePower;

		if (rand() > this.throttle) return 1; // No particles
		const vol = clamp(this.throttle * getZoom() * .8, .5, 1.5);
		playSound(1, vol);
		const [comVX, comVY] = this.compound.v;
		ROYGB.forEach((col, i) => {
			const vel = [
				comVX + rand(2) - 1 - (vec[X] * 3),
				comVY + rand(2) - 1 - (vec[Y] * 3),
				rand(2) - 1
			];
			const p = addVectors(
				addVectors(noz.c, scale(vec, -NOZ_H / 2)), // Bottom of nozzle
				scale(perpendicular(vec), (i * -8) + 16)
			);
			// particles.new(2, [p[X] + (i * 8) - 16, p[Y], 0], vel, 4, [...col, 255]);
			particles.new(2, [...p, 0], vel, 4, [...col, 255], [...col, 0]);
		});
		return 1;
	},
	run(t) {
		this.compound.parts.forEach((s) => setDampeningForPressure(s));
		if (this.throttle && this.engineOn) this.applyThrust();
		if (this.gimbalCooldown > 0) this.gimbalCooldown -= t;
		else this.gimbal(this.gim > 0 ? -2 : 2);
		this.lastAppliedEnginePower = lerp(this.lastAppliedEnginePower, 0, 0.1);
		if (this.lastAppliedEnginePower < .01) this.lastAppliedEnginePower = 0;
	},
};

rocket.assemble();
let invuln = 1;
function makeInvuln() {
	invuln = 1;
	setTimeout(() => invuln = 0, 2e3);
}

const reset = (stay) => {
	playSound(2);
	missions.reset();
	makeInvuln();
	rocket.fixMe();
	if (!stay) {
		rocket.resetTo(LAUNCHPAD_RESET_POS);
		rocket.refuel(1e6);
	}
};
reset();

// --------------------------------------- Calculations -------------------------------------------
const calcPartsAltitude = parts =>
	calcAltitude(parts.reduce((low, p) => Math.min(low, distance(p.c, [0, 0])), Infinity));

// X = 0, Y = 1
function calcTrajectory({ com, v, m }) {
	// Start the trajectory line at the center of mass
	const traj = [[...com]];
	const tv = [...v]; // trajectory velocity
	const dt = 10;
	// Iterate into the future to see where the object will go
	for (let t = 0; t < 1000; t++) {
		const pos = traj[traj.length - 1]; // Get the last position
		// If we go below the planet's radius, then we don't need any more points
		if (distance(pos, [0, 0]) < PLANET_RADIUS) t = 1000;
		const fG = calcPlanetGravity(m, pos);
		const accG = [fG[X] / m, fG[Y] / m];
		tv[X] += accG[X] * dt;
		tv[Y] += accG[Y] * dt;
		traj.push([
			pos[X] + tv[X] * dt,
			pos[Y] + tv[Y] * dt,
		]);
	}
	// Return an array of 2d array positions
	return traj;
}

// Other things to display
let trajectory = [];

// --------------------------------------- Game Loop and Render Loop ------------------------------
const DT = 16;
setInterval(() => {
	if (commandQueue.length) {
		const cmd = commandQueue.shift();
		if (cmd === 'reset') reset();
		if (cmd === 'fix') reset(true);
	}
	// if (ks.d) rocket.nozzle.v[Y] -= .3;
	// if (ks.D) rocket.rotateLand(); // TODO
	if (ks.L) rocket.rotate(-1);
	if (ks.R) rocket.rotate(1);
	if (ks.U) rocket.thrust();
	if (ks.z) rocket.setThrottle(rocket.maxThrottle);
	if (ks.x) rocket.setThrottle(0);
	if (ks.H) rocket.increaseThrottle(.008); // Shift
	if (ks.C) rocket.increaseThrottle(-.008); // Ctrl
	// if (ks.S) rocket.nextStage(); // Space

	// TODO: Update gravity for particles
	particles.run();
	let rda = clouds.run(DT, rocket);
	for (let sim of sims) {
		for (let o of sim.H) {
			o.g = calcPlanetGravity(o.m, o.c);
			// This is a trick: The `F` force is always overwritten during the physics `run`,
			// so we will add it to the gravity instead.
			setPos(o.g, addVectors(o.g, o.F));
		}
		sim.run();
		// sim.collisions = getCollisionsById(sim);
		// console.log(sim.collisions);
		if (!invuln) checkCollisions(sim, 160, (shape, mani, ii) => {
			// Ignore rocket parts hitting themselves because this happens during assembly, and
			// when the landing gear swings
			if (mani.A.rocketPart && mani.B.rocketPart) return;
			if (shape.rocketPart) {
				rocket.damage(shape, mani.c);
			} else {
				playSound(4);
			}
			// console.log('Collision', ii, mani);
		});
	}
	// TODO: If any rocket parts are colliding, then play a noise:
	// zzfx(...[2.3,,461,.01,.05,.02,1,2.3,-10,,,,,.2,18,.1,.18,.54,,,330]);
	rocket.run(DT);
	rocket.compound.calc();
	trajectory = calcTrajectory(rocket.compound);
	rainbows.run(DT, rocket, rda);

	const newCompleted = missions.check(rocket);
	if (newCompleted.length > 0) {
		playSound(3);
		const o = newCompleted[0];
		// Confetti if we just completed a mission
		for (let i = 0; i < 100; i++) {
			const pos = addVectors(o.pos, polar2Vector(o.r, rand(TWO_PI)));
			const v = scale(subtractVectors(pos, o.pos), .02 + rand(.05));
			particles.new(.8, [...pos, 0], [...v, .5], 8, [155, 255, 0, 255], [85, 153, 85, 0]);
		}
	}
	if (lookCooldown <= 0) look = [...rocket.body.c];
	lookCooldown -= DT;
}, DT);

const $ = id => document.getElementById(id);
const setHTML = (el, html) => el.innerHTML !== html && (el.innerHTML = html);
const setText = (el, txt) => el.innerText !== txt && (el.innerText = txt);
const cl = document.body.classList;

const render = () => {
	setCam(look, lookCooldown < -2e3);
	const speed = magnitude(rocket.compound.v);
	draw(
		DT, sims,
		particles,
		speed < .1 ? [] : [trajectory],
		titleOn ? [] : missions,
		clouds,
		rainbows,
		rocket,
		{ screenShake: 1 },
	);
	// ^ TODO: make the delta-t based on time elapsed since last render
	const alt = calcPartsAltitude(rocket.compound.parts);
	// altn.innerText = alt.toFixed(0).padStart(6, '0');
	setText(altn, alt.toFixed(0).padStart(6, '0'));
	thn.innerText = `${(rocket.throttle * 100).toFixed(1)}`;
	thp.value = rocket.throttle;
	spdn.innerText = clamp(((speed * 100) - 1).toFixed(0), 0, Infinity);
	elMode.innerText = MODE_NAMES[rocket.engineOn];
	atmos.value = calcPressurePercentAtRadius(alt + PLANET_RADIUS);
	flp.value = rocket.fuel;
	flp.max = rocket.maxFuel;
	msnreset.classList.toggle('show', rocket.hasDamage());
	msndone.classList.toggle('show', missions.completed() >= 1);
	setText(msnnum, missions.index + 1);
	setText(msntot, missions.length);
	setHTML(
		msnos,
		missions.current().objectives.map((o, i) => '<li data-obj="' + i + '">' + (o.completed ? '✅' : '') + (o.description || 'Do thing') + '</li>').join('')
	);
	cl.toggle('ui', !titleOn);
	cl.toggle('kb', kbOn);
	cl.toggle('touch', touchOn);
	requestAnimationFrame(render);
};

requestAnimationFrame(render);

window.g = { ks, rocket, clouds, particles };
