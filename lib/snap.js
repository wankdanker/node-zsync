var debug = require('./debug');
var run = require('./run');
var each = require('./each')
var once = require('once');
var dateformat = require('dateformat');

module.exports = snap;

/*
 * snap(opts, cb)
 * 
 * create snapshots on matching datasets
 * 
 * * opts
 *   * [see opts from list]
 *   * dateFormat - date format to format the timestamp included in the snapshot (see https://www.npmjs.com/package/dateformat)
 *   * tag - optional tag to include in the snapshot name; eg: hourly, monthly, daily, random, test, etc
 *   * continue - boolean; continue processing each matched datasets even if errors occur; default false
 */

function snap(opts, cb) {
	cb = once(cb);
	
	debug('snap(): running snap function')
	
	opts.dateFormat = opts.dateFormat || 'yyyymmddHHMMssl';
	
	each(opts, function (dataset, next) {
		var snapshot = ['zsync'];
		
		if (opts.tag) {
			snapshot.push(opts.tag);
		}
		
		snapshot.push(dateformat(new Date(), opts.dateFormat));
		
		snapshot = opts.snapshot || snapshot.join('-');
		
		debug('snap(): creating snapshot %s@%s on %s', dataset.name, snapshot, opts.sourceHost || 'local');
		
		run({
			command : 'snapshot'
			, snapshot : snapshot
			, source : dataset.name
			, host : opts.sourceHost
		}, function (err, data) {
			if (err && !opts.continue) {
				cb(err);

				return next(false);
			}
			
			return next(true);
		})
	}, function done() {
		return cb(null);
	});
}
