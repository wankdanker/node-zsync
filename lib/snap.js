var debug = require('./debug');
var run = require('./run');
var list = require('./list')
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

	list(opts, function (err, datasets) {
		if (err) {
			return cb(err);
		}

		var snaps = [];
		var timestamp = dateformat(new Date(), opts.dateFormat);

		datasets.forEach(function (dataset) {
			var snapshot = ['zsync'];
			
			if (opts.tag) {
				snapshot.push(opts.tag);
			}
		
			snapshot.push(timestamp);
		
			snapshot = opts.snapshot || snapshot.join('-');
			snapshot = dataset.name + '@' + snapshot;

			debug('snap(): adding snapshot to list of snapshots to take: %s on %s', snapshot, opts.sourceHost || 'local');
			
			snaps.push(snapshot);
		});

		run({
			command : 'snapshot'
			, snapshots : snaps
			, host : opts.sourceHost
		}, cb);
	});
}
