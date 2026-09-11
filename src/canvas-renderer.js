import { colorToHex, color255ToHex, clamp, X, Y, PI, TWO_PI, lerpVectors, addVectors, sin, cos,
	lerp, rand, randBell,
	scale, vector2Polar, polar2Vector, magnitude, 
	subtractVectors,
	vectorAngle} from './utils.js';
import { PLANET_RADIUS, ATMOS_RADIUS, PLANET_CENTER } from './planet.js';

export const ROYGB = [
	[255, 0, 0],
	[255, 100, 0],
	[255, 255, 0],
	[0, 255, 0],
	[0, 0, 255],
];

const c = a.getContext`2d`
c.font = 'bold 50px Verdana';
a.width = window.innerWidth - 2;
a.height = window.innerHeight - 2;
const rendW = a.width / 2, rendH = a.height / 2;
const avgRendDim = (rendW + rendH) / 2;
const rendUnit = avgRendDim / 4;
const rendCenter = [rendW, rendH];
let hq = 0; // High quality?
let cam = [0, 0];
let zoom = 1;
let goalZoom = 1;
let zoomSpeed = .5; // How fast the zoom lerps to goalZoom
let rt = 0; // Render time
// Screen to world
export const s2w = (x,y) => [(x - rendW) / zoom + cam[X], (y - rendH) / zoom + cam[Y]];
// World to screen
export const w2s = ([x,y], z = zoom)=>[(x - cam[X]) * z + rendW, (y - cam[Y]) * z + rendH];

export const setCam = (goalCam, now) => cam = now ? [...goalCam] : lerpVectors(cam, goalCam, 0.1);
export const setZoom = (z, goalOnly) => {
	if (!goalOnly) zoom = z;
	goalZoom = z;
};
export const setZoomSpeed = (s = .5) => zoomSpeed = s;
const updateZoom = z => {
	goalZoom = clamp(z, 0.005, 2.5);
	// console.log(zoom)
};
export const getZoom = () => zoom;
const ZOOM_SENSITIVITY = 0.0015;
// event.deltaY is positive when scrolling down (zoom out), negative when scrolling up (zoom in)
export const wheelZoom = deltaY => updateZoom(zoom * Math.exp(-event.deltaY * ZOOM_SENSITIVITY));
export const incZoom = n => updateZoom(zoom + n);

function drawCircle([x, y], r, color, filled = 1) {
	c.beginPath();
	if (filled) c.fillStyle = color; // colorToHex(r, g, b, a);
	else c.strokeStyle = color;
	c.arc(...w2s([x, y]), r * zoom, 0, 7);
	if (filled) c.fill();
	else c.stroke();
	c.closePath();
}

function drawText(text, pos, color, borderColor = '#fff', size = 18, lw = 8) {
	c.save();
	c.font = `bold ${Math.round((size + size * zoom) / 2)}px Verdana`;
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	const [x, y] = w2s(pos);
	c.fillStyle = color;
	c.lineWidth = lw;
	c.strokeStyle = borderColor;
	c.strokeText(text, x, y);
	c.fillText(text, x, y);
	c.restore();
}

function getRainbowGradient(pos1, pos2, a = 'f') {
	const [startX, startY] = w2s(pos1);
	const [endX, endY] = w2s(pos2);
	const grad = c.createLinearGradient(startX, startY, endX, endY);
	[
		[0, 'f00'], // red
		[.15, 'f70'], // orange
		[.4, 'cc0'], // yellow
		[.6, '3c0'], // green
		[.85, '00c'], // blue
		[1, 'c0c'], // purple
	].forEach(([n, rgb]) => grad.addColorStop(n, `#${rgb}${a}`));
	return grad
}

function drawRadialGradient(gradCenter, gradR, colors, center, r) {
	c.save();
	const gradientPos = w2s(gradCenter);
	const gradient = c.createRadialGradient(...gradientPos, 0, ...gradientPos, gradR * zoom);
	colors.forEach(([p, c]) => gradient.addColorStop(p, '#' + c));
	c.beginPath();
	c.arc(...w2s(center), r * zoom, 0, TWO_PI);
	c.fillStyle = gradient;
	c.fill();
	c.restore();
}

function drawGuideLine(angle, dist, color, type = 0) {
	// Types:
	// 0 = basic arrow
	// 1 = no point
	// 2 = speed (no base)
	// 3 = flat
	c.save();
	c.beginPath();
	let arrowAngle = .75;
	if (type === 3) arrowAngle = .5;
	else if (type === 2) arrowAngle = .68;
	arrowAngle *= PI;
	// let arrowAngle = PI * (type === 3 ? .5 : .8);
	let arrowLength = 10;
	// c.moveTo(rendW, rendH);
	const d = clamp(dist, 0, 1);
	const len = (rendUnit * d) + (rendUnit * 1.3);
	const base = addVectors(rendCenter, polar2Vector(len, angle));
	const point = addVectors(rendCenter, polar2Vector(len + (rendUnit * .2), angle));
	if (type !== 2) {
		c.moveTo(...base);
		c.lineTo(...point);
	}
	if (type !== 1) {
		c.moveTo(...addVectors(point, polar2Vector(arrowLength, angle - arrowAngle)));
		c.lineTo(...point);
		c.lineTo(...addVectors(point, polar2Vector(arrowLength, angle + arrowAngle)));
	}
	c.lineWidth = 4;
	c.lineCap = 'round';
	c.strokeStyle = color;
	c.stroke();
	c.restore();
}

function renderMountains(m, color) {
	c.save();
	c.beginPath();
	c.moveTo(...w2s(m[0]));
	for (let i = 0; i < m.length; i++) {
		c.lineTo(...w2s(m[i]));
	}
	c.fillStyle = color;
	c.fill();
	c.restore();
}

// ----- Make Planet terrain -----

function makeMountains(n = 1, da = .05) {
	const m = []; // Mountains
	let h = 0;
	for (let a = 0; a <= TWO_PI; a += da) {
		h = (h + rand(200) - rand(200) + rand(300 * n)) / 2;		
		m.push(addVectors(PLANET_CENTER, polar2Vector(PLANET_RADIUS + h, a)));
	}
	return m;
}

const mts = makeMountains(1, .04); // Mountains
const backMts = makeMountains(2, .02);

// --------------------------- DRAW -----------------------------
export const draw = (dt, sims, particles, trajectories, missions, clouds, rainbows, rkt, options,
	e, r, speed, alt
) => {
	rt += dt;
	// reset canvas
	a.width ^= 0;

	zoom = lerp(zoom, goalZoom, zoomSpeed);

	// Get some values that are needed in a few places
	const { v, com } = rkt.compound;
	speed = magnitude(v);
	const vectorToCenter = subtractVectors(PLANET_CENTER, com);
	alt = magnitude(vectorToCenter) - PLANET_RADIUS; // altitude
	
	const shakePercent = clamp(1 - (alt / 600), 0, 1);
	if (shakePercent) {
		const screenShakeScale = rkt.lastAppliedEnginePower * 4 * shakePercent;
		cam[X] += sin(rt) * screenShakeScale;
		cam[Y] += cos(rt) * screenShakeScale / 2;
	}


	// Draw the planet's Sky
	drawRadialGradient(
		PLANET_CENTER,
		ATMOS_RADIUS,
		[
			[0, 'cccf'], // center
			[.45, 'ccff'],
			[.5, '8cff'], // sky color #8cf
			[.6, '8cfd'], // sky
			[.8, '6464ff80'],
			[1, 'ff00c80d'], // blend red/purplish to nearly transparent
		],
		PLANET_CENTER,
		ATMOS_RADIUS
	);
	// Sky shadow
	drawRadialGradient(
		addVectors(PLANET_CENTER, [-PLANET_RADIUS / 10, -PLANET_RADIUS * 1.2]),
		ATMOS_RADIUS * 1.8,
		[
			[0, '0000'],
			[.45, '0000'],
			[.5, '5051'],
			[.55, '0009'],
			[1, '000a'],
		],
		PLANET_CENTER,
		ATMOS_RADIUS
	);

	// Draw the planet's background montains
	renderMountains(backMts, '#0213');
	renderMountains(mts, '#355'); // 4ab

	// Draw rainbows
	for (let rb of rainbows) {
		if (rb.w && rb.lft) {
			c.save();
			if (hq) c.filter = 'drop-shadow(0 0 12px #fff6)';
			const rr = rb.r * zoom;
			const rainbowWidth = rb.w * zoom;
			const rc = w2s(rb.c);
			const grad = c.createRadialGradient(...rc, rr + rainbowWidth/2, ...rc, rr - rainbowWidth/2);
			[
				[0, 'f00'], // red
				[.2, 'f70'], // orange
				[.4, 'ee0'], // yellow
				[.6, '3c0'], // green
				[.8, '22e'], // blue
				[1, 'c0c'], // purple
			].forEach(([n, rgb]) => grad.addColorStop(n, `#${rgb}c`));
			c.beginPath();
			c.arc(...rc, rr, 0, TWO_PI);
			c.lineWidth = rainbowWidth;
			c.strokeStyle = grad;
			c.stroke();
			c.closePath();
			c.restore();
		}
	}

	// Draw the planet
	drawRadialGradient(
		addVectors(PLANET_CENTER, [-PLANET_RADIUS / 10, -PLANET_RADIUS * .8]),
		PLANET_RADIUS * 1.1,
		[
			[0, '4ab'],
			[1, '021'],
		],
		PLANET_CENTER,
		PLANET_RADIUS,
	);

	// Draw clouds
	{
		c.save();
		if (hq) c.filter = 'blur(2px) drop-shadow(0 4px 8px #0003)';
		// c.fillStyle = '#fff';
		clouds.forEach(q => {
			c.save();
			c.beginPath();
			c.fillStyle = colorToHex(q.clr);
			c.translate(...w2s(q.c));
			c.rotate(q.pc[1] + (PI / 2));
			const zr = q.r * zoom;
			// Add a throbbing sin wave element to the radius if we are seeding the cloud
			const r = q.r + (q.seeding ? (q.r * .05 * sin(rt / 100)) : 0);
			c.arc(0, 0, r * zoom, 0, 7);
			[
				[zr, zr * .2, .7],
				[-zr, zr * .2, .7],
				[zr * 1.8, zr * .45, .4],
				[-zr * 1.8, zr * .35, .4],
			].forEach(([x, y, r]) => {
				c.arc(x, y, zr * r, 0, 7);
			});

			// [
			// 	[[zr, zr * .3], .7],
			// 	[[-zr, zr * .3], .7],
			// 	[[zr * 1.8, zr * .4], .4],
			// 	[[-zr * 1.8, zr * .4], .4],
			// ].forEach(([offset, r]) => {
			// 	c.arc(...addVectors(q.c, offset), zr * r, 0, 7);
			// });

			// c.arc(...w2s(q.c), q.r * zoom, 0, 7);
			// [
			// 	[[q.r, q.r * .3], .7],
			// 	[[-q.r, q.r * .3], .7],
			// 	[[q.r * 1.8, q.r * .4], .4],
			// 	[[-q.r * 1.8, q.r * .4], .4],
			// ].forEach(([offset, r]) => {
			// 	c.arc(...w2s(addVectors(q.c, offset)), q.r * r * zoom, 0, 7);
			// });
			c.fill();
			c.restore();
		});
		c.restore();
	}

	// Draw objects within the physics sims
	for (let sim of sims) {
		const lineSize = 20;
		// const vp = vector2Polar(v);
		// const speed = magnitude(v);
		// Loop over all shapes
		for (e of sim.H) {
			// Draw speed lines for all vertices in the rocket
			if (e.e >= 0 && e.rocketPart && speed > 2) {
				c.save();
				c.beginPath();
				// Loop over vertices
				for (let i = 0; i < e.V.length; i++) {
					c.moveTo(...w2s(e.V[i]));
					c.lineTo(...w2s(addVectors(e.V[i], scale(v, -lineSize))));
				}
				const grad = c.createLinearGradient(
					...w2s(addVectors(com, scale(v, lineSize))),
					...w2s(addVectors(com, scale(v, -lineSize)))
				);
				[
					[0, 'fff3'],
					[1, 'fff0'],
				].forEach(([n, rgb]) => grad.addColorStop(n, `#${rgb}`));
				c.strokeStyle = grad;
				c.lineWidth = 4;
				c.closePath(),
				c.fill(),
				c.stroke();
				c.restore();
			}
		}
		// draw shapes
		for (e of sim.H) {
			if (e.e >= 0) {
				if (e.rocketPart && e.damaged) {
					// Smoke from damaged parts
					if (rand() < 0.3) {
						particles.new(rand(10), e.c, [randBell(.5), -.8, randBell(1)], 8, [55, 30, 30, 100], [35, 30, 30, 0]);
						// TODO: Make this so it goes up regardless of where on the planet you are
					}
				}
				// const color = sim.collisions?.[e.e] ? '#ccca' : e.d || '#fffc';
				const color = e.color || '#eeef';
				c.save(),
				c.beginPath();
				
				// circle
				if (e.t === 1) { // CIRCLE
					c.fillStyle=color,
					c.translate(...w2s(e.c)),
					c.rotate(e.a),
					c.arc(0,0,e.w * zoom,0,7)
					// c.lineTo(0,0) // <-- needed to visibly see rotations on circles
				} else { // rectangle
					c.fillStyle = color,
					c.moveTo(...w2s(e.V[0])),
					[1,2,3].forEach(i=>c.lineTo(...w2s(e.V[i])));
					// c.lineTo(...w2s(e.V[1])),
					// c.lineTo(...w2s(e.V[2])),
					// c.lineTo(...w2s(e.V[3]))
					// c.moveTo(...w2s(e.V[0], e.rocketPart ? 1 : zoom)),
					// c.lineTo(...w2s(e.V[1], e.rocketPart ? 1 : zoom)),
					// c.lineTo(...w2s(e.V[2], e.rocketPart ? 1 : zoom)),
					// c.lineTo(...w2s(e.V[3], e.rocketPart ? 1 : zoom))
				}
				
				c.closePath(),
				c.fill();
				if (e.line) {
					c.lineWidth = e.line[0];
					c.strokeStyle = e.line[1];
					c.stroke();
				}
				// c.stroke();
				c.restore();

				if (e.emoji) {
					drawText(e.emoji, e.c, '#fff', '#888', (e.emojiSize || 12) * zoom, 4);
				}
			
				// anchors
				// for (r of e.p) {
				// 	drawCircle(r, 3, '#6b6');
				// }
			} else {
				// console.log(e);
			}
		}
		
		// joints
		// for(e of sim.J){
		// 	c.beginPath(),
		// 	c.strokeStyle="#fa0",
		// 	c.moveTo(...w2s(e.A.p[e.a])),
		// 	c.lineTo(...w2s(e.B.p[e.b])),
		// 	c.stroke(),
		// 	c.closePath()
		// }
	}

	const now = new Date();
	// drawText('🦄', cam);
	if (missions && missions.length) {
		missions.objs(o => {
			if (o.completed && now - o.completed > 3e3) return;
			// if (o.completed - now < 1) console.log(o.completed - now);
			// const a = o.completed ? clamp(255 - (now - o.completed)/1000, 0, 255) : 255;
			const color = o.completed ? '#595' : getRainbowGradient(
				addVectors(o.pos, [-o.r, 0]),
				addVectors(o.pos, [o.r, 0])
			);
			c.lineWidth = 8;
			const r =  o.r + (o.completed ? 0 : (o.r * .05 * sin(rt / 200)));
			drawCircle(o.pos, r, color, 0);
			c.lineWidth = 6;
			if (zoom > .07) drawText(o.completed ? '✅' : o.description, o.pos, color);
		});
	}
	
	// trajectories.forEach(traj => traj.forEach(pos => {
	// 	drawCircle(pos, 5, '#fff2');
	// }));
	particles.ea((i, tLeft, x, y, z, vX, vY, vZ, ra, r, g, b, a, goalR, goalG, goalB, goalA) => {
		// console.log(JSON.stringify(pos));
		if (tLeft <= 0) return;
		// console.log('render particle', { i, tLeft, x, y, z, vX, vY, vZ, ra, r, g, b, a });
		// console.log(r,g, b, a,colorToHex(r, g, b, a) );
		c.beginPath();
		c.fillStyle = color255ToHex([r, g, b, a]);
		// console.log('z', z, 'ra', ra, 'final', (1 + clamp(z / 20, -1, 1)) * ra);
		const rad = (
			(1 + clamp(z / 30, -1, 1)) * ra // Grow/shrink based on z coordinate
		) * (
			zoom > 1 ? zoom : (1 + zoom) / 2 // Shrink less than usual when zoomed out
		);
		c.arc(...w2s([x, y]), rad, 0, 7);
		c.fill();
		c.closePath();
	});

	// Add engine lighting
	if (rkt.lastAppliedEnginePower) {
		const r = rkt.lastAppliedEnginePower * 400;
		drawRadialGradient(rkt.nozzle.c, r, [[0, 'f503'], [.1, 'fcb3'], [1, 'ffb0']], rkt.nozzle.c, r);
	}

	{ // Draw guidelines
		const vp = vector2Polar(v);
		if (speed > 1) {
			drawGuideLine(vp.angle, 1, '#fffc', 2);
		}
		const vectorToPlanet = vector2Polar(vectorToCenter);
		if (alt > 500) {
			drawGuideLine(vectorToPlanet.angle, alt / 500, '#3a36', 3);
		}
		if (alt > 500 || speed > 1) {
			drawGuideLine(rkt.core.a - (PI/2), 1, '#f9fc', 1);
			const openObjectives = missions.open?.() || [];
			if (openObjectives.length) {
				const diff = vector2Polar(subtractVectors(openObjectives[0].pos, com));
				drawGuideLine(diff.angle, diff.magnitude / 100, '#ff0a', 0);
			}
		}
	}
};
