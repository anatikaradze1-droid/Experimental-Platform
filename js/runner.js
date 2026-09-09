(() => {
  const app=document.getElementById("runnerApp");
  const params=new URLSearchParams(location.search);
  const slug=params.get("exp")||(params.get("demo")==="circles"?"circles-standard":null);
  let exp=null, cfg=null, pxPerMm=null, session=null, globalTrial=0;
  let control={left:0,equal:0,right:0,missing:0};
  let asymmetry="none",setLargeSide=null,criticalStreak=0;
  const rows=[];

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function show(html){app.innerHTML=`<section class="runner-page"><div class="runner-card">${html}</div></section>`}
  function deviceType(){
    const coarse=matchMedia("(pointer:coarse)").matches;
    if(/iPad|Tablet|Android(?!.*Mobile)/i.test(navigator.userAgent))return"tablet";
    if(/Mobi|iPhone|Android/i.test(navigator.userAgent)||coarse)return"phone";
    return"desktop";
  }
  async function init(){
    if(!slug)return show(`<h2>Experiment not specified</h2><p>Participant link-ში საჭიროა experiment slug.</p>`);
    exp=await DB.getExperimentBySlug(slug);
    if(!exp)return show(`<h2>Experiment unavailable</h2><p>ეს ექსპერიმენტი ვერ მოიძებნა ან არ არის გამოქვეყნებული.</p>`);
    cfg=exp.config;
    intro();
  }
  function intro(){
    show(`<h2>${exp.name}</h2><p>${exp.description||""}</p>
      <div class="field"><label>Participant code</label><input id="pid" autocomplete="off"></div>
      <button id="go" class="btn primary">გაგრძელება</button>`);
    go.onclick=()=>{if(!pid.value.trim())return;calibration(pid.value.trim())}
  }
  function calibration(pid){
    show(`<h2>Screen calibration</h2>
      <p>სტანდარტული საბანკო/ID ბარათის სიგანე მოარგეთ ეკრანზე გამოსახულ მართკუთხედს.</p>
      <div id="cc" class="cal-card"></div>
      <input id="slider" type="range" min="140" max="700" value="320">
      <p id="read" class="muted"></p>
      <button id="done" class="btn primary">ემთხვევა — გაგრძელება</button>`);
    function upd(){cc.style.width=slider.value+"px";cc.style.height=(+slider.value*53.98/85.60)+"px";read.textContent=`${(+slider.value/85.60).toFixed(3)} px/mm`}
    slider.oninput=upd;upd();
    done.onclick=async()=>{
      pxPerMm=+slider.value/85.60;
      session=await DB.createSession({
        experiment_id:exp.id,experiment_version:exp.version,participant_code:pid,
        device_type:deviceType(),calibration_px_per_mm:pxPerMm,
        viewport_width:innerWidth,viewport_height:innerHeight,user_agent:navigator.userAgent
      });
      instructions();
    };
  }
  function instructions(){
    show(`<h2>ინსტრუქცია</h2>
      <p>შეადარეთ ორი სტიმულის ზომა. უყურეთ წითელ საფიქსაციო წერტილს.</p>
      <div class="grid three">
        <div class="card"><b>1</b><br>მარცხენა დიდია</div>
        <div class="card"><b>2</b><br>ტოლია</div>
        <div class="card"><b>3</b><br>მარჯვენა დიდია</div>
      </div><br><button id="start" class="btn primary">დაწყება</button>`);
    start.onclick=run;
  }
  function fixation(layer){
    layer.innerHTML=`<div class="fixation" style="width:${cfg.fixation_mm*pxPerMm}px;height:${cfg.fixation_mm*pxPerMm}px"></div>`;
  }
  async function trial(series,n,left,right,save=true){
    app.innerHTML=`<section class="exp-screen"><div class="stimulus-layer" id="layer"></div>
      <div class="mobile-response"><button data-r="left">1 — მარცხენა</button><button data-r="equal">2 — ტოლია</button><button data-r="right">3 — მარჯვენა</button></div></section>`;
    const layer=document.getElementById("layer");
    if(exp.stimulus_type==="audio"){
      fixation(layer);
      // Audio parameters are scaffolded but circle/line are the validated runnable templates in v2.
    }else{
      Stimuli[exp.stimulus_type].render(layer,{leftMm:left,rightMm:right,config:cfg,pxPerMm});
    }
    const onset=performance.now(), deadline=cfg.exposure_ms+cfg.isi_ms;
    let response=null,rt=null;
    return new Promise(resolve=>{
      const accept=r=>{if(response)return;response=r;rt=performance.now()-onset};
      const kh=e=>{const m={"1":"left","2":"equal","3":"right"};if(m[e.key]){e.preventDefault();accept(m[e.key])}};
      addEventListener("keydown",kh,{passive:false});
      document.querySelectorAll("[data-r]").forEach(b=>b.onpointerdown=e=>{e.preventDefault();accept(b.dataset.r)});
      setTimeout(()=>fixation(layer),cfg.exposure_ms);
      setTimeout(async()=>{
        removeEventListener("keydown",kh);globalTrial++;
        const row={
          experiment_id:exp.id,experiment_version:exp.version,session_id:session.id,
          participant_code:session.participant_code,series,global_trial:globalTrial,series_trial:n,
          stimulus_type:exp.stimulus_type,left_value:left,right_value:right,
          response:response||"missing",response_key:response==="left"?"1":response==="equal"?"2":response==="right"?"3":"",
          rt_ms:rt==null?null:+rt.toFixed(2),missing:response?false:true,
          set_large_side:setLargeSide,asymmetry_side:asymmetry,
          viewport_width:innerWidth,viewport_height:innerHeight
        };
        rows.push(row);
        if(save)try{await DB.insertTrial(row)}catch(e){console.error(e)}
        resolve(row);
      },deadline);
    });
  }
  async function run(){
    for(let i=1;i<=cfg.practice_trials;i++)await trial("practice",i,cfg.medium_mm,cfg.medium_mm,false);
    for(let i=1;i<=cfg.control_trials;i++){
      const r=await trial("control",i,cfg.medium_mm,cfg.medium_mm);
      control[r.response]=(control[r.response]||0)+1;
    }
    determineAsymmetry();
    await breakPage();
    for(let i=1;i<=cfg.set_trials;i++){
      await trial("set",i,setLargeSide==="left"?cfg.large_mm:cfg.small_mm,setLargeSide==="right"?cfg.large_mm:cfg.small_mm);
    }
    // Critical starts immediately, with no transition screen.
    if(cfg.critical_mode==="fixed"){
      for(let i=1;i<=cfg.critical_max;i++)await criticalTrial(i);
    }else{
      let i=0;while(i<cfg.critical_max&&criticalStreak<cfg.extinction_equal_streak){i++;await criticalTrial(i)}
    }
    finish();
  }
  function determineAsymmetry(){
    const L=control.left||0,R=control.right||0,err=L+R;
    if(err&&L/err>.70){asymmetry="left";setLargeSide="left"}
    else if(err&&R/err>.70){asymmetry="right";setLargeSide="right"}
    else{asymmetry="none";setLargeSide=(session.participant_code.charCodeAt(0)%2)?"left":"right"}
  }
  function breakPage(){
    return new Promise(resolve=>{
      const end=Date.now()+cfg.break_ms;
      show(`<h2>შუალედი</h2><p>ამ პერიოდში არ უყუროთ ექსპერიმენტულ სტიმულებს.</p><div class="countdown" id="tm"></div><button id="resume" class="btn primary" disabled>გაგრძელება</button>`);
      const t=setInterval(()=>{const x=Math.max(0,end-Date.now()),s=Math.ceil(x/1000);tm.textContent=`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;if(!x){clearInterval(t);resume.disabled=false}},250);
      resume.onclick=resolve;
    });
  }
  async function criticalTrial(i){
    const r=await trial("critical",i,cfg.medium_mm,cfg.medium_mm);
    criticalStreak=r.response==="equal"?criticalStreak+1:0;
  }
  async function finish(){
    const crit=rows.filter(x=>x.series==="critical");
    const missingControl=(control.missing||0)/cfg.control_trials;
    const missingCrit=crit.length?crit.filter(x=>x.missing).length/crit.length:0;
    const valid=missingControl<=.20&&missingCrit<=.20;
    try{
      await DB.finishSession(session.id,{
        validity_status:valid?"valid":"invalid",
        asymmetry_side:asymmetry,set_large_side:setLargeSide,
        critical_trials:crit.length,extinguished:criticalStreak>=cfg.extinction_equal_streak
      });
    }catch(e){console.error(e)}
    show(`<h2>ექსპერიმენტი დასრულდა</h2><p>გმადლობთ მონაწილეობისთვის.</p>`);
  }
  init().catch(e=>show(`<h2>Error</h2><p>${e.message}</p>`));
})();