import { PLANET_RADIUS } from './planet.js';
import { distance } from './utils.js';

const enterZoneType = {
	pos: [0, 0],
	r: 100,
	description: 'Enter the zone',
	check(rkt) {
		return distance(rkt.compound.com, this.pos) < this.r;
	},
	// completed: null, // <-- replace with timestamp
};

export const missions = [
	{
		objectives: [
			{
				...enterZoneType,
				pos: [0, -PLANET_RADIUS - 700],
			},
			{
				...enterZoneType,
				pos: [-120, -PLANET_RADIUS],
				description: 'Land here',
				r: 80,
			},
		]
	}
];
missions.index = 0;
missions.current = () => missions[missions.index];
missions.check = (rkt) => missions.current().objectives.forEach(o => {
	if (!o.completed && o.check(rkt)) o.completed = new Date();
});
