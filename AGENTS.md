# Đảo Đèn Lồng

- Đọc yêu cầu của phase đã phát hành trên lab board và đối chiếu với `RULES.md`, `RUBRIC.md`, `SUBMISSION.md`.
- Trước khi viết mã cho một phase, ghi tiêu chí nghiệm thu, giả định và cách kiểm chứng. Giữ logic mô phỏng dùng chung giữa chế độ chơi và headless.
- Dùng đúng lệnh, định dạng và tên trường của Test Contract. `game.contract.json` là nguồn duy nhất của các thông số tuning.
- Cài với `npm ci`, chạy web với `npm start`, chạy bộ kiểm chứng với `npm run verify`. CI chạy bộ kiểm chứng này trên Linux.
- Chạy kiểm chứng của phase hiện tại và các kiểm chứng cũ còn hiệu lực. Khi ticket thay đổi luật, ghi lý do cập nhật các bài kiểm tra liên quan.
- Lưu lệnh, kịch bản đầu vào và đầu ra thực tế theo từng phase. Phase 1 dùng `npm run verify -- --record docs/proof/phase-1` và bài chơi thử trình duyệt theo hướng dẫn trong thư mục bằng chứng.
- Kiểm tra mã thoát của bộ kiểm chứng trước khi chốt tag. Khi test thất bại, kiểm tra lỗi CLI trên stderr trước khi phân tích dữ liệu đầu ra.
- Giữ lịch sử đã gắn tag. Ghi nguồn asset trong `CREDITS.md` và tránh đưa thông tin xác thực vào repo.
