// Prologue rules from 镜生万象, slides 3–7. The real die is never rewritten.
export const FACE_NAMES = Object.freeze({front:'正面',back:'背面',top:'上面',bottom:'下面',left:'左面',right:'右面'});
const KEYS = Object.keys(FACE_NAMES);
const BASE = {front:1,back:6,top:2,bottom:5,left:4,right:3};
const clone = s => structuredClone(s);
const isFace = f => Object.hasOwn(FACE_NAMES,f);
export function newDice() {
  return {version:1,phase:'outside',orientation:{...BASE},exposure:3,faces:null,selectedFace:'back',message:'让骰子的六个面都变成 6。',roll:null,rotations:0,edits:0};
}
function turned(o,d) {
  const n={...o};
  if(d==='left')Object.assign(n,{front:o.right,right:o.back,back:o.left,left:o.front});
  if(d==='right')Object.assign(n,{front:o.left,left:o.back,back:o.right,right:o.front});
  if(d==='up')Object.assign(n,{front:o.bottom,bottom:o.back,back:o.top,top:o.front});
  if(d==='down')Object.assign(n,{front:o.top,top:o.back,back:o.bottom,bottom:o.front});
  return n;
}
export function getReflectedFaces(s){return ['front','right','top'].slice(0,s.exposure);}
export function rotateDice(s,d){
  const n=clone(s); if(n.phase!=='outside'||!['left','right','up','down'].includes(d))return n;
  n.orientation=turned(n.orientation,d);n.rotations++;
  n.message=`镜中映出：${getReflectedFaces(n).map(f=>n.orientation[f]).join('、')}`;
  return n;
}
export function setExposure(s,count){
  const n=clone(s);if(n.phase!=='outside'||![1,2,3].includes(count))return n;
  n.exposure=count;n.message=`镜子映出 ${count} 个面，其余 ${6-count} 个面未定。`;return n;
}
export function enterMirror(s){
  const n=clone(s);if(n.phase!=='outside')return n;
  const reflected=getReflectedFaces(n);
  n.faces=Object.fromEntries(KEYS.map(f=>[f,{locked:reflected.includes(f),value:reflected.includes(f)?n.orientation[f]:null}]));
  n.selectedFace=KEYS.find(f=>!n.faces[f].locked);n.phase='inside';n.edits=0;
  n.message=reflected.some(f=>n.orientation[f]!==6)?'映出的面不是 6，镜中无法改写。回到镜外重新调整。':'为未定的面写下点数。';
  return n;
}
export function selectFace(s,face){const n=clone(s);if(n.phase==='inside'&&isFace(face)&&!n.faces[face].locked)n.selectedFace=face;return n;}
export function inscribeFace(s,value){
  const n=clone(s);if(n.phase!=='inside'||!Number.isInteger(value)||value<1||value>6)return n;
  const f=n.faces[n.selectedFace];if(f.locked)return n;
  const cur=n.selectedFace;f.value=value;n.edits++;const nextEmpty=KEYS.find(k=>!n.faces[k].locked&&n.faces[k].value===null);if(nextEmpty)n.selectedFace=nextEmpty;n.message=`${FACE_NAMES[cur]}：${value}`;return n;
}
export function returnOutside(s){const n=clone(s);if(n.phase!=='inside')return n;n.phase='outside';n.faces=null;n.edits=0;n.message='回到镜外。未成形的创造已散去。';return n;}
export function canMaterialize(s){return !!s.faces&&KEYS.every(f=>s.faces[f].value===6);}
export function materialize(s){
  const n=clone(s);if(n.phase!=='inside')return n;
  if(KEYS.some(f=>n.faces[f].locked&&n.faces[f].value!==6)){n.message='已映出的面不是 6，无法成形。';return n;}
  if(!canMaterialize(n)){n.message='还有面不是 6。';return n;}
  n.phase='materialized';n.message='六面皆 6。';return n;
}
export function rollDice(s){const n=clone(s);if(n.phase!=='materialized'||!canMaterialize(n))return n;n.roll=6;n.phase='complete';n.message='无论哪面落下，都是 6。';return n;}
const orientationKey=o=>KEYS.map(k=>o[k]).join(',');
const orientations=new Set([orientationKey(BASE)]),queue=[BASE];
while(queue.length){const o=queue.shift();for(const d of ['left','right','up','down']){const n=turned(o,d),k=orientationKey(n);if(!orientations.has(k)){orientations.add(k);queue.push(n);}}}
export function validateDiceSave(s){
  try{
    if(!s||s.version!==1||!['outside','inside','materialized','complete'].includes(s.phase))return false;
    if(!s.orientation||Object.keys(s.orientation).length!==6||!orientations.has(orientationKey(s.orientation))||![1,2,3].includes(s.exposure)||!isFace(s.selectedFace))return false;
    if(!KEYS.every(f=>Number.isInteger(s.orientation[f])&&s.orientation[f]>=1&&s.orientation[f]<=6))return false;
    if(typeof s.message!=='string'||s.message.length>1000||![s.rotations,s.edits].every(n=>Number.isInteger(n)&&n>=0&&n<1e6))return false;
    if(s.phase==='outside')return s.faces===null&&s.roll===null&&s.edits===0;
    if(!s.faces||Object.keys(s.faces).length!==6)return false;
    const known=getReflectedFaces(s);
    for(const f of KEYS){const face=s.faces[f];if(!face||face.locked!==known.includes(f))return false;if(face.value!==null&&(!Number.isInteger(face.value)||face.value<1||face.value>6))return false;if(face.locked&&face.value!==s.orientation[f])return false;}
    if(s.faces[s.selectedFace].locked)return false;
    if(['materialized','complete'].includes(s.phase)&&!canMaterialize(s))return false;
    return s.phase==='complete'?s.roll===6:s.roll===null;
  }catch{return false;}
}
