var z = require('zfs');
var zfs = z.zfs;
var zpool = z.pool;

module.exports.zfs = zfs;
module.exports.zpool = zpool;

/*
 * The purpose of this module is to over-rides any of the zfs methods
 * where we have option name mismatches.
 * 
 */

var list = zfs.list;

zfs.list = function (opts, cb) {
	opts.name = opts.name || opts.dataset || opts.source;

	list.apply(zfs, arguments);
};

// var send = zfs.send;
// 
// zfs.send = function (opts, cb) {
// 	opts.name = opts.name || opts.dataset || opts.source;
// 
// 	list.apply(zfs, arguments);
// }

var receive = zfs.receive;

zfs.receive = function (opts, cb) {
	opts.dataset = opts.dataset || opts.name || opts.destination;

	receive.apply(zfs, arguments);
}

var snapshot = zfs.snapshot;

zfs.snapshot = function (opts, cb) {
	opts.name = opts.snapshot;
	opts.dataset = opts.source;

	snapshot.apply(zfs, arguments);
}

var destroy = zfs.destroy;

zfs.destroy = function (opts, cb) {
	opts.name = opts.snapshot || opts.source || opts.dataset;

	destroy.apply(zfs, arguments);
}

var rename = zfs.rename;

zfs.rename = function (opts, cb) {
	opts.to = opts.name
	opts.name = opts.snapshot || opts.source || opts.dataset;

	rename.apply(zfs, arguments);
}