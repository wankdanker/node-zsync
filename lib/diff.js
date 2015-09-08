var debug = require('./debug');
var list = require('./list');
var once = require('once');

module.exports = diff;

function diff(opts, cb) {
	var sourceSnapshots
		, destinationSnapshots
		, destinationExists = true
		;
	
	cb = once(cb);

	debug('diff(): diffing snapshots between %s and %s on %s', opts.source, opts.destination, opts.destinationHost || 'local');

	listSourceSnapshots();

	function listSourceSnapshots () {
		debug('diff(): requesting source snapshots for %s', opts.source);

		//get list of snapshots available on the local source
		list({
			source : opts.source
			, type : 'snap'
			, recursive : true
		}, function (err, sourceList) {
			if (err) {
				err.message = 'Error getting list of local snapshots: ' + err.message;
				return cb(err);
			}

			sourceSnapshots = (sourceList || [])
				//filter out any recursive snapshots that are not the source
				.filter(function (snap) { return snap.name.split('@')[0] === opts.source })
				//return only the snapshot portion
				.map(function(snap) { return snap.name.split('@')[1] });
			
			debug('diff(): found %s source snapshots', sourceSnapshots.length);

			listDestinationSnapshots();
		});
	}

	function listDestinationSnapshots() {
		debug('diff(): requesting destination snapshots for %s on %s', opts.destination, opts.destinationHost || 'local');

		//get a list of snapshots available on the destinationHost dataset
		list({
			source : opts.destination
			, host : opts.destinationHost
			, type : 'snap'
			, recursive : true
		}, function (err, destinationList) {
			if (err && ~err.message.indexOf('dataset does not exist')) {
				destinationExists = false;
			}
			else if (err) {
				err.message = 'Error getting list of destination snapshots: ' + err.message;
				return cb(err);
			}

			destinationSnapshots = (destinationList || [])
				//filter out any recursive snapshots that are not the source
				.filter(function (snap) { return snap.name.split('@')[0] === opts.destination })
				//return only the snapshot portion
				.map(function (snap) { return snap.name.split('@')[1] });

			debug('diff(): found %s destination snapshots', destinationSnapshots.length);

			finish()
		});
	}

	function finish() {
		var result = {
			work : true
			, sourceSnapshots : sourceSnapshots
			, destinationSnapshots : destinationSnapshots
		};

		result.toSnap = opts.source + '@' + sourceSnapshots[sourceSnapshots.length -1];

		if (!sourceSnapshots.length) {
			return cb(new Error('No local snapshots exist for ' + opts.source));
		}

		if (destinationExists) {
			//find the most recent snapshot in destination that also exists in source
			//that is our fromSnap

			for (var x = destinationSnapshots.length -1; x >= 0; x--) {
				if (~sourceSnapshots.indexOf(destinationSnapshots[x])) {
					result.fromSnap = opts.source + '@' + destinationSnapshots[x];
					break;
				}
			}
		}
		
		if (result.toSnap === result.fromSnap) {
			result.message = 'Destination has most recent snapshot';
			result.work = false;
		}

		return cb(null, result);
	}
}