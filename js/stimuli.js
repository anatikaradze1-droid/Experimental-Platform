(() => {
  function mmToPx(mm,pxPerMm){return mm*pxPerMm}

  function baseGeometry(leftMm,rightMm,config,pxPerMm){
    const cx=innerWidth/2, cy=innerHeight/2;
    const fixD=mmToPx(config.fixation_mm||4,pxPerMm);
    const gap=mmToPx(config.gap_mm||15,pxPerMm);
    const l=mmToPx(leftMm,pxPerMm), r=mmToPx(rightMm,pxPerMm);
    return {
      cx,cy,fixD,l,r,
      leftX:cx-fixD/2-gap-l/2,
      rightX:cx+fixD/2+gap+r/2
    };
  }

  const Stimuli = {
    circle:{
      render(layer,{leftMm,rightMm,config,pxPerMm}){
        const g=baseGeometry(leftMm,rightMm,config,pxPerMm);
        layer.innerHTML=`
          <div class="stim-circle" style="width:${g.l}px;height:${g.l}px;left:${g.leftX}px;top:${g.cy}px"></div>
          <div class="fixation" style="width:${g.fixD}px;height:${g.fixD}px"></div>
          <div class="stim-circle" style="width:${g.r}px;height:${g.r}px;left:${g.rightX}px;top:${g.cy}px"></div>`;
      }
    },
    line:{
      render(layer,{leftMm,rightMm,config,pxPerMm}){
        const g=baseGeometry(8,8,config,pxPerMm);
        const thick=mmToPx(config.line_thickness_mm||2,pxPerMm);
        const lh=mmToPx(leftMm,pxPerMm), rh=mmToPx(rightMm,pxPerMm);
        layer.innerHTML=`
          <div class="stim-line" style="width:${thick}px;height:${lh}px;left:${g.leftX}px;top:${g.cy}px"></div>
          <div class="fixation" style="width:${g.fixD}px;height:${g.fixD}px"></div>
          <div class="stim-line" style="width:${thick}px;height:${rh}px;left:${g.rightX}px;top:${g.cy}px"></div>`;
      }
    },
    audio:{
      async play({leftValue,rightValue,config,audioContext}){
        // v2 scaffold: sequential tone presentation can be configured later.
        // Tone synthesis is intentionally isolated from the experiment engine.
        const ctx=audioContext||new (window.AudioContext||window.webkitAudioContext)();
        const duration=(config.audio_duration_ms||500)/1000;
        for(const hz of [leftValue,rightValue]){
          const osc=ctx.createOscillator(),gain=ctx.createGain();
          osc.frequency.value=hz;gain.gain.value=0.08;
          osc.connect(gain).connect(ctx.destination);
          osc.start();osc.stop(ctx.currentTime+duration);
          await new Promise(r=>setTimeout(r,duration*1000+(config.audio_pair_gap_ms||250)));
        }
      }
    }
  };

  window.Stimuli=Stimuli;
})();