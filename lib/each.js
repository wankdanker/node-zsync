var debug = require('./debug');
var list = require('./list');
var doWhile = require('dank-do-while');
var diff = require('./diff');
var sendreceive = require('./send-receive');
var once = require('once');

module.exports = each;

function each(opts, fn, cb) {
	var sourceDatasets;
	
	cb = once(cb);

	listSourceDatasets();

	function listSourceDatasets () {
		list({
			type : opts.type
			, recursive : opts.recursive
			, glob : opts.glob
			, exclude : opts.exclude
			, source : opts.source
			, host : opts.sourceHost
		}, function (err, list) {
			sourceDatasets = list;

			processDatasets();
		});
	}

	function processDatasets () {
		debug('each(): found %s source datasets to process', sourceDatasets.length);

		doWhile(function (next) {
			var dataset = sourceDatasets.shift();
			
			if (!dataset) {
				return next(false);
			}

			fn(dataset, next);
		}, cb);
	}
}