
(() => {
  const app = document.getElementById("adminApp");
  const badge = document.getElementById("modeBadge");
  const logout = document.getElementById("logoutBtn");

  badge.textContent = DB.demo ? "DEMO MODE" : "SUPABASE";

  const esc = s => String(s ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#39;"
    }[c])
  );

  const slugify = s => s.toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

  const uid = () => crypto.randomUUID();

  let currentUser = null;
  let admin = false;
  let content = null;

  function showError(error) {
    console.error(error);
    alert(error?.message || "Something went wrong.");
  }

  async function init() {
    currentUser = await DB.getUser();

    if (!currentUser && !DB.demo) {
      return renderAuth("login");
    }

    admin = await DB.isAdmin();

    logout.classList.remove("hidden");
    logout.onclick = async () => {
      try {
        await DB.signOut();
        location.reload();
      } catch (e) {
        showError(e);
      }
    };

    badge.textContent = DB.demo
      ? "DEMO MODE"
      : admin ? "ADMIN" : "RESEARCHER";

    renderShell();
    await navigate("experiments");
  }

  function renderAuth(mode) {
    const register = mode === "register";

    app.innerHTML = `
      <div class="card login">
        <h2>${register ? "Researcher Registration" : "Researcher Login"}</h2>
        <p class="muted">
          ${register
            ? "შექმენი ანგარიში და მიიღე წვდომა ექსპერიმენტების კონსტრუქტორზე. ელფოსტის დადასტურება შეიძლება აუცილებელი იყოს."
            : "შედი შენი მკვლევრის ანგარიშით."}
        </p>
        <div class="field">
          <label>Email</label>
          <input id="email" type="email" autocomplete="email">
        </div>
        <div class="field">
          <label>Password</label>
          <input id="password" type="password" minlength="8">
        </div>
        <div id="err" class="alert danger hidden"></div>
        <button id="submitAuth" class="btn primary">
          ${register ? "რეგისტრაცია" : "შესვლა"}
        </button>
        <button id="switchAuth" class="btn">
          ${register ? "უკვე მაქვს ანგარიში" : "ანგარიშის შექმნა"}
        </button>
      </div>
    `;

    const emailEl = document.getElementById("email");
    const passwordEl = document.getElementById("password");
    const errorEl = document.getElementById("err");

    document.getElementById("switchAuth").onclick = () =>
      renderAuth(register ? "login" : "register");

    document.getElementById("submitAuth").onclick = async () => {
      const email = emailEl.value.trim();
      const password = passwordEl.value;

      errorEl.classList.add("hidden");

      if (!email || password.length < 8) {
        errorEl.textContent = "შეიყვანე ელფოსტა და მინიმუმ 8-სიმბოლოიანი პაროლი.";
        errorEl.classList.remove("hidden");
        return;
      }

      try {
        if (register) {
          await DB.signUp(email, password);

          app.innerHTML = `
            <div class="card login">
              <h2>რეგისტრაცია მიღებულია</h2>
              <p>
                თუ ელფოსტის დადასტურება ჩართულია,
                შეამოწმე შენი ელფოსტა.
              </p>
              <p>
                დადასტურების შემდეგ შეძლებ მკვლევრის
                ანგარიშით შესვლას.
              </p>
              <button id="backLogin" class="btn primary">
                შესვლა
              </button>
            </div>
          `;

          document.getElementById("backLogin").onclick =
            () => renderAuth("login");

        } else {
          await DB.signIn(email, password);
          location.reload();
        }
      } catch (e) {
        errorEl.textContent = e.message;
        errorEl.classList.remove("hidden");
      }
    };
  }

  function renderShell() {
    app.innerHTML = `
      <div class="sidebar-layout">
        <nav class="card nav-card">
          <button data-nav="experiments">Experiments</button>
          <button data-nav="new">+ Create experiment</button>
          <button data-nav="results">Results</button>
          <button data-nav="settings">Setup</button>
        </nav>
        <section id="content"></section>
      </div>
    `;

    content = document.getElementById("content");

    document.querySelectorAll("[data-nav]").forEach(b => {
      b.onclick = () => navigate(b.dataset.nav);
    });
  }

  function setActive(name) {
    document.querySelectorAll("[data-nav]").forEach(b => {
      b.classList.toggle("active", b.dataset.nav === name);
    });
  }

  async function navigate(name, arg) {
    setActive(name);

    try {
      if (name === "experiments") return await experiments();
      if (name === "new") return await builder();
      if (name === "edit") return await builder(arg);
      if (name === "results") return await results();
      if (name === "settings") return setup();
    } catch (e) {
      showError(e);
    }
  }

  async function experiments() {
    const rows = await DB.listExperiments(true);

    content.innerHTML = `
      <div class="section-head">
        <div>
          <h2>${admin ? "All Experiments" : "My Experiments"}</h2>
          <div class="muted">
            ${admin
              ? "Manage experiments across the platform."
              : "Create and manage your own research experiments."}
          </div>
        </div>
        <button class="btn primary" id="create">+ Create</button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Template</th>
              <th>Blocks</th>
              <th>Status</th>
              <th>Participant link</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(x => `
              <tr>
                <td>
                  <b>${esc(x.name)}</b>
                  <br>
                  <span class="muted">${esc(x.slug)}</span>
                </td>
                <td>${esc(x.config?.template || "custom")}</td>
                <td>${x.config?.blocks?.length || 0}</td>
                <td>
                  <span class="status ${esc(x.status)}">
                    ${esc(x.status)}
                  </span>
                </td>
                <td>
                  ${x.status === "published"
                    ? `<a class="code" target="_blank" rel="noopener"
                         href="run.html?exp=${encodeURIComponent(x.slug)}">open</a>`
                    : "—"}
                </td>
                <td>
                  <button class="ghost" data-edit="${esc(x.id)}">Edit</button>
                  <button class="ghost" data-dup="${esc(x.id)}">Duplicate</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById("create").onclick =
      () => navigate("new");

    document.querySelectorAll("[data-edit]").forEach(b => {
      b.onclick = () => navigate("edit", b.dataset.edit);
    });

    document.querySelectorAll("[data-dup]").forEach(b => {
      b.onclick = async () => {
        try {
          await DB.duplicateExperiment(b.dataset.dup);
          await experiments();
        } catch (e) {
          showError(e);
        }
      };
    });
  }

  const fixedBlocks = () => [
    {
      id:uid(), name:"Practice", trials:3,
      exposure_ms:1000, isi_ms:1500,
      break_after_ms:0, save:false,
      mode:"fixed_set_practice", stimuli:[]
    },
    {
      id:uid(), name:"Control", trials:15,
      exposure_ms:1000, isi_ms:1500,
      break_after_ms:300000, save:true,
      mode:"fixed_set_control", stimuli:[]
    },
    {
      id:uid(), name:"Set", trials:15,
      exposure_ms:1000, isi_ms:1500,
      break_after_ms:0, save:true,
      mode:"fixed_set_induction", stimuli:[]
    },
    {
      id:uid(), name:"Critical", trials:40,
      exposure_ms:1000, isi_ms:1500,
      break_after_ms:0, save:true,
      mode:"fixed_set_critical", stimuli:[],
      stop_rule:{
        type:"consecutive_response",
        key:"2",
        count:10
      }
    }
  ];

  const customBlocks = () => [{
    id:uid(),
    name:"Block 1",
    trials:10,
    exposure_ms:1000,
    isi_ms:1000,
    break_after_ms:0,
    save:true,
    mode:"uploaded",
    stimuli:[]
  }];

  async function builder(id = null) {
    const all = await DB.listExperiments(true);
    const old = id ? all.find(x => x.id === id) : null;

    if (id && !old) {
      throw new Error("Experiment not found or access denied.");
    }

    const cfg = old?.config || {};

    let blocks = structuredClone(cfg.blocks || customBlocks());

    let responses = structuredClone(cfg.responses || [
      {key:"1",label:"Response 1"},
      {key:"2",label:"Response 2"},
      {key:"3",label:"Response 3"}
    ]);

    content.innerHTML = `
      <div class="section-head">
        <div>
          <h2>${old ? "Edit" : "Create"} Experiment</h2>
          <div class="muted">
            Configure stimuli, blocks, responses and timing.
          </div>
        </div>
      </div>

      <div class="grid two">
        <div class="card">
          <h3>General</h3>

          <div class="field">
            <label>Name</label>
            <input id="name" value="${esc(old?.name || "")}">
          </div>

          <div class="field">
            <label>URL slug</label>
            <input id="slug" value="${esc(old?.slug || "")}">
          </div>

          <div class="field">
            <label>Description</label>
            <textarea id="desc">${esc(old?.description || "")}</textarea>
          </div>

          <div class="field">
            <label>Start from</label>
            <select id="template">
              <option value="custom">Blank / Custom</option>
              <option value="fixed_set"
                ${cfg.template === "fixed_set" ? "selected" : ""}>
                Fixed Set template
              </option>
            </select>
          </div>

          <div class="field">
            <label>Status</label>
            <select id="status">
              <option value="draft">Draft</option>
              <option value="published"
                ${old?.status === "published" ? "selected" : ""}>
                Published
              </option>
              <option value="archived"
                ${old?.status === "archived" ? "selected" : ""}>
                Archived
              </option>
            </select>
          </div>
        </div>

        <div class="card">
          <h3>Response keys</h3>
          <div id="responses"></div>
          <button class="btn" id="addResponse">
            + Add response
          </button>
          <p class="muted">
            Define the response keys and their meanings.
          </p>
        </div>
      </div>

      <div class="section-head" style="margin-top:20px">
        <div>
          <h2>Blocks</h2>
          <div class="muted">
            Create experimental blocks and define their timing.
          </div>
        </div>
        <button class="btn primary" id="addBlock">
          + Add block
        </button>
      </div>

      <div id="blocks"></div>

      <div id="fixedOptions"
        class="card ${cfg.template === "fixed_set" ? "" : "hidden"}"
        style="margin-top:16px">

        <h3>Fixed Set template settings</h3>

        <div class="inline-fields">
          <div class="field">
            <label>Small mm</label>
            <input id="small" type="number"
              value="${cfg.fixed_set?.small_mm ?? 40}">
          </div>
          <div class="field">
            <label>Medium mm</label>
            <input id="medium" type="number"
              value="${cfg.fixed_set?.medium_mm ?? 60}">
          </div>
          <div class="field">
            <label>Large mm</label>
            <input id="large" type="number"
              value="${cfg.fixed_set?.large_mm ?? 80}">
          </div>
        </div>

        <div class="inline-fields">
          <div class="field">
            <label>Fixation mm</label>
            <input id="fix" type="number"
              value="${cfg.fixed_set?.fixation_mm ?? 4}">
          </div>
          <div class="field">
            <label>Gap mm</label>
            <input id="gap" type="number"
              value="${cfg.fixed_set?.gap_mm ?? 15}">
          </div>
          <div class="field">
            <label>Asymmetry threshold</label>
            <input id="asym" type="number" step=".01"
              value="${cfg.fixed_set?.asymmetry_threshold ?? .70}">
          </div>
        </div>
      </div>

      <div class="row" style="margin-top:16px">
        <button class="btn primary" id="save">
          Save experiment
        </button>
        <button class="btn" id="cancel">
          Cancel
        </button>
      </div>
    `;

    const nameEl = document.getElementById("name");
    const slugEl = document.getElementById("slug");
    const descEl = document.getElementById("desc");
    const templateEl = document.getElementById("template");
    const statusEl = document.getElementById("status");

    nameEl.oninput = () => {
      if (!old && !slugEl.value) {
        slugEl.value = slugify(nameEl.value);
      }
    };

    templateEl.onchange = () => {
      document.getElementById("fixedOptions")
        .classList.toggle("hidden", templateEl.value !== "fixed_set");

      if (templateEl.value === "fixed_set" && !old) {
        blocks = fixedBlocks();
        responses = [
          {key:"1",label:"მარცხენა დიდია"},
          {key:"2",label:"ტოლია"},
          {key:"3",label:"მარჯვენა დიდია"}
        ];
        renderResponses();
        renderBlocks();
      }
    };

    document.getElementById("addResponse").onclick = () => {
      responses.push({key:"",label:""});
      renderResponses();
    };

    document.getElementById("addBlock").onclick = () => {
      blocks.push({
        id:uid(),
        name:`Block ${blocks.length + 1}`,
        trials:10,
        exposure_ms:1000,
        isi_ms:1000,
        break_after_ms:0,
        save:true,
        mode:"uploaded",
        stimuli:[]
      });
      renderBlocks();
    };

    document.getElementById("cancel").onclick =
      () => navigate("experiments");

    function renderResponses() {
      const el = document.getElementById("responses");

      el.innerHTML = responses.map((r,i) => `
        <div class="inline-fields"
          style="grid-template-columns:100px 1fr 40px">

          <div class="field">
            <label>Key</label>
            <input data-rkey="${i}" value="${esc(r.key)}">
          </div>

          <div class="field">
            <label>Meaning</label>
            <input data-rlabel="${i}" value="${esc(r.label)}">
          </div>

          <button class="ghost" data-rdel="${i}"
            style="margin-top:24px">×</button>
        </div>
      `).join("");

      document.querySelectorAll("[data-rkey]").forEach(x => {
        x.oninput = () => {
          responses[+x.dataset.rkey].key = x.value;
        };
      });

      document.querySelectorAll("[data-rlabel]").forEach(x => {
        x.oninput = () => {
          responses[+x.dataset.rlabel].label = x.value;
        };
      });

      document.querySelectorAll("[data-rdel]").forEach(x => {
        x.onclick = () => {
          responses.splice(+x.dataset.rdel,1);
          renderResponses();
        };
      });
    }

    function renderBlocks() {
      const el = document.getElementById("blocks");

      el.innerHTML = blocks.map((b,i) => `
        <div class="card" style="margin-bottom:14px">

          <div class="section-head">
            <h3>${esc(b.name || `Block ${i+1}`)}</h3>
            <button class="ghost" data-bdel="${i}">
              Remove
            </button>
          </div>

          <div class="inline-fields">
            <div class="field">
              <label>Block name</label>
              <input data-b="${i}" data-k="name"
                value="${esc(b.name)}">
            </div>

            <div class="field">
              <label>Trials</label>
              <input type="number" data-b="${i}" data-k="trials"
                value="${Number(b.trials) || 1}">
            </div>

            <div class="field">
              <label>Save data</label>
              <select data-b="${i}" data-k="save">
                <option value="true"
                  ${b.save !== false ? "selected" : ""}>Yes</option>
                <option value="false"
                  ${b.save === false ? "selected" : ""}>No</option>
              </select>
            </div>
          </div>

          <div class="inline-fields">
            <div class="field">
              <label>Exposure ms</label>
              <input type="number" data-b="${i}"
                data-k="exposure_ms" value="${Number(b.exposure_ms) || 1000}">
            </div>

            <div class="field">
              <label>ISI ms</label>
              <input type="number" data-b="${i}"
                data-k="isi_ms" value="${Number(b.isi_ms) || 0}">
            </div>

            <div class="field">
              <label>Break after (sec)</label>
              <input type="number" data-b="${i}"
                data-k="break_sec"
                value="${(b.break_after_ms || 0) / 1000}">
            </div>
          </div>

          <div class="field">
            <label>Stimulus presentation</label>
            <select data-b="${i}" data-k="mode">
              <option value="uploaded"
                ${b.mode === "uploaded" ? "selected" : ""}>
                Uploaded stimulus files
              </option>
              <option value="fixed_set_practice"
                ${b.mode === "fixed_set_practice" ? "selected" : ""}>
                Fixed Set — practice
              </option>
              <option value="fixed_set_control"
                ${b.mode === "fixed_set_control" ? "selected" : ""}>
                Fixed Set — control
              </option>
              <option value="fixed_set_induction"
                ${b.mode === "fixed_set_induction" ? "selected" : ""}>
                Fixed Set — induction
              </option>
              <option value="fixed_set_critical"
                ${b.mode === "fixed_set_critical" ? "selected" : ""}>
                Fixed Set — critical
              </option>
            </select>
          </div>

          <div class="field">
            <label>Upload stimuli (images / audio / video)</label>
            <input type="file" multiple data-upload="${i}"
              accept="image/*,audio/*,video/*">
          </div>

          <div class="muted" id="files-${i}">
            ${(b.stimuli || []).map(s => esc(s.name)).join(" · ")
              || "No files uploaded"}
          </div>

          <div class="inline-fields" style="margin-top:10px">
            <div class="field">
              <label>Stop rule</label>
              <select data-b="${i}" data-k="stop_type">
                <option value="fixed">Fixed N</option>
                <option value="consecutive_response"
                  ${b.stop_rule?.type === "consecutive_response"
                    ? "selected" : ""}>
                  Consecutive response
                </option>
              </select>
            </div>

            <div class="field">
              <label>Response key</label>
              <input data-b="${i}" data-k="stop_key"
                value="${esc(b.stop_rule?.key || "")}">
            </div>

            <div class="field">
              <label>Consecutive N</label>
              <input type="number" data-b="${i}" data-k="stop_count"
                value="${b.stop_rule?.count || 10}">
            </div>
          </div>
        </div>
      `).join("");

      document.querySelectorAll("[data-b]").forEach(x => {
        x.oninput = () => updateBlock(x);
        x.onchange = () => updateBlock(x);
      });

      document.querySelectorAll("[data-bdel]").forEach(x => {
        x.onclick = () => {
          blocks.splice(+x.dataset.bdel,1);
          renderBlocks();
        };
      });

      document.querySelectorAll("[data-upload]").forEach(x => {
        x.onchange = async () => {
          const i = +x.dataset.upload;
          const files = Array.from(x.files);
          x.disabled = true;

          try {
            for (const f of files) {
              const asset = await DB.uploadStimulus(f);
              blocks[i].stimuli = blocks[i].stimuli || [];
              blocks[i].stimuli.push(asset);
            }
          } catch (e) {
            showError(e);
          } finally {
            x.disabled = false;
            renderBlocks();
          }
        };
      });
    }

    function updateBlock(x) {
      const b = blocks[+x.dataset.b];
      const k = x.dataset.k;
      const v = x.value;

      if (["trials","exposure_ms","isi_ms"].includes(k)) {
        b[k] = +v;
      } else if (k === "break_sec") {
        b.break_after_ms = +v * 1000;
      } else if (k === "save") {
        b.save = v === "true";
      } else if (k === "stop_type") {
        b.stop_rule = v === "consecutive_response"
          ? {
              type:v,
              key:b.stop_rule?.key || "",
              count:b.stop_rule?.count || 10
            }
          : null;
      } else if (k === "stop_key") {
        b.stop_rule = b.stop_rule || {
          type:"consecutive_response",count:10
        };
        b.stop_rule.key = v;
      } else if (k === "stop_count") {
        b.stop_rule = b.stop_rule || {
          type:"consecutive_response",key:""
        };
        b.stop_rule.count = +v;
      } else {
        b[k] = v;
      }
    }

    renderResponses();
    renderBlocks();

    document.getElementById("save").onclick = async () => {
      if (!nameEl.value.trim() || !slugEl.value.trim()) {
        return alert("Name და URL slug აუცილებელია.");
      }

      if (!responses.length || responses.some(r => !r.key.trim())) {
        return alert("დაამატე მინიმუმ ერთი სწორი response key.");
      }

      const payload = {
        id:old?.id || uid(),
        name:nameEl.value.trim(),
        slug:slugEl.value.trim(),
        description:descEl.value.trim(),
        status:statusEl.value,
        version:old?.version || 1,
        config:{
          builder_version:2,
          template:templateEl.value,
          calibration:templateEl.value === "fixed_set",
          responses,
          blocks,
          fixed_set:templateEl.value === "fixed_set"
            ? {
                small_mm:+document.getElementById("small").value,
                medium_mm:+document.getElementById("medium").value,
                large_mm:+document.getElementById("large").value,
                fixation_mm:+document.getElementById("fix").value,
                gap_mm:+document.getElementById("gap").value,
                asymmetry_threshold:+document.getElementById("asym").value
              }
            : null
        }
      };

      const saveBtn = document.getElementById("save");
      saveBtn.disabled = true;

      try {
        await DB.saveExperiment(payload);
        await navigate("experiments");
      } catch (e) {
        showError(e);
        saveBtn.disabled = false;
      }
    };
  }

  async function results() {
    const exps = await DB.listExperiments(true);

    content.innerHTML = `
      <div class="section-head">
        <div>
          <h2>${admin ? "All Results" : "My Research Results"}</h2>
          <div class="muted">
            Excel export includes participant summaries and trial data.
          </div>
        </div>
        <button class="btn primary" id="xlsx">
          Download Excel
        </button>
      </div>

      <div class="field" style="max-width:420px">
        <label>Experiment</label>
        <select id="filter">
          <option value="">All my accessible experiments</option>
          ${exps.map(x => `
            <option value="${esc(x.id)}">${esc(x.name)}</option>
          `).join("")}
        </select>
      </div>

      <div id="resultBody"></div>
    `;

    const filterEl = document.getElementById("filter");
    const resultBody = document.getElementById("resultBody");

    filterEl.onchange = () => load();
    document.getElementById("xlsx").onclick = () => exportExcel();

    await load();

    async function load() {
      try {
        const {sessions,trials} =
          await DB.adminResults(filterEl.value || null);

        const complete = sessions.filter(x => x.completed_at).length;

        resultBody.innerHTML = `
          <div class="grid three" style="margin-bottom:16px">
            <div class="card kpi">
              <div class="number">${sessions.length}</div>
              <div class="label">Sessions</div>
            </div>
            <div class="card kpi">
              <div class="number">${complete}</div>
              <div class="label">Completed</div>
            </div>
            <div class="card kpi">
              <div class="number">${trials.length}</div>
              <div class="label">Trials saved</div>
            </div>
          </div>
        `;
      } catch (e) {
        showError(e);
      }
    }

    async function exportExcel() {
      try {
        const {sessions,trials} =
          await DB.adminResults(filterEl.value || null);

        if (!window.XLSX) {
          return alert("Excel library ვერ ჩაიტვირთა.");
        }

        const expMap = Object.fromEntries(
          exps.map(x => [x.id,x])
        );

        const group = {};

        for (const t of trials) {
          (group[t.session_id] ??= []).push(t);
        }

        const summary = sessions.map(s => {
          const ts = (group[s.id] || []).sort(
            (a,b) => (a.global_trial || 0) - (b.global_trial || 0)
          );

          const row = {
            Participant:s.participant_code,
            Experiment:expMap[s.experiment_id]?.name || s.experiment_id,
            Started:s.created_at,
            Completed:s.completed_at || "",
            Device:s.device_type || "",
            Validity:s.validity_status || "",
            "Total saved trials":ts.length
          };

          const blockNames = [...new Set(ts.map(t => t.series))];

          for (const bn of blockNames) {
            const bt = ts.filter(t => t.series === bn);
            const keys = bt.map(t => t.response_key).filter(Boolean);

            row[`${bn} N`] = bt.length;

            for (const k of ["1","2","3"]) {
              const n = keys.filter(x => x === k).length;
              row[`${bn} ${k}`] = n;
              row[`${bn} ${k} %`] = keys.length
                ? +(100 * n / keys.length).toFixed(1)
                : 0;
            }

            row[`${bn} sequence`] =
              bt.map(t => t.response_key || "NA").join(",");

            row[`${bn} missing`] =
              bt.filter(t => t.missing).length;
          }

          const sm = s.summary || {};

          row["Natural asymmetry"] = sm.asymmetry_side || "";
          row["Set large side"] = sm.set_large_side || "";
          row["Extinguished"] = sm.extinguished ?? "";

          return row;
        });

        const raw = trials.map(t => ({
          Participant:t.participant_code,
          Experiment:expMap[t.experiment_id]?.name || t.experiment_id,
          Block:t.series,
          Trial:t.series_trial,
          Global_Trial:t.global_trial,
          Response_Key:t.response_key || "",
          Response:t.response || "",
          RT_ms:t.rt_ms ?? "",
          Missing:t.missing,
          Stimulus_1:t.stimulus_1 || "",
          Stimulus_2:t.stimulus_2 || "",
          Left_Value:t.left_value ?? "",
          Right_Value:t.right_value ?? "",
          Timestamp:t.created_at
        }));

        const settings = exps.map(e => ({
          Experiment:e.name,
          Slug:e.slug,
          Status:e.status,
          Version:e.version,
          Template:e.config?.template || "custom",
          Blocks:(e.config?.blocks || [])
            .map(b => b.name).join(" | "),
          Response_keys:(e.config?.responses || [])
            .map(r => `${r.key}=${r.label}`).join(" | ")
        }));

        const wb = XLSX.utils.book_new();

        const ws1 = XLSX.utils.json_to_sheet(summary);
        const ws2 = XLSX.utils.json_to_sheet(raw);
        const ws3 = XLSX.utils.json_to_sheet(settings);

        [ws1,ws2,ws3].forEach(ws => {
          ws["!freeze"] = {xSplit:0,ySplit:1};
          if (ws["!ref"]) {
            ws["!autofilter"] = {ref:ws["!ref"]};
          }
          ws["!cols"] = Array.from(
            {length:40},
            () => ({wch:18})
          );
        });

        XLSX.utils.book_append_sheet(wb,ws1,"Participants");
        XLSX.utils.book_append_sheet(wb,ws2,"Trial_Data");
        XLSX.utils.book_append_sheet(wb,ws3,"Experiment_Settings");

        XLSX.writeFile(
          wb,
          `cogexperiments-data-${new Date().toISOString().slice(0,10)}.xlsx`
        );
      } catch (e) {
        showError(e);
      }
    }
  }

  function setup() {
    content.innerHTML = `
      <h2>Setup</h2>
      <div class="card">
        <h3>${DB.demo ? "Demo Mode" : "Supabase connected"}</h3>

        <p>
          <b>Account:</b> ${esc(currentUser?.email || "Demo")}
        </p>

        <p>
          <b>Role:</b> ${admin ? "Administrator" : "Researcher"}
        </p>

        <p>
          <b>Platform:</b> CogExperiments v2.2
        </p>

        <p class="muted">
          ${admin
            ? "Administrator access includes all experiments and results."
            : "Researcher access is limited to owned experiments and their results."}
        </p>

        <p class="muted">
          Secret/service-role keys must never be included in frontend code.
        </p>
      </div>
    `;
  }

  init().catch(e => {
    console.error(e);
    app.innerHTML = `
      <div class="alert danger">
        ${esc(e.message)}
      </div>
    `;
  });
})();
