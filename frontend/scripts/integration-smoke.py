"""Explicit live smoke test. Writes only to a dedicated smoke-* device, never device-001.
Creates synthetic images. Displayed images cannot be deleted through the MVP API;
record IDs and outstanding rows are recorded in the report for backend cleanup.
"""
import argparse, json, io, uuid, subprocess, tempfile
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageDraw
parser=argparse.ArgumentParser(); parser.add_argument('--run-live',action='store_true'); args=parser.parse_args()
if not args.run_live: raise SystemExit('Use --run-live to explicitly run the live test')
base='https://g-team-backend.originteamg.workers.dev'
device='smoke-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
prefix='/devices/'+device
report={'device_id':device,'checks':[],'created_image_ids':[],'shared_device_modified':False}
def raw(method,url,body=None,headers=None):
 with tempfile.TemporaryDirectory(prefix='mimamori-smoke-') as temp:
  hp=Path(temp)/'headers'; bp=Path(temp)/'body'
  cmd=['curl','--max-time','25','--silent','--show-error','--request',method,'--dump-header',str(hp),'--output',str(bp),'--write-out','%{http_code}',url]
  for k,v in (headers or {}).items(): cmd+=['--header',k+': '+v]
  if body is not None: cmd+=['--data-binary','@-']
  result=subprocess.run(cmd,input=body,capture_output=True,check=True)
  hs={}
  for line in hp.read_text().splitlines():
   if ':' in line:
    k,v=line.split(':',1);hs[k.lower()]=v.strip()
  return int(result.stdout),bp.read_bytes(),hs

def call(method,path,data=None,content_type='application/json',expected=200):
 body=None if data is None else (json.dumps(data).encode() if content_type=='application/json' else data)
 code,content,headers=raw(method,base+path,body,{'Content-Type':content_type,'Origin':'http://127.0.0.1:5173'})
 assert code==expected,(method,path,code,content[:200])
 assert headers.get('access-control-allow-origin') in ('*','http://127.0.0.1:5173'), 'CORS missing'
 return json.loads(content)
def check(name, condition):
 assert condition,name
 report['checks'].append(name); print('PASS',name,flush=True)
def upload(label):
 im=Image.new('RGB',(320,240),'#285c48'); ImageDraw.Draw(im).text((25,100),'INTEGRATION TEST '+label,fill='white'); buf=io.BytesIO(); im.save(buf,format='JPEG')
 boundary='smoke'+uuid.uuid4().hex; chunks=[]
 for name in ['original','display']:
  chunks.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"; filename="synthetic.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode()+buf.getvalue()+b'\r\n')
 chunks.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="crop"\r\n\r\n'+json.dumps({'x':0,'y':0,'w':320,'h':240})+'\r\n--'+boundary+'--\r\n').encode())
 out=call('POST',prefix+'/images',b''.join(chunks),'multipart/form-data; boundary='+boundary,201)
 report['created_image_ids'].append(out['image_id']); return out['image_id']
try:
 shared=call('GET','/devices/device-001/status');check('shared status read', 'is_offline' in shared)
 shared_images=call('GET','/devices/device-001/images?status=all');check('shared images read',isinstance(shared_images['images'],list))
 call('GET',prefix+'/status')
 call('PATCH',prefix+'/settings',{'test_mode':True,'switch_time':'23:59'})
 a=upload('A'); b=upload('B'); check('multipart upload',a!=b)
 call('PATCH',prefix+'/images/'+b,{'after_image_id':None})
 listing=call('GET',prefix+'/images');check('queue reorder',listing['images'][0]['image_id']==b)
 call('DELETE',prefix+'/images/'+a)
 listing=call('GET',prefix+'/images');check('queued image delete', all(x['image_id']!=a for x in listing['images']))
 call('POST',prefix+'/display/advance',{})
 status=call('GET',prefix+'/status');check('advance persists current image',status['current_image_id']==b)
 call('DELETE',prefix+'/images/'+b,expected=400);check('displayed image deletion rejected',True)
 display=call('GET',prefix+'/display');check('parent display payload',display.get('image_id')==b)
 call('POST',prefix+'/likes',{'image_id':b})
 listing=call('GET',prefix+'/images'); photo=next(x for x in listing['images'] if x['image_id']==b)
 check('like round trip',photo['like_count']==1 and bool(photo['last_liked_at']))
 code,image_bytes,headers=raw('GET',photo['display_url'])
 assert code==200, 'signed image request failed'
 img=Image.open(io.BytesIO(image_bytes));check('signed image JPEG 320x240',img.format=='JPEG' and img.size==(320,240))
 call('POST',prefix+'/warnings',{'reason':'demo'})
 status=call('GET',prefix+'/status');check('demo warning round trip',status['warning_reason']=='demo' and bool(status['warned_at']))
 call('DELETE',prefix+'/warnings');check('manual warning clear',call('GET',prefix+'/status')['warned_at'] is None)
 call('POST',prefix+'/warnings',{'reason':'demo'}); call('POST',prefix+'/detections',{})
 status=call('GET',prefix+'/status');check('empty detection body and first detection clear',bool(status['last_detected_at']) and status['warned_at'] is None)
 report['result']='PASS'
except Exception as e:
 report['result']='FAIL';report['error']=str(e);print('FAIL',str(e),flush=True)
finally:
 try:
  call('PATCH',prefix+'/settings',{'test_mode':False}); check('test device normal mode restored',call('GET',prefix+'/status')['test_mode'] is False)
  call('DELETE',prefix+'/warnings')
  listing=call('GET',prefix+'/images')
  for p in listing['images']:
   if p['status']=='queued': call('DELETE',prefix+'/images/'+p['image_id'])
  report['remaining_displayed_ids']=[p['image_id'] for p in listing['images'] if p['status']=='displayed']
 except Exception as e: report['cleanup_error']=str(e)
 out=Path(__file__).resolve().parents[1]/'docs'/'integration-smoke-result.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print('Report:',out,flush=True)
if report['result']!='PASS' or 'cleanup_error' in report: raise SystemExit(1)
