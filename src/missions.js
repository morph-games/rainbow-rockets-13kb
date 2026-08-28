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
				pos: [0, -PLANET_RADIUS - 300],
				description: 'Launch into circle',
			},
		]
	},
	{
		objectives: [
			{
				...enterZoneType,
				pos: [100, -PLANET_RADIUS - 700],
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
missions.next = () => {
	if (missions.completed() < 1) return false;
	missions.index = Math.min(missions.index + 1, missions.length - 1);
	return true;
};
missions.current = () => missions[missions.index];
missions.objs = (cb) => missions.current().objectives.forEach(cb);
missions.check = (rkt) => missions.objs(o => {
	if (!o.completed && o.check(rkt)) o.completed = new Date();
});
missions.completed = () => missions.current().objectives.reduce((sum, o) => sum + (o.completed ? 1 : 0), 0)
	/ missions.current().objectives.length;
