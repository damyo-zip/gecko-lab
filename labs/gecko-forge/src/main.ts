import './style.css';
import { createFounder, createOffspring, validateGenome, viability } from './engine/individual';
import { calculatePhenotype, describeAppearance } from './engine/appearance';
import { alleleMean, editFeature } from './engine/editing';
import { emptyWorkspace, exportWorkspace, importWorkspace, MAX_INDIVIDUALS, MAX_JSON_BYTES } from './engine/workspace';
import { FEATURES, FEATURE_LABELS, LOCI, pairKey, polyScores, cross, wildGenome, POLY_IDS } from './engine/genetics';
import type { Genome } from './engine/genetics';
import type { ForgeGecko, Workspace } from './engine/model';
import { BACKUP_KEY, download, downloadPng, drawIndividual, loadWorkspace, saveWorkspace, STORAGE_KEY } from './ui/browser';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const escape = (v: unknown) => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const options = (pairs: [string, string][]) => pairs.map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('');
let workspace: Workspace = emptyWorkspace(), bootError = '';
try { workspace = loadWorkspace(); } catch (e) { bootError = `이전 실험을 열지 못했습니다. 원본은 보존했습니다. ${String(e)}`; }
let draft: Genome = createFounder({ id: 'draft', seed: 'forge-founder-1' }).genome;
let draftSource: string | null = null, page = 0, favoriteOnly = false;
const pageSize = 24;
const selected = () => workspace.individuals.find(g => g.id === workspace.selectedId);
const parent = (sex: 'male' | 'female') => workspace.individuals.find(g => g.id === (sex === 'male' ? workspace.fatherId : workspace.motherId));
const message = (text: string, error = false) => { $('message').textContent = text; $('message').className = error ? 'error' : ''; };
function persist() {
  try { saveWorkspace(workspace); }
  catch (e) { message(`브라우저 저장 실패 — JSON을 내보내 보관하세요. ${String(e)}`, true); }
}
function run(action: () => void) { try { action(); } catch (e) { message(e instanceof Error ? e.message : String(e), true); } }
function allocateId() {
  let id: string;
  do { id = `F-${String(workspace.nextId++).padStart(4, '0')}`; } while (workspace.individuals.some(g => g.id === id));
  return id;
}
function room(count: number) {
  if (workspace.individuals.length + count > MAX_INDIVIDUALS) throw new Error('실험 개체는 최대 1,000마리입니다. JSON으로 보관한 후 새 실험을 시작하세요.');
}

$('app').innerHTML = `
  <header><div><h1>GECKO FORGE</h1><p>유전·96×96 외형 독립 실험실 · advanced-1 / patterns-1</p></div>
    <div class="toolbar"><button id="export">JSON 내보내기</button><label class="button">JSON 가져오기<input id="import" type="file" accept="application/json,.json" hidden></label><button id="new-workspace">새 실험</button></div>
  </header>
  <p id="message" role="status" aria-live="polite"></p>
  <div class="workbench">
    <section class="panel editor" aria-label="개체 생성 및 편집">
      <h2>개체 생성 / 복사 편집</h2><p class="muted">선택 개체를 편집해도 부모 기록은 바뀌지 않습니다. 적용하면 새 복사본이 생깁니다.</p>
      <form id="founder-form">
        <div class="fields"><label>개체 이름<input id="name" maxlength="128" value="새 게코" required></label><label>성별<select id="sex"><option value="male">수컷</option><option value="female">암컷</option></select></label></div>
        <label>유전체 생성 시드<input id="genome-seed" maxlength="128" value="forge-founder-1" required></label>
        <label>외형 시드<input id="visual-seed" maxlength="128" value="forge-visual-1" required></label>
        <div class="fields"><label>모프 빠른 설정<select id="preset">${options([['normal', '노멀'], ['lilly', '릴리화이트'], ['axanthic', '아잔틱'], ['cappuccino', '카푸치노'], ['highway', '하이웨이'], ['sable', '세이블'], ['lilly-axanthic', '릴리 아잔틱'], ['carrier', '아잔틱 het'], ['custom', '직접 유전형 설정']])}</select></label>
        <label>파이어<select id="fire"><option value="up">파이어 업</option><option value="down">파이어 다운</option></select></label></div>
        <div id="mendelian">${LOCI.map(l => `<label>${escape(l.name)}<select data-locus="${l.id}" aria-label="${escape(l.name)} 유전형">${options(Object.entries(l.phenotypes).map(([key, label]) => [key, `${key} · ${label}`]))}</select></label>`).join('')}</div>
        <div class="toolbar"><button type="button" id="random">랜덤 게코 생성</button><button type="submit" class="primary">설정으로 개체 생성</button></div>
        <h3>다유전자 · 60좌위</h3><p class="muted">슬라이더는 6좌위의 실제 대립유전자 평균(0~4)을 편집합니다. 오른쪽 점수는 기존 엔진의 계산값입니다.</p>
        <div id="features"></div>
        <details id="raw-editor"><summary>60좌위 직접 편집</summary><div id="raw-loci"></div></details>
      </form>
    </section>
    <section class="panel comparison" aria-label="외형 비교">
      <div class="section-head"><h2>외형 비교</h2><label>확대<select id="zoom"><option value="2">2×</option><option value="3">3×</option><option value="4">4×</option></select></label><label><input type="checkbox" id="show-b"> 최초 B 비교</label></div>
      <div class="compare-images">
        <figure><figcaption id="preview-caption">편집 중 · 미저장</figcaption><div class="sprite-background enlarged"><canvas id="preview" width="96" height="96" aria-label="편집 개체 확대 외형"></canvas></div><div class="native-row"><canvas id="native" width="96" height="96" aria-label="편집 개체 96×96 원본"></canvas><span>96×96 원본</span></div></figure>
        <figure id="b-reference"><figcaption>최초 B 원본 · 참고 아트</figcaption><div class="sprite-background enlarged"><img src="/reference/B-original.png" width="96" height="96" alt="최초 B 브리딩 감상형 원본 확대"></div><div class="native-row"><img src="/reference/B-original.png" width="96" height="96" alt="최초 B 원본 96×96"><span>원본 그대로 · 렌더러와 별개</span></div></figure>
      </div>
      <p class="muted">새 아트는 제작하지 않았습니다. C/S/H 유전형은 상속되지만 현재 기준 렌더러에는 전용 외형이 없습니다.</p>
      <div id="draft-summary"></div>
      <hr><h2>교배 실험</h2><div class="parents"><div><label>수컷 부모<select id="father" aria-label="수컷 부모"></select></label><div id="father-preview" class="parent-preview"></div></div><div><label>암컷 부모<select id="mother" aria-label="암컷 부모"></select></label><div id="mother-preview" class="parent-preview"></div></div></div>
      <form id="breed-form"><div class="fields"><label>교배 시드<input id="breeding-seed" maxlength="120" required></label><label>자손 수<input id="count" type="number" min="1" max="64" required></label></div><button class="primary" type="submit">실제 상속으로 자손 생성</button></form>
      <p id="cross-summary" class="muted"></p><p class="muted">비생존 결과도 기록하며 다시 추첨하지 않습니다. 자손을 부모로 선택해 다음 세대를 이어갈 수 있습니다.</p>
    </section>
  </div>
  <section class="panel population" aria-label="실험 개체 목록"><div class="section-head"><h2>실험 개체 <span id="population-count">0</span>마리</h2><label><input id="favorites-only" type="checkbox"> 즐겨찾기만</label><span class="muted">카드를 누르면 유전체·표현형 확인 및 복사 편집</span></div><div id="gallery"></div><div class="toolbar pagination"><button id="previous">이전</button><span id="page-info"></span><button id="next">다음</button></div></section>
  <section class="panel" id="selected-details" aria-label="선택 개체 정보"></section>
  <footer>게임 세이브와 분리된 실험 데이터입니다. 대립유전자·유전형은 연구용으로 모두 공개됩니다.</footer>
`;

function applyPreset() {
  const p = $<HTMLSelectElement>('preset').value;
  if (p === 'custom') return;
  const mendelian = wildGenome();
  if (p === 'lilly' || p === 'lilly-axanthic') mendelian.loci['lilly-white'] = ['n', 'Lw'];
  if (p === 'axanthic' || p === 'lilly-axanthic') mendelian.loci.axanthic = ['ax', 'ax'];
  if (p === 'carrier') mendelian.loci.axanthic = ['A', 'ax'];
  const complex = { cappuccino: 'C', highway: 'H', sable: 'S' }[p];
  if (complex) mendelian.loci['cappuccino-complex'] = ['n', complex];
  draft = { ...draft, mendelian }; syncGenotype(); refreshDraft();
}
function syncGenotype() {
  document.querySelectorAll<HTMLSelectElement>('[data-locus]').forEach(select => {
    select.value = pairKey(draft.mendelian.loci[select.dataset.locus!], LOCI.find(l => l.id === select.dataset.locus)!);
  });
}
function drawRaw() {
  $('raw-loci').innerHTML = POLY_IDS.map(id => `<div class="raw-locus"><span>${id}</span>${[0, 1].map(a => `<select data-poly="${id}" data-allele="${a}" aria-label="${id} 대립유전자 ${a + 1}">${options([0, 1, 2, 3, 4].map(v => [String(v), String(v)]))}</select>`).join('')}</div>`).join('');
  document.querySelectorAll<HTMLSelectElement>('[data-poly]').forEach(el => el.value = String(draft.polygenic.loci[el.dataset.poly!][Number(el.dataset.allele)]));
}
function refreshDraft() {
  const scores = polyScores(draft.polygenic);
  for (const f of FEATURES) {
    const range = $<HTMLInputElement>(`feature-${f}`); range.value = String(alleleMean(draft, f));
    $(`score-${f}`).textContent = `${scores[f].toFixed(3)}`;
  }
  const sample: ForgeGecko = { ...createFounder({ id: 'draft', seed: 'preview' }), genome: draft,
    visualSeed: $<HTMLInputElement>('visual-seed').value || 'preview', fire: $<HTMLSelectElement>('fire').value as 'up' | 'down' };
  drawIndividual($('preview'), sample); drawIndividual($('native'), sample);
  const p = calculatePhenotype(draft), d = describeAppearance(p, sample.visualSeed), v = viability(draft);
  $('draft-summary').textContent = v.viable ? `${d.name} · ${p.genetics.geneticMorphs.join(' + ') || 'Normal'}` : `비생존 유전형 — ${v.reasons.join(' · ')} (외형 출력 없음)`;
  if ($<HTMLDetailsElement>('raw-editor').open) drawRaw();
}
function initFeatures() {
  $('features').innerHTML = FEATURES.map(f => `<label class="trait"><span>${FEATURE_LABELS[f]}</span><input id="feature-${f}" data-feature="${f}" aria-label="${FEATURE_LABELS[f]} 대립유전자 평균" type="range" min="0" max="4" step="0.08333333333333333"><output id="score-${f}"></output></label>`).join('');
}
function loadDraft(g: ForgeGecko) {
  draft = structuredClone(g.genome); draftSource = g.id;
  $<HTMLInputElement>('name').value = g.name; $<HTMLInputElement>('genome-seed').value = g.creationSeed;
  $<HTMLInputElement>('visual-seed').value = g.visualSeed; $<HTMLSelectElement>('sex').value = g.sex;
  $<HTMLSelectElement>('fire').value = g.fire; $<HTMLSelectElement>('preset').value = 'custom';
  $('preview-caption').textContent = `${g.name} · 복사 편집`;
  syncGenotype(); refreshDraft();
}
function commit(g: ForgeGecko) {
  room(1); workspace.individuals.push(g); workspace.selectedId = g.id; page = 0;
  loadDraft(g); renderPopulation(); renderParents(); renderDetails(); persist();
}
function createFromDraft() {
  room(1); validateGenome(draft);
  const g = createFounder({ id: allocateId(), seed: $<HTMLInputElement>('genome-seed').value,
    visualSeed: $<HTMLInputElement>('visual-seed').value, name: $<HTMLInputElement>('name').value.trim(), sex: $<HTMLSelectElement>('sex').value as 'male' | 'female' });
  if (!g.name) throw new Error('이름을 입력하세요.');
  // Explicit edited genomes are preserved. Seed field can regenerate founder
  // alleles using the separate button, never silently replace edited alleles.
  g.genome = structuredClone(draft); g.fire = $<HTMLSelectElement>('fire').value as 'up' | 'down';
  g.origin = draftSource ? 'edited' : 'founder'; g.derivedFrom = draftSource;
  commit(g); message(`${g.name} 생성 · ${g.id} — 유전체·외형 시드 저장 완료`);
}
function renderPopulation() {
  const all = workspace.individuals.filter(g => !favoriteOnly || workspace.favorites.includes(g.id)).slice().reverse();
  const pages = Math.max(1, Math.ceil(all.length / pageSize)); page = Math.min(page, pages - 1);
  const visible = all.slice(page * pageSize, (page + 1) * pageSize);
  $('population-count').textContent = String(workspace.individuals.length);
  $('gallery').innerHTML = visible.length ? visible.map(g => {
    const v = viability(g.genome), p = calculatePhenotype(g.genome), d = describeAppearance(p, g.visualSeed);
    return `<article class="gecko-card ${g.id === workspace.selectedId ? 'selected' : ''}" data-id="${escape(g.id)}">
      <button class="card-select" data-action="select" aria-label="${escape(g.name)} ${g.id} 선택"><div class="sprite-background"><canvas width="96" height="96" data-sprite="${escape(g.id)}" aria-label="${escape(g.name)} 외형"></canvas>${v.viable ? '' : '<span class="nonviable">비생존 유전형</span>'}</div><strong>${escape(g.name)}</strong><span>${escape(g.id)} · ${g.sex === 'male' ? '♂' : '♀'} · Gen ${g.generation}</span><small>${escape(d.name)}</small></button>
      <div class="card-actions"><button data-action="favorite" aria-label="${escape(g.id)} 즐겨찾기" aria-pressed="${workspace.favorites.includes(g.id)}">${workspace.favorites.includes(g.id) ? '★' : '☆'}</button><button data-action="parent" ${v.viable ? '' : 'disabled'}>${g.sex === 'male' ? '수컷' : '암컷'} 부모</button><button data-action="png" ${v.viable ? '' : 'disabled'}>PNG</button></div></article>`;
  }).join('') : '<p class="empty">실험 개체가 없습니다. 랜덤 게코 생성으로 시작하세요.</p>';
  document.querySelectorAll<HTMLCanvasElement>('[data-sprite]').forEach(c => drawIndividual(c, workspace.individuals.find(g => g.id === c.dataset.sprite)!));
  $('page-info').textContent = `${page + 1} / ${pages} · 한 번에 최대 ${pageSize}마리`;
  $<HTMLButtonElement>('previous').disabled = page === 0; $<HTMLButtonElement>('next').disabled = page >= pages - 1;
}
function renderParents() {
  for (const [sex, id] of [['male', 'father'], ['female', 'mother']] as const) {
    const list = workspace.individuals.filter(g => g.sex === sex && viability(g.genome).viable), p = parent(sex);
    $<HTMLSelectElement>(id).innerHTML = options([['', '부모 선택'], ...list.map(g => [g.id, `${g.name} · ${g.id} · Gen ${g.generation}`] as [string, string])]);
    $<HTMLSelectElement>(id).value = p?.id ?? '';
    $(`${id}-preview`).innerHTML = p ? `<canvas width="96" height="96" aria-label="${id === 'father' ? '아버지' : '어머니'} 외형"></canvas><small>${escape(describeAppearance(calculatePhenotype(p.genome), p.visualSeed).name)}</small>` : '<span class="muted">선택 대기</span>';
    if (p) drawIndividual($(`${id}-preview`).querySelector('canvas')!, p);
  }
  const f = parent('male'), m = parent('female');
  $('cross-summary').textContent = f && m ? (() => { const forecast = cross(f.genome.mendelian, m.genome.mendelian); return `기존 모델: 비생존 배아 ${(forecast.nonViableProbability * 100).toFixed(1)}% · 위험 조합 ${(forecast.blockedProbability * 100).toFixed(1)}% (추가 치사율 없음)`; })() : '부모 두 마리를 고르세요. 실험실은 실제 유전형을 모두 공개합니다.';
}
function renderDetails() {
  const g = selected();
  if (!g) { $('selected-details').innerHTML = '<p class="muted">개체를 선택하면 유전체·표현형과 부모 ID를 확인할 수 있습니다.</p>'; return; }
  const p = calculatePhenotype(g.genome), d = describeAppearance(p, g.visualSeed);
  $('selected-details').innerHTML = `<div class="section-head"><h2>${escape(g.name)} · ${escape(g.id)}</h2><button id="reproduce">동일 조건 재현</button><button id="selected-png" ${viability(g.genome).viable ? '' : 'disabled'}>96×96 PNG 저장</button></div>
    <p>${escape(d.name)} · ${g.sex === 'male' ? '수컷' : '암컷'} · Gen ${g.generation} · ${escape(g.origin)}</p>
    <p>부모: ${g.parents ? `${escape(g.parents.fatherId)} × ${escape(g.parents.motherId)}` : '없음'} · 외형 시드: ${escape(g.visualSeed)}</p>
    <div class="genotypes">${LOCI.map(l => `<span>${escape(l.name)} <b>${escape(g.genome.mendelian.loci[l.id].join('/'))}</b></span>`).join('')}</div>
    <details><summary>전체 유전체 (60좌위 포함)</summary><pre>${escape(JSON.stringify(g.genome, null, 2))}</pre></details>
    <details><summary>계산된 표현형·무늬 관찰값</summary><pre>${escape(JSON.stringify({ ...p, ...d }, null, 2))}</pre></details>`;
  $('reproduce').onclick = () => run(() => { room(1); const copy = structuredClone(g); copy.id = allocateId(); copy.origin = 'copy'; copy.derivedFrom = g.id; commit(copy); message('동일 유전체·외형 시드로 재현했습니다.'); });
  $('selected-png').onclick = () => downloadPng(g);
}
function renderSettings() {
  $<HTMLSelectElement>('zoom').value = String(workspace.settings.zoom); $<HTMLInputElement>('show-b').checked = workspace.settings.showB;
  document.documentElement.style.setProperty('--zoom', String(workspace.settings.zoom));
  $('b-reference').hidden = !workspace.settings.showB;
  $<HTMLInputElement>('breeding-seed').value = workspace.breedingSeed; $<HTMLInputElement>('count').value = String(workspace.offspringCount);
}
function renderWorkspace() {
  renderSettings(); renderPopulation(); renderParents(); renderDetails();
  const g = selected(); if (g) loadDraft(g); else {
    draft = createFounder({ id: 'draft', seed: 'forge-founder-1' }).genome; draftSource = null;
    $<HTMLInputElement>('genome-seed').value = 'forge-founder-1'; $<HTMLInputElement>('visual-seed').value = 'forge-visual-1';
    $<HTMLInputElement>('name').value = '새 게코'; $<HTMLSelectElement>('sex').value = 'male';
    $<HTMLSelectElement>('fire').value = 'up'; $<HTMLSelectElement>('preset').value = 'normal';
    $('preview-caption').textContent = '편집 중 · 미저장'; syncGenotype(); refreshDraft();
  }
}

initFeatures(); renderWorkspace(); if (bootError) message(bootError, true);
$('founder-form').onsubmit = e => { e.preventDefault(); run(createFromDraft); };
$('random').onclick = () => run(() => {
  const seed = crypto.randomUUID(), g = createFounder({ id: 'draft', seed });
  draft = { ...g.genome, mendelian: structuredClone(draft.mendelian) }; draftSource = null;
  $<HTMLInputElement>('genome-seed').value = seed; $<HTMLInputElement>('visual-seed').value = seed;
  createFromDraft();
});
// Regenerate founder alleles from the typed seed explicitly, preserving chosen
// Mendelian genotype. This is separate from rendering an existing saved genome.
const reseed = document.createElement('button'); reseed.type = 'button'; reseed.id = 'reseed'; reseed.textContent = '입력 시드로 60좌위 재생성';
$('genome-seed').parentElement!.append(reseed);
reseed.onclick = () => run(() => { const g = createFounder({ id: 'draft', seed: $<HTMLInputElement>('genome-seed').value }); draft = { ...g.genome, mendelian: structuredClone(draft.mendelian) }; draftSource = null; refreshDraft(); message('입력 시드로 60좌위를 재생성했습니다. 개체 생성 버튼으로 보관하세요.'); });
$('preset').onchange = () => run(applyPreset);
$('mendelian').onchange = e => run(() => {
  const el = e.target as HTMLSelectElement;
  if (!el.dataset.locus) return;
  draft.mendelian.loci[el.dataset.locus] = el.value.split('/') as [string, string];
  $<HTMLSelectElement>('preset').value = 'custom'; refreshDraft();
});
$('features').oninput = e => run(() => { const el = e.target as HTMLInputElement; const f = FEATURES.find(f => f === el.dataset.feature); if (f) { draft = editFeature(draft, f, Number(el.value)); refreshDraft(); } });
$('raw-editor').ontoggle = () => { if ($<HTMLDetailsElement>('raw-editor').open) drawRaw(); };
$('raw-loci').onchange = e => run(() => {
  const el = e.target as HTMLSelectElement, id = el.dataset.poly;
  if (!id) return;
  const pair = [...draft.polygenic.loci[id]] as [number, number]; pair[Number(el.dataset.allele)] = Number(el.value); draft.polygenic.loci[id] = pair; refreshDraft();
});
for (const id of ['visual-seed', 'fire']) $(id).onchange = () => run(refreshDraft);
$('zoom').onchange = () => { workspace.settings.zoom = Number($<HTMLSelectElement>('zoom').value) as 2 | 3 | 4; renderSettings(); persist(); };
$('show-b').onchange = () => { workspace.settings.showB = $<HTMLInputElement>('show-b').checked; renderSettings(); persist(); };
for (const [id, key] of [['father', 'fatherId'], ['mother', 'motherId']] as const) $(id).onchange = () => { workspace[key] = $<HTMLSelectElement>(id).value || null; renderParents(); persist(); };
for (const id of ['breeding-seed', 'count']) $(id).onchange = () => run(() => {
  const candidate = { ...workspace, breedingSeed: $<HTMLInputElement>('breeding-seed').value, offspringCount: Number($<HTMLInputElement>('count').value) };
  workspace = importWorkspace(exportWorkspace(candidate)); persist();
});
$('breed-form').onsubmit = e => { e.preventDefault(); run(() => {
  const father = parent('male'), mother = parent('female'); if (!father || !mother) throw new Error('수컷·암컷 부모를 모두 선택하세요.');
  const count = Number($<HTMLInputElement>('count').value), seed = $<HTMLInputElement>('breeding-seed').value;
  if (!Number.isInteger(count) || count < 1 || count > 64 || !seed.trim() || seed.length > 120) throw new Error('자손 수 1~64, 교배 시드 1~120자를 입력하세요.');
  room(count);
  const children = Array.from({ length: count }, (_, i) => createOffspring(father, mother, { id: allocateId(), seed: `${seed}|${i}` }));
  workspace.breedingSeed = seed; workspace.offspringCount = count; workspace.individuals.push(...children); workspace.selectedId = children[0].id; page = 0;
  renderWorkspace(); persist(); message(`${count}개 유전 결과 생성 · 생존 가능 ${children.filter(g => viability(g.genome).viable).length}개 · 다시 추첨하지 않음`);
}); };
$('gallery').onclick = e => run(() => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]'), card = button?.closest<HTMLElement>('[data-id]');
  const g = workspace.individuals.find(g => g.id === card?.dataset.id); if (!button || !g) return;
  if (button.dataset.action === 'png') { downloadPng(g); return; }
  if (button.dataset.action === 'parent') { workspace[g.sex === 'male' ? 'fatherId' : 'motherId'] = g.id; renderParents(); message(`${g.name} — ${g.sex === 'male' ? '수컷' : '암컷'} 부모 선택`); }
  if (button.dataset.action === 'favorite') {
    workspace.favorites = workspace.favorites.includes(g.id) ? workspace.favorites.filter(id => id !== g.id) : [...workspace.favorites, g.id];
    if (favoriteOnly) renderPopulation(); else { button.textContent = workspace.favorites.includes(g.id) ? '★' : '☆'; button.setAttribute('aria-pressed', String(workspace.favorites.includes(g.id))); }
  }
  if (button.dataset.action === 'select') {
    workspace.selectedId = g.id; loadDraft(g); renderDetails();
    document.querySelectorAll<HTMLElement>('.gecko-card').forEach(c => c.classList.toggle('selected', c.dataset.id === g.id));
  }
  persist();
});
$('favorites-only').onchange = () => { favoriteOnly = $<HTMLInputElement>('favorites-only').checked; page = 0; renderPopulation(); };
$('previous').onclick = () => { page--; renderPopulation(); };
$('next').onclick = () => { page++; renderPopulation(); };
$('export').onclick = () => run(() => { download(new Blob([exportWorkspace(workspace)], { type: 'application/json' }), 'gecko-forge.json'); message('실험 개체·부모·즐겨찾기·설정을 JSON으로 내보냈습니다.'); });
$('import').onchange = async () => {
  const input = $<HTMLInputElement>('import'), file = input.files?.[0]; if (!file) return;
  try {
    if (file.size > MAX_JSON_BYTES) throw new Error('JSON은 8MB 이하여야 합니다.');
    const restored = importWorkspace(await file.text());
    const before = localStorage.getItem(STORAGE_KEY); if (before) localStorage.setItem(BACKUP_KEY, before);
    workspace = restored; page = 0; favoriteOnly = false; $<HTMLInputElement>('favorites-only').checked = false; renderWorkspace(); persist(); message(`${workspace.individuals.length}마리 실험 복원 완료`);
  } catch (e) { message(`가져오기 실패 — 기존 실험 유지. ${String(e)}`, true); }
  input.value = '';
};
$('new-workspace').onclick = () => run(() => {
  // User-triggered reset, with backup; never touches a game storage key.
  const before = localStorage.getItem(STORAGE_KEY); if (before) localStorage.setItem(BACKUP_KEY, before);
  workspace = emptyWorkspace(); draft = createFounder({ id: 'draft', seed: 'forge-founder-1' }).genome; draftSource = null; page = 0;
  favoriteOnly = false; $<HTMLInputElement>('favorites-only').checked = false;
  $<HTMLInputElement>('genome-seed').value = 'forge-founder-1'; $<HTMLInputElement>('visual-seed').value = 'forge-visual-1';
  $<HTMLInputElement>('name').value = '새 게코'; $<HTMLSelectElement>('preset').value = 'normal';
  renderWorkspace(); persist(); message('새 실험을 시작했습니다. 이전 데이터는 before-import 백업 키에 보존했습니다.');
});
