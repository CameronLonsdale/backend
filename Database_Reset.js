var mysql = require('mysql');
var confu = require('confu');

var config = confu(__dirname, 'app.conf');
delete config.mySQLConfig.database;

console.log('Connecting to database');
var client = mysql.createConnection(config.mySQLConfig);
client.connect();

console.log('connected');

function dropDatabase() {
	console.log('deleting database');
	client.query('DROP DATABASE IF EXISTS v1_users', function(err) {
	  if (err) { throw err; }
	  console.log('deleted db');
      createDatabase();
	});
}
function createDatabase() {
	console.log('creating database');
	client.query('CREATE DATABASE v1_users', function(err) {
	  if (err) { throw err; }
	  console.log('created db');
      selectDatabase();
	});
}
function selectDatabase() {	
	console.log('selecting database');
	client.query('USE v1_users', function(err) {
	  if (err) { throw err; }
      console.log('selected db');
      createTables();
	});
}
function createTables() {
    //----global----
    
    //AUTHENTICATION
    
	console.log('creating table');
	client.query('CREATE TABLE users(' +
		'id INT UNSIGNED NOT NULL auto_increment, ' +
		'username varchar(64) NOT NULL, ' +
		'password_hash varchar(128) NOT NULL, ' +
		'password_salt varchar(12) NOT NULL, ' +
		'email varchar(254) NOT NULL, ' +
		'subscription BOOL NOT NULL, ' +
		'confirmed BOOL NOT NULL DEFAULT 1, ' +
		'ticket varchar(32) NOT NULL, ' +
		'secure_code varchar(32) NOT NULL, '+
		'PRIMARY KEY (id, username, email)' +
		');', 
		function(err) {
	  		if (err) { throw err; }
            console.log('created users');
		}
	);
    
    //SOCIAL
	
	console.log('creating table');
	client.query('CREATE TABLE friends(' +
		'user_id INT UNSIGNED NOT NULL, ' +
		'friend_id INT UNSIGNED NOT NULL, ' +
		'accepted BOOL NOT NULL DEFAULT 0, ' +
		'FOREIGN KEY (user_id) REFERENCES users(id), ' +
		'FOREIGN KEY (friend_id) REFERENCES users(id), ' +
        'PRIMARY KEY (user_id, friend_id)' +
		');', 
		function(err) {
	  		if (err) { throw err; }
            console.log('created friends');
		}
	);
    
    //----Outpost----
    
    //character system
	console.log('creating table');
	client.query('CREATE TABLE outpost_characters(' +
		'id INT UNSIGNED NOT NULL auto_increment, ' +
		'user_id INT UNSIGNED NOT NULL, ' +
		'name varchar(64) NOT NULL, ' +
		'exp INT UNSIGNED NOT NULL DEFAULT 0, ' +
		'gender INT UNSIGNED NOT NULL DEFAULT 0,' +
		'PRIMARY KEY (id, user_id), ' +
		'FOREIGN KEY (user_id) REFERENCES users(id)' +
		');', 
		function(err) {
	  		if (err) { throw err; }
            console.log('created characters');
		}
	);
	
	console.log('creating table');
	client.query('CREATE TABLE outpost_games(' +
        'id INT UNSIGNED NOT NULL auto_increment, ' +
        'timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ' +
        'map INT UNSIGNED NOT NULL, ' +
		'game_mode INT UNSIGNED NOT NULL, ' +
        'team1_kills INT UNSIGNED NOT NULL, ' + 
        'team2_kills INT UNSIGNED NOT NULL, ' + 
        'team1_deaths INT UNSIGNED NOT NULL, ' + 
        'team2_deaths INT UNSIGNED NOT NULL, ' + 
        'game_length INT UNSIGNED NOT NULL DEFAULT 0, ' +
        'PRIMARY KEY (id)' +
		');',
		function(err) {
	  		if (err) { throw err; }
            console.log('created games');
		}
	);
    
    console.log('creating table');
    client.query('CREATE TABLE outpost_character_games(' +
		'character_id INT UNSIGNED NOT NULL, ' +
        'game_id INT UNSIGNED NOT NULL, ' +
		'FOREIGN KEY (character_id) REFERENCES outpost_characters(id), ' +
        'FOREIGN KEY (game_id) REFERENCES outpost_games(id)' +
		');',
		function(err) {
	  		if (err) { throw err; }
            console.log('created character games');
		}
    );
    
	console.log('creating table');
	client.query('CREATE TABLE outpost_guns(' +
		'gun_id INT SIGNED NOT NULL, ' +
		'outpost_character_id INT UNSIGNED NOT NULL, ' +
		'kills INT UNSIGNED NOT NULL DEFAULT 0, ' +
		'deaths INT UNSIGNED NOT NULL DEFAULT 0, ' +
		'sl_kills INT UNSIGNED NOT NULL DEFAULT 0, ' +
		'sl_deaths INT UNSIGNED NOT NULL DEFAULT 0, ' +
        'INDEX id (gun_id, outpost_character_id), ' +
		'FOREIGN KEY (outpost_character_id) REFERENCES outpost_characters(id)' +
		');', 
		function(err) {
	  		if (err) { throw err; }
            console.log('created guns');
		}
	);
}

if (client) {
    dropDatabase();
}
else {
	throw 'lol, fail... no MySQL connection';
}
