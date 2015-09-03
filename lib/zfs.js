var z = require('zfs');
var zfs = z.zfs;
var zpool = z.pool;

module.exports.zfs = zfs;
module.exports.zpool = zpool;

var list = zfs.list;

zfs.list = function (opts, cb) {
	opts.name = opts.name || opts.dataset || opts.source;

	list.apply(zfs, arguments);
};
