import { CollectibleWrapper, EasterEggRecord, SaveState } from '../types';

export const CANDY_WRAPPERS: CollectibleWrapper[] = [
  {
    id: '01',
    title: '未拆封的月亮',
    text: '月亮像一颗忘了拆的糖。',
    source: 'S05 保底获得',
  },
  {
    id: '02',
    title: '纸做的天气',
    text: '风把落叶翻了个面，像翻一本没写完的书。',
    source: '第一章尝到不同口味',
  },
  {
    id: '03',
    title: '成熟问题',
    text: '南瓜会成熟，鬼只会越吃越圆。',
    source: '南瓜形态专属',
  },
  {
    id: '04',
    title: '珍珠和逗号',
    text: '沉默不是空白。它只是还没想好标点。',
    source: '奶茶形态专属',
  },
  {
    id: '05',
    title: '认真废话',
    text: '有些句子没有道理，也不影响它们存在。',
    source: '诗人形态专属',
  },
  {
    id: '06',
    title: '胶片尾声',
    text: '镜头结束以后，晚风仍然走它自己的路。',
    source: '电影形态专属',
  },
  {
    id: '07',
    title: '未寄出的梦',
    text: '梦是一张不用写收件人的明信片。',
    source: '梦游形态专属',
  },
  {
    id: '08',
    title: '一口冬天',
    text: '薄荷经过时，秋天假装不在。',
    source: '薄荷糖品尝多次',
  },
  {
    id: '09',
    title: '一张好天气',
    text: '世界偶尔不讲道理，好在糖果也不讲。',
    source: '接糖雨完赛获得',
  },
  {
    id: '10',
    title: '票根',
    text: '一场没有观众的电影，也可以有人认真谢幕。',
    source: '接糖捕获电影票根',
  },
  {
    id: '11',
    title: '偏爱',
    text: '偏爱很轻，轻得像糖纸。',
    source: '尾声拆开最后一颗糖',
  },
  {
    id: '12',
    title: '故事剩下一半',
    text: '有些故事不必写满。留一页给下次见面。',
    source: '通关后自由模式常驻',
  },
];

export interface PoemTemplate {
  key: string;
  title: string;
  body: string[];
}

export const POEM_TEMPLATES: Record<string, PoemTemplate> = {
  月亮: {
    key: '月亮',
    title: '《关于月亮》',
    body: ['月亮不说话。', '我也不说。', '我们中间只有一张糖纸在响。'],
  },
  楼梯: {
    key: '楼梯',
    title: '《关于楼梯》',
    body: ['楼梯上有人走过。', '我是鬼，不必走。', '但我还是一步一步想起晚饭。'],
  },
  南瓜: {
    key: '南瓜',
    title: '《关于南瓜》',
    body: ['南瓜端坐在桌上。', '像一位脾气很好但不懂文学的先生。'],
  },
  失眠: {
    key: '失眠',
    title: '《关于失眠》',
    body: ['我不是睡不着。', '我是舍不得让今晚先结束。'],
  },
  鞋带: {
    key: '鞋带',
    title: '《鞋带》',
    body: ['鞋带松了。', '我没有脚。', '但我的生活显然也存在问题。'],
  },
  夜风: {
    key: '夜风',
    title: '《夜风》',
    body: ['夜风翻过一页。', '我的台词被吹到下一章。'],
  },
  旧书: {
    key: '旧书',
    title: '《旧书》',
    body: ['书里夹着一颗糖。', '我不敢吃。', '怕把结局也一起吞下去。'],
  },
  糖纸: {
    key: '糖纸',
    title: '《糖纸》',
    body: ['糖吃完了。', '纸还在。', '这算不算一种有形的回忆？'],
  },
  打嗝: {
    key: '打嗝',
    title: '《打嗝》',
    body: ['我一打嗝，', '月亮就以为有人向它讲话。'],
  },
  漂流: {
    key: '漂流',
    title: '《漂流》',
    body: ['一只鬼漂过河。', '河却不认识鬼。', '好在河也不问姓名。'],
  },
  保密: {
    key: '保密',
    title: '《保密》',
    body: ['我把秘密藏进袖子。', '哦，我没有袖子。', '那就先藏在这里。'],
  },
  发芽: {
    key: '发芽',
    title: '《发芽》',
    body: ['一颗糖埋进夜晚。', '第二天没长成树。', '长成了想吃第二颗的我。'],
  },
};

export const POET_WORD_ROWS = [
  ['月亮', '楼梯', '南瓜', '失眠'],
  ['糖纸', '鞋带', '夜风', '旧书'],
  ['打嗝', '漂流', '保密', '发芽'],
];

export const EASTER_EGGS_DEF: EasterEggRecord[] = [
  {
    id: 'EGG01',
    name: '人类戳脸研究',
    desc: '5秒内连续戳半糖5次，它掏出倒拿的《论人类为什么喜欢戳鬼》。',
    discoveredAt: 0,
  },
  {
    id: 'EGG02',
    name: '月亮糖果化',
    desc: '长按夜空月亮600ms，月亮缩小成一颗糖落入手中。',
    discoveredAt: 0,
  },
  {
    id: 'EGG03',
    name: '气氛读书法',
    desc: '在桌前闲置12秒，半糖默默拿出一本倒过来的书。',
    discoveredAt: 0,
  },
  {
    id: 'EGG04',
    name: '味觉投诉表',
    desc: '连续喂同一种糖4次，幽灵拿出小小投诉表抗议单一食谱。',
    discoveredAt: 0,
  },
  {
    id: 'EGG05',
    name: '精神试炼',
    desc: '拿糖靠近嘴巴又拉远累计3次，半糖端正坐下抗议逗弄。',
    discoveredAt: 0,
  },
  {
    id: 'EGG06',
    name: '偏爱的执着',
    desc: '在尾声对最后一颗糖果连续轻点3次，半糖紧张护住糖纸。',
    discoveredAt: 0,
  },
  {
    id: 'EGG07',
    name: '不明来物（袜子）',
    desc: '在第二章天降物中接到一只旧袜子，半糖石化0.7秒。',
    discoveredAt: 0,
  },
  {
    id: 'EGG08',
    name: '书签拔除医生',
    desc: '帮半糖从身体里拔出卡住的书签，被嘴硬地夸赞。',
    discoveredAt: 0,
  },
  {
    id: 'EGG09',
    name: '梦境飞贼',
    desc: '在梦游幽灵窗户梦中等待3秒，窗外掠过海鸥偷糖。',
    discoveredAt: 0,
  },
  {
    id: 'EGG10',
    name: '零预算导演',
    desc: '连续点击电影海报标题3次，片名换为《一只幽灵的预算是零》。',
    discoveredAt: 0,
  },
  {
    id: 'EGG11',
    name: '倒转时光排版',
    desc: '在整理糖纸时把3张糖纸按逆序排列，触发纸边隐秘批注。',
    discoveredAt: 0,
  },
  {
    id: 'EGG12',
    name: '温柔点亮夜空',
    desc: '自由模式半糖睡着时，不用手指戳它，而是轻点小星星唤醒。',
    discoveredAt: 0,
  },
  {
    id: 'EGG13',
    name: '隐藏心事书签',
    desc: '达成至少两种温柔行为并持有糖心，书脊长出红色书签。',
    discoveredAt: 0,
  },
  {
    id: 'EGG14',
    name: '书底守夜人',
    desc: '在封底页面静静停留12秒，半糖探出头来道一句真巧。',
    discoveredAt: 0,
  },
  {
    id: 'EGG15',
    name: '荒唐归档大圆满',
    desc: '集齐全部12张糖纸，封面解锁烫金印章《一切荒唐皆已归档》。',
    discoveredAt: 0,
  },
];

export interface EndingTitleInfo {
  title: string;
  subNote: string;
}

export function evaluateEndingTitle(state: SaveState): EndingTitleInfo {
  // 1. 心动条件完成且手动触发心动彩蛋 → 秘密保管员
  if (state.easterEggs.includes('EGG13') || state.unlockedForms.includes('heart')) {
    return {
      title: '秘密保管员',
      subNote: '嘘，有些事请让月亮替我们保管。',
    };
  }

  // 2. 糖纸已集齐 ≥8 或触发彩蛋 ≥4 → 纸页漫游者
  if (state.collectibles.length >= 8 || state.easterEggs.length >= 4) {
    return {
      title: '纸页漫游者',
      subNote: '你连纸页角落的小事都看见了。',
    };
  }

  // 3. 主形态诗人或收藏怪诗 ≥2 → 怪诗共犯
  if (state.mainFormThisRun === 'poet' || state.savedPoems.length >= 2) {
    return {
      title: '怪诗共犯',
      subNote: '世界不一定有韵脚，我们可以自己写。',
    };
  }

  // 4. 接糖有效糖果数 ≥15 → 糖果收藏家
  if (state.totalCandy >= 15) {
    return {
      title: '糖果收藏家',
      subNote: '记得留一颗给自己。',
    };
  }

  // 5. 月亮彩蛋触发 → 月亮旁观者
  if (state.easterEggs.includes('EGG02')) {
    return {
      title: '月亮旁观者',
      subNote: '谢谢你陪月亮值了半个夜班。',
    };
  }

  // 6. 其他所有情况 → 深夜喂鬼员
  return {
    title: '深夜喂鬼员',
    subNote: '今晚你做的最大善事，是喂饱了一只鬼。',
  };
}
