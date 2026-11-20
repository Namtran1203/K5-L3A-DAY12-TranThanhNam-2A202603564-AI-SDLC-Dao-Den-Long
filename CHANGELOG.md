# Changelog

## Phase 3 — Contract v1.2

- Breaking: thắng lúc bình minh nếu đủ 60% đèn còn sáng. Thời lượng đổi thành 240/270/300 giây. `all_lit` được thay bằng `dawn_survived`.
- Breaking: đèn có dầu, có thể tắt, châm dầu hoặc thắp lại. Đèn dưới 30 dầu mất vùng an toàn và có thể bị hút. `lantern_lit` thêm `relight`.
- Breaking: công thức điểm và sức chứa thay đổi. Snapshot có dầu, lịch sử đèn và sức chứa thực. Bóng Mực có trạng thái `drain`.
- Cài đặt bảng màu dễ phân biệt và phân biệt đèn bằng hình dạng.

## Phase 2 — Contract v1.1

- Chuẩn hóa số liệu và bản đồ, bổ sung Đảo Cau, Đảo Chuông, Lướt, Gió Lạc, Bùa Gió, pause và cài đặt.

## Phase 1 — Contract v1.0

- Đảo Bến chơi được, mô phỏng chia sẻ giữa web và CLI JSONL.
