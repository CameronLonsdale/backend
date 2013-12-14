from Parse import Parse
from requests import get as WWW

def make_user(target):
    www = WWW(target + "/auth/register?username=test_test_test&password=lol&email=test@test.com&subscription=0&source=test")
    print www.text
    out = Parse(www.text)
    
    return not out.error

def login_user(target, password="lol"):
    www = WWW(target + "/auth/login?username=test_test_test&password=" + password)
    print www.text
    out = Parse(www.text)
    
    if out.error:
        return None
    return out.values

def confirm_user(target, secure_code):
    www = WWW(target + "/auth/confirm?username=test_test_test&secure_code=" + secure_code)
    print www.text
    out = Parse(www.text)
    
    return not out.error

def change_password(target, ticket):
    www = WWW(target + "/auth/changepassword?username=test_test_test&ticket=" + ticket + "&new_password=lolies")
    print www.text
    out = Parse(www.text)
    
    return not out.error

def main(target):
    if not make_user(target):
        print "Failed Making User"
    if make_user(target):
        print "Failed User Duplication"
    
    values = login_user(target)
    if not values:
        print "Failed Logging In"
    
    if not confirm_user(target, values[1]):
        print "Failed Confirming Secure Code"
    
    if not change_password(target, values[0]):
        print "Failed Changing Password"
    
    if not login_user(target, password="lolies"):
        print "Failed Logging in with Changed Password"
    
    print "Authentication Success!"

if __name__ == "__main__":
    main("http://127.0.0.1:3000/v1")