import { CandyType, CandyFeedbackConfig } from '../types';

export const IDLE_DIALOGUES = [
  '你看，我会漂。虽然不远。',
  '有人说幽灵会穿墙。我会穿过正经话题。',
  '你是不是忘了还有一只鬼。',
  '我刚才认真想了想，算了。',
  '我已经饿到了能理解时钟。',
  '嘘，我在和月亮商量加餐。',
  '书里的人都不爱给糖。',
  '如果你忙，我先自己发一会儿呆。',
  '今天的风很像一张没写完的信。',
  '不许摸尾巴，那里存着尊严。',
  '我发现一个秘密，后来忘了。',
  '嗯？刚才是不是有人想我了。算了算了。',
];

export const CANDY_REACTIONS: Record<CandyType, { first: string; repeat: string; soundName: string }> = {
  pumpkin: {
    first: '我开始具有蔬菜气质。',
    repeat: '南瓜是一种有志气的糖。',
    soundName: 'puff',
  },
  milk: {
    first: '我喝到了一小段童年。',
    repeat: '怎么这么像一张旧毛毯。',
    soundName: 'gasp',
  },
  star: {
    first: '这颗糖的前途很亮。',
    repeat: '我是不是离天花板近了？',
    soundName: 'chime',
  },
  mint: {
    first: '我吞下了一整个冬天。',
    repeat: '请给我配一条围巾。',
    soundName: 'frost',
  },
  cloud: {
    first: '好像把午睡吃进去了。',
    repeat: '我要与床铺达成和解。',
    soundName: 'whiff',
  },
  blackSugar: {
    first: '这东西看起来像命运。',
    repeat: '命运太甜，我不太习惯。',
    soundName: 'rustle',
  },
  heart: {
    first: '咳，这只是普通糖。',
    repeat: '……不许一直看着我吃。',
    soundName: 'warm',
  },
  moon: {
    first: '月亮原来这么轻。',
    repeat: '夜空的缺口不知补好了没有。',
    soundName: 'twinkle',
  },
};

export const POKE_DIALOGUES = [
  '我们还没熟到可以戳脸。',
  '这不是电梯按钮。',
  '我正在消化，你先等等。',
  '你们人类表达好奇的方法，都这样失礼吗？',
  '这一章我有意见。', // 5 times trigger egg
];

export const TEASING_DIALOGUES = [
  '这已不叫喂食。',
  '这是精神试炼。',
];

export const SCENE_SCRIPTS = {
  S00: {
    loading: '正在把夜色装订成册……',
    ready: '今夜宜喂鬼',
    btn: '翻开这本书',
  },
  S01: {
    title: '今夜宜喂鬼',
    subtitle: '不给糖就捣蛋，以及其他小事。',
    tip: '请在一个不太忙的夜晚翻开',
    idlePencil: '里面那位有点饿。',
    btnOpen: '翻开',
  },
  S02: {
    lines: [
      '今晚，月亮有点饿。',
      '还有别的东西，也是。',
    ],
    btnWho: '是谁？',
    idleHint: '有人吗？',
  },
  S03: {
    lines: [
      '……',
      '我刚才是有计划地降落。',
      '你不许写进报告。',
    ],
    tagText: 'Ghost ½',
  },
  S04: {
    cardFront: '不给糖就捣蛋。',
    cardBack: '求求了。',
    lines: [
      '我是专业的鬼。',
      '专业到可以先吃一颗吗？',
    ],
    wrongDrop: '别试图重新设计我。',
    idleAsk: '我可以申请一个试吃名额吗？',
  },
  S05: {
    lines: [
      '嗯。',
      '你暂时可以活着。',
      '（这句本来应该很恐怖。）',
    ],
    paperFound: '拾起糖纸 #01',
    continueBtn: '继续翻开食谱',
  },
  S06: {
    title: '第一章｜一只鬼的基本食谱',
    subtitle: '请按口味投喂，后果自负。',
    longPressComplain: '这是体检还是充气？',
    consecutiveSame4: '你是不是以为鬼没有味觉？',
    consecutiveSame5: '我有，而且还有立场。',
    pushReaction: '风还挺有态度。',
    bookEasterEgg: '我读书靠的是气氛。',
  },
  S08: {
    lines: [
      '糟了。',
      '我的糖分开始决定命运了。',
      '这句话是不是不太科学？',
    ],
    btnNext: '出去走走',
  },
  S09: {
    title: '第二章｜糖果从天而降',
    subtitle: '气象台未对此负责。',
    lines: [
      '有人说今晚会下糖。',
      '气象学终于有用了。',
    ],
    btnCatch: '伸手接住',
  },
  S13: {
    title: '气象收据',
    line1: '本夜降水：糖果若干，意外很多。',
    line2: (count: number) => `你接住了 ${count} 颗糖。`,
    line3: '本报社认为，这算好天气。',
    btnNext: '继续观察异常现象',
  },
  S14: {
    title: '第三章｜变身事故备案',
    lines: [
      '我要告诉你一件事。',
      '鬼的身体不归鬼自己管。',
      '主要归糖管。',
    ],
    btnAccept: '接受事实',
  },
  S20: {
    lines: [
      '你以为结束了？',
      '糖分有续集。',
    ],
    idleHint: '选哪个都不影响宇宙。',
  },
  S21: {
    title: '第四章｜糖纸、废话诗与一点回礼',
    lines: [
      '鬼吃完东西是要付账的。',
      '虽然我通常付不起。',
      '但今晚可以破例。',
    ],
    btnTidy: '替它收拾糖纸',
    pocketItems: {
      cap: '这是我珍藏的零元硬币。',
      button: '失去一件大衣的证据。',
      ticket: '一趟没坐上的末班车。',
    },
  },
  S22: {
    guide: '按你喜欢的顺序，把三张糖纸摆进槽里。',
    putFeedback: [
      '这张是甜的。',
      '这张被风吹皱了。',
      '这张我没舍得吃。',
    ],
    completed: [
      '你看。',
      '乱七八糟的东西，也能排成一页。',
    ],
    btnNext: '合上这一页',
  },
  S23: {
    stampText: '本夜应付：一份好心情',
    lines: [
      '账单已结清。',
      '付款方式：陪一只鬼胡闹。',
    ],
    overStamp: '这是收据，不是农田。',
    btnOpenCard: '拆开信纸',
  },
  S24: {
    cardMainTitle: '万圣节快乐持有证',
    certText: '兹证明：你已成功喂饱一只不怎么专业的鬼。',
    quote: '愿你拥有许多不必解释的快乐，和一点恰到好处的偏爱。',
    validity: '有效期：直到月亮忘记升起的那天。',
    stampDate: '2026 · HALLOWEEN',
    btnSave: '保存纪念卡',
    btnNext: '再翻一页',
    savePrompt: '图片已生成，长按图片或通过系统菜单即可保存到相册',
  },
  S25: {
    lines: [
      '我吃饱了。',
      '按规定，我应该吓你一跳。',
      '哇。',
      '……业务能力有限。',
      '那我改送你一样东西。',
    ],
    candyUnwrapLines: [
      '这颗不算游戏奖励。',
      '是额外留给你的。',
    ],
    finalLines: [
      '万圣节快乐。',
      '还有……谢谢你没有把我赶出去。',
    ],
    eggTease: '这个不行，这个……是留给你的。',
    btnBookEnd: '合上书底',
  },
  S26: {
    closing1: '世界没有因此变得正常。',
    closing2: '但是多了一只吃饱的鬼。',
    btnFeedMore: '再喂它一颗',
    btnHandbook: '看看它留下的东西',
    btnReadAgain: '再读一遍',
    idlePeek: '你还在啊。真巧。',
  },
  S27: {
    welcome: [
      '你回来了。',
      '我没有等你。',
      '我只是在这儿。',
    ],
    feedMore10: '看来今晚的糖仓很富裕。',
  },
  S30: {
    lines: [
      '不要误会。',
      '这只是糖分在做不必要的修辞。',
    ],
    pokeHeart1: '你看错了。',
    pokeHeart2: '我还没想好该怎么解释。',
    finalLines: [
      '有些东西不适合说得太响。',
      '会把夜色吵坏。',
    ],
    btnKeepGently: '轻轻留着',
    btnBack: '合上心事',
  },
};

export const V2_SCRIPTS = {
  P00: {
    title: '今夜宜喂鬼',
    subtitle: '深夜读物，建议配糖',
    marginal: '十月的最后几页，总有些小东西不愿归档。',
    btnOpen: '翻开今晚',
    moonTap: '月亮正在掉字。',
  },
  P01: {
    signFront: '不给糖就捣蛋。',
    signBack: '如果方便的话。',
    poke: '别戳。我现在属于易碎文学。',
    fedLine: '嗯。恐吓暂停，先消化一下。',
    btnNext: '继续翻页 →',
  },
  P02: {
    forecast: '天气预报：今晚局部地区有糖。伴随少量荒谬。',
    ghostLine: '我没有带伞，但带了胃。',
    btnEarlyExit: '收起雨伞 / 翻页 →',
    btnNext: '翻开下一页 →',
    burp: '（小小的嗝）空气里还留着一张糖纸。',
    callouts: {
      note: '空气里有点不负责的文学。',
      bookmark: '这大概是某本书逃出来的骨头。',
      sock: '天气预报没有说这个。',
      streak: '我今天的运气有具体的形状。',
    },
  },
  P03: {
    header: '本鬼临时决定写作',
    ghostLine: '糖分过高，我开始有点文学了。',
    marginal: '请帮它挑三个词。它本人没有词汇储备。',
    finished: '我写好了。文学应当负责支付一颗糖。',
    pokeEgg: '本诗没有经费，请勿打赏。',
    btnFoldPoem: '把诗折起来 →',
  },
  P04: {
    title: '幽灵账本',
    marginal: '收糖：若干；还款能力：零',
    ghostLines: [
      '鬼也讲究礼尚往来。',
      '我目前只有一张糖纸，一首废话诗，以及还算完整的诚意。',
    ],
    quotes: [
      '有些夜晚并不特别。有人替它多留了一颗糖。',
      '月亮没说什么。它只是一直亮着。',
      '我收下了一颗糖，决定把这件小事认真对待。',
    ],
    btnWriteBack: '写在背面 →',
  },
  P05: {
    scareLines: [
      '按规矩，我该吓你一跳。',
      '哇——',
      '算了。这个比较擅长。',
      '这颗不算游戏奖励。',
      '是额外留给你的。',
      '万圣节快乐。愿你也有一点毫无理由的开心。',
    ],
    cardTitle: '万圣节快乐持有证',
    certText: '兹证明：你在一个普通的夜晚，认真喂饱了一只不太称职的鬼。',
    validity: '有效期：直到月亮忘记路。',
    stampDate: 'MIDNIGHT / 31 OCT 2026',
    stampSeal: '半糖 · 签收',
    btnSaveCard: '收下这张糖纸',
    btnFreeFeed: '再喂一颗',
    btnEndBook: '合上这本书',
  },
};

export const CANDY_RESPONSES: Record<CandyType, CandyFeedbackConfig> = {
  pumpkin: {
    id: 'pumpkin',
    name: '南瓜糖',
    formId: 'pumpkin',
    firstDialogue: ['我好像成熟了。', '但只是植物学意义上的。'],
    repeatDialogues: [
      ['成熟可以叠加吗？'],
      ['再吃下去我要参加丰收节了。'],
      ['南瓜是一种有志气的糖。'],
      ['身体稍微有点重，但不妨碍我飘。'],
    ],
    rapidDialogue: '你在培育我吗？',
    animationId: 'pumpkin-swell',
    expressionId: 'alert',
    soundId: 'puff',
    transitionId: 'pumpkin-shift',
    souvenirQuote: '成熟是一件慢吞吞的事，但今晚可以提前发生。',
  },
  milk: {
    id: 'milk',
    name: '奶糖',
    formId: 'milktea',
    firstDialogue: ['我身体里出现了标点。', '希望不是省略号。'],
    repeatDialogues: [
      ['原来标点也会沉底。'],
      ['我喝到了一小段童年。'],
      ['怎么这么像一张旧毛毯。'],
      ['胃里像有一杯加了温的晚安。'],
    ],
    rapidDialogue: '你在冲泡我吗？',
    animationId: 'milk-translucent',
    expressionId: 'soft',
    soundId: 'gasp',
    transitionId: 'milktea-shift',
    souvenirQuote: '愿你常有温热的事物，比如一杯奶茶，比如一段发呆。',
  },
  star: {
    id: 'star',
    name: '星星糖',
    formId: 'poet',
    firstDialogue: ['我突然有话要说。', '但这通常不是好事。'],
    repeatDialogues: [
      ['灵感是多余的糖分。'],
      ['这颗糖的前途很亮。'],
      ['文学应当负责支付一颗糖。'],
      ['写诗只是为了让沉默看起来很体面。'],
    ],
    rapidDialogue: '你是出版社派来催稿的吗？',
    animationId: 'star-inkdrop',
    expressionId: 'smug',
    soundId: 'chime',
    transitionId: 'poet-shift',
    souvenirQuote: '写不出来也没关系，今晚的月亮本来就不押韵。',
  },
  blackSugar: {
    id: 'blackSugar',
    name: '黑糖',
    formId: 'movie',
    firstDialogue: ['这一口很有电影感。', '就是没有预算。'],
    repeatDialogues: [
      ['镜头还没给到我。'],
      ['这东西尝起来像命运，略显浓郁。'],
      ['严肃是免费的特效。'],
      ['下次能给我加点聚光灯吗？'],
    ],
    rapidDialogue: '我们正在连拍吗？导演？',
    animationId: 'movie-monochrome',
    expressionId: 'complain',
    soundId: 'rustle',
    transitionId: 'movie-shift',
    souvenirQuote: '生活是一出低成本电影，但今晚你是唯一的观众与主角。',
  },
  cloud: {
    id: 'cloud',
    name: '云朵糖',
    formId: 'sleepwalk',
    firstDialogue: ['我没有睡着。', '我只是暂时不参加现实。'],
    repeatDialogues: [
      ['被窝是宇宙的避难所。'],
      ['好像把午睡吃进去了。'],
      ['我要与床铺达成和解。'],
      ['请把闹钟的声音调成静音。'],
    ],
    rapidDialogue: '你是在用糖把我催眠吗？',
    animationId: 'cloud-float',
    expressionId: 'sleepy',
    soundId: 'whiff',
    transitionId: 'sleepwalk-shift',
    souvenirQuote: '今晚准许你暂时不参加现实。安心睡个好觉。',
  },
  mint: {
    id: 'mint',
    name: '薄荷糖',
    formId: 'sleepwalk',
    firstDialogue: ['我吞下了一整个冬天。', '请给我配一条围巾。'],
    repeatDialogues: [
      ['风吹起来了。'],
      ['凉意很清醒。'],
    ],
    rapidDialogue: '舌头要结冰了。',
    animationId: 'mint-frost',
    expressionId: 'alert',
    soundId: 'frost',
    transitionId: 'sleepwalk-shift',
    souvenirQuote: '愿你在寒凉的日子里，总能找到温暖的口袋。',
  },
  heart: {
    id: 'heart',
    name: '糖心',
    formId: 'heart',
    firstDialogue: ['不要误会。', '这只是糖分在做不必要的修辞。'],
    repeatDialogues: [
      ['……不许一直看着我吃。'],
      ['有些东西不适合说得太响。'],
    ],
    rapidDialogue: '心跳没有在加速，是物理震动。',
    animationId: 'heart-warm',
    expressionId: 'soft',
    soundId: 'warm',
    transitionId: 'heart-shift',
    souvenirQuote: '今夜宜喂鬼。也宜对自己稍微好一点。',
  },
  moon: {
    id: 'moon',
    name: '月亮糖',
    formId: 'poet',
    firstDialogue: ['月亮原来这么轻。', '夜空的缺口不知补好了没有。'],
    repeatDialogues: [
      ['不好吃，有点孤独。'],
      ['月亮正在掉字。'],
    ],
    rapidDialogue: '别摘了，夜空要秃了。',
    animationId: 'moon-twinkle',
    expressionId: 'calm',
    soundId: 'twinkle',
    transitionId: 'poet-shift',
    souvenirQuote: '月亮没说什么。它只是一直亮着。',
  },
};

export const CHAPTER_SCRIPTS = {
  C01: {
    title: '第一页 · 遇见',
    chapterName: '第一章：有只鬼掉进了书里',
    introLines: [
      '我本来不是要来这里的。',
      '不过既然来了……',
    ],
    signText: '有糖吗？',
    interactHint: '轻触半糖或牌子',
    tapResponse: '你居然真的理我了。',
  },
  C02: {
    title: '第二页 · 一颗糖',
    chapterName: '第二章：给一只鬼一颗糖',
    topNote: '它说自己什么都吃。',
    subNote: '这句话后来被证明不太严谨。',
    abnormality: [
      '等一下。',
      '这颗糖好像有一点副作用。',
      '说明书应该早就过期了。',
    ],
    feedHint: '点选或拖动一颗糖喂它',
  },
  C03: {
    title: '第三页 · 小小后遗症',
    chapterName: '第三章：小小后遗症',
    pumpkin: {
      prompt: '它的帽子歪了。帮它正一下。',
      btnStraighten: '扶正帽子',
      line: '好了。现在只有整个世界是歪的。',
    },
    milktea: {
      prompt: '轻轻摇一下，把珍珠晃匀。',
      btnShake: '轻轻摇一下',
      lines: [
        '为什么它们停成了一个问号？',
        '可能它们也对未来感到困惑。',
      ],
    },
    poet: {
      prompt: '它需要一个词来结束这一首烂诗。',
      words: ['月亮', '糖纸', '失眠'],
      poems: {
        '月亮': {
          title: '《关于饱腹与引力》',
          lines: ['月亮今天很圆。', '因为我也圆了。', '这绝不是巧合。'],
        },
        '糖纸': {
          title: '《废弃包装的修辞》',
          lines: ['糖纸在风里响了一下。', '很像一句没说完的晚安。', '但它只是空了。'],
        },
        '失眠': {
          title: '《午夜三点的清醒》',
          lines: ['所有该睡的都睡了。', '剩下一只鬼。', '在反刍刚才那颗糖。'],
        },
      },
      line: '写得真好。虽然毫无用处。',
    },
    movie: {
      prompt: '给它打个板。',
      btnSlate: '咔！开拍',
      titleCard: '《一只幽灵差点拥有剧情》',
      line: '很好。本片到此杀青。',
    },
    sleepwalk: {
      prompt: '替它选一个梦。',
      cards: [
        { id: 'door', label: '纸门', line: '我梦见门后面还是一扇门。' },
        { id: 'boat', label: '纸船', line: '我梦见我坐着船，在墨水里打转。' },
        { id: 'window', label: '窗户', line: '我梦见天上下起了不会过期的糖。' },
      ],
      outroLine: '原来梦也要下班。',
    },
  },
  C04: {
    title: '第四页 · 回礼',
    chapterName: '第四章：一张不太正式的回礼',
    noteFrontLines: [
      '今夜宜喂鬼。',
      '也宜对自己稍微好一点。',
    ],
    btnFlipNote: '翻看背面',
    btnCert: '把今晚夹进书里。',
    cardTitle: '万圣节快乐持有证',
    certText: '兹证明：你在一个普通的夜晚，认真喂饱了一只不太称职的鬼。',
    btnRestart: '再翻一次',
    btnFreeFeed: '去看看半糖',
  },
};
