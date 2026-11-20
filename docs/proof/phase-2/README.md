# Bằng chứng Phase 2

| Tiêu chí | Kết quả và bằng chứng |
|---|---|
| Contract v1.1 và hồi quy | 20 bài kiểm thử, gồm cấu trúc JSONL, vật lý, ưu tiên sự kiện, số liệu và spawn trên ba bản đồ. Đã chạy lại 10 kiểm thử tại tag Phase 1. [Mã kiểm thử](../../../tests/contract.test.mjs) |
| Thắng Đêm 1 chuẩn | Replay seed 2026 dùng input thường và thắp 5/5 đèn. Hai lần chạy cho tệp giống từng byte. [Inputs](night-one-inputs.json) · [JSONL](night-one.jsonl) · [SHA-256](verify.txt) |
| Đêm 2, Bùa Gió, Gió Lạc, pause | Scenario kích hoạt bùa, cướp trước khi Bóng Mực gây hit, thu hồi đồ bằng Tỏa Sáng, lướt, tạm dừng và tiếp tục. [Scenario](night-two-scenario.json) · [Inputs](night-two-inputs.json) · [JSONL](night-two.jsonl) |
| Đêm 3 và hiệu năng headless | Scenario kiểm thử kiểm tra vách, dốc, tháp, bục và cửa sổ gió. Benchmark chạy trọn 21600 tick với snapshot mỗi 10 tick. [Scenario benchmark](night-three-scenario.json) · [Thời gian đo](verify.txt) |
| Luồng ba đêm, HUD và cài đặt | Bài thử Edge thao tác với menu, giới thiệu, HUD, pause, chơi lại và kiểm tra lưu cài đặt. Scenario chốt đêm cho phép kiểm tra chuyển đêm và tính tổng Bình Minh. Ghi nhận Web Audio phát nốt khi vào màn, nhảy và lướt. [Biên bản](browser.txt) · [Tạm dừng](pause.png) · [Cài đặt](settings.png) · [Bình Minh](dawn.png) |
| Cảnh 3D và FPS | Đo theo khung hình thực trong 5 giây chơi mỗi đêm, canvas 1280×720, DPR 1. [Số đo và bộ dựng WebGL](browser.txt) · [Đảo Bến](night-1.png) · [Cầu tre và Gió Lạc](bamboo-bridge.png) · [Tháp chuông](bell-tower.png) |

## Chạy lại

```sh
npm run verify -- --record tmp-proof
node src/headless.mjs --seed 2026 --night 2 --ticks 30 --snapshot-every 5 --scenario docs/proof/phase-2/night-two-scenario.json --inputs docs/proof/phase-2/night-two-inputs.json --out night-two.jsonl
```

Chạy `npm start` trước khi kiểm chứng trình duyệt. Script cần đường dẫn module Playwright Core và tệp thực thi Chromium hoặc Edge.

```sh
node scripts/browser-proof.mjs "<playwright-core/index.mjs>" "<Chromium hoặc Edge>" tmp-proof
```
