var sshexec = require('ssh-exec');
var debug = require('./debug');
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
	var buffer = [];
	
	debug('runremote(): executing: %s', cmd);

	child = sshexec(cmd, sshopts);

	child.on('warn', function (data) {
		child.emit('verbose', data);

		debug('runremote(): RemoteStderr: %s', data);
		
		buffer.push(data);
		
		//only keep last 5 lines
		if (buffer.length > 5) {
			buffer.shift();
		}
	});

	child.on('exit', function (code) {
		if (code !== 0) {
			var message = buffer.filter(Boolean).join(' ').trim();
			var err = new Error('Error executing remote command: ' + message);
			err.code = code;
			
			child.emit('error', err);
		}
	});
	
	if (opts.streams) {
		return cb(null, child);
	}

	child.pipe(gatherJSON(cb));
}