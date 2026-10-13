import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {expect,test} from "vitest";
import {decodePNG} from "../scripts/png.mjs";
import {ART_ASSET_HASHES} from "@/engine/art-data";
import {createBaseSprite} from "@/engine/art";
import {renderSprite,renderLegacySprite} from "@/engine/render";
import {MORPH_PRESETS,specimenFromPreset} from "@/engine/presets";
import {LAYER_ORDER,type GeckoSpecimen} from "@/engine/model";
import {newGame} from "@/game/hardcore/play";
import {specimen as geckoSprite} from "@/game/hardcore/adapter";
import {phenotype} from "@/genetics/advanced/phenotype";
import {valueGecko} from "@/game/hardcore/market";
import {makeSave,readSave} from "@/game/hardcore/save";
const hash=(pixels:Uint8ClampedArray)=>createHash("sha256").update(pixels).digest("hex");
const input=()=>specimenFromPreset(MORPH_PRESETS[0],"phase6-comparison");
const count=(mask:Uint8Array)=>mask.filter(Boolean).length;

test("actual PNG assets match compiled runtime hashes and logical anatomy, with binary alpha",()=>{
  expect(execFileSync("node",["scripts/compile-gecko-art.mjs","--check"],{encoding:"utf8"})).toContain("match");
  const base=createBaseSprite();
  for(const[name,expected]of Object.entries(ART_ASSET_HASHES)){
    const file=readFileSync("public/art/gecko-v2/"+name),image=decodePNG(file);
    expect(createHash("sha256").update(file).digest("hex")).toBe(expected);
    expect([image.width,image.height]).toEqual([96,96]);
    expect(Array.from(image.pixels).filter((_,i)=>i%4===3).every(a=>a===0||a===255)).toBe(true);
    if(name==="normal-base.png")for(let i=0;i<9216;i++)expect(image.pixels[i*4+3]).toBe(base.silhouette[i]);
  }
});
test("preserved v1 renderer exactly reproduces the actual pre-upgrade Canvas snapshot",()=>{
  const old=decodePNG(readFileSync("docs/phase6/normal-v1-96.png")),rendered=renderLegacySprite(input());
  expect(rendered.version).toBe("1.0.0");expect(hash(old.pixels)).toBe(hash(rendered.pixels));
  expect(hash(renderSprite(input()).pixels)).not.toBe(hash(rendered.pixels));
});
test("12 equal-phenotype seeds are distinct and preserve authored anatomy, face and lighting",()=>{
  const outputs=Array.from({length:12},(_,i)=>renderSprite({...input(),seed:"art-diversity-"+i}));
  expect(new Set(outputs.map(o=>hash(o.pixels))).size).toBe(12);
  for(const name of ["silhouette","body","shadow","highlight","details"]){const first=outputs[0].layers.find(l=>l.name===name);
    const fingerprint=(l:typeof first)=>createHash("sha256").update(l!.mask).update(l!.pixels).digest("hex");
    for(const o of outputs.slice(1))expect(fingerprint(o.layers.find(l=>l.name===name))).toBe(fingerprint(first));}
  for(const o of outputs)expect(o.version).toBe("2.0.0");
});
test("20%→80% anatomical pattern growth and increasing spots retain all existing cores",()=>{
  for(const key of ["dorsalCoverage","flankCoverage"] as const){const layerName=key==="dorsalCoverage"?"dorsal":"flank";
    const masks=[0,.2,.8,1].map(value=>renderSprite({...input(),appearance:{...input().appearance,[key]:value}}).layers.find(l=>l.name===layerName)!.mask);
    expect(count(masks[0])).toBe(0);expect(count(masks[2])).toBeGreaterThan(count(masks[1]));
    for(let n=1;n<masks.length;n++)for(let i=0;i<9216;i++)if(masks[n-1][i])expect(masks[n][i]).toBe(255);
  }
  const small=renderSprite({...input(),appearance:{...input().appearance,spotCount:12}}),large=renderSprite({...input(),appearance:{...input().appearance,spotCount:70}});
  const a=small.layers[6].mask,b=large.layers[6].mask;expect(count(b)).toBeGreaterThan(count(a));for(let i=0;i<9216;i++)if(a[i])expect(b[i]).toBe(255);
});
test("all morphs and extreme expression values protect face/outline and stay inside PNG masks",()=>{
  const base=createBaseSprite();
  for(const preset of MORPH_PRESETS)for(const extreme of [0,1])for(const fire of ["up","down"] as const){
    const g=specimenFromPreset(preset,"extreme-art");g.appearance={...g.appearance,dorsalCoverage:extreme,flankCoverage:extreme,spotCount:extreme*70,
      expression:{red:extreme,orange:extreme,brightness:extreme,cream:extreme,harlequin:extreme,pinstripe:extreme,contrast:extreme}};g.state.fire=fire;
    const r=renderSprite(g);let outside=0,protectedPaint=0;
    for(let i=0;i<9216;i++){if(!base.silhouette[i]&&r.pixels[i*4+3])outside++;
      for(const l of r.layers)if(!base.silhouette[i]&&l.mask[i])outside++;
      for(const l of r.layers.filter(l=>["dorsal","flank","spots"].includes(l.name)))if((base.outline[i]||base.face[i]||base.crest[i])&&l.mask[i])protectedPaint++;
    }expect(outside).toBe(0);expect(protectedPaint).toBe(0);expect(r.layers.map(l=>l.name)).toEqual(LAYER_ORDER);
  }
});
test("existing Phase 5 phenotype supplies art parameters without modifying game identity, prices or save data",()=>{
  const game=newGame("art-contract","2026-10-14"),before=JSON.stringify(game);
  for(const offer of Object.values(game.shop.offers)){
    const g=offer.individual,quote=valueGecko(g),wire=geckoSprite(g),scores=phenotype(g.genetics!.genome!).scores;
    expect(wire.appearance.expression).toEqual({red:scores.red,orange:scores.orange,brightness:scores.brightness,cream:scores.cream,harlequin:scores.harlequin,pinstripe:scores.pinstripe,contrast:scores.contrast});
    expect(renderSprite(wire).version).toBe("2.0.0");expect(renderSprite(geckoSprite(g,"down")).pixels).not.toEqual(renderSprite(wire).pixels);
    expect(valueGecko(g)).toEqual(quote);
  }expect(JSON.stringify(game)).toBe(before);expect(readSave(makeSave(game),game.lastDate)).toEqual(game);
});
test("render-only fields validate finite bounds and do not create a new genotype model",()=>{
  const valid:GeckoSpecimen={...input(),appearance:{...input().appearance,expression:{red:.5,orange:.5,brightness:.5,cream:.5,harlequin:.5,pinstripe:.5,contrast:.5}}};
  for(const value of [NaN,-.1,1.1])expect(()=>renderSprite({...valid,appearance:{...valid.appearance,expression:{...valid.appearance.expression!,red:value}}})).toThrow();
  expect(()=>renderSprite(valid)).not.toThrow();
});
