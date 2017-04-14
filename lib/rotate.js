"use strict";

var debug = require('./debug');
var run = require('./run');
var each = require('./each')
var diff = require('./diff');
var nameDrop = require('./name-drop');
var once = require('once');
var dateformat = require('dateformat');
var doWhile = require('dank-do-while');
var join = require('path').join;
var intersect = require('intersect');

module.exports = rotate;

/*
 * rotate(opts, cb)
 * 
 * rotate snapshots with an optional tag keeping a certain number
 * 
 * * opts
 *   * [see options for list]
 *   * keep - number of snapshots to keep
 *   * tag - optional tag to include in the snapshot name; eg: hourly, monthly, daily, random, test, etc
 *   * sourceHost - host on which to create the snapshots
 * 
 *   * preserveIncremental - boolean; do not destroy local snapshots that are needed for an incremental send to destination
 *   * destinationDrop - number of elements in the source dataset name to drop from the left
 *   * destinationKeep - number of elements in the source dataset name to keep from the right
 *   * destination - name of the destination dataset; eg: pool2
 *   * destinationHost - host name of the destination host
 */

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
		
		var name = nameDrop(dataset.name, opts.destinationDrop, opts.destinationKeep);

		var req = {
			source : dataset.name
			, sourceHost : opts.sourceHost
			, destination : (!opts.preserveIncremental) //if we're not doing preserveIncremental, then we should prevent getting a destination comparison
				? false
				: join(opts.destination, name)
			, destinationHost : opts.destinationHost
			, force : opts.force
			, replication : opts.replication
			, properties : opts.properties
			, user : opts.user
			, key : opts.key
		};

		debug('rotate(): requesting source snapshots for %s and tag %s', dataset.name, opts.tag);
		debug('rotate(): requesting diff between %s and %s on %s', req.source, req.destination, req.destinationHost || 'local');
		
		diff(req, function (err, result) {
			result = result || {};

			if (err && !opts.continue) {
				err.message = 'Error getting list of snapshots: ' + err.message;
				cb(err);

				return next(false);
			}

			var sourceList = result.sourceSnapshots || [];
			
			
			debug('rotate(): found %s source snapshots before filtering tags', sourceList.length);
			
			var sourceSnapshots = (sourceList || [])
				//filter out any snapshots that aren't for the requested tag
				.filter(function (snap) { return snapReg.test(snap) })
			
			debug('rotate(): found %s source snapshots while filtering tag: %s', sourceSnapshots.length, snapshot);
			
			if (opts.preserveIncremental) {
				debug('rotate(): processing preserveIncremental directive.');
				
				var destinationList = result.destinationSnapshots;
				
				debug('rotate(): found %s destination snapshots before filtering tags', destinationList.length);
				
				var destinationSnapshots = (destinationList || [])
					//filter out any snapshots that aren't for the requested tag
					.filter(function (snap) { return snapReg.test(snap) })
				
				debug('rotate(): found %s destination snapshots while filtering tag: %s', destinationSnapshots.length, snapshot);
				
				var inter = intersect(sourceSnapshots, destinationSnapshots);
				
				if (inter.length) {
					var latestCommon = inter.pop();
					
					debug('rotate(): %s is the lastest in common snapshot; removing from sourceSnapshots list so it will not be removed.', latestCommon);
					
					sourceSnapshots.splice(sourceSnapshots.indexOf(latestCommon), 1);
					
					opts.keep -= 1;
				}
			}
			
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
