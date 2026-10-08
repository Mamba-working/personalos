import {inflateSync} from 'node:zlib';
// Decode browser-produced 8-bit RGB/RGBA PNGs to reject transparent/solid output.
// This measures pixels only; it cannot establish Ball/book fidelity or GPU type.
export function inspectPng(bytes) {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  if (!bytes.subarray(0,8).equals(signature)) throw new Error('PNG_SIGNATURE');
  let width, height, channels;
  const compressed = [];
  for (let at=8; at<bytes.length;) {
    const length=bytes.readUInt32BE(at), type=bytes.toString('ascii',at+4,at+8), data=bytes.subarray(at+8,at+8+length);
    if(type==='IHDR') {
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);
      if(data[8]!==8 || data[12]!==0 || ![2,6].includes(data[9])) throw new Error('PNG_FORMAT: expected noninterlaced 8-bit RGB/RGBA');
      channels=data[9]===6?4:3;
    }
    if(type==='IDAT') compressed.push(data);
    at+=length+12;
  }
  const raw=inflateSync(Buffer.concat(compressed)), stride=width*channels;
  let prior=Buffer.alloc(stride), visible=0, total=0;
  const colors=new Set();
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++) {
    const filter=raw[y*(stride+1)], row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));
    for(let x=0;x<stride;x++) {
      const a=x>=channels?row[x-channels]:0,b=prior[x],c=x>=channels?prior[x-channels]:0;
      const add=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):NaN;
      if(!Number.isFinite(add)) throw new Error('PNG_FILTER');
      row[x]=(row[x]+add)&255;
    }
    if(y%4===0) for(let x=0;x<width;x+=4) {
      total++;
      const at=x*channels,alpha=channels===4?row[at+3]:255;
      if(alpha>20) {visible++;colors.add(`${row[at]>>3},${row[at+1]>>3},${row[at+2]>>3}`);}
    }
    prior=row;
  }
  return {width,height,visibleFraction:visible/total,quantizedColors:colors.size};
}
