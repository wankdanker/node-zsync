#!/usr/bin/env nodejs
var zsync = require('./lib/zsync');
var prog = require('commander');
var slice = Function.prototype.call.bind(Array.prototype.slice);
console.error('hello', process.pid);
prog.command('list [dataset]')
	.description('list file systems')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')
	.option('-r, --remote [remote]', 'remote server')
	.option('-t, --type [type]', 'filter file system types')
	.option('-f, --format [format]', 'output format (json?)')
	.option('-n, --name [name]', 'fs/vol name')
	.option('-R, --recursive [recursive]', 'recursive fs lookup')
	.action(list)

prog.command('send <source-dataset> <destination-dataset> <destination-host>')
	.description( 'send a local filesystem/volume to a remote server at remote filesystem/volume')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')
	.option('-r, --remote [remote]', 'remote server')
	.option('-t, --type [type]', 'filter file system types')
	.option('-f, --format [format]', 'output format (json?)')
	.option('-n, --name [name]', 'fs/vol name')
	.action(send)

prog.command('receive')
	.description( 'receive a dataset via stdin')
	.option('-u, --user [user]', 'remote ssh user')
	.option('-k, --key [key]', 'path to ssh private key')
	.option('-r, --remote [remote]', 'remote server')
	.option('-t, --type [type]', 'filter file system types')
	.option('-f, --format [format]', 'output format (json?)')
	.option('-n, --name [name]', 'fs/vol name')
	.option('-d, --dataset [dataset]', 'fs/vol name')
	.action(receive)

prog.parse(process.argv);

if (!process.argv.slice(2).length) {
	prog.outputHelp();
}

function list(args, opts) {
	opts = parseOpts(opts);

	opts.command = 'list';

	if (args) {
		opts.name = args;
	}

	run(opts, function (err, list) {
		console.log(arguments);
	});
}

function send(dataset, remoteDataset, remoteHost, opts) {
	opts = parseOpts(opts);

	opts.command = 'send';
	opts.dataset = dataset;
	opts.remoteDataset = remoteDataset;
	opts.remote = remoteHost;

	run(opts, function (err, result) {
		console.log(err);
		console.log(result);
	});
}

function receive(opts) {
	console.error('running receive');
	opts = parseOpts(opts);
	
	opts.command = 'receive';
	//opts.dataset = dataset;
	opts.stream = process.stdin;

	run(opts, function (err, result) {
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
		opts.format = opts.format || 'json';
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
