(() => {
  const C = window.APP_CONFIG || {};
  const configured = Boolean(C.SUPABASE_URL && C.SUPABASE_PUBLISHABLE_KEY);
  const demo = C.DEMO_MODE || !configured;
  const supabase = (!demo && window.supabase)
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY)
    : null;

  const DEMO_KEY = "uznadze_platform_demo_v2";

  function seed(){
    const existing = JSON.parse(localStorage.getItem(DEMO_KEY) || "null");
    if (existing) return existing;
    const id = crypto.randomUUID();
    const data = {
      experiments:[{
        id,
        slug:"circles-standard",
        name:"Visual Fixed Set — Circles",
        description:"სტანდარტული ვიზუალური ფიქსირებული განწყობის ექსპერიმენტი",
        stimulus_type:"circle",
        status:"published",
        version:1,
        created_at:new Date().toISOString(),
        config:{
          practice_trials:3, control_trials:15, set_trials:15,
          critical_mode:"extinction", critical_max:40, extinction_equal_streak:10,
          exposure_ms:1000, isi_ms:1500, break_ms:300000,
          small_mm:40, medium_mm:60, large_mm:80,
          fixation_mm:4, gap_mm:15,
          response_left:"1",response_equal:"2",response_right:"3"
        }
      }],
      sessions:[], trials:[]
    };
    localStorage.setItem(DEMO_KEY,JSON.stringify(data));
    return data;
  }
  function demoRead(){ return seed(); }
  function demoWrite(d){ localStorage.setItem(DEMO_KEY,JSON.stringify(d)); }

  async function signIn(email,password){
    if(demo) return {user:{email:"demo@local"}};
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    return data;
  }
  async function signOut(){ if(!demo) await supabase.auth.signOut(); }
  async function getUser(){
    if(demo) return {id:"demo-admin",email:"demo@local"};
    const {data}=await supabase.auth.getUser();
    return data.user;
  }

  async function listExperiments(admin=false){
    if(demo) return demoRead().experiments.slice().sort((a,b)=>b.created_at.localeCompare(a.created_at));
    let q=supabase.from("experiments").select("*").order("created_at",{ascending:false});
    if(!admin) q=q.eq("status","published");
    const {data,error}=await q; if(error) throw error; return data;
  }
  async function getExperimentBySlug(slug){
    if(demo) return demoRead().experiments.find(x=>x.slug===slug && x.status==="published") || null;
    const {data,error}=await supabase.from("experiments").select("*").eq("slug",slug).eq("status","published").single();
    if(error) return null; return data;
  }
  async function saveExperiment(exp){
    if(demo){
      const d=demoRead();
      const ix=d.experiments.findIndex(x=>x.id===exp.id);
      if(ix>=0)d.experiments[ix]={...d.experiments[ix],...exp};
      else d.experiments.push({...exp,id:exp.id||crypto.randomUUID(),created_at:new Date().toISOString()});
      demoWrite(d); return exp;
    }
    const payload={...exp};
    const {data,error}=await supabase.from("experiments").upsert(payload).select().single();
    if(error) throw error; return data;
  }
  async function duplicateExperiment(id){
    const all=await listExperiments(true);
    const src=all.find(x=>x.id===id); if(!src) throw new Error("Experiment not found");
    const copy={
      ...src,id:crypto.randomUUID(),
      name:src.name+" — Copy",
      slug:src.slug+"-copy-"+Math.floor(Math.random()*10000),
      status:"draft",version:1,created_at:new Date().toISOString()
    };
    return saveExperiment(copy);
  }

  async function createSession(payload){
    const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...payload};
    if(demo){const d=demoRead();d.sessions.push(row);demoWrite(d);return row;}
    const {data,error}=await supabase.from("sessions").insert(row).select().single();
    if(error) throw error; return data;
  }
  async function insertTrial(payload){
    const row={id:crypto.randomUUID(),created_at:new Date().toISOString(),...payload};
    if(demo){const d=demoRead();d.trials.push(row);demoWrite(d);return row;}
    // Participant only needs INSERT permission. It does not need SELECT on trials.
    const {error}=await supabase.from("trials").insert(row);
    if(error) throw error; return row;
  }
  async function finishSession(sessionId,summary){
    if(demo){
      const d=demoRead();const s=d.sessions.find(x=>x.id===sessionId);
      if(s) Object.assign(s,summary,{completed_at:new Date().toISOString()});
      demoWrite(d);return;
    }
    // Uses a narrowly-scoped RPC rather than granting anonymous UPDATE to sessions.
    const {error}=await supabase.rpc("finish_participant_session",{
      p_session_id:sessionId,
      p_completed_at:new Date().toISOString(),
      p_summary:summary
    });
    if(error) throw error;
  }
  async function adminResults(experimentId=null){
    if(demo){
      const d=demoRead();
      return {
        sessions: experimentId?d.sessions.filter(x=>x.experiment_id===experimentId):d.sessions,
        trials: experimentId?d.trials.filter(x=>x.experiment_id===experimentId):d.trials
      };
    }
    let qs=supabase.from("sessions").select("*").order("created_at",{ascending:false});
    let qt=supabase.from("trials").select("*").order("created_at",{ascending:true});
    if(experimentId){qs=qs.eq("experiment_id",experimentId);qt=qt.eq("experiment_id",experimentId);}
    const [a,b]=await Promise.all([qs,qt]);
    if(a.error)throw a.error;if(b.error)throw b.error;
    return {sessions:a.data,trials:b.data};
  }

  window.DB={
    demo,supabase,signIn,signOut,getUser,listExperiments,getExperimentBySlug,
    saveExperiment,duplicateExperiment,createSession,insertTrial,finishSession,adminResults
  };
})();