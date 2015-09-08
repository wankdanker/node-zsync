var debug = require('./debug');
var run = require('./run');
var minimatch = require('minimatch');

module.exports = list;

function list(opts, cb) {
	opts.command = 'list';
	
	if (opts.glob && typeof opts.glob === 'string') {
		opts.glob = opts.glob.split(',');
	}

	if (opts.exclude && typeof opts.exclude === 'string') {
		opts.exclude = opts.exclude.split(',');
	}
	
	debug('list(): looking up datasets: type %s, source %s, glob %s, exclude %s'
		, opts.type, opts.source, opts.glob, opts.exclude);
	
	run(opts, function (err, list) {
		if (err) {
			return cb(err);
		}

		list = list || [];

		if (opts.glob) {
			list = list.filter(function (dataset) {
				return opts.glob.filter(function (glob) {
					return minimatch(dataset.name, glob);
				}).length;
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