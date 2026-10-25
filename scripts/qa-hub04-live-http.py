# Requires fresh, authorized synthetic Auth fixtures and initial manager grants.
# Never use real accounts. Fixture/passwords stay outside the repository.
import json,urllib.request,urllib.error,time,os
from pathlib import Path
p=Path(os.environ['LEVIA_QA_FIXTURE']);s=json.loads(p.read_text())
assert len(s['users']) >= 4 and all(u['email'].endswith('@example.invalid') for u in s['users']), 'Synthetic QA identities only'
origin='https://dfhjfajbmnsgrklhqtjk.supabase.co';key='sb_publishable_oxJlqRLvE8xL4A6kGQ6U9g_1PlQD852'
results=[]
def call(path,body=None,token=None,method='POST'):
 h={'apikey':key,'Content-Type':'application/json'}
 if token:h['authorization']='Bearer '+token
 req=urllib.request.Request(origin+path,data=json.dumps(body).encode() if body is not None else None,headers=h,method=method)
 try:
  with urllib.request.urlopen(req,timeout=35) as r:return r.status,json.load(r) if r.status!=204 else {}
 except urllib.error.HTTPError as e:
  try:return e.code,json.loads(e.read())
  except:return e.code,{}
def check(label,actual,expected):
 if actual!=expected:raise AssertionError(f'{label}: {actual!r} != {expected!r}')
 results.append({'test':label,'result':'PASS'});print('PASS',label,flush=True)
def login(label):
 u=next(u for u in s['users'] if u['label']==label)
 status,data=call('/auth/v1/token?grant_type=password',{'email':u['email'],'password':s['qaPassword']})
 check('real Auth password '+label,status,200);s[label+'Tokens']=data;return data['access_token']
def authorize(token,cap='crm.read',scope='crm',kind='module',extra=None):
 return call('/functions/v1/hub-authorize',{'capability':cap,'scopeKind':kind,'scopeKey':scope,**(extra or {})},token)
def write(token,action,**kwargs):return call('/functions/v1/hub-admin-write',{'action':action,**kwargs},token)
try:
 m=login('manager');u=login('subject');o=login('outsider')
 subject=next(v['id'] for v in s['users'] if v['label']=='subject');manager=next(v['id'] for v in s['users'] if v['label']=='manager')
 check('manager core allowed',authorize(m,'core.read','core'),(200,{'allowed':True}))
 check('manager crm allowed',authorize(m),(200,{'allowed':True}))
 check('ungranted write denied',authorize(m,'crm.write'),(200,{'allowed':False}))
 check('authenticated outsider denied',authorize(o),(200,{'allowed':False}))
 check('no bearer rejected',authorize(None)[0],401)
 check('forged JWT rejected',authorize('forged.jwt.token')[0],401)
 check('global scope rejected',authorize(m,scope='global')[0],400)
 check('cross scope denied',authorize(m,scope='crm:other',kind='resource'),(200,{'allowed':False}))
 check('forged subject ignored',authorize(o,extra={'userId':manager}),(200,{'allowed':False}))
 check('outsider cannot write',write(o,'create-account',subject=subject)[0],403)
 check('manager creates account',write(m,'create-account',subject=subject)[0],200)
 check('disabled account denied',authorize(u),(200,{'allowed':False}))
 check('manager enables account',write(m,'set-enabled',subject=subject,enabled=True)[0],200)
 status,data=write(m,'issue-grant',subject=subject,capability='crm.read',scopeKind='module',scopeKey='crm');check('audited grant succeeds',status,200);s['qaGrant']=data['grantId']
 check('positive delegated permission',authorize(u),(200,{'allowed':True}))
 check('manager cannot self grant',write(m,'issue-grant',subject=manager,capability='crm.read',scopeKind='module',scopeKey='crm')[0],403)
 check('manager disables subject',write(m,'set-enabled',subject=subject,enabled=False)[0],200)
 check('disabled account with valid JWT denied',authorize(u),(200,{'allowed':False}))
 check('manager re-enables subject',write(m,'set-enabled',subject=subject,enabled=True)[0],200)
 check('revokes grant',write(m,'revoke-grant',grantId=s['qaGrant'])[0],200)
 check('revoked grant denied',authorize(u),(200,{'allowed':False}))
 status,data=write(m,'issue-grant',subject=subject,capability='crm.read',scopeKind='module',scopeKey='crm',validUntil=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(time.time()+30)));check('short-lived grant',status,200)
 time.sleep(31)
 check('expired grant denied',authorize(u),(200,{'allowed':False}))
 status,data=call('/auth/v1/token?grant_type=refresh_token',{'refresh_token':s['managerTokens']['refresh_token']});check('real refresh rotation',status,200);s['managerTokens']=data;m=data['access_token']
 state={'userId':manager,'accessToken':m,'refreshToken':data['refresh_token'],'accessExpiresAt':int(time.time()*1000)+data['expires_in']*1000,'issuedAt':int(time.time()*1000)}
 status,sealed=call('/functions/v1/hub-session',{'action':'seal','data':state},m);check('server session seal',status,200)
 envelope=sealed['envelope'];check('encrypted cookie fits',len(envelope)<3800,True)
 check('plaintext token absent from cookie',m not in envelope,True)
 status,opened=call('/functions/v1/hub-session',{'action':'open','envelope':envelope});check('session open',status,200);check('session correct identity',opened['data']['userId'],manager)
 check('tampered session rejected',call('/functions/v1/hub-session',{'action':'open','envelope':envelope[:-8]+'AAAAAAAA'})[0],401)
 status,_=call('/auth/v1/logout',{},m);check('real logout',status,204)
 check('logged-out envelope rejected',call('/functions/v1/hub-session',{'action':'open','envelope':envelope})[0],401)
 status,data=authorize(m,'core.read','core');check('logged-out access token denied',status==401 or (status==200 and data.get('allowed') is False),True)
 check('logged-out writer denied',write(m,'set-enabled',subject=subject,enabled=False)[0] in [401,403],True)
 # user metadata never participates in authorization
 check('user-editable metadata accepted by Auth',call('/auth/v1/user',{'data':{'role':'admin','users.manage':True}},o,method='PUT')[0],200)
 check('metadata escalation denied',authorize(o,'core.read','core'),(200,{'allowed':False}))
finally:
 s['qaResults']=results;p.write_text(json.dumps(s))
 Path('artifacts/hub04-live').mkdir(parents=True,exist_ok=True)
 Path('artifacts/hub04-live/http-qa.json').write_text(json.dumps({'environment':'Supabase levia-hub-dev; REAL Auth and PostgreSQL; synthetic identities only','checks':results},indent=2)+'\n')
