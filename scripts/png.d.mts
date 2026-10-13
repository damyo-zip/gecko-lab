export function encodePNG(width:number,height:number,rgba:Uint8Array|Uint8ClampedArray):Buffer;
export function decodePNG(input:Uint8Array):{width:number;height:number;pixels:Uint8ClampedArray};
