var debug = require('debug')('zsync');
var run = require('./run');
var gatherJSON = require('./gather-json');
var Progress = require('./progress');

module.exports = sendreceive;

function sendreceive(opts, cb) {
	var receiveStream;
	var sendStream;
	var returnError;
	var returnValue;
	
	debug('sendreceive(%s->%s): sending fromSnap %s to toSnap %s to %s on %s'
		, opts.source, opts.destination, opts.fromSnap, opts.toSnap, opts.destination, opts.destinationHost || 'local');

	initializeReceive();

	function initializeReceive () {
		run({
			command : 'receive'
			, destination : opts.destination
			, host : opts.destinationHost
			, streams : (opts.destinationHost) ? true : false
			, verbose : true
			, force : opts.force
		}, function (err, s) {
			receiveStream = s;

			if (err) {
				err.message = "Error setting up destination receive: " + err.message;
				return cb(err);
			}

			//if we are doing a remote receive then we need to
			//gather the JSON response
			if (opts.destinationHost) {
				receiveStream.pipe(gatherJSON(function (err, data) {
					debug('sendreceive(%s->%s): ReceiveStream: gather cb:', opts.source, opts.destination, err, data);

					if (err) {
						sendStream.end();
					}

					returnError = err || returnError;
					returnValue = data;
					
					receiveStream.ended = true;
					maybeFinish();
				}));
			}
			else {
				receiveStream.on('close', function () {
					debug('sendreceive(%s->%s): ReceiveStream.on(close)', opts.source, opts.destination);
				
					receiveStream.ended = true;
					maybeFinish();
				});
			}

			receiveStream.on('error', function (err) {
				debug('sendreceive(%s->%s): ReceiveStream.on(error):', opts.source, opts.destination, err);

				returnError = err;
			});

			receiveStream.on('verbose', function (data) {
				debug('sendreceive(%s->%s): ReceiveStream.on(verbose):', opts.source, opts.destination, data.trim());
			});

			initializeSend();
		});
	}

	function initializeSend() {
		run({
			command : 'send'
			, incremental : opts.fromSnap
			, intermediary : true
			, properties : true
			, snapshot : opts.toSnap
			, verbose : true
			, replication : opts.replication
			, host : opts.sourceHost
		}, function (err, s) {
			sendStream = s;
			sendStream.on('error', function (err) {
				debug('sendreceive(%s->%s): SendStream.on(error):', opts.source, opts.destination, err);
				
				returnError = err;
			});

			sendStream.on('end', function () {
				debug('sendreceive(%s->%s): SendStream.on(end)', opts.source, opts.destination);

				sendStream.ended = true;
				maybeFinish();
			});

			sendStream.on('verbose', function (data) {
				data = data.trim();
				debug('sendreceive(%s->%s): SendStream.on(verbose):', opts.source, opts.destination, data);

				var progress = Progress(data);

				//debug('sendreceive(%s->%s): SendStream.on(verbose):', opts.source, opts.destination, progress);
			});

			sendStream.pipe(receiveStream)
		});
	}

	function maybeFinish() {
		debug('sendreceive(%s->%s): maybeFinish', opts.source, opts.destination, sendStream.ended, receiveStream.ended);

		if (sendStream.ended && receiveStream.ended) {
			cb(returnError, returnValue);
		}
	}
}
