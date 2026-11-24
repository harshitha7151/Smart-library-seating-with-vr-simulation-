// Pixel-derived model of the approved third-floor reference image.
export const STATUS = { AVAILABLE: "available", BOOKED: "booked", OCCUPIED: "occupied", UNAVAILABLE: "unavailable", SELECTED: "selected", UNKNOWN: "unknown" };
const sx = x => (x - 680) / 50;
const sz = z => (z - 400) / 50;
const zone = (id, x1, z1, x2, z2, color, y=0) => ({ id, x:(sx(x1)+sx(x2))/2, z:(sz(z1)+sz(z2))/2, w:sx(x2)-sx(x1), d:sz(z2)-sz(z1), color, y });
const wall = (x1,z1,x2,z2) => ({x1:sx(x1),z1:sz(z1),x2:sx(x2),z2:sz(z2)});
function chairsAround(seats,w,d) {
  const a=[];
  const push=(x,z,rot)=>a.push([x,z,rot]);
  if(seats===4){push(0,-d/2-.25,Math.PI);push(0,d/2+.25,0);push(-w/2-.25,0,-Math.PI/2);push(w/2+.25,0,Math.PI/2);return a;}
  if(seats===14){for(let i=0;i<6;i++){let x=-w/2+(i+1)*w/7;push(x,-d/2-.24,Math.PI);push(x,d/2+.24,0);}push(-w/2-.26,0,-Math.PI/2);push(w/2+.26,0,Math.PI/2);return a;}
  if(seats===8 && d>w){
    for(let i=0;i<3;i++){let z=-d/2+(i+1)*d/4;push(-w/2-.24,z,-Math.PI/2);push(w/2+.24,z,Math.PI/2);}
    push(0,-d/2-.24,Math.PI);push(0,d/2+.24,0);return a;
  }
  for(let i=0;i<3;i++){let x=-w/2+(i+1)*w/4;push(x,-d/2-.24,Math.PI);push(x,d/2+.24,0);}push(-w/2-.25,0,-Math.PI/2);push(w/2+.25,0,Math.PI/2);return a;
}
function table(id,label,seats,x,z,w,d,outdoor=false){const halfW=w/100,halfD=d/100;return {id,label,seats,pos:[sx(x),sz(z)],size:[halfW,halfD],outdoor,chairPositions:chairsAround(seats,halfW,halfD).map(p=>[p[0],p[1],p[2]])};}
const tables=[];
[["T1",200], ["T2",295], ["T3",393], ["T4",490], ["T5",605]].forEach(([id,y])=>tables.push(table(id,id+"\n(4)",4,170,y,60,60,true)));
[["T7",220,400],["T8",300,400],["T9",375,400],["T10",220,530],["T11",300,530],["T14",375,530]].forEach(([id,y,x])=>tables.push(table(id,id+"\n(4)",4,x,y,58,48)));
tables.push(table("T6","T6\n(14)",14,460,455,200,48));
[["T12",493],["T13",554],["T15",615],["T16",677],["T24",740]].forEach(([id,y])=>tables.push(table(id,id+"\n(8)",8,862,y,56,54)));
[["T17",964],["T18",1024],["T19",1081],["T20",1140],["T21",1192],["T22",1250],["T23",1305]].forEach(([id,x])=>tables.push(table(id,id+"\n(8)",8,x,375,54,68,true)));
const floorZones=[zone("left-patio",19,100,272,752,"#bfc0bf",0.004),zone("main-hall",272,80,742,500,"#fff8df"),zone("main-east",742,80,922,478,"#fff8df"),zone("bookshelf-wing",288,500,625,650,"#fff8df"),zone("south-corridor",742,478,951,779,"#fff8df"),zone("garden-patio",922,248,1342,506,"#bfc0bf",0.004),zone("shelf-room",951,60,1313,236,"#fff8df")];
const wallSegments=[
wall(272,80,687,80),wall(687,60,772,60),wall(835,60,951,60),wall(951,36,1313,36),wall(1313,36,1313,238),wall(951,236,1313,236),wall(951,60,951,236),
wall(272,80,272,134),wall(272,167,272,263),wall(272,296,272,393),wall(272,426,272,650),wall(272,650,625,650),
 wall(345,94,520,94),wall(345,94,345,165),wall(345,180,435,180),wall(463,180,520,180),wall(520,94,520,180),
 wall(520,180,560,180),wall(588,180,688,180),wall(688,60,688,180),
wall(608,181,608,400),wall(742,478,742,779),wall(742,779,815,779),wall(951,506,951,779),wall(815,779,951,779),
wall(950,236,950,248),wall(950,506,950,650),wall(275,500,625,500),wall(289,512,607,512),wall(289,650,625,650)
];
const doors=[
 {id:"entry-left",x:sx(772),z:sz(61),width:.62,rotation:Math.PI/2},{id:"entry-right",x:sx(835),z:sz(61),width:.62,rotation:-Math.PI/2},
 {id:"office",x:sx(435),z:sz(180),width:.56,rotation:-Math.PI/2},
 {id:"washroom",x:sx(560),z:sz(180),width:.56,rotation:-Math.PI/2},
 {id:"patio-door-north",x:sx(272),z:sz(134),width:.58,rotation:0},
 {id:"patio-door-middle",x:sx(272),z:sz(263),width:.58,rotation:0},
 {id:"patio-door-south",x:sx(272),z:sz(393),width:.58,rotation:0},
 {id:"shelf-room",x:sx(951),z:sz(158),width:.62,rotation:0}
];
const fences=[
 [19,100,288,100],[288,100,288,752],[288,752,19,752],[19,752,19,100],
 [922,248,1342,248],[1342,248,1342,506],[1342,506,922,506],[922,506,922,248]
].map(([x1,z1,x2,z2])=>wall(x1,z1,x2,z2));
const roomLabels=[{id:"office",label:"Office",x:sx(434),z:sz(130),color:"#1737b5"},{id:"washrooms",label:"Washrooms",x:sx(608),z:sz(130),color:"#1737b5"}];
const shelves=[{x:sx(1117),z:sz(80),w:5.3,d:.5},{x:sx(1117),z:sz(121),w:5.3,d:.5},{x:sx(1117),z:sz(158),w:5.3,d:.5},{x:sx(1117),z:sz(199),w:5.3,d:.5},{x:sx(447),z:sz(537),w:6.3,d:.48},{x:sx(447),z:sz(579),w:6.3,d:.48},{x:sx(447),z:sz(622),w:6.3,d:.48},{x:sx(28),z:sz(426),w:.48,d:11.2},{x:sx(710),z:sz(128),w:.46,d:2.1}];
const plants=[];
[52,102,153,205,257,309,361,414,466,521,575,628,681,731].forEach(y=>plants.push({x:sx(55),z:sz(y),scale:.9}));
[52,102,153,205,257,309,361,414,466,521,575,628,681,731].forEach(y=>plants.push({x:sx(247),z:sz(y),scale:.9}));
[82,124,166,208,250].forEach(x=>plants.push({x:sx(x),z:sz(107),scale:.9},{x:sx(x),z:sz(743),scale:.9}));
[944,998,1052,1107,1162,1217,1272,1325].forEach(x=>plants.push({x:sx(x),z:sz(266),scale:.85},{x:sx(x),z:sz(487),scale:.85}));
[620,800].forEach(x=>plants.push({x:sx(x),z:sz(456),scale:.72}));
const furniture={reception:{pos:[sx(710),sz(446)],size:[156/50,48/50]},sofa:{pos:[sx(883),sz(158)],size:[64/50,125/50]}};
export const floor3={id:"floor-3",label:"3rd Floor",floorZones,wallSegments,doors,fences,roomLabels,shelves,plants,tables,entrance:{pos:[sx(804),sz(48)],label:"Entrance"},furniture,cameraDefault:{position:[0,20,24],target:[0,0,0]}};
export function buildSeatState(layoutTables,statuses={},fallback=STATUS.UNAVAILABLE){const state={};for(const t of layoutTables)for(let i=1;i<=t.seats;i++){const id=t.id+"-S"+i;state[id]=statuses[id]??fallback;}return state;}
