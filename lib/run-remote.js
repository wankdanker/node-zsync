var sshexec = require('ssh-exec');
var debug = require('./debug');
var gatherJSON = require('./gather-json');

var USER = process.env.USER;
var HOST = 'localhost';
var KEY = null;

module.exports = runremote;

/*
 * runremote(opts, cb)
 * 
 * helper function to execute zsync on a remote host to do our bidding
 * 
 * * opts
 *   * command - the zsync command to execute
 *   * [all other options relevant to command]
 *   * host - remote host on which to execute commands
 *   * user - remote user
 *   * key - local private key file path
 *   * streams - if true the child process will be returned in the callback immediately
 *   otherwise eventually the result of the remote operation will be returned via cb
 *   
 */

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
	
	debug('runremote(%s): executing: %s', sshopts.host, cmd);

	child = sshexec(cmd, sshopts);

	child.on('warn', function (data) {
		child.emit('verbose', data);

		debug('runremote(%s): RemoteStderr: %s', sshopts.host, data);
		
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
