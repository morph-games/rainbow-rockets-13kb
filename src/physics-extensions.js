import { FIXED, HINGE, RECTANGLE, CIRCLE } from './xem-physics-factory.js';
import { X, Y, abs } from './utils.js';

export const getCollisionsById=(sim, o={}, m, a, b)=>{
	for (m of sim.M()) { // Loop over manifolds
		// Manifold objects contain:
		// A = shape 1
		// B = shape 2
		// c = contact point
		// n = collision normal
		// d = depth / penetration
		a = m.A.e, b = m.B.e;
		// console.log(m);
		o[a] = o[a] ? [b, ...(o[a] || [])] : [b];
		o[b] = o[b] ? [a, ...(o[b] || [])] : [b];
	}
	return o;
};

export function checkCollisions(
	sim, impactImpulseThreshold, cb,
	m, relV, nV, impactSpd, iiA, iiB

) {
	for (m of sim.M()) { // Loop over manifolds
		relV = [ // Relative velocity
			m.A.v[X] - m.B.v[Y],
			m.A.v[Y] - m.B.v[Y]
		];
		// The velocity projected on the normal vector
		nV = relV[X] * m.n[X] + relV[Y] * m.n[Y];
		impactSpd = abs(nV);
		// Calculate the "impact impulse" by considering mass also
		iiA = impactSpd * m.A.m;
		iiB = impactSpd * m.B.m;
		if (iiA > impactImpulseThreshold) cb(m.A, m, iiA);
		if (iiB > impactImpulseThreshold) cb(m.B, m, iiB);
	}
}

export function enableJoint(sim, j) {
	// Re-add joint to the execution loop if not there
	if (!sim.J.includes(j)) sim.J.push(j);
	// For hinge or fixed joints, recalc initial rest orientation
	// TODO: Fix this?
	// if (j.t === HINGE || j.t === FIXED) {
	// 	// j.l = j.B.a - j.A.a;
	// }
	// Disable collisions between connected shapes
	if (!j.A.N.includes(j.B.e)) j.A.N.push(j.B.e);
	if (!j.B.N.includes(j.A.e)) j.B.N.push(j.A.e);
}

export function disableJoint(sim, j) {
	// Remove joint from engine execution loop
	const i = sim.J.indexOf(j);
	if (i > -1) sim.J.splice(i, 1);

	// Restore collision detection between the two shapes
	j.A.N = j.A.N.filter(id => id !== j.B.e);
	j.B.N = j.B.N.filter(id => id !== j.A.e);
}

export function joinAnchors(
	sim, part1, part2, offset1X = 0, offset1Y = 0, offset2X = 0, offset2Y = 0, type = FIXED, str, len
) {
	const a1 = sim.anchor(part1, [offset1X, offset1Y]);
	const a2 = sim.anchor(part2, [offset2X, offset2Y]);
	sim.joint(type, part1, a1, part2, a2, str, len);
	const j = sim.J[sim.J.length - 1]; // Get the new joint
	return { a1, a2, j };
}

export const addShape = (sim, shapeConfig, comp) => {
	const [w, h, offsetX = 0, offsetY = 0, type = RECTANGLE, options = {}] = shapeConfig;
	const mass = w * h; // TODO: handle circles
	comp.parts.push(
		sim.shape(type, [comp.c[X] + offsetX, comp.c[Y] + offsetY], mass, w, h, options)
	);
};

export const makeCompound = (sim, shapeConfigArr, cx, cy) => {
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
	shapeConfigArr.forEach((config) => addShape(sim, config, comp));
	return comp;
}
