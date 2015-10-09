var debug = require('./debug');
var run = require('./run');

module.exports = destroy;

/*
 * destroy(opts, cb)
 * 
 * this function will destroy datasets
 * 
 * * opts
 *   * recursive - boolean; recursively destroy snapshots (and clones?)
 *   * destination - name of the destination dataset; eg: pool2
 *   * destinationHost - host name of the destination host
 * * cb(err)
 *   * err - error if any
 */

function destroy(opts, cb) {
	opts.command = 'destroy';
	
	debug('destroy(): destroying %s on %s', opts.destination, opts.destinationHost);
	
	run(opts, function (err) {
		if (err) {
			return cb(err);
		}

		return cb(null);
	});
}