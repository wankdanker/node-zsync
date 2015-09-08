var debug = require('./debug');
var list = require('./list');
var doWhile = require('dank-do-while');
var diff = require('./diff');
var sendreceive = require('./send-receive');
var once = require('once');

module.exports = each;

/*
 * each(opts, fn, cb)
 * 
 * Obtain a list of datasets from the list function then pass each dataset to fn. When done cb is called
 * 
 * * opts
 *   * type - dataset type; eg: volume;filesystem;snapshot
 *   * recurseive - recursively search datasets
 *   * glob - comma separated search globs
 *   * exclude - comma separated globs to exclude
 *   * source - source dataset
 *   * host - host on which to execute list command; default is local
 * * fn(dataset, next)
 *   * dataset - a dataset object which describes a matched dataset
 *     * name - name of the dataset
 *     * used - amount of space used by dataset
 *     * avail - amount of space available if dataset is removed
 *     * refer - amount of spaced referenced by the dataset
 *     * mountpoint - path to where the dataset is mounted
 *   * next(doMore) - call this function when you are done doing things with dataset.
 *     * Pass true if you want to want to process the next dataset (if any)
 *     * Pass false if you want to end processing
 */

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