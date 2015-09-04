var gather = require('gather-stream');
var debug = require('./debug');

module.exports = gatherJSON;

function gatherJSON(cb) {
	return gather(function (err, data) {
		if (err) {
			return cb(err);
		}

		data = data.toString();

		if (!data) {
			//TODO: figure out why this might actually happen and fix it
			//so that this can't happen
			//return cb(new Error('No data returned from remote call'));
			return cb();
		}

		try {
			var json = JSON.parse(data);
		}
		catch (e) {
			return cb(e, data);
		}
		
		if (json[0]) {
			//an error was returned; make it an error object
			err = json[0];

			var e = new Error(err.message);

			//copy key/values to real error object
			Object.keys(err).forEach(function (key) {
				e[key] = err[key];
			});

			json[0] = e;
		}

		cb.apply(null, json);
	});
}