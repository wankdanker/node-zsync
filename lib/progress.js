var bytes = require('bytes');
var debug = require('debug')('zsync');

module.exports = function (val) {
	Progress.reg.lastIndex = 0;

	var match = Progress.reg.exec(val);

	if (!match) {
		return null;
	}

	return new Progress(match);
};

Progress.reg = /([0-9]+:[0-9]+:[0-9]+)\s*([0-9\.]*[A-Z]*)\s*([^@]*)@(.*)/;

function Progress (match) {
	this.time = match[1];
	this.transferred = bytes.parse(match[2] + 'B'); //bytes expects MB/GB/etc
	this.dataset = match[3];
	this.snapshot = match[4];
}
