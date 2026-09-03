export const { sin, cos, hypot, min, max, PI, random, round, floor } = Math;
export const X = 0, Y = 1;
export const TWO_PI = PI * 2;
export const colorTo255 = (color) => color.map(n => round(n * 255));
export const colorToHex = (color) => color255ToHex(colorTo255(color));
export const color255ToHex = (color) => {
	if (color.length !== 4) console.error('Invalid color', color);
	return `#${color.map(n=>(floor(Number(n))).toString(16).padStart(2, '0')).join('')}`;
};
export const clamp = (n, minA = 0, maxB = 1) => min(max(n, minA), maxB);
export const angle2Vector = (a) => [cos(a), sin(a)];
export const magnitude = ([x, y]) => hypot(x, y); // aka. length
export const vector2Polar = ([x, y]) => ({ angle: Math.atan2(y, x), magnitude: hypot(x, y) });
export const polar2Vector = (magnitude, angle = 0) => [magnitude * cos(angle), magnitude * sin(angle)];
// ^ Note: Angle zero is to the right
export const distance = ([x1, y1], [x2, y2]) => hypot(x2 - x1, y2 - y1);
export const setPos = (destPos, [x, y]) => { destPos[X] = x; destPos[Y] = y; };
export const addVectors = ([x1, y1], [x2, y2]) => [x1 + x2, y1 + y2];
export const subtractVectors = ([x1, y1], [x2, y2]) => [x1 - x2, y1 - y2];
export const scale = ([x, y], s) => [x * s, y * s];
export const normalize = (v, length = 1) => {
	const len = magnitude(v);
	return len ? scale(v, length/len) : [0, length];
};
// a = start vector, b = end vector, t = interpolation factor 0-1
export const lerpVectors = (a, b, t) => [a[X] + (b[X] - a[X]) * t, a[Y] + (b[Y] - a[Y]) * t];
export const rand = (a = 1, b = 0) => b + random() * (a - b);
export const randInt = (a, b = 0) => floor(rand(a, b));
// ^ Some functions thanks for LittleJS
export const randBell = (b) => random() * b - random() * b;
