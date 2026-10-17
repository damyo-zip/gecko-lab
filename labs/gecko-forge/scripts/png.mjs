import {deflateSync,inflateSync} from "node:zlib";
const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_TABLE=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=CRC_TABLE[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),check=Buffer.alloc(4);length.writeUInt32BE(data.length);check.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([length,name,data,check]);}
export function encodePNG(width,height,rgba){
 if(rgba.length!==width*height*4)throw new Error("Invalid RGBA dimensions");
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const scan=Buffer.alloc(height*(width*4+1));for(let y=0;y<height;y++)Buffer.from(rgba.buffer,rgba.byteOffset+y*width*4,width*4).copy(scan,y*(width*4+1)+1);
 return Buffer.concat([SIGNATURE,chunk("IHDR",header),chunk("IDAT",deflateSync(scan,{level:9})),chunk("IEND",Buffer.alloc(0))]);
}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
export function decodePNG(input){
 const b=Buffer.from(input);if(!b.subarray(0,8).equals(SIGNATURE))throw new Error("Invalid PNG");
 let width,height,depth,color,palette,transparency;const idat=[];
 for(let p=8;p<b.length;){const n=b.readUInt32BE(p),type=b.toString("ascii",p+4,p+8),data=b.subarray(p+8,p+8+n);
  if(b.readUInt32BE(p+8+n)!==crc(b.subarray(p+4,p+8+n)))throw new Error("PNG CRC mismatch");
  if(type==="IHDR"){width=data.readUInt32BE(0);height=data.readUInt32BE(4);depth=data[8];color=data[9];if(data[12])throw new Error("Interlaced PNG unsupported");}
  if(type==="PLTE")palette=data;if(type==="tRNS")transparency=data;if(type==="IDAT")idat.push(data);p+=n+12;
 }
 if(depth!==8||![0,2,3,4,6].includes(color)||!width||!height)throw new Error("Expected 8-bit non-interlaced PNG");
 const channels={0:1,2:3,3:1,4:2,6:4}[color],stride=width*channels,raw=inflateSync(Buffer.concat(idat));
 if(raw.length!==height*(stride+1))throw new Error("Invalid scanline size");
 const decoded=Buffer.alloc(height*stride);for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];if(filter>4)throw new Error("Invalid PNG filter");
  for(let x=0;x<stride;x++){const i=y*stride+x,left=x>=channels?decoded[i-channels]:0,up=y?decoded[i-stride]:0,corner=y&&x>=channels?decoded[i-stride-channels]:0;
   decoded[i]=(raw[y*(stride+1)+x+1]+[0,left,up,Math.floor((left+up)/2),paeth(left,up,corner)][filter])&255;}
 }
 const pixels=new Uint8ClampedArray(width*height*4);for(let i=0;i<width*height;i++){
  const s=i*channels,d=i*4;if(color===6)pixels.set(decoded.subarray(s,s+4),d);
  else if(color===2)pixels.set([...decoded.subarray(s,s+3),255],d);
  else if(color===3){const n=decoded[s];if(!palette||n*3+2>=palette.length)throw new Error("Missing PNG palette");pixels.set([...palette.subarray(n*3,n*3+3),transparency?.[n]??255],d);}
  else pixels.set([decoded[s],decoded[s],decoded[s],color===4?decoded[s+1]:255],d);
 }return {width,height,pixels};
}
