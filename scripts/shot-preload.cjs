// Stub preload for the screenshot harness: exposes window.api with mock data
// so every screen renders without a live main process.
const { contextBridge } = require('electron')

const now = 1750000000000
const projects = [
  { id: 'p1', name: 'Quảng cáo ưu đãi tháng 6', status: 'running', settings: { voice: 'Kore', style: '', voiceInstruction: 'Giọng nam miền Bắc, truyền cảm', scene: 'Quảng cáo sôi động', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}', budgetUsd: 0 }, createdAt: now, updatedAt: now, rows: Array.from({ length: 40 }, (_, i) => ({ id: 'r' + i, idx: i, text: ['Khuyến mãi mùa hè giảm đến 50% toàn bộ sản phẩm', 'Mua 1 tặng 1 chỉ trong hôm nay', 'Ưu đãi đặc biệt cho khách hàng thân thiết'][i % 3], voice: 'Kore', style: '', status: i < 18 ? 'done' : (i === 18 ? 'running' : 'pending'), filePath: i < 18 ? 'C:/out/' + i + '.mp3' : undefined, updatedAt: now })) },
  { id: 'p2', name: 'Voice intro kênh YouTube', status: 'done', settings: { voice: 'Puck', style: '', voiceInstruction: 'Giọng nam miền Bắc, truyền cảm', scene: 'Quảng cáo sôi động', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}', budgetUsd: 0 }, createdAt: now, updatedAt: now - 86400000, rows: Array.from({ length: 12 }, (_, i) => ({ id: 'q' + i, idx: i, text: 'Xin chào các bạn', voice: 'Puck', style: '', status: 'done', updatedAt: now })) },
  { id: 'p3', name: 'Spot radio cửa hàng', status: 'partial', settings: { voice: 'Zephyr', style: '', voiceInstruction: 'Giọng nam miền Bắc, truyền cảm', scene: 'Quảng cáo sôi động', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}', budgetUsd: 0 }, createdAt: now, updatedAt: now - 172800000, rows: Array.from({ length: 30 }, (_, i) => ({ id: 's' + i, idx: i, text: 'Thông báo cửa hàng', voice: 'Zephyr', style: '', status: i < 27 ? 'done' : 'error', updatedAt: now })) },
  { id: 'p4', name: 'Test giọng đọc sách', status: 'draft', settings: { voice: 'Charon', style: '', voiceInstruction: 'Giọng nam miền Bắc, truyền cảm', scene: 'Quảng cáo sôi động', format: 'mp3', filenameTemplate: '{date}_{project}_{index}_{slug}', budgetUsd: 0 }, createdAt: now, updatedAt: now - 259200000, rows: Array.from({ length: 8 }, (_, i) => ({ id: 't' + i, idx: i, text: 'Chương một', voice: 'Charon', style: '', status: 'pending', updatedAt: now })) }
]
const keys = [
  { id: 'k1', label: 'Nick A - Project 1', account: 'a@gmail.com', active: true, tier: 'free', banned: false, createdAt: now },
  { id: 'k2', label: 'Nick A - Project 2', account: 'a@gmail.com', active: true, tier: 'free', banned: false, createdAt: now },
  { id: 'k3', label: 'Key trả phí', account: 'pay@gmail.com', active: true, tier: 'tier3', banned: false, createdAt: now },
  { id: 'k4', label: 'Nick B - Project 1', account: 'b@gmail.com', active: true, tier: 'free', banned: true, bannedReason: 'Project denied access (403)', createdAt: now }
]
const quota = { freeUsed: 17, freeTotal: 20, paidUsed: 42, activeKeys: 3, keys: [
  { id: 'k1', label: 'Nick A - Project 1', account: 'a@gmail.com', active: true, tier: 'free', banned: false, used: 10, limit: 10, rpm: 3, exhausted: true },
  { id: 'k2', label: 'Nick A - Project 2', account: 'a@gmail.com', active: true, tier: 'free', banned: false, used: 7, limit: 10, rpm: 3, exhausted: false },
  { id: 'k3', label: 'Key trả phí', account: 'pay@gmail.com', active: true, tier: 'tier3', banned: false, used: 42, limit: 0, rpm: 1000, exhausted: false },
  { id: 'k4', label: 'Nick B - Project 1', account: 'b@gmail.com', active: true, tier: 'free', banned: true, used: 0, limit: 10, rpm: 3, exhausted: false }
] }
const settings = { outputRoot: 'C:/Users/Acer/Documents/TTS Studio', model: 'gemini-3.1-flash-tts-preview', defaultVoice: 'Kore', defaultStyle: '', voiceInstruction: 'Giọng nam miền Bắc, trầm ấm, truyền cảm.', scene: 'Quảng cáo sôi động, kêu gọi mua ngay.', filenameTemplate: '{date}_{project}_{index}_{slug}', format: 'mp3', concurrency: 4, dailyBudgetUsd: 5, cacheEnabled: true, priceInputPerM: 0.5, priceAudioPerM: 10, requestTimeoutSec: 120, proxyUrl: '' }
const dict = [
  { id: 'd1', pattern: 'TP.HCM', replacement: 'Thành phố Hồ Chí Minh', enabled: true },
  { id: 'd2', pattern: 'iPhone', replacement: 'ai phôn', enabled: true }
]
const presets = [
  { id: 'pre1', name: 'TVC nam Bắc', voice: 'Charon', context: 'Giọng nam miền Bắc, truyền cảm', scene: 'Quảng cáo sôi động', style: '' },
  { id: 'pre2', name: 'Đọc sách nữ', voice: 'Kore', context: 'Giọng nữ ấm, chậm rãi', scene: 'Kể chuyện', style: '' }
]
const cost = { todayUsd: 1.2345, todayInputTokens: 12000, todayOutputTokens: 98000, dailyBudgetUsd: 5 }

const responses = {
  'settings:get': settings,
  'dict:list': dict,
  'presets:list': presets,
  'cost:summary': cost,
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
