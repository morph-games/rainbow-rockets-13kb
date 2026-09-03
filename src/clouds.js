import { PLANET_RADIUS, CLOUD_HEIGHT, PLANET_CENTER } from './planet.js';
import { particles } from './particles.js';
import { X, Y, distance, floor, rand, randInt, randBell, clamp, PI, TWO_PI, polar2Vector, subtractVectors, normalize,
	colorTo255,
 } from './utils.js';

const HCH = CLOUD_HEIGHT / 2; // Half cloud height
const LAYERS = 5;
export const clouds = [];
const CLOUDS = 100;
for (let i = 0; i < CLOUDS; i++) {
	const pc = [ // Polar coordinates
		PLANET_RADIUS + HCH + randBell(HCH * .5),
		rand(TWO_PI),
	];
	const layer = randInt(LAYERS + 1);
	const lp = layer / LAYERS; // Layer percent 0-1
	const r = 50 + (rand(130)) + 50 * lp; // Size
	const al = .6 + (.4 * lp);
	clouds.push({
		c: polar2Vector(...pc),
		pc,
		r,
		spd: rand(),
		area: PI * (r**2),
		layer,
		lp,
		wtr: rand(.2),
		raining: 0,
		al, // alpha
		clr: [1, 1, 1, al],
		seeding: 0,
	});
}
let wind = .0003; // This is the max speed
let cloudTime = 0;
let selfSeedingCloudIndex = 0;
clouds.run = (dt, rkt) => {
	const { com } = rkt.compound;
	cloudTime += dt;
	clouds.forEach((q, i) => {
		const d = distance(com, q.c);
		if (q.raining) {
			if (q.wtr <= 0) q.raining = 0;
			else q.wtr -= rand(.001);
			// Chance of spawning a rain drop particle
			if (rand() < (q.wtr < .5 ? .1 : .2)) {
				const v = normalize(subtractVectors(PLANET_CENTER, q.c), 10);
				v.push(0); // No z movement
				particles.new(4,
					[
						q.c[0] + randBell(q.r),
						q.c[1] + q.r,
						randBell(2)
					],
					v, 3, [180, 220, 255, 205]
				);
			}
		} else { // Not raining
			if (selfSeedingCloudIndex === i) q.wtr += rand(.0001);
			q.raining = q.wtr >= 1;
		}		
		const n = 1 - (.7 * q.wtr);
		q.clr = [n, n, n, q.al];

		const isHigh = q.pc[0] > CLOUD_HEIGHT;
		q.pc[1] += (
			isHigh ? wind / 2 : wind // Move slower up high -- FIXME: this isn't working
		) * (
			(q.lp * .9) + .1 // Lower layers should move more slowly
		);
		q.c = polar2Vector(...q.pc);

		// Is the rocket inside of the cloud's main circle?
		q.seeding = d <= q.r;
		if (q.seeding) {
			q.wtr = clamp(q.wtr + .02, 0, 1); // Seed the cloud
			if (rand() < .3) { // Spawn cloud particles
				const [vx, vy] = rkt.core.v;
				particles.new(
					2,
					[
						com[0] + randBell(q.r),
						com[1] + randBell(q.r),
						0
					],
					[
						vx + rand(-2, 2),
						vy + rand(-2, 2),
						randBell(2),
					],
					10,
					colorTo255([q.clr[0], q.clr[1], q.clr[2], .5]),
				);
			}
		}

		// if (rand() < .01)
		// particles.new(3, [q.c[0], q.c[1], 0],
		// 	[randBell(2), randBell(.5)],
		// 	[...q.clr]
		// );
	});
}
