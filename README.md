# Đảo Đèn Lồng

Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại Đảo Bến, Đảo Cau và Đảo Chuông trước bình minh. Dùng đèn sáng làm nơi trú Bóng Mực, vượt cầu tre và tận dụng bục nhảy trên hành trình qua ba đêm.

[Bằng chứng Phase 2](docs/proof/phase-2/README.md) · [Bằng chứng Phase 1](docs/proof/phase-1/README.md) · [Tài liệu lab](LAB.md)

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
| Shift | Lướt theo hướng chạy hoặc hướng Mây đang quay mặt |
| E | Nạp đom đóm vào đèn đã tắt gần Mây nhất |
| Q | Tiêu 3 đom đóm để Tỏa Sáng, làm choáng Bóng Mực và xua Gió Lạc đang đuổi |
| Esc hoặc P | Tạm dừng hoặc tiếp tục |
| Kéo chuột trên cảnh 3D | Xoay camera |

Mỗi Đèn Lồng Lớn cần 10 đom đóm và nhận được nhiều lượt nạp. Mây mang tối đa 10 đom đóm và có 3 Ngọn Lửa mỗi đêm. Bóng Mực làm rơi một nửa số đom đóm đang mang khi chạm Mây. Đèn sáng tạo vùng an toàn bán kính 6 m. Gió Lạc vẫn có thể cướp ánh sáng ở vùng an toàn. Bùa Gió tăng tốc và cho phép lướt lại ngay khi lần trước kết thúc.

Bước ra khỏi mép đảo có thể làm Mây mất một Ngọn Lửa và toàn bộ đom đóm đang mang. Đêm 2 có cầu tre và bục phóng qua đảo kia. Đêm 3 có hai dốc lên tầng trên, một bục phóng lên tháp chuông và gió mạnh được báo bằng lá bay và âm thanh. Cài đặt âm lượng và độ nhạy chuột có trong menu chính và menu tạm dừng.

## Điểm số

Nạp một đom đóm được 10 điểm, thắp một đèn được 100 điểm và mỗi Bóng Mực trúng Tỏa Sáng được 5 điểm. Khi thắng, cộng 2 điểm mỗi giây nguyên còn lại và 50 điểm mỗi Ngọn Lửa còn lại. Màn Bình Minh hiển thị tổng điểm ba đêm đã thắng. Nếu thua, bạn có thể chơi lại đêm hiện tại.

## Kiểm chứng và headless

```sh
npm run verify
node src/headless.mjs --seed 2026 --night 1 --ticks 18000 --inputs docs/proof/phase-2/night-one-inputs.json --snapshot-every 600 --out night-one.jsonl
```

Contract v1.1 và toàn bộ thông số khai báo trong [game.contract.json](game.contract.json). CLI nhận `--night 1`, `2` hoặc `3` và tùy chọn `--scenario <file.json>`. Nếu bỏ `--inputs`, người chơi không bấm phím. Nếu bỏ `--snapshot-every`, CLI ghi snapshot mỗi 10 tick, bắt đầu từ tick 0. Game trên web và headless chạy cùng mô phỏng 60 tick/giây. Khi tạm dừng, chỉ `tick` tiếp tục tăng. Các bộ đếm gameplay đi theo `sim_tick`.

Các đối tượng `drifters` trong scenario có `pos` và các trường tùy chọn `id`, `state`, `state_ticks_left`, `stolen`. Mỗi đối tượng `charms` có `pos` và các trường tùy chọn `id`, `available`, `respawn_ticks`. Tuning `score.per_mote` là điểm cho **mỗi đom đóm nạp**. Đom đóm nhặt lên chưa tính điểm.

Xem [tiêu chí nghiệm thu và giả định Phase 2](docs/notes/phase-2.md), [hướng dẫn cho agent](AGENTS.md) và [nguồn tài sản](CREDITS.md).

## Sáng tạo của tôi

Minimap la bàn đánh dấu vị trí và hướng nhìn của Mây, cầu hoặc tầng cao, cùng các đèn đã sáng. Quầng ấm quanh đèn báo nơi trú Bóng Mực. Minimap, nhạc và màu sắc là một phần của lớp hiển thị. [Ảnh Đảo Cau](docs/proof/phase-2/night-2.png) · [Replay headless](docs/proof/phase-2/night-one.jsonl)
