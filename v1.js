/*
reply protocol:
e = error. Followed by error message
s = success. Followed by data
*/

var randomstring = require('randomstring').generate;
var hash = require('node_hash');
var check = require('validator').check;

var outpostversion = '0.26';

function ParseUrl(client, pass, res) {
    //--Global--
    if (pass.pathname.slice(0, 5) === '/auth') {
        pass.pathname = pass.pathname.slice(5);
        ParseAuth(client, pass, res);
    }
    else if (pass.pathname.slice(0, 7) === '/social') {
        pass.pathname = pass.pathname.slice(7);
        ParseSocial(client, pass, res);
    }
    //--Outpost Game--
    else if (pass.pathname.slice(0, 8) === '/outpost') {
        pass.pathname = pass.pathname.slice(8);
        ParseOutpost(client, pass, res);
    }
    //--Error--
    else {
        res.end('eInvalid URL');
    }
}

module.exports = {
	eval : ParseUrl,
}

/* ===========================================
					AUTH
===============================================*/

function ParseAuth(client, pass, res) {
    switch (pass.pathname) {
    case '/login':
        login(client, res,
            pass.query.username.toLowerCase(),
            pass.query.password,
            pass.query.source
        );
    break;
    case '/register':
        register(client, res,
            pass.query.username.toLowerCase(),
            pass.query.password,
            pass.query.email.toLowerCase(),
            parseInt(pass.query.subscription),
            pass.query.source
        );
    break;
    case '/confirm':
        confirmUser(client, res,
            pass.query.username.toLowerCase(),
            pass.query.secure_code
        );
    break;
    case '/changepassword':
        changePassword(client, res,
            pass.query.username.toLowerCase(),
            pass.query.ticket,
            pass.query.new_password
        );
    break;
    default:
        res.end('eInvalid URL');
    }
}

//Login
function login(client, res, username, password, source) {
    if (typeof source === 'undefined') {source = 'browser'; }

	client.query('SELECT password_salt, password_hash, id FROM users WHERE username=? AND confirmed=1', [username],
        function loginCheckPassword(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            if (result.length !== 1) {
                res.end('eUsername not found');
                return;
            }

            result = result[0];
            if (hash.sha512(password, result.password_salt) === result.password_hash) {
                ticket = randomstring(32);
                secureCode = randomstring(32);

                client.query('UPDATE users SET ticket=?, secure_code=? WHERE id=?', [ticket, secureCode, result.id],
                    function loginReturn(err, result2) {
                        if (err || !result2) {
                            res.end('eInternal Error');
                            throw err;
                        }

                        end = function EndLogin() {
                            res.end('s' + ticket + ';' + secureCode);
                        }

                        error = function FailLogin() {
                            res.end('eInternal Error');
                        }

                        if (source == 'outpost') {
                            CreateCharacter(client, result.id, end, error);
                        }
                        else {
                            end();
                        }
                    }
                );
            }
            else {
                res.end('ePassword does not match');
            }
        }
    );
}

//register
function register(client, res, username, password, email, subscription, source) {
    if (check(email).len(6, 64).isEmail()) {
        //check duplicates
        client.query('SELECT username, email FROM users WHERE username=? OR email=?', [username, email],
            function checkDuplicates(err, result) {
                if (err || !result) {
                    res.end('eInternal Error');
                    return;
                }

                if (result.length >= 1) {
                    if (result[0].email == email) {
                        res.end('eEmail already exists');
                        return;
                    }
                    res.end('eUsername already exists');
                    return;
                }
                createUser(client, res, username, password, email, subscription, source);
            }
        );
    }
    else {
        res.end('eInvalid Email');
    }
}

function createUser(client, res, username, password, email, subscription, source) {
    salt = randomstring(12);
    ticket = randomstring(32);
    secureCode = randomstring(32);

    client.query('INSERT INTO users (username, password_hash, password_salt, email, subscription, ticket, secure_code) VALUES(?, ?, ?, ?, ?, ?, ?)',
        [username, hash.sha512(password, salt), salt, email, subscription, ticket, secureCode],
        function createUserReturn(err, result) {
            if (err || !result) {
                res.end('eInternal Error 1');
                throw err;
            }

            end = function EndLogin() {
                res.end('s' + ticket + ';' + secureCode);
            }

            error = function FailLogin() {
                res.end('eInternal Error 2');
            }

            if (source == 'outpost') {
                CreateCharacter(client, result.insertId, end, error);
            }
            else {
                end();
            }
        }
    );
}

//confirm
function confirm(client, res, username, secure_code) {
	client.query('SELECT * FROM users WHERE username=? AND secure_code=?', [username, secure_code],
        function confirmSecureCode(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }

            if (result.length !== 1) {
                res.end('e');
                return;
            }
            res.end('s');
        }
    );
}

//change password
function changePassword(client, res, username, ticket, newPassword) {
    salt = randomstring(12);

    client.query('UPDATE users SET password_hash=?, password_salt=? WHERE username=? AND ticket=?',
        [hash.sha512(password, salt), salt, username, ticket],
        function confirmPasswordChange(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }

            if (result.length !== 1) {
                res.end('e');
                return;
            }
            res.end('s');
        }
    );
}

/* ===========================================
                    Outpost
===============================================*/

function ParseOutpost(client, pass, res) {
    switch (pass.pathname) {
    case '/version':
        res.end('s' + outpostversion);
    break;

    //characters
    case '/characters/get':
        fetch(client, res, pass.query.username);
    break;
    case '/characters/set':
        AddGameData(client, res);
    break;
    
    //game
    case '/game/save':
        SaveGame(client, res, pass.query.data);
    break;
    
    //global
    case '/global/get':
        GetGlobalData(client, res);
    break;
    
    //error
    default:
        res.end('eInvalid URL');
    }
}

//character functions

function CreateCharacter(client, id, end, error) {
    client.query('SELECT id FROM outpost_characters WHERE user_id=?', [id],
        function makeNewCharacter(err, result) {
            if (err || !result) {
                error();
                return;
            }

            if (result.length === 1) {
                end();
            }
            else {
                client.query('INSERT INTO outpost_characters (user_id, name) SELECT users.id, users.username FROM users WHERE users.id = ?', [id],
                    function confirmCharacterCreation(err, result) {
                        if (err || !result) {
                            error();
                        }
                        else {
                            end();
                        }
                    }
                );
            }
        }
    );
}

function GetCharacterData(client, res, username) {
    
}

function SetCharacterData(client, res, username, name, gender) {
    
}

//Game functions

function SaveGame(client, res, data) {
    data = data.split(' ');
    if (data.length === 7) {
        map = parseInt(data[0]);
        gameMode = parseInt(data[1]);
        team1Kills = parseInt(data[2]);
        team2Kills = parseInt(data[3]);
        team1Deaths = parseInt(data[4]);
        team2Deaths = parseInt(data[5]);
        gameLength = parseFloat(data[6]);
        
        client.query('INSERT INTO outpost_games (map, game_mode, team1_kills, team2_kills, team1_deaths, team2_deaths, game_length)' + 
            'VALUES (?, ?, ?, ?, ?, ?, ?)', [map, gameMode, team1Kills, team2Kills, team1Deaths, team2Deaths, gameLength],
            function confirmGameSave(err, result) {
                if (err || !result) {
                    res.end('eInternal Error');
                    throw err;
                }
                
                res.end('s');
            }
        );
    }
    else {
        res.end('eInvalid Data');
    }
}

function GetGlobalData(client, res) {
    client.query('SELECT ' + 
        'COALESCE(SUM(team1_kills), 0) AS t1Kills, ' + 
        'COALESCE(SUM(team2_kills), 0) AS t2Kills, ' + 
        'COALESCE(SUM(team1_deaths), 0) + COALESCE(SUM(team2_deaths), 0) AS casulties ' + 
        'FROM outpost_games', 
        function getTotalKills(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                return;
            }
            
            casulties = result[0].casulties;
            team1_total = result[0].t1Kills;
            team2_total = result[0].t2Kills;
            
            res.end('s' + casulties + ';' + team1_total + ';' + team2_total);
        }
    );
}

//--------------------------------------------------FUTURE-------------------------------------------------------------------

/* ===============================
		Helper functions
=================================*/

function CharacterCreate(client, id, username) {
    client.query('INSERT INTO outpost_characters (user_id, name) VALUES(?, ?)', [id, username],
        function (err, result) {
			try {
				if (err || !result) {
					funct(err, null);
				}
				else {
					var err_funct =
					function (err, result) {
						try {
							if (err || !result) {
								funct(err, null);
							}
						}
						catch (err) {
							console.log('V1 Error Inserting default gun First query: ' + err);
						}
					};
					client.query('INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, 1)', [id], err_funct);
					client.query('INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, 2)', [id], err_funct);
					client.query('INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, -1)', [id], err_funct);
					client.query('INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, -2)', [id], err_funct);
					funct(err, result);
				}

			}
			catch (err) {
				console.log('V1 Error CharacterCreate: ' + err);
			}
		}
	);
}

function Parser(data) {
	var result = new Array();
	game_data = data.split('/');
	game_info = game_data[0].split(';');
	parsed = {
		game_mode : game_info[0],
		game_length : game_info[1],
		map : game_info[2]
	};
	result.push(parsed);
	userinfo = game_data[1].split('|');
	for (element in userinfo) {
		info = userinfo[element].split(';');
		parsed = {
			username : info[0],
			secure_code : info[1],
			assists : info[2],
			experience : info[3],
			guns : [],
			vehicles : []
		};
		guninfo = info[4].split('~');
		for (i in guninfo) {
			gun_info = guninfo[i].split(':');
			gun = {
				id : gun_info[0],
				hits : gun_info[1],
				misses : gun_info[2],
				kills : gun_info[3],
				deaths : gun_info[4],
				skill_level_kills : gun_info[5],
				skill_level_deaths : gun_info[6],
				headshots : gun_info[7],
				vehicle_kills : gun_info[8]
			};
			parsed.guns.push(gun);
		}
		vehicledata = info[4].split('^');
		for (i in vehicledata) {
			vehicle_info = vehicledata[i].split(':');
			vehicle = {
				id : vehicle_info[0],
				hits : vehicle_info[1],
				misses : vehicle_info[2],
				kills : vehicle_info[3],
				deaths : vehicle_info[4],
				skill_level_kills : vehicle_info[5],
				skill_level_deaths : vehicle_info[6],
				headshots : vehicle_info[7],
				vehicle_kills : vehicle_info[8]
			};
			parsed.vehicles.push(vehicle);
		}
		result.push(parsed);
	}
	return result;
}



/* =======================================
				Outpost
=========================================*/

function fetch(client, res, username, ticket) {
	try {
		client.query('SELECT * FROM users, outpost_characters, outpost_guns WHERE LOWER(users.username)=LOWER(?)', [username],
			function (err, result) {
				try {
					if (err || !result || result.length != 1) {
						res.end('fail');
					}
					else {
						guns = '';
						for (gun in result) {
							guns += result[gun].id + ':';
							guns += result[gun].hits + ':' ;
							guns += result[gun].misses + ':';
							guns += result[gun].kills + ':';
							guns += result[gun].deaths + ':';
							guns += result[gun].skill_level_kills + ':';
							guns += result[gun].skill_level_deaths + ':';
							guns += result[gun].headshots + '~';
						}
						res.end(result[0].game_mode + ';' +
								result[0].game_length + ';' +
								result[0].map + ';' +
								'/' +
								result[0].username + ';' +
								result[0].assists + ';' +
								result[0].experience + ';' +
								guns
						);
					}
				}
				catch (err) {
					console.log('V1 Error fetching client data: ' + err);
				}
			}
		);
	}
	catch (err) {
		console.log('V1 Error confirming client: ' + err);
	}
}


function givegun(client, res, username, ticket, clientusername, secure_code, gun_id) {
	try {
		TicketConfirmation (client, username, ticket,
			function (err, result) {
				try {
					if (err || !result) {
						res.end('fail');
					}
					else {
						SecureCodeConfirmation (client, clientusername, secure_code,
							function (err, result) {
								try {
									if (err || !result) {
										res.end('fail');
									}
									else {
										client.query('INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, ?)', [result.id, gun_id] );
										res.end('success');
									}
								}
								catch (err) {
									console.log('V1 Error givegun second query: ' + err);
								}
							}
						);
					}
				}
				catch (err) {
					console.log('V1 Error givegun first query: ' + err);
				}
			}
		);
	}
	catch (err) {
		console.log('V1 Error givegun: ' + err);
	}
}

function AddGameData(client, res, data) {
	try {
		info = Parser(data);
		game_data = info.shift();
		for (user in info) {
			SecureCodeConfirmation(client, info[user].username, info[user].secure_code,
				function (err, result) {
					try {
						if (err || !result) {
							res.end('fail');
						}
						else {
							client.query('SELECT id FROM outpost_characters WHERE user_id=?', [result.id],
								function (err, result2) {
									try {
										if (err) {
											res.end('fail');
										}
										else {
											client.query('INSERT INTO outpost_games (character_id, game_mode, game_length, map) VALUES(?, ?, ?, ?)', [result2[0].id, game_data.game_mode, game_data.game_length, game_data.map],
												function (err, result3) {
													try {
														if (err || !result3) {
															res.end('fail3');
														}
													}
													catch (err) {
														console.log('V1 Error AddGameData 3rd query: ' + err);
													}
												}
											);
											client.query('UPDATE outpost_characters SET exp=exp+?, assists=assists+? WHERE id=?', [info[user].experience, info[user].assists, result2[0].id],
												function (err, result4) {
													try {
														if (err || !result4) {
															res.end('fail4');
														}
													}
													catch (err) {
														console.log('V1 Error AddGameData 4th query: ' + err);
													}
												}
											);
											guninfo = info[user].guns;
											for (gun in guninfo) {
												client.query('UPDATE outpost_guns, outpost_characters SET outpost_guns.hits=outpost_guns.hits+?, outpost_guns.misses=outpost_guns.misses+?, outpost_guns.kills=outpost_guns.kills+?, outpost_guns.deaths=outpost_guns.deaths+?, outpost_guns.skill_level_kills=outpost_guns.skill_level_kills+?, outpost_guns.skill_level_deaths=outpost_guns.skill_level_deaths+?, outpost_guns.headshots=outpost_guns.headshots+? WHERE outpost_characters.user_id=? AND gun_id=?', [guninfo[gun].hits, guninfo[gun].misses, guninfo[gun].kills, guninfo[gun].deaths, guninfo[gun].skill_level_kills, guninfo[gun].skill_level_deaths, guninfo[gun].headshots, result2[0].id, parseInt(guninfo[gun].id)],
													function (err, result5) {
														try {
															if (err || !result5) {
																console.log('failing' + err);
																res.end('fail' + err);
															}
														}
														catch (err) {
															console.log('V1 Error AddGameData 5th query: ' + err);
														}
													}
												);
											}
											res.end('success');
										}
									}
									catch (err) {
										console.log('V1 Error AddGameData 2nd query: ' + err);
									}
								}
							);
						}
					}
					catch (err) {
						console.log('V1 Error AddGameData 1st query: ' + err);
					}
				}
			);
		}
	}
	catch (err) {
		console.log('V1 Error AddGameData: ' + err);
	}
}





/*=================================
			Social
=================================*/

function ParseSocial(client, pass, res) {
    switch (pass.pathname) {
    case '/friend_request':
        friendrequest(client, res,
            pass.query.username,
            pass.query.ticket,
            pass.query.friend_name
        );
    break;
    case '/friend_accept':
        friendaccept(client, res,
            pass.query.username,
            pass.query.ticket,
            pass.query.friend_name
        );
    break;
    case '/get_friends':
        getfriends(client, res,
            pass.query.username,
            pass.query.ticket
        );
    break;
    case '/unfriend':
        unfriend(client, res,
            pass.query.username,
            pass.query.ticket,
            pass.query.friend_name
        );
    break;
    default:
        res.end('eInvalid URL');
    }
}

function friendrequest(client, res, username, ticket, friendname) {
	//we get our id from this
	TicketConfirmation(client, username, ticket,
		function (err, result) {
			try {
				if (err || !result) {
					res.end('fail1');
				}
				else {
					if (username != friendname) {
						client.query('SELECT users.id FROM users LEFT JOIN friends ON (friends.user_id = users.id AND friends.friend_id = ?) OR (friends.friend_id = users.id AND friends.user_id = ?) WHERE LOWER(users.username) = LOWER(?) AND friends.user_id IS NULL', [result.id, result.id, friendname],
							function (err, result2) {
								try {
									if (err || !result2[0]) {
										res.end('fails' + err);
									}
									else {
										console.log('we have their id');
										client.query('INSERT INTO friends (user_id, friend_id) VALUES(?, ?)', [result.id, result2[0].id],
											function (err, result3) {
												try {
													if (err || !result3) {
														res.end('fail3');
													}
													else {
														res.end('success');
													}
												}
												catch (err) {
													console.log('V1 Error friendrequest 2nd query: ' + err);
												}
											}
										);
									}
								}
								catch (err) {
									console.log('V1 Error friendrequest 1st query: ' + err);
								}
							}
						);
					}
					else{
						res.end('you cant friend yourself');
					}
				}
			}
			catch (err) {
				console.log('V1 Error friendrequest: ' + err);
			}
		}
	);
}


function friendaccept(client, res, username, ticket, friendname) {
	//we get our id from this
	TicketConfirmation(client, username, ticket,
		function (err, result) {
			try {
				if (err || !result) {
					res.end('fail1');
				}
				else {
					//select id of the target friend
					client.query('SELECT id FROM users WHERE username=?', [friendname],
						function (err, result2) {
							try {
								if (err || !result2) {
									res.end('fail2');
								}
								else {
									//checking if already friends
									client.query('UPDATE friends SET accepted=1 WHERE user_id=? AND friend_id=? AND accepted=0', [result.id, result2[0].id],
										function (err, result3) {
											try {
												if (err || result3[0] != 1) {
													res.end('already friends');
												}
												else {
													res.end('success');
												}
											}
											catch (err) {
												console.log('V1 Error friendaccept 2nd query: ' + err);
											}
										}
									);
								}
							}
							catch (err) {
								console.log('V1 Error friendaccept 1st query: ' + err);
							}
						}
					);
				}
			}
			catch (err) {
				console.log('V1 Error friendaccept: ' + err);
			}
		}
	);
}

function getfriends(client, res, username, ticket) {
	//we get our id from this
	TicketConfirmation(client, username, ticket,
		function (err, result) {
			try {
				if (err || !result) {
					res.end('fail');
				}
				else {
					//selecting the id's of your friends that are accepted
					client.query('SELECT * FROM users INNER JOIN friends ON (friends.friend_id = users.id AND friends.user_id = ?) OR (friends.user_id = users.id AND friends.friend_id = ?) WHERE accepted=1', [result.id, result.id],
						function (err, result2) {
							try {
								if (err || !result2[0]) {
									res.end('fail');
								}
								else {
									res.end(result2[0].username);
								}
							}
							catch (err) {
								console.log('V1 Error getfriends 2nd query: ' + err);
							}
						}
					);
				}
			}
			catch (err) {
				console.log('V1 Error getfriends: ' + err);
			}
		}
	);
}

function unfriend(client, res, username, ticket, friendname) {
	//we get our id from this
	TicketConfirmation(client, username, ticket,
		function (err, result) {
			try {
				if (err || !result) {
					res.end('fail');
				}
				else {
					//select id of the target friend
					client.query('SELECT id FROM users WHERE username=?', [friendname],
						function (err, result2) {
							try {
								if (err || !result2) {
									res.end('fail');
								}
								else {
									//deleting the friend
									client.query('DELETE FROM friends WHERE user_id=? AND friend_id=? AND accepted=1', [result.id, result2[0].id],
										function (err, result3) {
											try {
												if (err || !result3) {
													res.end('fail' + err);
												}
												else {
													res.end('success');
												}
											}
											catch (err) {
												console.log('V1 Error unfriend 2nd query: ' + err);
											}
										}
									);
								}
							}
							catch (err) {
								console.log('V1 Error unfriends 1st query: ' + err);
							}
						}
					);
				}
			}
			catch (err) {
				console.log('V1 Error unfriends: ' + err);
			}
		}
	);
}

/*=================================
            Server List
=================================*/

var serverList = {};

function Server(ip, port, name, comment, map, mode, maxPlayers, currentPlayers) {
    this.ip = ip;
    this.port = port;
    this.name = name;
    this.comment = comment;
    this.map = map;
    this.mode = mode;
    this.playerLimit = maxPlayers;
    this.connectedPlayers;
}

function registerServer(res, ip, port, name, comment, map, mode, playerLimit, connectedPlayers) {
    try {
        serverList[ip] = new Server(ip, port, name, comment, map, mode, playerLimit, connectedPlayers);
        res.end(Object.keys(serverList).length + '');
    }
    catch (err) {
        console.log('V1 Error registering server: ' + err);
    }
}

function updateServer(res, ip, name, comment, map, mode, playerLimit, connectedPlayers) {
    try {
        serverList[ip].name = name;
        serverList[ip].comment = comment;
        serverList[ip].map = map;
        serverList[ip].mode = mode;
        serverList[ip].playerLimit = playerLimit;
        serverList[ip].connectedPlayers = connectedPlayers;
        res.end('success');
    }
    catch (err) {
        console.log('V1 Error registering server: ' + err);
    }
}

function getServerList(res) {
    try {
        out = '';
        for (var key in serverList) {
            out += serverList[key].ip + '+';
            out += serverList[key].port + '+';
            out += serverList[key].name + '+';
            out += serverList[key].comment + '+';
            out += serverList[key].map + '+';
            out += serverList[key].mode + '+';
            out += serverList[key].playerLimit + '+';
            out += serverList[key].connectedPlayers + '+';
        }
        res.end(out);
        checkServerList();
    }
    catch (err) {
        console.log('V1 Error getting server list: ' + err);
    }
}

function checkServerList() {
    try {
        for (var key in serverList) {
            pin(serverList[key].ip + ':' + serverList[key].port)
                .interval(1000)
                .down(function(error, response) {
                    delete serverList[key];
                });
        }
    }
    catch (err) {
        console.log('V1 Error checking server list: ' + err);
    }
}