gcm4node
========

node.js library for [**Google Cloud Messaging system**](http://developer.android.com/guide/google/gcm/index.html)

## Installation
```bash
$ npm install gcm4node
```

## Usage

```js
var gcm4node = require('gcm4node');

// only auth is REQUIRED
var config = {
    auth: 'YOUR_AUTH_KEY',
    dryRun: false,
    group_size: 1000,
    verbose: false
};
var gcm = gcm4node.gcm4node(config);

gcm.on('removed', function (removed) {
    console.log('removed devices: ' + removed.length);
});
gcm.on('updated', function (updated) {
    console.log('updated devices: ' + updated.length);
});
gcm.on('invalid', function (invalid) {
    console.log('invalid devices: ' + invalid.length);
});

// only the collapseKey option is REQUIRED
var options = {
    collapseKey: 'coll_key',
    delayWhileIdle: true,
    timeToLive: 0,
    data: {points: 5, user: 'pippo'}
};

// here you can put more than 1,000 clients
var clients = ['CLIENT_ID#1', 'CLIENT_ID#2', ..., 'CLIENT_ID#n'];

gcm.send(clients, options, function(err, removed, updated, invalid) {
    if (err)
        console.log('ops: ' + err);
    else
        console.log('removed: ' + removed.length +
            ', updated: ' + updated.length +
            ', invalid: ' + invalid.length);
});
```

## License

gcm4node: node.js library for Google Cloud Messaging system
Copyright (C) 2016  Luca Morettoni <luca@morettoni.net>

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.


## Changelog
**0.0.4:**
  * Added priority option (valid values are "normal" and "high", normal is the default)

**0.0.3:**
  * Fixed some part of JavaScript code to pass the [JSHints](http://www.jshint.com/) checks

**0.0.2:**
  * Fixed some typo in the examples

**0.0.1:**
 * First release
