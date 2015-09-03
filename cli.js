#!/usr/bin/env nodejs
var zsync = require('./lib/zsync');
var prog = require('commander');
var slice = Function.prototype.call.bind(Array.prototype.slice);

prog.command('list')
	.description('list file systems')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')
	.option('-r, --remote [remote]', 'remote server')
	.option('-t, --type [type]', 'filter file system types')
	.option('-f, --format [format]', 'output format (json?)')
	.option('-n, --name [dataset]', 'fs/vol name')
	.option('-R, --recursive', 'recursive fs lookup')
	.option('-e, --exclude [glob]', 'exclude datasets by glob, comma separated')
	.option('-g, --glob [glob]', 'dataset-glob search glob')
	.action(list)

prog.command('send')
	.description( 'send a local filesystem/volume to a remote server at remote filesystem/volume')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')
	.option('-r, --remote [remote]', 'remote server')
	.option('-t, --type [type]', 'filter file system types')
	.option('-f, --format [format]', 'output format (json?)')
	.option('-n, --name [name]', 'source-dataset, eg: pool/vol1, pool')
	.option('-d, --destination [name]', 'destination-base, eg: pool2/virtual-disks, pool2')
	.option('-R, --recursive', 'Send all fileystems/volumes in source-dataset')
	.option('-v, --verbose', 'verbose output')
	.option('-e, --exclude [glob]', 'exclude datasets by glob, comma separated')
	.option('-g, --glob [glob]', 'dataset-glob search glob')
	.option('-F, --force', 'force receive (may cause rollback)')
	.action(send)

prog.command('receive [dataset]')
	.description( 'receive a dataset via stdin')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')
	.option('-r, --remote [remote]', 'remote server')
	.option('-t, --type [type]', 'filter file system types')
	.option('-f, --format [format]', 'output format (json?)')
	.option('-F, --force', 'force receive (may cause rollback)')
	.option('-n, --name [name]', 'fs/vol name')
	.option('-d, --dataset [dataset]', 'fs/vol name')
	.option('-v, --verbose', 'verbose output')
	.action(receive)

prog.parse(process.argv);

if (!process.argv.slice(2).length) {
	prog.outputHelp();
}

function list() {
	var opts = parseOpts(arguments[arguments.length - 1]);

	opts.command = 'list';

	if (opts.exclude) {
		opts.exclude = opts.exclude.split(',');
	}

	run(opts, function (err, list) {
		if (err) {
			console.error(err.message);
		}

		list.forEach(function (dataset) {
			console.log('%s', dataset.name);
		});
	});
}

function send() {
	var opts = parseOpts(arguments[arguments.length - 1]);

	opts.command = 'sendGlob';
	opts.remoteDataset = opts.remoteDataset || opts.destination;

	if (opts.exclude) {
		opts.exclude = opts.exclude.split(',');
	}

	run(opts, function (err, result) {
		if (err) {
			console.log(err.message);
		}

		console.log('done');
	});
}

function receive(dataset) {
	var opts = parseOpts(arguments[arguments.length - 1]);
	
	opts.command = 'receive';
	opts.dataset = opts.dataset || dataset;
	opts.stream = process.stdin;

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
