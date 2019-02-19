var debug = require('./debug');
var run = require('./run');
var minimatch = require('minimatch');

module.exports = list;

/*
 * list(opts, cb)
 * 
 * this function lists datasets and uses the minimatch module to filter unwanted datasets
 * 
 * * opts
 *   * glob - a comma separated or array list of globs to search for in the list of datasets
 *   * exclude - a comma separated or array list of globs to exclude from the list of datasets
 *   * type - dataset type; eg: volume,filesystem,snapshot
 *   * source - source dataset to restrict recursive lookups; eg: pool1
 *   * recursive - use recursion for the intial list lookup (ie: zfs list -r)
 * * cb(err, list)
 *   * err - error if any
 *   * list - array of matching datasets
 */

function list(opts, cb) {
	opts.command = 'list';
	
	if (opts.glob && typeof opts.glob === 'string') {
		opts.glob = opts.glob.split(',');
	}

	if (opts.exclude && typeof opts.exclude === 'string') {
		opts.exclude = opts.exclude.split(',');
	}

	debug('list(): looking up datasets: type %s, source %s:%s, glob %s, exclude %s'
		, opts.type, opts.host || 'local', opts.source, opts.glob, opts.exclude);

	run(opts, function (err, list) {
		if (err) {
			return cb(err);
		}

		list = list || [];

		if (opts.glob) {
			list = list.filter(function (dataset) {
				return opts.glob.filter(function (glob) {
					return minimatch(dataset.name, glob);
				}).length;
			});
		}

		if (opts.exclude) {
			list = list.filter(function (dataset) {
				return !opts.exclude.filter(function (glob) {
					return minimatch(dataset.name, glob);
				}).length;
			});
		}

		return cb(null, list);
	});
}
