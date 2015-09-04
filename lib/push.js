var debug = require('./debug');
var diff = require('./diff');
var sendreceive = require('./send-receive');
var each = require('./each');
var nameDrop = require('./name-drop');
var once = require('once');
var join = require('path').join;

module.exports = push;

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
