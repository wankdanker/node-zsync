var sshexec = require('ssh-exec');
var debug = require('debug')('zsync');
var gatherJSON = require('./gather-json');

var USER = process.env.USER;
var HOST = 'localhost';
var KEY = null;

module.exports = runremote;

function runremote(opts, cb) {
	var cmd = ['zsync', opts.command];
	var avoid = ['command', 'host', 'remote', 'user', 'key', 'args', 'streams'];

	Object.keys(opts).forEach(function (opt) {
		if (~avoid.indexOf(opt) || !opts[opt]) { 
			return;
		}

		cmd.push('--' + opt);
		cmd.push(opts[opt]);
	});

	if (opts.args) {
		cmd.push([].concat(opts.args).join(' '));
	}

	cmd = cmd.join(' ');

	var sshopts = {
		host : opts.host || HOST
		, user : opts.user || USER
		, key : opts.key || KEY
		, debug : debug
	};

	var child;

	debug('runremote(): executing: %s', cmd);

	child = sshexec(cmd, sshopts);

	child.on('warn', function (data) {
		child.emit('verbose', data);

		debug('runremote(): RemoteStderr: %s', data);
	});

	if (opts.streams) {
		return cb(null, child);
	}

	child.pipe(gatherJSON(cb));
}