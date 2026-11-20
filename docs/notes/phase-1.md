# Phase 1 · PRD-0

## Tiêu chí nghiệm thu

- Trên trình duyệt, Mây xuất phát ở Đảo Bến, đi theo camera, nhảy, nhặt đom đóm và dùng E nạp vào 5 Đèn Lồng Lớn. HUD phản ánh số lửa, ánh sáng đang mang, số đèn đã thắp, thời gian và điểm.
- Bóng Mực đuổi Mây, làm mất lửa khi chạm, tránh vùng sáng và bị đẩy lùi, làm choáng khi Mây dùng Q với đủ đom đóm.
- Thắp đủ 5 đèn thì thắng. Hết lửa hoặc đến bình minh thì thua. Nút Chơi lại đặt lại màn.
- CLI chạy 60 tick/giây, tuân theo Test Contract v1.0 về CLI, input, scenario, JSONL, số tick, mã thoát và tính tất định.

## Giả định và quyết định

- Đảo có bán kính 32 m, mặt đất phẳng. Cây và đá nhỏ là cảnh vật. Mép đảo giữ Mây trên đảo. Nhảy là chuyển động Y, mọi kiểm tra bán kính dùng XZ kể cả lúc đang nhảy.
- Mây bắt đầu với 3 lửa. Bóng Mực xuất hiện ở mép đảo, mặc định có 3 con và thêm một con sau mỗi 35 giây, tối đa 6 con. Scenario tắt sinh Bóng Mực tự động thì không có đợt bổ sung. Danh sách trong scenario ghi đè danh sách ban đầu.
- Các đèn nhận nạp từng phần. E tác động lên đèn tắt gần nhất trong phạm vi. Đèn sáng đẩy Bóng Mực ra khỏi vùng bảo vệ. Khi bị chạm, số đom đóm rơi làm tròn xuống, có thể nhặt lại. Tỏa sáng đủ phí và hết hồi chiêu vẫn tiêu đom đóm khi không có mục tiêu.
- Trong một bước chạy, Mây di chuyển và nhặt đom đóm, sau đó nạp đèn, tỏa sáng và tương tác với Bóng Mực. Thắp đèn cuối được xử lý ngay trong bước đó. Thưởng thời gian và lửa chỉ cộng khi thắng, với số giây làm tròn xuống.
- Gameplay là một module JavaScript dùng chung. Three.js chỉ chạy trong trình duyệt. Bản web dùng seed 2026 để lượt chơi lại và bài replay có cùng cách bố trí.

## Kiểm chứng và đánh giá

10 bài kiểm tra tự động và bài thử trên Edge Chromium đạt. Bài thử trình duyệt gửi phím chơi thực tế, thắng với 5 đèn và 1651 điểm, kiểm tra thua khi cạn lửa và chơi lại từ cả hai kết quả. Lượt chơi mặc định giống hệt qua hai lần CLI. Đã lưu lệnh, replay và ảnh ở [bằng chứng Phase 1](../proof/phase-1/README.md).

Đã chạy trực tiếp trên Windows. CI của repo được cấu hình để cài và chạy kiểm chứng headless trên Linux. Hành vi 3D trên macOS và Linux chưa được quan sát trực tiếp. Bộ kiểm tra ẩn của Coach chưa được chạy tại workspace.

## Nhật ký dùng AI và retro

- Dùng Codex đọc hướng dẫn, triển khai cùng một mô phỏng cho web và CLI, viết kiểm thử qua tiến trình CLI, rồi kiểm tra trình duyệt bằng phím và chụp ảnh từ chính bản chạy. Những quyết định về thông số mơ hồ được lưu ngay trong contract và ghi chú này.
- Kiểm thử seed âm phát hiện trình phân tích tham số mặc định của Node không chấp nhận `--seed -12` dưới dạng hai đối số. CLI giờ nhận dạng đó và bài test in stderr khi tiến trình lỗi. Ảnh trình duyệt phát hiện kiểu chữ ban đầu hiển thị lệch các dấu tiếng Việt, nên đổi sang font hệ thống và chạy lại bài chơi thử.
- Ước tính Phase 1 dùng khoảng 20.000–35.000 token, dựa trên khối lượng đề, mã, kết quả kiểm thử và các lượt sửa được xử lý trong phiên. Phiên không cung cấp số đo hoặc chi phí tách riêng cho phase. Giữ phần headless không phụ thuộc engine, dùng replay chung cho bằng chứng và chỉ cài thêm Playwright trong thư mục tạm để giảm công việc cài đặt.
- Nếu làm lại, sẽ chạy sớm một kịch bản CLI gồm tick 0, seed âm và ghi đè scenario, sau đó mở một bản 3D tối giản để kiểm tra font và WebGL trước khi làm cảnh.
