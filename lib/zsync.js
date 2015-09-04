process.env.DEBUG = 'zsync';

var run = require('./run');
var sendreceive = require('./send-receive');

var once = require('once');
var minimatch = require('minimatch');
var doWhile = require('dank-do-while');
var debug = require('debug')('zsync');

module.exports.list = list;
module.exports.diff = diff;
module.exports.push = push;
module.exports.receive = receive;

function list(opts, cb) {
	opts.command = 'list';
	
	debug('list(): looking up datasets: type %s, source %s, glob %s, exclude %s'
		, opts.type, opts.source, opts.glob, opts.exclude);
	
	run(opts, function (err, list) {
		if (err) {
			return cb(err);
		}

		list = list || [];

		if (opts.glob) {
			list = list.filter(function (dataset) { 
				return minimatch(dataset.name, opts.glob);
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

function push(opts, cb) {
	var sourceDatasets;
	
	cb = once(cb);

	listLocalDatasets();

	function listLocalDatasets () {
		list({
			type : opts.type
			, recursive : opts.recursive
			, glob : opts.glob
			, exclude : opts.exclude
			, source : opts.source
		}, function (err, list) {
			sourceDatasets = list;

			processDatasets();
		});
	}

	function processDatasets () {
		debug('push(): found %s source datasets to send', sourceDatasets.length);

		doWhile(function (next) {
			var dataset = sourceDatasets.shift();
			
			if (!dataset) {
				return next(false);
			}

			var name = dataset.name.split('/').pop();
			var req = {
				source : dataset.name
				, destination : opts.destination + '/' + name
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
}

function diff(opts, cb) {
	var sourceSnapshots
		, destinationSnapshots
		, destinationExists = true
		;
	
	cb = once(cb);

	debug('diff(): diffing snapshots between %s and %s on %s', opts.source, opts.destination, opts.destinationHost || 'local');

	listSourceSnapshots();

	function listSourceSnapshots () {
		debug('diff(): requesting source snapshots for %s', opts.source);

		//get list of snapshots available on the local source
		list({
			source : opts.source
			, type : 'snap'
			, recursive : true
		}, function (err, sourceList) {
			if (err) {
				err.message = 'Error getting list of local snapshots: ' + err.message;
				return cb(err);
			}

			sourceSnapshots = (sourceList || []).map(function(snap) { return snap.name.split('@')[1] });

			debug('diff(): found %s source snapshots', sourceSnapshots.length);

			listDestinationSnapshots();
		});
	}

	function listDestinationSnapshots() {
		debug('diff(): requesting destination snapshots for %s on %s', opts.destination, opts.destinationHost || 'local');

		//get a list of snapshots available on the destinationHost dataset
		list({
			source : opts.destination
			, host : opts.destinationHost
			, type : 'snap'
			, recursive : true
		}, function (err, destinationList) {
			if (err && ~err.message.indexOf('dataset does not exist')) {
				destinationExists = false;
			}
			else if (err) {
				err.message = 'Error getting list of destination snapshots: ' + err.message;
				return cb(err);
			}

			destinationSnapshots = (destinationList || []).map(function (snap) { return snap.name.split('@')[1] });

			debug('diff(): found %s destination snapshots', destinationSnapshots.length);

			finish()
		});
	}

	function finish() {
		var result = {
			work : true
		};

		result.toSnap = opts.source + '@' + sourceSnapshots[sourceSnapshots.length -1];

		if (!sourceSnapshots.length) {
			return cb(new Error('No local snapshots exist for ' + opts.source));
		}

		if (destinationExists) {
			//find the most recent snapshot in destination that also exists in source
			//that is our fromSnap

			for (var x = destinationSnapshots.length -1; x >= 0; x--) {
				if (~sourceSnapshots.indexOf(destinationSnapshots[x])) {
					result.fromSnap = opts.source + '@' + destinationSnapshots[x];
					break;
				}
			}
		}
		
		if (result.toSnap === result.fromSnap) {
			result.message = 'Destination has most recent snapshot';
			result.work = false;
		}

		return cb(null, result);
	}
}

function receive(opts, cb) {
	cb = once(cb);

	opts.command = 'receive';
	opts.verbose = true;

	run(opts, function (err, receiveStream) {
		if (err) {
			return cb(err);
		}

		receiveStream.on('error', function (err) {
			//suppress ECONNRESET errors
			if (err.code === 'ECONNRESET') {
				return;
			}

			debug('receive(): receiveStream.on(error):', err);

			cb(err);
		});

		receiveStream.on('verbose', function (data) {
			debug('receive(): receiveStream.on(verbose):', data);

			process.stderr.write(data);
		});

		receiveStream.on('close', function () {
			debug('receive(): receiveStream.on(close)');

			cb();
		});

		opts.stream.pipe(receiveStream);
	});
}
