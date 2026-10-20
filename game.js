'use strict';
const $ = id => document.getElementById(id);
// Fabric textures add a subtle material finish to uniforms and tactical gear.
const camoImages={woodland:new Image(),arid:new Image()};
camoImages.woodland.src='assets/woodland-camo.png';
camoImages.arid.src='assets/arid-camo.png';
const camoPatterns={woodland:null,arid:null};
for(const key of Object.keys(camoImages)){camoImages[key].addEventListener('load',()=>{if(typeof ctx!=='undefined'&&ctx)camoPatterns[key]=ctx.createPattern(camoImages[key],'repeat');});}
function addFabricTexture(x,y,r,kind='woodland',alpha=.24){const pat=camoPatterns[kind];if(!pat)return;ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=pat;ctx.fillRect(x,y,r,r);ctx.restore();}

// Storage can be blocked for file:// pages or private browser settings.
function storageGet(key, fallback=null){ try { const value=localStorage.getItem(key); return value===null?fallback:value; } catch { return fallback; } }
function storageSet(key, value){ try { localStorage.setItem(key, value); } catch { /* game remains playable without saving settings */ } }
const screens = ['menu','settings','shop','online','game'];
const defaultKeys = {forward:'w',back:'s',left:'a',right:'d',reload:'r',shop:'b'};
let keybinds = {...defaultKeys};
try { keybinds = {...defaultKeys, ...JSON.parse(storageGet('lrKeys','{}')||'{}')}; } catch {}
let coins = Math.max(0, Number(storageGet('lrCoins','1000')) || 0), unlocked = new Set(['pistol','shotgun','rifle',...JSON.parse(storageGet('lrUnlocked','[]')||'[]')]), currentWeapon='pistol';
// Give existing and new local profiles a one-time starting balance of 1000 coins.
if(storageGet('lrStarting1000Granted','false')!=='true'){coins=Math.max(1000,coins);storageSet('lrCoins',String(coins));storageSet('lrStarting1000Granted','true');}
let droneOwned = storageGet('lrDroneOwned','false') === 'true';
let selectedVehicle = storageGet('lrVehicle','soldier')==='tank'?'tank':'soldier';
const weapons = {
 pistol:{name:'Пистолет',cost:0,mag:12,reserve:48,damage:22,rate:260,spread:.08,bullet:9},
 shotgun:{name:'Дробовик',cost:0,mag:5,reserve:25,damage:13,rate:650,spread:.55,pellets:7,bullet:8},
 rifle:{name:'Автомат',cost:0,mag:30,reserve:120,damage:15,rate:115,spread:.13,bullet:10},
 sniper:{name:'Снайперская винтовка',cost:500,mag:5,reserve:20,damage:100,rate:900,spread:.015,bullet:13},
 rpg:{name:'RPG',cost:100,mag:1,reserve:4,damage:95,rate:1000,spread:.025,bullet:15,rocket:true}
};
const skinCatalog = {
  pistol:[['Field Ops','COMMON','#b4a58b','#53614d'],['Arctic Unit','UNCOMMON','#c6d4d7','#557785'],['Crimson Grid','RARE','#b94c56','#492d35'],['Neon Circuit','EPIC','#d86cff','#302747'],['Gold Standard','LEGENDARY','#f4cb5c','#6e4b1d'],['Phantom Protocol','SECRET','#5e4eff','#14142b']],
  shotgun:[['Dust Raider','COMMON','#b9a078','#66503b'],['Winter Guard','UNCOMMON','#c5d4dc','#536c7b'],['Redline','RARE','#d15b55','#522b2b'],['Pulse Armour','EPIC','#66e3ce','#1b4c4b'],['Royal Brass','LEGENDARY','#f0c65a','#68461b'],['Night Spectre','SECRET','#a48aff','#201638']],
  rifle:[['Ranger','COMMON','#8eaa82','#3f5940'],['Frostbite','UNCOMMON','#c4d8e2','#577180'],['Hazard Stripe','RARE','#e6b84f','#5e4827'],['Cyber Bloom','EPIC','#e879c8','#49264a'],['Gold Division','LEGENDARY','#f4d16c','#76531f'],['Voidwalker','SECRET','#6e61ff','#17152c']],
  rpg:[['Olive Launcher','COMMON','#89937c','#3b4538'],['Arctic Tube','UNCOMMON','#c7d2d5','#596b73'],['Redline Launcher','RARE','#c45b52','#512b2a'],['Pulse Tube','EPIC','#69d9c7','#214b4a'],['Gold Warhead','LEGENDARY','#eac45b','#71511d'],['Phantom Rocket','SECRET','#8771ff','#211a42']],
  sniper:[['Longwatch','COMMON','#a7b09a','#4c5745'],['Polar Scope','UNCOMMON','#c9dce6','#597585'],['Blood Moon','RARE','#c45162','#522633'],['Ion Storm','EPIC','#70d9ff','#25415d'],['Imperial Gold','LEGENDARY','#f3ce66','#71501c'],['Silent Eclipse','SECRET','#8873ff','#211a42']]
};
const rarityRoll = () => { const r=Math.random(); return r<.55?'COMMON':r<.80?'UNCOMMON':r<.94?'RARE':r<.99?'EPIC':r<.999?'LEGENDARY':'SECRET'; };
let ownedSkins=[]; try { ownedSkins=JSON.parse(storageGet('lrOwnedSkins','[]')||'[]'); if(!Array.isArray(ownedSkins))ownedSkins=[]; } catch { ownedSkins=[]; }
let equippedSkins={}; try { equippedSkins=JSON.parse(storageGet('lrEquippedSkins','{}')||'{}'); if(!equippedSkins||typeof equippedSkins!=='object')equippedSkins={}; } catch { equippedSkins={}; }
let lastSkinDrop=null;
function skinKey(s){return s.weapon+'|'+s.name;}
function getSkin(weapon){const name=equippedSkins[weapon];return ownedSkins.find(s=>s.weapon===weapon&&s.name===name)||null;}
function openCase(){
  if(coins<100){showToast('Недостаточно монет: нужно 100');return;}
  coins-=100;wallet();
  let modal=document.getElementById('caseModal');
  if(!modal){modal=document.createElement('div');modal.id='caseModal';modal.className='case-modal';modal.innerHTML='<div class="case-window"><div class="case-kicker">LAST ROUND // DROP SYSTEM</div><h2>КЕЙС СО СКИНАМИ</h2><div class="case-reel" id="caseReel"><span>◆</span><b>ОТКРЫВАЕМ КЕЙС…</b><span>◆</span></div><p id="caseResult">Подбираем случайный предмет</p><button id="caseEquip" class="primary" disabled>ЭКИПИРОВАТЬ</button> <button id="caseClose">ЗАКРЫТЬ</button></div>' ;document.body.appendChild(modal);document.getElementById('caseClose').addEventListener('click',()=>modal.classList.remove('open'));document.getElementById('caseEquip').addEventListener('click',()=>{if(!lastSkinDrop)return;equippedSkins[lastSkinDrop.weapon]=lastSkinDrop.name;storageSet('lrEquippedSkins',JSON.stringify(equippedSkins));if(unlocked.has(lastSkinDrop.weapon)){currentWeapon=lastSkinDrop.weapon;if(game)updateHud();}modal.classList.remove('open');renderShop();showToast('Скин экипирован: '+lastSkinDrop.name);});}
  const reel=document.getElementById('caseReel'), result=document.getElementById('caseResult'), equip=document.getElementById('caseEquip');
  equip.disabled=true;equip.textContent='ЭКИПИРОВАТЬ';reel.className='case-reel spinning';reel.innerHTML='<span>◆</span><b>ОТКРЫВАЕМ КЕЙС…</b><span>◆</span>';result.textContent='Кейс за 100 монет';modal.classList.add('open');
  setTimeout(()=>{const weapon=['pistol','shotgun','rifle','sniper','rpg'][Math.floor(Math.random()*5)],rarity=rarityRoll(),pool=skinCatalog[weapon],skin=pool.find(x=>x[1]===rarity)||pool[0];lastSkinDrop={weapon,name:skin[0],rarity:skin[1],body:skin[2],gear:skin[3]};const duplicate=ownedSkins.some(s=>skinKey(s)===skinKey(lastSkinDrop));if(!duplicate){ownedSkins.push(lastSkinDrop);storageSet('lrOwnedSkins',JSON.stringify(ownedSkins));}reel.className='case-reel revealed rarity-'+rarity.toLowerCase();reel.innerHTML='<span>◆</span><b>'+skin[0]+'</b><span>◆</span>';result.innerHTML='<strong>'+rarity+'</strong> · '+weapons[weapon].name+(duplicate?' · Дубликат':' · Новый скин');equip.disabled=false;equip.textContent=duplicate?'ЭКИПИРОВАТЬ СНОВА':'ЭКИПИРОВАТЬ';renderShop();},1700);
}

let ammo={}, reserve={}; for(const [k,w] of Object.entries(weapons)){ammo[k]=w.mag;reserve[k]=w.reserve}
let game = null, raf = 0, binding = null, lastFrame = 0, fpsFrames=0, fpsStamp=0, fps=0, toastTimer;
let socket=null, roomCode=null, networkMode=false, remotePlayers={}, lastNetSend=0, playerId='p-'+Math.random().toString(36).slice(2,9);
const gameHost=(location.hostname && location.hostname!=='0.0.0.0')?location.hostname:'localhost';
const SERVER_URLS={soldier:`ws://${gameHost}:8765`,tank:`ws://${gameHost}:8766`};
 let SERVER_URL=SERVER_URLS[selectedVehicle]||SERVER_URLS.soldier;
function showScreen(id){screens.forEach(s=>$(s).classList.toggle('hidden',s!==id));if(id==='shop')renderShop();if(id==='settings')refreshSettings();if(id==='game'&&game)resizeCanvas();}
document.querySelectorAll('[data-panel]').forEach(b=>b.addEventListener('click',()=>showScreen(b.dataset.panel)));
document.querySelectorAll('.back').forEach(b=>b.addEventListener('click',()=>showScreen('menu')));
// Vehicle selection is persisted between visits.
const vehiclePicker=document.createElement('div');vehiclePicker.className='vehicle-picker';vehiclePicker.innerHTML='<span>КТО ТЫ?</span><button type="button" data-vehicle="soldier">♟ СОЛДАТ</button><button type="button" data-vehicle="tank">▰ ТАНК</button>';document.querySelector('.menu-buttons').before(vehiclePicker);
function refreshVehiclePicker(){vehiclePicker.querySelectorAll('[data-vehicle]').forEach(b=>{b.classList.toggle('primary',b.dataset.vehicle===selectedVehicle);b.setAttribute('aria-pressed',String(b.dataset.vehicle===selectedVehicle));});}
vehiclePicker.addEventListener('click',e=>{const b=e.target.closest('[data-vehicle]');if(!b)return;selectedVehicle=b.dataset.vehicle;storageSet('lrVehicle',selectedVehicle);refreshVehiclePicker();});refreshVehiclePicker();
$('playBtn').addEventListener('click',startGame);$('leaveBtn').addEventListener('click',()=>{stopGame();showScreen('menu')});$('againBtn').addEventListener('click',startGame);$('gameMenuBtn').addEventListener('click',()=>{stopGame();showScreen('menu')});
function wallet(){ coins=Math.max(0,Math.floor(Number(coins)||0)); storageSet('lrCoins',String(coins)); $('wallet').textContent=`◈ ${coins}`; $('shopWallet').textContent=`◈ ${coins}`; $('gameWallet').textContent=`◈ ${coins}`; }
function refreshSettings(){ $('fpsToggle').checked=storageGet('lrFps')!=='false';$('fpsColor').value=storageGet('lrFpsColor','#ff4f9a')||'#ff4f9a';$('musicVol').value=storageGet('lrMusic','35')||35;$('sfxVol').value=storageGet('lrSfx','70')||70;$('sens').value=storageGet('lrSens','10')||10;updateOutputs();Object.keys(keybinds).forEach(k=>{if($('key-'+k))$('key-'+k).textContent=keybinds[k].toUpperCase()});}
function updateOutputs(){ $('musicOut').value=$('musicVol').value+'%';$('sfxOut').value=$('sfxVol').value+'%';$('sensOut').value=(+$('sens').value/10).toFixed(1)+'×'; }
['fpsToggle','fpsColor','musicVol','sfxVol','sens'].forEach(id=>$(id).addEventListener('input',()=>{storageSet(({fpsToggle:'lrFps',fpsColor:'lrFpsColor',musicVol:'lrMusic',sfxVol:'lrSfx',sens:'lrSens'})[id],id==='fpsToggle'?$(id).checked:$(id).value);updateOutputs();}));
document.querySelectorAll('[data-bind]').forEach(b=>b.addEventListener('click',()=>{binding=b.dataset.bind;b.textContent='НАЖМИ КЛАВИШУ…';}));
function useHatch(){
 const g=game;if(!g||!g.hatch||g.over)return;
 if(g.player.vehicle==='tank'&&g.zone==='MAIN'){showToast('Танк слишком большой — в подвал не проехать');return;}
 const now=performance.now();if(now<(g.hatchCooldownUntil||0))return;
 if(g.zone==='MAIN'){
   g.mainBots=g.bots;g.mainBullets=g.bullets;g.mainCoins=g.coins;
   g.zone='BASEMENT';g.hatchCooldownUntil=now+1800;
   g.walls=g.basementWalls.map(w=>({...w}));g.obstacles=g.basementObstacles.map(o=>({...o}));
   g.doors=[{x:450,y:300,w:22,h:50,open:false},{x:850,y:330,w:22,h:50,open:false}];
   g.hatch={x:1080,y:620,r:30,open:true};
   g.player.x=105;g.player.y=360;g.player.hp=g.player.maxHp;g.player.dead=false;g.player.respawnAt=0;g.player.invulnerableUntil=now+6000;
   const own=g.player.team,enemy=own==='T'?'CT':'T';
   g.bots=[];g.bullets=[];g.coins=[];
   for(let n=0;n<2;n++){const b=makeBot(own,n);b.x=n===0?110:420;b.y=n===0?620:100;b.shot=now+5000;b.thinkAt=now+1500;g.bots.push(b);}
   for(let n=0;n<2;n++){const b=makeBot(enemy,n);b.x=n===0?1080:1100;b.y=n===0?100:620;b.shot=now+5000;b.thinkAt=now+1500;g.bots.push(b);}
   for(let n=0;n<3;n++)g.coins.push({x:[420,620,1040][n],y:[320,600,300][n],r:8,value:5,alive:true});
   showToast('Ты вошёл в подвал. Найди люк в правом нижнем углу и нажми E, чтобы вернуться.');
 }else{
   g.zone='MAIN';g.hatchCooldownUntil=now+2200;
   g.bots=g.mainBots||[];g.bullets=g.mainBullets||[];g.coins=g.mainCoins||[];
   g.walls=g.mainWalls.map(w=>({...w}));g.obstacles=g.mainObstacles.map(o=>({...o}));
   g.doors=[{x:780,y:210,w:22,h:90,open:false},{x:930,y:510,w:22,h:90,open:false}];
   g.hatch={x:1050,y:570,r:30,open:true};
   // Place the player away from the hatch so proximity auto-use cannot immediately send them back.
   g.player.x=900;g.player.y=500;g.player.hp=g.player.maxHp;g.player.dead=false;g.player.respawnAt=0;g.player.invulnerableUntil=now+3000;
   showToast('Ты вернулся на первый этаж.');
 }
 updateHud();
}
function selectWeaponSlot(slot){
 if(!game||game.over)return;
 const map={1:'pistol',2:'shotgun',3:'rifle',4:'sniper',5:'rpg'};
 if(slot===6){toggleDrone();return;}
 const id=map[slot];if(!id)return;
 if(!unlocked.has(id)){showToast(id==='sniper'?'Сначала купи снайперку в магазине':'Сначала купи RPG в магазине');return;}
 if(game.droneActive){game.droneActive=false;game.drone=null;}
 droneSelected=false;currentWeapon=id;storageSet('lrLastWeapon',id);updateHud();
}
function cycleWeapon(direction){
 const slots=[1,2,3,4,5,...(droneOwned?[6]:[])];
 let current=droneSelected?6:(Object.entries({1:'pistol',2:'shotgun',3:'rifle',4:'sniper',5:'rpg'}).find(([,id])=>id===currentWeapon)||['1'])[0];
 let index=slots.indexOf(Number(current));if(index<0)index=0;
 for(let tries=0;tries<slots.length;tries++){index=(index+direction+slots.length)%slots.length;const n=slots[index];if(n===6&&droneOwned){toggleDrone();return;}const id=({1:'pistol',2:'shotgun',3:'rifle',4:'sniper',5:'rpg'})[n];if(id&&unlocked.has(id)){selectWeaponSlot(n);return;}}
}
window.addEventListener('keydown',e=>{
 if(binding){if(['Shift','Control','Alt','Meta'].includes(e.key))return;keybinds[binding]=e.key.toLowerCase();storageSet('lrKeys',JSON.stringify(keybinds));binding=null;refreshSettings();return;}
 if(!game||game.over)return;
 if(['1','2','3','4','5','6'].includes(e.key)&&!e.repeat){e.preventDefault();selectWeaponSlot(Number(e.key));return;}
 const key=e.key.toLowerCase();
 if(key===keybinds.reload)reload();
 if(key===keybinds.shop)showToast('Открой магазин через меню после матча или купи предмет в магазине.');
 if(key==='e'&&game.hatch){
   const g=game, distance=Math.hypot(g.player.x-g.hatch.x,g.player.y-g.hatch.y);
   if(distance<150){e.preventDefault();useHatch();return;}
   showToast('Подойди вплотную к люку и нажми E.');
 }
 if(e.key==='Escape'){if(game&&game.droneActive){game.droneActive=false;game.drone=null;droneSelected=false;showToast('Возврат к солдату');updateHud();}else{stopGame();showScreen('menu');}}
});
function renderShop(){wallet();const items=[['sniper','Снайперская винтовка','500 монет','Мощное оружие. После покупки доступно в текущей сессии.'],['rpg','RPG','100 монет','Ракета наносит урон и открывает двери рядом с попаданием.'],['drone','FPV-дрон','1000 монет','Покупается один раз. Нажми 6 или кнопку ДРОН во время матча, чтобы запустить.'],['case','Кейс со скином','100 монет','Анимированное открытие. Скин сохраняется в инвентаре.']];$('shopItems').innerHTML='';for(const [id,name,price,desc] of items){const el=document.createElement('article');el.className='shop-item';el.innerHTML=`<h3>${name}</h3><div class="price">${price}</div><p>${desc}</p><button data-buy="${id}">${id==='case'?'ОТКРЫТЬ КЕЙС':id==='drone'?(droneOwned?'УЖЕ КУПЛЕН':'КУПИТЬ'):unlocked.has(id)?'УЖЕ РАЗБЛОКИРОВАНО':'КУПИТЬ'}</button>`;$('shopItems').append(el)}$('shopItems').querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>buy(b.dataset.buy)));
 let inv=document.getElementById('skinInventory');if(!inv){inv=document.createElement('section');inv.id='skinInventory';inv.className='skin-inventory';$('shop').appendChild(inv);}inv.innerHTML='<h3>ИНВЕНТАРЬ СКИНОВ <span>'+ownedSkins.length+'</span></h3>'+(ownedSkins.length?'<div class="skin-grid">'+ownedSkins.map((s,i)=>`<article class="skin-card rarity-${s.rarity.toLowerCase()}"><div class="skin-preview" style="--skin-body:${s.body};--skin-gear:${s.gear}"><i></i></div><b>${s.name}</b><small>${weapons[s.weapon].name} · ${s.rarity}</small><button data-equip-skin="${i}">${equippedSkins[s.weapon]===s.name?'ЭКИПИРОВАН':'ЭКИПИРОВАТЬ'}</button></article>`).join('')+'</div>':'<p>Пока нет скинов. Открой кейс, чтобы получить первый.</p>');inv.querySelectorAll('[data-equip-skin]').forEach(b=>b.addEventListener('click',()=>{const sk=ownedSkins[Number(b.dataset.equipSkin)];if(!sk)return;equippedSkins[sk.weapon]=sk.name;storageSet('lrEquippedSkins',JSON.stringify(equippedSkins));if(unlocked.has(sk.weapon)){currentWeapon=sk.weapon;if(game)updateHud();}renderShop();showToast('Экипирован скин: '+sk.name);}));}
function buy(id){if(id==='case'){openCase();return}if(id==='drone'){if(droneOwned){showToast('FPV-дрон уже куплен');return}if(coins<1000){showToast('Для FPV-дрона нужно 1000 монет');return}coins-=1000;droneOwned=true;storageSet('lrDroneOwned','true');wallet();renderShop();showToast('FPV-дрон куплен! Запуск: клавиша 6 или кнопка ДРОН');return}if(unlocked.has(id)){showToast('Это оружие уже доступно');return}if(!weapons[id]||coins<weapons[id].cost){showToast('Недостаточно монет');return}coins-=weapons[id].cost;unlocked.add(id);wallet();renderShop();showToast(`${weapons[id].name}: разблокировано`)}
function connectOnline(action, code=''){
  const onlineMode=$('onlineMode')?.value||selectedVehicle; selectedVehicle=onlineMode; storageSet('lrVehicle',selectedVehicle); SERVER_URL=SERVER_URLS[onlineMode]||SERVER_URLS.soldier;
  if(socket && socket.readyState===WebSocket.OPEN){socket.close();}
  $('onlineStatus').textContent='Подключение к серверу '+SERVER_URL+'…';
  try{socket=new WebSocket(SERVER_URL);}catch(e){$('onlineStatus').textContent='Не удалось создать соединение. Проверь запуск server.py.';return;}
  socket.onopen=()=>socket.send(JSON.stringify(action==='create'?{action:'create',playerId,mode:onlineMode}:{action:'join',code,playerId,mode:onlineMode}));
  socket.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return;}
    if(m.type==='room_created'||m.type==='joined'){roomCode=m.code;$('roomCode').textContent=roomCode;$('onlineStatus').textContent='Подключено к комнате '+roomCode+' · игроков: '+(m.players||1)+' · запускаем матч';networkMode=true;startGame(true);if(m.team&&game){game.player.team=m.team;const spawn=spawnPoint(m.team);game.player.x=spawn.x;game.player.y=spawn.y;const own=m.team,enemy=own==='T'?'CT':'T';game.bots=[];for(let i=0;i<4;i++)game.bots.push(makeBot(own,i));for(let i=0;i<5;i++)game.bots.push(makeBot(enemy,i));$('teamBadge').textContent='ONLINE · TEAM '+m.team;$('teamBadge').className=m.team==='T'?'team-t':'team-ct';}}
    else if(m.type==='state'&&m.player&&m.player.id!==playerId){remotePlayers[m.player.id]={...m.player,lastSeen:performance.now()};}
    else if(m.type==='player_joined'||m.type==='player_left'){$('onlineStatus').textContent='Комната '+(roomCode||'')+' · игроков: '+m.players;}
    else if(m.type==='error')$('onlineStatus').textContent=m.message||'Ошибка сервера';
  };
  socket.onerror=()=>{$('onlineStatus').textContent='Сервер недоступен. Запусти server.py на компьютере-хосте.';};
  socket.onclose=()=>{if(networkMode)showToast('Соединение с сервером потеряно');networkMode=false;};
}
$('createRoom').addEventListener('click',()=>connectOnline('create'));
$('joinRoom').addEventListener('click',()=>{const code=$('joinCode').value.trim().toUpperCase();if(code.length!==6){$('onlineStatus').textContent='Введи код из 6 символов.';return;}connectOnline('join',code)});
function showToast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
const canvas=$('gameCanvas'),ctx=canvas.getContext('2d');let mouse={x:600,y:360,down:false};
const touchControl={move:{x:0,y:0},aim:{x:0,y:0,active:false},aimAngle:null,fire:false};
canvas.addEventListener('mousemove',e=>{const r=canvas.getBoundingClientRect();mouse.x=(e.clientX-r.left)*canvas.width/r.width;mouse.y=(e.clientY-r.top)*canvas.height/r.height});canvas.addEventListener('mousedown',e=>{if(e.button===0){if(game&&game.droneActive)detonateDrone();else mouse.down=true}});window.addEventListener('mouseup',()=>mouse.down=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
function bindVirtualStick(stickId,thumbId,kind){
 const base=$(stickId),thumb=$(thumbId);if(!base||!thumb)return;
 let activePointer=null;
 const reset=()=>{activePointer=null;thumb.style.transform='translate(-50%,-50%)';if(kind==='move')touchControl.move={x:0,y:0};else{touchControl.aim={x:0,y:0,active:false};}};
 const update=e=>{const r=base.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=Math.max(18,r.width*.34);let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy)||1;if(len>max){dx=dx/len*max;dy=dy/len*max;}const nx=dx/max,ny=dy/max;thumb.style.transform=`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`;if(kind==='move')touchControl.move={x:nx,y:ny};else {const active=Math.hypot(nx,ny)>.18;touchControl.aim={x:nx,y:ny,active};if(active)touchControl.aimAngle=Math.atan2(ny,nx); }};
 base.addEventListener('pointerdown',e=>{e.preventDefault();activePointer=e.pointerId;base.setPointerCapture(e.pointerId);update(e)});
 base.addEventListener('pointermove',e=>{if(e.pointerId===activePointer){e.preventDefault();update(e)}});
 base.addEventListener('pointerup',e=>{if(e.pointerId===activePointer)reset()});base.addEventListener('pointercancel',reset);base.addEventListener('lostpointercapture',reset);
}
bindVirtualStick('moveStick','moveThumb','move');bindVirtualStick('aimStick','aimThumb','aim');
const fireButton=$('mobileFire');if(fireButton){const stopFire=()=>{touchControl.fire=false;mouse.down=false;fireButton.classList.remove('is-pressed')};fireButton.addEventListener('pointerdown',e=>{e.preventDefault();if(game&&game.droneActive){detonateDrone();return;}touchControl.fire=true;mouse.down=true;fireButton.classList.add('is-pressed');fireButton.setPointerCapture(e.pointerId)});fireButton.addEventListener('pointerup',stopFire);fireButton.addEventListener('pointercancel',stopFire);fireButton.addEventListener('lostpointercapture',stopFire);}
const cannonButton=$('mobileCannon');if(cannonButton)cannonButton.addEventListener('pointerdown',e=>{e.preventDefault();if(!game||game.over)return;if(game.player.vehicle!=='tank'){showToast('Тяжёлая пушка доступна только танку');return}tankFire(performance.now(),game.player);});
let droneSelected=false;
function toggleDrone(){
 if(!game||game.over)return;
 if(!droneOwned){showToast('Сначала купи FPV-дрон в магазине за 1000 монет');return;}
 const g=game;
 if(g.droneActive){g.droneActive=false;g.drone=null;droneSelected=false;showToast('Возврат к солдату');updateHud();return;}
 if(g.player.dead){showToast('Нельзя запустить дрон, пока солдат выведен из строя');return;}
 const now=performance.now();
 if(now<(g.droneReadyAt||0)){showToast('Дрон перезаряжается: '+Math.ceil((g.droneReadyAt-now)/1000)+' сек.');updateHud();return;}
 droneSelected=true;g.drone={x:g.player.x,y:g.player.y,angle:g.player.angle||0,speed:260};g.droneActive=true;
 showToast('FPV-ДРОН: WASD / левый джойстик — полёт; ОГОНЬ — подрыв; 6 или ESC — назад');updateHud();
}
function detonateDrone(){
 if(!game||!game.droneActive||!game.drone)return;
 const g=game,ts=performance.now(),d=g.drone,blast=125;let hits=0;
 const targets=[...g.bots.filter(b=>!b.dead),...Object.values(remotePlayers).filter(r=>ts-r.lastSeen<4000)];
 for(const target of targets){if(target.dead||target.team===g.player.team)continue;if(Math.hypot(target.x-d.x,target.y-d.y)<=blast){target.hp=0;target.dead=true;target.respawnAt=ts+1800;hits++;if(target.ai&&target.team!==g.player.team){g.player.kills++;coins+=10;}}}
 g.droneActive=false;g.drone=null;g.droneReadyAt=ts+10000;droneSelected=true;
 if(hits){wallet();showToast('FPV-ДРОН: '+hits+' противник(ов) уничтожено одним попаданием!');}else showToast('FPV-ДРОН подорван — цель вне радиуса');
 checkMatchEnd();updateHud();
}
const mobileDroneButton=$('mobileDrone');if(mobileDroneButton)mobileDroneButton.addEventListener('click',toggleDrone);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&game&&game.droneActive){e.preventDefault();game.droneActive=false;game.drone=null;droneSelected=false;showToast('Возврат к солдату');updateHud()}});
const weaponSwitcher=$('weaponSwitcher');if(weaponSwitcher)weaponSwitcher.addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(b)selectWeaponSlot(Number(b.dataset.slot));});
canvas.addEventListener('wheel',e=>{if(!game)return;e.preventDefault();cycleWeapon(e.deltaY>0?1:-1)},{passive:false});
function resizeCanvas(){/* fixed internal resolution; CSS scales responsively */}
function startGame(fromNetwork=false){if(window.matchMedia&&window.matchMedia('(pointer: coarse)').matches&&screen.orientation&&screen.orientation.lock){screen.orientation.lock('landscape').catch(()=>{});}stopGame();droneSelected=false;networkMode=!!fromNetwork&&!!socket&&socket.readyState===WebSocket.OPEN;remotePlayers={};ammo={pistol:12,shotgun:5,rifle:30,sniper:5,rpg:1};reserve={pistol:48,shotgun:25,rifle:120,sniper:20,rpg:4};currentWeapon=storageGet('lrLastWeapon','pistol')||'pistol';if(!weapons[currentWeapon]||!unlocked.has(currentWeapon))currentWeapon='pistol';const W=1200,H=720;game={w:W,h:H,player:{id:playerId,x:180,y:360,r:selectedVehicle==='tank'?25:14,hp:selectedVehicle==='tank'?260:100,maxHp:selectedVehicle==='tank'?260:100,team:'T',speed:selectedVehicle==='tank'?105:220,angle:0,kills:0,dead:false,respawnAt:0,ai:false,vehicle:selectedVehicle,cannonReadyAt:0},bots:[],bullets:[],coins:[],obstacles:[],walls:[],doors:[{x:780,y:210,w:22,h:90,open:false},{x:930,y:510,w:22,h:90,open:false}],zone:'MAIN',zoneStack:[],basementOpen:false,roomIndex:0,elapsed:0,remaining:1800,over:false,lastShot:0,scoreT:0,scoreCT:0,started:performance.now(),lastCoin:0,roundTarget:10,miniRound:1,miniRoundsTotal:10,miniRoundEnded:false,roundTransitionUntil:0,respawns:0,drone:null,droneActive:false,droneReadyAt:0};
  // Ten mini-round match: no one respawns until one entire team is eliminated.
  const ownTeam=game.player.team, enemyTeam=ownTeam==='T'?'CT':'T';
  for(let i=0;i<4;i++)game.bots.push(makeBot(ownTeam,i));
  for(let i=0;i<5;i++)game.bots.push(makeBot(enemyTeam,i));
  for(let i=0;i<7;i++)game.coins.push({x:100+Math.random()*1000,y:60+Math.random()*600,r:8,value:5,alive:true});
  // Connected multi-room layout. Wall segments have HP and can be breached by RPG.
  game.walls=[
    {x:360,y:30,w:18,h:185,hp:160,maxHp:160,kind:'wall'}, {x:360,y:285,w:18,h:165,hp:160,maxHp:160,kind:'wall'},
    {x:360,y:535,w:18,h:155,hp:160,maxHp:160,kind:'wall'},
    {x:620,y:30,w:18,h:125,hp:160,maxHp:160,kind:'wall'}, {x:620,y:225,w:18,h:200,hp:160,maxHp:160,kind:'wall'},
    {x:620,y:495,w:18,h:195,hp:160,maxHp:160,kind:'wall'},
    {x:820,y:30,w:18,h:170,hp:160,maxHp:160,kind:'wall'}, {x:820,y:290,w:18,h:150,hp:160,maxHp:160,kind:'wall'},
    {x:820,y:530,w:18,h:160,hp:160,maxHp:160,kind:'wall'},
    {x:378,y:330,w:105,h:16,hp:130,maxHp:130,kind:'wall'}, {x:520,y:330,w:100,h:16,hp:130,maxHp:130,kind:'wall'},
    {x:638,y:470,w:90,h:16,hp:130,maxHp:130,kind:'wall'}, {x:760,y:470,w:60,h:16,hp:130,maxHp:130,kind:'wall'},
    {x:970,y:180,w:150,h:18,hp:130,maxHp:130,kind:'wall'}, {x:970,y:198,w:18,h:115,hp:130,maxHp:130,kind:'wall'}
  ];
  for(let i=0;i<8;i++){let x=90+Math.random()*1000,y=55+Math.random()*600;if(Math.abs(x-180)>80&&Math.abs(x-360)>50)game.obstacles.push({x,y,w:25+Math.random()*42,h:20+Math.random()*34,kind:'crate'})}
  // Keep the hatch approach clear so random crates cannot make it unreachable.
  game.obstacles=game.obstacles.filter(o=>Math.hypot((o.x+o.w/2)-1050,(o.y+o.h/2)-570)>115);
  game.hatch={x:1050,y:570,r:30,open:false};game.mainWalls=game.walls.map(w=>({...w}));game.mainObstacles=game.obstacles.map(o=>({...o}));game.basementWalls=[{x:250,y:30,w:18,h:180,hp:220,maxHp:220,kind:'wall'},{x:250,y:270,w:18,h:420,hp:220,maxHp:220,kind:'wall'},{x:500,y:30,w:18,h:260,hp:220,maxHp:220,kind:'wall'},{x:500,y:350,w:18,h:340,hp:220,maxHp:220,kind:'wall'},{x:750,y:30,w:18,h:160,hp:220,maxHp:220,kind:'wall'},{x:750,y:250,w:18,h:210,hp:220,maxHp:220,kind:'wall'},{x:750,y:520,w:18,h:170,hp:220,maxHp:220,kind:'wall'},{x:900,y:390,w:55,h:18,hp:220,maxHp:220,kind:'wall'},{x:990,y:390,w:90,h:18,hp:220,maxHp:220,kind:'wall'},{x:300,y:460,w:180,h:18,hp:180,maxHp:180,kind:'wall'}];game.basementObstacles=[{x:330,y:120,w:70,h:42,kind:'crate'},{x:600,y:500,w:82,h:35,kind:'crate'},{x:970,y:120,w:55,h:70,kind:'crate'}];
  $('teamBadge').textContent=networkMode?'ONLINE · TEAM T':'TEAM T';$('teamBadge').className='team-t';$('gameOver').classList.add('hidden');showScreen('game');lastFrame=performance.now();fpsFrames=0;fpsStamp=lastFrame;raf=requestAnimationFrame(loop);updateHud();
}
function makeBot(team,index){const spawn=spawnPoint(team),elite=!!game&&team!==(game.player.team);const vehicle=game&&game.zone!=='BASEMENT'&&index===0&&Math.random()<.24?'tank':'soldier';return {vehicle,r:vehicle==='tank'?25:14,maxHp:vehicle==='tank'?260:100,hp:vehicle==='tank'?260:100,speed:vehicle==='tank'?75:(elite?132:100+Math.random()*12),cannonReadyAt:0,id:'bot-'+team+'-'+index+'-'+Math.random().toString(36).slice(2,5),x:spawn.x,y:spawn.y,r:14,hp:100,maxHp:100,team,speed:elite?132:100+Math.random()*12,angle:0,kills:0,dead:false,respawnAt:0,shot:performance.now()+Math.random()*700,strafe:Math.random()<.5?-1:1,decisionAt:0,coverAt:0,ai:true,elite,aimJitter:elite?.045:.16,preferredRange:elite?235:260,thinkAt:0,targetId:null,flankSide:Math.random()<.5?-1:1,burst:0};}
function spawnPoint(team){if(game&&game.zone==='BASEMENT'){const spots=team==='T'?[{x:110,y:100},{x:120,y:620},{x:420,y:100},{x:420,y:620}]:[{x:1080,y:100},{x:1100,y:620},{x:850,y:210},{x:850,y:600}];return {...spots[Math.floor(Math.random()*spots.length)]};}return team==='T'?{x:100+Math.random()*150,y:100+Math.random()*520}:{x:900+Math.random()*180,y:100+Math.random()*520};}
function stopGame(){if(raf)cancelAnimationFrame(raf);raf=0;game=null;}
function loop(ts){if(!game||game.over)return;const dt=Math.min((ts-lastFrame)/1000,.04);lastFrame=ts;fpsFrames++;if(ts-fpsStamp>=500){fps=Math.round(fpsFrames*1000/(ts-fpsStamp));fpsFrames=0;fpsStamp=ts}$('fpsCounter').textContent=$('fpsToggle').checked?'FPS: '+fps:'';$('fpsCounter').style.color=$('fpsColor').value;update(dt,ts);draw();raf=requestAnimationFrame(loop)}
function update(dt,ts){const g=game,p=g.player;g.elapsed+=dt;g.remaining=Math.max(0,1800-g.elapsed);if(g.roundTransitionUntil){if(ts<g.roundTransitionUntil){updateHud();return;}resetMiniRound(ts);}if(!p.dead&&g.hatch&&ts>=(g.hatchCooldownUntil||0)&&Math.hypot(p.x-g.hatch.x,p.y-g.hatch.y)<=40){useHatch();return;}
  // Player controls and respawn.
  if(p.dead&&!g.miniRoundsTotal&&ts>=p.respawnAt){const sp=spawnPoint(p.team);p.x=sp.x;p.y=sp.y;p.hp=p.maxHp;p.dead=false;showToast('Ты возродился! Магазин пуст — нажми R для перезарядки.');updateHud();}
  if(g.droneActive&&g.drone){
    let dx=0,dy=0;if(keysDown.has(keybinds.forward))dy--;if(keysDown.has(keybinds.back))dy++;if(keysDown.has(keybinds.left))dx--;if(keysDown.has(keybinds.right))dx++;dx+=touchControl.move.x;dy+=touchControl.move.y;
    const len=Math.hypot(dx,dy);if(len>1){dx/=len;dy/=len;}g.drone.x=Math.max(30,Math.min(g.w-30,g.drone.x+dx*g.drone.speed*dt));g.drone.y=Math.max(30,Math.min(g.h-30,g.drone.y+dy*g.drone.speed*dt));
    if(touchControl.aim.active)g.drone.angle=touchControl.aimAngle;else if(dx||dy)g.drone.angle=Math.atan2(dy,dx);
  } else if(!p.dead){let dx=0,dy=0;if(keysDown.has(keybinds.forward))dy--;if(keysDown.has(keybinds.back))dy++;if(keysDown.has(keybinds.left))dx--;if(keysDown.has(keybinds.right))dx++;dx+=touchControl.move.x;dy+=touchControl.move.y;if(dx||dy){const l=Math.hypot(dx,dy);dx/=Math.max(1,l);dy/=Math.max(1,l);moveActor(p,dx*p.speed*dt,dy*p.speed*dt)}p.angle=touchControl.aim.active?touchControl.aimAngle:(touchControl.aimAngle!==null?touchControl.aimAngle:Math.atan2(mouse.y-p.y,mouse.x-p.x));if(mouse.down||touchControl.fire){if(p.vehicle==='tank')tankMachineGun(ts,p);else shoot(ts,p);}}
  // Enemy bots use tactical target selection, predictive aim, cover checks, flanking and short bursts.
  const actors=[p,...g.bots.filter(b=>!b.dead),...Object.values(remotePlayers).filter(r=>ts-r.lastSeen<4000)];
  for(const b of g.bots){if(b.dead){if(!g.miniRoundsTotal&&ts>=b.respawnAt){const sp=spawnPoint(b.team);b.x=sp.x;b.y=sp.y;b.hp=b.maxHp||100;b.dead=false;b.decisionAt=0;b.shot=ts+350+Math.random()*350;}continue;}
    const targets=actors.filter(a=>a.id!==b.id&&!a.dead&&a.team!==b.team&&!(a===p&&ts<(p.invulnerableUntil||0)));if(!targets.length)continue;
    if(ts>(b.thinkAt||0)){b.thinkAt=ts+(b.elite?120:420);let best=null,bestScore=Infinity;for(const a of targets){const d=Math.hypot(a.x-b.x,a.y-b.y);const score=d*(a===p?.78:1)+(a.hp<35?-45:0)+(a.id===b.targetId?-35:0);if(score<bestScore){bestScore=score;best=a;}}if(best)b.targetId=best.id;}
    let target=targets.find(a=>a.id===b.targetId)||targets[0];
    const vx=target.x-b.x,vy=target.y-b.y,dist=Math.hypot(vx,vy)||1,a=Math.atan2(vy,vx);b.angle=a;
    if(ts>b.decisionAt){b.decisionAt=ts+(b.elite?260+Math.random()*300:650+Math.random()*650);if(Math.random()<(b.elite?.72:.35))b.strafe*=-1;if(b.elite&&Math.random()<.32)b.flankSide*=-1;}
    let mx=0,my=0;const desired=b.preferredRange;
    if(dist>desired+45){mx=Math.cos(a);my=Math.sin(a);}else if(dist<desired-65){mx=-Math.cos(a)*.8;my=-Math.sin(a)*.8;}
    if(dist<(b.elite?600:440)){const side=b.elite?b.flankSide:b.strafe;mx+=Math.cos(a+Math.PI/2)*side*(b.elite?.82:.5);my+=Math.sin(a+Math.PI/2)*side*(b.elite?.82:.5);}
    // If direct movement is blocked, attempt two angled paths rather than walking into cover.
    const speed=b.speed*(b.elite?1:1);const oldX=b.x,oldY=b.y;const ml=Math.hypot(mx,my)||1;moveActor(b,mx/ml*speed*dt,my/ml*speed*dt);
    if(Math.hypot(b.x-oldX,b.y-oldY)<speed*dt*.18){const side=b.elite?b.flankSide:b.strafe;moveActor(b,Math.cos(a+side*Math.PI/2)*speed*dt,Math.sin(a+side*Math.PI/2)*speed*dt);}
    const lineClear=(()=>{const steps=Math.ceil(dist/18);for(let i=1;i<steps;i++){const x=b.x+Math.cos(a)*i*18,y=b.y+Math.sin(a)*i*18;if(g.obstacles.some(o=>x>o.x&&x<o.x+o.w&&y>o.y&&y<o.y+o.h)||(g.walls||[]).some(w=>w.hp>0&&x>w.x&&x<w.x+w.w&&y>w.y&&y<w.y+w.h)||g.doors.some(d=>!d.open&&x>d.x&&x<d.x+d.w&&y>d.y&&y<d.y+d.h))return false;}return true;})();
    const fireDelay=b.elite?260+Math.random()*100:720+Math.random()*430;
    if(dist<(b.elite?700:500)&&lineClear&&ts-b.shot>fireDelay){b.shot=ts;const lead=b.elite?.18:.04;const predictX=target.x+(target.vx||0)*lead,predictY=target.y+(target.vy||0)*lead;const aim=Math.atan2(predictY-b.y,predictX-b.x)+(Math.random()-.5)*(b.aimJitter||.15);const speedBullet=b.elite?560:430;g.bullets.push({x:b.x+Math.cos(aim)*18,y:b.y+Math.sin(aim)*18,vx:Math.cos(aim)*speedBullet,vy:Math.sin(aim)*speedBullet,life:1.5,team:b.team,owner:b.id,damage:b.elite?13:9,rocket:false});if(b.elite&&Math.random()<.4){const a2=aim+(Math.random()-.5)*.08;g.bullets.push({x:b.x+Math.cos(a2)*18,y:b.y+Math.sin(a2)*18,vx:Math.cos(a2)*speedBullet,vy:Math.sin(a2)*speedBullet,life:1.5,team:b.team,owner:b.id,damage:10,rocket:false});}}
  }
  // Multiplayer: publish local position; server relays it to the room. Local bots fill empty slots.
  if(networkMode&&socket&&socket.readyState===WebSocket.OPEN&&ts-lastNetSend>50&&!p.dead){lastNetSend=ts;socket.send(JSON.stringify({action:'state',player:{id:playerId,x:p.x,y:p.y,angle:p.angle,team:p.team,hp:p.hp,vehicle:p.vehicle}}));}
  for(const b of g.bullets){
    const oldX=b.x,oldY=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    const rocketTarget=b.rocket?[p,...g.bots,...Object.values(remotePlayers).filter(r=>ts-r.lastSeen<4000)].find(t=>!t.dead&&t.team!==b.team&&t.id!==b.owner&&Math.hypot(t.x-b.x,t.y-b.y)<(t.r||14)+8):null;const wallHit=(g.walls||[]).find(w=>w.hp>0&&b.x>w.x&&b.x<w.x+w.w&&b.y>w.y&&b.y<w.y+w.h);
    const crateHit=g.obstacles.find(o=>b.x>o.x&&b.x<o.x+o.w&&b.y>o.y&&b.y<o.y+o.h);
    const doorHit=g.doors.find(d=>!d.open&&b.x>d.x&&b.x<d.x+d.w&&b.y>d.y&&b.y<d.y+d.h);
    if(wallHit||crateHit||doorHit||rocketTarget){
      if(b.rocket){const radius=112;for(const w of (g.walls||[])){if(w.hp>0&&Math.hypot(w.x+w.w/2-b.x,w.y+w.h/2-b.y)<radius)w.hp-=180;}for(const d of g.doors){if(!d.open&&Math.hypot(d.x+d.w/2-b.x,d.y+d.h/2-b.y)<radius)d.open=true;}if(g.hatch&&!g.hatch.open&&Math.hypot(g.hatch.x-b.x,g.hatch.y-b.y)<radius){g.hatch.open=true;showToast('RPG пробил люк! Подойди к лестнице и нажми E');}showToast('Взрыв RPG: стена пробита!');}
      else if(wallHit)wallHit.hp-=b.damage;
      if(doorHit&&b.rocket)doorHit.open=true;
      b.life=0;
    }
    if(b.rocket&&b.life<=0){for(const target of [p,...g.bots,...Object.values(remotePlayers).filter(r=>ts-r.lastSeen<4000)]){if(target.dead||target.team===b.team||target.id===b.owner||(target===p&&ts<(p.invulnerableUntil||0)))continue;const d=Math.hypot(target.x-b.x,target.y-b.y);if(d<(b.blastRadius||112)){target.hp-=Math.round((b.tankShell?125:b.damage)*(1-d/(b.blastRadius||140)));if(target.hp<=0){target.hp=0;target.dead=true;target.respawnAt=g.miniRoundsTotal?Infinity:ts+(target===p?2500:1800);if(target===p){ammo[currentWeapon]=0;showToast('Тебя устранили — магазин опустел.');updateHud();}else if(b.owner===p.id){p.kills++;coins+=10;wallet();showToast('+10 монет за устранение');}checkMatchEnd();}}}}
    const targets=[p,...g.bots,...Object.values(remotePlayers).filter(r=>ts-r.lastSeen<4000)];
    if(!b.rocket){for(const target of targets){if(b.life<=0||target.dead||target.team===b.team||target.id===b.owner||(target===p&&ts<(p.invulnerableUntil||0)))continue;if(Math.hypot(target.x-b.x,target.y-b.y)<(target.r||14)+4){target.hp-=b.damage;b.life=0;if(target.hp<=0){target.hp=0;target.dead=true;target.respawnAt=g.miniRoundsTotal?Infinity:ts+(target===p?2500:1800);if(target===p){ammo[currentWeapon]=0;g.respawns++;showToast('Тебя устранили — магазин опустел.');updateHud();}else if(b.owner===p.id){p.kills++;coins+=10;wallet();showToast('+10 монет за устранение');}if(target!==p&&target.ai)target.kills=(target.kills||0)+1;checkMatchEnd();}break;}}}
  }
  g.bullets=g.bullets.filter(b=>b.life>0&&b.x>0&&b.y>0&&b.x<g.w&&b.y<g.h);
  for(const c of g.coins){if(c.alive&&!p.dead&&Math.hypot(p.x-c.x,p.y-c.y)<24){c.alive=false;coins+=c.value;wallet();showToast('+5 монет');}}
  if(g.elapsed-g.lastCoin>14){g.lastCoin=g.elapsed;if(g.coins.filter(c=>c.alive).length<10)g.coins.push({x:80+Math.random()*1040,y:60+Math.random()*600,r:8,value:5,alive:true});}
  if(g.miniRoundsTotal)checkMiniRoundEnd(ts);
  if(g.remaining<=0)endGame();updateHud();
}
function checkMiniRoundEnd(ts){const g=game;if(!g||g.over||g.miniRoundEnded||g.roundTransitionUntil)return;const all=[g.player,...g.bots,...Object.values(remotePlayers).filter(r=>ts-r.lastSeen<4000)];const aliveT=all.some(a=>!a.dead&&a.team==='T'),aliveCT=all.some(a=>!a.dead&&a.team==='CT');if(aliveT&&aliveCT)return;if(aliveT===aliveCT)return;const winner=aliveT?'T':'CT';g.miniRoundEnded=true;if(winner==='T')g.scoreT++;else g.scoreCT++;if(g.miniRound>=g.miniRoundsTotal){endGame();return;}g.roundTransitionUntil=ts+2200;showToast(`Мини-раунд ${g.miniRound}/${g.miniRoundsTotal}: победа ${winner}. Следующий раунд через 2 секунды.`);updateHud();}
function resetMiniRound(ts){const g=game;if(!g||g.over)return;g.miniRound++;g.roundTransitionUntil=0;g.miniRoundEnded=false;g.player.dead=false;g.player.hp=g.player.maxHp;g.zone='MAIN';g.zoneStack=[];g.player.x=spawnPoint(g.player.team).x;g.player.y=spawnPoint(g.player.team).y;g.player.respawnAt=0;g.player.invulnerableUntil=ts+2500;g.bullets=[];g.drone=null;g.droneActive=false;droneSelected=false;g.basementOpen=false;g.roomIndex=0;g.walls=(g.mainWalls||[]).map(w=>({...w}));g.obstacles=(g.mainObstacles||[]).map(o=>({...o}));g.doors=[{x:780,y:210,w:22,h:90,open:false},{x:930,y:510,w:22,h:90,open:false}];g.hatch={x:1050,y:570,r:30,open:false};g.bots.forEach(b=>{const sp=spawnPoint(b.team);b.x=sp.x;b.y=sp.y;b.hp=b.maxHp||100;b.dead=false;b.respawnAt=0;b.shot=ts+350+Math.random()*650;b.decisionAt=0;b.thinkAt=0;b.targetId=null;});g.coins=[];for(let i=0;i<7;i++)g.coins.push({x:100+Math.random()*1000,y:60+Math.random()*600,r:8,value:5,alive:true});showToast(`МИНИ-РАУНД ${g.miniRound}/${g.miniRoundsTotal} — БОЙ!`);updateHud();}
function checkMatchEnd(){if(game&&!game.over&&(game.scoreT>=game.roundTarget||game.scoreCT>=game.roundTarget))endGame();}
const keysDown=new Set();window.addEventListener('keydown',e=>{keysDown.add(e.key.toLowerCase());if(['w','a','s','d',' '].includes(e.key.toLowerCase()))e.preventDefault()});window.addEventListener('keyup',e=>keysDown.delete(e.key.toLowerCase()));
window.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();if(!e.repeat&&game&&!game.over&&game.player.vehicle==='tank')tankFire(performance.now(),game.player)}});
function moveActor(a,dx,dy){const g=game;if(!g)return;const blocked=(x,y)=>{if(x-a.r<30||x+a.r>g.w-30||y-a.r<30||y+a.r>g.h-30)return true;for(const o of g.obstacles)if(x+a.r>o.x&&x-a.r<o.x+o.w&&y+a.r>o.y&&y-a.r<o.y+o.h)return true;for(const w of (g.walls||[]))if(w.hp>0&&x+a.r>w.x&&x-a.r<w.x+w.w&&y+a.r>w.y&&y-a.r<w.y+w.h)return true;for(const d of g.doors)if(!d.open&&x+a.r>d.x&&x-a.r<d.x+d.w&&y+a.r>d.y&&y-a.r<d.y+d.h)return true;return false;};const nx=Math.max(a.r,Math.min(g.w-a.r,a.x+dx));if(!blocked(nx,a.y))a.x=nx;const ny=Math.max(a.r,Math.min(g.h-a.r,a.y+dy));if(!blocked(a.x,ny))a.y=ny;}
function shoot(ts,p){const w=weapons[currentWeapon];if(ts-game.lastShot<w.rate)return;game.lastShot=ts;if(ammo[currentWeapon]<=0){showToast('Нет патронов — нажми R');return}ammo[currentWeapon]--;const pellets=w.pellets||1;for(let i=0;i<pellets;i++){const a=p.angle+(Math.random()-.5)*w.spread;game.bullets.push({x:p.x+Math.cos(a)*23,y:p.y+Math.sin(a)*23,vx:Math.cos(a)*(w.rocket?390:650),vy:Math.sin(a)*(w.rocket?390:650),life:w.rocket?2.8:1.4,team:p.team,owner:p.id,damage:w.damage,rocket:!!w.rocket})}if(w.rocket)showToast('RPG: ракета летит — попадание пробивает стены и люк');updateHud()}
function tankFire(ts,p){
 // Main cannon: SPACE only. One heavy shell every 10 seconds.
 if(ts<(p.cannonReadyAt||0)){showToast('Пушка перезаряжается');return;}
 p.cannonReadyAt=ts+10000;
 const a=p.angle;
 game.bullets.push({x:p.x+Math.cos(a)*34,y:p.y+Math.sin(a)*34,vx:Math.cos(a)*460,vy:Math.sin(a)*460,life:.48,team:p.team,owner:p.id,damage:0,rocket:true,tankShell:true,blastRadius:66});
 showToast('Тяжёлый снаряд! Перезарядка пушки: 10 секунд');updateHud();
}
function tankMachineGun(ts,p){
 // Mouse button keeps the rapid, weaker small bullets.
 if(ts<(p.machineGunReadyAt||0))return;
 p.machineGunReadyAt=ts+Math.max(90,weapons.rifle.rate*0.67);
 game.bullets.push({x:p.x+Math.cos(p.angle)*30,y:p.y+Math.sin(p.angle)*30,vx:Math.cos(p.angle)*700,vy:Math.sin(p.angle)*700,life:1.2,team:p.team,owner:p.id,damage:weapons.rifle.damage*.5,rocket:false});
}
function reload(){if(!game)return;if(droneSelected||game.droneActive){showToast('FPV-дрон перезаряжается автоматически за 10 секунд');return}const w=weapons[currentWeapon],need=w.mag-ammo[currentWeapon],take=Math.min(need,reserve[currentWeapon]);if(take<=0){showToast('Перезарядка невозможна');return}ammo[currentWeapon]+=take;reserve[currentWeapon]-=take;updateHud();showToast('Перезарядка')}
$('mobileReload').addEventListener('click',reload);$('mobileShop').addEventListener('click',()=>{showToast('Магазин доступен между матчами в меню');stopGame();showScreen('shop')});
function updateHud(){if(!game)return;const p=game.player;$('health').textContent=Math.ceil(p.hp);const droneMode=game.droneActive||droneSelected;$('weaponName').textContent=droneMode?'FPV-ДРОН':weapons[currentWeapon].name.toUpperCase();if(droneMode&&!game.droneActive&&game.droneReadyAt>performance.now())$('ammo').textContent='ПЕРЕЗАРЯДКА '+Math.ceil((game.droneReadyAt-performance.now())/1000)+'с';else $('ammo').textContent=droneMode?'ГОТОВ К ЗАПУСКУ':ammo[currentWeapon]+' / '+reserve[currentWeapon];$('score').textContent=game.miniRoundsTotal?('МИНИ-РАУНД '+game.miniRound+'/10 · '+game.scoreT+'—'+game.scoreCT):(game.scoreT+' — '+game.scoreCT+' / '+game.roundTarget);$('zoneName').textContent=game.zone;$('gameWallet').textContent='◈ '+coins;$('timer').textContent=Math.floor(game.remaining/60).toString().padStart(2,'0')+':'+Math.floor(game.remaining%60).toString().padStart(2,'0');if(weaponSwitcher)weaponSwitcher.querySelectorAll('[data-slot]').forEach(b=>{const n=Number(b.dataset.slot),id=({1:'pistol',2:'shotgun',3:'rifle',4:'sniper',5:'rpg'})[n];b.classList.toggle('selected',n===6?droneMode:!droneMode&&id===currentWeapon);b.classList.toggle('locked',n===6?!droneOwned:!!id&&!unlocked.has(id));b.disabled=n===6?!droneOwned:!!id&&!unlocked.has(id);});}
function endGame(){if(!game||game.over)return;game.over=true;const winner=game.remaining<=0?'ВРЕМЯ МАТЧА ИСТЕКЛО':game.scoreT>game.scoreCT?'ПОБЕДА КОМАНДЫ T':game.scoreCT>game.scoreT?'ПОБЕДА КОМАНДЫ CT':'НИЧЬЯ';$('finalStats').textContent=`${winner} · Мини-раунды: ${game.miniRound}/${game.miniRoundsTotal||10} · Счёт ${game.scoreT} — ${game.scoreCT} · Твои устранения: ${game.player.kills} · Монеты: ${coins}`;$('gameOver').classList.remove('hidden')}
function draw(){const g=game;if(!g)return;const W=g.w,H=g.h;const mobileCamera=!!(window.matchMedia&&window.matchMedia('(pointer: coarse) and (orientation: landscape) and (max-height: 600px)').matches)&&!g.droneActive;const viewZoom=1.0; // Мобильная камера показывает ближайший участок карты без увеличения и растягивания объектов.
const inView=(x,y,r=0)=>!mobileCamera||(x+r>=g.player.x-W/(2*viewZoom)&&x-r<=g.player.x+W/(2*viewZoom)&&y+r>=g.player.y-H/(2*viewZoom)&&y-r<=g.player.y+H/(2*viewZoom));ctx.clearRect(0,0,W,H);ctx.fillStyle=g.zone==='BASEMENT'?'#10151a':'#141a12';ctx.fillRect(0,0,W,H);if(mobileCamera){ctx.save();ctx.translate(W/2-g.player.x*viewZoom,H/2-g.player.y*viewZoom);ctx.scale(viewZoom,viewZoom);}if(g.droneActive&&g.drone){ctx.save();ctx.translate(W/2-g.drone.x,H/2-g.drone.y);}ctx.strokeStyle=g.zone==='BASEMENT'?'#242c34':'#20291b';ctx.lineWidth=1;for(let x=0;x<W;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.fillStyle=g.zone==='BASEMENT'?'#252a2d':'#242c20';ctx.fillRect(30,30,W-60,H-60);ctx.strokeStyle=g.zone==='BASEMENT'?'#69737b':'#566447';ctx.lineWidth=4;ctx.strokeRect(30,30,W-60,H-60);for(const o of g.obstacles){if(!inView(o.x+o.w/2,o.y+o.h/2,Math.max(o.w,o.h)))continue;ctx.fillStyle='#41483b';ctx.fillRect(o.x,o.y,o.w,o.h);ctx.strokeStyle='#69745b';ctx.strokeRect(o.x,o.y,o.w,o.h);ctx.fillStyle='#252c21';ctx.fillRect(o.x+4,o.y+4,o.w-8,4)}for(const w of (g.walls||[])){if(w.hp<=0||!inView(w.x+w.w/2,w.y+w.h/2,Math.max(w.w,w.h)))continue;ctx.fillStyle=w.hp<w.maxHp*.5?'#6b5141':'#656b5c';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.strokeStyle='#a3a995';ctx.lineWidth=2;ctx.strokeRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#33392f';for(let yy=w.y+7;yy<w.y+w.h;yy+=18){ctx.fillRect(w.x+3,yy,Math.max(2,w.w-6),2)}}if(g.hatch){ctx.fillStyle=g.hatch.open?'#141a12':'#746c58';ctx.fillRect(g.hatch.x-22,g.hatch.y-22,44,44);ctx.strokeStyle=g.hatch.open?'#b8d77d':'#d4c59c';ctx.lineWidth=3;ctx.strokeRect(g.hatch.x-22,g.hatch.y-22,44,44);ctx.fillStyle='#e5dfc6';ctx.font='12px monospace';ctx.fillText(g.zone==='MAIN'?'E: В ПОДВАЛ':'E: НАВЕРХ',g.hatch.x-38,g.hatch.y+36)}for(const d of g.doors){if(!inView(d.x+d.w/2,d.y+d.h/2,Math.max(d.w,d.h)))continue;ctx.fillStyle=d.open?'#293626':'#8b5d37';ctx.fillRect(d.x,d.y,d.w,d.h);ctx.strokeStyle=d.open?'#a7d66b':'#e5a76b';ctx.strokeRect(d.x,d.y,d.w,d.h);if(!d.open){ctx.fillStyle='#e7c08d';ctx.fillRect(d.x+5,d.y+8,3,3)}}for(const c of g.coins){if(!c.alive||!inView(c.x,c.y,c.r))continue;ctx.fillStyle='#f5d45d';ctx.beginPath();ctx.arc(c.x,c.y,c.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff1a6';ctx.stroke();ctx.fillStyle='#6a4c12';ctx.font='10px monospace';ctx.fillText('5',c.x-3,c.y+3)}for(const b of g.bots){if(b.dead||!inView(b.x,b.y,b.r||14))continue;const isT=b.team==='T';if(b.vehicle==='tank')drawTank(b);else drawActor(b,b.elite?(isT?'#b75d4d':'#4f8cb6'):(isT?'#b67b4c':'#528ea5'),isT?'#4a3020':'#203d48');ctx.fillStyle='#e56b6b';ctx.fillRect(b.x-14,b.y-23,28,4);ctx.fillStyle='#75e17a';ctx.fillRect(b.x-14,b.y-23,28*Math.max(0,b.hp/100),4)}for(const r of Object.values(remotePlayers)){if(performance.now()-r.lastSeen<4000&&inView(r.x,r.y,r.r||14))drawActor({...r,r:14},'#d0b76d','#65552e');}for(const b of g.bullets){if(!inView(b.x,b.y,b.rocket?8:4))continue;ctx.fillStyle=b.rocket?'#ff7d42':b.team==='T'?'#e6f4a1':'#f39b73';ctx.beginPath();ctx.arc(b.x,b.y,b.rocket?6:3,0,Math.PI*2);ctx.fill()}if(g.drone){ctx.save();ctx.translate(g.drone.x,g.drone.y);ctx.rotate(g.drone.angle||0);ctx.fillStyle='#171b18';ctx.strokeStyle='#b7d86b';ctx.lineWidth=3;ctx.fillRect(-10,-7,20,14);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(16,0);ctx.stroke();for(const sx of [-13,13])for(const sy of [-10,10]){ctx.beginPath();ctx.arc(sx,sy,4,0,Math.PI*2);ctx.stroke();}ctx.restore();}if(!g.player.dead&&!g.droneActive){const equipped=getSkin(currentWeapon);if(g.player.vehicle==='tank')drawTank(g.player);else {drawActor(g.player,equipped?equipped.body:'#c8f36b',equipped?equipped.gear:'#4d6a2b',currentWeapon);ctx.save();ctx.translate(g.player.x,g.player.y);ctx.rotate(g.player.angle);drawHeldWeapon(currentWeapon,equipped);ctx.restore();}}if(g.droneActive&&g.drone){ctx.restore();ctx.fillStyle='#e5f5bf';ctx.font='bold 18px monospace';ctx.fillText('FPV // LIVE',24,34);ctx.font='13px monospace';ctx.fillText('DRONE CAM · 6 / ESC: RETURN',24,H-22);ctx.strokeStyle='#e5f5bf';ctx.lineWidth=1;ctx.strokeRect(18,18,W-36,H-36);}if(mobileCamera)ctx.restore();ctx.strokeStyle='#d5ff83';ctx.lineWidth=2;ctx.beginPath();ctx.arc(mouse.x,mouse.y,9,0,Math.PI*2);ctx.moveTo(mouse.x-14,mouse.y);ctx.lineTo(mouse.x-5,mouse.y);ctx.moveTo(mouse.x+5,mouse.y);ctx.lineTo(mouse.x+14,mouse.y);ctx.moveTo(mouse.x,mouse.y-14);ctx.lineTo(mouse.x,mouse.y-5);ctx.moveTo(mouse.x,mouse.y+5);ctx.lineTo(mouse.x,mouse.y+14);ctx.stroke();}
function drawTank(a){
 ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle||0);
 const team=a.team==='T',base=team?'#b58b52':'#557d76',mid=team?'#80633b':'#3c625c',dark=team?'#403321':'#1e3431',light=team?'#d2b276':'#92b4a7';
 // Heavy shadow and broad tracked chassis
 ctx.fillStyle='rgba(0,0,0,.48)';ctx.beginPath();ctx.ellipse(1,7,40,30,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#151917';ctx.fillRect(-35,-25,70,50);
 // Track rubber and individual steel shoes
 for(const side of [-1,1]){ctx.fillStyle='#252b28';ctx.fillRect(-33,side===-1?-25:17,66,8);ctx.fillStyle='#687067';for(let x=-30;x<=26;x+=8){ctx.fillRect(x,side===-1?-24:18,5,5);ctx.strokeStyle='#171b19';ctx.lineWidth=1;ctx.strokeRect(x,side===-1?-24:18,5,5)}
   for(let x=-25;x<=25;x+=12){ctx.fillStyle='#111513';ctx.beginPath();ctx.arc(x,side===-1?-13:13,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#747d73';ctx.stroke();ctx.fillStyle='#a0a69b';ctx.beginPath();ctx.arc(x,side===-1?-13:13,1.4,0,Math.PI*2);ctx.fill();}}
 // Main hull with angled front/rear armor
 ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(-26,-15);ctx.lineTo(18,-17);ctx.lineTo(29,-9);ctx.lineTo(29,10);ctx.lineTo(17,17);ctx.lineTo(-26,15);ctx.closePath();ctx.fill();
 ctx.fillStyle=base;ctx.beginPath();ctx.moveTo(-24,-13);ctx.lineTo(17,-14);ctx.lineTo(25,-7);ctx.lineTo(25,7);ctx.lineTo(16,14);ctx.lineTo(-24,12);ctx.closePath();ctx.fill();
 ctx.strokeStyle=dark;ctx.lineWidth=2.5;ctx.stroke();
 // Weld seams and modular reactive armor blocks
 ctx.strokeStyle=light;ctx.globalAlpha=.55;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-18,-9);ctx.lineTo(15,-10);ctx.lineTo(21,-5);ctx.moveTo(-18,8);ctx.lineTo(14,9);ctx.lineTo(21,5);ctx.stroke();ctx.globalAlpha=1;
 for(const yy of [-10,0,10])for(const xx of [-16,-5,6,17]){ctx.fillStyle=((xx+yy)%2===0)?mid:base;ctx.fillRect(xx-3,yy-3,7,6);ctx.strokeStyle=dark;ctx.lineWidth=1.2;ctx.strokeRect(xx-3,yy-3,7,6);ctx.fillStyle=light;ctx.fillRect(xx-1,yy-2,2,1);}
 // Additional realistic armor: chipped edges, grime, bolt plates and non-uniform wear.
 ctx.save();
 for(let i=0;i<13;i++){
   const xx=-22+(i*17%48), yy=(i%2===0?-12:12);
   ctx.fillStyle=i%3===0?'rgba(18,22,18,.48)':'rgba(218,207,163,.22)';
   ctx.fillRect(xx,yy,3+(i%3),1+(i%2));
 }
 // Overlapping side skirts and reinforced front glacis.
 ctx.fillStyle=dark;ctx.fillRect(-19,-17,37,3);ctx.fillRect(-19,14,37,3);
 ctx.fillStyle=base;ctx.beginPath();ctx.moveTo(17,-13);ctx.lineTo(27,-7);ctx.lineTo(27,7);ctx.lineTo(17,13);ctx.lineTo(20,7);ctx.lineTo(20,-7);ctx.closePath();ctx.fill();ctx.strokeStyle=light;ctx.lineWidth=.8;ctx.stroke();
 // Bolted modular armor tiles with tiny scratches.
 for(const xx of [-14,-2,10,20])for(const yy of [-9,9]){
   ctx.fillStyle=mid;ctx.fillRect(xx-3,yy-2,6,4);ctx.strokeStyle=dark;ctx.strokeRect(xx-3,yy-2,6,4);
   ctx.fillStyle='#c5b995';ctx.beginPath();ctx.arc(xx-1,yy-1,0.7,0,Math.PI*2);ctx.fill();
 }
 // Heat-darkened exhaust and rear deck vents.
 ctx.fillStyle='#171b18';ctx.fillRect(-27,-5,5,10);for(let yy=-4;yy<=3;yy+=2){ctx.fillStyle='#8a8d7e';ctx.fillRect(-26,yy,3,.7)}
 ctx.restore();
 // Rear engine grilles and exhausts
 ctx.fillStyle=dark;ctx.fillRect(-26,-7,7,14);for(let y=-5;y<=5;y+=3){ctx.fillStyle='#111613';ctx.fillRect(-25,y,5,1)}
 ctx.fillStyle='#7c8277';ctx.fillRect(-30,-15,5,7);ctx.fillRect(-30,8,5,7);ctx.strokeStyle='#252a25';ctx.strokeRect(-30,-15,5,7);ctx.strokeRect(-30,8,5,7);
 // Turret ring and armored turret
 ctx.fillStyle='#202723';ctx.beginPath();ctx.ellipse(1,0,17,14,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#0d110f';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle=mid;ctx.beginPath();ctx.moveTo(-12,-9);ctx.lineTo(8,-11);ctx.lineTo(14,-5);ctx.lineTo(14,6);ctx.lineTo(7,11);ctx.lineTo(-12,8);ctx.closePath();ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=2.5;ctx.stroke();
 ctx.fillStyle=base;ctx.fillRect(-8,-7,14,14);ctx.strokeStyle=light;ctx.lineWidth=1;ctx.strokeRect(-8,-7,14,14);
 // Cannon barrel, thermal sleeve and muzzle
 ctx.fillStyle=dark;ctx.fillRect(8,-4,33,8);ctx.fillStyle=base;ctx.fillRect(10,-3,25,6);ctx.fillStyle=light;ctx.fillRect(20,-3,2,6);ctx.fillStyle='#1b211e';ctx.fillRect(35,-5,7,10);ctx.strokeStyle=dark;ctx.lineWidth=1.5;ctx.strokeRect(35,-5,7,10);
 // Hatches, optics, antenna and team identification
 ctx.fillStyle=dark;ctx.beginPath();ctx.arc(-3,0,5,0,Math.PI*2);ctx.fill();ctx.fillStyle=light;ctx.beginPath();ctx.arc(-3,0,2.5,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#1b211d';ctx.fillRect(-11,-13,9,4);ctx.fillStyle=team?'#f4bd63':'#83d6ff';ctx.fillRect(-9,-12,5,2);
 ctx.strokeStyle='#b9b7a3';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(-19,-13);ctx.lineTo(-23,-25);ctx.stroke();ctx.fillStyle=team?'#ffbd62':'#69d5ff';ctx.beginPath();ctx.arc(-23,-25,1.8,0,Math.PI*2);ctx.fill();
 // Bolt heads and side stowage
 for(const xx of [-22,-10,2,14,23]){for(const yy of [-15,15]){ctx.fillStyle='#d1c9a7';ctx.beginPath();ctx.arc(xx,yy,1.2,0,Math.PI*2);ctx.fill();}}
 ctx.fillStyle=dark;ctx.fillRect(-4,16,15,4);ctx.fillStyle=light;ctx.fillRect(-2,17,4,1);
 ctx.restore();
}
function drawHeldWeapon(id,skin){
 const body=skin?.body||'#7e8b7d', trim=skin?.gear||'#303a35';
 const name=(skin?.name||'').toLowerCase();
 const neon=name.includes('neon')||name.includes('cyber')||name.includes('pulse')||name.includes('ion');
 const arctic=name.includes('arctic')||name.includes('polar')||name.includes('frost')||name.includes('winter');
 const red=name.includes('crimson')||name.includes('redline')||name.includes('blood');
 const gold=name.includes('gold')||name.includes('imperial')||name.includes('royal');
 const phantom=name.includes('phantom')||name.includes('void')||name.includes('eclipse')||name.includes('spectre');
 const accent=neon?'#7dffe9':arctic?'#e9f6ff':red?'#ff4b58':gold?'#ffd76a':phantom?'#a78bff':'#c7c5a9';
 const dark='#111714', steel=arctic?'#d6e2e7':gold?'#c7a14b':phantom?'#514878':'#69766e';
 ctx.save();
 // Shadow, grip and hand make the weapon sit in the soldier's hands.
 ctx.fillStyle='rgba(0,0,0,.42)';ctx.fillRect(-9,6,52,8);
 ctx.fillStyle='#b6a087';ctx.fillRect(3,4,9,7);ctx.fillRect(20,3,8,7);
 if(id==='rpg'){
   ctx.fillStyle=dark;ctx.fillRect(-6,-8,48,16);
   ctx.fillStyle=trim;ctx.fillRect(-4,-7,37,14);ctx.fillStyle=body;ctx.fillRect(2,-5,26,10);
   ctx.fillStyle=steel;ctx.fillRect(27,-6,8,12);ctx.fillStyle=dark;ctx.fillRect(34,-5,13,10);
   ctx.fillStyle=accent;ctx.fillRect(8,-8,12,2);ctx.fillRect(8,6,12,2);
   ctx.fillStyle=trim;ctx.fillRect(5,7,6,10);ctx.fillRect(21,7,6,8);ctx.fillStyle=dark;ctx.fillRect(3,15,10,3);
   ctx.fillStyle=accent;ctx.fillRect(-3,-3,3,6);
 } else if(id==='sniper'){
   ctx.fillStyle=dark;ctx.fillRect(-8,-4,52,8);ctx.fillStyle=trim;ctx.fillRect(-5,-5,38,10);
   ctx.fillStyle=body;ctx.fillRect(1,-4,26,8);ctx.fillStyle=steel;ctx.fillRect(24,-2,19,4);
   ctx.fillStyle=dark;ctx.fillRect(39,-1,9,2);ctx.fillRect(5,-9,14,4);ctx.fillStyle=accent;ctx.fillRect(7,-8,10,2);
   ctx.fillStyle=trim;ctx.fillRect(3,4,5,10);ctx.fillRect(-6,2,8,5);ctx.fillStyle=dark;ctx.fillRect(4,12,8,3);
 } else if(id==='shotgun'){
   ctx.fillStyle=dark;ctx.fillRect(-8,-5,46,10);ctx.fillStyle=trim;ctx.fillRect(-5,-5,28,10);
   ctx.fillStyle=body;ctx.fillRect(1,-4,22,8);ctx.fillStyle=steel;ctx.fillRect(19,-3,20,6);ctx.fillStyle=dark;ctx.fillRect(35,-2,9,4);
   ctx.fillStyle=accent;ctx.fillRect(4,-6,14,2);ctx.fillStyle=trim;ctx.fillRect(-7,3,12,5);ctx.fillRect(4,5,5,8);
 } else if(id==='pistol'){
   ctx.fillStyle=dark;ctx.fillRect(-5,-4,28,8);ctx.fillStyle=trim;ctx.fillRect(-3,-5,22,10);ctx.fillStyle=body;ctx.fillRect(1,-4,15,8);
   ctx.fillStyle=steel;ctx.fillRect(16,-2,13,4);ctx.fillStyle=dark;ctx.fillRect(26,-1,5,2);ctx.fillStyle=accent;ctx.fillRect(2,-6,9,2);
   ctx.fillStyle=trim;ctx.fillRect(4,4,6,9);ctx.fillStyle=dark;ctx.fillRect(4,12,7,2);
 } else {
   // Assault rifle with stock, receiver, handguard, barrel, sights and magazine.
   ctx.fillStyle=dark;ctx.fillRect(-10,-4,48,8);ctx.fillStyle=trim;ctx.fillRect(-8,-5,15,10);ctx.fillStyle=body;ctx.fillRect(3,-5,23,10);
   ctx.fillStyle=steel;ctx.fillRect(22,-2,19,4);ctx.fillStyle=dark;ctx.fillRect(38,-1,8,2);
   ctx.fillStyle=accent;ctx.fillRect(7,-6,15,2);ctx.fillRect(24,-3,5,6);
   ctx.fillStyle=trim;ctx.fillRect(7,4,6,10);ctx.fillRect(15,4,5,7);ctx.fillStyle=dark;ctx.fillRect(6,13,8,2);
   ctx.fillStyle=steel;ctx.fillRect(3,-8,6,3);
 }
 // Skin-specific signature finish: high contrast markings so each skin is visibly different.
 if(neon){ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(3,-2);ctx.lineTo(8,1);ctx.lineTo(13,-2);ctx.lineTo(18,1);ctx.stroke();ctx.fillStyle=accent;ctx.fillRect(21,-6,3,2);}
 else if(arctic){ctx.fillStyle=accent;ctx.fillRect(4,-5,3,10);ctx.fillRect(12,-5,2,10);ctx.fillRect(20,-4,2,8);}
 else if(red){ctx.fillStyle=accent;ctx.fillRect(2,-5,4,10);ctx.fillRect(14,-4,3,8);}
 else if(gold){ctx.fillStyle=accent;ctx.fillRect(3,-6,17,2);ctx.fillRect(12,4,7,2);ctx.fillRect(24,-2,3,4);}
 else if(phantom){ctx.strokeStyle=accent;ctx.lineWidth=1.5;ctx.strokeRect(4,-4,17,8);ctx.fillStyle=accent;ctx.fillRect(10,-7,5,2);}
 else {ctx.fillStyle=accent;ctx.fillRect(5,-2,3,4);ctx.fillRect(15,-2,3,4);}
 ctx.restore();
}
function drawVisibleCamo(team,r){
 // Hand-painted angular camouflage patches: intentionally high contrast at game zoom.
 const desert=team==='T';
 const colors=desert?['#c5a875','#8e7954','#4d4938','#ded0a5']:['#65764a','#344a32','#87905a','#252f28'];
 const regions=[
  {x:-r*.58,y:-r*.58,w:r*1.16,h:r*1.05},
  {x:-r*.59,y:r*.20,w:r*.39,h:r*.68},
  {x:r*.21,y:r*.20,w:r*.39,h:r*.68},
  {x:-r*1.00,y:-r*.42,w:r*.32,h:r*.45},
  {x:r*.67,y:-r*.42,w:r*.32,h:r*.45}
 ];
 for(let q=0;q<regions.length;q++){
  const b=regions[q];ctx.save();ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,Math.max(2,r*.10));ctx.clip();
  // Fixed pattern avoids flicker and looks the same every frame.
  const patches=[
   [.10,.08,.30,.20,0],[.53,.06,.32,.18,1],[.26,.30,.40,.18,2],[.02,.48,.31,.20,1],
   [.60,.37,.34,.21,3],[.36,.62,.34,.18,0],[.06,.76,.35,.18,2],[.70,.70,.25,.20,1]
  ];
  for(let i=0;i<patches.length;i++){
   const p=patches[i],x=b.x+p[0]*b.w,y=b.y+p[1]*b.h,w=p[2]*b.w,h=p[3]*b.h;
   ctx.fillStyle=colors[(p[4]+q)%colors.length];ctx.beginPath();ctx.moveTo(x,y+h*.2);ctx.lineTo(x+w*.22,y);ctx.lineTo(x+w*.78,y+h*.08);ctx.lineTo(x+w,y+h*.55);ctx.lineTo(x+w*.72,y+h);ctx.lineTo(x+w*.18,y+h*.82);ctx.closePath();ctx.fill();
  }
  ctx.restore();
 }
}

function drawActor(a,body,gear,weaponId='rifle'){
 const r=a.r||14;ctx.save();ctx.translate(a.x,a.y);ctx.rotate(a.angle||0);
 const skin=getSkin&&a.id===game?.player?.id?getSkin(currentWeapon):null;
 const uniform=body||'#8d9a7d', vest=gear||'#3c493c';
 // Ground shadow and pack silhouette.
 ctx.fillStyle='rgba(0,0,0,.38)';ctx.beginPath();ctx.ellipse(1,r*.32,r*1.05,r*.88,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#252d29';ctx.beginPath();ctx.roundRect(-r*.96,-r*.25,r*.45,r*1.0,3);ctx.fill();
 ctx.fillStyle=vest;ctx.fillRect(-r*.92,-r*.18,r*.34,r*.72);ctx.fillStyle='rgba(210,220,195,.22)';ctx.fillRect(-r*.84,-r*.12,r*.08,r*.55);
 // Legs, knee pads, boots and trouser seams.
 ctx.fillStyle='#202722';ctx.beginPath();ctx.roundRect(-r*.63,r*.22,r*.45,r*.88,3);ctx.roundRect(r*.18,r*.22,r*.45,r*.88,3);ctx.fill();
 ctx.fillStyle=uniform;ctx.fillRect(-r*.60,r*.18,r*.40,r*.72);ctx.fillRect(r*.20,r*.18,r*.40,r*.72);
 ctx.fillStyle=vest;ctx.fillRect(-r*.61,r*.57,r*.42,r*.25);ctx.fillRect(r*.19,r*.57,r*.42,r*.25);
 ctx.fillStyle='#151a17';ctx.fillRect(-r*.67,r*.96,r*.52,r*.22);ctx.fillRect(r*.15,r*.96,r*.52,r*.22);
 ctx.fillStyle='#69766a';ctx.fillRect(-r*.59,r*1.0,r*.34,r*.06);ctx.fillRect(r*.23,r*1.0,r*.34,r*.06);
 // Arms extend toward the weapon, with sleeves, elbow pads and gloves.
 ctx.fillStyle='#b79b7f';ctx.beginPath();ctx.roundRect(-r*1.03,-r*.47,r*.42,r*.88,4);ctx.roundRect(r*.61,-r*.47,r*.42,r*.88,4);ctx.fill();
 ctx.fillStyle=uniform;ctx.fillRect(-r*1.04,-r*.47,r*.4,r*.58);ctx.fillRect(r*.64,-r*.47,r*.4,r*.58);
 ctx.fillStyle=vest;ctx.fillRect(-r*1.04,-r*.02,r*.4,r*.19);ctx.fillRect(r*.64,-r*.02,r*.4,r*.19);
 ctx.fillStyle='#252a26';ctx.fillRect(-r*1.04,r*.27,r*.4,r*.23);ctx.fillRect(r*.64,r*.27,r*.4,r*.23);
 ctx.fillStyle='#c3a88c';ctx.beginPath();ctx.ellipse(-r*.82,r*.39,r*.17,r*.18,0,0,Math.PI*2);ctx.ellipse(r*.83,r*.39,r*.17,r*.18,0,0,Math.PI*2);ctx.fill();
 // Torso and tactical plate carrier, layered webbing and individual pouches.
 ctx.fillStyle=uniform;ctx.beginPath();ctx.roundRect(-r*.63,-r*.78,r*1.26,r*1.38,5);ctx.fill();
 ctx.fillStyle=vest;ctx.beginPath();ctx.roundRect(-r*.62,-r*.63,r*1.24,r*1.20,4);ctx.fill();
 ctx.strokeStyle='rgba(218,224,203,.42)';ctx.lineWidth=1;ctx.stroke();
 // Fine camouflage weave clipped to the plate carrier and uniform, so skins still keep their own colors.
 ctx.save();ctx.beginPath();ctx.roundRect(-r*.62,-r*.63,r*1.24,r*1.20,4);ctx.clip();
 addFabricTexture(-r*.62,-r*.63,r*1.24,(a.team==='T'?'arid':'woodland'),.20);
 ctx.restore();
 ctx.save();ctx.beginPath();ctx.roundRect(-r*.60,r*.18,r*.40,r*.72,3);ctx.roundRect(r*.20,r*.18,r*.40,r*.72,3);ctx.clip();
 addFabricTexture(-r*.60,r*.18,r*1.20,(a.team==='T'?'arid':'woodland'),.16);ctx.restore();
 ctx.fillStyle='#6e7968';ctx.fillRect(-r*.47,-r*.49,r*.94,r*.12);ctx.fillRect(-r*.47,r*.28,r*.94,r*.1);
 ctx.fillStyle='#252d29';for(let i=0;i<4;i++){ctx.fillRect(-r*.48+i*r*.25,-r*.20,r*.19,r*.38);ctx.fillStyle='rgba(225,220,190,.5)';ctx.fillRect(-r*.45+i*r*.25,-r*.15,r*.13,r*.035);ctx.fillStyle='#252d29';}
 // Strong, clearly visible team camouflage at normal gameplay zoom.
 drawVisibleCamo(a.team,r);
 // Cross-body sling and radio antenna.
 ctx.strokeStyle='rgba(18,24,20,.8)';ctx.lineWidth=r*.11;ctx.beginPath();ctx.moveTo(-r*.42,-r*.58);ctx.lineTo(r*.43,r*.43);ctx.stroke();
 ctx.fillStyle='#171d19';ctx.fillRect(-r*.54,-r*.42,r*.16,r*.32);ctx.fillStyle='#8a9b83';ctx.fillRect(-r*.51,-r*.38,r*.1,r*.08);ctx.strokeStyle='#252d29';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-r*.72,-r*.45);ctx.lineTo(-r*.82,-r*.95);ctx.stroke();
 // Neck, face, ears and helmet with brim, rails and visor.
 ctx.fillStyle='#9e8069';ctx.fillRect(-r*.20,-r*.91,r*.40,r*.26);
 ctx.fillStyle='#c4a184';ctx.beginPath();ctx.ellipse(0,-r*.94,r*.39,r*.43,0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#292e2a';ctx.beginPath();ctx.ellipse(0,-r*1.02,r*.51,r*.38,0,Math.PI,Math.PI*2);ctx.fill();
 ctx.fillStyle=vest;ctx.beginPath();ctx.ellipse(0,-r*1.08,r*.50,r*.32,0,Math.PI,Math.PI*2);ctx.fill();
 ctx.fillStyle='#303a34';ctx.fillRect(-r*.51,-r*1.04,r*1.02,r*.12);
 ctx.fillStyle='#a9c8c8';ctx.fillRect(-r*.22,-r*.98,r*.44,r*.10);ctx.fillStyle='rgba(255,255,255,.42)';ctx.fillRect(-r*.18,-r*.98,r*.13,r*.025);
 ctx.fillStyle='#242a26';ctx.beginPath();ctx.arc(-r*.42,-r*.88,r*.13,0,Math.PI*2);ctx.arc(r*.42,-r*.88,r*.13,0,Math.PI*2);ctx.fill();
 // Shoulder patch and team stripe aid recognition without changing skin pattern.
 ctx.fillStyle=a.team==='T'?'#c77b53':'#5c9bc1';ctx.fillRect(-r*.93,-r*.43,r*.20,r*.20);ctx.fillStyle='#e4e5d7';ctx.fillRect(-r*.90,-r*.39,r*.14,r*.04);
 // Non-player weapons are drawn in their hands; player weapon is rendered by drawHeldWeapon.
 if(a.id!==game?.player?.id){ctx.fillStyle='#171d19';ctx.fillRect(r*.34,-r*.16,r*1.35,r*.28);ctx.fillStyle=vest;ctx.fillRect(r*.48,-r*.22,r*.66,r*.40);ctx.fillStyle='#87938a';ctx.fillRect(r*1.18,-r*.08,r*.58,r*.12);ctx.fillStyle='#111714';ctx.fillRect(r*1.68,-r*.04,r*.22,r*.05);ctx.fillStyle=vest;ctx.fillRect(r*.60,r*.12,r*.20,r*.43);}
 ctx.restore();
}
// Weapon selection is handled centrally by selectWeaponSlot().
wallet();refreshSettings();renderShop();
