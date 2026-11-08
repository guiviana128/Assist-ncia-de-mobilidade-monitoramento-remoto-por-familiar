"""python -m app.worker; capture continues independently of the browser."""
import json
import logging
import os
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from urllib.parse import urlparse
import cv2
from .outbox import Outbox

log=logging.getLogger('amparo.camera')
def post(url,body,headers):
    with urlopen(Request(url,data=body,headers=headers,method='POST'),timeout=5) as r:
        return json.loads(r.read())
def main():
    logging.basicConfig(level=logging.INFO)
    device=os.environ['AMPARO_DEVICE_ID'];key=os.environ['AMPARO_DEVICE_KEY']
    import re
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}',device):raise ValueError('Identificador de dispositivo inválido')
    backend=os.getenv('AMPARO_API_URL','http://127.0.0.1:8080/api/v1').rstrip('/')
    vision=os.getenv('AMPARO_VISION_URL','http://127.0.0.1:8001').rstrip('/')
    for url in (backend,vision):
        parsed=urlparse(url)
        if parsed.scheme!='https' and parsed.hostname not in ('localhost','127.0.0.1','::1'):
            raise ValueError('Use HTTPS fora do computador local')
    source=os.getenv('AMPARO_CAMERA_INDEX','0')
    camera=cv2.VideoCapture(int(source))
    session=str(uuid.uuid4());headers={'X-API-Key':key,'Content-Type':'application/json'}
    path=Path(os.getenv('AMPARO_OUTBOX',f'data/{device}-camera-events.sqlite'));path.parent.mkdir(parents=True,exist_ok=True)
    queue=Outbox(path);last_heartbeat=0
    def beat(component,state):
        try:post(f'{backend}/care/{device}/heartbeat/{component}?state={state}',b'{}',headers)
        except Exception:log.warning('Servidor sem resposta ao heartbeat de %s',component)
    try:
        while True:
            start=time.monotonic();ok,frame=camera.read();vision_ok=False
            if ok:
                height,width=frame.shape[:2];frame=cv2.resize(frame,(640,max(1,round(height*640/width))))
                encoded,jpeg=cv2.imencode('.jpg',frame,[cv2.IMWRITE_JPEG_QUALITY,72])
                if encoded:
                    boundary='amparo'+uuid.uuid4().hex
                    parts=[]
                    for name,value in [('session_id',session),('device_id',device)]:parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
                    parts.extend([f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="frame.jpg"\r\nContent-Type: image/jpeg\r\n\r\n'.encode(),jpeg.tobytes(),f'\r\n--{boundary}--\r\n'.encode()])
                    try:
                        meta=post(vision+'/api/v1/vision/analyze',b''.join(parts),{'Content-Type':'multipart/form-data; boundary='+boundary});vision_ok=True
                        if meta['gesture']['confirmed']:queue.add(meta);log.info('Metadados do gesto guardados para entrega')
                    except Exception:log.warning('Serviço de visão sem resposta')
            else:
                camera.release();time.sleep(1);camera=cv2.VideoCapture(int(source))
            for event,metadata in queue.pending():
                try:post(backend+'/vision/events',json.dumps(metadata).encode(),headers);queue.delivered(event)
                except HTTPError as exc:
                    if exc.code in (400,403,404,413,415,422):queue.reject(event,str(exc.code));log.error('Evento retido na auditoria por recusa %s',exc.code)
                    else:log.warning('Evento pendente; serviço indisponível');break
                except Exception:log.warning('Evento pendente; nova tentativa no próximo ciclo');break
            if time.monotonic()-last_heartbeat>=5:
                beat('camera','ACTIVE' if ok else 'ERROR');beat('vision','ACTIVE' if vision_ok else 'ERROR');last_heartbeat=time.monotonic()
            time.sleep(max(0,.65-(time.monotonic()-start)))
    except KeyboardInterrupt:pass
    finally:
        camera.release();queue.db.close();beat('camera','STOPPED');beat('vision','STOPPED')
if __name__=='__main__':main()
