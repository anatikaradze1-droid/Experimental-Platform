
(() => {
  const C = window.APP_CONFIG || {};
  const configured = Boolean(C.SUPABASE_URL && C.SUPABASE_PUBLISHABLE_KEY);
  const demo = Boolean(C.DEMO_MODE || !configured);
  const supabase = (!demo && window.supabase)
    ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_PUBLISHABLE_KEY)
    : null;
  const DEMO_KEY = "cogexperiments_platform_v21";
  const uuid = () => crypto.randomUUID();

  function seed() {
    const existing = JSON.parse(localStorage.getItem(DEMO_KEY) || "null");
    if (existing) return existing;
    const id = uuid();
    const data = { experiments: [{
      id, slug: "fixed-set-standard", name: "Fixed Set — Standard",
      description: "Standard visual fixed-set template", status: "published",
      version: 1, owner_id: "demo-admin", created_at: new Date().toISOString(),
      config: {
        builder_version: 2, template: "fixed_set", calibration: true,
        responses: [
          {key:"1",label:"მარცხენა დიდია"},
          {key:"2",label:"ტოლია"},
          {key:"3",label:"მარჯვენა დიდია"}
        ],
        fixed_set: {
          small_mm:40, medium_mm:60, large_mm:80,
          fixation_mm:4, gap_mm:15,
          asymmetry_threshold:.70,
          extinction_equal_streak:10
        },
        blocks: [
          {id:"practice",name:"Practice",trials:3,exposure_ms:1000,isi_ms:1500,break_after_ms:0,save:false,mode:"fixed_set_practice"},
          {id:"control",name:"Control",trials:15,exposure_ms:1000,isi_ms:1500,break_after_ms:300000,save:true,mode:"fixed_set_control"},
          {id:"set",name:"Set",trials:15,exposure_ms:1000,isi_ms:1500,break_after_ms:0,save:true,mode:"fixed_set_induction"},
          {id:"critical",name:"Critical",trials:40,exposure_ms:1000,isi_ms:1500,break_after_ms:0,save:true,mode:"fixed_set_critical",stop_rule:{type:"consecutive_response",key:"2",count:10}}
        ]
      }
    }], sessions: [], trials: [] };
    localStorage.setItem(DEMO_KEY, JSON.stringify(data));
    return data;
  }

  const demoRead = () => seed();
  const demoWrite = d => localStorage.setItem(DEMO_KEY, JSON.stringify(d));

  async function signIn(email, password) {
    if (demo) return {user:{id:"demo-admin",email:"demo@local"}};
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) throw error;
    return data;
  }

  async function signUp(email, password) {
    if (demo) return {user:{id:"demo-admin",email}};
    const {data,error} = await supabase.auth.signUp({email,password});
    if (error) throw error;
    return data;
  }

  async function signOut() {
    if (!demo) {
      const {error} = await supabase.auth.signOut();
      if (error) throw error;
    }
  }

  async function getUser() {
    if (demo) return {id:"demo-admin",email:"demo@local"};
    const {data,error} = await supabase.auth.getUser();
    if (error) return null;
    return data.user;
  }

  async function requireUser() {
    const user = await getUser();
    if (!user) throw new Error("Please sign in first.");
    return user;
  }

  async function isAdmin() {
    if (demo) return true;
    const {data,error} = await supabase.rpc("is_platform_admin");
    if (error) throw error;
    return Boolean(data);
  }

  async function canBuild() {
    return demo || Boolean(await getUser());
  }

  async function listExperiments(manage = false) {
    if (demo) return demoRead().experiments
      .filter(e => manage || e.status === "published")
      .sort((a,b) => b.created_at.localeCompare(a.created_at));

    let q = supabase.from("experiments")
      .select("*")
      .order("created_at",{ascending:false});

    if (manage) {
      const user = await requireUser();
      if (!(await isAdmin())) q = q.eq("owner_id", user.id);
    } else {
      q = q.eq("status","published");
    }

    const {data,error} = await q;
    if (error) throw error;
    return data;
  }

  async function getExperimentBySlug(slug) {
    if (demo) return demoRead().experiments.find(
      e => e.slug === slug && e.status === "published"
    ) || null;

    const {data,error} = await supabase.from("experiments")
      .select("*")
      .eq("slug",slug)
      .eq("status","published")
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async function saveExperiment(exp) {
    if (demo) {
      const d = demoRead();
      const i = d.experiments.findIndex(e => e.id === exp.id);
      const row = {
        ...exp,
        id:exp.id || uuid(),
        owner_id:exp.owner_id || "demo-admin",
        created_at:exp.created_at || new Date().toISOString()
      };
      if (i >= 0) d.experiments[i] = {...d.experiments[i],...row};
      else d.experiments.push(row);
      demoWrite(d);
      return row;
    }

    const user = await requireUser();
    const admin = await isAdmin();

    const {data:existing,error:readError} = await supabase
      .from("experiments")
      .select("id,owner_id")
      .eq("id",exp.id)
      .maybeSingle();

    if (readError) throw readError;

    if (existing && !admin && existing.owner_id !== user.id) {
      throw new Error("You cannot edit this experiment.");
    }

    const payload = {...exp};

    if (existing) {
      delete payload.owner_id;
    } else {
      payload.owner_id = user.id;
    }

    const {data,error} = await supabase.from("experiments")
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function duplicateExperiment(id) {
    const all = await listExperiments(true);
    const src = all.find(e => e.id === id);
    if (!src) throw new Error("Experiment not found or not editable.");

    const copy = {
      ...src,
      id:uuid(),
      name:src.name + " — Copy",
      slug:src.slug + "-copy-" + uuid().slice(0,8),
      status:"draft",
      version:1,
      created_at:new Date().toISOString()
    };

    delete copy.owner_id;
    delete copy.updated_at;
    return saveExperiment(copy);
  }

  async function uploadStimulus(file) {
    if (demo) {
      if (file.size > 2_000_000) {
        throw new Error("Demo Mode-ში თითო ფაილი მაქსიმუმ 2 MB იყოს.");
      }
      return new Promise((resolve,reject) => {
        const r = new FileReader();
        r.onload = () => resolve({
          name:file.name,url:r.result,type:file.type,size:file.size
        });
        r.onerror = reject;
        r.readAsDataURL(file);
      });
    }

    const user = await requireUser();
    const ext = (file.name.split(".").pop() || "bin")
      .replace(/[^a-z0-9]/gi,"")
      .toLowerCase();

    const path = `${user.id}/${uuid()}.${ext}`;

    const {error} = await supabase.storage
      .from("stimuli")
      .upload(path,file,{
        contentType:file.type || "application/octet-stream",
        upsert:false
      });

    if (error) throw error;

    const {data} = supabase.storage.from("stimuli")
      .getPublicUrl(path);

    return {
      name:file.name,
      url:data.publicUrl,
      type:file.type,
      size:file.size,
      path
    };
  }

  async function createSession(payload) {
    const row = {
      id:uuid(),
      created_at:new Date().toISOString(),
      ...payload
    };

    if (demo) {
      const d = demoRead();
      d.sessions.push(row);
      demoWrite(d);
      return row;
    }

    const {error} = await supabase.from("sessions").insert(row);
    if (error) throw error;
    return row;
  }

  async function insertTrial(payload) {
    const row = {
      id:uuid(),
      created_at:new Date().toISOString(),
      ...payload
    };

    if (demo) {
      const d = demoRead();
      d.trials.push(row);
      demoWrite(d);
      return row;
    }

    const {error} = await supabase.from("trials").insert(row);
    if (error) throw error;
    return row;
  }

  async function finishSession(sessionId,summary) {
    if (demo) {
      const d = demoRead();
      const s = d.sessions.find(e => e.id === sessionId);
      if (s) Object.assign(s,{
        summary,
        validity_status:summary.validity_status || "",
        completed_at:new Date().toISOString()
      });
      demoWrite(d);
      return;
    }

    const {error} = await supabase.rpc("finish_participant_session",{
      p_session_id:sessionId,
      p_completed_at:new Date().toISOString(),
      p_summary:summary
    });

    if (error) throw error;
  }

  async function adminResults(experimentId = null) {
    if (demo) {
      const d = demoRead();
      return {
        sessions:experimentId
          ? d.sessions.filter(x => x.experiment_id === experimentId)
          : d.sessions,
        trials:experimentId
          ? d.trials.filter(x => x.experiment_id === experimentId)
          : d.trials
      };
    }

    await requireUser();

    let qs = supabase.from("sessions")
      .select("*")
      .order("created_at",{ascending:false});

    let qt = supabase.from("trials")
      .select("*")
      .order("created_at",{ascending:true});

    if (experimentId) {
      qs = qs.eq("experiment_id",experimentId);
      qt = qt.eq("experiment_id",experimentId);
    }

    const [a,b] = await Promise.all([qs,qt]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;

    return {sessions:a.data,trials:b.data};
  }

  window.DB = {
    demo,supabase,signIn,signUp,signOut,getUser,
    isAdmin,canBuild,listExperiments,getExperimentBySlug,
    saveExperiment,duplicateExperiment,uploadStimulus,
    createSession,insertTrial,finishSession,adminResults
  };
})();
