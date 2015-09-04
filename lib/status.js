var debug = require('./debug');
var diff = require('./diff');
var each = require('./each');
var nameDrop = require('./name-drop');
var once = require('once');
var join = require('path').join;

module.exports = status;

function status(opts, cb) {
	cb = once(cb);
	
	var datasets = [];
	
	each(opts, function (dataset, next) {
		var name = nameDrop(dataset.name, opts.destinationDrop, opts.destinationKeep);
		
		var req = {
			source : dataset.name
			, sourceHost : opts.sourceHost
			, destination : join(opts.destination, name)
			, destinationHost : opts.destinationHost
		};

		debug('status(): requesting diff between %s and %s on %s', req.source, req.destination, req.destinationHost || 'local');
		
		diff(req, function (err, result) {
			result = result || {};
			
			result.source = req.source;
			result.destination = req.destination;
			result.destinationHost = req.destinationHost;
			
			datasets.push(result);
			
			if (err && !opts.continue) {
				cb(err);

				return next(false);
			}

			if (!result.work) {
				debug('status(): no work to be done with message: %s', result.message);
				
				return next(true);
			}

			req.fromSnap = result.fromSnap;
			req.toSnap = result.toSnap;

			debug('status(): there is work to be done between %s and %s', result.fromSnap, result.toSnap);
			
			return next(true);
		});
	}, function done() {
		return cb(null, datasets);
	});
}