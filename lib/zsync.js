var zfs = require('./zfs').zfs;
var Progress = require('./progress');
var sshexec = require('ssh-exec');
var gather = require('gather-stream');
var once = require('once');
var minimatch = require('minimatch');
var doWhile = require('dank-do-while');
var debug = require('debug')('zsync');

var USER = process.env.USER;
var HOST = 'localhost';
var KEY = null;

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
			process.stderr.write(data);
		});

		opts.stream.pipe(receiveStream).on('end', cb);
	});
}

function sendreceive(opts, cb) {
	debug('sendreceive(): sending fromSnap %s to toSnap %s to %s on %s'
		, opts.fromSnap, opts.toSnap, opts.destination, opts.destinationHost || 'local');

	run({
		command : 'receive'
		, destination : opts.destination
		, host : opts.destinationHost
		, streams : (opts.destinationHost) ? true : false
		, verbose : true
		, force : opts.force
	}, function (err, receiveStream) {
		var sendStream;

		if (err) {
			err.message = "Error setting up destination receive: " + err.message;
			return cb(err);
		}

		//if we are doing a remote receive then we need to
		//gather the JSON response
		if (opts.destinationHost) {
			receiveStream.pipe(gatherJSON(function (err, data) {
				debug('sendreceive(): ReceiveStream: gather cb:', err, data);

				if (err) {
					sendStream.end();
				}

				cb(err, data);
			}));
		}

		receiveStream.on('error', function (err) {
			debug('sendreceive(): ReceiveStream.on(error):', err);

			cb(err);
		});

		receiveStream.on('verbose', function (data) {
			debug('sendreceive(): ReceiveStream.on(verbose):', data.trim());
		});

		receiveStream.on('end', function () {
			debug('sendreceive(): ReceiveStream.on(end)');
			//cb()
		});

		run({
			command : 'send'
			, incremental : opts.fromSnap
			, intermediary : true
			, properties : true
			, snapshot : opts.toSnap
			, verbose : true
			, replication : opts.replication
		}, function (err, s) {
			sendStream = s;
			sendStream.on('error', function (err) {
				debug('sendreceive(): SendStream.on(error):', err);
				cb(err);
			});

			sendStream.on('end', function () {
				debug('sendreceive(): SendStream.on(end)');
				//cb();
			});

			sendStream.on('verbose', function (data) {
				data = data.trim();
				debug('sendreceive(): SendStream.on(verbose):', data);

				var progress = Progress(data);

				debug('sendreceive(): SendStream.on(verbose):', progress);
			});

			sendStream.pipe(receiveStream)
		});
	});
}

function run(opts, cb) {
	if (opts.host) {
		opts.format = opts.format || 'json';
		
		fn = runremote;
	}
	else {
		if (!zfs[opts.command]) {
			throw new Error("command does not exist in zfs module: " + opts.command);
		}

		fn = zfs[opts.command];
	}

	fn(opts, cb);	
}

function runremote(opts, cb) {
	var cmd = ['zsync', opts.command];
	var avoid = ['command', 'host', 'remote', 'user', 'key', 'args', 'streams'];

	Object.keys(opts).forEach(function (opt) {
		if (~avoid.indexOf(opt) || !opts[opt]) { 
			return;
		}

		cmd.push('--' + opt);
		cmd.push(opts[opt]);
	});

	if (opts.args) {
		cmd.push([].concat(opts.args).join(' '));
	}

	cmd = cmd.join(' ');

	var sshopts = {
		host : opts.host || HOST
		, user : opts.user || USER
		, key : opts.key || KEY
		, debug : debug
	};

	var child;

	debug('runremote(): executing: %s', cmd);

	child = sshexec(cmd, sshopts);

	child.on('warn', function (data) {
		child.emit('verbose', data);

		debug('runremote(): RemoteStderr: %s', data);
	});

	if (opts.streams) {
		return cb(null, child);
	}

	child.pipe(gatherJSON(cb));
}

function gatherJSON(cb) {
	return gather(function (err, data) {
		if (err) {
			return cb(err);
		}

		data = data.toString();

		if (!data) {
			return cb(new Error('No data returned from remote call'));
		}

		try {
			var json = JSON.parse(data);
		}
		catch (e) {
			return cb(e, data);
		}
		
		if (json[0]) {
			//an error was returned; make it an error object
			err = json[0];

			var e = new Error(err.message);

			//copy key/values to real error object
			Object.keys(err).forEach(function (key) {
				e[key] = err[key];
			});

			json[0] = e;
		}

		cb.apply(null, json);
	});
}
