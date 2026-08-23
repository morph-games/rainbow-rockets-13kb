import { simFactory, RECTANGLE, CIRCLE, SPRING, REPULSIVE, HINGE, FIXED } from './xem-physics-factory.js';
import { particles } from './particles.js';
import { draw, setCam, wheelZoom, incZoom, s2w } from './canvas-renderer.js';
import {
	PLANET_RADIUS, PLANET_CENTER, PLANET_MASS,
	setDampeningForPressure, calcAltitude, calcPlanetGravity,
} from './planet.js';
import { colorToHex, clamp, sin, cos, PI, X, Y, angle2Vector, distance } from './utils.js';


// aka. (v1, v2) => Math.hypot(v2[X] - v1[X], v2[Y] - v1[Y]);
                 


// ---------- World ----------

const sims = [simFactory([0,0])]; // , simFactory()]; // You can have multiple simulations
const s1 = sims[0];
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
	};
	shapeConfigArr.forEach((config) => addShape(config, comp));
	return comp;
}

// Keys by Xem - https://xem.github.io/articles/jsgamesinputs.html
// u=r=d=l=0;
// onkeydown=onkeyup=e=>this['lurd************************l**r************l*d***u**u'[e.which-37]]=e.type[5]

const ks = {}; // { u: 0, r: 0, d: 0, l: 0, S: 0 };
const kt = {
	'-': () => incZoom(-.1),
	'+': () => incZoom(.1),
};
onkeydown = onkeyup = e => {
	ks['T******HC**************S****lurd************************l**r************q*d***u**u'[e.which-9]]=e.type[5]?1:0;
	if (e.which > 186) ks['+*-'[e.which-187]]=e.type[5]?1:0;
	Object.keys(kt).forEach(k => ks[k] && kt[k]?.());
	// console.log(e.which, JSON.stringify(ks));
}
// onkeydown = e => console.log(e, e.type[5], e.which);
// onkeyup = e => console.log(e, e.type[5]);

let cam=[0, 0];
let zoom = 1;

onclick=e=>{
	if (Math.random() < 0.5) {
		rect(...s2w(e.pageX, e.pageY), 20, 20);
	} else {
		circle(...s2w(e.pageX, e.pageY), 10);
	}
	// s1.shape(CIRCLE, , 500, 10);
};

onwheel = (e) => { /* e.preventDefault(); */ wheelZoom(e.deltaY); }

// TODO: Debug weird bug where first shape created is not moving

// Make the physical planet
const planet = s1.shape(CIRCLE, PLANET_CENTER, 0, PLANET_RADIUS);
s1.shape(RECTANGLE, [0, -PLANET_RADIUS - 10], 0, 400, 20); // Platform
s1.shape(RECTANGLE, [300, -PLANET_RADIUS - 100], 0, 100, 250); // Test building

const throttleScale = 0.1;
const MODE_NAMES = ['Burst', 'Sustained Burn'];
const rocket = {
	compound: makeCompound(
		[
			[16, 50, 0, 0], // body
			[16, 16, 0, 25], // engine base
			[12, 16], // engine nozzle
		],
		0, -PLANET_RADIUS * 1.1
	),
	get nozzle() { return this.compound.parts[2]; },
	gim: 0,
	deltaGim: .01,
	gimbal(n) {
		const ogGim = this.gim;
		this.gim = clamp(this.gim + n * this.deltaGim, -.7, .7);
		const dg = ogGim - this.gim;
		this.nozzle.a += dg;
		// console.log(this.nozzle.a);
	},
	engineOn: 0,
	throttle: 0.4,
	maxThrottle: 1,
	setThrottle(t) { this.throttle = clamp(t, 0, this.maxThrottle);	},
	increaseThrottle(dt) { this.setThrottle(this.throttle + dt); },
	thrust() {
		this.applyThrust();
	},
	applyThrust() {
		const noz = this.nozzle;
		const vec = angle2Vector(noz.a - PI/2);
		noz.v[X] += vec[X] * this.throttle;
		noz.v[Y] += vec[Y] * this.throttle;
		// console.log(vec[X], vec[Y]);
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
	run() {
		this.compound.parts.forEach((s) => setDampeningForPressure(s));
		if (this.throttle && this.engineOn) this.applyThrust();
	},
};
rocket.body = rocket.compound.parts[0];
// rocket.body.m /= 3;
rocket.body.f /= 10;
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

join(rocket.compound.parts[0], rocket.compound.parts[1], 0, 25, 0, -8);
join(rocket.compound.parts[1], rocket.nozzle, 0, 8, 0, -7, FIXED);

console.log(rocket, planet);

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

const getCollisionsById=(sim, o={}, m, a, b)=>{
	for (m of sim.M()) { // Loop over manifolds
		a = m.A.e, b = m.B.e;
		o[a] = o[a] ? [b, ...(o[a] || [])] : [b];
		o[b] = o[b] ? [a, ...(o[b] || [])] : [b];
	}
	return o;
};

const calcPartsAltitude = parts =>
	calcAltitude(parts.reduce((low, p) => Math.min(low, distance(p.c, [0, 0])), Infinity));


// X = 0, Y = 1
function calcTrajectory(parts) {
	// Get the total mass of all parts
	const m = parts.reduce((sum, p) => sum + p.m, 0);
	const com = [0, 0]; // Center of mass
	const v = [0, 0];
	// Calculate the center of mass and the average velocity of all parts
	parts.forEach((p) => {
		const massPortion = p.m / m;
		com[X] += p.c[X] * massPortion;
		com[Y] += p.c[Y] * massPortion;
		v[X] += p.v[X] * massPortion;
		v[Y] += p.v[Y] * massPortion;
	});
	// Start the trajectory line at the center of mass
	const traj = [[...com]];
	const dt = 10;
	// Iterate into the future to see where the object will go
	for (let t = 0; t < 1000; t++) {
		const pos = traj[traj.length - 1]; // Get the last position
		// If we go below the planet's radius, then we don't need any more points
		if (distance(pos, [0, 0]) < PLANET_RADIUS) t = 1000;
		const fG = calcPlanetGravity(m, pos);
		const accG = [fG[X] / m, fG[Y] / m];
		v[X] += accG[X] * dt;
		v[Y] += accG[Y] * dt;
		traj.push([
			pos[X] + v[X] * dt,
			pos[Y] + v[Y] * dt,
		]);
	}
	// Return an array of 2d array positions
	return traj;
}


// Game loop
setInterval(() => {
	// time++;
	particles.run();
	for (let sim of sims) {
		for (let o of sim.H) {
			o.g = calcPlanetGravity(o.m, o.c);
		}
		sim.run();
		sim.collisions = getCollisionsById(sim);
	}
	rocket.run();
	setCam([...rocket.compound.parts[2].c]);
	const trajectory = calcTrajectory(rocket.compound.parts);
	draw(sims, particles, [trajectory]);
	altn.innerText = calcPartsAltitude(rocket.compound.parts).toFixed(0).padStart(6, '0');
	thn.innerText = (rocket.throttle * 100).toFixed(1);
	
	if (ks.d) rocket.nozzle.v[Y] -= .3;
	if (ks.l) rocket.gimbal(-1);
	if (ks.r) rocket.gimbal(1);
	if (ks.u) rocket.thrust();
	if (ks.z) rocket.setThrottle(rocket.maxThrottle);
	if (ks.x) rocket.setThrottle(0);
	if (ks.H) rocket.increaseThrottle(.008); // Shift
	if (ks.C) rocket.increaseThrottle(-.008); // Ctrl
	// if (ks.S) rocket.nextStage(); // Space

	// console.log(rocket.body.c[0], rocket.body.c[1]);
	// console.log(sim1.M().length, sims[1].M().length);
	// if (sims[1].M().length) console.log(sims[1].M())
}, 16);

window.g = { ks, rocket };
