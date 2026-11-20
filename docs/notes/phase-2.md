# Phase 2 · Ba hòn đảo

| Tính năng | Tiêu chí nghiệm thu | Cách kiểm chứng |
|---|---|---|
| Gió Lạc | Sinh theo lịch ở Đêm 2–3, đuổi Mây đủ đom đóm, cướp một lần trước lượt hit của Bóng Mực, rồi bỏ chạy. Tỏa Sáng đuổi con đang đuổi hoặc lấy lại ánh sáng đã mất | Scenario sinh, cướp đồng thời với hit, lấy lại và TTL |
| Bùa Gió | Nhặt theo độ cao và bán kính, tăng tốc, lướt liên tục theo cạnh lên trong 600 tick, hồi bùa sau 2700 tick | Scenario nhặt, lướt và hồi bùa |
| Chuỗi 3 đêm | Menu mở giới thiệu có tên đảo và lời Ông Đăng. Thắng mở đêm kế tiếp, thua mở chơi lại đêm hiện tại. Bình Minh hiển thị tổng điểm ba đêm thắng | Scenario đầu/cuối từng đêm và bài kiểm tra điều hướng trình duyệt |
| Tạm dừng | Esc/P mở menu. Thời gian, TTL, kẻ địch, spawn và hồi chiêu đứng yên. Có tiếp tục, chơi lại đêm, cài đặt và về menu | Scenario so snapshot trong lúc pause và thử các mục menu |
| Cài đặt | Âm lượng và nhạy chuột áp dụng ngay và được lưu qua lần tải mới | Kiểm tra giao diện và localStorage |
| Âm thanh | Nền đêm, tín hiệu gió và đủ hiệu ứng các sự kiện yêu cầu, đếm ngược 10 giây cuối | So ánh xạ sự kiện và kiểm tra Web Audio qua trình duyệt |
| HUD | Hiện lửa, đèn, điểm, mm:ss đỏ và nhấp nháy sắp hết giờ, túi 10 ô, hai hồi chiêu, nhắc nạp và mũi tên khi đèn đích ngoài khung | Kiểm tra HUD qua trình duyệt và scenario tương ứng |
| Bảng màu | Dùng màu chuẩn cho các thành phần liệt kê. Cường độ môi trường đúng công thức tiến độ | Đối chiếu hằng số, ảnh và kiểm tra mặc định/cuối đêm |

Test Contract v1.1 giữ các kịch bản v1.0 còn hợp lệ và cập nhật kỳ vọng theo thông số chuẩn. Ba bản đồ, vật lý và thứ tự sự kiện cần có scenario kiểm chứng trước khi gắn tag.

## Giả định triển khai

- Tọa độ, độ cao và lịch spawn chuẩn áp dụng chung cho web và headless. Đom đóm tự sinh chiếm điểm chuẩn. Đom đóm rơi được tạo ngay theo số phải rơi, tồn tại 480 tick và có thể làm số thực thể vượt 30 tạm thời. Lịch tự sinh chỉ thêm đom đóm khi tổng hiện tại dưới 30.
- Nạp đèn dùng bán kính ngang 2 m và chênh cao tối đa 1,5 m để yêu cầu tiếp cận đúng tầng. Vùng an toàn dùng khoảng cách XZ. Bóng Mực vẫn choáng nếu trúng Tỏa Sáng trong lúc rời vùng an toàn.
- Cạnh lên của Pause phát sự kiện bằng `tick` ngoài. Tick bật pause đứng yên mô phỏng. Tick tiếp tục xử lý một bước bình thường. Các hạn gameplay tính bằng `sim_tick`.
- `night_start` ghi ở tick 0 sau snapshot đầu tiên. `player.invuln` là boolean. `ttl_s` của đom đóm tự sinh là `null`. Các khoảng thời gian được tính từ hạn theo tick rồi chuyển sang giây khi xuất.
- Gió Lạc dùng điểm sương ở vòng ngoài, dùng khoảng cách XZ để phát hiện và cướp. Tỏa Sáng dùng cùng phép đo 3D với Bóng Mực. Cơn gió Đảo Chuông lấy hướng tại thời điểm báo trước, rồi đẩy trong đúng 300 bước gameplay.
- Chạy và dừng áp dụng ngay. Lướt trên không giữ Y và tiếp tục vận tốc rơi hoặc vận tốc phóng sau khi lướt. Cầu, dốc, vách và bục có phép kiểm tra mặt sàn riêng.

## Thay đổi và kiểm chứng hồi quy

Phase 1 có nhặt chỉ theo XZ, điểm lúc nhặt, lùi tức thì khi Tỏa Sáng và mép đảo giữ người chơi. Các kỳ vọng v1.1 kiểm tra thêm độ cao, điểm theo lượng nạp, đẩy lùi theo thời gian và rơi/hồi sinh. Lịch sinh, số đồ vật và số liệu headless đổi theo ticket. Hành vi cạnh lên, giữ input, thứ tự ID, JSONL và tính tất định tiếp tục được kiểm tra.

Đã chạy lại 10 bài kiểm thử từ bản xuất sạch của tag `phase-1`. Phase 2 có 20 bài kiểm thử và replay Đêm 1 chuẩn thắng bằng input thường. Kiểm chứng chuyển đêm trên web dùng scenario để đặt trạng thái sát mốc thắng/thua, rồi thao tác nạp đèn và chuyển đêm trong giao diện. Bộ kiểm tra ẩn của Coach chưa được chạy tại workspace. [Bằng chứng Phase 2](../proof/phase-2/README.md)

## Nhật ký AI và retro

- Codex triển khai bản đồ, vật lý, thực thể, CLI và giao diện. Tái sử dụng mô phỏng, server, harness kiểm thử và phong cách cảnh từ Phase 1. Chỉ thay kỳ vọng khi ticket đổi luật hoặc cấu trúc đầu ra.
- Điều kiện tìm sàn ban đầu trả về giá trị không có sàn trước khi kiểm tra tầng 0 của Đảo Chuông. Kiểm thử tick đầu phát hiện nhân vật rơi ở tọa độ xuất phát. Đã sửa phép chọn sàn và thêm scenario cho dốc, vách, bục tầng hai và tháp.
- Bài thử trình duyệt phát hiện phím P có thể đến ngay sau tick tiếp tục và bị coi là giữ nút. Giao diện giờ giữ yêu cầu cho đến khi mô phỏng nhận được cạnh lên tiếp theo. Các phím lướt, nhảy, nạp và Tỏa Sáng cũng giữ lần bấm qua ranh giới khung hình.
- Lần đo đầu trên SwiftShader đạt trung bình 14,3 FPS. Đã gom cảnh tĩnh và đom đóm thành các nhóm vẽ, giảm lớp trong suốt và thử lại trên trình dựng WebGL mặc định của Edge. Báo cáo lưu cả tên GPU và độ phân giải. Kết quả GPU và SwiftShader thuộc hai cấu hình chạy khác nhau.
- Ước tính 35.000–55.000 token dựa trên lượng đề, thao tác đọc mã, triển khai, đầu ra kiểm thử và vòng sửa trong phiên. Phiên chưa cung cấp số đo chi phí riêng. Dùng chung scenario để kiểm tra gameplay, giữ Playwright ở thư mục tạm và chạy CLI theo lô.
- Lần sau sẽ đo khung hình từ lúc có ba bản đồ, kiểm tra góc camera dưới tầng cao và xây kịch bản cho các mốc lịch trước khi hoàn thiện hiệu ứng.
