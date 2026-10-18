(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ABILITY_PROFILES = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  // Authored theme, Q/E/C/X gestures and primary ultimate contract. Shared damage/status
  // primitives do not make two contracts equivalent; browser tests check the actual rules.
  const rows = [
    ['hwaryeong','flame','sweep throw throw channel','held-flame-ground-trail'],
    ['seorin','crystal','plant raise throw crush','aimed-flash-freeze'],
    ['muyeong','shadow','draw dash flick gaze','global-live-recon'],
    ['gangcheol','gauntlet','throw brace dash punch','three-manual-shock-punches'],
    ['yeonhwa','lotus','plant bind throw bloom','single-ally-resurrection'],
    ['noeun','drone','flick launch plant switch','global-skill-blackout'],
    ['baekho','bow','draw plant draw draw','three-piercing-bow-shots'],
    ['noeha','electrode','raise dash throw connect','charged-proximity-chain'],
    ['gyeongyeon','mirror','fan sweep gaze fan','manual-knives-kill-refill'],
    ['heuksa','hourglass','throw pull sweep bury','sand-nearsight-decay-volume'],
    ['myeongjong','bell','stretch plant brace toll','falling-bell-weapon-seal'],
    ['jacheol','magnet','plant recall throw reverse','enemy-damage-vulnerability'],
    ['hongyeol','whip','drain guard throw lash','lifedrain-lash-self-rebirth'],
    ['gunbong','bee','throw launch plant hatch','destructible-queen-territory'],
    ['baram','fan','sweep raise brace spin','mobile-outward-vortex'],
    ['geomi','web','climb native cocoon weave','web-dwell-time-entangle'],
    ['byeolbit','star','drop raise raise collapse','gravitational-collapse'],
    ['kallal','dagger','throw dash flick orbit','eight-auto-orbit-blades'],
    ['deonggul','vine','sweep bind scatter knot','breakable-paired-vine-leash'],
    ['neupji','leech','throw plant drain infect','contagion-between-enemies'],
    ['deungbul','lantern','plant open launch sunrise','delayed-sun-flash-ally-heal'],
    ['hwanyeong','mask','fan swap plant multiply','five-fixed-firing-illusions'],
    ['ullim','fork','throw resonate plant resonate','boundary-bullet-absorption'],
    ['hwasan','volcano','throw raise brace erupt','six-sequential-lava-impacts'],
    ['suho','crest','brace connect rally build','four-sided-corner-open-fort'],
    ['hyeollang','claw','rend roar sprint hunt','wounded-prey-vampiric-hunt'],
    ['songgol','bird','fan launch throw dive','telegraphed-falcon-dive'],
    ['haerang','trident','push recall throw surf','advancing-carrying-wave'],
    ['mukhyang','brush','stroke stamp scatter paint','individual-ink-blots'],
    ['yeongwol','crescent','bind recall throw eclipse','ally-reveal-concealment'],
    ['danbi','cloud','raise scatter sweep rain','alternating-storm-strikes'],
    ['cheolhyeol','hammer','slam sprint rage slam','physical-leap-crater'],
    ['chujeok','reticle','flick launch raise execute','single-low-health-execution'],
    ['hoero','chip','hack plant sweep deploy','four-suicide-homing-drones'],
    ['yakcho','vial','pour scatter plant cultivate','finite-cleansing-heal-reservoir'],
    ['cheolbyeok','panel','launch scatter stretch fortify','single-long-steel-wall'],
    ['chochim','clock','flick rewind recoil echo','delayed-team-damage-echo'],
    ['gwanmun','portal','open phase brace banish','temporary-target-removal'],
    ['hwangya','cylinder','spin reload point duel','isolated-one-on-one-duel'],
    ['nachim','compass','throw gaze measure navigate','map-selected-global-warp'],
    ['gamyeon','maskpair','copy disguise swap exchange','target-health-armor-exchange'],
    ['simpan','cards','point whistle stroke dismiss','target-return-to-spawn'],
    ['neon_agent','native','native native native native','mobile-hand-beam-and-slide'],
  ];
  const actions = {
    sweep:'sweep', throw:'throw', channel:'aura', plant:'place', raise:'aura', crush:'ult',
    draw:'point', dash:'dash', flick:'throw', gaze:'point', brace:'sweep', punch:'ult',
    bind:'point', bloom:'ult', launch:'throw', switch:'ult', connect:'point', fan:'sweep',
    pull:'aura', bury:'place', stretch:'sweep', toll:'ult', recall:'aura', reverse:'ult',
    drain:'aura', guard:'aura', lash:'sweep', hatch:'place', spin:'sweep', climb:'point',
    native:'point', cocoon:'aura', weave:'sweep', drop:'place', collapse:'aura', orbit:'aura',
    scatter:'throw', knot:'sweep', infect:'sweep', open:'aura', sunrise:'ult', swap:'sweep',
    multiply:'aura', resonate:'aura', erupt:'ult', rally:'ult', build:'place', rend:'sweep',
    roar:'aura', sprint:'dash', hunt:'aura', dive:'point', push:'sweep', surf:'sweep',
    stroke:'sweep', stamp:'place', paint:'sweep', eclipse:'aura', rain:'aura', slam:'place',
    rage:'aura', execute:'point', hack:'point', deploy:'sweep', pour:'throw', cultivate:'place',
    fortify:'sweep', rewind:'aura', recoil:'dash', echo:'aura', phase:'aura', banish:'point',
    reload:'place', point:'point', duel:'point', measure:'point', navigate:'aura', copy:'aura',
    disguise:'aura', exchange:'sweep', whistle:'aura', dismiss:'point',
  };
  const budgets = Object.freeze({
    mobile:Object.freeze({casts:6,range:55,segments:8,decor:0}),
    perf:Object.freeze({casts:10,range:75,segments:12,decor:1}),
    visual:Object.freeze({casts:16,range:100,segments:18,decor:2}),
    ultra:Object.freeze({casts:20,range:120,segments:24,decor:3}),
  });
  function build(roster) {
    const profiles = {}, agents = {}, errors = [];
    for (const [id,motif,verbs,contract] of rows) {
      const agent = roster.find(a=>a.id===id);
      if (!agent) { errors.push('Missing agent '+id); continue; }
      const gestures = verbs.split(' ');
      agents[id] = {id,motif,contract};
      agent.abilities.forEach((d,i)=>{
        if (profiles[d.type]) errors.push('Repeated type '+d.type);
        const gesture = gestures[i], base = actions[gesture];
        if (!base) errors.push('Unknown gesture '+gesture);
        profiles[d.type] = Object.freeze({type:d.type,agent:id,key:d.key,motif,gesture,base,
          native:id==='neon_agent'||d.type==='y_webzip',ult:!!d.ult,
          duration:({dash:.38,throw:.55,place:.65,point:.5,sweep:.7,aura:.85,ult:1})[base],
          // Keyframed timing is shared with the hand and spectator body, not a random wiggle.
          release:({throw:.46,place:.58,point:.42,sweep:.5,aura:.64,ult:.65,dash:.18})[base]});
      });
    }
    for (const a of roster) if (!agents[a.id]) errors.push('Unprofiled agent '+a.id);
    return {profiles,agents,errors};
  }
  function lineDistance(p,a,b) {
    const dx=b.x-a.x,dz=b.z-a.z,L=dx*dx+dz*dz;
    const t=L?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/L)):0;
    return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
  }
  function chainTargets(first,candidates,reach,limit,visible) {
    const out=first?[first]:[];
    while(out.length && out.length<limit) {
      const last=out[out.length-1];
      const next=candidates.filter(a=>a.alive&&!out.includes(a)&&Math.hypot(a.pos.x-last.pos.x,a.pos.z-last.pos.z)<=reach&&(!visible||visible(last,a)))
        .sort((a,b)=>Math.hypot(a.pos.x-last.pos.x,a.pos.z-last.pos.z)-Math.hypot(b.pos.x-last.pos.x,b.pos.z-last.pos.z)||String(a.id).localeCompare(String(b.id)))[0];
      if(!next) break;out.push(next);
    }
    return out;
  }
  const smooth = x => (x=Math.max(0,Math.min(1,x)),x*x*(3-2*x));
  function phase(profile,time) {
    const p=Math.max(0,Math.min(1,time/profile.duration)),r=profile.release;
    return {p,prepare:smooth(p/r),release:smooth((p-r)/.14),recover:smooth((p-r-.14)/(1-r-.14)),
      weight:smooth(p/.12)*smooth((1-p)/.18)};
  }
  return Object.freeze({rows,actions,budgets,build,lineDistance,chainTargets,phase});
});
