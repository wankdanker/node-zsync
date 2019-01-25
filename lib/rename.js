var debug = require('./debug');
var run = require('./run');

module.exports = rename;

/*
 * rename(opts, cb)
 * 
 * this function will destroy datasets
 * 
 * * opts
 *   * source - name of the destination dataset; eg: pool2
 *   * sourceHost - host name of the destination host
 *   * name - the new name of `source`; eg: pool2-renamed-20190125
 *   * force - force unmounting filesystems
 *   * recursive - recursively rename snapshots
 *   * parents - create missing parent volumes
 * * cb(err)
 *   * err - error if any
 */

function rename(opts, cb) {
	debug('rename(): renaming %s on %s to %s', opts.source, opts.sourceHost, opts.name);
	
	run({
		command : 'rename'
		, source : opts.source
		, host : opts.sourceHost
		, name : opts.name
		, force : opts.force
		, recursive : opts.recursive
		, parents : opts.parents
	}, function (err) {
		if (err) {
			return cb(err);
		}

		return cb(null);
	});
}