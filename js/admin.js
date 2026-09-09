(() => {
  const app=document.getElementById("adminApp"), badge=document.getElementById("modeBadge"), logout=document.getElementById("logoutBtn");
  badge.textContent=DB.demo?"DEMO MODE":"SUPABASE";
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const slugify=s=>s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,"-").replace(/^-|-$/g,"");
  const uid=()=>crypto.randomUUID();

  async function init(){
    const u=await DB.getUser();
    if(!u && !DB.demo) return renderAuth("login");
    if(!DB.demo && !(await DB.isAdmin())) return renderPending(u);
    logout.classList.remove("hidden"); logout.onclick=async()=>{await DB.signOut();location.reload()};
    renderShell(); navigate("experiments");
  }

  function renderAuth(mode){
    const register=mode==="register";
    app.innerHTML=`<div class="card login"><h2>${register?"Admin registration":"Admin login"}</h2>
      <p class="muted">${register?"შექმენი მკვლევრის ანგარიში. მონაცემებზე წვდომა ჩაირთვება მხოლოდ admin approval-ის შემდეგ.":"შედი მკვლევრის ანგარიშით."}</p>
      <div class="field"><label>Email</label><input id="email" type="email"></div>
      <div class="field"><label>Password</label><input id="password" type="password" minlength="8"></div>
      <div id="err" class="alert danger hidden"></div>
      <button id="submitAuth" class="btn primary">${register?"რეგისტრაცია":"შესვლა"}</button>
      <button id="switchAuth" class="btn">${register?"უკვე მაქვს ანგარიში":"ანგარიშის შექმნა"}</button></div>`;
    switchAuth.onclick=()=>renderAuth(register?"login":"register");
    submitAuth.onclick=async()=>{
      try{
        if(register){
          await DB.signUp(email.value.trim(),password.value);
          app.innerHTML=`<div class="card login"><h2>რეგისტრაცია მიღებულია</h2><p>თუ Supabase-ში email confirmation ჩართულია, ჯერ დაადასტურე ელფოსტა. შემდეგ შენი user UUID უნდა დაემატოს <b>admin_users</b> ცხრილში.</p><button class="btn primary" onclick="location.reload()">გაგრძელება</button></div>`;
        }else{await DB.signIn(email.value.trim(),password.value);location.reload()}
      }catch(e){err.textContent=e.message;err.classList.remove("hidden")}
    };
  }
  function renderPending(u){
    app.innerHTML=`<div class="card login"><h2>Admin approval required</h2><p>ანგარიში <b>${esc(u?.email||"")}</b> შექმნილია, მაგრამ ჯერ არ აქვს admin უფლება.</p>
      <p class="muted">Supabase → Authentication → Users-დან აიღე ამ ანგარიშის UUID და დაამატე public.admin_users-ში.</p>
      <button id="out" class="btn">გასვლა</button></div>`; out.onclick=async()=>{await DB.signOut();location.reload()};
  }
  function renderShell(){
    app.innerHTML=`<div class="sidebar-layout"><nav class="card nav-card">
      <button data-nav="experiments">Experiments</button><button data-nav="new">+ Create experiment</button>
      <button data-nav="results">Results</button><button data-nav="settings">Setup</button>
      </nav><section id="content"></section></div>`;
    document.querySelectorAll("[data-nav]").forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
  }
  function setActive(name){document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===name))}
  async function navigate(name,arg){setActive(name); if(name==="experiments")return experiments();if(name==="new")return builder();if(name==="results")return results();if(name==="settings")return setup();if(name==="edit")return builder(arg)}

  async function experiments(){
    const rows=await DB.listExperiments(true), c=content;
    c.innerHTML=`<div class="section-head"><div><h2>Experiments</h2><div class="muted">Universal builder — stimulus type არ არის წინასწარ შეზღუდული.</div></div><button class="btn primary" id="create">+ Create</button></div>
    <div class="table-wrap"><table><thead><tr><th>Name</th><th>Template</th><th>Blocks</th><th>Status</th><th>Participant link</th><th></th></tr></thead><tbody>
    ${rows.map(x=>`<tr><td><b>${esc(x.name)}</b><br><span class="muted">${esc(x.slug)}</span></td><td>${esc(x.config?.template||"custom")}</td>
    <td>${x.config?.blocks?.length||0}</td><td><span class="status ${x.status}">${x.status}</span></td>
    <td>${x.status==="published"?`<a class="code" target="_blank" href="run.html?exp=${encodeURIComponent(x.slug)}">open</a>`:"—"}</td>
    <td><button class="ghost" data-edit="${x.id}">Edit</button><button class="ghost" data-dup="${x.id}">Duplicate</button></td></tr>`).join("")}</tbody></table></div>`;
    create.onclick=()=>navigate("new");document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>navigate("edit",b.dataset.edit));
    document.querySelectorAll("[data-dup]").forEach(b=>b.onclick=async()=>{await DB.duplicateExperiment(b.dataset.dup);experiments()});
  }

  const fixedBlocks=()=>[
    {id:uid(),name:"Practice",trials:3,exposure_ms:1000,isi_ms:1500,break_after_ms:0,save:false,mode:"fixed_set_practice",stimuli:[]},
    {id:uid(),name:"Control",trials:15,exposure_ms:1000,isi_ms:1500,break_after_ms:300000,save:true,mode:"fixed_set_control",stimuli:[]},
    {id:uid(),name:"Set",trials:15,exposure_ms:1000,isi_ms:1500,break_after_ms:0,save:true,mode:"fixed_set_induction",stimuli:[]},
    {id:uid(),name:"Critical",trials:40,exposure_ms:1000,isi_ms:1500,break_after_ms:0,save:true,mode:"fixed_set_critical",stimuli:[],stop_rule:{type:"consecutive_response",key:"2",count:10}}
  ];
  const customBlocks=()=>[{id:uid(),name:"Block 1",trials:10,exposure_ms:1000,isi_ms:1000,break_after_ms:0,save:true,mode:"uploaded",stimuli:[]}];

  async function builder(id=null){
    const all=await DB.listExperiments(true), old=id?all.find(x=>x.id===id):null, cfg=old?.config||{};
    let blocks=structuredClone(cfg.blocks||customBlocks());
    let responses=structuredClone(cfg.responses||[{key:"1",label:"Response 1"},{key:"2",label:"Response 2"},{key:"3",label:"Response 3"}]);
    content.innerHTML=`<div class="section-head"><div><h2>${old?"Edit":"Create"} experiment</h2><div class="muted">ატვირთე საკუთარი stimulus-ები, შექმენი ნებისმიერი block-ები და timing.</div></div></div>
    <div class="grid two">
      <div class="card"><h3>General</h3>
        <div class="field"><label>Name</label><input id="name" value="${esc(old?.name||"")}"></div>
        <div class="field"><label>URL slug</label><input id="slug" value="${esc(old?.slug||"")}"></div>
        <div class="field"><label>Description</label><textarea id="desc">${esc(old?.description||"")}</textarea></div>
        <div class="field"><label>Start from</label><select id="template"><option value="custom">Blank / Custom</option><option value="fixed_set" ${cfg.template==="fixed_set"?"selected":""}>Fixed Set template</option></select></div>
        <div class="field"><label>Status</label><select id="status"><option value="draft">Draft</option><option value="published" ${old?.status==="published"?"selected":""}>Published</option><option value="archived" ${old?.status==="archived"?"selected":""}>Archived</option></select></div>
      </div>
      <div class="card"><h3>Response keys</h3><div id="responses"></div><button class="btn" id="addResponse">+ Add response</button>
        <p class="muted">მაგ.: 1 = მარცხენა დიდია, 2 = ტოლია, 3 = მარჯვენა დიდია. შეგიძლია სხვა ღილაკებიც გამოიყენო.</p></div>
    </div>
    <div class="section-head" style="margin-top:20px"><div><h2>Blocks</h2><div class="muted">Practice/Control/Set/Critical აღარ არის სავალდებულო — სახელებს შენ ირჩევ.</div></div><button class="btn primary" id="addBlock">+ Add block</button></div>
    <div id="blocks"></div>
    <div id="fixedOptions" class="card ${cfg.template==="fixed_set"?"":"hidden"}" style="margin-top:16px"><h3>Fixed Set template settings</h3>
      <div class="inline-fields"><div class="field"><label>Small mm</label><input id="small" type="number" value="${cfg.fixed_set?.small_mm??40}"></div>
      <div class="field"><label>Medium mm</label><input id="medium" type="number" value="${cfg.fixed_set?.medium_mm??60}"></div>
      <div class="field"><label>Large mm</label><input id="large" type="number" value="${cfg.fixed_set?.large_mm??80}"></div></div>
      <div class="inline-fields"><div class="field"><label>Fixation mm</label><input id="fix" type="number" value="${cfg.fixed_set?.fixation_mm??4}"></div>
      <div class="field"><label>Gap mm</label><input id="gap" type="number" value="${cfg.fixed_set?.gap_mm??15}"></div>
      <div class="field"><label>Asymmetry threshold</label><input id="asym" type="number" step=".01" value="${cfg.fixed_set?.asymmetry_threshold??.70}"></div></div></div>
    <div class="row" style="margin-top:16px"><button class="btn primary" id="save">Save experiment</button><button class="btn" id="cancel">Cancel</button></div>`;

    name.oninput=()=>{if(!old&&!slug.value)slug.value=slugify(name.value)};
    template.onchange=()=>{fixedOptions.classList.toggle("hidden",template.value!=="fixed_set"); if(template.value==="fixed_set"&&!old){blocks=fixedBlocks();responses=[{key:"1",label:"მარცხენა დიდია"},{key:"2",label:"ტოლია"},{key:"3",label:"მარჯვენა დიდია"}];renderResponses();renderBlocks()}};
    addResponse.onclick=()=>{responses.push({key:"",label:""});renderResponses()};
    addBlock.onclick=()=>{blocks.push({id:uid(),name:`Block ${blocks.length+1}`,trials:10,exposure_ms:1000,isi_ms:1000,break_after_ms:0,save:true,mode:"uploaded",stimuli:[]});renderBlocks()};
    cancel.onclick=()=>navigate("experiments");

    function renderResponses(){
      responsesEl=document.getElementById("responses");
      responsesEl.innerHTML=responses.map((r,i)=>`<div class="inline-fields" style="grid-template-columns:100px 1fr 40px"><div class="field"><label>Key</label><input data-rkey="${i}" value="${esc(r.key)}"></div><div class="field"><label>Meaning</label><input data-rlabel="${i}" value="${esc(r.label)}"></div><button class="ghost" data-rdel="${i}" style="margin-top:24px">×</button></div>`).join("");
      document.querySelectorAll("[data-rkey]").forEach(x=>x.oninput=()=>responses[+x.dataset.rkey].key=x.value);
      document.querySelectorAll("[data-rlabel]").forEach(x=>x.oninput=()=>responses[+x.dataset.rlabel].label=x.value);
      document.querySelectorAll("[data-rdel]").forEach(x=>x.onclick=()=>{responses.splice(+x.dataset.rdel,1);renderResponses()});
    }
    function renderBlocks(){
      blocksEl=document.getElementById("blocks");
      blocksEl.innerHTML=blocks.map((b,i)=>`<div class="card" style="margin-bottom:14px">
        <div class="section-head"><h3>${esc(b.name||`Block ${i+1}`)}</h3><button class="ghost" data-bdel="${i}">Remove</button></div>
        <div class="inline-fields"><div class="field"><label>Block name</label><input data-b="${i}" data-k="name" value="${esc(b.name)}"></div>
        <div class="field"><label>Trials</label><input type="number" data-b="${i}" data-k="trials" value="${b.trials}"></div>
        <div class="field"><label>Save data</label><select data-b="${i}" data-k="save"><option value="true" ${b.save!==false?"selected":""}>Yes</option><option value="false" ${b.save===false?"selected":""}>No</option></select></div></div>
        <div class="inline-fields"><div class="field"><label>Exposure ms</label><input type="number" data-b="${i}" data-k="exposure_ms" value="${b.exposure_ms}"></div>
        <div class="field"><label>ISI ms</label><input type="number" data-b="${i}" data-k="isi_ms" value="${b.isi_ms}"></div>
        <div class="field"><label>Break after (sec)</label><input type="number" data-b="${i}" data-k="break_sec" value="${(b.break_after_ms||0)/1000}"></div></div>
        <div class="field"><label>Stimulus presentation</label><select data-b="${i}" data-k="mode">
          <option value="uploaded" ${b.mode==="uploaded"?"selected":""}>Uploaded stimulus files</option>
          <option value="fixed_set_practice" ${b.mode==="fixed_set_practice"?"selected":""}>Fixed Set — practice</option>
          <option value="fixed_set_control" ${b.mode==="fixed_set_control"?"selected":""}>Fixed Set — control</option>
          <option value="fixed_set_induction" ${b.mode==="fixed_set_induction"?"selected":""}>Fixed Set — induction</option>
          <option value="fixed_set_critical" ${b.mode==="fixed_set_critical"?"selected":""}>Fixed Set — critical</option></select></div>
        <div class="field"><label>Upload stimuli (images / audio / video)</label><input type="file" multiple data-upload="${i}" accept="image/*,audio/*,video/*"></div>
        <div class="muted" id="files-${i}">${(b.stimuli||[]).map(s=>esc(s.name)).join(" · ")||"No files uploaded"}</div>
        <div class="inline-fields" style="margin-top:10px"><div class="field"><label>Stop rule</label><select data-b="${i}" data-k="stop_type"><option value="fixed">Fixed N</option><option value="consecutive_response" ${b.stop_rule?.type==="consecutive_response"?"selected":""}>Consecutive response</option></select></div>
        <div class="field"><label>Response key</label><input data-b="${i}" data-k="stop_key" value="${esc(b.stop_rule?.key||"")}"></div>
        <div class="field"><label>Consecutive N</label><input type="number" data-b="${i}" data-k="stop_count" value="${b.stop_rule?.count||10}"></div></div></div>`).join("");
      document.querySelectorAll("[data-b]").forEach(x=>x.oninput=()=>updateBlock(x));
      document.querySelectorAll("[data-b] select").forEach(x=>x.onchange=()=>updateBlock(x));
      document.querySelectorAll("[data-bdel]").forEach(x=>x.onclick=()=>{blocks.splice(+x.dataset.bdel,1);renderBlocks()});
      document.querySelectorAll("[data-upload]").forEach(x=>x.onchange=async()=>{
        const i=+x.dataset.upload; x.disabled=true;
        try{for(const f of x.files){const asset=await DB.uploadStimulus(f);blocks[i].stimuli=blocks[i].stimuli||[];blocks[i].stimuli.push(asset)}}
        catch(e){alert(e.message)} finally{x.disabled=false;renderBlocks()}
      });
    }
    function updateBlock(x){
      const b=blocks[+x.dataset.b],k=x.dataset.k,v=x.value;
      if(["trials","exposure_ms","isi_ms"].includes(k)) b[k]=+v;
      else if(k==="break_sec") b.break_after_ms=+v*1000;
      else if(k==="save") b.save=v==="true";
      else if(k==="stop_type"){b.stop_rule=v==="consecutive_response"?{type:v,key:b.stop_rule?.key||"",count:b.stop_rule?.count||10}:null}
      else if(k==="stop_key"){b.stop_rule=b.stop_rule||{type:"consecutive_response",count:10};b.stop_rule.key=v}
      else if(k==="stop_count"){b.stop_rule=b.stop_rule||{type:"consecutive_response",key:""};b.stop_rule.count=+v}
      else b[k]=v;
    }
    renderResponses();renderBlocks();

    save.onclick=async()=>{
      if(!name.value.trim()||!slug.value.trim())return alert("Name და URL slug აუცილებელია.");
      if(!responses.length)return alert("მინიმუმ ერთი response key დაამატე.");
      const payload={id:old?.id||crypto.randomUUID(),name:name.value.trim(),slug:slug.value.trim(),description:desc.value.trim(),
        status:status.value,version:old?.version||1,
        config:{builder_version:2,template:template.value,calibration:template.value==="fixed_set",responses,blocks,
          fixed_set:template.value==="fixed_set"?{small_mm:+small.value,medium_mm:+medium.value,large_mm:+large.value,fixation_mm:+fix.value,gap_mm:+gap.value,asymmetry_threshold:+asym.value}:null}};
      await DB.saveExperiment(payload);navigate("experiments");
    };
  }

  async function results(){
    const exps=await DB.listExperiments(true);
    content.innerHTML=`<div class="section-head"><div><h2>Results</h2><div class="muted">Excel-ის პირველი sheet არის analysis-ready participant summary.</div></div><button class="btn primary" id="xlsx">Download Excel</button></div>
      <div class="field" style="max-width:420px"><label>Experiment</label><select id="filter"><option value="">All experiments</option>${exps.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></div><div id="resultBody"></div>`;
    filter.onchange=load;xlsx.onclick=exportExcel;await load();
    async function load(){
      const {sessions,trials}=await DB.adminResults(filter.value||null), complete=sessions.filter(x=>x.completed_at).length;
      resultBody.innerHTML=`<div class="grid three" style="margin-bottom:16px"><div class="card kpi"><div class="number">${sessions.length}</div><div class="label">Sessions</div></div><div class="card kpi"><div class="number">${complete}</div><div class="label">Completed</div></div><div class="card kpi"><div class="number">${trials.length}</div><div class="label">Trials saved</div></div></div>`;
    }
    async function exportExcel(){
      const {sessions,trials}=await DB.adminResults(filter.value||null);
      if(!window.XLSX)return alert("Excel library ვერ ჩაიტვირთა.");
      const expMap=Object.fromEntries(exps.map(x=>[x.id,x]));
      const group={}; for(const t of trials)(group[t.session_id]??=[]).push(t);
      const summary=sessions.map(s=>{
        const ts=(group[s.id]||[]).sort((a,b)=>(a.global_trial||0)-(b.global_trial||0));
        const row={
          Participant:s.participant_code, Experiment:expMap[s.experiment_id]?.name||s.experiment_id,
          Started:s.created_at, Completed:s.completed_at||"", Device:s.device_type||"",
          Validity:s.validity_status||"", "Total saved trials":ts.length
        };
        const blockNames=[...new Set(ts.map(t=>t.series))];
        for(const bn of blockNames){
          const bt=ts.filter(t=>t.series===bn), keys=bt.map(t=>t.response_key).filter(Boolean);
          row[`${bn} N`]=bt.length;
          for(const k of ["1","2","3"]){
            const n=keys.filter(x=>x===k).length;
            row[`${bn} ${k}`]=n; row[`${bn} ${k} %`]=keys.length?+(100*n/keys.length).toFixed(1):0;
          }
          row[`${bn} sequence`]=bt.map(t=>t.response_key||"NA").join(",");
          row[`${bn} missing`]=bt.filter(t=>t.missing).length;
        }
        const sm=s.summary||{};
        row["Natural asymmetry"]=sm.asymmetry_side||"";
        row["Set large side"]=sm.set_large_side||"";
        row["Extinguished"]=sm.extinguished??"";
        return row;
      });
      const raw=trials.map(t=>({
        Participant:t.participant_code,Experiment:expMap[t.experiment_id]?.name||t.experiment_id,
        Block:t.series,Trial:t.series_trial,Global_Trial:t.global_trial,
        Response_Key:t.response_key||"",Response:t.response||"",RT_ms:t.rt_ms??"",
        Missing:t.missing,Stimulus_1:t.stimulus_1||"",Stimulus_2:t.stimulus_2||"",
        Left_Value:t.left_value??"",Right_Value:t.right_value??"",Timestamp:t.created_at
      }));
      const settings=exps.map(e=>({Experiment:e.name,Slug:e.slug,Status:e.status,Version:e.version,
        Template:e.config?.template||"custom",Blocks:(e.config?.blocks||[]).map(b=>b.name).join(" | "),
        Response_keys:(e.config?.responses||[]).map(r=>`${r.key}=${r.label}`).join(" | ")}));
      const wb=XLSX.utils.book_new();
      const ws1=XLSX.utils.json_to_sheet(summary),ws2=XLSX.utils.json_to_sheet(raw),ws3=XLSX.utils.json_to_sheet(settings);
      [ws1,ws2,ws3].forEach(ws=>{ws["!freeze"]={xSplit:0,ySplit:1};ws["!autofilter"]={ref:ws["!ref"]};ws["!cols"]=Array.from({length:40},()=>({wch:18}))});
      XLSX.utils.book_append_sheet(wb,ws1,"Participants");
      XLSX.utils.book_append_sheet(wb,ws2,"Trial_Data");
      XLSX.utils.book_append_sheet(wb,ws3,"Experiment_Settings");
      XLSX.writeFile(wb,`cogexperiments-data-${new Date().toISOString().slice(0,10)}.xlsx`);
    }
  }

  function setup(){content.innerHTML=`<h2>Setup</h2><div class="card"><h3>${DB.demo?"Demo Mode აქტიურია":"Supabase დაკავშირებულია"}</h3>
    <p>${DB.demo?"მონაცემები ამ ბრაუზერში ინახება. Production-ისთვის Supabase ჩართე.":"მონაცემები Supabase-ში ინახება."}</p>
    <p><b>v2.1:</b> Auth registration + admin approval, universal blocks, stimulus upload, research-friendly Excel.</p>
    <p class="muted">Secret/service-role key frontend-ში არასოდეს ჩაწერო.</p></div>`}
  init().catch(e=>{app.innerHTML=`<div class="alert danger">${esc(e.message)}</div>`});
})();