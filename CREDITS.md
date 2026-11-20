# Nguồn và công cụ

- Tên game, nhân vật Mây, Bóng Mực và bối cảnh Đảo Bến từ PRD-0 của bài lab Day 12.
- Mô hình 3D, ánh sáng, hiệu ứng, minimap và màu được dựng bằng hình khối và mã nguồn trong repo, có hỗ trợ từ Codex. Game dùng font hệ thống.
- Nhạc nền và hiệu ứng Phase 2 được tổng hợp trực tiếp bằng Web Audio. Mẫu nốt và nhịp nằm trong `web/audio.mjs`.
- Three.js r180 dùng để hiển thị WebGL. Dự án Three.js do mrdoob và các cộng tác viên phát triển, phát hành theo MIT. [Giấy phép Three.js r180](https://github.com/mrdoob/three.js/blob/r180/LICENSE)
- Playwright Core điều khiển Chromium cho benchmark, kiểm chứng giao diện và quay demo. FFmpeg mã hóa video demo. Khung hình trong video lấy từ game và đầu ra lệnh thực tế. Không dùng nhạc ngoài.
- Giấy phép MIT áp dụng cho mã và nội dung gốc của dự án. Nguồn bối cảnh lab và giấy phép thư viện được ghi riêng ở trên.
