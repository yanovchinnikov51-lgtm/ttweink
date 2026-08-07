(() => {
  const sceneHost = document.getElementById('scene');
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const hud = document.getElementById('hud');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const musicBtn = document.getElementById('musicBtn');
  const toast = document.getElementById('toast');
  const music = document.getElementById('music');

  // ====== НАСТРОЙКИ ======
  const CONFIG = {
    speed: 22,
    maxParticles: 420,
    tunnelWidth: 22,
    tunnelHeight: 15,
    recycleZ: 18,
    farZ: -520,
    dprMax: 1.7,
    texts: [
      {text:'WEINK1', type:'brand', link:null},
      {text:'@gelinovaa', type:'text', link:'https://t.me/gelinovaa'},
      {text:'t.me/gelinovka', type:'link', link:'https://t.me/gelinovka'},
      {text:'t.me/perehodnoychannel', type:'link', link:'https://t.me/perehodnoychannel'},
      {text:'TikTok:grimassk', type:'link', link:'https://www.tiktok.com/@grimassk'},
      {text:'TikTok:weinky_tt', type:'link', link:'https://www.tiktok.com/@weinky_tt'}
    ],
    emojis: ['❤️','🖤','💜','💗','💖','💘','💫','⭐','✨','🌙','🦋','🌸','🎀','😈','👾','🕷️','💀','🩷','🔥','⚡','☠️','🥀']
  };

  let renderer, camera, world, clock;
  let textObjects = [], emojiObjects = [], particles = [];
  let running = false, paused = false, elapsed = 0;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  let touchStartX = 0, touchStartY = 0, touchActive = false;
  let speedBoost = 1;
  const clickable = [];
  const bursts = [];
  let explosionScore = 0;
  let audioCtx = null;
  const PROXIMITY_DISTANCE = 72;
  const BURST_LIFE = 0.72;

  const rand = (a,b) => a + Math.random()*(b-a);
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];

  function hexColor(i) {
    const palette = [0xff2ab8,0xb95cff,0x28e8ff,0xff4b78,0x9d4dff];
    return palette[i % palette.length];
  }

  function setup() {
    sceneHost.innerHTML = '';
    renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.dprMax));
    renderer.setSize(sceneHost.clientWidth, sceneHost.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    sceneHost.appendChild(renderer.domElement);

    world = new THREE.Scene();
    world.background = new THREE.Color(0x020107);
    world.fog = new THREE.FogExp2(0x020107, 0.011);

    camera = new THREE.PerspectiveCamera(70, sceneHost.clientWidth/sceneHost.clientHeight, .05, 900);
    camera.position.set(0,0,0);

    clock = new THREE.Clock();

    buildTunnel();
    buildTextObjects();
    buildEmojis();
    buildParticles();

    window.addEventListener('resize', resize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
  }

  function lineMaterial(color, opacity=.28) {
    return new THREE.LineBasicMaterial({color, transparent:true, opacity});
  }

  function buildTunnel() {
    const group = new THREE.Group();
    group.name = 'TUNNEL_GRID';
    const w = CONFIG.tunnelWidth, h = CONFIG.tunnelHeight, depth = 700;
    const z0 = 12, z1 = -depth;

    function gridFloor(y, rotX, color) {
      const pts = [];
      const steps = 38;
      const longitudinal = 15;
      for(let i=0;i<=steps;i++){
        const x = -w/2 + w*i/steps;
        pts.push(new THREE.Vector3(x,y,z0),new THREE.Vector3(x,y,z1));
      }
      for(let i=0;i<=longitudinal;i++){
        const z = z0 + (z1-z0)*i/longitudinal;
        pts.push(new THREE.Vector3(-w/2,y,z),new THREE.Vector3(w/2,y,z));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.LineSegments(geo,lineMaterial(color,.24));
      group.add(line);
    }
    function wall(x, side, color){
      const pts=[]; const steps=38; const horizontal=13;
      for(let i=0;i<=steps;i++){
        const y=-h/2+h*i/steps;
        pts.push(new THREE.Vector3(x,y,z0),new THREE.Vector3(x,y,z1));
      }
      for(let i=0;i<=horizontal;i++){
        const z=z0+(z1-z0)*i/horizontal;
        pts.push(new THREE.Vector3(x,-h/2,z),new THREE.Vector3(x,h/2,z));
      }
      const geo=new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.LineSegments(geo,lineMaterial(color,.22)));
    }
    gridFloor(-h/2,0,0x423a63);
    gridFloor(h/2,0,0x342b55);
    wall(-w/2,-1,0x343052);
    wall(w/2,1,0x343052);

    // distant neon portal frames
    for(let z=-40; z>-650; z-=40){
      const pts=[
        new THREE.Vector3(-w/2,-h/2,z),new THREE.Vector3(w/2,-h/2,z),
        new THREE.Vector3(w/2,h/2,z),new THREE.Vector3(-w/2,h/2,z),
        new THREE.Vector3(-w/2,-h/2,z)
      ];
      const geo=new THREE.BufferGeometry().setFromPoints(pts);
      const mat=lineMaterial(z%80===0?0x7a2b92:0x283c72,.12);
      group.add(new THREE.Line(geo,mat));
    }
    world.add(group);
  }

  function canvasTexture(text, opts={}) {
    const scale=3;
    const fontSize=opts.fontSize||64;
    const font = `${opts.weight||700} ${fontSize}px ${opts.font||'Orbitron'}`;
    const c=document.createElement('canvas');
    const ctx=c.getContext('2d');
    ctx.font=font;
    const width=Math.ceil(ctx.measureText(text).width)+80;
    const height=fontSize*1.55+50;
    c.width=width*scale; c.height=height*scale;
    const x=ctx;
    x.scale(scale,scale);
    x.font=font;
    x.textAlign='center'; x.textBaseline='middle';
    x.shadowBlur=opts.glow||18;
    x.shadowColor=opts.color||'#ff2ab8';
    x.fillStyle=opts.color||'#ffffff';
    x.fillText(text,width/2,height/2);
    if(opts.stroke){
      x.shadowBlur=0;x.lineWidth=2;x.strokeStyle='rgba(255,255,255,.28)';
      x.strokeText(text,width/2,height/2);
    }
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    tex.minFilter=THREE.LinearFilter;
    tex.magFilter=THREE.LinearFilter;
    return {tex, aspect:width/height};
  }

  function makeSprite(text, type='text', isClickable=false) {
    const i = Math.floor(Math.random()*CONFIG.texts.length);
    const color = type==='brand' ? '#ff36c4' : ['#ff58c9','#c777ff','#45f4ff','#ff7192'][i%4];
    const data=canvasTexture(text,{
      fontSize:type==='brand'?92:56,
      weight:900,
      font:type==='brand'?'Orbitron':'Space Grotesk',
      color,
      glow:type==='brand'?28:18,
      stroke:true
    });
    const mat=new THREE.SpriteMaterial({map:data.tex,transparent:true,depthWrite:false,depthTest:true});
    const sprite=new THREE.Sprite(mat);
    const base=type==='brand'?5.2:3.4;
    sprite.scale.set(base*data.aspect,base,1);
    sprite.userData={text,type,link:null,baseScale:base*data.aspect,baseH:base,phase:Math.random()*Math.PI*2, clickable:isClickable};
    if(isClickable) clickable.push(sprite);
    return sprite;
  }

  function placeText(obj,z,forceX=null,forceY=null) {
    const x=forceX ?? rand(-7.8,7.8);
    const y=forceY ?? rand(-4.8,4.8);
    obj.position.set(x,y,z);
    obj.rotation.z=rand(-.18,.18);
  }

  function buildTextObjects() {
    // Один активный текстовый объект. После исчезновения он отправляется
    // далеко в тоннель с НАДПИСЬЮ №2. Так получается последовательный цикл:
    // надпись -> приближение -> пролёт -> исчезновение -> следующая надпись.
    const d = CONFIG.texts[0];
    const obj = makeSprite(d.text, d.type, d.link !== null);
    obj.userData.sequenceIndex = 0;
    obj.userData.text = d.text;
    obj.userData.type = d.type;
    obj.userData.link = d.link;
    obj.userData.baseH = d.type === 'brand' ? 5.2 : 3.4;
    obj.userData.baseScale = obj.userData.baseH;
    obj.userData.active = true;
    obj.userData.kind = 'text';
    obj.userData.exploding = false;
    obj.userData.nextDelay = 0;
    if (!clickable.includes(obj)) clickable.push(obj);
    obj.visible = true;
    placeText(obj, -180, 0, 0);
    world.add(obj);
    textObjects = [obj];
  }

  function emojiSprite(char) {
    const c=document.createElement('canvas'); c.width=180;c.height=180;
    const ctx=c.getContext('2d');ctx.clearRect(0,0,180,180);
    ctx.font='128px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowBlur=20;
    ctx.shadowColor='rgba(255,30,200,.8)';ctx.fillText(char,90,94);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const mat=new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false});
    const s=new THREE.Sprite(mat); s.scale.set(2.2,2.2,1);
    s.userData={phase:Math.random()*6.28,spin:rand(-.7,.7),kind:'emoji',exploding:false};
    clickable.push(s);
    return s;
  }

  function buildEmojis() {
    for(let i=0;i<34;i++){
      const s=emojiSprite(pick(CONFIG.emojis));
      s.position.set(rand(-10,10),rand(-6.5,6.5),-rand(30,520));
      const sc=rand(.55,2.4);s.scale.setScalar(sc);
      world.add(s);emojiObjects.push(s);
    }
  }

  function buildParticles() {
    const count=CONFIG.maxParticles;
    const geo=new THREE.BufferGeometry();
    const pos=new Float32Array(count*3);
    const size=new Float32Array(count);
    for(let i=0;i<count;i++){
      pos[i*3]=rand(-14,14);pos[i*3+1]=rand(-9,9);pos[i*3+2]=rand(-520,12);
      size[i]=rand(.3,1.6);
    }
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const mat=new THREE.PointsMaterial({color:0xd65cff,size:.055,transparent:true,opacity:.75,sizeAttenuation:true});
    const points=new THREE.Points(geo,mat);world.add(points);particles={points,geo,pos};
  }

  function updateParticles(dt) {
    const p=particles.pos;
    for(let i=0;i<CONFIG.maxParticles;i++){
      p[i*3+2]+=CONFIG.speed*speedBoost*dt*(1.5+((i%7)/7));
      if(p[i*3+2]>camera.position.z+8){
        p[i*3]=rand(-14,14);p[i*3+1]=rand(-9,9);p[i*3+2]=camera.position.z+CONFIG.farZ+rand(-80,20);
      }
    }
    particles.geo.attributes.position.needsUpdate=true;
  }



  function ensureAudio(){
    if(!audioCtx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(AC) audioCtx=new AC();
    }
    if(audioCtx && audioCtx.state==='suspended') audioCtx.resume();
  }

  function playExplosionSound(){
    ensureAudio();
    if(!audioCtx)return;

    const now=audioCtx.currentTime;
    const master=audioCtx.createGain();
    master.gain.setValueAtTime(.0001,now);
    master.gain.exponentialRampToValueAtTime(.28,now+.012);
    master.gain.exponentialRampToValueAtTime(.0001,now+.48);
    master.connect(audioCtx.destination);

    const osc=audioCtx.createOscillator();
    osc.type='sawtooth';
    osc.frequency.setValueAtTime(115,now);
    osc.frequency.exponentialRampToValueAtTime(42,now+.32);
    osc.connect(master);
    osc.start(now);
    osc.stop(now+.34);

    const buffer=audioCtx.createBuffer(1,audioCtx.sampleRate*.32,audioCtx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++) data[i]=(Math.random()*2-1)*(1-i/data.length);
    const noise=audioCtx.createBufferSource();
    noise.buffer=buffer;
    const filter=audioCtx.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.setValueAtTime(1800,now);
    filter.frequency.exponentialRampToValueAtTime(180,now+.3);
    const ng=audioCtx.createGain();
    ng.gain.setValueAtTime(.0001,now);
    ng.gain.exponentialRampToValueAtTime(.5,now+.008);
    ng.gain.exponentialRampToValueAtTime(.0001,now+.32);
    noise.connect(filter); filter.connect(ng); ng.connect(audioCtx.destination);
    noise.start(now);
  }

  function explodeObject(obj, options={}) {
    if (!obj || !obj.visible || obj.userData.exploding) return false;

    const dist = Math.abs(obj.position.z - camera.position.z);
    if (dist > PROXIMITY_DISTANCE) {
      showToast('ПОДОЖДИ, ОБЪЕКТ ЕЩЁ ДАЛЕКО');
      return false;
    }

    obj.userData.exploding = true;

    const count = options.count || 54;
    const color = options.color || 0xff36c4;
    const group = new THREE.Group();
    group.position.copy(obj.position);
    world.add(group);

    for (let i = 0; i < count; i++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0], 3));
      const m = new THREE.PointsMaterial({
        color: i % 3 === 0 ? 0xffffff : color,
        size: rand(.035, .12),
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const p = new THREE.Points(g, m);
      p.userData.velocity = new THREE.Vector3(
        rand(-1,1), rand(-1,1), rand(-1,1)
      ).normalize().multiplyScalar(rand(6, 16));
      group.add(p);
    }

    bursts.push({group, age: 0});
    obj.visible = false;

    if (obj.userData.kind === 'emoji') {
      setTimeout(() => recycleEmoji(obj), 180);
    } else if (obj.userData.kind === 'text') {
      advanceTextAfterExplosion(obj);
    }

    explosionScore++;
    updateExplosionScore();
    playExplosionSound();
    showMotivation();
    showToast('BOOM ✦');
    return true;
  }

  function advanceTextAfterExplosion(o) {
    const nextIndex = (o.userData.sequenceIndex + 1) % CONFIG.texts.length;
    const d = CONFIG.texts[nextIndex];

    const data = canvasTexture(d.text, {
      fontSize: d.type === 'brand' ? 92 : 56,
      weight: 900,
      font: d.type === 'brand' ? 'Orbitron' : 'Space Grotesk',
      color: d.type === 'brand'
        ? '#ff36c4'
        : pick(['#ff58c9', '#c777ff', '#45f4ff', '#ff7192']),
      glow: d.type === 'brand' ? 28 : 18,
      stroke: true
    });

    o.material.map = data.tex;
    o.material.map.needsUpdate = true;
    o.userData.sequenceIndex = nextIndex;
    o.userData.text = d.text;
    o.userData.type = d.type;
    o.userData.link = d.link;
    o.userData.baseH = d.type === 'brand' ? 5.2 : 3.4;
    o.userData.baseScale = o.userData.baseH * data.aspect;
    o.userData.exploding = false;
    o.userData.active = true;
    o.scale.set(o.userData.baseScale, o.userData.baseH, 1);
    placeText(o, -180, rand(-6.5, 6.5), rand(-4.2, 4.2));
    o.visible = true;
  }


  function updateExplosionScore(){
    const el=document.getElementById('explosionScore');
    if(el) el.textContent=String(explosionScore);
  }

  function showMotivation(){
    const lines=[
      'KEEP GOING!',
      'YOU ARE ON FIRE!',
      'ONE MORE!',
      'DON’T STOP!',
      'BREAK YOUR LIMITS!',
      'KEEP PUSHING!',
      'NICE HIT!'
    ];
    const el=document.getElementById('motivation');
    if(!el)return;
    el.textContent=pick(lines);
    el.classList.remove('motivationPop');
    void el.offsetWidth;
    el.classList.add('motivationPop');
  }

  function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.age += dt;
      const k = b.age / BURST_LIFE;

      for (const p of b.group.children) {
        p.position.addScaledVector(p.userData.velocity, dt);
        p.userData.velocity.multiplyScalar(Math.pow(.08, dt));
        p.material.opacity = Math.max(0, 1 - k);
        p.scale.setScalar(1 + k * 3.6);
      }

      if (b.age >= BURST_LIFE) {
        b.group.children.forEach(p => {
          p.geometry.dispose();
          p.material.dispose();
        });
        world.remove(b.group);
        bursts.splice(i, 1);
      }
    }
  }

  function updateTexts(dt) {
    const o = textObjects[0];
    if (!o || !o.userData.active) return;

    o.position.z += CONFIG.speed * speedBoost * dt;
    o.userData.phase = (o.userData.phase || 0) + dt;

    // Лёгкое живое движение, но сама "настоящая" близость создаётся перспективой.
    o.position.x += Math.sin(o.userData.phase * .7) * dt * .05;
    o.position.y += Math.cos(o.userData.phase * .53) * dt * .035;
    o.rotation.z += Math.sin(o.userData.phase) * dt * .018;

    const dist = o.position.z - camera.position.z;
    const proximity = THREE.MathUtils.clamp(1 - (Math.abs(dist) / 105), 0, 1);

    const baseH = o.userData.baseH || 3.4;
    const baseW = o.userData.baseScale || 5;
    const pulse = 1 + Math.sin(o.userData.phase * 2.2) * .025 + proximity * .12;
    const s = baseH * pulse;

    o.scale.y = s;
    o.scale.x = baseW * (s / baseH);

    // Дальше — тусклее, при приближении — ярче.
    o.material.opacity = THREE.MathUtils.lerp(.16, 1, proximity + .15);

    // Когда текущая надпись полностью прошла камеру,
    // она исчезает и только после этого получает следующую надпись.
    if (o.position.z > camera.position.z + 12) {
      o.visible = false;
      advanceTextAfterExplosion(o);
    }
  }

  function updateEmojis(dt) {
    for(const s of emojiObjects){
      if (s.userData.exploding) continue;

      s.position.z += CONFIG.speed * speedBoost * dt * (.85 + Math.random()*.02);
      s.userData.phase += dt;
      s.position.x += Math.sin(s.userData.phase) * dt * .18;
      s.position.y += Math.cos(s.userData.phase*.8) * dt * .12;
      s.rotation.z += s.userData.spin * dt * .45;

      const pulse=1+Math.sin(s.userData.phase*1.8)*.06;
      s.scale.multiplyScalar(1 + (pulse-1)*.02);

      if(s.position.z>CONFIG.recycleZ) recycleEmoji(s);
    }
  }

  function recycleEmoji(s) {
    const next = emojiSprite(pick(CONFIG.emojis));
    s.position.set(rand(-10,10),rand(-6.5,6.5),CONFIG.farZ-rand(0,120));
    s.material.map.dispose();
    s.material.map=next.material.map;
    s.material.needsUpdate=true;
    s.visible=true;
    s.userData.exploding=false;
    s.userData.phase=Math.random()*6.28;
  }

  function animate(){
    requestAnimationFrame(animate);
    if(!renderer||!running||paused)return;
    const dt=Math.min(clock.getDelta(),.033);
    elapsed+=dt;
    const dynamicSpeed=CONFIG.speed*(1+Math.sin(elapsed*.45)*.08);
    speedBoost=THREE.MathUtils.lerp(speedBoost,1,.04);

    // Камера остаётся в точке наблюдения, а пространство движется НА НЕЁ.
    // Поэтому каждый объект гарантированно приближается, а не удаляется.
    camera.position.z = 0;
    targetX=pointerX*2.5; targetY=pointerY*1.5;
    camera.position.x=THREE.MathUtils.lerp(camera.position.x,targetX,.035);
    camera.position.y=THREE.MathUtils.lerp(camera.position.y,targetY,.035);
    camera.rotation.z=THREE.MathUtils.lerp(camera.rotation.z,-pointerX*.025,.035);
    camera.rotation.x=THREE.MathUtils.lerp(camera.rotation.x,pointerY*.02,.035);

    updateTexts(dt);
    updateEmojis(dt);
    updateParticles(dt);
    updateBursts(dt);

    renderer.render(world,camera);
  }

  function resize(){
    if(!renderer)return;
    const w=sceneHost.clientWidth,h=sceneHost.clientHeight;
    renderer.setSize(w,h,false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,CONFIG.dprMax));
    camera.aspect=w/h;camera.updateProjectionMatrix();
  }

  function start(){
    if(!renderer)setup();
    running=true;paused=false;clock.start();
    startScreen.classList.add('hide');hud.classList.remove('hidden');
    showToast('TAP / SWIPE TO MOVE');
  }

  function restart(){
    if(!running)return;
    camera.position.set(0,0,0);
    elapsed=0;
    const o = textObjects[0];
    if (o) {
      const d = CONFIG.texts[0];
      o.userData.sequenceIndex = 0;
      o.userData.text = d.text;
      o.userData.type = d.type;
      o.userData.link = d.link;
      o.userData.active = true;
      o.userData.kind = 'text';
      o.userData.exploding = false;
      o.visible = true;
      placeText(o, -180, 0, 0);
    }
    emojiObjects.forEach(s=>s.position.z=rand(-520,-30));
  }

  function togglePause(){
    paused=!paused;
    pauseBtn.textContent=paused?'▶':'Ⅱ';
    if(!paused)clock.start();
  }

  function showToast(t){
    toast.textContent=t;toast.classList.add('show');
    clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toast.classList.remove('show'),1700);
  }

  function onPointerMove(e){
    const r=renderer.domElement.getBoundingClientRect();
    pointerX=((e.clientX-r.left)/r.width-.5)*2;
    pointerY=-((e.clientY-r.top)/r.height-.5)*2;
    if(touchActive){
      const dx=e.clientX-touchStartX,dy=e.clientY-touchStartY;
      if(Math.abs(dx)>20) pointerX=THREE.MathUtils.clamp(dx/r.width*2,-1,1);
      if(Math.abs(dy)>20) pointerY=THREE.MathUtils.clamp(-dy/r.height*2,-1,1);
    }
  }
  function onPointerDown(e){
    touchActive=true;touchStartX=e.clientX;touchStartY=e.clientY;
  }
  function onPointerUp(e){
    if(Math.abs(e.clientY-touchStartY)>55){
      speedBoost=e.clientY<touchStartY?1.45:.7;
      showToast(e.clientY<touchStartY?'SPEED UP':'SLOW DOWN');
    }
    touchActive=false;
  }
  function onClick(e){
    ensureAudio();
    if(!running || paused)return;

    const rect=renderer.domElement.getBoundingClientRect();
    const mouse=new THREE.Vector2(
      ((e.clientX-rect.left)/rect.width)*2-1,
      -((e.clientY-rect.top)/rect.height)*2+1
    );

    const ray=new THREE.Raycaster();
    ray.setFromCamera(mouse,camera);

    const targets=clickable.filter(o=>o && o.visible && !o.userData.exploding);
    const hits=ray.intersectObjects(targets,false);
    if(!hits.length)return;

    const obj=hits[0].object;
    if(obj.userData.kind==='text'){
      explodeObject(obj,{count:44,color:0xff36c4});
    }else if(obj.userData.kind==='emoji'){
      explodeObject(obj,{count:26,color:0xff7adf});
    }
  }

  startBtn.addEventListener('click',start);
  pauseBtn.addEventListener('click',togglePause);
  restartBtn.addEventListener('click',restart);
  musicBtn.addEventListener('click',()=>{
    if(!music.src){
      showToast('ДОБАВЬ music.mp3 В ПАПКУ ПРОЕКТА');
      return;
    }
    if(music.paused){music.play();musicBtn.textContent='♫'}else{music.pause();musicBtn.textContent='♪'}
  });

  // Optional local music: place music.mp3 next to index.html.
  music.src='music.mp3';
  setup();
  animate();
})();
