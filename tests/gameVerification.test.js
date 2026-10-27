import assert from 'assert';
import { evaluateEndingTitle, CANDY_WRAPPERS, POEM_TEMPLATES, EASTER_EGGS_DEF } from '../src/config/collectibles.ts';
import { INITIAL_SAVE_STATE } from '../src/systems/persistence.ts';
import { CANDIES, FORMS_META } from '../src/config/constants.ts';

console.log('--- 开始全量业务逻辑与规则核验 ---');

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
console.log('✓ 12 张糖纸定义全部通过 (包含 #01-#12 原创文学金句)');

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
console.log('✓ 15 个彩蛋定义全部通过 (EGG01-EGG15)');

// 3. 验证 12 首诗人原创短诗模板
console.log('测试 3: 验证 12 首原创短诗骨架');
const poemKeys = Object.keys(POEM_TEMPLATES);
assert.strictEqual(poemKeys.length, 12, '必须有 12 条原创短诗骨架');
poemKeys.forEach(k => {
  const tpl = POEM_TEMPLATES[k];
  assert.ok(tpl.title.startsWith('《'), `诗题格式须正确: ${tpl.title}`);
  assert.ok(Array.isArray(tpl.body) && tpl.body.length >= 2, `诗体行数至少2行: ${tpl.title}`);
});
console.log('✓ 12 首原创短诗骨架全部通过');

// 4. 验证 6 大结局称号确定性判定
console.log('测试 4: 验证 6 大结局称号判定机制');

// 称号 1: 秘密保管员
let testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.easterEggs.push('EGG13');
let titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '秘密保管员', '心动彩蛋达成应获得【秘密保管员】');
assert.strictEqual(titleInfo.subNote, '嘘，有些事请让月亮替我们保管。');

// 称号 2: 纸页漫游者
testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.collectibles = ['01', '02', '03', '04', '05', '06', '07', '08'];
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '纸页漫游者', '糖纸>=8应获得【纸页漫游者】');

// 称号 3: 怪诗共犯
testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.mainFormThisRun = 'poet';
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '怪诗共犯', '主形态诗人应获得【怪诗共犯】');

// 称号 4: 糖果收藏家
testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.totalCandy = 16;
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '糖果收藏家', '吃糖>=15应获得【糖果收藏家】');

// 称号 5: 月亮旁观者
testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
testState.easterEggs.push('EGG02');
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '月亮旁观者', '摘月亮糖应获得【月亮旁观者】');

// 称号 6: 深夜喂鬼员 (默认兜底)
testState = JSON.parse(JSON.stringify(INITIAL_SAVE_STATE));
titleInfo = evaluateEndingTitle(testState);
assert.strictEqual(titleInfo.title, '深夜喂鬼员', '默认兜底应为【深夜喂鬼员】');
console.log('✓ 6 种结局称号确定性优先级算法全部通过');

// 5. 验证 7 大形态（6基础+1心动）
console.log('测试 5: 验证形态元信息');
const formKeys = ['default', 'pumpkin', 'milktea', 'poet', 'movie', 'sleepwalk', 'heart'];
formKeys.forEach(f => {
  const meta = FORMS_META[f];
  assert.ok(meta, `形态 ${f} 元数据存在`);
  assert.ok(meta.name.length > 0);
  assert.ok(meta.desc.length > 0);
});
console.log('✓ 7 大形态配置完整有效');

// 6. 验证 6+2 种糖果属性
console.log('测试 6: 验证糖果积分与属性');
['pumpkin', 'milk', 'star', 'mint', 'cloud', 'blackSugar', 'heart', 'moon'].forEach(c => {
  const candy = CANDIES[c];
  assert.ok(candy, `糖果 ${c} 存在`);
  assert.ok(candy.points >= 2, `${c} 糖分积分必须大于等于2`);
});
console.log('✓ 糖果配置与分支计分全部通过');

console.log('\n========================================');
console.log('🎉 全部核心规则测试通过 (0 错误, 0 警告)！');
console.log('========================================');
