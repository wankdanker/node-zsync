var debug = require('./debug');
var diff = require('./diff');
var sendreceive = require('./send-receive');
var each = require('./each');
var nameDrop = require('./name-drop');
var once = require('once');
var join = require('path').join;

module.exports = push;

/*
 * push(opts, cb)
 * 
 * push source snapshots to destination dataset optionally on a destination host
 * 
 * * opts
 *   * [see opts from list]
 *   * destinationDrop - number of elements in the source dataset name to drop from the left
 *   * destinationKeep - number of elements in the source dataset name to keep from the right
 *   * sourceHost - host name of the source server
 *   * destination - name of the destination dataset; eg: pool2
 *   * destinationHost - host name of the destination host
 *   * force - force the receiving side to rollback to the most recent snapshot if data modified
 *   * replication - create replication send stream
 *   * continue - boolean; continue processing each matched datasets even if errors occur; default false
 */

function push(opts, cb) {
	cb = once(cb);
	
	each(opts, function (dataset, next) {
		var name = nameDrop(dataset.name, opts.destinationDrop, opts.destinationKeep);

		var req = {
			source : dataset.name
			, sourceHost : opts.sourceHost
			, destination : join(opts.destination, name)
			, destinationHost : opts.destinationHost
			, force : opts.force
			, replication : opts.replication
			, user : opts.user
			, key : opts.key
		};

		debug('push(): requesting diff between %s and %s on %s', req.source, req.destination, req.destinationHost || 'local');
		
		diff(req, function (err, result) {
			result = result || {};
			
			if (err && !opts.continue) {
				cb(err);

				return next(false);
			}

			if (!result.work) {
				debug('push(): no work to be done with message: %s', result.message);
				
				return next(true);
			}

			req.fromSnap = result.fromSnap;
			req.toSnap = result.toSnap;

			debug('push(): there is work to be done between %s and %s', result.fromSnap, result.toSnap);
			
			sendreceive(req, function (err) {
				if (err && !opts.continue) {
					cb(err);

					return next(false);
				}

				return next(true);
			});
		});
	}, cb);
}
