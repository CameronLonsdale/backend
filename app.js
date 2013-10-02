/*
v1
v1/auth
auth/login (username, password) return ticket
auth/register (username, password, passwordconfirm, email, emailconfirm, subscription) return ticket

v1/outpost
outpost/characters
characters/get_all (username, ticket) return characters stats
characters/get_one (username, ticket, name) return stats
characters/create (username, ticket, name) return stats
characters/kill (username, ticket, killer) return (true/false)
characters/delete (username, ticket, name) return (true/false)
characters/check_loadout (username, ticket, main, secondary) return (true/false)

outpost/user
user/friend_request (username, ticket) return (true/false)
user/friend_accept (username, ticket) return (true/false)
user/get_friends (username) return (true/false)
*/

var v1 = require('./v1');

var http = require('http');
var https = require('https');
var fs = require('fs');
var url = require('url');
var mysql = require('mysql');
var check = require('validator').check;
var confu = require('confu');

//Load configuration using json parser
//If configuration doesn't exist -> crash
try {
	var config = confu(__dirname, 'app.conf');
    config.serverConfig.key = fs.readFileSync(config.serverConfig.key);
    config.serverConfig.cert = fs.readFileSync(config.serverConfig.cert);
}
catch (err) {
	throw new Error("Application configuration file does not exist (app.conf)" + err);
}

//create a mysql connection object
var client = mysql.createConnection(config.mySQLConfig);

//connect to the mysql database server
client.connect();

function testSQL() {
	if (client && client._socket && client._socket.readable && client._socket.writable) {
        return;
    }
    console.log('mySQL connection lost, reconnecting');
    client.connect(function(err) {
        if (err) {
            console.log("SQL CONNECT ERROR: " + err);
        } else {
            console.log("SQL CONNECT SUCCESSFUL.");
        }
    });
    client.on("close", function (err) {
        console.log("SQL CONNECTION CLOSED.");
    });
    client.on("error", function (err) {
        console.log("SQL CONNECTION ERROR: " + err);
    });
}

function server(req, res) {
    testSQL();
    
    res.writeHead(200, {'Content-Type': 'text/plain'});
    var pass = url.parse(req.url, true);
    pass.pathname = pass.pathname.toLowerCase();
    
    console.log('request at: ' + pass.pathname + ' from ' + req.headers['user-agent'] + '\n');
    
    if (pass.pathname.slice(0, 3) == '/v1') {
        pass.pathname = pass.pathname.slice(3);
        v1.eval(client, pass, res);
    }
    else if (pass.pathname == '/robots.txt') {
        res.write('User-agent: *\n');
        res.end('Disallow: /');
    }
    else {
        res.end("eInvalid URL");
    }
}

https.createServer(config.serverConfig, server).listen(3000, '127.0.0.1');

process.on('uncaughtException', function (error) {
  console.error(error.stack);
});

console.log('Server running at 127.0.0.1:3000');