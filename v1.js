 		/*
		v1
		v1/auth
[WORKS]	auth/login (username, password) return ticket 
[WORKS]	auth/register (username, password, passwordconfirm, email, emailconfirm, subscription) return ticket
[WORKS]	auth/confirm (username, securecode) return new ticket
[WORKS]	auth/ChangePassword (username, password, newpassword) updates password to new password
[NEED TO SEND EMAIL]	auth/ForgotPassword (username) sends email w/password to the email address of the user that
		
		v1/outpost
		outpost/auth
[WORKS] 	auth/login (username, password) return ticket
		
		outpost/characters
[DOESNT GIVE US WHAT WE WANT :(]	characters/fetch(name, ticket) return stats
[WORKS]	characters/AddGameData (client, res, data) 
[WORKS]	characters/give_gun (usernameername, ticket, clientusername, secure_code, gun_id)
		
		v1/social
[WORKS]	social/friend_request (username, ticket, name) return (true/false)
[WORKS]	social/friend_accept (username, ticket, name) return (true/false)
[WORKS]	social/get_friends (username) return (true/false)
[WORKS]	social/unfriend (username, ticket, name) return (true/false)
		*/

var randomstring = require("randomstring").generate;
var hash = require("node_hash");
var check = require("validator").check;

var outpostversion = "0.3";
module.exports = {
	eval:function (client, pass, res) {
		try {
			if (pass.pathname == "/v1/auth/login") {
				login(client, res, pass.query.username, pass.query.password);
			}
			else if (pass.pathname == "/v1/auth/register") {
				register(client, res, pass.query.username, pass.query.password, pass.query.email.toLowerCase(), parseInt(pass.query.subscription));
			}
			else if (pass.pathname == "/v1/auth/confirm") {
				confirm(client, res, pass.query.username, pass.query.secure_code);
			}
			else if (pass.pathname == "/v1/auth/changepassword") {
				changepassword(client, res, pass.query.username, pass.query.ticket, pass.query.new_password);
			}
			else if (pass.pathname == "/v1/auth/forgotpassword") {
				forgotpassword(client, res, pass.query.username);
			}
			else if (pass.pathname == "/v1/outpost/auth/login") {
				outpostlogin(client, res, pass.query.username, pass.query.password);
			}
			else if (pass.pathname == "/v1/outpost/characters/fetch") {
				fetch(client, res, pass.query.username);
			}
			else if (pass.pathname == "/v1/outpost/characters/addgamedata") {
				AddGameData(client, res, pass.query.data);
			}
			else if (pass.pathname == "/v1/outpost/characters/give_gun") {
				givegun(client, res, pass.query.username, pass.query.ticket, pass.query.client_username, pass.query.secure_code, pass.query.gun_id);
			}
			else if (pass.pathname == "/v1/social/friend_request") {
				friendrequest(client, res, pass.query.username, pass.query.ticket, pass.query.friend_name);
			}	
			else if (pass.pathname == "/v1/social/friend_accept") {
				friendaccept(client, res, pass.query.username, pass.query.ticket, pass.query.friend_name);
			}	
			else if (pass.pathname == "/v1/social/get_friends") {
				getfriends(client, res, pass.query.username, pass.query.ticket);
			}
			else if (pass.pathname == "/v1/social/unfriend") {
				unfriend(client, res, pass.query.username, pass.query.ticket, pass.query.friend_name);
			}						
			else if (pass.pathname == "/v1/outpost/version") {
				res.end(outpostversion);
			}
			else {
				res.end("fail");
			}
		}
		catch (err) {
			console.log('V1 Error calling functions: ' + err);
		}
	}
}



/* ===============================
		Helper functions
=================================*/

function TicketConfirmation (client, username, ticket, funct) {
	client.query("SELECT * FROM users WHERE LOWER(username)=LOWER(?) AND ticket=?", [username, ticket], 
		function (err, result) {
			try {
				if (err || !result) {
					funct(err, null);
				}
				else {
					funct(err, result[0]);
				}
			}			
			catch (err) {
				console.log('V1 Error TicketConfirmation First query: ' + err);
			}
		}
	);				
}

function SecureCodeConfirmation (client, username, secure_code, funct) {
	client.query("SELECT * FROM users WHERE LOWER(username)=LOWER(?) AND secure_code=?", [username, secure_code], 
		function (err, result) {
			try {
				if (err || !result) {
					funct(err, null);
				}
				else {
					funct(err, result[0]);
				}
			}			
			catch (err) {
				console.log('V1 Error SecureCodeConfirmation First query: ' + err);
			}
		}
	);				
}

function HelperLogin (client, username, password, funct) {
	client.query("SELECT password_salt FROM users WHERE LOWER(username)=LOWER(?) AND confirmed=1", [username], 
		function (err, result) {
			try {
				if (err || !result || result.length != 1) {
					funct(err, null);
				}
				else {
					client.query("SELECT * FROM users WHERE username=? AND password_hash=?", [username, hash.sha512(password, result[0].password_salt)],
						function (err, result2) {
							try {
								if (err || !result2 || result2.length != 1) {
									funct(err, null);
								}
								else {
									ticket = randomstring(32);
									secure_code = randomstring(32);
									client.query("UPDATE users SET ticket=?, secure_code=? WHERE id=?", [ticket, secure_code, result2[0].id],
										function (err, result3) {
											try {
												if (err) {
													funct(err, null);
												}
												else {
													client.query("SELECT * FROM users WHERE username=?", [username],
														function (err, result4) {
															try {
																if (err) {
																	funct(err, null);
																}
																else {
																	funct(err, result4[0]);
																}
															}
															catch (err) {
																console.log('V1 Error Login fourth query: ' + err);
															}
														}
													);					
												}
											}
											catch (err) {
												console.log('V1 Error Login third query: ' + err);
											}
										}
									);
								}
							}
							catch (err) {
								console.log('V1 Error Login second query: ' + err);
							}
						}
					);
				}
			}
			catch (err) {
				console.log('V1 Error Login first query: ' + err);
			}
		}
	);
}
function CharacterCreate(client, id, username, funct) {
    client.query("INSERT INTO outpost_characters (user_id, name) VALUES(?, ?)", [id, username],
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
					client.query("INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, 1)", [id], err_funct);
					client.query("INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, 2)", [id], err_funct);
					client.query("INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, -1)", [id], err_funct);
					client.query("INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, -2)", [id], err_funct);
					funct(err, result);
				}
			
			}
			catch (err) {
				console.log('V1 Error CharacterCreate: ' + err);
			}
		}
	);
}
               
function GetSkillLevel(client, username, funct) {
	client.query("SELECT ((SUM(outpost_guns.skill_level_kills)/SUM(outpost_guns.kills))/(SUM(outpost_guns.skill_level_deaths)/SUM(outpost_guns.deaths))) FROM users, outpost_characters, outpost_guns WHERE users.username=? AND users.id=outpost_characters.user_id AND outpost_characters.id=outpost_guns.character_id" , [username],
		function (err, result) {
			try {
				if (err || !result) {
					funct(err, null);
				}
				else{
					funct(result);
				}
			}
			catch (err) {
				console.log('V1 Error Getting Skill Level: ' + err);
			}
		}
	);		
}
function Parser(data) {
	var result = new Array();
	game_data = data.split('/');
	game_info = game_data[0].split(";");
	parsed = {
		game_mode : game_info[0],
		game_length : game_info[1],
		map : game_info[2]
	};
	result.push(parsed);
	userinfo = game_data[1].split("|");
	for (element in userinfo) {
		info = userinfo[element].split(";");
		parsed = {
			username : info[0],
			secure_code : info[1],
			assists : info[2],
			experience : info[3],
			guns : [],
			vehicles : []
		};	
		guninfo = info[4].split("~");
		for (i in guninfo) {
			gun_info = guninfo[i].split(":");
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
		vehicledata = info[4].split("^");
		for (i in vehicledata) {
			vehicle_info = vehicledata[i].split(":");
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


/* ===========================================
					AUTH
===============================================*/


function login(client, res, username, password) {
	HelperLogin(client, username, password, 
		function (err, result) {
			try {
				if (err || !result) {
					res.end("fails");
				}
				else {
					res.end(result.ticket + '`' + result.secure_code);
				}
			}			
			catch (err) {
				console.log('V1 Error Login query: ' + err);
			}
		}
	);				
}

function confirm(client, res, username, secure_code) {
	SecureCodeConfirmation (client, username, secure_code,
		function (err, result) {
			try {
				if (err || !result) {
					res.end("fail");
				}
 				else {
					res.end("success");
				}
			}			
			catch (err) {
				console.log('V1 Error Confirm First query: ' + err);
			}
		}
	);				
}

function changepassword(client, res, username, ticket, new_password) {
	try {
		client.query("SELECT id, password_salt FROM users WHERE LOWER(username)=LOWER(?) AND ticket=?", [username, ticket],
			function (err, result) {
				try {
					if (err || !result) {
						res.end("fail");
					}
					else {
						client.query("UPDATE users SET password_hash=? WHERE id=?", [hash.sha512(new_password, result[0].password_salt), result[0].id],
							function (err, result) {
								try {
									if (err || !result) {
										res.end("fail");
									}
									else {
										res.end("success");
									} 
								}
								catch (err) {
									console.log('V1 Error changepassword second query: ' + err);
								}
							}
						);
					}
				}
				catch (err)	{
					console.log('V1 Error changepassword first query: ' + err);						
				}
			}
		);
	}
	catch (err)	{
		console.log('V1 Error changepassword: ' + err);
	}	
}		

function forgotpassword(client, res, username) {
	try {
		client.query("SELECT email FROM users WHERE username=?", [username],
			function (err, result) {
				try {
					if (err || !result) {
						res.end("fail");
					}
					else {
						res.end("success");
						//send email
					}
				}
				catch (err)	{
					console.log('V1 Error forgotpassword first query: ' + err);						
				}
			}
		);
	}
	catch (err) {
		console.log('V1 Error forgotpassword' + err);	
	}	
}											

function register(client, res, username, password, email, sub) {
	try {
		if (check(email).len(6, 64).isEmail()) {
			client.query("SELECT username, email FROM users WHERE LOWER(username)=LOWER(?) OR LOWER(email)=LOWER(?)", [username, email], 
				function (err, result) {
					try {
						if (err || !result) res.end("fail");
						else if (result.length == 0) {
							salt = randomstring(12);
							ticket = randomstring(32);
							secure_code = randomstring(32);
							client.query("INSERT INTO users (username, password_hash, password_salt, email, subscription, ticket, secure_code) VALUES(LOWER(?), ?, ?, LOWER(?), ?, ?, ?)",
								[username, hash.sha512(password, salt), salt, email, sub, ticket, secure_code],
								function (err, result2) {
									try {
										if (err) res.end("fail" + err);
										else {
											res.end(ticket);
										}
									}
									catch (err) {
										console.log('V1 Error register second query: ' + err);
									}
								}
							);
						}
						else {
							res.end("fail");
						}
					}
					catch (err) {
						console.log('V1 Error register first query: ' + err);
					}
				}
			);
		}
		else {
			res.end("fail");
		}
	}
	catch (err) {
		console.log('V1 Error register: ' + err);
	}
}
/* =======================================
				Outpost
=========================================*/
function outpostlogin(client, res, username, password) {
	HelperLogin(client, username, password,
		function (err, result) {
			try {
				client.query("SELECT users.id, outpost_characters.user_id FROM users, outpost_characters WHERE users.id=outpost_characters.user_id",
					function (err, result2) {
						try {
							if (err) {
								res.end("fail");
							}
							else if (!result2[0]) {	
								CharacterCreate(client, result.id, username,
									function (err, result3) {
										try {
											if (err || !result3) {
												res.end("fail2" + err);
											}
											else {
												res.end("success");
											}
										}			
										catch (err) {
											console.log('V1 Error Outpost Login Character Creation: ' + err);
										}
									}
								);
							}
							else {
								res.end(result.ticket + "`" + result.secure_code);
							}
						}
						catch (err) {
							console.log('V1 Error Outpost Login Character validation: ' + err);
						}
					}
				);
			}
			catch (err) {
				console.log('V1 Error Outpost Login: ' + err);
			}
		}
	);
}

function fetch(client, res, username, ticket) {
	try {  
		client.query("SELECT * FROM users, outpost_characters, outpost_guns WHERE LOWER(users.username)=LOWER(?)", [username],
			function (err, result) {
				try {
					if (err || !result || result.length != 1) {
						res.end("fail");
					}		
					else {
						guns = "";
						for (gun in result[]) {
							guns += result[gun].id + ":";
							guns += result[gun].hits + ":" ;
							guns += result[gun].misses + ":";
							guns += result[gun].kills + ":";
							guns += result[gun].deaths + ":";
							guns += result[gun].skill_level_kills + ":";
							guns += result[gun].skill_level_deaths + ":";
							guns += result[gun].headshots + "~";
						}
						res.end(result[0].game_mode + ";" +
								result[0].game_length + ";" +
								result[0].map + ";" +
								"/" +
								result[0].username + ";" +
								result[0].assists + ";" +
								result[0].experience + ";" +
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
						res.end("fail");
					}
					else {
						SecureCodeConfirmation (client, clientusername, secure_code,
							function (err, result) {
								try {
									if (err || !result) {
										res.end("fail");
									}
									else {	
										client.query("INSERT INTO outpost_guns (outpost_character_id, gun_id) VALUES(?, ?)", [result.id, gun_id] );
										res.end("success");
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
							res.end("fail");
						}
						else {
							client.query("SELECT id FROM outpost_characters WHERE user_id=?", [result.id],
								function (err, result2) {
									try {
										if (err) {
											res.end("fail");
										}
										else {
											client.query("INSERT INTO outpost_games (character_id, game_mode, game_length, map) VALUES(?, ?, ?, ?)", [result2[0].id, game_data.game_mode, game_data.game_length, game_data.map], 
												function (err, result3) {
													try {
														if (err || !result3) {
															res.end("fail3");
														}
													}
													catch (err) {
														console.log('V1 Error AddGameData 3rd query: ' + err);
													}
												}
											);
											client.query("UPDATE outpost_characters SET exp=exp+?, assists=assists+? WHERE id=?", [info[user].experience, info[user].assists, result2[0].id], 
												function (err, result4) {
													try {
														if (err || !result4) {
															res.end("fail4");
														}
													}
													catch (err) {
														console.log('V1 Error AddGameData 4th query: ' + err);
													}
												}
											);
											guninfo = info[user].guns;
											for (gun in guninfo) {
												client.query("UPDATE outpost_guns, outpost_characters SET outpost_guns.hits=outpost_guns.hits+?, outpost_guns.misses=outpost_guns.misses+?, outpost_guns.kills=outpost_guns.kills+?, outpost_guns.deaths=outpost_guns.deaths+?, outpost_guns.skill_level_kills=outpost_guns.skill_level_kills+?, outpost_guns.skill_level_deaths=outpost_guns.skill_level_deaths+?, outpost_guns.headshots=outpost_guns.headshots+? WHERE outpost_characters.user_id=? AND gun_id=?", [guninfo[gun].hits, guninfo[gun].misses, guninfo[gun].kills, guninfo[gun].deaths, guninfo[gun].skill_level_kills, guninfo[gun].skill_level_deaths, guninfo[gun].headshots, result2[0].id, parseInt(guninfo[gun].id)],
													function (err, result5) {
														try {
															if (err || !result5) {
																console.log("failing" + err);
																res.end("fail" + err);
															}
														}
														catch (err) {
															console.log('V1 Error AddGameData 5th query: ' + err);
														}
													}
												);												
											}
											res.end("success");
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

function friendrequest(client, res, username, ticket, friendname) {
	//we get our id from this
	TicketConfirmation(client, username, ticket,
		function (err, result) {
			try {
				if (err || !result) {
					res.end("fail1");
				}
				else {
					if (username != friendname) {
						client.query("SELECT users.id FROM users LEFT JOIN friends ON (friends.user_id = users.id AND friends.friend_id = ?) OR (friends.friend_id = users.id AND friends.user_id = ?) WHERE LOWER(users.username) = LOWER(?) AND friends.user_id IS NULL", [result.id, result.id, friendname],							
							function (err, result2) {
								try {
									if (err || !result2[0]) {
										res.end("fails" + err);
									}
									else {		
										console.log("we have their id");
										client.query("INSERT INTO friends (user_id, friend_id) VALUES(?, ?)", [result.id, result2[0].id],
											function (err, result3) {
												try {
													if (err || !result3) {
														res.end("fail3");
													}
													else {
														res.end("success");
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
						res.end("you cant friend yourself");
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
					res.end("fail1");
				}
				else {
					//select id of the target friend
					client.query("SELECT id FROM users WHERE username=?", [friendname],
						function (err, result2) {
							try {
								if (err || !result2) {
									res.end("fail2");
								}
								else {
									//checking if already friends
									client.query("UPDATE friends SET accepted=1 WHERE user_id=? AND friend_id=? AND accepted=0", [result.id, result2[0].id],
										function (err, result3) {
											try {
												if (err || result3[0] != 1) {
													res.end("already friends");
												}
												else {	
													res.end("success");
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
					res.end("fail");
				}
				else {
					//selecting the id's of your friends that are accepted
					client.query("SELECT * FROM users INNER JOIN friends ON (friends.friend_id = users.id AND friends.user_id = ?) OR (friends.user_id = users.id AND friends.friend_id = ?) WHERE accepted=1", [result.id, result.id],
						function (err, result2) {
							try {
								if (err || !result2[0]) {
									res.end("fail");
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
					res.end("fail");
				}
				else {
					//select id of the target friend
					client.query("SELECT id FROM users WHERE username=?", [friendname],
						function (err, result2) {
							try {
								if (err || !result2) {
									res.end("fail");
								}
								else {
									//deleting the friend
									client.query("DELETE FROM friends WHERE user_id=? AND friend_id=? AND accepted=1", [result.id, result2[0].id],
										function (err, result3) {
											try {
												if (err || !result3) {
													res.end("fail" + err);
												}
												else {	
													res.end("success");
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