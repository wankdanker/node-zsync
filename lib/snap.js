var debug = require('./debug');
var run = require('./run');
var list = require('./list');
var each = require('./each');
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
 *   * atomic - boolean; create all possible snapshots at once; default false
 */

function snap(opts, cb) {
	cb = once(cb);
	
	debug('snap(): running snap function')
	
	opts.dateFormat = opts.dateFormat || 'yyyymmddHHMMssl';
	
	if (opts.atomic) {
		return snapatomic(opts, cb);
	}

	return snapeach(opts, cb);
}

function snapatomic(opts, cb) {
	list(opts, function (err, datasets) {
		if (err) {
			return cb(err);
		}
		
		var snaps = [];
		var timestamp = dateformat(new Date(), opts.dateFormat);

		datasets.forEach(function (dataset) {
			var snapshot = snapName(opts, dataset, timestamp);

			debug('snapatomic(): adding snapshot to list of snapshots to take: %s on %s', snapshot, opts.sourceHost || 'local');
			
			snaps.push(snapshot);
		});

		run({
			command : 'snapshot'
			, snapshots : snaps
			, host : opts.sourceHost
		}, cb);
	});
}

function snapeach(opts, cb) {
	each(opts, function (dataset, next) {
		var timestamp = dateformat(new Date(), opts.dateFormat);
		var snapshot = snapName(opts, dataset, timestamp);
			
		debug('snapeach(): taking snapshot of %s on %s', snapshot, opts.sourceHost || 'local');
			
		run({
			command : 'snapshot'
			, snapshots : [snapshot]
			, host : opts.sourceHost
		}, function (err) {
			if (err && !opts.continue) {
				cb(err);

				return next(false);
			}

			return next(true);
		});
	}, cb);
}

function snapName(opts, dataset, timestamp) {
	var snapshot = ['zsync'];
	
	if (opts.tag) {
		snapshot.push(opts.tag);
	}

	snapshot.push(timestamp);

	snapshot = opts.snapshot || snapshot.join('-');
	snapshot = dataset.name + '@' + snapshot;

	return snapshot;
}
