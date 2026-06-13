# TTS Studio — Kế hoạch triển khai

App desktop tạo TTS hàng loạt bằng Gemini, xoay vòng nhiều API key, quản lý theo Project.

## Stack
- **Electron** (main + preload + renderer, contextIsolation bật)
- **React + TypeScript + Vite** (renderer)
- **Tailwind CSS + Framer Motion** (UI + animation)
- **better-sqlite3** (lưu project/quota/queue/dictionary)
- **Electron safeStorage** (mã hóa API key tại chỗ)
- **ffmpeg-static + fluent-ffmpeg** (PCM 24k → MP3)
- **Zustand** (state renderer)

## Kiến trúc thư mục
```
tts/
├── electron/
│   ├── main.ts              # bootstrap, window, IPC register
│   ├── preload.ts           # contextBridge API an toàn
│   ├── ipc/                 # handlers: projects, keys, tts, queue, settings
│   └── services/
│       ├── db.ts            # better-sqlite3 + migrations
│       ├── keyPool.ts       # chọn key, đánh dấu 429, validate
│       ├── quota.ts         # đếm req/key/ngày, reset nửa đêm PT
│       ├── gemini.ts        # gọi REST generateContent (AUDIO)
│       ├── audio.ts         # PCM→WAV→MP3 (ffmpeg)
│       ├── queue.ts         # hàng đợi batch, retry, resume qua ngày
│       └── crypto.ts        # safeStorage wrap
├── src/                     # renderer (React)
│   ├── design/              # tokens, theme, primitives (Button, Card, Badge, Toast, Quota)
│   ├── routes/              # Projects, ProjectDetail(Batch), Quick, Keys, Settings
│   ├── store/               # zustand slices
│   └── lib/                 # ipc client, formatters
├── resources/               # ffmpeg binary (đóng gói)
└── ...config (vite, tailwind, electron-builder)
```

## Mô hình dữ liệu (SQLite)
- **projects**(id, name, status, output_dir, settings_json, created_at, updated_at)
- **rows**(id, project_id, idx, text, voice, style, status, file_path, error, updated_at)
- **keys**(id, label, account, enc_key, active, created_at)
- **quota_usage**(key_id, date_pt, count)  — reset theo ngày Pacific
- **dictionary**(id, pattern, replacement)  — phát âm tiếng Việt
- **settings**(k, v)  — output root, mẫu tên file, model, theme...

## Design tokens (chốt trước, dùng xuyên suốt)
- Nền: `#0E0E11`; surface `#16161B`/`#1C1C23`; border `#26262E`
- Accent gradient: `#7C5CFF → #00D4FF` (tím→xanh), dùng tiết chế
- Text: `#EDEDF2` / muted `#9A9AA6`
- Trạng thái: chờ xám, chạy xanh dương, xong xanh lá, lỗi đỏ
- Radius 12–16px, shadow mềm nhiều lớp, font Inter (số: tabular-nums)
- Motion: Framer Motion, easing mượt, micro-interaction có chủ đích

## Gemini TTS (đã xác minh)
- Model: `gemini-3.1-flash-tts-preview`
- `POST .../v1beta/models/{model}:generateContent`, header `x-goog-api-key`
- body: `generationConfig.responseModalities:["AUDIO"]` + `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`
- response: base64 PCM 24kHz/16-bit/mono tại `candidates[0].content.parts[0].inlineData.data` (KHÔNG header → tự wrap WAV → MP3)
- style nhét trong text; ~30 giọng; 32k token; free ~10 req/ngày/project, reset nửa đêm PT

## Lộ trình (mỗi GĐ ra thứ chạy được)
1. **Khung + Design System** — scaffold, tokens, primitives, layout shell, dark theme. ⟶ duyệt "chất" UI.
2. **Key & Quota** — màn Key pool (import/validate/mã hóa), engine quota realtime + reset PT.
3. **Projects** — màn home dạng grid card, CRUD (tạo/nhân bản/đổi tên/xóa), auto-save.
4. **Quick mode** — 1 text → giọng+style (nghe thử) → tạo → player → lưu, lịch sử.
5. **Batch mode** — import CSV/Excel/paste, bảng map cột, hàng đợi rotate+retry+resume, regen chọn lọc, xuất MP3 theo mẫu tên, mở folder, thông báo.
6. **Tinh chỉnh** — từ điển phát âm, presets, mẫu tên file + preview, phím tắt, polish motion.
```
```
