// ===== Timing & Config =====
const DURATION = { coverMs: 2000, drawMs: 5000, fadeMs: 800 };
const TIER_WEIGHTS = { "超大吉":1, "大吉":1, "吉":1, "小吉":1, "末吉":1, "凶":1 };
const SHARE = { siteTitle:"文鳥おみくじ", siteUrl: location.origin + location.pathname, hashtags:["文鳥おみくじ","dotfinch"] };

const els = {
  cover: document.getElementById('scene-cover'),
  draw: document.getElementById('scene-draw'),
  result: document.getElementById('scene-result'),
  date: document.getElementById('res-date'),
  tier: document.getElementById('res-tier'),
  name: document.getElementById('res-name'),
  image: document.getElementById('res-image'),
  message: document.getElementById('res-message'),
  err: document.getElementById('error-bar'),
  btnShare: document.getElementById('btn-share'),
  shareDialog: document.getElementById('share-dialog'),
  igDialog: document.getElementById('ig-dialog'),
};

window.addEventListener('load', async () => {
  fix100vh();
  try {
    await runFlow();
  } catch (e) {
    showError("読み込みに失敗しました。通信環境をご確認ください。");
    console.error(e);
  }
});

function fix100vh(){
  const set = () => document.documentElement.style.setProperty('--vh', `${window.innerHeight/100}px`);
  set(); window.addEventListener('resize', set);
}
function showScene(target){
  [els.cover, els.draw, els.result].forEach(s => s.classList.toggle('visible', s===target));
}
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
function showError(msg){ els.err.textContent=msg; els.err.hidden=false; setTimeout(()=>els.err.hidden=true, 6000); }

async function runFlow(){
  showScene(els.cover); await sleep(DURATION.coverMs);
  showScene(els.draw);  await sleep(DURATION.drawMs);
  const result = await drawFortune();
  renderResult(result);
  setupShareUI(result).catch(console.error);
  showScene(els.result);
}

async function fetchFortunes(){
  const res = await fetch('data/fortunes.json', { cache:'no-store' });
  if (!res.ok) throw new Error('fortunes.json load failed');
  return await res.json();
}
async function drawFortune(){
  const data = await fetchFortunes();
  const tiers = Object.keys(TIER_WEIGHTS).filter(t => data[t]);
  const bag = [];
  tiers.forEach(t => { const w = Math.max(0, Number(TIER_WEIGHTS[t]||0)); for (let i=0;i<w;i++) bag.push(t); });
  const tier = bag[Math.floor(Math.random()*bag.length)] || tiers[0];
  const list = Array.isArray(data[tier]) ? data[tier] : [];
  const entry = list.length ? list[Math.floor(Math.random()*list.length)] : null;
  return {
    date: new Date(),
    tier,
    name: entry?.name || "（未設定：〇〇文鳥）",
    img:  (entry?.images?.length ? entry.images[Math.floor(Math.random()*entry.images.length)] : "assets/result-fallback.png"),
    message: (entry?.messages?.length ? entry.messages[Math.floor(Math.random()*entry.messages.length)] : "データ未登録です。fortunes.json を編集してください。"),
  };
}
function renderResult(res){
  const y=res.date.getFullYear(), m=String(res.date.getMonth()+1).padStart(2,'0'), d=String(res.date.getDate()).padStart(2,'0');
  els.date.textContent = `${y}/${m}/${d}`;
  els.tier.textContent = res.tier;
  els.name.textContent = res.name;
  els.message.textContent = res.message;
  els.image.src = res.img;
  els.image.onerror = ()=> showError("画像の読み込みに失敗しました。パスを確認してください。");
}

// ---- Share (single entry point with chooser) ----
async function setupShareUI(res){
  // Compose image once
  const canvas = await composeShareImage(res, 1080, 1350);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png', 0.92));
  const file = new File([blob], `buncho_omikuji_${Date.now()}.png`, { type:'image/png' });

  els.btnShare.onclick = () => {
    els.shareDialog.showModal();
  };

  els.shareDialog.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');

    const text = `${res.tier}｜${res.name}\n${res.message}\n\n${SHARE.siteTitle}\n${SHARE.siteUrl}`;

    if (action === 'system') {
      try {
        if (navigator.canShare && navigator.canShare({ files:[file] })) {
          await navigator.share({ files:[file], text, title: SHARE.siteTitle });
        } else if (navigator.share) {
          await navigator.share({ text, url: SHARE.siteUrl, title: SHARE.siteTitle });
        } else {
          showError("この端末では共有パネルが使えません。X または LINE をお使いください。");
        }
      } catch (err) { /* user canceled */ }
      els.shareDialog.close();
    }
    else if (action === 'x') {
      const xText = encodeURIComponent(`${res.tier}｜${res.name}\n${res.message}\n\n${SHARE.siteTitle}`);
      const xTags = encodeURIComponent(SHARE.hashtags.join(' '));
      const url = `https://twitter.com/intent/tweet?text=${xText}&url=${encodeURIComponent(SHARE.siteUrl)}&hashtags=${xTags}`;
      window.open(url, '_blank', 'noopener');
      els.shareDialog.close();
    }
    else if (action === 'line') {
      const lineText = encodeURIComponent(`${res.tier}｜${res.name}\n${res.message}\n${SHARE.siteUrl}`);
      const url = `https://line.me/R/msg/text/?${lineText}`;
      window.open(url, '_blank', 'noopener');
      els.shareDialog.close();
    }
    else if (action === 'instagram') {
      els.igDialog.showModal();
      els.shareDialog.close();
    }
  });
}

async function composeShareImage(res, w, h){
  const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
  const ctx = canvas.getContext('2d');

  // bg
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,w,h);

  // load image
  const img = await loadImage(res.img);

  const pad = 56;
  ctx.fillStyle = '#111';
  ctx.font = '28px "Noto Sans JP", system-ui, sans-serif';
  ctx.fillText(formatDate(res.date), pad, pad+10);
  ctx.font = 'bold 72px "Noto Sans JP", system-ui, sans-serif';
  ctx.fillText(res.tier, pad, pad+10+86);
  ctx.font = '32px "Noto Sans JP", system-ui, sans-serif';
  ctx.fillStyle = '#666';
  ctx.fillText(res.name, pad, pad+10+86+40);

  const imgTop = pad+10+86+40+24;
  const imgSize = Math.min(w - pad*2, h * 0.45);
  drawContainImage(ctx, img, pad, imgTop, imgSize, imgSize);

  const msgTop = imgTop + imgSize + 32;
  ctx.fillStyle = '#111';
  ctx.font = '28px "Noto Sans JP", system-ui, sans-serif';
  wrapText(ctx, res.message, pad, msgTop, w - pad*2, 36);

  ctx.fillStyle = '#888';
  ctx.font = '24px "Noto Sans JP", system-ui, sans-serif';
  ctx.fillText(SHARE.siteUrl, pad, h - pad);

  return canvas;
}

function formatDate(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}/${m}/${day}`; }
function loadImage(src){ return new Promise((resolve,reject)=>{ const i=new Image(); i.crossOrigin="anonymous"; i.onload=()=>resolve(i); i.onerror=reject; i.src=src; }); }
function drawContainImage(ctx, img, x, y, w, h){
  const ir = img.width/img.height, r=w/h;
  let dw,dh,dx,dy;
  if (ir > r){ dh=h; dw=dh*ir; dx=x+(w-dw)/2; dy=y; } else { dw=w; dh=dw/ir; dx=x; dy=y+(h-dh)/2; }
  ctx.drawImage(img, dx, dy, dw, dh);
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const chars = text.split('');
  let line='', ly=y;
  for (let i=0;i<chars.length;i++){
    const test = line + chars[i];
    if (ctx.measureText(test).width > maxWidth && i>0){ ctx.fillText(line, x, ly); line = chars[i]; ly += lineHeight; }
    else { line = test; }
  }
  if (line) ctx.fillText(line, x, ly);
}
