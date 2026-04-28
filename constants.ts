export const API = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port || (window.location.protocol === 'https:' ? 443 : 9400)}`
  : 'http://127.0.0.1:9400';

export const GLOW = {};
export const AMBER_GLOW = {};
export const GREEN_GLOW = {};
export const GRID = {};

export const SMTP_PRESETS: Record<string, { smtp: string; port: string }> = {
  'QQ邮箱': { smtp: 'smtp.qq.com', port: '465' },
  '163邮箱': { smtp: 'smtp.163.com', port: '465' },
  '126邮箱': { smtp: 'smtp.126.com', port: '465' },
  'Gmail': { smtp: 'smtp.gmail.com', port: '587' },
  'Outlook': { smtp: 'smtp.office365.com', port: '587' },
};

export const CITY_CODES: Record<string, string> = {
  // 国内
  '北京': 'BJS', '上海': 'SHA', '广州': 'CAN', '深圳': 'SZX',
  '成都': 'CTU', '重庆': 'CKG', '杭州': 'HGH', '武汉': 'WUH',
  '西安': 'SIA', '南京': 'NKG', '天津': 'TSN', '青岛': 'TAO',
  '厦门': 'XMN', '昆明': 'KMG', '大连': 'DLC', '沈阳': 'SHE',
  '哈尔滨': 'HRB', '长沙': 'CSX', '郑州': 'CGO', '济南': 'TNA',
  '贵阳': 'KWE', '南宁': 'NNG', '海口': 'HAK', '三亚': 'SYX',
  '乌鲁木齐': 'URC', '兰州': 'LHW', '西宁': 'XNN', '银川': 'INC',
  // 亚洲
  '东京': 'TYO', '大阪': 'OSA', '名古屋': 'NGO', '札幌': 'SPK',
  '首尔': 'SEL', '釜山': 'PUS', '曼谷': 'BKK', '清迈': 'CNX',
  '新加坡': 'SIN', '吉隆坡': 'KUL', '马尼拉': 'MNL', '河内': 'HAN',
  '胡志明市': 'SGN', '雅加达': 'JKT', '巴厘岛': 'DPS', '金边': 'PNH',
  '暹粒': 'REP', '东京成田': 'NRT', '香港': 'HKG', '澳门': 'MFM',
  '台北': 'TPE', '迪拜': 'DXB', '新德里': 'DEL', '孟买': 'BOM',
  // 欧洲
  '伦敦': 'LON', '巴黎': 'PAR', '法兰克福': 'FRA', '阿姆斯特丹': 'AMS',
  '罗马': 'ROM', '米兰': 'MIL', '马德里': 'MAD', '巴塞罗那': 'BCN',
  '苏黎世': 'ZRH', '维也纳': 'VIE', '莫斯科': 'MOW', '伊斯坦布尔': 'IST',
  '赫尔辛基': 'HEL',
  // 北美
  '纽约': 'NYC', '洛杉矶': 'LAX', '旧金山': 'SFO', '西雅图': 'SEA',
  '温哥华': 'YVR', '多伦多': 'YYZ', '芝加哥': 'ORD',
  // 大洋洲
  '悉尼': 'SYD', '墨尔本': 'MEL', '奥克兰': 'AKL',
};

export const CITY_GROUPS: { label: string; cities: string[] }[] = [
  { label: '国内', cities: Object.keys(CITY_CODES).slice(0, 28) },
  { label: '亚洲', cities: Object.keys(CITY_CODES).slice(28, 52) },
  { label: '欧洲', cities: Object.keys(CITY_CODES).slice(52, 65) },
  { label: '北美', cities: Object.keys(CITY_CODES).slice(65, 72) },
  { label: '大洋洲', cities: Object.keys(CITY_CODES).slice(72) },
];

export const inp = "w-full bg-white border border-gray-200 text-gray-800 text-sm px-3 py-2.5 outline-none focus:border-wechat focus:ring-1 focus:ring-wechat/20 rounded-md";
export const sel = inp;
export const lbl = "text-[12px] text-gray-500 block mb-1.5";
