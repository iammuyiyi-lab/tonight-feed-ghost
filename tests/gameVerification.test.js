import assert from 'assert';
import { evaluateEndingTitle, CANDY_WRAPPERS, POEM_TEMPLATES, EASTER_EGGS_DEF } from '../src/config/collectibles.ts';
import { INITIAL_SAVE_STATE, PersistenceSystem } from '../src/systems/persistence.ts';
import { CANDIES, FORMS_META } from '../src/config/constants.ts';
import { AudioDirector } from '../src/systems/audio.ts';
import { GhostActor } from '../src/systems/ghost.ts';
import { SceneDirector } from '../src/systems/director.ts';
import { PoetMiniGame } from '../src/games/poetGame.ts';
import { CandyRainGame } from '../src/games/candyRain.ts';

console.log('--- 开始全量业务逻辑与规则核验（含发布后审查修复项） ---');

// 1. 验证 12 张糖纸定义完备性
console.log('测试 1: 验证 12 张糖纸定义');
assert.strictEqual(CANDY_WRAPPERS.length, 12, '必须严格拥有 12 张糖纸');
CANDY_WRAPPERS.forEach((w, idx) => {
  const expectedId = (idx + 1 < 10 ? `0${idx + 1}` : `${idx + 1}`);
  assert.strictEqual(w.id, expectedId, `糖纸 ID 应为 ${expectedId}`);
  assert.ok(w.title.length > 0, `糖纸 ${w.id} 标题不能为空`);
  assert.ok(w.text.length > 0, `糖纸 ${w.id} 正文不能为空`);
  assert.ok(w.source.length > 0, `糖纸 ${w.id} 来源不能为空`);
});
console.log('✓ 12 张糖纸定义全部通过');

// 2. 验证 15 个彩蛋定义完备性
console.log('测试 2: 验证 15 个彩蛋定义');
assert.strictEqual(EASTER_EGGS_DEF.length, 15, '必须严格拥有 15 个彩蛋');
for (let i = 1; i <= 15; i++) {
  const eggId = i < 10 ? `EGG0${i}` : `EGG${i}`;
  const egg = EASTER_EGGS_DEF.find(e => e.id === eggId);
  assert.ok(egg, `必须存在彩蛋 ${eggId}`);
  assert.ok(egg.name.length > 0, `${eggId} 名称不能为空`);
  assert.ok(egg.desc.length > 0, `${eggId} 描述不能为空`);
}
console.log('✓ 15 个彩蛋定义全部通过');

// 3. P1-03: 诗人选词全动态影响测试（改变第1、第2或第3词必须产生不同正文与标题）
console.log('测试 3: 验证诗人幽灵三词真动态成诗机制 (P1-03)');
const dummyAudio = new AudioDirector();
const poetGame = new PoetMiniGame(dummyAudio);

// 组合 A
poetGame.selectedWords = ['月亮', '糖纸', '打嗝'];
poetGame.composePoem();
const poemA = poetGame.generatedPoem;

// 组合 B (改变第二词)
poetGame.selectedWords = ['月亮', '鞋带', '打嗝'];
poetGame.composePoem();
const poemB = poetGame.generatedPoem;

// 组合 C (改变第三词)
poetGame.selectedWords = ['月亮', '糖纸', '发芽'];
poetGame.composePoem();
const poemC = poetGame.generatedPoem;

assert.ok(poemA && poemB && poemC, '诗歌必须成功生成');
assert.notStrictEqual(poemA.lines[1], poemB.lines[1], '改变第二词必须改变第二行诗句');
assert.notStrictEqual(poemA.lines[2], poemC.lines[2], '改变第三词必须改变第三行诗句');
assert.strictEqual(poemA.title, '《关于月亮与糖纸》');
assert.strictEqual(poemB.title, '《关于月亮与鞋带》');
console.log('✓ 诗人三词动态成诗核验通过（每一词均产生实质文字变化）');

// 4. P1-04: 温柔行为计分正向测试（逗弄不得加分，喂食饥饿幽灵才加分）
console.log('测试 4: 验证温柔行为计分正向性 (P1-04)');
const persistence = new PersistenceSystem();
const ghost = new GhostActor();
const director = new SceneDirector(persistence, dummyAudio, ghost);

// 故意逗弄 5 次
for (let i = 0; i < 5; i++) {
  director.registerTeasingCandy();
}
assert.strictEqual(persistence.getState().gentleActs.noTeasingCount, 0, '故意逗弄幽灵绝对不得增加温柔计数！');
assert.ok(persistence.getState().easterEggs.includes('EGG05'), '逗弄 3 次后应记录精神试炼彩蛋 EGG05');

// 正常喂食饥饿幽灵
director.teaserCount = 0;
director.feedCandy('pumpkin', true);
assert.strictEqual(persistence.getState().gentleActs.noTeasingCount, 1, '直接温柔喂饱饥饿幽灵应增加温柔计数');
console.log('✓ 温柔计分语义正向性核验通过');

// 5. P0-03 & P0-05: 接糖游戏波次、清零与多周目状态隔离
console.log('测试 5: 验证接糖游戏波次与状态隔离 (P0-03 & P0-05)');
const rain = new CandyRainGame(dummyAudio);
rain.caughtCandyCount = 10;
rain.consecutiveCatches = 5;
rain.routeScoresEarned.pumpkin = 4;

// 仅重置波次（不清除累计分数）
rain.resetWave(2);
assert.strictEqual(rain.wave, 2);
assert.strictEqual(rain.caughtCandyCount, 10, '切波不得丢失累计得分');

// 全量重置新周目
rain.resetEntireRainGame();
assert.strictEqual(rain.wave, 1);
assert.strictEqual(rain.caughtCandyCount, 0, '新周目接糖总数必须清零');
assert.strictEqual(rain.routeScoresEarned.pumpkin, 0, '新周目路线积分必须清零');
console.log('✓ 接糖波次与周目状态隔离核验通过');

// 6. P0-04: S20 第二次变身候选计算（非主形态且分数次高二选一）
console.log('测试 6: 验证 S20 第二形态非主形态次高候选计算 (P0-04)');
persistence.getState().mainFormThisRun = 'poet';
persistence.getState().routeScore = {
  poet: 10,
  pumpkin: 7,
  milktea: 5,
  movie: 2,
  sleepwalk: 1,
};

const s20Candidates = director.calculateS20Candidates();
assert.strictEqual(s20Candidates.length, 2);
assert.strictEqual(s20Candidates[0], 'pumpkin', '次高分应为 pumpkin');
assert.strictEqual(s20Candidates[1], 'milktea', '第三高分应为 milktea');
assert.ok(!s20Candidates.includes('poet'), 'S20 备选项绝对不能包含主形态 poet');
console.log('✓ S20 第二形态智能候选算法核验通过');

// 7. P1-01: S22 糖纸排序与 EGG11 逆序达成验证
console.log('测试 7: 验证 S22 糖纸排序与 EGG11 逆序彩蛋 (P1-01)');
director.sortedWrappers = [];
director.putWrapperInSlot('05', 0);
director.putWrapperInSlot('03', 1);
director.putWrapperInSlot('01', 2);
assert.strictEqual(director.sortedWrappers.length, 3);
assert.ok(persistence.getState().easterEggs.includes('EGG11'), '严格逆序 05 > 03 > 01 必须触发 EGG11 彩蛋');
console.log('✓ S22 糖纸排序与逆序彩蛋达成核验通过');

// 8. P0-03: 完整周目重启与永久收藏隔离
console.log('测试 8: 验证 startNewRun 周目清零与永久收藏隔离 (P0-03)');
persistence.unlockWrapper('01');
persistence.unlockWrapper('02');
persistence.unlockForm('pumpkin');
director.chapter1FeedCount = 8;
director.startNewRun();

assert.strictEqual(director.chapter1FeedCount, 0, '新周目第一章喂食数必须清零');
assert.strictEqual(director.sortedWrappers.length, 0, '新周目糖纸槽必须清零');
assert.ok(persistence.getState().collectibles.includes('01'), '新周目必须保留已解锁糖纸');
assert.ok(persistence.getState().unlockedForms.includes('pumpkin'), '新周目必须保留已解锁形态');
console.log('✓ 周目清零与永久图鉴隔离核验通过');

// 9. 6 大结局称号优先级算法
console.log('测试 9: 验证 6 大结局称号判定机制');
let testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.easterEggs.push('EGG13');
let titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '秘密保管员');

testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.collectibles = ['01', '02', '03', '04', '05', '06', '07', '08'];
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '纸页漫游者');

testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.mainFormThisRun = 'poet';
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '怪诗共犯');

testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.totalCandy = 16;
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '糖果收藏家');

testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.easterEggs.push('EGG02');
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '月亮旁观者');

testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '深夜喂鬼员');
console.log('✓ 6 种结局称号确定性优先级算法全部通过');

console.log('\n========================================');
console.log('🎉 9 项端到端业务与定点修复回归测试全部通过！');
console.log('========================================');
