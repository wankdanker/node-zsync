#!/usr/bin/env nodejs
var zsync = require('./lib/zsync');
var debug = require('./lib/debug');
var prog = require('commander');
var table = require('text-table');

var slice = Function.prototype.call.bind(Array.prototype.slice);

prog.command('list [glob]')
	.description('list file systems')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')
	
	.option('-t, --type [type]', 'filter file system types')
	.option('-g, --glob [glob]', 'dataset-glob search glob')
	.option('-x, --exclude [glob]', 'exclude datasets by glob, comma separated')
	.option('-R, --recursive', 'recursive fs lookup')
	
	.option('-s, --source [dataset]', 'fs/vol name')
	.option('-S, --source-host [host]', 'host on which the source dataset resides')
	
	.option('-f, --format [format]', 'output format (json?)')
	.option('-v, --verbose', 'verbose output')
	.option('-V, --debug', 'enable debug output.')

	.action(list)

prog.command('status [glob] [destination] [destination-host]')
	.description( 'get the sync status between a source dataset and destination dataset')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')

	.option('-t, --type [type]', 'filter file system types')
	.option('-g, --glob [glob]', 'dataset-glob search glob')
	.option('-x, --exclude [glob]', 'exclude datasets by glob, comma separated')
 	.option('-R, --recursive', 'Send all fileystems/volumes in source-dataset')
	
	.option('-s, --source [dataset]', 'source-dataset, eg: pool/vol1, pool')
	.option('-S, --source-host [host]', 'host on which the source dataset resides')
	
	.option('-d, --destination [name]', 'destination-base, eg: pool2/virtual-disks, pool2')
	.option('-D, --destination-host [host]', 'host on which the destination dataset resides')
	.option('-n, --destination-drop [number]', '[number] of elements to drop from the left side of [source-dataset].')
	.option('-N, --destination-keep [number]', '[number] of elements to keep from the right side of [source-dataset]')
	
	.option('-f, --format [format]', 'output format (json?)')
	.option('-v, --verbose', 'verbose output')
	.option('-V, --debug', 'enable debug output.')
	.action(status)

prog.command('push [glob] [destination] [destination-host]')
	.description( 'push a local dataset to another dataset optionally on a remote host')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')

	.option('-t, --type [type]', 'filter file system types')
	.option('-g, --glob [glob]', 'dataset-glob search glob')
	.option('-x, --exclude [glob]', 'exclude datasets by glob, comma separated')
 	.option('-R, --recursive', 'Send all fileystems/volumes in source-dataset')
	
	.option('-s, --source [source-dataset]', 'source-dataset, eg: pool/vol1, pool')
	.option('-S, --source-host [source-host]', 'host on which the source dataset resides')
	
	.option('-d, --destination [name]', 'destination-base, eg: pool2/virtual-disks, pool2')
	.option('-D, --destination-host [host]', 'host on which the destination dataset resides')
	.option('-n, --destination-drop [number]', '[number] of elements to drop from the left side of [source-dataset].')
	.option('-N, --destination-keep [number]', '[number] of elements to keep from the right side of [source-dataset]')
	
	.option('-F, --force', 'force receive (may cause rollback)')
	.option('-r, --replication', 'enable a replication stream')
	.option('-c, --continue', 'continue on to the next dataset if errors are encountered')
	
	.option('-f, --format [format]', 'output format (json?)')
	.option('-v, --verbose', 'verbose output')
	.option('-V, --debug', 'enable debug output.')
	.action(push)

prog.command('receive [dataset]')
	.description( 'receive a dataset via stdin')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')

	.option('-F, --force', 'force receive (may cause rollback)')
	.option('-d, --destination [dataset]', 'destination-base, eg: pool2/virtual-disks, pool2')
	
	.option('-f, --format [format]', 'output format (json?)')
	.option('-v, --verbose', 'verbose output')
	.option('-V, --debug', 'enable debug output.')
	
	.action(receive)

prog.parse(process.argv);

if (!process.argv.slice(2).length) {
	prog.outputHelp();
}

function list(glob) {
	var opts = parseOpts(arguments[arguments.length - 1]);

	opts.command = 'list';
	
	//for some reason, sometimes commander is passing "true" as the glob
	//that's not what we want
	opts.glob = (typeof glob === 'string' && glob !== 'true') ? glob : opts.glob;

	if (opts.glob) {
		opts.glob = opts.glob.split(',');
	}

	if (opts.exclude) {
		opts.exclude = opts.exclude.split(',');
	}
	
	if (opts.debug) {
		debug.enable('zsync');
	}
	
	run(opts, function (err, list) {
		if (err) {
			console.error(err.message);
			
			process.exit(1);
		}

		list.forEach(function (dataset) {
			console.log('%s', dataset.name);
		});
	});
}

function status(glob, destination, destinationHost) {
	var opts = parseOpts(arguments[arguments.length - 1]);

	opts.command = 'status';
	opts.destination = opts.destination || destination;
	opts.destinationHost = opts.destinationHost || destinationHost;
	
	//for some reason, sometimes commander is passing "true" as the glob
	//that's not what we want
	opts.glob = (typeof glob === 'string' && glob !== 'true') ? glob : opts.glob;
	
	if (opts.glob) {
		opts.glob = opts.glob.split(',');
	}
	
	if (opts.exclude) {
		opts.exclude = opts.exclude.split(',');
	}
	
	if (opts.debug) {
		debug.enable('zsync');
	}
	
	run(opts, function (err, result) {
		if (err) {
			console.log(err.message);
			
			process.exit(1);
		}

		
		var data = result.map(function (dataset) {
			return [
				dataset.source || ''
				, dataset.destination || ''
				, dataset.destinationHost || 'local'
				, !dataset.work || false
				, dataset.fromSnap || ''
			];
		});
		
		data.unshift([
			'source'
			, 'destination'
			, 'destination-host'
			, 'up-to-date'
			, 'latest-snap-shot'
		]);
		
		var t = table(data);
		
		console.log(t);
	});
}

function push(glob, destination, destinationHost) {
	var opts = parseOpts(arguments[arguments.length - 1]);

	opts.command = 'push';
	opts.destination = opts.destination || destination;
	opts.destinationHost = opts.destinationHost || destinationHost;
	
	//for some reason, sometimes commander is passing "true" as the glob
	//that's not what we want
	opts.glob = (typeof glob === 'string' && glob !== 'true') ? glob : opts.glob;

	if (opts.glob) {
		opts.glob = opts.glob.split(',');
	}
	
	if (opts.exclude) {
		opts.exclude = opts.exclude.split(',');
	}
	
	if (opts.debug) {
		debug.enable('zsync');
	}
	
	run(opts, function (err, result) {
		if (err) {
			console.log('Error running push commmand:', err.message);
			
			process.exit(1);
		}

		console.log('done');
	});
}

function receive(destination) {
	var opts = parseOpts(arguments[arguments.length - 1]);
	
	opts.command = 'receive';
	opts.destination = opts.destination || destination;
	opts.stream = process.stdin;

	if (opts.debug) {
		process.env.DEBUG = 'zsync';
	}
	
	run(opts, function (err, result) {
		if (err) {
			console.error(err.message);

			return process.exit(1);
		}
		
		console.error('receive ended');
		console.error(err);
		console.error(result);
	});
}

function parseOpts(opts) {
	var obj = {};
	var avoid = ['parent', 'options', 'commands'];

	if (!opts) {
		return obj;
	}

	Object.keys(opts).forEach(function (opt) {
		if (/^_/.test(opt) || ~avoid.indexOf(opt)) {
			return;
		}

		obj[opt] = opts[opt];
	});

	return obj;
}

function run(opts, cb) {
	var format = opts.format;

	if (opts.remote) {
		opts.format = opts.hasOwnProperty('format') ? opts.format : 'json';
	}

	fn = zsync[opts.command];

	if (format === 'json') {
		//if the requested format is JSON then we just
		//execute the requested function and output the returned
		//arguments as JSON. We don't call the callback
		return fn(opts, function (err) {
			var args = slice(arguments);

			//apparently errors don't convert to JSON nicely
			//fix 'em up as normal objects
			if (err) {
				args[0] = { message : err.message };

				Object.keys(err).forEach(function (key) {
					args[0][key] = err[key];
				});
			}

			return process.stdout.write(JSON.stringify(args));
		});
	}
	//else

	fn(opts, cb);
}
