const nodes = [
  ['sprout',24,.30,[], 'plants'], ['pump',36,.42,['sprout'],'water'], ['bed',60,.59,['sprout'],'plants'],
  ['gutters',96,.82,['pump'],'water'], ['flowers',150,1.15,['bed'],'plants'], ['glass',300,1.61,['pump'],'climate'],
  ['cistern',510,2.26,['gutters'],'water'], ['herbs',810,3.16,['flowers'],'plants'], ['gears',1320,4.43,['pump'],'mechanisms'],
  ['mirrors',2160,6.20,['glass'],'climate'], ['bees',3480,8.68,['flowers'],'life'],
  ['irrigation',5520,12.15,['cistern','bed'],'water'], ['vines',8760,17.01,['herbs'],'plants'],
  ['timer',14400,23.81,['gears'],'mechanisms'], ['vents',21600,33.34,['mirrors'],'climate'],
  ['butterflies',36000,46.67,['flowers','mirrors'],'life'], ['filter',57600,65.34,['irrigation'],'water'],
  ['pollination',92400,0,['bees','flowers','gutters'],'synergy',1.50], ['orchid',146400,128.06,['vines'],'plants'],
  ['auto_valves',240000,179.29,['timer','irrigation'],'mechanisms'], ['heater',372000,251,['vents'],'climate'],
  ['pond',650000,560,['filter'],'water'], ['dragonflies',850000,520,['pond','bees'],'life'],
  ['humidity',1100000,0,['pond','vents'],'synergy',1.35], ['canopy',1400000,1250,['orchid'],'plants'],
  ['roof_drive',1900000,1650,['auto_valves','vents'],'mechanisms'], ['climate',2600000,2300,['heater'],'climate'],
  ['birds',3600000,3400,['canopy','dragonflies'],'life'], ['ecosystem',4700000,0,['birds','climate','roof_drive'],'synergy',1.75],
  ['central_bud',6500000,7000,['ecosystem','canopy'],'final'], ['open_roof',9000000,0,['central_bud','roof_drive'],'final',1.30],
  ['final_bloom',12500000,0,['open_roof','birds','pond'],'final'],
].map(([id,cost,income,requires,branch,multiplier=1])=>({id,cost,income,requires,branch,multiplier}));

const byId = Object.fromEntries(nodes.map(n=>[n.id,n]));
const activeShare = {water:0, plants:1, mechanisms:.5, climate:.3, life:.7, synergy:.5, final:.5};
const profiles = [
  {id:'passive', taps:0.0, minHours:3.8, maxHours:4.5},
  {id:'mixed', taps:0.8, minHours:2.6, maxHours:3.3},
  {id:'active', taps:1.8, minHours:1.9, maxHours:2.5},
];

function multiplier(unlocked){ let m=1; for(const n of nodes) if(unlocked.has(n.id)) m*=n.multiplier; return m; }
function production(unlocked){
  let passive=0, active=0;
  for(const n of nodes){
    if(!unlocked.has(n.id)) continue;
    const a=activeShare[n.branch] ?? .5;
    passive += n.income*(1-a);
    active += n.income*a;
  }
  const m=multiplier(unlocked);
  return {passive:passive*m, active:active*m};
}
function validateGraph(){
  if(nodes.length!==32) throw new Error(`expected 32 nodes, got ${nodes.length}`);
  for(const n of nodes) for(const r of n.requires) if(!byId[r]) throw new Error(`${n.id}: missing ${r}`);
}
function simulate(profile){
  const unlocked=new Set(); let growth=0, t=0; const timeline=[];
  while(!unlocked.has('final_bloom') && t<6*3600){
    const p=production(unlocked);
    const taps = unlocked.has('pump') ? profile.taps : Math.max(profile.taps,1);
    const tapValue = 1 + p.active/2;
    growth += p.passive + taps*tapValue;
    let changed=true;
    while(changed){
      changed=false;
      const affordable=nodes.filter(n=>!unlocked.has(n.id) && n.requires.every(r=>unlocked.has(r)) && growth>=n.cost)
        .sort((a,b)=>a.cost-b.cost || a.id.localeCompare(b.id));
      if(affordable.length){ const n=affordable[0]; growth-=n.cost; unlocked.add(n.id); timeline.push({second:t,id:n.id}); changed=true; }
    }
    t+=1;
  }
  if(!unlocked.has('final_bloom')) throw new Error(`${profile.id}: no final within 6h`);
  const waits=timeline.map((e,i)=>e.second-(i?timeline[i-1].second:0));
  return {seconds:t,hours:t/3600,longest:Math.max(...waits),count:timeline.length};
}
function fmt(s){const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return `${h}h ${String(m).padStart(2,'0')}m`;}
validateGraph();
let failed=false;
for(const p of profiles){
  const r=simulate(p);
  console.log(`[${p.id}] ${fmt(r.seconds)} | longest gap ${(r.longest/60).toFixed(1)}m | ${r.count}/32`);
  if(r.hours<p.minHours || r.hours>p.maxHours){console.error(`FAIL ${p.id}: ${r.hours.toFixed(2)}h outside ${p.minHours}-${p.maxHours}`);failed=true;}
  if(r.longest>20*60){console.error(`FAIL ${p.id}: gap >20m`);failed=true;}
  if(r.count!==32){console.error(`FAIL ${p.id}: not all nodes`);failed=true;}
}
if(failed) process.exit(1);
console.log('P4 engagement economy passed: additive base tap + branch active/passive split + flattened late game.');
