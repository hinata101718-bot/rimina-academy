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
# territories
seeds=[]
tries=0
while len(seeds)<26 and tries<200000:
    tries+=1
    x,y=rng.uniform(40,W-40),rng.uniform(40,H-40)
    if not land[int(y),int(x)] or e[int(y),int(x)]<.05: continue
    if any((x-a)**2+(y-b)**2<70**2 for a,b in seeds): continue
    seeds.append((x,y))
S=np.array(seeds)
dist=((xx[...,None]-S[:,0])**2+(yy[...,None]-S[:,1])**2)
lab=dist.argmin(-1)
fac=[]
lcy,lcx=[v.mean() for v in np.nonzero(land)]
for x,y in seeds:
    a=math.degrees(math.atan2(y-lcy,x-lcx)); dd=math.hypot(x-lcx,y-lcy)
    if dd<55: f='N'
    elif -140<a<-20: f='E'
    elif a>=100 or a<=-140: f='K'
    else: f='A'
    fac.append(f)
col={'K':(190,60,50),'E':(60,100,180),'A':(80,150,70),'N':(160,150,130)}
tint=np.zeros((H,W,3),np.float32)
for i,f in enumerate(fac): tint[lab==i]=col[f]
alpha=0.32
img=np.where(land[...,None],img*(1-alpha)+tint*alpha,img)
# borders
bd=np.zeros((H,W),bool)
bd[:-1,:]|=lab[:-1,:]!=lab[1:,:]; bd[:,:-1]|=lab[:,:-1]!=lab[:,1:]
facarr=np.array([ord(f) for f in fac])[lab]
nb=np.zeros((H,W),bool); nb[:-1,:]|=facarr[:-1,:]!=facarr[1:,:]; nb[:,:-1]|=facarr[:,:-1]!=facarr[:,1:]
dash=((xx+yy)//6%2==0)
img[bd&land&dash]=img[bd&land&dash]*0.45
nbm=np.array(Image.fromarray((nb&land).astype(np.uint8)*255).filter(ImageFilter.MaxFilter(5)))>0
img[nbm]=img[nbm]*0.55+np.array([255,230,160])*0.25
# coastline dark edge
lm=Image.fromarray(land.astype(np.uint8)*255)
edge=(np.array(lm.filter(ImageFilter.MaxFilter(5)))>0)&~land
img[edge]=img[edge]*0.4
glow=np.array(lm.filter(ImageFilter.GaussianBlur(14)),np.float32)/255
img=np.where(land[...,None],img,img+glow[...,None]*np.array([60,45,30]))
# rivers: trace downhill from some peaks
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
Image.fromarray(img).save('real_base.png')
json.dump({'seeds':seeds,'fac':fac},open('real_seeds.json','w'))
json.dump({'c':[float(lcx),float(lcy)]},open('real_c.json','w'));print(len(seeds), fac.count('E'),fac.count('K'),fac.count('A'),fac.count('N'))
