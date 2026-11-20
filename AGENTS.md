# Đảo Đèn Lồng

- Đọc yêu cầu của phase đã phát hành trên lab board và đối chiếu với `RULES.md`, `RUBRIC.md`, `SUBMISSION.md`.
- Trước khi viết mã cho một phase, ghi tiêu chí nghiệm thu, giả định và cách kiểm chứng. Giữ logic mô phỏng dùng chung giữa chế độ chơi và headless.
- Dùng đúng lệnh, định dạng và tên trường của Test Contract. `game.contract.json` là nguồn duy nhất của các thông số tuning.
- Cài với `npm ci`, chạy web với `npm start`, chạy bộ kiểm chứng với `npm run verify`. CI chạy bộ kiểm chứng này trên Linux.
- Phase 2 dùng Contract v1.1. Lệnh headless nhận ba đêm. Dùng `simTick` cho thời gian, hồi chiêu, spawn và TTL. Giữ đúng thứ tự xử lý trong `Game.step`.
- Từ Phase 3, dầu giữ ở đơn vị nguyên 1/60. Trừ dầu trước tương tác và chỉ xét thắng cuối tick bình minh. Bằng chứng v1.2 nằm tại `docs/proof/phase-3`.
- Phase 4 dùng Contract v1.3. Tách cảnh benchmark khỏi CLI gameplay, giữ kích thước canvas đúng 1280×720 và lưu `bench.json`, `soak.json` từ lệnh trong README. Dùng tệp bảng xếp hạng tạm khi kiểm thử.
- Trước khi phát hành, chạy `npm run verify`, kiểm tra bản web từ thư mục gói sạch và kiểm tra MP4. Giữ tag của từng Phase khớp với bằng chứng.
- Tọa độ chuẩn và phép kiểm tra địa hình nằm trong `src/maps.mjs`. Số liệu báo trong snapshot lấy từ mô phỏng. Các hiệu ứng âm thanh, HUD và cảnh 3D nằm ở lớp web.
- Chạy kiểm chứng của phase hiện tại và các kiểm chứng cũ còn hiệu lực. Khi ticket thay đổi luật, ghi lý do cập nhật các bài kiểm tra liên quan.
- Lưu lệnh, kịch bản đầu vào và đầu ra thực tế theo từng phase. Phase 1 dùng `npm run verify -- --record docs/proof/phase-1` và bài chơi thử trình duyệt theo hướng dẫn trong thư mục bằng chứng.
- Từ Phase 2, dùng `npm run verify -- --record docs/proof/phase-2` để tái tạo bằng chứng. Bài thử trình duyệt đo RAF trên canvas 1280×720, ghi rõ bộ dựng WebGL và dùng scenario công khai để kiểm tra kết thúc từng đêm.
- Kiểm tra mã thoát của bộ kiểm chứng trước khi chốt tag. Khi test thất bại, kiểm tra lỗi CLI trên stderr trước khi phân tích dữ liệu đầu ra.
- Giữ lịch sử đã gắn tag. Ghi nguồn asset trong `CREDITS.md` và tránh đưa thông tin xác thực vào repo.
