# Kiểm thử nghiệm thu cho Antigravity

## Kiểm thử tự động trước PR

1. `python tools/check_skills.py` trả 0 và tìm thấy đầy đủ 14 SKILL.md với YAML `name`, `description` đúng tên thư mục.
2. `python tools/validate_lesson.py samples/grade1-valid.json` trả 0.
3. `python tools/validate_lesson.py samples/grade4-valid.json` trả 0.
4. `python tools/validate_lesson.py samples/grade1-invalid.json` trả 1, có lỗi thời lượng, mục tiêu và source.
5. `python -m unittest discover -s tests -v` toàn bộ pass.
6. Trong app thật, test parser DOCX (bảng 2 cột), ảnh trang, nguồn và trường kiểm chứng; tất cả câu/đoạn SGK phải truy vết tới upload phù hợp.

## UAT thủ công theo nghiệp vụ

- UAT01: Upload giáo án mẫu và SGK bài khác: giao diện phân biệt form mẫu và ngữ liệu bài mới; không copy bài mẫu.
- UAT02: Grade1 an-ăn-ân: rút vần, phân tích giống/khác, đánh vần, đọc trơn, ghép, viết, đọc câu đúng trang; không lẫn `/n/` cuối.
- UAT03: Grade1 ươm-ươp: vần ươp vs tiếng ướp rõ; dấu thanh không biến thành một chữ của vần.
- UAT04: GV xem nét viết chữ a/ă/â/n: hiển thị mẫu minh họa gốc/nguồn; không tự bịa điểm đặt bút; nếu thiếu thì báo cần mẫu.
- UAT05: Grade2-Grade5: các bài đọc, viết, nói-nghe chọn đúng quy trình theo lớp; không áp cách dạy học vần lớp 1 cho lớp 5.
- UAT06: Từ ngữ SGK chưa xác thực: có cảnh báo và chặn nhãn 'bám sát SGK'.
- UAT07: 2 tiết mỗi tiết 35 phút có tổng phút bằng 35 cho từng tiết; hoạt động không bị quá tải hiển nhiên.
- UAT08: Các câu hỏi có câu GV, thao tác HS, sản phẩm đánh giá, gợi mở cho HS cần hỗ trợ; HS không chỉ 'lắng nghe'.
- UAT09: NLS không áp dụng nếu chỉ có slide TV; khi tích hợp có nhiệm vụ, sản phẩm, đánh giá, nguồn chỉ báo và phương án offline.
- UAT10: Critic tìm được kết luận đã bị GV 'bật mí' trước khám phá; auto revision thực sự thay đổi và retest.
- UAT11: DOCX có 2 cột GV/HS, tiếng Việt đúng dấu, tiêu đề các tiết đúng, trang không tràn, bảng không chia vụn.
- UAT12: Người kiểm duyệt có thể xem báo cáo nguồn, issue, sửa hoặc từ chối, và xuất bản chỉ khi gate cho phép.

## Định nghĩa nghiệm thu

- **Technical PASS**: chạy test tự động thực tế, export/render hợp lệ.
- **Source PASS**: đúng trang/ngữ liệu/bản SGK, không còn conflict blocker.
- **Pedagogical PASS**: review riêng có báo cáo, giáo viên duyệt trên mẫu thực tế.

Chỉ tuyên bố đạt khi cả 3 đúng phạm vi; không được dùng một điểm số LLM tự chấm để thay nghiệm thu thật.
