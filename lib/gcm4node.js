/* jshint node: true */
/*
 * gcm4node: node.js library for Google Cloud Messaging system
 * Copyright (C) 2013  Luca Morettoni <luca@morettoni.net>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
"use strict";

var https = require('https');
var querystring = require('querystring');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function gcm4node(config) {
    /*jshint validthis: true */
    set_config(this, config);
}

util.inherits(gcm4node, EventEmitter);

exports.gcm4node = function(config) {
    var gcm = new gcm4node(config);
    return gcm;
};

gcm4node.prototype.setConfig = function(config) {
    set_config(this, config);
};

function set_config(self, config) {
    if (config) {
        self.auth = config.auth;
        self.verbose = config.verbose;
        self.dryRun = config.dryRun || false;
        self.group_size = Math.min(config.group_size || 1000, 1000);
    }
}

gcm4node.prototype.send = function(clients, options, callback) {
    if (!this.auth) {
        if (callback)
            callback(new Error('no auth token given'));
        return;
    }
    if (!clients || clients.length < 1) {
        if (callback)
            callback(new Error('clients list empty!'));
        return;
    }

    var self = this;
    var total = clients.length;
    var now = new Date().getTime();
    var maxSize = this.group_size;
    var size = Math.min(maxSize, clients.length);
    var removed = [];
    var updated = [];
    var invalid = [];

    self.status = 'push messages to ' + total + ' devices';
    if (self.verbose) console.log(new Date().toString() + ': ' + self.status);

    function series(items) {
        if (items && items.length) {
            send_request(self, items, options, function (err, rem, upd, inv) {
                if (err) {
                    if (callback) callback(err);
                } else {
                    if (rem && rem.length) {
                        removed = removed.concat(rem);
                        self.emit('removed', rem);
                    }
                    if (upd && upd.length) {
                        updated = updated.concat(upd);
                        self.emit('updated', upd);
                    }
                    if (inv && inv.length) {
                        invalid = invalid.concat(inv);
                        self.emit('invalid', inv);
                    }

                    size = Math.min(maxSize, clients.length);
                    series(clients.splice(0, size));
                }
            });
        } else {
            var delta = (new Date().getTime() - now)/1000;
            self.status = 'pushed to ' + total + ' devices';
            if (removed.length > 0) self.status += ', ' + removed.length + ' removed';
            if (updated.length > 0) self.status += ', ' + updated.length + ' updated';
            if (invalid.length > 0) self.status += ', ' + invalid.length + ' invalid';
            self.status += ', elapsed time: ' + delta + 'S';

            if (self.verbose) console.log(new Date().toString() + ': ' + self.status);
            if (callback) callback(null, removed, updated, invalid);
        }
    }

    series(clients.splice(0, size));
};

function send_request(self, clients, options, callback) {
    if (!clients || clients.length > 1000) {
        if (callback) callback(new Error('clients list empty or too big'));
        return;
    }

    var packet = {
        registration_ids: clients,
        collapse_key: options.collapseKey
    };

    if (options.delayWhileIdle)
        packet.delay_while_idle = options.delayWhileIdle;
    if (options.timeToLive)
        packet.time_to_live = options.timeToLive;
    if (options.data)
        packet.data = options.data;

    var postData = JSON.stringify(packet);

    var headers = {
        'Authorization': 'key=' + self.auth,
        'Content-Type': 'application/json'
    };
    if (self.dryRun || options.dryRun)
        headers.dry_run = true;

    var gcmOptions = {
        host: 'android.googleapis.com',
        port: 443,
        path: '/gcm/send',
        method: 'POST',
        headers: headers
    };

    var request = https.request(gcmOptions, function(res) {
        var data = '';

        if (res.statusCode >= 500 && res.statusCode <= 599) {
            if (res.headers['retry-after']) {
                var retrySeconds = res.headers['retry-after'] * 1;
                if (isNaN(retrySeconds)) {
                    retrySeconds = new Date(res.headers['retry-after']).getTime() - new Date().getTime();
                }
                if (!isNaN(retrySeconds) && retrySeconds > 0) {
                    if (self.verbose) console.log(new Date().toString() + ': we retry after: ' + retrySeconds + ' seconds');
                    setTimeout(function () {
                        send_request(self, clients, options, callback);
                    }, retrySeconds*1000);
                }
            } else {
                if (callback) callback(new Error('Error ' + res.statusCode + ' without retry-after header'));
            }
            return;
        } else if (res.statusCode === 400) {
            if (callback) callback(new Error('Invalid request fields or reserved words in the data payload'));
            return;
        } else if (res.statusCode === 401) {
            if (callback) callback(new Error('Invalid auth'));
            return;
        }

        function respond() {
            var response = JSON.parse(data);
            var removed = [];
            var updated = [];
            var invalid = [];
            var failure = response.failure || 0;
            var canonical_ids = response.canonical_ids || 0;

            var status = 'multicast_id: ' + response.multicast_id + ', success: ' + response.success + ', failure: ' + failure + ', canonical_ids: ' + canonical_ids;
            if (self.verbose) console.log(new Date().toString() + ': ' + status);

            if (failure > 0 || canonical_ids > 0) {
                for (var i = 0; i < response.results.length; i++) {
                    var res = response.results[i];
                    if (res.error) {
                        if (res.error === 'NotRegistered')
                            removed.push(clients[i]);
                        if (res.error === 'InvalidRegistration')
                            invalid.push(clients[i]);
                        failure--;
                    }
                    if (res.registration_id) {
                        var upd = {
                            oldId: clients[i],
                            newId: res.registration_id
                        };
                        updated.push(upd);
                        canonical_ids--;
                    }

                    if (failure === 0 && canonical_ids === 0) break;
                }
            }

            if (callback) callback(null, removed, updated, invalid);
        }

        res.on('data', function(chunk) {
            data += chunk;
        });
        res.on('end', respond);
        res.on('close', respond);
    });
    request.on('error', function(error) {
        if (callback) callback(error);
    });
    request.end(postData);
}
