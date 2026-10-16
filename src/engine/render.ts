import {LAYER_ORDER,validateSpecimen,type GeckoSpecimen,type LayerName,type SpriteResult} from './model';
import {regionalAppearance} from './regional';
import {compositeLayers} from './composite';
export {compositeLayers} from './composite';
/** The only production renderer. Unknown old inputs cannot silently choose old art. */
export function renderSprite(specimen:GeckoSpecimen,enabled:readonly LayerName[]=LAYER_ORDER):SpriteResult {
  validateSpecimen(specimen);
  if(!specimen.genome)throw new Error('새 외형 엔진에는 유전체가 필요합니다. 새 게임을 시작해 주세요.');
  const result=regionalAppearance({genome:specimen.genome,seed:specimen.seed,fire:specimen.state.fire}).sprite;
  // Public callers may edit/export buffers; keep the bounded cache immutable.
  const layers=result.layers.map(l=>({...l,mask:l.mask.slice(),pixels:l.pixels.slice()}));
  return {...result,layers,pixels:enabled===LAYER_ORDER?result.pixels.slice():compositeLayers(layers,enabled)};
}
