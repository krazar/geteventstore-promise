var debug = require('debug')('geteventstore:getAllStreamEvents'),
	req = require('request-promise'),
	assert = require('assert'),
	_ = require('lodash'),
	url = require('url'),
	q = require('q');

var baseErr = 'Get All Stream Events - ';

module.exports = function(config) {
	var buildUrl = function(stream, startPosition, chunkSize) {
		var urlObj = JSON.parse(JSON.stringify(config));
		urlObj.pathname = '/streams/' + stream + '/' + startPosition + '/forward/' + chunkSize;
		return url.format(urlObj);
	};

	var buildOptions = function(streamName, startPosition, chunkSize) {
		return {
			uri: buildUrl(streamName, startPosition, chunkSize),
			method: 'GET',
			headers: {
				"Content-Type": "application/vnd.eventstore.events+json"
			},
			qs: {
				embed: 'body'
			},
			json: true
		};
	}

	return function(streamName, chunkSize, startPosition) {
		return q.Promise(function(resolve, reject) {
			assert(streamName, baseErr + 'Stream Name not provided');

			startPosition = startPosition || 0;
			chunkSize = chunkSize || 1000;

			if (chunkSize > 4096) {
				console.warn('WARNING: Max event chunk size exceeded. Using the max of 4096');
				chunkSize = 4096;
			}

			var events = [];

			function getNextChunk() {
				var options = buildOptions(streamName, startPosition, chunkSize);

				req(options).then(function(response) {
					debug('', 'Result: ' + JSON.stringify(response));

					response.entries.forEach(function(entry) {
						if (entry.data) entry.data = JSON.parse(entry.data);
					});

					events.push(response.entries.reverse());

					if (response.headOfStream == true) {
						events = _.flatten(events);
						return resolve(events);
					}

					startPosition += chunkSize;
					return getNextChunk();
				}).catch(reject);
			}

			getNextChunk();
		});
	};
};