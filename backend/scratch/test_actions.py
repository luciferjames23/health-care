import urllib.request, json

def test_actions():
    req = urllib.request.Request('http://localhost:8000/api/finance/preauth/45006/submit', data=b'', method='POST')
    res = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    print('SUBMIT RES:', res)

    payload = json.dumps({'amount': 133500}).encode('utf-8')
    req2 = urllib.request.Request('http://localhost:8000/api/finance/preauth/45006/approve', data=payload, headers={'Content-Type': 'application/json'}, method='POST')
    res2 = json.loads(urllib.request.urlopen(req2).read().decode('utf-8'))
    print('APPROVE RES:', res2)

    req3 = urllib.request.Request('http://localhost:8000/api/finance/claims/45006/settle', data=b'', method='POST')
    res3 = json.loads(urllib.request.urlopen(req3).read().decode('utf-8'))
    print('SETTLE RES:', res3)

if __name__ == '__main__':
    test_actions()
