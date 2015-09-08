var readjson = require('readjson');
var debug = require('./debug');

module.exports = readjsonSync;

function readjsonSync (path) {
	var data;
	
	debug('readjsonSync(): reading json file %s', path)
	
	try {
		data = readjson.sync(path);
	} catch (e) {
		debug('readjsonSync(): reading json file %s failed:', e.message);
	}
	
	return data;
}