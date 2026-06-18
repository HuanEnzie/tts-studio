// Stub preload for the screenshot harness: exposes window.api with mock data
// so every screen renders without a live main process.
const { contextBridge } = require('electron')

const now = 1750000000000
const projects = [
  { id: 'p1', name: 'Quảng cáo ưu đãi tháng 6', status: 'running', settings: { voice: 'Kore', style: '', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}' }, createdAt: now, updatedAt: now, rows: Array.from({ length: 40 }, (_, i) => ({ id: 'r' + i, idx: i, text: ['Khuyến mãi mùa hè giảm đến 50% toàn bộ sản phẩm', 'Mua 1 tặng 1 chỉ trong hôm nay', 'Ưu đãi đặc biệt cho khách hàng thân thiết'][i % 3], voice: 'Kore', style: '', status: i < 18 ? 'done' : (i === 18 ? 'running' : 'pending'), filePath: i < 18 ? 'C:/out/' + i + '.mp3' : undefined, updatedAt: now })) },
  { id: 'p2', name: 'Voice intro kênh YouTube', status: 'done', settings: { voice: 'Puck', style: '', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}' }, createdAt: now, updatedAt: now - 86400000, rows: Array.from({ length: 12 }, (_, i) => ({ id: 'q' + i, idx: i, text: 'Xin chào các bạn', voice: 'Puck', style: '', status: 'done', updatedAt: now })) },
  { id: 'p3', name: 'Spot radio cửa hàng', status: 'partial', settings: { voice: 'Zephyr', style: '', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}' }, createdAt: now, updatedAt: now - 172800000, rows: Array.from({ length: 30 }, (_, i) => ({ id: 's' + i, idx: i, text: 'Thông báo cửa hàng', voice: 'Zephyr', style: '', status: i < 27 ? 'done' : 'error', updatedAt: now })) },
  { id: 'p4', name: 'Test giọng đọc sách', status: 'draft', settings: { voice: 'Charon', style: '', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}' }, createdAt: now, updatedAt: now - 259200000, rows: Array.from({ length: 8 }, (_, i) => ({ id: 't' + i, idx: i, text: 'Chương một', voice: 'Charon', style: '', status: 'pending', updatedAt: now })) }
]
const keys = [
  { id: 'k1', label: 'Nick A - Project 1', account: 'a@gmail.com', active: true, tier: 'free', dailyLimit: 10, banned: false, createdAt: now },
  { id: 'k2', label: 'Nick A - Project 2', account: 'a@gmail.com', active: true, tier: 'free', dailyLimit: 10, banned: false, createdAt: now },
  { id: 'k3', label: 'Key trả phí', account: 'pay@gmail.com', active: true, tier: 'paid', dailyLimit: 10, banned: false, createdAt: now },
  { id: 'k4', label: 'Nick B - Project 1', account: 'b@gmail.com', active: true, tier: 'free', dailyLimit: 10, banned: true, createdAt: now }
]
const quota = { freeUsed: 17, freeTotal: 20, paidUsed: 42, activeKeys: 3, keys: [
  { id: 'k1', label: 'Nick A - Project 1', account: 'a@gmail.com', active: true, tier: 'free', banned: false, used: 10, limit: 10, exhausted: true },
  { id: 'k2', label: 'Nick A - Project 2', account: 'a@gmail.com', active: true, tier: 'free', banned: false, used: 7, limit: 10, exhausted: false },
  { id: 'k3', label: 'Key trả phí', account: 'pay@gmail.com', active: true, tier: 'paid', banned: false, used: 42, limit: 0, exhausted: false },
  { id: 'k4', label: 'Nick B - Project 1', account: 'b@gmail.com', active: true, tier: 'free', banned: true, used: 0, limit: 10, exhausted: false }
] }
const settings = { outputRoot: 'C:/Users/Acer/Documents/TTS Studio', model: 'gemini-3.1-flash-tts-preview', defaultVoice: 'Kore', defaultStyle: '', voiceInstruction: 'Giọng nam miền Bắc, trầm ấm, truyền cảm, phù hợp video TVC.', filenameTemplate: '{date}_{project}_{index}_{slug}', dailyLimitPerKey: 10, format: 'mp3', proxyUrl: '' }
const dict = [
  { id: 'd1', pattern: 'TP.HCM', replacement: 'Thành phố Hồ Chí Minh', enabled: true },
  { id: 'd2', pattern: 'iPhone', replacement: 'ai phôn', enabled: true }
]

const responses = {
  'settings:get': settings,
  'dict:list': dict,
  'keys:list': keys,
  'quota:summary': quota,
  'quota:hasCapacity': true,
  'projects:list': projects,
  'projects:get': projects[0]
}

contextBridge.exposeInMainWorld('api', {
  platform: 'win32',
  invoke: (channel) => Promise.resolve(responses[channel] ?? null),
  on: () => () => {}
})
