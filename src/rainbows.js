import { PI, addVectors, scale, subtractVectors, polar2Vector, distance, rand, round, TWO_PI, vector2Polar, abs } from './utils.js';
import { PLANET_RADIUS } from './planet.js';
import { particles } from './particles.js';
import { ROYGB } from './canvas-renderer.js';
const RB_SIZE = PLANET_RADIUS * .5;
const RB_W = 200;
const RB_R = 7e3;
export const rainbows = [
	{
		// mag: RB_R, angle: -PI * .4, // coordinates
		c:  polar2Vector(RB_R, -PI * .4), // center (position)
		r: RB_SIZE,
		w: RB_W,
		lft: Infinity, // Lifetime
	},
];

rainbows.run = (dt, rkt, rainDoneAngle) => {
	const { com } = rkt.compound;
	rainbows.forEach(rb => {
		rb.lft -= dt;
		if (rb.lft < 2e3) rb.w -= (dt * RB_W) / 2e3;
		const d = distance(com, rb.c);
		if (abs(d - rb.r) <= (rb.w/2)) {
			rkt.refuel(3);
			if (rand() < .1) {
				ROYGB.forEach((col, i) => {
					const c = addVectors(com, polar2Vector(rb.w, rand(TWO_PI)));
					const vel = scale(subtractVectors(c, com), -.015);
					particles.new(1, [...c, -20], [...vel, 1], 4, [...col, 100]);
				});
			}
		}
	});
	for (let i = rainbows.length - 1; i >= 0; i--) {
		if (rainbows[i].lft <= 0) rainbows.splice(i, 1);
	}
	if (rainDoneAngle) {
		const a = round(rainDoneAngle * 5) / 5;
		// If we have a rainbow at this angle, then just increase the life
		const rb = rainbows.find(rb => vector2Polar(rb.c).angle === a);
		if (rb) {
			rb.lft += 1e4 + rand(1e4);
		} else { // ...otherwise make a new rainbow
			rainbows.push({
				c: polar2Vector(RB_R, a),
				r: RB_SIZE * .8 + rand(RB_SIZE * .2),
				w: RB_W,
				lft: 2e4 + rand(5e3),
			});
		}
	}
};
