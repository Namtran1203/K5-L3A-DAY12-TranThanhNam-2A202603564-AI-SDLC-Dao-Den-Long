# Đảo Đèn Lồng

Mây, người giữ đèn nhỏ tuổi, tìm đom đóm để thắp lại năm Đèn Lồng Lớn trên Đảo Bến. Hãy tránh Bóng Mực và hoàn thành trước bình minh.

[Ảnh chơi thử Phase 1](docs/proof/phase-1/gameplay.png) · [Bằng chứng kiểm chứng](docs/proof/phase-1/README.md) · [Tài liệu lab](LAB.md)

## Chạy game

Cần Node.js 22 trở lên và trình duyệt hỗ trợ WebGL 2 trên macOS, Linux hoặc Windows. Sau khi clone repo, chạy hai lệnh sau và mở `http://127.0.0.1:4173`.

```sh
npm ci
npm start
```

| Điều khiển | Tác dụng |
|---|---|
| WASD hoặc phím mũi tên | Đi theo hướng camera |
| Space | Nhảy |
| E | Nạp đom đóm vào đèn đã tắt gần Mây nhất |
| Q | Tiêu 2 đom đóm để tỏa sáng, đẩy lùi và làm choáng Bóng Mực trong phạm vi |
| Kéo chuột trên cảnh 3D | Xoay camera |

Mỗi Đèn Lồng Lớn cần 6 đom đóm và nhận được nhiều lượt nạp. Có thể mang tối đa 12 đom đóm. Đèn sáng tạo vùng an toàn bán kính 4,5 m. Bóng Mực chạm Mây làm mất một lửa và rơi 40% đom đóm đang mang, làm tròn xuống. Mép đảo giới hạn bước đi, nên `fall_enabled` là `false`. Phase 1 chưa có dash.

## Điểm số

Nhặt một đom đóm được 10 điểm, thắp một đèn được 100 điểm, và mỗi Bóng Mực trúng một lần tỏa sáng được 25 điểm. Khi thắng, cộng 2 điểm mỗi giây nguyên còn lại và 50 điểm mỗi lửa còn lại. Khi thua, điểm đã tích lũy vẫn hiển thị. Bấm **Chơi lại** để bắt đầu lại Đêm 1.

## Kiểm chứng và headless

```sh
npm run verify
node src/headless.mjs --seed 2026 --night 1 --ticks 18000 --inputs docs/proof/phase-1/night-one-inputs.json --snapshot-every 600 --out night-one.jsonl
```

Contract v1.0 và toàn bộ thông số nằm trong [game.contract.json](game.contract.json). CLI cũng nhận `--scenario <file.json>`. Nếu bỏ `--inputs`, Mây đứng yên. Nếu bỏ `--snapshot-every`, CLI ghi snapshot mỗi 10 tick, bắt đầu từ tick 0. Game trên web và headless chạy cùng mô phỏng 60 tick/giây.

Xem [giả định và nhật ký AI](docs/notes/phase-1.md), [hướng dẫn cho agent](AGENTS.md) và [nguồn tài sản](CREDITS.md).

## Sáng tạo của tôi

Minimap la bàn đánh dấu vị trí, hướng nhìn của Mây và các đèn đã sáng. Quầng sáng âm ấm lan ra mặt đất và đảo chuyển dần từ tím lạnh sang vàng khi thắp thêm đèn. Các chi tiết này được tính ở lớp hiển thị. Bài chơi thử trên trình duyệt và replay headless cùng thắng sau 2474 tick với 1651 điểm. [Đèn vừa thắp](docs/proof/phase-1/lit-lantern.png) · [JSONL headless](docs/proof/phase-1/night-one.jsonl)
