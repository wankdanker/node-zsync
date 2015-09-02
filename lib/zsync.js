#!/usr/bin/env nodejs

var zfs = require('zfs').zfs;
var sshexec = require('ssh-exec');
var gather = require('gather-stream');
var once = require('once');

var USER = process.env.USER;
var REMOTE = 'localhost';
var KEY = null;

module.exports.list = list;
module.exports.send = send;
module.exports.receive = receive;

function list(opts, cb) {
	opts.command = 'list';

	if (opts.type) {
		opts.recursive = true;
	}

	run(opts, cb);
}

function send(opts, cb) {
	var local, remote, remoteExists = true;
	
	cb = once(cb);

	listLocal();

	function listLocal () {
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

			local = localList;

			listRemote();
		});
	}

	function listRemote() {
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

			remote = remoteList;

			finish()
		});
	}

	function finish() {
		if (!remoteExists) {
			//do full send
			
			run({
				command : 'receive'
				, dataset : opts.remoteDataset
				, remote : opts.remote
				, streams : true
			}, function (err, receiveStream) {
				if (err) {
					err.message = "Erorr setting up remote receive: " + err.message;

					return cb(err);
				}

				run({
					command : 'send'
					, snapshot : local[local.length - 1].name
					, verbose : true
				}, function (err, sendStream) {
					sendStream.once('error', cb)

					sendStream.on('verbose', function (data) {
						console.error('receiveStream-verbose', data);
					});

					sendStream.pipe(receiveStream).on('end', cb);
				});
			});
		}
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

		receiveStream.once('error', cb);

		receiveStream.on('verbose', function (data) {
			console.error('receiveStream-verbose:', data);
		});

		opts.stream.pipe(receiveStream).on('end', cb);
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
		, debug : console.error
	};

	var child;
	
	child = sshexec(cmd, sshopts);

	child.on('warn', function (e) {
		process.stderr.write('remote: ' + e);
	});

	if (opts.streams) {
		return cb(null, child, child);
	}

	child.pipe(gather(function (err, data) {
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
		
		cb.apply(null, json);
	}));
}

