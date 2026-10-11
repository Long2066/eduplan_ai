# Hợp đồng prompt cho các lượt AI trong ứng dụng

**Quan trọng:** Đây là ví dụ đặc tả cho Antigravity **lập trình**, không phải prompt đã được test đảm bảo kiến thức trong mọi trường hợp. Thay các trường trong `{{...}}` bằng dữ liệu đã kiểm chứng. Không để LLM tự đặt thuộc tính `source.verified=true`.

## Giai đoạn 1 — Router (structured JSON only)

**System instruction gợi ý:** Bạn chọn lớp và loại bài Tiếng Việt. Chỉ sử dụng evidence có trong INPUT. Trả JSON với `grade`, `lesson_type`, `periods`, `minutes`, `skills_to_load`, `missing_sources`, `conflicts`, `status`.

**Input:**

```json
{"metadata": "{{metadata}}", "evidence": "{{source_registry}}", "user_preferences": "{{preferences}}"}
```

**Exit criterion:** `status=needs_confirmation` khi tên bài/số tiết chưa xác thực; kỹ thuật viên không tự chuyển thành pass.

## Giai đoạn 2 — Generator (structured JSON only)

**System instruction gợi ý:** Bạn biên soạn KHBD Tiếng Việt dựa trên nguồn có anchor. Với mỗi hoạt động viết rõ lời nói trực tiếp của GV, nhiệm vụ và phản hồi dự kiến HS, sản phẩm, đánh giá, scaffold, phút và nguồn. Đừng lặp ngữ liệu của giáo án mẫu nếu bài khác; đừng bịa văn bản/SGK. Trả JSON tương thích `schemas/lesson-plan.schema.json`.

**Input:**

```json
{"route": "{{route}}", "sources": "{{verified_source_anchors}}", "template_style": "{{style_only}}", "objectives": "{{verified_objectives}}", "constraints": "{{time_and_class_constraints}}"}
```

**Exit criterion:** JSON qua schema + basic validator, không phải đã duyệt sư phạm.

## Giai đoạn 3 — Critic (structured JSON only, độc lập)

**System instruction gợi ý:** Bạn đóng vai người thẩm định, KHÔNG viết lại toàn giáo án trong lượt này. Tìm lỗi sư phạm có bằng chứng theo từng tiêu chí: nguồn, kiến thức, mục tiêu, logic khám phá, hành động GV-HS, phân hóa, thời lượng, tập viết, đánh giá, NLS, khả thi. Nêu `issue_id`, `severity`, `activity_id`, `evidence`, `why_wrong`, `proposed_fix`, `resolved=false`. Kết quả theo `schemas/review-report.schema.json`. Nếu không thể kiểm chứng do thiếu SGK hay mẫu nét, tạo blocker.

**Input:**

```json
{"draft_lesson": "{{validated_draft}}", "sources": "{{source_registry}}", "grade_skill": "{{grade_protocol}}"}
```

**Exit criterion:** Có vấn đề thì không được trả trạng thái đạt chỉ vì điểm tổng cao.

## Giai đoạn 4 — Targeted Rewriter

**System instruction gợi ý:** Chỉ sửa các `issue_id` đã xác định, giữ nguồn gốc và các câu SGK được xác nhận. Nếu cần kiến thức ngoài chứng cứ, trả `needs_source_review` thay vì đoán. Cung cấp `change_log` theo issue ID, bản plan mới, và yêu cầu validator cùng critic chạy lại.

## Giai đoạn 5 — Human Review

Báo trực quan: bằng chứng nguồn gốc, lời GV–HS, phần thay đổi, lỗi chưa giải quyết, preview Word. Chỉ giáo viên/người có thẩm quyền của dự án mới duyệt phát hành theo chính sách nội bộ.

## Ranh giới kiểm tra

JSON schema chỉ kiểm tra định dạng, validator kiểm tra ràng buộc cơ học, critic đánh giá nội dung (có thể sai), reviewer thẩm định việc dùng thật. Không có tầng nào đơn lẻ bảo đảm đúng 100%.
