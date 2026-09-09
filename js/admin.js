(() => {
  const app=document.getElementById("adminApp");
  const badge=document.getElementById("modeBadge");
  const logout=document.getElementById("logoutBtn");
  badge.textContent=DB.demo?"DEMO MODE":"SUPABASE";
  let currentUser=null;
  let active="experiments";

  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slugify=s=>s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"");

  async function init(){
    currentUser=await DB.getUser();
    if(!currentUser && !DB.demo) return renderLogin();
    logout.classList.remove("hidden");
    logout.onclick=async()=>{await DB.signOut();location.reload()};
    renderShell();
    navigate("experiments");
  }

  function renderLogin(){
    app.innerHTML=`<div class="card login">
      <h2>Admin login</h2>
      <p class="muted">შედი მკვლევრის ანგარიშით.</p>
      <div class="field"><label>Email</label><input id="email" type="email"></div>
      <div class="field"><label>Password</label><input id="password" type="password"></div>
      <div id="err" class="alert danger hidden"></div>
      <button id="login" class="btn primary">შესვლა</button>
    </div>`;
    document.getElementById("login").onclick=async()=>{
      try{
        await DB.signIn(email.value,password.value);location.reload();
      }catch(e){err.textContent=e.message;err.classList.remove("hidden")}
    };
  }

  function renderShell(){
    app.innerHTML=`<div class="sidebar-layout">
      <nav class="card nav-card">
        <button data-nav="experiments">Experiments</button>
        <button data-nav="new">+ Create experiment</button>
        <button data-nav="results">Results</button>
        <button data-nav="settings">Setup</button>
      </nav>
      <section id="content"></section>
    </div>`;
    document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
  }

  function setActive(name){
    active=name;
    document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===name));
  }

  async function navigate(name,arg){
    setActive(name);
    if(name==="experiments")return experiments();
    if(name==="new")return builder();
    if(name==="results")return results();
    if(name==="settings")return setup();
    if(name==="edit")return builder(arg);
  }

  async function experiments(){
    const rows=await DB.listExperiments(true);
    const c=document.getElementById("content");
    c.innerHTML=`<div class="section-head"><div><h2>Experiments</h2><div class="muted">შექმენი, დააკოპირე და გამოაქვეყნე ექსპერიმენტები.</div></div>
      <button class="btn primary" id="create">+ Create</button></div>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th>Stimulus</th><th>Version</th><th>Status</th><th>Participant link</th><th></th></tr></thead>
      <tbody>${rows.map(x=>`<tr>
        <td><b>${esc(x.name)}</b><br><span class="muted">${esc(x.slug)}</span></td>
        <td>${esc(x.stimulus_type)}</td><td>v${x.version}</td>
        <td><span class="status ${x.status}">${x.status}</span></td>
        <td>${x.status==="published"?`<a class="code" target="_blank" href="run.html?exp=${encodeURIComponent(x.slug)}">open</a>`:"—"}</td>
        <td><button class="ghost" data-edit="${x.id}">Edit</button><button class="ghost" data-dup="${x.id}">Duplicate</button></td>
      </tr>`).join("")}</tbody></table></div>`;
    create.onclick=()=>navigate("new");
    document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>navigate("edit",b.dataset.edit));
    document.querySelectorAll("[data-dup]").forEach(b=>b.onclick=async()=>{await DB.duplicateExperiment(b.dataset.dup);experiments()});
  }

  async function builder(id=null){
    const all=await DB.listExperiments(true);
    const old=id?all.find(x=>x.id===id):null;
    const cfg=old?.config||{};
    const c=document.getElementById("content");
    c.innerHTML=`<div class="section-head"><div><h2>${old?"Edit":"Create"} experiment</h2>
      <div class="muted">ექსპერიმენტის ლოგიკა და stimulus ერთმანეთისგან დამოუკიდებლად ინახება.</div></div></div>
      <div class="grid two">
        <div class="card">
          <h3>General</h3>
          <div class="field"><label>Name</label><input id="name" value="${esc(old?.name||"")}"></div>
          <div class="field"><label>URL slug</label><input id="slug" value="${esc(old?.slug||"")}"></div>
          <div class="field"><label>Description</label><textarea id="desc">${esc(old?.description||"")}</textarea></div>
          <div class="field"><label>Stimulus type</label><select id="stype">
            <option value="circle" ${old?.stimulus_type==="circle"?"selected":""}>Circles</option>
            <option value="line" ${old?.stimulus_type==="line"?"selected":""}>Vertical lines</option>
            <option value="audio" ${old?.stimulus_type==="audio"?"selected":""}>Auditory tones</option>
          </select></div>
          <div class="field"><label>Status</label><select id="status">
            <option value="draft" ${old?.status==="draft"?"selected":""}>Draft</option>
            <option value="published" ${old?.status==="published"?"selected":""}>Published</option>
            <option value="archived" ${old?.status==="archived"?"selected":""}>Archived</option>
          </select></div>
        </div>

        <div class="card">
          <h3>Protocol</h3>
          <div class="inline-fields">
            <div class="field"><label>Practice</label><input id="practice" type="number" value="${cfg.practice_trials??3}"></div>
            <div class="field"><label>Control</label><input id="control" type="number" value="${cfg.control_trials??15}"></div>
            <div class="field"><label>Set</label><input id="settr" type="number" value="${cfg.set_trials??15}"></div>
          </div>
          <div class="inline-fields">
            <div class="field"><label>Exposure ms</label><input id="exposure" type="number" value="${cfg.exposure_ms??1000}"></div>
            <div class="field"><label>ISI ms</label><input id="isi" type="number" value="${cfg.isi_ms??1500}"></div>
            <div class="field"><label>Break sec</label><input id="breaks" type="number" value="${(cfg.break_ms??300000)/1000}"></div>
          </div>
          <div class="field"><label>Critical mode</label><select id="criticalMode">
            <option value="extinction" ${(cfg.critical_mode||"extinction")==="extinction"?"selected":""}>Until extinction</option>
            <option value="fixed" ${cfg.critical_mode==="fixed"?"selected":""}>Fixed number</option>
          </select></div>
          <div class="inline-fields">
            <div class="field"><label>Critical max / N</label><input id="criticalMax" type="number" value="${cfg.critical_max??40}"></div>
            <div class="field"><label>Equal streak</label><input id="streak" type="number" value="${cfg.extinction_equal_streak??10}"></div>
            <div></div>
          </div>
        </div>

        <div class="card">
          <h3>Visual stimulus sizes</h3>
          <div class="inline-fields">
            <div class="field"><label>Small mm</label><input id="small" type="number" value="${cfg.small_mm??40}"></div>
            <div class="field"><label>Medium mm</label><input id="medium" type="number" value="${cfg.medium_mm??60}"></div>
            <div class="field"><label>Large mm</label><input id="large" type="number" value="${cfg.large_mm??80}"></div>
          </div>
          <div class="inline-fields">
            <div class="field"><label>Fixation mm</label><input id="fix" type="number" value="${cfg.fixation_mm??4}"></div>
            <div class="field"><label>Gap mm</label><input id="gap" type="number" value="${cfg.gap_mm??15}"></div>
            <div class="field"><label>Line thickness mm</label><input id="thick" type="number" value="${cfg.line_thickness_mm??2}"></div>
          </div>
          <div class="alert warning">Audio-სთვის Hz/duration პარამეტრების ცალკე panel შემდეგ ვერსიაში სრულად ჩაირთვება; engine უკვე plugin-ად არის გამოყოფილი.</div>
        </div>

        <div class="card">
          <h3>Preview</h3>
          <div class="preview-box" id="preview"></div>
          <p class="muted">Preview მხოლოდ პროპორციას აჩვენებს; participant რეჟიმში ფიზიკური ზომა calibration-ით განისაზღვრება.</p>
        </div>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn primary" id="save">${old?"Save changes":"Create experiment"}</button>
        <button class="btn" id="cancel">Cancel</button>
      </div>`;

    const ids=["stype","small","medium","large","fix","gap","thick"];
    ids.forEach(k=>document.getElementById(k).addEventListener("input",preview));
    name.addEventListener("input",()=>{if(!old&&!slug.value)slug.value=slugify(name.value)});
    preview();

    function preview(){
      const box=document.getElementById("preview"), type=stype.value;
      const sm=+small.value||40, lg=+large.value||80;
      if(type==="circle"){
        box.innerHTML=`<div class="preview-circle" style="width:${lg}px;height:${lg}px;left:30%"></div><div class="preview-fix"></div><div class="preview-circle" style="width:${sm}px;height:${sm}px;left:70%"></div>`;
      }else if(type==="line"){
        box.innerHTML=`<div class="preview-line" style="width:${+thick.value||2}px;height:${lg}px;left:30%"></div><div class="preview-fix"></div><div class="preview-line" style="width:${+thick.value||2}px;height:${sm}px;left:70%"></div>`;
      }else{
        box.innerHTML=`<div style="display:grid;place-items:center;height:100%;font-size:44px">🔊</div>`;
      }
    }

    save.onclick=async()=>{
      const payload={
        id:old?.id||crypto.randomUUID(),
        name:name.value.trim(),
        slug:slug.value.trim()||slugify(name.value),
        description:desc.value.trim(),
        stimulus_type:stype.value,
        status:status.value,
        version:old?.version||1,
        created_at:old?.created_at||new Date().toISOString(),
        config:{
          practice_trials:+practice.value,control_trials:+control.value,set_trials:+settr.value,
          exposure_ms:+exposure.value,isi_ms:+isi.value,break_ms:+breaks.value*1000,
          critical_mode:criticalMode.value,critical_max:+criticalMax.value,extinction_equal_streak:+streak.value,
          small_mm:+small.value,medium_mm:+medium.value,large_mm:+large.value,
          fixation_mm:+fix.value,gap_mm:+gap.value,line_thickness_mm:+thick.value,
          response_left:"1",response_equal:"2",response_right:"3"
        }
      };
      if(!payload.name||!payload.slug)return alert("Name და slug აუცილებელია.");
      await DB.saveExperiment(payload);navigate("experiments");
    };
    cancel.onclick=()=>navigate("experiments");
  }

  async function results(){
    const exps=await DB.listExperiments(true);
    const c=document.getElementById("content");
    c.innerHTML=`<div class="section-head"><div><h2>Results</h2><div class="muted">მონაწილეების და trial-level მონაცემები.</div></div>
      <button class="btn primary" id="xlsx">Download Excel</button></div>
      <div class="field" style="max-width:420px"><label>Experiment</label><select id="filter"><option value="">All experiments</option>${exps.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div>
      <div id="resultBody"></div>`;
    filter.onchange=load; xlsx.onclick=exportExcel; await load();

    async function load(){
      const {sessions,trials}=await DB.adminResults(filter.value||null);
      const complete=sessions.filter(x=>x.completed_at).length;
      resultBody.innerHTML=`
        <div class="grid three" style="margin-bottom:16px">
          <div class="card kpi"><div class="number">${sessions.length}</div><div class="label">Sessions</div></div>
          <div class="card kpi"><div class="number">${complete}</div><div class="label">Completed</div></div>
          <div class="card kpi"><div class="number">${trials.length}</div><div class="label">Trials saved</div></div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Participant</th><th>Experiment</th><th>Started</th><th>Completed</th><th>Device</th><th>Valid</th></tr></thead>
        <tbody>${sessions.slice(0,200).map(s=>`<tr><td>${esc(s.participant_code)}</td><td>${esc(s.experiment_id)}</td><td>${esc(s.created_at)}</td><td>${esc(s.completed_at||"—")}</td><td>${esc(s.device_type||"")}</td><td>${esc(s.validity_status||"")}</td></tr>`).join("")}</tbody></table></div>`;
    }

    async function exportExcel(){
      const {sessions,trials}=await DB.adminResults(filter.value||null);
      if(!window.XLSX)return alert("Excel library ვერ ჩაიტვირთა.");
      const wb=XLSX.utils.book_new();
      const expMap=Object.fromEntries(exps.map(x=>[x.id,x.name]));
      const participants=sessions.map(s=>({...s,experiment_name:expMap[s.experiment_id]||s.experiment_id}));
      const trialRows=trials.map(t=>({...t,experiment_name:expMap[t.experiment_id]||t.experiment_id}));
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(participants),"Participants");
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(trialRows),"Trial_Data");
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(exps.map(e=>({
        id:e.id,name:e.name,slug:e.slug,stimulus_type:e.stimulus_type,version:e.version,status:e.status,config_json:JSON.stringify(e.config)
      }))),"Experiment_Settings");
      XLSX.writeFile(wb,`experiment-data-${new Date().toISOString().slice(0,10)}.xlsx`);
    }
  }

  function setup(){
    document.getElementById("content").innerHTML=`<h2>Setup</h2>
      <div class="card">
        <h3>${DB.demo?"Demo Mode აქტიურია":"Supabase დაკავშირებულია"}</h3>
        <p>${DB.demo?"ახლა მონაცემები მხოლოდ ამ ბრაუზერის localStorage-ში ინახება. რეალური კვლევისთვის Supabase უნდა დავაკავშიროთ.":"მონაცემები Supabase-ში ინახება."}</p>
        <div class="hr"></div>
        <p><b>შემდეგი ნაბიჯი:</b> Supabase პროექტის შექმნა → <span class="code">supabase/schema.sql</span>-ის გაშვება → project URL და publishable key-ის ჩასმა <span class="code">js/config.js</span>-ში.</p>
        <p class="muted">Secret/service-role key frontend-ში არ უნდა ჩაიწეროს.</p>
      </div>`;
  }

  init().catch(e=>{app.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`});
})();