# Bằng chứng Phase 1

| Tiêu chí | Kết quả và bằng chứng |
|---|---|
| Contract v1.0 | 10 bài kiểm thử đạt. Kiểm tra tick, input bền, nhảy, nhặt và nạp, đẩy và choáng, vùng an toàn, va chạm, thắng/thua, scenario, mã lỗi và id tất định. [Mã kiểm thử](../../../tests/contract.test.mjs) |
| Thắng Đêm 1 mặc định | Seed 2026, không ghi đè scenario, thu đủ ánh sáng và thắp L1–L5. Kết thúc sau 2474 tick với 1651 điểm. [Input replay](night-one-inputs.json) · [JSONL](night-one.jsonl) |
| Tất định | Hai lần chạy headless cho tệp giống từng byte. [Kết quả và SHA-256](verify.txt) |
| Chơi, thắng, thua và chơi lại trên web | Edge nhận phím chơi, HUD đạt 5/5 đèn và 1651 điểm. Đứng yên ở lượt mới làm mất hết lửa và hiện lựa chọn Chơi lại. Đã bấm Chơi lại sau cả hai kết quả và xác minh đặt lại HUD. [Biên bản](browser.txt) · [Thắng](victory.png) · [Thua](defeat.png) |
| Cảnh 3D, ánh sáng và minimap | HUD, đom đóm, Mây đội nón, Bóng Mực, minimap và quầng quanh đèn có thể quan sát trực tiếp. [Chơi thử](gameplay.png) · [Đèn vừa thắp](lit-lantern.png) |

## Chạy lại

Chạy bộ kiểm thử và tái tạo JSONL vào một thư mục riêng.

```sh
npm run verify -- --record tmp-proof
```

Để chạy lại bài thử giao diện, mở game bằng `npm start`, rồi gọi script bên dưới với đường dẫn tới `playwright-core/index.mjs` và tệp thực thi của Chromium hoặc Edge. Có thể cài `playwright-core` ở một thư mục tạm riêng cho lần kiểm thử. Bài thử điều khiển thời gian dựng hình để có thể lặp lại đúng số tick.

```sh
node scripts/browser-proof.mjs "<playwright-core/index.mjs>" "<Chromium hoặc Edge>" tmp-proof
```
