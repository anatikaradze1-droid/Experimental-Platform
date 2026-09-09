(() => {
  const app=document.getElementById("runnerApp"), params=new URLSearchParams(location.search);
  const slug=params.get("exp"); let exp,cfg,session,pxPerMm=1,globalTrial=0,rows=[];
  let asymmetry="none",setLargeSide=null,control={left:0,equal:0,right:0,missing:0};
  const show=html=>app.innerHTML=`<section class="runner-page"><div class="runner-card">${html}</div></section>`;
  const deviceType=()=>/Mobi|iPhone|Android/i.test(navigator.userAgent)?"phone":matchMedia("(pointer:coarse)").matches?"tablet":"desktop";
  async function init(){
    if(!slug)return show("<h2>Experiment not specified</h2>");
    exp=await DB.getExperimentBySlug(slug);if(!exp)return show("<h2>Experiment unavailable</h2>");
    cfg=exp.config||{}; intro();
  }
  function intro(){show(`<h2>${exp.name}</h2><p>${exp.description||""}</p><div class="field"><label>Participant code</label><input id="pid"></div><button id="go" class="btn primary">გაგრძელება</button>`);go.onclick=()=>pid.value.trim()&&(cfg.calibration?calibrate(pid.value.trim()):startSession(pid.value.trim()))}
  function calibrate(pidv){show(`<h2>Screen calibration</h2><p>მოარგე მართკუთხედი სტანდარტული საბანკო/ID ბარათის სიგანეს (85.60 mm).</p><div id="cc" class="cal-card"></div><input id="slider" type="range" min="140" max="700" value="320"><p id="read" class="muted"></p><button id="done" class="btn primary">ემთხვევა — გაგრძელება</button>`);
    const upd=()=>{cc.style.width=slider.value+"px";cc.style.height=(+slider.value*53.98/85.60)+"px";read.textContent=(+slider.value/85.60).toFixed(3)+" px/mm"};slider.oninput=upd;upd();done.onclick=()=>{pxPerMm=+slider.value/85.60;startSession(pidv)}}
  async function startSession(pidv){session=await DB.createSession({experiment_id:exp.id,experiment_version:exp.version,participant_code:pidv,device_type:deviceType(),calibration_px_per_mm:pxPerMm,viewport_width:innerWidth,viewport_height:innerHeight,user_agent:navigator.userAgent});instructions()}
  function instructions(){
    const rs=cfg.responses||[];show(`<h2>ინსტრუქცია</h2><p>${exp.description||"უპასუხეთ წარმოდგენილ სტიმულებს."}</p><div class="grid three">${rs.map(r=>`<div class="card"><b>${r.key}</b><br>${r.label}</div>`).join("")}</div><br><button id="start" class="btn primary">დაწყება</button>`);start.onclick=run}
  function fixation(layer){const mm=cfg.fixed_set?.fixation_mm||4;layer.innerHTML=`<div class="fixation" style="width:${mm*pxPerMm}px;height:${mm*pxPerMm}px"></div>`}
  function renderUploaded(layer,asset){
    if(!asset){fixation(layer);return}
    const u=asset.url||"",t=asset.type||"";
    if(t.startsWith("image/"))layer.innerHTML=`<img src="${u}" style="max-width:90vw;max-height:80vh;object-fit:contain">`;
    else if(t.startsWith("video/"))layer.innerHTML=`<video id="mediaStim" src="${u}" autoplay playsinline style="max-width:90vw;max-height:80vh"></video>`;
    else if(t.startsWith("audio/")){layer.innerHTML=`<audio id="mediaStim" src="${u}" autoplay></audio><div class="fixation" style="width:4px;height:4px"></div>`}
    else layer.textContent=asset.name||"Stimulus";
  }
  function renderFixed(layer,mode){
    const f=cfg.fixed_set||{},sm=f.small_mm||40,md=f.medium_mm||60,lg=f.large_mm||80,gap=f.gap_mm||15,fix=f.fixation_mm||4;
    let l=md,r=md;if(mode==="fixed_set_induction"){l=setLargeSide==="left"?lg:sm;r=setLargeSide==="right"?lg:sm}
    layer.innerHTML=`<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${fix*pxPerMm}px;height:${fix*pxPerMm}px;border-radius:50%;background:#e00000"></div>
      <div style="position:absolute;right:calc(50% + ${gap*pxPerMm}px);top:50%;transform:translateY(-50%);width:${l*pxPerMm}px;height:${l*pxPerMm}px;border-radius:50%;background:#000"></div>
      <div style="position:absolute;left:calc(50% + ${gap*pxPerMm}px);top:50%;transform:translateY(-50%);width:${r*pxPerMm}px;height:${r*pxPerMm}px;border-radius:50%;background:#000"></div>`;
    return [l,r];
  }
  async function trial(block,n){
    app.innerHTML=`<section class="exp-screen"><div class="stimulus-layer" id="layer"></div><div class="mobile-response">${(cfg.responses||[]).map(r=>`<button data-key="${r.key}">${r.key} — ${r.label}</button>`).join("")}</div></section>`;
    const layer=document.getElementById("layer"), asset=(block.stimuli||[]).length?block.stimuli[(n-1)%block.stimuli.length]:null;
    let vals=[null,null]; if((block.mode||"uploaded").startsWith("fixed_set"))vals=renderFixed(layer,block.mode);else renderUploaded(layer,asset);
    const onset=performance.now(),deadline=(block.exposure_ms||1000)+(block.isi_ms||0);let responseKey="",rt=null;
    return new Promise(resolve=>{
      const valid=new Set((cfg.responses||[]).map(r=>r.key));
      const accept=k=>{if(responseKey||!valid.has(k))return;responseKey=k;rt=performance.now()-onset};
      const kh=e=>{if(valid.has(e.key)){e.preventDefault();accept(e.key)}};addEventListener("keydown",kh,{passive:false});
      document.querySelectorAll("[data-key]").forEach(b=>b.onpointerdown=e=>{e.preventDefault();accept(b.dataset.key)});
      setTimeout(()=>{fixation(layer);const m=document.getElementById("mediaStim");if(m)m.pause?.()},block.exposure_ms||1000);
      setTimeout(async()=>{removeEventListener("keydown",kh);globalTrial++;
        const label=(cfg.responses||[]).find(r=>r.key===responseKey)?.label||"";
        const semantic=cfg.template==="fixed_set"?({"1":"left","2":"equal","3":"right"}[responseKey]||"missing"):(responseKey?label:"missing");
        const row={experiment_id:exp.id,experiment_version:exp.version,session_id:session.id,participant_code:session.participant_code,
          series:block.name,global_trial:globalTrial,series_trial:n,stimulus_type:asset?.type||block.mode||"uploaded",
          stimulus_1:asset?.name||"",stimulus_2:"",left_value:vals[0],right_value:vals[1],
          response:semantic,response_key:responseKey,rt_ms:rt==null?null:+rt.toFixed(2),missing:!responseKey,
          set_large_side:setLargeSide,asymmetry_side:asymmetry,viewport_width:innerWidth,viewport_height:innerHeight};
        rows.push(row);if(block.save!==false)try{await DB.insertTrial(row)}catch(e){console.error(e)}resolve(row)},deadline);
    });
  }
  async function run(){
    for(const block of (cfg.blocks||[])){
      let streak=0;
      for(let i=1;i<=Math.max(1,+block.trials||1);i++){
        const r=await trial(block,i);
        if(cfg.template==="fixed_set"&&block.mode==="fixed_set_control"){control[r.response]=(control[r.response]||0)+1;if(i===block.trials)determineAsymmetry()}
        if(block.stop_rule?.type==="consecutive_response"){streak=r.response_key===block.stop_rule.key?streak+1:0;if(streak>=block.stop_rule.count)break}
      }
      if(block.break_after_ms>0)await breakPage(block.break_after_ms);
    } finish();
  }
  function determineAsymmetry(){const L=control.left||0,R=control.right||0,err=L+R,t=cfg.fixed_set?.asymmetry_threshold??.70;if(err&&L/err>t){asymmetry="left";setLargeSide="left"}else if(err&&R/err>t){asymmetry="right";setLargeSide="right"}else{asymmetry="none";setLargeSide=(session.participant_code.charCodeAt(0)%2)?"left":"right"}}
  function breakPage(ms){return new Promise(resolve=>{const end=Date.now()+ms;show(`<h2>შუალედი</h2><div class="countdown" id="tm"></div><button id="resume" class="btn primary" disabled>გაგრძელება</button>`);const t=setInterval(()=>{const s=Math.ceil(Math.max(0,end-Date.now())/1000);tm.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;if(s<=0){clearInterval(t);resume.disabled=false}},250);resume.onclick=resolve})}
  async function finish(){
    const summary={validity_status:"valid",asymmetry_side:asymmetry,set_large_side:setLargeSide};
    if(cfg.template==="fixed_set"){const crit=rows.filter(r=>(r.series||"").toLowerCase()==="critical");const streakN=cfg.blocks?.find(b=>b.mode==="fixed_set_critical")?.stop_rule?.count||10;let st=0,max=0;for(const r of crit){st=r.response_key==="2"?st+1:0;max=Math.max(max,st)}summary.critical_trials=crit.length;summary.extinguished=max>=streakN}
    try{await DB.finishSession(session.id,summary)}catch(e){console.error(e)}show("<h2>ექსპერიმენტი დასრულდა</h2><p>გმადლობთ მონაწილეობისთვის.</p>")
  }
  init().catch(e=>show(`<h2>Error</h2><p>${e.message}</p>`));
})();