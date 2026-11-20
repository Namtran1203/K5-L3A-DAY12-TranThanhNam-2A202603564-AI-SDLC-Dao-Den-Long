# Kiểm chứng Phase 4

| Hạng mục | Bằng chứng |
|---|---|
| Contract v1.3 và hồi quy | 26 bài kiểm thử: 22 kiểm thử gameplay và 4 kiểm thử benchmark, phương pháp tính FPS, xếp hạng và xuất qua tiến trình độc lập. Scenario dầu lặp lại cho JSONL giống từng byte. [Log và SHA-256](verify.txt) · [JSONL](oil-dawn.jsonl) |
| Benchmark chuẩn | Seed 42, 200 Bóng Mực, 100 đom đóm, 3 đèn, 3 giây khởi động và 30 giây đo. Cửa sổ 1280×720 trên desktop Windows, Chromium với ANGLE/D3D11, AMD Ryzen 7 5800H và Radeon. [bench.json](../../../bench.json) |
| Soak | Seed 7, 10 Đêm trong một tiến trình, 0 crash. RSS 51,69 → 56,03 MiB, tăng khoảng 8,4%. [soak.json](../../../soak.json) |
| Bảng xếp hạng | Đã lưu từ màn Bình Minh và màn thua, rồi đọc trong menu. Bài test qua API xác nhận tên sai, sắp xếp, giới hạn và CLI xuất cùng thứ tự. [Bảng xếp hạng](leaderboard.png) · [Bài test](../../../tests/release.test.mjs) |
| Trợ năng | Edge kiểm tra đổi phím, báo trùng, tải lại, khôi phục, 18/22,5 px, phụ đề, hướng Bóng Mực và giảm chuyển động. Chốt các Đêm trên trình duyệt bằng fixture để kiểm tra điều hướng. [Log](browser.txt) · [Cài đặt](settings.png) · [Báo gió](bell-tower.png) |
| Gói web và demo | Khởi động từ ZIP giải nén sạch bằng Node, mở Đảo Bến với WebGL 2 và HUD. Video dùng gameplay ở màn mặc định, cảnh benchmark và đầu ra CLI thật. [Kiểm tra ZIP](package.txt) · [Demo MP4](../../demo/demo.mp4) |

Lệnh benchmark, soak, test và headless nằm trong [README](../../../README.md). Để chạy lại bài thử Chromium, khởi động `npm start` và truyền đường dẫn trình duyệt đang cài:

```sh
node scripts/browser-proof.mjs node_modules/playwright-core/index.mjs "<Chrome, Chromium hoặc Edge>" tmp-proof
```

Đặt `LANTERN_LEADERBOARD` cho tiến trình server tới tệp thử riêng để lưu điểm tự động ngoài bảng xếp hạng đang dùng. Đo benchmark từ phiên desktop để Chrome mở cửa sổ. Kết quả máy chấm của Coach sẽ phụ thuộc cấu hình công bố.
