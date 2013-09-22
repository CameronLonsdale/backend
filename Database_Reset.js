var mysql = require('mysql');

console.log('Connecting to database');
var client = mysql.createConnection({
	port:'3307',
	user:'manager',
	password:'manager',
});
client.connect();

console.log('connected');

if (client) {
	console.log('deleting database');
	client.query('DROP DATABASE IF EXISTS v1_users', function(err) {
	  if (err) { throw err; }
	console.log('deleted db');
	});
	
	console.log('creating database');
	client.query('CREATE DATABASE v1_users', function(err) {
	  if (err) { throw err; }
	console.log('created db');
	});
	
	
	console.log('select database');
	client.query('USE v1_users', function(err) {
	  if (err) { throw err; }
	console.log('selected db');
	});
	
	console.log('creating table');
	client.query("CREATE TABLE users(" +
		"id INT UNSIGNED NOT NULL auto_increment, " +
		"username varchar(64) NOT NULL, " +
		"password_hash varchar(128) NOT NULL, " +
		"password_salt varchar(12) NOT NULL, " +
		"email varchar(256) NOT NULL, " +
		"subscription BOOL NOT NULL, " +
		"confirmed BOOL NOT NULL DEFAULT 1, " +
		"ticket varchar(32) NOT NULL, " +
		"secure_code varchar(32) NOT NULL, "+
		"PRIMARY KEY (id)" +
		");", 
		function(err) {
	  		if (err) { throw err; }
		}
	);
	console.log('created users');
	
	console.log('creating table');
	client.query("CREATE TABLE outpost_characters(" +
		"id INT UNSIGNED NOT NULL auto_increment, " +
		"user_id INT UNSIGNED NOT NULL, " +
		"name varchar(64) NOT NULL, " +
		"level INT UNSIGNED NOT NULL DEFAULT 0, " +
		"exp INT UNSIGNED NOT NULL DEFAULT 0, " +
		"assists INT UNSIGNED NOT NULL DEFAULT 0, " +
		"gender INT UNSIGNED NOT NULL DEFAULT 0," +
		"PRIMARY KEY (id), " +
		"FOREIGN KEY (user_id) REFERENCES users(id)" +
		");", 
		function(err) {
	  		if (err) { throw err; }
		}
	);
	console.log('created characters');
	
	console.log('creating table');
	client.query("CREATE TABLE outpost_guns(" +
		"id INT UNSIGNED NOT NULL auto_increment, " +
		"gun_id INT SIGNED NOT NULL, " +
		"outpost_character_id INT UNSIGNED NOT NULL, " +
		"kills INT UNSIGNED NOT NULL DEFAULT 0, " +
		"deaths INT UNSIGNED NOT NULL DEFAULT 0, " +
		"skill_level_kills INT UNSIGNED NOT NULL DEFAULT 0, " +
		"skill_level_deaths INT UNSIGNED NOT NULL DEFAULT 0, " +
		"hits INT UNSIGNED NOT NULL DEFAULT 0, " +
		"misses INT UNSIGNED NOT NULL DEFAULT 0, " +
		"headshots INT UNSIGNED NOT NULL DEFAULT 0, " +		
		"PRIMARY KEY (id), " +
		"FOREIGN KEY (outpost_character_id) REFERENCES outpost_characters(id)" +
		");", 
		function(err) {
	  		if (err) { throw err; }
		}
	);
	console.log('created guns');
	
	console.log('creating table');
	client.query("CREATE TABLE outpost_gun_addon(" +
		"addon_id INT UNSIGNED NOT NULL, " +
		"outpost_gun_id INT UNSIGNED NOT NULL, " +
		"FOREIGN KEY (outpost_gun_id) REFERENCES outpost_guns(id)" +
		");",
		function(err) {
	  		if (err) { throw err; }
		}
	);
	console.log('created addons');
	
	console.log('creating table');
	client.query("CREATE TABLE outpost_games(" +
		"character_id INT UNSIGNED NOT NULL, " +
		"game_mode varchar(64), " +
		"game_length INT UNSIGNED NOT NULL DEFAULT 0, " +
		"map varchar(64), " +
		"FOREIGN KEY (character_id) REFERENCES outpost_characters(id)" +
		");",
		function(err) {
	  		if (err) { throw err; }
		}
	);
	console.log('created games');
	
	console.log('creating table');
	client.query("CREATE TABLE friends(" +
		"user_id INT UNSIGNED NOT NULL, " +
		"friend_id INT UNSIGNED NOT NULL, " +
		"accepted BOOL NOT NULL DEFAULT 0, " +
		"FOREIGN KEY (user_id) REFERENCES users(id), " +
		"FOREIGN KEY (friend_id) REFERENCES users(id)" +
		");", 
		function(err) {
	  		if (err) { throw err; }
		}
	);
	console.log('created friends');
}
else {
	throw "lol, fail... no MySQL connection";
}