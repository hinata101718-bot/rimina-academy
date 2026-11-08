# 勢力図の素材を作る（13夜目）：docs/mockups/worldmap-gen.py をもとに、地形の絵（国の色なし）と、地域の区分けの絵・地域の中心とつながりを書き出す
# 使い方：python3 scripts/worldmap-make.py（今いるフォルダに base.png・regions.png・regions.json ができる）
import numpy as np, math, json
from PIL import Image, ImageFilter
rng=np.random.default_rng(11)
W,H=740,940
def octave(n):
    g=rng.random((n,n)).astype(np.float32)
    return np.array(Image.fromarray((g*255).astype(np.uint8)).resize((W,H),Image.BICUBIC),np.float32)/255
def fbm(oct=7,base=4,pers=.5):
    a=np.zeros((H,W),np.float32); amp=1; tot=0
    for i in range(oct):
        a+=octave(base*2**i)*amp; tot+=amp; amp*=pers
    return a/tot
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
cx,cy=W*.5,H*.5
d=np.sqrt(((xx-cx)/(W*.46))**2+((yy-cy)/(H*.47))**2)
n=fbm()
elev=n*1.1-d**2*0.55+0.12
# bay cut
elev-=0.25*np.exp(-(((xx-W*.78)/60)**2+((yy-H*.62)/70)**2))
elev-=0.2*np.exp(-(((xx-W*.2)/50)**2+((yy-H*.3)/60)**2))
sea=0.18
land=elev>sea
# remove tiny islands far: keep
e=np.clip((elev-sea)/(elev.max()-sea),0,1)
# ridge mountains
ridge=1-np.abs(fbm(6,3)-.5)*2
mount=np.clip((ridge-.72)*3.5,0,1)*np.clip(e*3,0,1)
e2=np.clip(e*0.6+mount*0.7,0,1)
# hillshade
gy,gx=np.gradient(e2*260)
shade=np.clip(0.75+(-gx*0.6-gy*0.8)/ (np.sqrt(gx**2+gy**2+1)) *0.5,0.3,1.3)
# land colors
low=np.array([150,160,105]);mid=np.array([175,160,110]);high=np.array([130,105,75]);peak=np.array([225,215,195])
c=np.zeros((H,W,3),np.float32)
t=e2[...,None]
c=np.where(t<.35, low+(mid-low)*(t/.35), np.where(t<.7, mid+(high-mid)*((t-.35)/.35), high+(peak-high)*np.clip((t-.7)/.3,0,1)))
# forests: noise patches in lowlands
forest=(fbm(5,8)>.58)&(e2<.45)
c[forest]=c[forest]*0.75+np.array([60,90,50])*0.25
c=c*shade[...,None]
# sea
depth=np.clip((sea-elev)/0.5,0,1)[...,None]
seac=np.array([120,95,110])*(1-depth)+np.array([55,38,52])*depth
shallow=(elev>sea-0.04)&(~land)
img=np.where(land[...,None],c,seac)
img[shallow]=img[shallow]*0.6+np.array([170,150,140])*0.4

# coastline dark edge
lm=Image.fromarray(land.astype(np.uint8)*255)
edge=(np.array(lm.filter(ImageFilter.MaxFilter(5)))>0)&~land
img[edge]=img[edge]*0.4
glow=np.array(lm.filter(ImageFilter.GaussianBlur(14)),np.float32)/255
img=np.where(land[...,None],img,img+glow[...,None]*np.array([60,45,30]))
# rivers

for _ in range(6):
    yv,xv=np.unravel_index(np.argmax(e2*(rng.random((H,W))>.9995)),e2.shape)
    y,x=int(yv),int(xv)
    for step in range(500):
        if not land[y,x]: break
        img[max(0,y-1):y+2,max(0,x-1):x+2]=img[max(0,y-1):y+2,max(0,x-1):x+2]*0.4+np.array([90,130,170])*0.6
        win=elev[max(0,y-3):y+4,max(0,x-3):x+4]
        dy,dx=np.unravel_index(win.argmin(),win.shape)
        ny,nx=max(0,y-3)+dy,max(0,x-3)+dx
        if (ny,nx)==(y,x): ny,nx=y+rng.integers(-2,3),x+rng.integers(-2,3)
        y,x=int(np.clip(ny,0,H-1)),int(np.clip(nx,0,W-1))

# parchment grain + sepia + vignette

grain=np.array(Image.fromarray(((rng.random((H,W))*255)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(.7)),np.float32)/255*18-9
img=img+grain[...,None]
sep=np.array([1.05,0.97,0.85]); img=img*sep
vig=np.clip(1.15-d*0.35,0.55,1.1); img=img*vig[...,None]
img=np.clip(img,0,255).astype(np.uint8)

img=np.clip(img,0,255).astype(np.uint8)
Image.fromarray(img).save('base.png')
# regions: 15 seeds on land, well spread
seeds=[]; tries=0
while len(seeds)<15 and tries<400000:
    tries+=1
    x,y=rng.uniform(50,W-50),rng.uniform(50,H-50)
    if not land[int(y),int(x)] or e[int(y),int(x)]<.08: continue
    if any((x-a)**2+(y-b)**2<128**2 for a,b in seeds): continue
    seeds.append((float(x),float(y)))
S=np.array(seeds)
dist=((xx[...,None]-S[:,0])**2+(yy[...,None]-S[:,1])**2)
lab=dist.argmin(-1).astype(np.uint8)
lab[~land]=255
Image.fromarray(lab).save('regions.png')
cent=[]
for i in range(len(seeds)):
    ys,xs=np.nonzero(lab==i); cent.append([float(xs.mean()),float(ys.mean()),int(len(xs))])
adj=set()
for a,b in [(lab[:-1,:],lab[1:,:]),(lab[:,:-1],lab[:,1:])]:
    m=(a!=b)&(a!=255)&(b!=255)
    for p,q in set(zip(a[m].tolist(),b[m].tolist())): adj.add((min(p,q),max(p,q)))
lcy,lcx=[v.mean() for v in np.nonzero(land)]
json.dump({'w':W,'h':H,'seeds':seeds,'cent':cent,'adj':sorted(adj),'center':[float(lcx),float(lcy)]},open('regions.json','w'))
print(len(seeds), tries)
