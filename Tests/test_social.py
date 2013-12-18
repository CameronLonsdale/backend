from __future__ import print_function
from Parse import Parse
from requests import get as WWW

def make_user(target, name, password, email):
    www = WWW(target + "/auth/register?username=" + name + "&password=" + password + "&email=" + email + "&subscription=0&source=test")
    out = Parse(www.text)
    
    if out.error:
        www = WWW(target + "/auth/login?username=" + name + "&password=" + password)
        out = Parse(www.text)
        
        if out.error: raise Exception("Auth Fail")
    
    return out.values

def get_friends(target, name):
    www = WWW(target + "/social/friend/get?username=" + name)
    out = Parse(www.text)
    
    if out.error: raise Exception("Friend Get fail")
    return out.values

def friend_request(target, name, ticket, friendname):
    www = WWW(target + "/social/friend/request?username=" + name + "&ticket=" + ticket + "&friendname=" + friendname)
    out = Parse(www.text)
    
    return not out.error

def friend_accept(target, name, ticket, friendname):
    www = WWW(target + "/social/friend/accept?username=" + name + "&ticket=" + ticket + "&friendname=" + friendname)
    out = Parse(www.text)
    
    return not out.error

def main(target):
    u1 = make_user(target, "user1", "1", "user1@user1.com")
    u2 = make_user(target, "user2", "2", "user2@user2.com")
    
    if len(get_friends(target, "user1")) != 1:
        raise Exception("Friend Get Failed")
    
    if not friend_request(target, "user1", u1[0], "user2"):
        raise Exception("Friend Request Failed")
    
    if friend_request(target, "user2", u2[0], "user1"):
        raise Exception("Friend Request Failed")
    
    if friend_accept(target, "user1", u1[0], "user2"):
        raise Exception("Friend Request Accept Failed")
    
    if not friend_accept(target, "user2", u2[0], "user1"):
        raise Exception("Friend Request Accept Failed")
    
    if not "user2" in get_friends(target, "user1"):
        raise Exception("Friend Get Failed")
    
    print("Social Success!")

if __name__ == "__main__":
    main("http://127.0.0.1:3000/v1")