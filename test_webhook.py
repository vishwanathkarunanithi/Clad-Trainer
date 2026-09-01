import requests
import json

url = 'https://script.google.com/macros/s/AKfycbzH6LhVuapl_6w602GozE1zzwrzx9ZDH_jO_OAcfOWJ3yQgtAzzjR94uuCkqAK4NkuT/exec'
payload = {
    "testId": "TEST", 
    "date": "01/09", 
    "name": "vishwa", 
    "reg": "123", 
    "classSec": "A", 
    "score": 100, 
    "attempted": 40, 
    "total": 40
}

r = requests.post(url, data=json.dumps(payload), headers={'Content-Type': 'text/plain;charset=utf-8'})
print(r.status_code)
print(r.text)
