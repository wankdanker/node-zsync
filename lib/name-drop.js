var debug = require('./debug')
module.exports = nameDrop;

/*
 * nameDrop
 * 
 * Process a data set name and return a new name based on drop and keep
 * 
 * By default we keep 1
 * 
 * args:
 * 	name - original name
 * 	drop - number of elements from the left to drop
 * 	keep - number of elements from the right to keep
 */

function nameDrop (name, drop, keep) {
	if (drop == 0 && keep == 0) {
		return name;
	}
	
	if (!drop && !keep) {
		keep = 1;
	}
	
	name = (name || "").split('/');
	
	if (drop) {
		name.splice(0, drop);
	}
	
	if (keep) {
		name.splice(0, name.length - keep);
	}
	
	return name.join('/')
}