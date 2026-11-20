# ADR · Đèn cạn dầu

Mỗi đèn giữ dầu theo đơn vị nguyên 1/60, tiến độ nạp, lịch sử thắp và số lần thắp lại. Bước đếm giờ trừ cả hao tự nhiên và lượng hút, rồi tắt đèn cạn trước khi nhận tương tác. Ngưỡng vùng an toàn dùng giá trị nguyên trước khi làm tròn snapshot.

Đếm đèn sau toàn bộ cập nhật tick bình minh. Hết lửa luôn ưu tiên, còn sống với đủ 60% đèn thì thắng. Điểm bình minh lấy lượng dầu còn lại ở từng đèn. Sức chứa thuộc người chơi và chỉ tăng khi nạp đủ để thắp.

Kiểm chứng bằng JSONL: thắp đủ trước bình minh vẫn chơi, đèn tắt đúng tick, chọn đèn nạp được, thắp lại, hút cộng dồn, vùng an toàn đúng biên, điểm và ngưỡng cuối Đêm. Kiểm tra bảng màu, hình đèn và thanh dầu trên trình duyệt.

Các test Phase 2 về điểm nạp, thắng sớm, thưởng thời gian và chuyển trạng thái sau choáng được cập nhật theo luật mới. Replay thắng sớm không còn là kiểm chứng hợp lệ và được thay trong harness bằng scenario dầu đến bình minh. Replay gốc còn ở tag Phase 2.

Codex tái sử dụng fixture CLI và tách kiểm tra thứ tự khỏi bước hiển thị. Lượt kiểm tra UI ban đầu đọc điểm ngay sau khi thắp đèn cuối, trước khi cộng thưởng bình minh. Đã chuyển phép đo xuống sau tín hiệu kết thúc Đêm. Ước tính 12.000–20.000 token từ lượng mã, lời nhắc, đầu ra và lượt sửa. [Bằng chứng](../proof/phase-3/README.md)
