# TTS Studio

App desktop (Electron) tạo Text-to-Speech hàng loạt bằng **Gemini TTS**, xoay vòng nhiều API key, quản lý theo dự án. Tối ưu cho việc tạo nội dung ngắn hàng loạt (quảng cáo) và tạo nhanh cá nhân.

## Tính năng

- **Dự án (Batch):** mỗi dự án là một phiên làm việc lưu lại được — CRUD đầy đủ (tạo / nhân bản / đổi tên / xóa, tùy chọn xóa file). Import CSV/TSV hoặc dán nhiều dòng (mỗi dòng = 1 sản phẩm, cột `text, voice, style`).
- **Engine nhận biết quota:** đếm request mỗi key theo ngày, reset nửa đêm giờ Pacific, tự xoay key khi gặp 429, **tự dừng gọn khi hết quota** để resume sau.
- **Regen chọn lọc:** nghe từng dòng trong app, sửa text → tạo lại đúng dòng đó (tiết kiệm quota).
- **API Keys:** pool key lưu **mã hóa bằng safeStorage** của OS, hiển thị quota realtime từng key, validate, bật/tắt.
- **Tạo nhanh:** 1 đoạn → chọn giọng + phong cách → nghe → lưu MP3/WAV.
- **Từ điển phát âm:** thay thế trước khi đọc (vd `TP.HCM` → `Thành phố Hồ Chí Minh`).
- **Tên file theo ngày:** folder `{YYYY-MM-DD}_{Tên dự án}/`, mẫu tên file với biến `{date} {datetime} {project} {index} {slug} {voice}` + xem trước.
- **UI hiện đại:** dark-first, accent gradient tím→xanh, glassmorphism, micro-interaction (Framer Motion). Phím tắt: `Ctrl+1..4` chuyển mục, `Esc` quay lại.

## Yêu cầu
- Node.js 20+ (đã test trên Node 24)
- API key Gemini (model mặc định `gemini-3.1-flash-tts-preview`)

## Chạy

```bash
npm install        # cài deps (thuần JS — không cần build native)
npm run dev        # chạy dev (hot reload)
npm run build      # build production bundle
npm test           # 26 unit test (core logic)
npm run typecheck  # kiểm tra type
npm run dist       # đóng gói app (electron-builder)
```

Lần đầu mở app: vào **API Keys** thêm key → vào **Cài đặt** chọn thư mục xuất → tạo **Dự án**.

## Kiến trúc

- **electron/core/** — logic thuần, không phụ thuộc Electron (pacific, wav, filename, csv, dictionary, keypool, types). Được unit-test.
- **electron/services/** — store (JSON atomic), crypto (safeStorage), gemini (REST), audio (PCM→WAV/MP3 qua ffmpeg), engine (xoay key + quota), queue (batch).
- **electron/ipc/** — cầu nối main ↔ renderer.
- **src/renderer/** — UI React (design system trong `src/design/`, màn trong `src/routes/`, state trong `src/store/`).

Lưu trữ: JSON tại `userData/data.json` (đủ cho quy mô vài trăm dòng/dự án + hàng trăm key, không cần native module).

Xem [PLAN.md](PLAN.md) để biết chi tiết lộ trình.
