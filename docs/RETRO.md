# Retro · Đảo Đèn Lồng

## Kết quả qua bốn phase

| Phase | Kết quả | Bài học |
|---|---|---|
| 1 · Đảo Bến | Có màn chơi 3D, CLI v1.0, 10 bài kiểm thử và replay thắng trên màn mặc định. | Kiểm tra CLI với seed âm trước khi phân tích JSONL. Kiểm tra dấu tiếng Việt từ ảnh trên trình duyệt thật. |
| 2 · Ba hòn đảo | Contract v1.1, ba bản đồ, 20 bài kiểm thử. Đêm 1 thắng từ đầu bằng replay. Đo bản thường 1280×720 có ghi GPU. | Test từng tình huống bố trí sàn, dốc và bục riêng trước khi ghép chiến dịch. Hàng đợi UI cần giữ cạnh lên khi người chơi bấm nhanh qua ranh giới tick. |
| 3 · Đèn cạn dầu | 22 bài kiểm thử, scenario hết dầu, thắp lại, hút, châm dầu và thắng ở bình minh. Có ADR và ghi thay đổi tương thích. | Dùng số nguyên để tách quyết định ngưỡng khỏi định dạng một chữ số thập phân. Đợi kết thúc bình minh rồi mới đọc tổng điểm trong bài thử UI. |
| 4 · Phát hành | Thêm 4 kiểm thử về benchmark và bảng xếp hạng. Đo benchmark chuẩn và chạy soak 10 Đêm. Lưu gói web, bảng trợ năng, video và bằng chứng. | Dùng cùng cảnh và pipeline 3D cho phép đo. Gom Bóng Mực vào các draw call theo nhóm để giảm chi phí dựng hình khi có 200 con. |

## Phối hợp với AI

Yêu cầu hiệu quả nhất là đưa Test Contract vào cùng lời nhắc và yêu cầu đầu ra kiểm tra được ở từng phase. Mô phỏng dùng chung giúp sửa quy tắc một lần, sau đó chạy lại qua CLI và giao diện. Harness hữu ích nhất là `npm run verify` do AGENTS.md chỉ tới, vì nó kết hợp test qua tiến trình CLI, chạy lại scenario, đối chiếu byte và lưu bằng chứng. Bài thử trình duyệt bổ sung các hành vi mà CLI không thể xác nhận, như font, phím, cảnh báo và lưu lựa chọn.

Một số lỗi chỉ lộ ra trong kiểm chứng. Phase 1 phân tích đối số chưa nhận seed âm. Phase 2 có nhánh chọn sàn dừng ở tầng không tồn tại và nhấn P nhanh sau khi tiếp tục có thể bị mất. Phase 3 bài thử UI lấy điểm trước tick bình minh. Các lỗi được phát hiện bằng mã thoát, ảnh, so snapshot hoặc thao tác phím. Sau khi sửa, kỳ vọng và lệnh kiểm chứng được giữ trong repo để người khác chạy lại.

Ước tính theo lượng đề, mã, log và lượt sửa là Phase 1 khoảng 20–35 nghìn token, Phase 2 khoảng 35–55 nghìn, Phase 3 khoảng 12–20 nghìn, Phase 4 khoảng 18–30 nghìn. Tổng khoảng **85–140 nghìn token đã xử lý**. Phiên không cung cấp số đo thanh toán theo phase. Tái sử dụng mô phỏng, test fixture, cảnh 3D và runner kiểm chứng giúp tránh gửi lại toàn bộ đề hoặc dựng lại dự án khi luật thay đổi.

Nếu làm lại, mình sẽ bổ sung scenario chạm biên ngay khi đọc đề, đo khung hình khi cảnh còn tối giản, kiểm thử từ thư mục đóng gói sớm hơn và tách fixture gần bình minh khỏi bài chơi mặc định. Bộ test ẩn của Coach và cấu hình máy chấm chưa có tại workspace. Các con số trong repo dùng để tái kiểm tra trên máy phát triển.
