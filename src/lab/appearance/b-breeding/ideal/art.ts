/** Artist-authored complete ideals on the FIRST B pose, not new bodies. Each
 * ordered operation is a meaningful whole contour. A weakened feature exposes
 * another deliberately drawn contour, never eroded/noisy pixels or opacity.
 * This visual model is NOT a claim of real modifier genes or an aesthetic law. */
export type Morph='normal'|'lilly'|'axanthic'|'cappuccino'|'highway'|'sable';
export type Channel='cream'|'dorsal'|'flank'|'limbs'|'bridge'|'stripe'|'face'|'crown'|'tail'|'balance'|'contrast';
export type Point=readonly [number,number];
export type Material='source'|'skin'|'cream'|'white'|'dark';
export interface Patch {name:string;region:'body'|'tail'|'head'|'limbs';material:Material;path:readonly Point[];channel?:Channel;at?:number;below?:boolean;creamOnly?:boolean;cadence?:boolean}
export interface IdealArt {id:string;morph:Morph;label:string;direction:string;patches:readonly Patch[]}
const patch=(name:string,region:Patch['region'],material:Material,path:readonly Point[],channel?:Channel,at=0,options:Partial<Pick<Patch,'below'|'creamOnly'|'cadence'>>={}):Patch=>({name,region,material,path,channel,at,...options});
const side:readonly Point[]=[[35,35],[46,35],[61,39],[74,43],[76,49],[68,52],[53,51],[39,45],[34,40]];
const back:readonly Point[]=[[33,28],[43,29],[49,31],[54,31],[63,34],[69,35],[77,40],[81,45],[76,46],[71,42],[66,42],[61,39],[56,39],[51,36],[46,36],[41,33],[36,34]];
const tail:readonly Point[]=[[75,40],[84,44],[90,53],[94,65],[89,73],[80,79],[69,82],[56,77],[50,69],[53,66],[58,72],[66,75],[75,75],[83,70],[85,62],[82,52],[76,47]];
const normalGaps:Patch[]=[
 patch('등 안장 한쪽 끊김','body','skin',[[44,30],[48,30],[51,34],[48,37],[45,35]],'dorsal',.97,{below:true,creamOnly:true}),
 patch('등 뒤쪽 분리','body','skin',[[61,33],[66,34],[69,38],[66,41],[63,39]],'dorsal',.72,{below:true,creamOnly:true}),
 patch('측면 앞쪽 갈색 창','body','skin',[[40,37],[45,38],[48,42],[46,46],[42,45],[39,41]],'flank',.91,{below:true,creamOnly:true}),
 patch('측면 뒤쪽 갈색 창','body','skin',[[55,40],[60,40],[65,43],[65,47],[60,49],[56,46]],'cream',.46,{below:true,creamOnly:true}),
 patch('아래 크림 다리의 단절','body','skin',[[48,44],[52,44],[55,48],[52,51],[48,49]],'bridge',.68,{below:true,creamOnly:true,cadence:true}),
 patch('꼬리 중간 갈색 띠','tail','skin',[[83,56],[92,56],[93,62],[86,65],[83,61]],'tail',.92,{below:true,creamOnly:true}),
 patch('꼬리 아래 띠 분리','tail','skin',[[65,72],[70,73],[73,80],[68,82],[65,77]],'tail',.5,{below:true,creamOnly:true})
 ,patch('낮은 측면 발현의 넓은 갈색 여백','body','skin',[[38,35],[46,36],[51,39],[51,47],[46,49],[40,45],[37,40]],'flank',.9,{below:true,creamOnly:true})
 ,patch('낮은 크림 발현의 뒤쪽 여백','body','skin',[[51,39],[62,39],[70,43],[72,49],[65,52],[55,49]],'cream',.57,{below:true,creamOnly:true})
];
// One ideal per morph today, arrays leave room for alternative beauty goals.
export const IDEALS:readonly IdealArt[]=[
 {id:'normal-warm-windows',morph:'normal',label:'노멀',direction:'첫 B의 따뜻한 등 띠·측면 창문·꼬리 흐름 자체를 이상형으로 삼습니다.',patches:normalGaps},
 {id:'lilly-ivory-river',morph:'lilly',label:'릴리화이트',direction:'아이보리의 큰 측면 흐름과 얼굴까지 이어지는 백색. 갈색 창과 원본의 주름을 남깁니다.',patches:[
  patch('항상 남는 백색 측면','body','white',[[35,41],[42,42],[47,44],[53,46],[61,47],[68,47],[71,49],[66,51],[59,51],[52,49],[44,48],[38,45]]),
  patch('측면 안쪽 백색','body','white',[[34,37],[39,38],[43,39],[47,38],[53,40],[58,40],[64,42],[71,43],[73,47],[69,50],[65,49],[61,50],[57,48],[53,49],[48,46],[44,47],[39,44],[35,43]],'cream',.25),
  patch('넓은 어깨 백색','body','white',[[33,33],[38,34],[41,36],[44,35],[48,37],[50,40],[46,43],[41,43],[37,41],[34,39]],'cream',.61),
  patch('넓은 허리 백색','body','white',[[51,37],[56,37],[61,39],[66,39],[71,42],[75,45],[73,49],[69,49],[64,47],[59,48],[55,45]],'cream',.95),
  patch('등의 아이보리 띠','body','white',back,'dorsal',.3),
  patch('앞 크림 연결','body','white',[[41,35],[44,36],[46,40],[49,43],[51,46],[48,48],[44,45],[41,41]],'bridge',.72),
  patch('뒤 크림 연결','body','white',[[59,37],[62,38],[63,42],[66,44],[67,47],[64,49],[61,46],[59,43]],'bridge',.48),
  patch('앞 연결의 갈색 틈','body','skin',[[44,39],[47,39],[49,42],[47,46],[44,44]],'bridge',.4,{below:true,cadence:true}),
  patch('뒤 분포의 작은 창','body','skin',[[64,41],[69,42],[71,45],[68,48],[65,46]],'balance',.4,{below:true}),
  patch('원화의 눈 아래 갈색 창','body','skin',[[37,36],[39,36],[41,38],[40,40],[37,39]]),
  patch('어깨·앞다리 백색','limbs','white',[[28,38],[37,40],[40,45],[39,51],[41,55],[37,57],[34,53],[36,49],[32,44]],'limbs',.55),
  patch('허벅지 백색','limbs','white',[[64,46],[71,46],[74,50],[70,54],[72,57],[68,59],[64,56],[66,52],[63,50]],'limbs',.75),
  patch('꼬리 바깥 아이보리','tail','white',tail,'tail',.4),
  patch('턱 위 백색','head','white',[[7,27],[13,25],[19,27],[28,29],[33,28],[35,31],[29,33],[18,33],[9,31]],'face',.43),
  patch('얼굴 위쪽 확장','head','white',[[10,23],[15,20],[21,17],[29,19],[34,22],[35,28],[30,31],[21,30],[12,29],[7,27]],'face',.78),
  patch('코 끝 도달','head','white',[[5,26],[9,23],[13,23],[16,26],[14,29],[8,30],[5,29]],'face',.999),
  patch('피복 부족 시 어깨의 갈색 확장','body','skin',[[35,35],[42,35],[48,38],[49,43],[45,45],[40,42],[36,41]],'cream',.82,{below:true}),
  patch('피복 부족 시 허리의 갈색 확장','body','skin',[[54,40],[62,39],[70,43],[73,47],[70,50],[65,47],[60,48],[55,45]],'cream',.6,{below:true}),
  patch('낮은 피복의 큰 갈색 창','body','skin',[[40,40],[46,40],[51,44],[57,44],[61,48],[57,51],[49,48],[42,47],[38,43]],'cream',.3,{below:true}),
  patch('앞 백색 흐름의 명확한 단절','body','skin',[[45,36],[48,37],[51,43],[50,48],[47,49],[46,44]],'bridge',.78,{below:true,cadence:true}),
  patch('뒤 백색 흐름의 명확한 단절','body','skin',[[60,39],[63,40],[66,45],[65,50],[62,51],[61,46]],'bridge',.42,{below:true})
 ]},
 {id:'axanthic-silver-ink',morph:'axanthic',label:'아잔틱',direction:'검정 안장과 은빛 패턴을 분리한 재질. 유전된 밝기가 바뀌어도 명암 단계는 유지합니다.',patches:[
  patch('검정 안장 바탕','body','dark',[[35,33],[43,34],[49,36],[56,36],[64,39],[71,40],[74,44],[71,47],[64,45],[59,44],[54,44],[48,42],[43,43],[38,40]]),
  patch('은빛 등 안장','body','cream',back,'dorsal',.25),
  patch('앞 은빛 무늬','body','cream',[[39,38],[43,36],[46,38],[45,41],[48,44],[46,47],[42,45],[40,42]],'flank',.25),
  patch('뒤 은빛 무늬','body','cream',[[55,41],[59,39],[63,41],[65,44],[63,48],[59,49],[56,47]],'cream',.95),
  patch('은빛 밑선 연결','body','cream',[[43,45],[48,45],[53,47],[59,47],[64,48],[66,50],[60,52],[52,50],[45,49]],'bridge',.73),
  patch('등 앞 검은 틈','body','dark',[[46,31],[50,32],[53,36],[50,39],[47,36]],'stripe',.5,{below:true,cadence:true}),
  patch('꼬리 검정 띠','tail','dark',[[83,53],[92,55],[94,61],[87,63],[83,59]]),
  patch('꼬리 두번째 검정 띠','tail','dark',[[67,72],[72,73],[75,80],[69,81],[66,77]]),
  patch('밝은 꼬리 기부','tail','cream',[[78,43],[84,46],[88,51],[86,55],[81,52],[79,48]],'tail',.5),
  patch('적은 측면 패턴의 검정 여백','body','dark',[[39,37],[46,37],[50,42],[48,47],[43,47],[39,43]],'flank',.78,{below:true}),
  patch('적은 크림의 뒤쪽 검정 여백','body','dark',[[54,40],[61,40],[66,44],[65,49],[59,50],[55,46]],'cream',.55,{below:true}),
  patch('약한 연결의 검정 틈','body','dark',[[49,41],[52,41],[55,47],[53,51],[50,48]],'bridge',.72,{below:true,cadence:true}),
  patch('낮은 대비의 회색 안장','body','skin',[[36,34],[45,34],[52,37],[59,37],[68,41],[71,44],[66,45],[58,42],[51,43],[44,40],[39,40]],'contrast',.4,{below:true})
 ]},
 {id:'cappuccino-coffee-tail',morph:'cappuccino',label:'카푸치노',direction:'커피색 몸통, 절제된 등 무늬와 밝은 꼬리 기부·짙은 끝의 대비를 강조합니다.',patches:[
  patch('기존 측면 크림을 커피색으로 복원','body','skin',side,undefined,0,{creamOnly:true}),
  patch('절제된 등 띠','body','skin',[[40,30],[46,30],[53,32],[60,34],[67,36],[75,39],[77,43],[73,43],[66,39],[59,38],[52,35],[45,35]],undefined,0,{creamOnly:true}),
  patch('목 뒤 커피 크림','body','cream',[[35,30],[41,31],[45,33],[44,35],[40,35],[37,34]],'dorsal',.3),
  patch('등의 따뜻한 끊긴 무늬','body','cream',[[50,33],[55,33],[59,35],[61,37],[58,39],[54,37],[51,37]],'dorsal',.62),
  patch('등 뒤 크림 조각','body','cream',[[65,37],[70,38],[75,41],[73,44],[69,42],[66,41]],'dorsal',.81),
  patch('작은 앞 측면 무늬','body','cream',[[41,43],[44,43],[47,46],[45,48],[42,47]],'flank',.5),
  patch('작은 뒤 측면 무늬','body','cream',[[60,47],[64,47],[67,49],[64,51],[61,50]],'flank',.78),
  patch('꼬리 기부의 코어','tail','cream',[[78,43],[83,45],[87,50],[86,54],[83,54],[81,50]]),
  patch('꼬리 기부의 넓은 밝음','tail','white',[[76,42],[82,44],[87,48],[90,54],[88,59],[84,56],[82,51],[79,48]],'tail',.995),
  patch('꼬리 끝 작은 암부','tail','dark',[[51,67],[54,70],[58,73],[60,76],[56,76],[52,73]]),
  patch('꼬리 끝 깊은 암부','tail','dark',[[50,66],[54,69],[57,72],[64,74],[68,74],[69,79],[62,79],[55,76],[51,72]],'tail',.5),
  patch('약한 꼬리 대비에서 남는 중간 크림','tail','cream',[[69,74],[74,75],[77,78],[73,80],[69,78]],'tail',.38,{below:true}),
  patch('밝은 기부가 좁아진 커피색 창','tail','skin',[[80,45],[85,47],[89,52],[89,57],[86,59],[83,54]],'tail',.86,{below:true}),
  patch('어두운 끝의 강도가 약한 꼬리','tail','cream',[[54,70],[58,73],[63,74],[67,76],[66,79],[60,77],[55,74]],'tail',.52,{below:true})
 ]},
 {id:'highway-inner-ribbon',morph:'highway',label:'하이웨이',direction:'안쪽으로 넓게 번지는 등 패턴과 갈색 측면. 중앙 연결이 약하면 다른 자연스러운 끊김으로 바뀝니다.',patches:[
  patch('기존 측면 크림을 원본 피부로 복원','body','skin',side,undefined,0,{creamOnly:true}),
  patch('좁아도 남는 등 핵심','body','cream',[[34,29],[43,30],[49,32],[55,32],[63,35],[70,37],[77,41],[78,44],[73,42],[66,39],[59,37],[52,35],[45,34],[39,33]]),
  patch('등의 중앙 확장','body','cream',[[36,30],[45,31],[50,32],[56,32],[61,34],[67,35],[74,39],[79,43],[77,47],[72,44],[69,44],[65,41],[61,42],[56,39],[52,40],[47,37],[43,38],[39,35]],'dorsal',.38),
  patch('안장 안쪽의 넓은 번짐','body','white',[[41,32],[46,32],[51,34],[57,34],[63,36],[69,38],[75,41],[75,44],[70,43],[66,40],[62,40],[58,38],[53,38],[49,36],[45,36]],'dorsal',.98),
  patch('앞 중앙 연결의 갈색 단절','body','skin',[[46,30],[50,31],[53,36],[50,40],[47,37]],'stripe',.66,{below:true,cadence:true}),
  patch('뒤 중앙 연결의 갈색 단절','body','skin',[[63,34],[67,35],[71,39],[69,44],[66,42]],'stripe',.32,{below:true}),
  patch('약한 등일 때 남는 앞 측면 무늬','body','cream',[[41,40],[45,39],[48,42],[46,46],[43,45]],'dorsal',.6,{below:true}),
  patch('약한 등일 때 남는 뒤 측면 무늬','body','cream',[[58,43],[62,42],[66,45],[64,49],[61,49],[58,46]],'dorsal',.35,{below:true}),
  patch('꼬리 기부의 안장 연결','tail','cream',[[77,42],[82,45],[87,51],[90,58],[88,63],[85,59],[83,53],[79,49]],'tail',.4),
  patch('중앙 연결 앞쪽의 넓은 틈','body','skin',[[46,30],[50,31],[54,36],[52,40],[49,41],[47,37]],'stripe',.88,{below:true,cadence:true}),
  patch('중앙 연결 뒤쪽의 넓은 틈','body','skin',[[62,34],[66,35],[70,39],[69,43],[66,44],[64,40]],'stripe',.55,{below:true}),
  patch('약한 등의 안쪽 갈색 확장','body','skin',[[39,34],[45,34],[51,37],[58,38],[65,41],[70,43],[69,46],[62,43],[55,42],[47,39],[41,39]],'dorsal',.62,{below:true})
 ]},
 {id:'sable-bronze-crown',morph:'sable',label:'세이블',direction:'짙은 브론즈 바탕, 밝은 크라운과 큰 크림 군집. 커피색 카푸치노·등 중심 하이웨이와 분포를 달리합니다.',patches:[
  patch('어두운 측면 바탕','body','skin',side,undefined,0,{creamOnly:true}),
  patch('목 뒤의 밝은 군집','body','cream',[[34,30],[39,30],[42,32],[44,35],[42,37],[39,36],[36,34]]),
  patch('앞 크림 군집','body','cream',[[41,37],[45,37],[47,39],[46,42],[49,44],[46,47],[42,45],[40,42]],'flank',.32),
  patch('뒤 크림 군집','body','cream',[[56,39],[60,38],[64,40],[66,43],[64,47],[60,49],[56,46],[55,43]],'cream',.95),
  patch('작은 허리 군집','body','cream',[[69,43],[72,42],[75,45],[73,49],[70,49],[68,46]],'balance',.65),
  patch('군집 사이의 크림 연결','body','cream',[[45,44],[49,44],[53,46],[58,46],[60,49],[55,50],[50,48],[45,47]],'bridge',.7),
  patch('등 중앙 밝은 크림','body','cream',back,'dorsal',.65),
  patch('크라운 밑의 따뜻한 빛','head','cream',[[17,17],[23,16],[29,18],[34,20],[35,23],[31,24],[28,21],[23,21],[20,19]],'crown',.3),
  patch('크라운의 밝은 끝','head','white',[[19,16],[24,16],[29,18],[33,18],[35,21],[32,22],[28,20],[23,20],[20,18]],'crown',.78),
  patch('꼬리 기부의 크림 군집','tail','cream',[[78,44],[83,46],[86,50],[85,54],[82,52],[80,49]],'tail',.3),
  patch('꼬리 중간 암색','tail','dark',[[85,56],[92,57],[93,64],[88,67],[84,63]]),
  patch('꼬리 아랫부분 암색','tail','dark',[[65,73],[70,74],[73,80],[67,81],[64,77]]),
  patch('허벅지 밝은 군집','limbs','cream',[[65,48],[69,47],[72,50],[70,53],[68,54],[65,52]],'limbs',.6),
  patch('앞 밝은 군집이 줄어든 브론즈 창','body','skin',[[40,37],[44,37],[48,41],[48,45],[44,46],[41,43]],'flank',.73,{below:true}),
  patch('뒤 밝은 군집이 줄어든 브론즈 창','body','skin',[[56,39],[62,40],[66,43],[65,47],[61,49],[57,46]],'cream',.6,{below:true}),
  patch('밝은 군집 사이 어두운 분리','body','skin',[[49,42],[52,42],[55,47],[54,50],[50,48]],'bridge',.6,{below:true,cadence:true})
 ]}
];
export const MORPHS=IDEALS.map(a=>({id:a.morph,label:a.label}));
