var debug = require('debug');
var zsync = debug('zsync');

/*
 * This module proxies the debug function and exposes an enable()
 * function so that we can enable debugging at run-time
 * from a commandline option in addition to process.env.DEBUG
 */

module.exports = function () {
	zsync.apply(null, arguments);
}
module.exports.enable = function () {
	//enable debug logging for zsync
	debug.enable('zsync');
	
	//re-initialize the proxied function
	zsync = debug('zsync');
}