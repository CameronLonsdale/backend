/*
reply protocol:
e = error. Followed by error message
s = success. Followed by data
*/

var randomstring = require('randomstring').generate;
var hash = require('node_hash');
var check = require('validator').check;

var outpostversion = '0.26';

module.exports = {
    eval : ParseUrl,
}

function ParseUrl(client, pass, res) {
    //--Global--
    if (pass.pathname.slice(0, 5) === '/auth') {
        pass.pathname = pass.pathname.slice(5);
        ParseAuth(client, pass, res);
    }
    //--Outpost Game--
    else if (pass.pathname.slice(0, 8) === '/outpost') {
        pass.pathname = pass.pathname.slice(8);
        ParseOutpost(client, pass, res);
    }
    //--Social--
    else if (pass.pathname.slice(0, 7) === '/social') {
        pass.pathname = pass.pathname.slice(7);
        ParseSocial(client, pass, res);
    }
    //--Error--
    else {
        res.end('eInvalid URL');
    }
}

/* ===========================================
                    AUTH
===============================================*/

function ParseAuth(client, pass, res) {
    switch (pass.pathname) {
    case '/login':
        Login(client, res,
              pass.query.username.toLowerCase(),
              pass.query.password
        );
    break;
    case '/register':
        Register(client, res,
                 pass.query.username.toLowerCase(),
                 pass.query.password,
                 pass.query.email.toLowerCase(),
                 parseInt(pass.query.subscription)
        );
    break;
    case '/check_free_name':
        CheckFreeUsername(client, res, pass.query.username.toLowerKey());
    break;
    case '/confirm':
        ConfirmUser(client, res,
                    pass.query.username.toLowerCase(),
                    pass.query.secure_code
        );
    break;
    case '/changepassword':
        ChangePassword(client, res,
                       pass.query.username.toLowerCase(),
                       pass.query.ticket,
                       pass.query.new_password
        );
    break;
    default:
        res.end('eInvalid URL');
    }
}

function CheckFreeUsername(client, res, username) {
    client.query('SELECT id FROM users WHERE username=?',
                 [username],
        function (err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            if (result.length === 0) {
                res.end('s1');
            }
            else {
                res.end('s0');
            }
        }
    );
}

//Login
function Login(client, res, username, password) {
    //check for invalid parameters
    if ('undefined' in [typeof username, typeof password]) {
        res.end('eInvalid Parameters')
        return;
    }

	client.query('SELECT password_salt, password_hash, id FROM users WHERE username=? AND confirmed=1',
                 [username],
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
function Register(client, res, username, password, email, subscription) {
    //check for invalid parameters
    if ('undefined' in [typeof username, typeof password, typeof email, typeof subscription]) {
        res.end('eInvalid Parameters')
        return;
    }
    
    if (check(email).len(6, 64).isEmail()) {
        //check duplicates
        client.query('SELECT username, email FROM users WHERE username=? OR email=?',
                     [username, email],
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
                createUser(client, res, username, password, email, subscription);
            }
        );
    }
    else {
        res.end('eInvalid Email');
    }
}

function CreateUser(client, res, username, password, email, subscription) {
    salt = randomstring(12);
    ticket = randomstring(32);
    secureCode = randomstring(32);

    client.query('INSERT INTO users (username, password_hash, password_salt, email, subscription, ticket, secure_code) ' +
                 'VALUES(?, ?, ?, ?, ?, ?, ?)',
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
        }
    );
}

//confirm user with secure code
function ConfirmUser(client, res, username, secure_code) {
    if ('undefined' in [typeof username, typeof secure_code]) {
        res.end('eInvalid Parameters');
        return;
    }
    
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
function ChangePassword(client, res, username, ticket, newPassword) {
    if ('undefined' in [typeof username, typeof ticket, typeof newPassword]) {
        res.end('eInvalid Parameters');
        return;
    }
    
    salt = randomstring(12);

    client.query('UPDATE users SET password_hash=?, password_salt=? WHERE username=? AND ticket=?',
        [hash.sha512(newPassword, salt), salt, username, ticket],
        function confirmPasswordChange(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
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
        GetCharacterData(client, res, pass.query.username.toLowerCase());
    break;
    case '/character/set':
        SetCharacterData(client, res, pass.query.username.toLowerCase(),
                         pass.query.ticket, pass.query.name,
                         pass.query.gender);
    break;
    case '/character/get_free_name':
        CheckFreeCharacterName(client, query, pass.query.name);
    break;
    
    //game
    case '/game/save':
        SaveGame(client, res, pass.query.username.toLowerCase(), pass.query.ticket, pass.query.data);
    break;
    case '/game/client':
        SaveGameStats(client, res, pass.query.username.toLowerCase(), pass.query.ticket,
                      pass.query.clientname.toLowerCase(), pass.query.secure_code,
                      pass.query.data);
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

function GetCharacterData(client, res, username) {
    client.query('SELECT name, exp, gender FROM characters ' +
                 'WHERE user_id=(SELECT id FROM users WHERE username=?)',
                 [username],
        function GottenCharacterData(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            if (result.length != 1) {
                res.end('eInvalid User');
            }
            else {
                result = result[0];
                result = [result.name, result.exp, result.username].join(';');
                
                GetCharacterGunData(client, res, username, result);
            }
        }
    );
}

function GetCharacterGunData(client, res, username, out) {
    client.query('SELECT gun_id, kills, deaths, sl_kills, sl_deaths ' +
                 'FROM outpost_guns ' +
                 'WHERE outpost_character_id=(SELECT id FROM outpost_characters ' +
                 'WHERE user_id=(SELECT id FROM users WHERE username=?))',
                 [username],
        function GottenCharacterGunData(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            for (res in result) {
                out += ';' + [res.gun_id, res.kills, res.deaths, res.sl_kills, res.sl_deaths].join(';');
            }
            
            res.end('s' + out);
        }
    );
}

function CheckFreeCharacterName(client, res, name) {
    client.query('SELECT id FROM outpost_characters WHERE name=?',
                 [name],
        function (err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            if (result.length === 0) {
                res.end('s1');
            }
            else {
                res.end('s0');
            }
        }
    );
}

function SetCharacterData(client, res, username, ticket, name, gender) {
    client.query('UPDATE outpost_characters SET ' +
                 'name=?, gender=? ' +
                 'WHERE user_id=(SELECT id FROM users WHERE username=? AND ticket=?)',
                 [name, gender, username, ticket],
        function CompleteCharacterSetData(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            res.end('s');
        }
    );
}

//Game functions
function SaveGame(client, res, username, ticket, data) {
    //save data
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
                     'VALUES (?, ?, ?, ?, ?, ?, ?) ',
                     'WHERE (SELECT SUM(id) FROM users WHERE username=? AND ticket=?) = 1',
                     [map, gameMode, team1Kills, team2Kills, team1Deaths, team2Deaths, gameLength, username, ticket],
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

function SaveGameStats(client, res, username, ticket, clientname, secure_code, data) {
    if (username !== clientname) {
        res.end('eInvalid Users');
        return;
    }
    
    //parse data
    data = data.split(' ');
    if (data.length >= 1) {
        experience = parseFloat(data[0]);
        
        guns = [];
        for (i = 1; i < data.length; i += 5) {
            gun = {};
            
            gun.id = data[i + 0]
            gun.kills = data[i + 1];
            gun.deaths = data[i + 2];
            gun.slkills = data[i + 3];
            gun.sldeaths = data[i + 4];
            
            guns.add(gun);
        }
    }
    else {
        res.end('eInvalid Data');
        return;
    }
    
    //update data
    client.query('UPDATE outpost_characters SET exp = exp + ? ' +
                 '(SELECT id FROM users WHERE username=? AND secure_code=?) = user_id' +
                 '(SELECT SUM(id) FROM users WHERE username=? AND ticket=?) = 1',
                 [experience, clientname, secure_code, username, ticket],
        function SavedGameStats(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            //SaveGunStats(client, clientname, guns);
            res.end('s');
        }
    );
}

function SaveGunStats(client, username, guns) {
    for (gun in guns) {
        client.query('INSERT INTO outpost_guns ' +
                     '(gun_id, kills, deaths, sl_kills, sl_deaths) ' +
                     'VALUES(?, ?, ?, ?, ?) ' +
                     'ON DUPLICATE KEY ' +
                     'UPDATE outpost_guns SET ' +
                     'kills = kills + ?, ' +
                     'deaths = deaths + ?, ' +
                     'sl_kills = sl_kills + ?, ' +
                     'sl_deaths = sl_deaths + ? ' +
                     'WHERE gun_id = ? AND ' +
                     'outpost_character_id = ' + 
                     '(SELECT id FROM outpost_characters WHERE user_id = ' +
                     '(SELECT id FROM users WHERE username = ?))',
                     [gun.kills, gun.deaths, gun.slkills, gun.sldeaths, username],
            function SavedGunStats(err, result) {
                if (err || !result) {
                    throw err;
                }
            }
        );
    }
}

function GetGlobalData(client, res) {
    client.query('SELECT ' + 
        'COALESCE(SUM(team1_kills), 0) AS t1Kills, ' + 
        'COALESCE(SUM(team2_kills), 0) AS t2Kills, ' + 
        'COALESCE(SUM(team1_deaths), 0) + COALESCE(SUM(team2_deaths), 0) AS casulties, ' + 
        'SUM(id) AS games ' +
        'FROM outpost_games', 
        function getTotalKills(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                return;
            }
            
            casulties = result[0].casulties;
            team1_total = result[0].t1Kills;
            team2_total = result[0].t2Kills;
            total_games = result[0].games;
            
            res.end('s' + casulties + ';' + team1_total + ';' + team2_total + ";" + total_games);
        }
    );
}

/* ===============================
		    Social
=================================*/

//v1/social
// - friend
// -   request
// -   accept
// -   unfriend
// -   getfriends

function ParseSocial(client, pass, res) {
    switch  (pass.pathname) {
        case '/friend/request':
            FriendRequest(client, res, pass.query.username.toLowerCase(),
                          pass.query.ticket, pass.query.friendname.toLowerCase());
            break;
        case '/friend/accept':
            FriendAccept(client, res, pass.query.username.toLowerCase(),
                         pass.query.ticket, pass.query.friendname.toLowerCase());
            break;
        case '/friend/unfriend':
            Unfriend(client, res, pass.query.username.toLowerCase(),
                     pass.query.ticket, pass.query.friendname.toLowerCase());
            break;
        case '/friend/get':
            GetFriends(client, res, pass.query.username.toLowerCase());
            break;
        default:
            res.end('eInvalid URL');
    }
}

// issue: multiple identical friend requests can be sent
// solution: ensure each friend relationship is unique by searching for relationship before request
function FriendRequest(client, res, username, ticket, friendname) {
    if (username === friendname) {
        res.end('eInvalid Friend');
        return;
    }
    
    client.query('INSERT INTO friends (user_id, friend_id) ' +
                 'SELECT users.id, friends.id ' +
                 'FROM users JOIN users friends ON users.username=? AND friends.username=? AND users.ticket=?',
        [username, friendname, ticket],
        function ConfirmFriendRequest(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            else if (!result.affectedRows) {
                res.end('eIllegal user ticket or friend does not exist');
            }
            else {
                res.end('s');
            }
        }
    );
}

// automatically handles multiple identical friend requests
function FriendAccept(client, res, username, ticket, friendname) {
    client.query('UPDATE friends SET accepted=1 WHERE user_id=(SELECT f.id FROM users f WHERE f.username=?) AND ' +
                 'friend_id=(SELECT u.id FROM users u WHERE u.username=? AND ticket=?) AND accepted=0',
        [friendname, username, ticket],
        function ConfirmFriendAccept(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            else if (!result.affectedRows) {
                res.end('eIllegal user ticket, already friends or no friend request was sent');
            }
            else {
                res.end('s');
            }
        }
    );
}

// automatically handles multiple identical friend requests
function Unfriend(client, res, username, ticket, friendname) {
    client.query('DELETE FROM friends WHERE ' +
                 '(user_id=(SELECT u.id FROM users u WHERE u.username=? AND u.ticket=?) AND friend_id=(SELECT f.id from users f where f.username=?)) OR ' +
                 '(user_id=(SELECT f.id from users f where f.username=?) AND friend_id=(SELECT u.id FROM users u WHERE u.username=? AND u.ticket=?))',
        [username, ticket, friendname, friendname, username, ticket],
        function ConfirmUnFriend(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            if (!result.affectedRows) {
                res.end('eIllegal user ticket or already not friends');
            }
            else {
                res.end('s');
            }
        }
    );
}

//TODO: Also has to return whether it's accepted or not
function GetFriends(client, res, username) {
    client.query('SELECT users.username, friends.accepted FROM users, friends WHERE ' +
                 '(user_id=id AND friend_id=(SELECT id from users WHERE username=?)) OR ' +
                 '(friend_id=id AND user_id=(SELECT id from users WHERE username=?))',
        [username, ticket, username],
        function ConfirmGetFriends(err, result) {
            if (err || !result) {
                res.end('eInternal Error');
                throw err;
            }
            
            friends = result.map(function(i){return i.username + ";" + i.accepted});
            res.end('s' + friends.join(";"));
        }
    );
}
