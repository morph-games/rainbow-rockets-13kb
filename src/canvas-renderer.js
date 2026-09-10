import { colorToHex, color255ToHex, clamp, X, Y, PI, TWO_PI, lerpVectors, addVectors, sin, lerp,
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
let hq = 0; // High quality?
let cam = [0, 0];
let zoom = 1;
let goalZoom = 1;
let rt = 0; // Render time
// Screen to world
export const s2w=(x,y)=>[(x - rendW) / zoom + cam[X], (y - rendH) / zoom + cam[Y]];
// World to screen
export const w2s=([x,y])=>[(x - cam[X]) * zoom + rendW, (y - cam[Y]) * zoom + rendH];

export const setCam = (goalCam, now) => cam = now ? [...goalCam] : lerpVectors(cam, goalCam, 0.1);
const setZoom = z => { goalZoom = clamp(z, 0.005, 2.5);
	// console.log(zoom)
};
const ZOOM_SENSITIVITY = 0.0015;
// event.deltaY is positive when scrolling down (zoom out), negative when scrolling up (zoom in)
export const wheelZoom = deltaY => setZoom(zoom * Math.exp(-event.deltaY * ZOOM_SENSITIVITY));
export const incZoom = n => setZoom(zoom + n);

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

export const draw = (dt, sims, particles, trajectories, missions, clouds, rainbows, rkt,
	e, r
) => {
	rt += dt;
	// reset canvas
	a.width ^= 0;

	zoom = lerp(zoom, goalZoom, 0.5);

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
		// draw shapes
		for (e of sim.H) {
			if (e.e >= 0) {
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
					c.fillStyle=color,
					c.moveTo(...w2s(e.V[0])),
					c.lineTo(...w2s(e.V[1])),
					c.lineTo(...w2s(e.V[2])),
					c.lineTo(...w2s(e.V[3]))
				}
				
				c.closePath(),
				c.fill(),
				c.stroke();
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

	const rendUnit = avgRendDim / 4;
	const rendCenter = [rendW, rendH];
	function drawGuideLine(angle, dist, color) {
		c.save();
		c.beginPath();
		// c.moveTo(rendW, rendH);
		const d = clamp(dist, 0, 1);
		const len = (rendUnit * d) + (rendUnit * 1.3);
		c.moveTo(...addVectors(rendCenter, polar2Vector(len, angle)))
		c.lineTo(...addVectors(rendCenter, polar2Vector(len + (rendUnit * .2), angle)));
		c.lineWidth = 4;
		c.lineCap = 'round';
		c.strokeStyle = color;
		c.stroke();
		c.restore();
	}

	{
		const { v, com } = rkt.compound;
		const vp = vector2Polar(v);
		const speed = magnitude(v);
		if (speed > 1) {
			drawGuideLine(vp.angle, 1, '#f9fc');
		}
		const vectorToPlanet = vector2Polar(subtractVectors(PLANET_CENTER, com));
		const height = vectorToPlanet.magnitude - PLANET_RADIUS;
		if (height > 500) {
			drawGuideLine(vectorToPlanet.angle, height / 500, '#3c36');
		}
		if (height > 500 || speed > 1) {
			drawGuideLine(rkt.core.a - (PI/2), 1, '#3333');
			const openObjectives = missions.current().objectives.filter(o => !o.completed);
			if (openObjectives.length) {
				const diff = vector2Polar(subtractVectors(openObjectives[0].pos, com));
				drawGuideLine(diff.angle, diff.magnitude / 100, '#ff0a');
			}
		}
	}
};
