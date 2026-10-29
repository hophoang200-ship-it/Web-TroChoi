'use strict';
// ====== CẤU HÌNH & TRẠNG THÁI ======
const CFG={mode:'ai',lvl:'hard',qv:10,names:['Bạn','Đối thủ'],sound:true,speed:230};
let G=null,view=null,busy=false,paused=false,sel=null,gen=0;
const $=id=>document.getElementById(id);
const mod=i=>(i%12+12)%12;
const isQ=i=>i===0||i===6;
const mine=p=>p===0?[7,8,9,10,11]:[1,2,3,4,5];
const ownerOf=i=>i>=7?0:(i>=1&&i<=5?1:-1);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// ====== LOGIC LUẬT CHƠI (thuần, không đụng giao diện) ======
function newState(){const pits=Array(12).fill(5),qf=Array(12).fill(false);pits[0]=pits[6]=0;qf[0]=qf[6]=true;return{pits,qf,cd:[0,0],cq:[0,0],turn:0,over:false}}
const clone=s=>({pits:s.pits.slice(),qf:s.qf.slice(),cd:s.cd.slice(),cq:s.cq.slice(),turn:s.turn,over:s.over});
const score=(s,p)=>s.cd[p]+s.cq[p]*CFG.qv;
const content=(s,i)=>s.pits[i]+(s.qf[i]?1:0);
const capturable=(s,i)=>!(s.qf[i]&&s.pits[i]<5); // quan non (<5 dân) chưa được ăn
function legalMoves(s,p){const m=[];for(const i of mine(p))if(s.pits[i]>0){m.push([i,1]);m.push([i,-1])}return m}
// Thực hiện một nước đi; trả về danh sách bước (ảnh chụp) để phát hoạt ảnh
function play(s,p,pit,dir){
  const steps=[];
  const snap=(msg,hl,k)=>steps.push({pits:s.pits.slice(),qf:s.qf.slice(),cd:s.cd.slice(),cq:s.cq.slice(),msg,hl,k});
  let hand=s.pits[pit],pos=pit;s.pits[pit]=0;
  snap('Bốc '+hand+' quân ở ô '+(pit)+' và rải về bên '+(dir>0?'tiến':'lùi')+'.',pit,'pick');
  let guard=0;
  while(guard++<400){
    while(hand>0){pos=mod(pos+dir);s.pits[pos]++;hand--;snap(null,pos,'sow')}
    const nx=mod(pos+dir);
    if(s.qf[nx]){snap('Quân cuối chạm ô quan còn quan: mất lượt.',nx,'stop');break}
    if(s.pits[nx]>0){hand=s.pits[nx];s.pits[nx]=0;pos=nx;snap('Rải tiếp '+hand+' quân từ ô kế tiếp.',nx,'pick');continue}
    let e=nx;
    while(content(s,e)===0){
      const f=mod(e+dir);
      if(content(s,f)>0&&capturable(s,f)){
        const d=s.pits[f],q=s.qf[f]?1:0;
        s.cd[p]+=d;s.cq[p]+=q;s.pits[f]=0;s.qf[f]=false;
        snap('Ăn '+(q?'QUAN + ':'')+d+' quân dân!',f,q?'quan':'cap');
        e=mod(f+dir);
      }else break;
    }
    break;
  }
  return steps;
}
function sweep(s,taker){ // kết thúc: quân còn lại về chủ sân, ô quan về người ăn cuối
  for(let i=0;i<12;i++){
    if(!s.pits[i]&&!s.qf[i])continue;
    const o=isQ(i)?taker:ownerOf(i);
    s.cd[o]+=s.pits[i];s.cq[o]+=s.qf[i]?1:0;s.pits[i]=0;s.qf[i]=false;
  }
  s.over=true;
}
// Sau mỗi nước: kiểm tra kết thúc / hết quân. Trả về thông điệp.
function checkGameOver(s,mover){
  if(!s.qf[0]&&!s.qf[6]){sweep(s,mover);return 'Cả hai quan đã bị ăn: trận đấu kết thúc.'}
  const nx=1-mover;
  if(mine(nx).every(i=>s.pits[i]===0)){
    if(s.cd[nx]>=5){s.cd[nx]-=5;mine(nx).forEach(i=>s.pits[i]=1);return 'Hết quân: '+CFG.names[nx]+' dùng 5 quân đã ăn để rải lại.'}
    sweep(s,mover);return CFG.names[nx]+' hết quân và không đủ 5 quân để rải: trận đấu kết thúc.';
  }
  return null;
}

// ====== TRÍ TUỆ NHÂN TẠO ======
function chooseAI(s,p,lvl){
  const ms=legalMoves(s,p);if(!ms.length)return null;
  if(lvl==='easy')return ms[Math.floor(Math.random()*ms.length)];
  let best=-1e9,bm=[];
  for(const [i,d] of ms){
    const c=clone(s);play(c,p,i,d);
    let val=score(c,p)-score(s,p);
    const opp=legalMoves(c,1-p);let og=0;
    for(const [j,e] of opp){const c2=clone(c);play(c2,1-p,j,e);og=Math.max(og,score(c2,1-p)-score(c,1-p))}
    val-=0.8*og+Math.random()*0.3;
    if(val>best){best=val;bm=[i,d]}
  }
  return bm;
}

// ====== HIỂN THỊ ======
const board=$('board');
function buildBoard(){
  board.innerHTML='';
  for(let i=0;i<12;i++){
    const c=document.createElement('div');c.className='cell'+(isQ(i)?' q':'');c.dataset.i=i;
    if(i===0){c.style.gridColumn=1;c.style.gridRow='1 / 3'}
    else if(i===6){c.style.gridColumn=7;c.style.gridRow='1 / 3'}
    else if(i<6){c.style.gridColumn=i+1;c.style.gridRow=1}
    else{c.style.gridColumn=6-(i-7)+1-1+0;c.style.gridColumn=13-i;c.style.gridRow=2}
    board.appendChild(c);
  }
}
function seedsHTML(n){let h='';for(let k=0;k<Math.min(n,40);k++)h+='<i class="s s'+((k*7+n)%5)+'"></i>';return h}
function render(v,hl,ok){
  const st=v||G;
  [...board.children].forEach(c=>{
    const i=+c.dataset.i;
    c.innerHTML=(st.qf[i]?'<i class="quan"></i>':'')+seedsHTML(st.pits[i])+(st.pits[i]?'<span class="n">'+st.pits[i]+'</span>':'');
    c.classList.toggle('hl',hl===i);
    c.classList.toggle('ok',!!ok&&ok.includes(i));
    c.classList.toggle('sel',sel===i);
  });
  for(const p of [0,1]){
    $('sc'+p).textContent=score(st,p)+' điểm';
    $('cap'+p).textContent='Dân: '+st.cd[p]+' • Quan: '+st.cq[p];
    $('nm'+p).textContent=CFG.names[p];
  }
}
function setTurnUI(){
  $('pc0').classList.toggle('act',!G.over&&G.turn===0);$('pc1').classList.toggle('act',!G.over&&G.turn===1);
  let t='';
  if(G.over)t='Trận đấu kết thúc';
  else if(CFG.mode==='ai')t=G.turn===0?'Đến lượt bạn':'Đến lượt đối thủ (máy đang nghĩ…)';
  else t='Đến lượt '+CFG.names[G.turn]+(G.turn===0?' (hàng dưới)':' (hàng trên)');
  $('turn').textContent=t;
}
function log(m){if(!m)return;const d=document.createElement('div');d.textContent=m;const L=$('log');L.appendChild(d);while(L.children.length>5)L.removeChild(L.firstChild)}
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove('on'),2200)}
function humanTurn(){return !G.over&&(CFG.mode!=='ai'||G.turn===0)}
function refresh(){
  const ok=(humanTurn()&&!busy)?mine(G.turn).filter(i=>G.pits[i]>0):[];
  render(null,null,ok);setTurnUI();
}

// ====== ÂM THANH (Web Audio) ======
let AC=null;
function beep(f,d,type,v){
  if(!CFG.sound)return;
  try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(),g=AC.createGain();o.type=type||'triangle';o.frequency.value=f;
    g.gain.setValueAtTime(v||.06,AC.currentTime);g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+d);
    o.connect(g);g.connect(AC.destination);o.start();o.stop(AC.currentTime+d)}catch(e){}
}
const sfx={sow:()=>beep(520+Math.random()*180,.07,'square',.025),cap:()=>{beep(300,.12,'sine',.08);setTimeout(()=>beep(440,.15,'sine',.08),90)},
  quan:()=>{[330,440,550,660].forEach((f,k)=>setTimeout(()=>beep(f,.2,'sine',.09),k*90))},
  win:()=>{[523,659,784,1046].forEach((f,k)=>setTimeout(()=>beep(f,.3,'triangle',.09),k*160))}};

// ====== LƯỢT CHƠI ======
async function waitPause(my){while(paused&&my===gen)await sleep(120)}
async function doMove(pit,dir){
  if(busy||G.over)return;
  busy=true;sel=null;$('dir').innerHTML='';
  const my=gen,p=G.turn;
  const steps=play(G,p,pit,dir);
  if(CFG.mode==='practice')log(CFG.names[p]+': ô '+pit+(dir>0?' → chiều tiến':' → chiều lùi'));
  for(const st of steps){
    if(my!==gen)return;await waitPause(my);
    view=st;render(st,st.hl,null);
    if(st.msg&&(st.k!=='pick'||CFG.mode==='practice'||st.k==='cap'))log(st.msg);
    if(st.k==='cap')log(CFG.names[p]+': '+st.msg);
    ({sow:sfx.sow,cap:sfx.cap,quan:sfx.quan,pick:sfx.sow,stop:sfx.sow})[st.k]();
    await sleep(st.k==='cap'||st.k==='quan'?CFG.speed*3:CFG.speed);
  }
  view=null;
  const msg=checkGameOver(G,p);log(msg);
  busy=false;
  if(G.over){render(null,null,null);setTurnUI();return endGame()}
  G.turn=1-p;refresh();
  maybeAI();
}
async function maybeAI(){
  if(CFG.mode!=='ai'||G.turn!==1||G.over)return;
  const my=gen;busy=true;refresh();
  await sleep(650);await waitPause(my);if(my!==gen)return;
  const m=chooseAI(G,1,CFG.lvl);busy=false;
  if(!m){return}
  doMove(m[0],m[1]);
}
function selectPit(i){
  if(busy||paused||G.over||!humanTurn())return;
  if(ownerOf(i)!==G.turn||isQ(i)){return toast('Hãy chọn ô dân thuộc hàng của bạn.')}
  if(G.pits[i]===0)return toast('Ô này đang trống, hãy chọn ô có quân.');
  sel=sel===i?null:i;refresh();
  const D=$('dir');D.innerHTML='';
  if(sel===null)return;
  // hiển thị chiều theo hướng nhìn: hàng dưới dir=+1 là sang trái; hàng trên dir=+1 là sang phải
  const leftDir=ownerOf(i)===0?1:-1;
  const bl=document.createElement('button');bl.textContent='← Rải sang trái';bl.onclick=()=>doMove(i,leftDir);
  const br=document.createElement('button');br.textContent='Rải sang phải →';br.onclick=()=>doMove(i,-leftDir);
  D.append(bl,br);
}
function initializeGame(){
  gen++;G=newState();busy=false;paused=false;sel=null;view=null;
  $('bPause').textContent='Tạm dừng';$('dir').innerHTML='';$('log').innerHTML='';
  $('bHint').style.display=CFG.mode==='practice'?'':'none';
  if(CFG.mode==='ai')CFG.names[1]=CFG.names[1]||'Máy';
  log('Trận mới bắt đầu. Mỗi ô dân 5 quân, mỗi ô quan 1 quan.');
  buildBoard();refresh();
}
function endGame(){
  const a=score(G,0),b=score(G,1);
  let t,mm=a>b?0:b>a?1:-1;
  if(mm<0)t='Hòa nhau!';else t=(CFG.mode==='ai'?(mm===0?'Bạn đã thắng! 🎉':'Máy thắng, thử lại nhé!'):CFG.names[mm]+' chiến thắng! 🎉');
  $('endT').textContent=t;
  $('endP').innerHTML=CFG.names[0]+': <b>'+a+'</b> điểm ('+G.cd[0]+' dân, '+G.cq[0]+' quan)<br>'+CFG.names[1]+': <b>'+b+'</b> điểm ('+G.cd[1]+' dân, '+G.cq[1]+' quan)';
  $('endOv').classList.add('on');
  if(mm>=0&&!(CFG.mode==='ai'&&mm===1)){sfx.win();confetti()}
}
function confetti(){const cs=['#b3261e','#e0b030','#5c8a4a','#2f5f9e','#f8efd8'];
  for(let k=0;k<60;k++){const e=document.createElement('i');e.className='confetti';e.style.left=Math.random()*100+'vw';e.style.background=cs[k%5];e.style.animationDelay=Math.random()*.8+'s';document.body.appendChild(e);setTimeout(()=>e.remove(),3600)}}
function closeOv(id){$(id).classList.remove('on')}

// ====== SỰ KIỆN ======
board.addEventListener('click',e=>{const c=e.target.closest('.cell');if(c)selectPit(+c.dataset.i)});
$('modes').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  [...$('modes').children].forEach(x=>x.classList.remove('on'));b.classList.add('on');CFG.mode=b.dataset.m});
$('go').onclick=()=>{
  CFG.names=[$('n0').value.trim()||'Người chơi 1',$('n1').value.trim()||(CFG.mode==='ai'?'Máy':'Người chơi 2')];
  if(CFG.mode==='ai'&&$('n1').value.trim()==='Đối thủ')CFG.names[1]='Máy';
  CFG.lvl=$('lvl').value;CFG.qv=+$('qv').value;
  try{localStorage.setItem('oaq',JSON.stringify({n:CFG.names,s:CFG.sound}))}catch(e){}
  closeOv('startOv');initializeGame();
};
$('bNew').onclick=()=>$('confOv').classList.add('on');
$('cYes').onclick=()=>{closeOv('confOv');closeOv('endOv');initializeGame()};
$('again').onclick=()=>{closeOv('endOv');initializeGame()};
$('toMenu').onclick=()=>{closeOv('endOv');$('startOv').classList.add('on')};
$('bRules').onclick=()=>$('rulesOv').classList.add('on');
$('bPause').onclick=()=>{if(!G||G.over)return;paused=!paused;$('bPause').textContent=paused?'Tiếp tục':'Tạm dừng';toast(paused?'Trò chơi đang tạm dừng.':'Tiếp tục chơi.')};
$('bSnd').onclick=()=>{CFG.sound=!CFG.sound;$('bSnd').textContent='Âm thanh: '+(CFG.sound?'Bật':'Tắt');try{localStorage.setItem('oaq',JSON.stringify({n:CFG.names,s:CFG.sound}))}catch(e){}};
$('bHint').onclick=()=>{if(busy||G.over)return;const m=chooseAI(G,G.turn,'hard');if(!m)return;
  const left=(ownerOf(m[0])===0?1:-1)===m[1];toast('Gợi ý: chọn ô số '+m[0]+' và rải sang '+(left?'trái':'phải')+'.');render(null,m[0],mine(G.turn).filter(i=>G.pits[i]>0))};
try{const sv=JSON.parse(localStorage.getItem('oaq')||'null');if(sv){$('n0').value=sv.n[0];if(sv.n[1]!=='Máy')$('n1').value=sv.n[1];CFG.sound=sv.s!==false;$('bSnd').textContent='Âm thanh: '+(CFG.sound?'Bật':'Tắt')}}catch(e){}
G=newState();buildBoard();render(null,null,null);setTurnUI();