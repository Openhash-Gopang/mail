// 사용법 고급 과정: 10만 AI 전문가 13장(개요 → 의식주)이 앞에 오고, 예전 40장을 합친 10장이 뒤를 잇는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildChapters, buildScenarios, loadFields } from '../scripts/build-expert-chapters.mjs';
const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const man = rd('../manual/hondi_interactive_manual.html'), sim = rd('../sim-howto.js');
const C = JSON.parse(/var CHAPTERS = (\[.*\]);\n/.exec(man)[1]);
const adv = C.filter((c) => c.tier === 'advanced');
const MERGED = JSON.parse(/var MERGED_FROM = (\{.*\});\n/.exec(man)[1]);

test('고급 23장: 전문가 13장이 10만 AI 전문가 탭 순서대로, 이어서 통합 10장', () => {
  const tabs = ['overview'].concat(Object.keys(loadFields()));
  assert.deepEqual(adv.map((c) => c.id), tabs.map((k) => 'ex_' + k).concat(Object.keys(MERGED)));
  assert.equal(adv.length, 23);
});
test('전문가 장은 분야 초안과 일치한다(다르면 node scripts/build-expert-chapters.mjs)', () => {
  assert.deepEqual(adv.slice(0, 13), JSON.parse(JSON.stringify(buildChapters())));
  assert.ok(sim.includes(buildScenarios(C.findIndex((c) => c.id === 'ex_overview') + 1)));
});
test('통합 장은 예전 40장의 제목을 절로 모두 담고, 퀴즈가 절 수 이상이다', () => {
  const old = Object.values(MERGED).flat(); assert.equal(old.length, 40); assert.equal(new Set(old).size, 40);
  for (const [id, olds] of Object.entries(MERGED)) {
    const c = adv.find((x) => x.id === id);
    assert.equal((c.body.match(/<h3>\d\. /g) || []).length, olds.length, id);
    assert.ok(c.quiz.length >= olds.length, id);
    for (const o of olds) assert.ok(!man.includes('data-goto=\\"' + o + '\\"'), o);
  }
});
test('예전 장의 진도·주소·학습 기록은 통합 장으로 이어진다', () => {
  assert.match(man, /MERGED_FROM\[k\]\.every\(isCompleted\)/);
  assert.match(man, /if \(id\) id = newIdOf\(id\);/);
  assert.match(man, /newIdOf\(s\.ch\) === id/);
});
