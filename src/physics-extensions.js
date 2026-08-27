export const getCollisionsById=(sim, o={}, m, a, b)=>{
	for (m of sim.M()) { // Loop over manifolds
		a = m.A.e, b = m.B.e;
		o[a] = o[a] ? [b, ...(o[a] || [])] : [b];
		o[b] = o[b] ? [a, ...(o[b] || [])] : [b];
	}
	return o;
};
