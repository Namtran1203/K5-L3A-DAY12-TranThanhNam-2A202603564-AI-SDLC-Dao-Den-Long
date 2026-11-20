# Kiểm chứng Phase 3

- 22 kiểm thử bao gồm hồi quy Phase 1–2 còn hiệu lực và các kịch bản dầu, thắp lại, sức chứa, vùng an toàn, hút cộng dồn và bình minh.
- Kịch bản dầu có đèn cạn trước tương tác, thắp lại, châm dầu, báo hút sau 60 tick và thắng ở bình minh. Hai đầu ra giống từng byte. [Lệnh và kết quả](verify.txt) · [Scenario](oil-scenario.json) · [Inputs](oil-inputs.json) · [JSONL](oil-dawn.jsonl)
- Kiểm chứng Edge dùng thao tác UI và scenario sát bình minh. Bảng màu dễ phân biệt được kiểm tra qua tải lại trang. [Đèn và bảng màu](oil-and-color.png) · [Bình Minh](dawn.png) · [Log trình duyệt](browser.txt)

Chạy `npm run verify -- --record tmp-proof` để tạo lại bằng chứng headless.
