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
 *   * source - name of the destination dataset; eg: pool2
 *   * sourceHost - host name of the destination host
 * * cb(err)
 *   * err - error if any
 */

function destroy(opts, cb) {
	debug('destroy(): destroying %s on %s', opts.source, opts.sourceHost);
	
	run({
		command : 'destroy'
		, source : opts.source
		, host : opts.sourceHost
		, recursive : opts.recursive
	}, function (err) {
		if (err) {
			return cb(err);
		}

		return cb(null);
	});
}