var debug = require('./debug');
var run = require('./run');
var each = require('./each')
var list = require('./list');
var once = require('once');
var dateformat = require('dateformat');
var doWhile = require('dank-do-while');

module.exports = rotate;

function rotate(opts, cb) {
	cb = once(cb);
	
	debug('rotate(): running snap function')
	
	if (!opts.keep) {
		return cb(new Error('You must specify a value for keep.'));
	}
	
	each(opts, function (dataset, next) {
		var snapshot = ['zsync'];
		
		if (opts.tag) {
			snapshot.push(opts.tag);
		}
		
		snapshot = snapshot.join('-');
		
		var snapReg = new RegExp(snapshot + '-[0-9]+');
		
		debug('rotate(): requesting source snapshots for %s and tag %s', dataset.name, opts.tag);

		//get list of snapshots available on the source
		list({
			source : dataset.name
			, type : 'snap'
			, recursive : true
		}, function (err, sourceList) {
			if (err && !opts.continue) {
				err.message = 'Error getting list of local snapshots: ' + err.message;
				cb(err);

				return next(false);
			}

			debug('rotate(): found %s source snapshots before filtering tags', sourceList.length);
			
			sourceSnapshots = (sourceList || [])
				//filter out any recursive snapshots that are not the source
				.filter(function (snap) { return snap.name.split('@')[0] === dataset.name })
				//return only the snapshot portion
				.map(function(snap) { return snap.name.split('@')[1] })
				//filter out any snapshots that aren't for the requested tag
				.filter(function (snap) { return snapReg.test(snap) })
			
			debug('rotate(): found %s source snapshots while filtering %s', sourceSnapshots.length, snapshot);
			
			var removeSnapshots = sourceSnapshots.splice(0, sourceSnapshots.length - opts.keep);
			
			doWhile(function (check) {
				var snapshot = removeSnapshots.shift();
				
				if (!snapshot) {
					return check(false);
				}
				
				debug('rotate(): destroying %s@%s', dataset.name, snapshot);
				
				run({
					command : 'destroy'
					, source : dataset.name + '@' + snapshot
					, host : opts.sourceHost
				}, function (err, data) {
					if (err && !opts.continue) {
						cb(err);

						return check(false);
					}
					
					return check(true);
				});
			}, function done() {
				debug('rotate(): finished destroying snapshots for %s and tag %s', dataset.name, opts.tag);
				
				return next(true);
			})
		});
	}, function done() {
		return cb(null);
	});
}
