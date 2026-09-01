import { zzfx } from 'zzfx';

import { simFactory, RECTANGLE, CIRCLE, SPRING, REPULSIVE, HINGE, FIXED } from './xem-physics-factory.js';
import { particles } from './particles.js';
import { draw, setCam, wheelZoom, incZoom, s2w } from './canvas-renderer.js';
import {
	PLANET_RADIUS, PLANET_CENTER, PLANET_MASS,
	calcPressurePercentAtRadius,
	setDampeningForPressure, calcAltitude, calcPlanetGravity,
} from './planet.js';
import { getCollisionsById } from './physics-extensions.js';
import { setPos, subtractVectors, clamp, sin, cos, PI, X, Y, angle2Vector, distance, magnitude, TWO_PI, addVectors, polar2Vector } from './utils.js';
import { missions } from './missions.js';


// aka. (v1, v2) => Math.hypot(v2[X] - v1[X], v2[Y] - v1[Y]);
                 


// ---------- World ----------

zzfx(...[,,537,.02,.02,.22,1,1.59,-6.98,4.97]);

const sims = [simFactory([0,0])]; // , simFactory()]; // You can have multiple simulations
const s1 = sims[0];
let look = [0, 0];
let lookCooldown = 0;
// s1.G[Y] = 0; // 0.005;
// const rect = (w, h, cx, cy, w, h, m) => s1.shape(RECTANGLE, [400, 700], 0, 800, 30),
const rect = (x, y, w, h) => s1.shape(RECTANGLE, [x, y], w * h, w, h);
const circle = (x, y, r) => s1.shape(CIRCLE, [x, y], PI * r * r, r);
const addShape = (shapeConfig, comp) => {
	const [w, h, offsetX = 0, offsetY = 0, type = RECTANGLE, options = {}] = shapeConfig;
	const mass = w * h; // TODO: handle circles
	comp.parts.push(
		s1.shape(type, [comp.c[X] + offsetX, comp.c[Y] + offsetY], mass, w, h, options)
	);
};
const makeCompound = (shapeConfigArr, cx, cy) => {
	const comp = {
		c: [cx, cy], // center position
		parts: [],
		com: [0, 0], // Center of mass
		v: [0, 0], // Overall velocity
		m: 0, // total mass
		// calculate center of mass, overall velocity, and total mass
		calc() {
			const me = this;
			// Get the total mass of all parts
			me.m = me.parts.reduce((sum, p) => sum + p.m, 0);
			me.com = [0, 0];
			me.v = [0, 0];
			// Calculate the center of mass and the average velocity of all parts
			me.parts.forEach(p => {
				const massPortion = p.m / me.m;
				me.com[X] += p.c[X] * massPortion;
				me.com[Y] += p.c[Y] * massPortion;
				me.v[X] += p.v[X] * massPortion;
				me.v[Y] += p.v[Y] * massPortion;
			});
		},
	};
	shapeConfigArr.forEach((config) => addShape(config, comp));
	return comp;
}

// Keys by Xem - https://xem.github.io/articles/jsgamesinputs.html
// u=r=d=l=0;
// onkeydown=onkeyup=e=>this['lurd************************l**r************l*d***u**u'[e.which-37]]=e.type[5]

const lookAtObj = (i) => {
	lookCooldown = 2e3;
	look = missions.current().objectives[i]?.pos;
};

const commandQueue = [];
const ks = {}; // { u: 0, r: 0, d: 0, l: 0, S: 0 };
const kt = {
	'-': () => incZoom(-.1),
	'=': () => incZoom(.1),
	'+': () => incZoom(.1),
	T: () => rocket.engineOn ^= 1, // Bitwise NOT operator to flip from 0 <-> 1
	B: () => commandQueue.push('reset'),
	z: () => rocket.setThrottle(1),
	x: () => rocket.setThrottle(0),
	E: () => { if (missions.next()) { reset(); lookAtObj(0); } },
};
onkeydown = onkeyup = e => {
	ks['BT***E**HC**************S****lurd************************l**r************q*d***ux*z***'[e.which-8]]=e.type[5]?1:0;
	// ks[e.key]=e.type[5]?1:0;
	if (e.which > 186) ks['+*-'[e.which-187]]=e.type[5]?1:0;
	e.preventDefault()
	Object.keys(kt).forEach(k => ks[k] && kt[k]?.());
	console.log(e.key, e.key.charCodeAt(), e.which, JSON.stringify(ks));
}
// onkeydown = e => console.log(e, e.type[5], e.which);
// onkeyup = e => console.log(e, e.type[5]);

onclick=e=>{
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
	// s1.shape(CIRCLE, , 500, 10);
};
let clickedKey;
onpointerdown=e=>{
	const { nodeName, dataset } = e.target;
	if (nodeName === 'U' && dataset.key) {
		clickedKey = dataset.key;
		ks[dataset.key] = 1;
		console.log(ks);
	}
};
onpointercancel = onpointerleave = onpointerup = e => {
	if (clickedKey) {
		ks[clickedKey] = 0;
		clickedKey = null;
		console.log(ks);
	}
}

onwheel = (e) => { /* e.preventDefault(); */ wheelZoom(e.deltaY); }

// TODO: Debug weird bug where first shape created is not moving

// Make the physical planet
const planet = s1.shape(CIRCLE, PLANET_CENTER, 0, PLANET_RADIUS);
planet.color = '#064';
// Non-Physical Rectangles
const npr = (x, y, w, h) => {
	const r = s1.shape(RECTANGLE, [x, y], 0, w, h);
	r.f = 0.1;
};
npr(0, -PLANET_RADIUS, 440, 40); // Platform
npr(-14, -PLANET_RADIUS - 50, 10, 60);
npr(14, -PLANET_RADIUS - 50, 10, 60);
s1.shape(RECTANGLE, [300, -PLANET_RADIUS - 100], 0, 100, 250); // Test building

const LAUNCHPAD_RESET_POS = [0, -PLANET_RADIUS - 40];

const MODE_NAMES = ['Burst', 'Sustained Burn'];
const rocket = {
	compound: makeCompound(
		[
			[8, 16], // nose cone
			[16, 8], // probe core
			[16, 50, 0, 0], // body
			[16, 16, 0, 25], // engine base
			[12, 16], // engine nozzle
		],
		0, -PLANET_RADIUS * 1.1
	),
	get nozzle() { return this.compound.parts[4]; },
	gim: 0,
	deltaGim: .01,
	rotate(dir) { // Handle user input to move the ship left (-1) or right (1)
		this.gimbalCooldown = 50;
		this.gimbal(dir);
		this.core.A += .05 * dir;
	},
	gimbal(n) {
		const ogGim = this.gim;
		this.gim = clamp(this.gim + n * this.deltaGim, -.7, .7);
		const dg = ogGim - this.gim;
		this.nozzle.a += dg;
		// console.log(this.nozzle.a, this.engine.a);
	},
	fuel: 1e3,
	maxFuel: 1e3,
	setFuel(t) { this.fuel = clamp(t, 0, this.maxFuel);	},
	refuel(dr) { this.setFuel(this.fuel + dr); },
	engineOn: 0,
	enginePower: 0.4,
	throttle: 0.4,
	maxThrottle: 1,
	setThrottle(t) { this.throttle = clamp(t, 0, this.maxThrottle);	},
	increaseThrottle(dt) { this.setThrottle(this.throttle + dt); },
	thrust() {
		this.applyThrust();
	},
	applyThrust() {
		this.refuel(-.3 * this.throttle);
		if (this.fuel <= 0) return;
		const noz = this.nozzle;
		const vec = angle2Vector(noz.a - PI/2);
		// Old method involved applying to velocity
		// noz.v[X] += vec[X] * this.throttle * this.enginePower;
		// noz.v[Y] += vec[Y] * this.throttle * this.enginePower;
		noz.F[X] = vec[X] * this.throttle * this.enginePower;
		noz.F[Y] = vec[Y] * this.throttle * this.enginePower;
		
		if (Math.random() > this.throttle) return; // No particles
		[
			[255, 0, 0],
			[255, 100, 0],
			[255, 255, 0],
			[0, 255, 0],
			[0, 0, 255],
		].forEach((col, i) => {
			const vel = [
				Math.random() * 2 - 1 - vec[X],
				Math.random() * 2 - 1 - vec[Y],
				Math.random() * 2 - 1
			];
			particles.new(2, [noz.c[X] + (i * 10) - 20, noz.c[Y], 0], vel, [...col, 255]);
		});
		// particles.new(1, [noz.c[X] - 20, noz.c[Y], 0], vel, [255, 0, 0, 255]);
		// particles.new(1, [noz.c[X] - 10, noz.c[Y], 0], vel, [255, 100, 0, 255]);
		// particles.new(1, [noz.c[X] + 0, noz.c[Y], 0], vel, [255, 255, 0, 255]);
		// particles.new(1, [noz.c[X] + 10, noz.c[Y], 0], vel, [0, 255, 0, 255]);
		// particles.new(1, [noz.c[X] + 20, noz.c[Y], 0], vel, [0, 0, 255, 255]);
	},
	run(t) {
		this.compound.parts.forEach((s) => setDampeningForPressure(s));
		if (this.throttle && this.engineOn) this.applyThrust();
		if (this.gimbalCooldown > 0) this.gimbalCooldown -= t;
		else this.gimbal(this.gim > 0 ? -2 : 2);
	},
};
rocket.nose = rocket.compound.parts[0];
rocket.core = rocket.compound.parts[1];
rocket.body = rocket.compound.parts[2];
rocket.engine = rocket.compound.parts[3];
// rocket.body.m /= 3;
// rocket.body.f /= 10;
// rocket.nozzle = rocket.compound.parts[2];

const join = (part1, part2, offset1X = 0, offset1Y = 0, offset2X = 0, offset2Y = 0, type = FIXED) => {
	const a1 = s1.anchor(part1, [offset1X, offset1Y]);
	const a2 = s1.anchor(part2, [offset2X, offset2Y]);
	const j = s1.joint(type, part1, a1, part2, a2);
	return { a1, a2, j };
};
// const a1 = s1.anchor(rocket.compound.parts[0], [0, 25]);
// const a2 = s1.anchor(rocket.compound.parts[1], [0, -8]);
// s1.joint(FIXED, rocket.compound.parts[0], a1, rocket.compound.parts[1], a2);

join(rocket.nose, rocket.core, 0, 8, 0, -4);
join(rocket.core, rocket.body, 0, 4, 0, -25);
join(rocket.body, rocket.engine, 0, 25, 0, -8);
join(rocket.engine, rocket.nozzle, 0, 8, 0, -7);

console.log(rocket, planet);

const reset = () => {
	const offset = subtractVectors(LAUNCHPAD_RESET_POS, rocket.nozzle.c);
	rocket.compound.parts.forEach(p => {
		const desiredAngle = 0;
		const da = desiredAngle - p.a; // Difference between desired angle and current angle (a)
		console.log(p.a, da);
		// Note: transform only updates the geometry (vertices, etc),
		// and not the rotation state (a)
		s1.transform(p, offset, da);
		// ...so we need to set the angle manually.
		p.a = desiredAngle;
		// Also let's cut the velocity and angular velocity
		p.v = [0, 0];
		p.A = 0;
	});
	rocket.engineOn = 0;
	// rocket.compound.parts.forEach(p => {
	// 	s1.transform(p, offset, 0);
	// });
	// s1.transform(rocket.body, [0, 0], 0);
	// setPos(rocket.body.c, LAUNCHPAD_RESET_POS);
};
reset();


// const hookSpot = s1.shape(RECTANGLE, [400, 400], 0, 10, 10);
// s2 = s1.shape(RECTANGLE, [100, 50], 10, 20, 30);
// s1 = s1.shape(CIRCLE, [300, 150], 10, 50);
// s3 = s1.shape(RECTANGLE, [200, 0], 10, 20, 30);

// const floor2 = sim2.shape(RECTANGLE, [400, 600], 0, 800, 30);
// const hookSpot2 = sim2.shape(RECTANGLE, [400, 300], 0, 10, 10);
// car = sim2.shape(RECTANGLE, [300, 0], 10, 20, 30);
// npc = sim2.shape(RECTANGLE, [200, 300], 10, 30, 30);
// const a1 = sim2.anchor(hookSpot2, [0,0]);
// const a2 = sim2.anchor(car, [0,0]);
// sim2.joint(SPRING, hookSpot2, a1, car, a2, .2, 180);

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
const rainbow = {
	mag: 7e3, angle: -PI * .4, // coordinates
	c: [0, 0], // center (position)
	r: PLANET_RADIUS * .5, // size
	w: 200,
};
let trajectory = [];

// Game loop
const DT = 16;
setInterval(() => {
	if (commandQueue.length) {
		if (commandQueue.shift() === 'reset') reset();
	}
	if (ks.d) rocket.nozzle.v[Y] -= .3;
	if (ks.l) rocket.rotate(-1);
	if (ks.r) rocket.rotate(1);
	if (ks.u) rocket.thrust();
	if (ks.z) rocket.setThrottle(rocket.maxThrottle);
	if (ks.x) rocket.setThrottle(0);
	if (ks.H) rocket.increaseThrottle(.008); // Shift
	if (ks.C) rocket.increaseThrottle(-.008); // Ctrl
	// if (ks.S) rocket.nextStage(); // Space

	particles.run();
	for (let sim of sims) {
		for (let o of sim.H) {
			o.g = calcPlanetGravity(o.m, o.c);
			// This is a trick: The `F` force is always overwritten during the physics `run`,
			// so we will add it to the gravity instead.
			setPos(o.g, addVectors(o.g, o.F));
		}
		sim.run();
		sim.collisions = getCollisionsById(sim);
	}
	rocket.run(DT);
	rocket.compound.calc();
	trajectory = calcTrajectory(rocket.compound);

	{ // Check rainbow
		rainbow.c = polar2Vector(rainbow.mag, rainbow.angle);
		const d = distance(rocket.compound.com, rainbow.c);
		if (Math.abs(d - rainbow.r) <= (rainbow.w/2)) rocket.refuel(3);
	}

	// console.log(rocket.body.c[0], rocket.body.c[1]);
	// console.log(sim1.M().length, sims[1].M().length);
	// if (sims[1].M().length) console.log(sims[1].M())
	missions.check(rocket);
	if (lookCooldown <= 0) look = [...rocket.body.c];
	lookCooldown -= DT;
}, DT);

const $ = id => document.getElementById(id);
const setHTML = (el, html) => el.innerHTML !== html && (el.innerHTML = html);
const setText = (el, txt) => el.innerText !== txt && (el.innerText = txt);

const render = () => {
	setCam(look, lookCooldown < -2e3);
	const speed = magnitude(rocket.compound.v);
	draw(sims, particles, speed < .1 ? [] : [trajectory], missions, rainbow);
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
	setText(msnnum, missions.index + 1);
	setText(msntot, missions.length);
	setHTML(
		msnos,
		missions.current().objectives.map((o, i) => '<li data-obj="' + i + '">' + (o.completed ? '✅' : '') + (o.description || 'Do thing') + '</li>').join('')
	);
	setHTML(msndone, missions.completed() >= 1 ? '<u data-key="E">Next mission [Enter]</u>' : '');
	requestAnimationFrame(render);
};

requestAnimationFrame(render);

window.g = { ks, rocket };
