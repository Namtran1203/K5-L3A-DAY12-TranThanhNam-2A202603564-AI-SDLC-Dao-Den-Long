# Phase 4 · Phát hành

| Yêu cầu | Tiêu chí nghiệm thu và cách đo |
|---|---|
| Benchmark | Cảnh 200 Bóng Mực, 100 đom đóm và 3 đèn, camera vòng đều. Đo sau 3 giây khởi động, lưu JSON và đối chiếu ngưỡng FPS, p1 và thời gian tải. |
| Soak | Một tiến trình chạy 10 Đêm với seed tăng dần và input theo xác suất. Ghi kết quả từng Đêm và RSS ở hai mốc. |
| Bảng xếp hạng | Lưu tối đa 10 mục, điểm giảm dần và thời điểm tăng dần. Kiểm tra tên, lưu qua khởi động lại và xuất cùng thứ tự. |
| Dễ tiếp cận | Đổi đủ 9 hành động, báo phím trùng, khôi phục và lưu. Kiểm tra phụ đề, hướng Bóng Mực, giảm hiệu ứng và chữ 18 px hoặc 22,5 px. |
| Bàn giao | Chạy thử thư mục web độc lập, kiểm tra tag, Release, video dưới 5 phút và hướng dẫn chạy trên máy sạch. |

Benchmark dùng cùng trình vẽ với bản chơi, gom Bóng Mực bằng instancing và khóa AI ở chế độ wander. Launcher mở cửa sổ riêng và ghi thời điểm khung hình trước khi bắt đầu 3 giây khởi động. Do kiến trúc nhiều tiến trình của trình duyệt, RSS benchmark ghi `null` và có giải thích trong README.

Bảng xếp hạng bản Node dùng tệp JSON theo thư mục dữ liệu người dùng. Ghi thay thế nguyên tử để tránh chỉ có nửa tệp nếu gián đoạn. Gói web phục vụ tĩnh có thể dùng lưu trữ trình duyệt. Kiểm tra qua API và lệnh xuất dùng một tệp riêng.

Đã đo benchmark máy phát triển với 563,59 FPS trung bình, 220,64 FPS 1% low và tải 1.793 ms. Soak đạt 0 crash, RSS tăng khoảng 8,4%. Tất cả lần chơi ngẫu nhiên kết thúc với trạng thái thua. Bằng chứng đo được dùng để đối chiếu ngưỡng trên máy này. [Bằng chứng](../proof/phase-4/README.md)
