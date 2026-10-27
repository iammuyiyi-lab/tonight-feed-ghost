import { CandyType, GhostFormId } from '../types';

export const THEME_COLORS = {
  midnight: '#1F2942',
  paper: '#F7E9D2',
  paperDark: '#EADBBE',
  pumpkin: '#ED9A55',
  mistPurple: '#A5A0C8',
  sageGrey: '#A2B09B',
  accentRed: '#B66862',
  inkBrown: '#47392F',
  inkLight: '#7A6B5D',
  ghostBody: '#FFFDF7',
  ghostShadow: '#D8CBB6',
  goldStar: '#F4CA64',
  mintGreen: '#A0D8C3',
  milkWhite: '#FFFFFF',
  blackSugar: '#5C382A',
};

export interface CandyMeta {
  type: CandyType;
  name: string;
  desc: string;
  color: string;
  accent: string;
  primaryRoute: keyof import('../types').RouteScores;
  points: number;
}

export const CANDIES: Record<CandyType, CandyMeta> = {
  pumpkin: {
    type: 'pumpkin',
    name: '南瓜糖',
    desc: '带有淡淡的秋日香气与志气',
    color: '#ED9A55',
    accent: '#47392F',
    primaryRoute: 'pumpkin',
    points: 3,
  },
  milk: {
    type: 'milk',
    name: '牛奶糖',
    desc: '温热的一小段旧毛毯回忆',
    color: '#FFFFFF',
    accent: '#D0C4B4',
    primaryRoute: 'milktea',
    points: 3,
  },
  star: {
    type: 'star',
    name: '星星糖',
    desc: '据说能把前途照亮18像素',
    color: '#F4CA64',
    accent: '#E6A820',
    primaryRoute: 'poet',
    points: 3,
  },
  mint: {
    type: 'mint',
    name: '薄荷糖',
    desc: '吞下一整个秋风未至的冬天',
    color: '#A0D8C3',
    accent: '#5E9F88',
    primaryRoute: 'sleepwalk',
    points: 2,
  },
  cloud: {
    type: 'cloud',
    name: '云朵棉花糖',
    desc: '把一次午睡揉松后的蓬松甜味',
    color: '#F0EFF9',
    accent: '#A5A0C8',
    primaryRoute: 'sleepwalk',
    points: 3,
  },
  blackSugar: {
    type: 'blackSugar',
    name: '黑糖块',
    desc: '尝起来像命运，略显浓郁',
    color: '#653D2A',
    accent: '#3E2417',
    primaryRoute: 'movie',
    points: 2, // also poet +1
  },
  heart: {
    type: 'heart',
    name: '红色糖心',
    desc: '悄悄藏在尾巴后面的特别糖果',
    color: '#B66862',
    accent: '#8C3F3A',
    primaryRoute: 'poet',
    points: 3,
  },
  moon: {
    type: 'moon',
    name: '月亮糖',
    desc: '夜空长按摘下的小小碎片',
    color: '#F7E27B',
    accent: '#CBB241',
    primaryRoute: 'sleepwalk',
    points: 3,
  },
};

export const FORMS_META: Record<GhostFormId, { name: string; title: string; desc: string; icon: string }> = {
  default: {
    name: '半糖（基础）',
    title: '不怎么专业的鬼',
    desc: '暖白布偶幽灵，黑豆眼，容易饿，有点较真。',
    icon: '👻',
  },
  pumpkin: {
    name: '南瓜幽灵',
    title: '论成熟为何挡住视线',
    desc: '戴着歪斜南瓜壳，被迫乐观却看不清前途。',
    icon: '🎃',
  },
  milktea: {
    name: '温牛奶幽灵',
    title: '融化的甜与晚安热牛奶',
    desc: '被方正的牛奶糖彻底融化，散发着安眠曲般的暖甜奶香。',
    icon: '🥛',
  },
  poet: {
    name: '诗人幽灵',
    title: '一本正经胡说八道',
    desc: '斜戴贝雷帽，手持鹅毛笔，废话也要有韵脚。',
    icon: '✒️',
  },
  movie: {
    name: '电影幽灵',
    title: '零预算的秋天文艺片',
    desc: '场记板砸头，胶片做围巾，主角注定摔倒。',
    icon: '🎬',
  },
  sleepwalk: {
    name: '梦游幽灵',
    title: '短暂离开逻辑的航行',
    desc: '夜云睡帽垂落，正在把星星拼成梦里的门窗。',
    icon: '🌙',
  },
  heart: {
    name: '心动幽灵',
    title: '一本不肯朗读的书',
    desc: '脸颊泛起极淡砖红，糖分在做不必要的修辞。',
    icon: '❤️',
  },
};
