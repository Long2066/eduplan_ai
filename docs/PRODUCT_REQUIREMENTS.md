# Đặc tả sản phẩm: công cụ soạn giáo án TV KNTT lớp 1–5

## Người dùng và kịch bản chính

Giáo viên/sinh viên sư phạm upload SGK/SGV, một giáo án mẫu, chọn lớp, tên bài và phạm vi. Hệ thống phân tích loại bài, tạo hoạt động GV–HS có lời thoại đủ để dạy; người dùng sửa, phản biện, xuất Word.

## Yêu cầu chức năng (FR)

| ID | Yêu cầu | Tiêu chí có thể test |
|---|---|---|
| FR01 | Upload DOCX/PDF/ảnh, ghi nguồn | Bản ghi nguồn có file, mime, trang, anchor, status |
| FR02 | Chọn lớp/dạng bài theo SGK | Không dùng skill lớp sai, conflict → needs_confirmation |
| FR03 | Tách phong cách mẫu và nội dung mẫu | Đổi bài không lấy từ/câu SGK mẫu sang bài mới |
| FR04 | Sinh KHBD JSON chuẩn | Pass schema và validator cốt lõi |
| FR05 | Kịch bản GV/HS dạy thật | Mỗi HĐ có lời GV, nhiệm vụ HS, phản hồi, sản phẩm, đánh giá, scaffold |
| FR06 | Phân tích âm-vần-chữ viết | Học vần theo đúng loại, tập viết theo trang hình đã xác minh |
| FR07 | Kiểm tra sư phạm theo lượt riêng | Issue IDs, severity, evidence, fix, rerun |
| FR08 | Cơ chế đối chiếu nguồn SGK | Claim có anchor; thiếu → needs_source_review |
| FR09 | Tích hợp NLS có kiểm soát | Chỉ gắn khi có nhiệm vụ HS và chỉ báo đã xác thực |
| FR10 | DOCX hai cột, theo mẫu nếu có | Export DOCX và mở được, không mất hàng, lỗi dấu |
| FR11 | Duyệt trước khi phát hành | Human approval được ghi; block khi blocker |
| FR12 | Phân hóa & offline | Mỗi HĐ cần thiết bị số có phương án không mạng/thiết bị |
| FR13 | Phiên bản, theo dõi chỉnh sửa | Diff nháp – sửa, ngày, người thực hiện, lỗi được sửa |

## Yêu cầu phi chức năng (NFR)

- Unicode tiếng Việt nhất quán NFC, không làm biến mất dấu. Giao diện tiếng Việt, hỗ trợ bảng hai cột dễ đọc và sửa.
- Tách dữ liệu cá nhân HS khỏi request AI, ẩn danh ví dụ, retention/log phù hợp môi trường trường học.
- Không đưa thông tin nhận dạng HS lên bên thứ ba mặc định; thực hiện theo quyền của người dùng/đơn vị.
- API có validation, size limit, không chạy macro hay JS nhúng trong DOCX/PDF, quản lý upload an toàn.
- Tách prompt versions để so sánh và rollback; cache extraction bằng hash nguồn; tránh nhầm phiên bản SGK.
- Ứng dụng không tự nhận đạt chuẩn pháp lý/chuyên môn nếu không có bằng chứng.

## Pipeline và schema

`Source -> Evidence -> Route -> Objectives -> Generate -> Critic -> Targeted Revise -> Deterministic QA -> Human Review -> Export -> Render QA`.

Bắt buộc lưu trạng thái rõ ràng: `draft`, `needs_source_review`, `needs_handwriting_reference`, `blocked_pedagogy`, `ready_for_human_review`, `approved`, `exported`, `visual_qa_pending`.

Schema chính tại `schemas/lesson-plan.schema.json`. Nếu repo dùng TypeScript, tạo interface/zod từ hợp đồng tương ứng và test đồng nhất JSON schema. Nếu repo dùng Python, dùng pydantic/jsonschema hoặc dataclass validation tương đương. Không ép stack tùy tiện.

## Tình huống fail-correct

- Người dùng đưa mẫu Bài 72 nhưng chọn bài mới Bài 31: không chứa nguyên đoạn `Hoa mướp...` như SGK bài mới.
- Bài bị thiếu trang SGK: app không bịa câu nhận biết rồi báo đã đối chiếu.
- Năng lực số ghi 'HS xem TV': bị cảnh báo, không được báo năng lực số có căn cứ.
- Lời GV: 'Các em tự khám phá' sau khi GV đã nêu trước kết luận → issue logic.
- Phần viết: mô tả đặt bút chưa có ảnh mẫu → issue blocking nếu xuất hướng dẫn viết chi tiết khẳng định chuẩn.
- Tổng phút tiết 1 là 39/35 → validator block.

## Phần mềm làm được vs chưa làm được

Kiểm tra **tự động**: kiểu dữ liệu, nguồn có trace, phút/tiết, ID mục tiêu khớp, ghi thiếu hoạt động, cờ tích hợp số thiếu sản phẩm, file Word có mặt kỹ thuật.
Kiểm tra **phải cần hiểu sư phạm hoặc con người**: giọng đọc có phù hợp; nét viết đúng theo kiểu chữ; câu hỏi có phát triển nhận thức; ngữ liệu theo văn bản có bản quyền; tiết dạy có quá tải với lớp cụ thể. Bắt buộc đưa vào quy trình review.
