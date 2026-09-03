const PARTICLE_MAX = 10000;
const NUMBERS_PER_PARTICLE = 16;
const INDEX_MAX = PARTICLE_MAX * NUMBERS_PER_PARTICLE;
export const particles = {
	lastParticle: new Date,
	gravity: [0, 0, 0],
	particles: new Float32Array(INDEX_MAX),
	// 1 number for time left
	// 3 numbers for position
	// 3 numbers for velocity
	// 4 numbers for color
	// 4 number for goal color

	// Loops through each particle
	// If the callback returns truthy then stop there and return the index
	ea(fn) {
		let i = 0, u = 0, p = this.particles;
		for (; i < INDEX_MAX; i += NUMBERS_PER_PARTICLE) {
			// if (p[i] > 0) console.log('\t', i, p.slice(i, i + NUMBERS_PER_PARTICLE - 1));
			if (fn(i, ...p.slice(i, i + NUMBERS_PER_PARTICLE - 1))) return i;
		}
	},
	run(dt = 16) {
		this.count = 0;
		let p = this.particles;
		this.ea((i, tLeft, x, y, z, vX, vY, vZ) => {
			if (tLeft <= 0) return;
			this.count++;
			// console.log({ x, y, z, vX, vY, vZ });
			const [gx, gy, gz] = this.gravity;
			p.set([
				tLeft - dt,
				x + gx + vX,
				y + gy + vY,
				z + gz + vZ,
			], i);
		});
		// console.log(this.count);
	},
	new(lifeTime, pos, vel, radius, color, goalColor) {
		const now = new Date();
		// console.log(now - this.lastParticle);
		// if (now - this.lastParticle < 16) return;
		this.lastParticle = now;
		// Find empty index
		// if undefined then overwrite the first slot (later we could make this more sophisticated
		// by overwriting the closest particle to dead, but that might have performance implications)
		const i = this.ea((i, tLeft) => tLeft <= 0) || 0;
		if (pos.length !== 3 || vel.length !== 3 || color.length !== 4) {
			console.error('Invalid particle params', arguments);
			return;
		}
		this.particles.set([
			lifeTime * 1e3,
			...pos,
			...vel,
			radius,
			...color,
			...(goalColor || color),
		], i);
		// console.log('New particle at index', i);
	}
};