import { PI, distance, clamp } from './utils.js';

export const PLANET_CENTER = [0, 0];
export const PLANET_RADIUS = 9e3;
const ATMOS_HEIGHT = 1e4;
export const ATMOS_RADIUS = PLANET_RADIUS + ATMOS_HEIGHT;
const ATMOS_SCALE_HEIGHT = ATMOS_HEIGHT / 3.6; // <-- 3.x is just a magic number that feels right
export const PLANET_MASS = PLANET_RADIUS * PLANET_RADIUS * PI / 20;
// const SEA_LEVEL_PRESSURE = 1e3;
export const calcAltitude = (r) => r - PLANET_RADIUS;
// Pressure should be near zero above the atmosphere radius, and go to 1 at planet radius
export const calcPressurePercentAtRadius = (r) => clamp(Math.E ** (-(calcAltitude(r)) / ATMOS_SCALE_HEIGHT));
export const calcDampening = (pos) => .99 + (1 - calcPressurePercentAtRadius(distance(pos, PLANET_CENTER))) * .0099;
export const setDampeningForPressure = (shape) => shape.dm = calcDampening(shape.c);

const GRAV = 0.002;
const gravForce = (m1, [x1, y1], m2, [x2, y2]) => {
	const dx = x2 - x1,
		dy = y2 - y1,
		r2 = dx * dx + dy * dy; // Radius squared
	if (r2 === 0) return [0, 0]; // Prevent division by zero
	const forceMagnitude = (GRAV * m1 * m2) / r2;
	const r = Math.sqrt(r2),
		// Unit vector direction from v1 to v2
		dirX = dx / r,
		dirY = dy / r;
	// Scale the unit vector
	return [forceMagnitude * dirX, forceMagnitude * dirY];
};
export const calcPlanetGravity = (m, pos) => gravForce(60, pos, PLANET_MASS, PLANET_CENTER);
// ^ Using a fixed mass here so that mass of objects don't make a difference so it feels more
// like earth, where the difference of mass between planet and objects makes the object's mass
// not matter.
