import { colorToHex, clamp, X, Y, TWO_PI, lerpVectors } from './utils.js';
import { PLANET_RADIUS, ATMOS_RADIUS, PLANET_CENTER } from './planet.js';

const c = a.getContext`2d`
c.font = 'bold 50px Verdana';
a.width = 800;
a.height = 800;
const rendW = a.width / 2, rendH = a.height / 2;
let cam = [0, 0];
let zoom = 1;
// Screen to world
export const s2w=(x,y)=>[(x - rendW) / zoom + cam[X], (y - rendH) / zoom + cam[Y]];
// World to screen
export const w2s=([x,y])=>[(x - cam[X]) * zoom + rendW, (y - cam[Y]) * zoom + rendH];

export const setCam = (goalCam, now) => cam = now ? [...goalCam] : lerpVectors(cam, goalCam, 0.1);
const setZoom = z => { zoom = clamp(z, 0.005, 2);
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

function drawText(text, pos, color, borderColor = '#fff', size = 18) {
	c.font = `bold ${Math.round((size + size * zoom) / 2)}px Verdana`;
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	const [x, y] = w2s(pos);
	c.fillStyle = color;
	c.strokeStyle = borderColor;
	c.strokeText(text, x, y);
	c.fillText(text, x, y);
}

export const draw = (sims, particles, trajectories, missions, e, r) => {
	// reset canvas
	a.width ^= 0;

	// Draw the planet
	const screenPos = w2s([0, 0]);
	const gradient = c.createRadialGradient(...screenPos, 0, ...screenPos, ATMOS_RADIUS * zoom);
	[
		[0, 200, 200, 200, .7], // center
		[.5, 136, 204, 255, 1], // sky color #8cf
		[.7, 136, 204, 255, 1], // sky
		[1, 255, 0, 200, .05], // blend red/purplish to nearly transparent
	].forEach(([p, r, g, b, a]) => gradient.addColorStop(p, `rgba(${r},${g},${b},${a})`));
	c.beginPath();
	c.arc(...screenPos, ATMOS_RADIUS * zoom, 0, TWO_PI);
	c.fillStyle = gradient;
	c.fill();

	// Draw objects within the physics sims
	for (let sim of sims) {
		// draw shapes
		for (e of sim.H) {
			if (e.e >= 0) {
				const color = sim.collisions?.[e.e] ? '#ccca' : e.d || '#fffc';
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
				c.stroke()
				c.restore();
			
				// anchors
				for (r of e.p) {
					drawCircle(r, 3, '#6b6');
				}
			} else {
				// console.log(e);
			}
		}
		
		// joints
		for(e of sim.J){
			c.beginPath(),
			c.strokeStyle="#fa0",
			// TODO: Fix coordinates here
			c.moveTo(e.A.p[e.a][0],e.A.p[e.a][1]),
			c.lineTo(e.B.p[e.b][0],e.B.p[e.b][1]),
			c.stroke(),
			c.closePath()
		}
	}
	const now = new Date();
	// drawText('🦄', cam);
	missions.objs(o => {
		if (o.completed && now - o.completed > 3e3) return;
		// if (o.completed - now < 1) console.log(o.completed - now);
		// const a = o.completed ? clamp(255 - (now - o.completed)/1000, 0, 255) : 255;
		const color = o.completed ? '#595' : '#955';
		drawCircle(o.pos, o.r, color, 0);
		if (zoom > .07) drawText(o.completed ? '✅' : o.description, o.pos, color);
	});
	trajectories.forEach(traj => traj.forEach(pos => {
		drawCircle(pos, 5, '#fff2');
	}));
	particles.ea((i, tLeft, x, y, z, vX, vY, vZ, r, g, b, a) => {
		// console.log(JSON.stringify(pos));
		if (tLeft <= 0) return;
		// console.log(r,g, b, a,colorToHex(r, g, b, a) );
		c.beginPath();
		c.fillStyle = colorToHex(r, g, b, a);
		c.arc(...w2s([x, y]), 4 + clamp(z / 20, -3, 3), 0, 7);
		c.fill();
		c.closePath();
	});
};
