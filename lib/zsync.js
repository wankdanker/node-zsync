var zfs = require('./zfs').zfs;
var sshexec = require('ssh-exec');
var gather = require('gather-stream');
var once = require('once');
var minimatch = require('minimatch');
var doWhile = require('dank-do-while');
var debug = require('debug')('zsync');

var USER = process.env.USER;
var REMOTE = 'localhost';
var KEY = null;

module.exports.list = list;
module.exports.send = send;
module.exports.sendGlob = sendGlob;
module.exports.receive = receive;

function list(opts, cb) {
	opts.command = 'list';

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

function sendGlob(opts, cb) {
	var localDatasets;
	
	cb = once(cb);

	listLocalDatasets();

	function listLocalDatasets () {
		list({
			type : opts.type
			, recursive : opts.recursive
			, glob : opts.glob
			, exclude : opts.exclude
			, dataset : opts.dataset
		}, function (err, list) {
			localDatasets = list;

			processDatasets();
		});
	}

	function processDatasets () {
		debug('sendGlob(): found %s datasets to send', localDatasets.length);

		doWhile(function (next) {
			var dataset = localDatasets.shift();
			
			if (!dataset) {
				return next(false);
			}

			var name = dataset.name.split('/').pop();

			send({
				dataset : dataset.name
				, remoteDataset : opts.remoteDataset + '/' + name
				, remote : opts.remote
				, force : opts.force
			}, function (err) {
				if (err) {
					cb(err);

					return next(false);
				}

				return next(true);
			});
		}, cb);
	}
}

function send(opts, cb) {
	var localSnapshots
		, remoteSnapshots
		, localDatasets
		, remoteExists = true
		;
	
	cb = once(cb);

	debug('send(): sending %s to %s on %s', opts.dataset, opts.remoteDataset, opts.remote);

	listLocalSnapshots();

	function listLocalSnapshots () {
		debug('send(): listing local snapshots for %s', opts.dataset);

		//get list of snapshots available on the local dataset
		list({
			name : opts.dataset
			, type : 'snap'
			, recursive : true
		}, function (err, localList) {
			if (err) {
				err.message = 'Error getting list of local snapshots: ' + err.message;
				return cb(err);
			}

			localSnapshots = (localList || []).map(function(snap) { return snap.name.split('@')[1] });

			debug('send(): found %s local snapshots', localSnapshots.length);

			listRemoteSnapshots();
		});
	}

	function listRemoteSnapshots() {
		debug('send(): listing remote snapshots for  %s on %s', opts.remoteDataset, opts.remote);

		//get a list of snapshots available on the remote dataset
		list({
			name : opts.remoteDataset
			, remote : opts.remote
			, type : 'snap'
			, recursive : true
		}, function (err, remoteList) {
			if (err && ~err.message.indexOf('dataset does not exist')) {
				remoteExists = false;
			}
			else if (err) {
				err.message = 'Error getting list of remote snapshots: ' + err.message;
				return cb(err);
			}

			remoteSnapshots = (remoteList || []).map(function (snap) { return snap.name.split('@')[1] });

			debug('send(): found %s remote snapshots', remoteSnapshots.length);

			finish()
		});
	}

	function finish() {
		opts.toSnap = opts.dataset + '@' + localSnapshots[localSnapshots.length -1];

		if (!localSnapshots.length) {
			return cb(new Error('No local snapshots exist for ' + opts.dataset));
		}

		if (remoteExists) {
			//find the most recent snapshot in remote that also exists in local
			//that is our fromSnap

			for (var x = remoteSnapshots.length -1; x >= 0; x--) {
				if (~localSnapshots.indexOf(remoteSnapshots[x])) {
					opts.fromSnap = opts.dataset + '@' + remoteSnapshots[x];
					break;
				}
			}
		}
		
		sendReceive(opts, cb);
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

function sendReceive(opts, cb) {
	debug('sendReceive(): sending fromSnap %s to toSnap %s to %s on %s'
		, opts.fromSnap, opts.toSnap, opts.remoteDataset, opts.remote || 'local');

	run({
		command : 'receive'
		, dataset : opts.remoteDataset
		, remote : opts.remote
		, streams : (opts.remote) ? true : false
		, verbose : true
		, force : opts.force
	}, function (err, receiveStream) {
		var sendStream;

		if (err) {
			err.message = "Error setting up remote receive: " + err.message;
			return cb(err);
		}

		//if we are doing a remote receive then we need to
		//gather the JSON response
		if (opts.remote) {
			receiveStream.pipe(gatherJSON(function (err, data) {
				debug('sendReceive(): ReceiveStream: gather cb:', err, data);

				if (err) {
					sendStream.end();
				}


				cb(err, data);
			}));
		}

		receiveStream.on('error', function (err) {
			debug('sendReceive(): ReceiveStream.on(error):', err);

			cb(err);
		});

		receiveStream.on('verbose', function (data) {
			debug('sendReceive(): ReceiveStream.on(verbose):', data.trim());
		});

		receiveStream.on('end', function () {
			debug('sendReceive(): ReceiveStream.on(end)');
			cb()
		});

		run({
			command : 'send'
			, incremental : opts.fromSnap
			, intermediary : true
			, properties : true
			, snapshot : opts.toSnap
			, verbose : true
		}, function (err, s) {
			sendStream = s;
			sendStream.on('error', function (err) {
				debug('sendReceive(): SendStream.on(error):', err);
				cb(err);
			});

			sendStream.on('end', function () {
				debug('sendReceive(): SendStream.on(end)');
				cb();
			});

			sendStream.on('verbose', function (data) {
				debug('sendReceive(): SendStream.on(verbose):', data.trim());
			});

			sendStream.pipe(receiveStream)
		});
	});
}

function run(opts, cb) {
	if (opts.remote) {
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
	var avoid = ['command', 'remote', 'user', 'key', 'args', 'streams'];

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
		host : opts.remote || REMOTE
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
