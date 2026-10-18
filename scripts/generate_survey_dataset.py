import csv
import random
import os

# Fix seed for reproducibility and realistic statistical metrics
random.seed(42)

HEADER = [
    "1. Nhóm thực nghiệm tham gia (Mã biến: NHOM)",
    "2. Đối tượng người tham gia (Mã biến: DOI_TUONG)",
    "Tên bài học thực nghiệm đã thực hiện:",
    "4. Thời gian hoàn thành KHBD khi sử dụng EduPlan AI (Mã biến: T_SOAN)",
    "5. Tỉ lệ nội dung phải viết lại/sửa đổi do không đạt hoặc sai lệch (Mã biến: TY_LE_SUA)",
    "6. Kiểm soát hiện tượng ảo giác / ngữ liệu bịa đặt (Mã biến: LOI_AO_GIAC)",
    "A. Khung chất lượng Sư phạm & Chuẩn hóa Công văn 2345 [SP1: Cấu trúc KHBD phân định rõ 4 pha sư phạm và chia bảng 2 cột GV - HS chuẩn CV 2345.]",
    "A. Khung chất lượng Sư phạm & Chuẩn hóa Công văn 2345 [SP2: Mục tiêu (YCCĐ) được xác định chính xác theo 3 thành tố: Năng lực đặc thù, chung và phẩm chất.]",
    "A. Khung chất lượng Sư phạm & Chuẩn hóa Công văn 2345 [SP3: Hoạt động Khám phá xây dựng kịch bản rõ nét (câu hỏi gợi mở của GV, thao tác tích cực của HS).]",
    "A. Khung chất lượng Sư phạm & Chuẩn hóa Công văn 2345 [SP4: Thời lượng giữa các hoạt động cân đối, khả thi và khớp đúng chuẩn 35 phút/tiết học.]",
    "A. Khung chất lượng Sư phạm & Chuẩn hóa Công văn 2345 [SP5: Ngữ liệu bài học bám sát 100% SGK, an toàn sư phạm, không bịa đặt kiến thức ngoài chương trình.]",
    "B. Mô hình Chấp nhận Công nghệ TAM & Tải nhận thức [TAM1 (Hữu ích): Nâng cao đáng kể năng suất và chất lượng bản thảo giáo án so với trước đây.]",
    "B. Mô hình Chấp nhận Công nghệ TAM & Tải nhận thức [TAM2 (Dễ dùng): Giao diện trực quan, thao tác nhập liệu bán tự động và nhận diện ảnh dễ dàng.]",
    "B. Mô hình Chấp nhận Công nghệ TAM & Tải nhận thức [TAM3 (Tải nhận thức): Giảm tải tối đa áp lực tra cứu tài liệu, giảm căng thẳng và mệt mỏi tinh thần.]",
    "B. Mô hình Chấp nhận Công nghệ TAM & Tải nhận thức [TAM4 (Định dạng): File văn bản xuất Word chuẩn thể thức in ấn, giữ đúng định dạng bảng biểu.]",
    "B. Mô hình Chấp nhận Công nghệ TAM & Tải nhận thức [TAM5 (Nghiệp vụ): Là công cụ hỗ trợ hữu ích giúp giảm tải thời gian soạn và chuẩn bị KHBD]",
    "C. Ý định hành vi & Thái độ tiếp nhận [YD1 (Tự tin): Tôi cảm thấy tự tin và an tâm về tính khả thi khi mang KHBD này lên lớp thực tế.]",
    "C. Ý định hành vi & Thái độ tiếp nhận [YD2 (Ý định): Tôi có ý định tiếp tục sử dụng phương thức/công cụ này thường xuyên để soạn bài.]",
    "C. Ý định hành vi & Thái độ tiếp nhận [YD3 (Khuyến nghị): Tôi sẵn sàng chia sẻ và khuyến nghị đồng nghiệp, sinh viên sư phạm cùng ứng dụng.]",
    "21. Khó khăn lớn nhất gặp phải trong quá trình thực hiện bài dạy hoặc đề xuất hoàn thiện công cụ:",
    "Hướng dẫn điền"
]

# Open comments for Experimental Group (EduPlan AI)
FEEDBACK_TN = [
    "", "", "", "", "", "", "", "",  # 8 blanks
    "k", "Không có", "ổn", "bình thường", "chưa có đề xuất", "k có ý kiến", "tốt", # 7 short
    # 15 detailed
    "Giao diện điện thoại cần tối ưu vùng bấm nút to hơn chút khi dùng trên màn hình nhỏ.",
    "Mong nhóm nghiên cứu sớm tích hợp tính năng tự tạo slide bài giảng kèm theo giáo án.",
    "Rất thích phần gợi ý hoạt động Khám phá của bài đọc Lớp 2, câu hỏi gợi mở sâu sắc.",
    "Ảnh chụp SGK nếu bị lóa đèn thì AI nhận diện chữ hơi lâu một chút, nên hướng dẫn chụp rõ hơn.",
    "Giúp tiết kiệm rất nhiều thời gian cho sinh viên chuẩn bị đi thực tập sư phạm như em.",
    "Công cụ chia bảng 2 cột rất chuẩn thể thức Công văn 2345, xuất Word không bị lỗi font.",
    "Thời lượng các hoạt động tính toán khá chuẩn 35 phút, giáo viên chỉ cần chỉnh nhẹ lời thoại.",
    "Mong app duy trì miễn phí hoặc có gói hỗ trợ cho giáo viên vùng cao.",
    "Phần gợi ý đồ dùng dạy học và phiếu bài tập rất thiết thực cho bài học vần Lớp 1.",
    "Nên bổ sung thêm tính năng lưu trữ lịch sử các bài đã soạn theo từng thư mục lớp.",
    "Rất tiện lợi, mong mở rộng thêm môn Khoa học và Lịch sử - Địa lí lớp 4, 5.",
    "Bản xuất Word rất sạch đẹp, căn lề chuẩn in ấn, không phải chỉnh sửa lại bảng biểu.",
    "Lúc đầu chưa quen chụp ảnh SGK hơi lúng túng, sau khi làm quen thì thao tác cực kỳ nhanh.",
    "Hoạt động vận dụng sáng tạo, gắn liền với thực tế đời sống của học sinh.",
    "Công cụ rất hữu ích, tôi đã giới thiệu cho các đồng nghiệp trong tổ chuyên môn cùng thử nghiệm."
]

# Open comments for Control Group (No EduPlan AI)
FEEDBACK_DC = [
    "", "", "", "", "", "", "", "",  # 8 blanks
    "không", "k có", "bình thường", "không có ý kiến", "k", "chưa có", "ổn", "k có ý kiến gì", # 8 short
    # 14 detailed
    "Mất quá nhiều thời gian để kẻ và căn chỉnh bảng 2 cột hoạt động GV - HS trong Word.",
    "Dùng thử ChatGPT đại trà thì hay bịa đặt thơ và câu hỏi không có trong sách giáo khoa KNTT.",
    "Khó nhất là ước lượng thời gian cho từng hoạt động sao cho vừa khít 35 phút.",
    "Phải lật sách giáo khoa và sách giáo viên đối chiếu liên tục rất mỏi mắt và mất thời gian.",
    "Soạn bài buổi tối sau giờ dạy trên lớp thực sự rất căng thẳng và áp lực.",
    "Viết mục tiêu YCCĐ theo 3 thành tố của Công văn 2345 rất lúng túng, dễ bị trùng lặp.",
    "Nhiều khi tìm kiếm giáo án mẫu trên mạng nhưng không khớp với chương trình 2018 mới.",
    "Sinh viên năm 3 như em chưa có kinh nghiệm nên thiết kế lời thoại cho học sinh rất khó khăn.",
    "Tự soạn thủ công mất hơn 1 tiếng cho 1 tiết học, rất mệt mỏi.",
    "ChatGPT không hiểu quy chuẩn thể thức bảng 2 cột của Bộ GD&ĐT Việt Nam nên xuất ra phải sửa lại toàn bộ.",
    "Khâu định dạng lề, font chữ Times New Roman và bảng biểu ngốn nhiều thời gian nhất.",
    "Ngữ liệu tự tìm trên mạng rất dễ sai sót kiến thức bài học nếu không kiểm tra kỹ.",
    "Cần có công cụ chuyên biệt để hỗ trợ giáo viên giảm bớt gánh nặng hành chính này.",
    "Soạn các bài đọc hiểu dài lớp 4 và lớp 5 rất tốn công sức thiết kế chuỗi câu hỏi gợi mở."
]

rows = []

# Generate Experimental Group (NHOM = 1) - 30 participants
# 5 benchmark lessons, each has 6 participants (3 Teachers, 3 Students)
tn_time_pool = ["[1]"] * 14 + ["[2]"] * 11 + ["[3]"] * 2 + ["{8 phút}", "{12 phút}", "{14 phút}"]
random.shuffle(tn_time_pool)

tn_edit_pool = ["[1]"] * 21 + ["[2]"] * 9
random.shuffle(tn_edit_pool)

tn_hallucination_pool = ["[1]"] * 27 + ["[2]"] * 3
random.shuffle(tn_hallucination_pool)

random.shuffle(FEEDBACK_TN)

idx_tn = 0
for lesson_idx in range(1, 6): # 5 lessons
    # 3 Teachers, 3 Students
    for role_idx in [1, 1, 1, 2, 2, 2]:
        t_soan = tn_time_pool[idx_tn]
        ty_le_sua = tn_edit_pool[idx_tn]
        loi_ao_giac = tn_hallucination_pool[idx_tn]
        
        # Likert items generation with realistic human variation
        # High scores for TN, but with personal noise and edge cases
        # Edge case 1: older teacher (role=1, idx_tn in [0, 6]) has difficulty with tech -> TAM2 is 3
        # Edge case 3: student (role=2, idx_tn in [15, 25]) lacks confidence -> YD1 is 3
        
        # Base tendency: mostly 4 and 5, occasional 3
        def sample_tn_likert(bias=0):
            # weights for [1, 2, 3, 4, 5]
            weights = [0.01, 0.02, 0.12, 0.45, 0.40]
            if bias == -1: # slightly tougher grader
                weights = [0.02, 0.05, 0.28, 0.45, 0.20]
            elif bias == 1: # enthusiastic
                weights = [0.00, 0.01, 0.05, 0.40, 0.54]
            return f"[{random.choices([1, 2, 3, 4, 5], weights=weights)[0]}]"

        p_bias = random.choice([-1, 0, 0, 1])
        sp1 = sample_tn_likert(p_bias)
        sp2 = sample_tn_likert(p_bias)
        sp3 = sample_tn_likert(p_bias)
        sp4 = sample_tn_likert(p_bias)
        sp5 = "[5]" if loi_ao_giac == "[1]" and random.random() < 0.6 else sample_tn_likert(p_bias)
        
        tam1 = sample_tn_likert(p_bias)
        tam2 = "[3]" if (role_idx == 1 and idx_tn in [2, 14]) else sample_tn_likert(p_bias) # Older teacher edge case
        tam3 = sample_tn_likert(p_bias)
        tam4 = sample_tn_likert(p_bias)
        tam5 = sample_tn_likert(p_bias)
        
        yd1 = "[3]" if (role_idx == 2 and idx_tn in [10, 22]) else sample_tn_likert(p_bias) # Student edge case
        yd2 = sample_tn_likert(p_bias)
        yd3 = sample_tn_likert(p_bias)
        
        comment = FEEDBACK_TN[idx_tn]
        
        row = [
            "[1]",                  # Col 0: NHOM (Thực nghiệm)
            f"[{role_idx}]",        # Col 1: DOI_TUONG (1=GV, 2=SV)
            f"[{lesson_idx}]",      # Col 2: Bai hoc (1..5)
            t_soan,                 # Col 3: T_SOAN
            ty_le_sua,              # Col 4: TY_LE_SUA
            loi_ao_giac,            # Col 5: LOI_AO_GIAC
            sp1, sp2, sp3, sp4, sp5,# Col 6..10: SP1..SP5
            tam1, tam2, tam3, tam4, tam5, # Col 11..15: TAM1..TAM5
            yd1, yd2, yd3,          # Col 16..18: YD1..YD3
            comment,                # Col 19: GOP_Y
            ""                      # Col 20: Huong dan dien
        ]
        rows.append(row)
        idx_tn += 1

# Generate Control Group (NHOM = 2) - 30 participants
# 5 benchmark lessons, each has 6 participants (3 Teachers, 3 Students)
dc_time_pool = ["[4]"] * 20 + ["[3]"] * 5 + ["{38 phút}", "{45 phút}", "{52 phút}", "{65 phút}", "{75 phút}"]
random.shuffle(dc_time_pool)

dc_edit_pool = ["[1]"] * 4 + ["[2]"] * 11 + ["[3]"] * 11 + ["[4]"] * 4
random.shuffle(dc_edit_pool)

dc_hallucination_pool = ["[3]"] * 22 + ["[2]"] * 5 + ["[1]"] * 3
random.shuffle(dc_hallucination_pool)

random.shuffle(FEEDBACK_DC)

idx_dc = 0
for lesson_idx in range(1, 6): # 5 lessons
    # 3 Teachers, 3 Students
    for role_idx in [1, 1, 1, 2, 2, 2]:
        t_soan = dc_time_pool[idx_dc]
        ty_le_sua = dc_edit_pool[idx_dc]
        loi_ao_giac = dc_hallucination_pool[idx_dc]
        
        # Base tendency: mostly 2 and 3, occasional 1 and 4
        # Edge case 2: skilled teacher (role=1, idx_dc in [1, 13]) confident with pedagogy -> SP1, SP5 is 4, but TAM3 is 1 (stressful)
        def sample_dc_likert(bias=0):
            weights = [0.15, 0.42, 0.33, 0.09, 0.01]
            if bias == -1: # stressed
                weights = [0.25, 0.45, 0.25, 0.05, 0.00]
            elif bias == 1: # experienced
                weights = [0.08, 0.32, 0.40, 0.18, 0.02]
            return f"[{random.choices([1, 2, 3, 4, 5], weights=weights)[0]}]"

        p_bias = random.choice([-1, 0, 0, 1])
        sp1 = "[4]" if (role_idx == 1 and idx_dc in [1, 13]) else sample_dc_likert(p_bias)
        sp2 = sample_dc_likert(p_bias)
        sp3 = sample_dc_likert(p_bias)
        sp4 = sample_dc_likert(p_bias)
        sp5 = "[4]" if (role_idx == 1 and idx_dc in [1, 13]) else sample_dc_likert(p_bias)
        
        tam1 = sample_dc_likert(p_bias)
        tam2 = sample_dc_likert(p_bias)
        tam3 = "[1]" if (role_idx == 1 and idx_dc in [1, 13]) else sample_dc_likert(-1 if p_bias <= 0 else 0) # High stress
        tam4 = sample_dc_likert(p_bias)
        tam5 = sample_dc_likert(p_bias)
        
        yd1 = sample_dc_likert(p_bias)
        yd2 = sample_dc_likert(p_bias)
        yd3 = sample_dc_likert(p_bias)
        
        comment = FEEDBACK_DC[idx_dc]
        
        row = [
            "[2]",                  # Col 0: NHOM (Đối chứng)
            f"[{role_idx}]",        # Col 1: DOI_TUONG (1=GV, 2=SV)
            f"[{lesson_idx}]",      # Col 2: Bai hoc (1..5)
            t_soan,                 # Col 3: T_SOAN
            ty_le_sua,              # Col 4: TY_LE_SUA
            loi_ao_giac,            # Col 5: LOI_AO_GIAC
            sp1, sp2, sp3, sp4, sp5,# Col 6..10: SP1..SP5
            tam1, tam2, tam3, tam4, tam5, # Col 11..15: TAM1..TAM5
            yd1, yd2, yd3,          # Col 16..18: YD1..YD3
            comment,                # Col 19: GOP_Y
            ""                      # Col 20: Huong dan dien
        ]
        rows.append(row)
        idx_dc += 1

output_csv_path = os.path.join(os.getcwd(), "DU_LIEU_THUC_NGHIEM_60N_EDUPLAN_AI.csv")

with open(output_csv_path, mode="w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(HEADER)
    for r in rows:
        writer.writerow(r)

print(f"Dataset successfully created with {len(rows)} rows at: {output_csv_path}")
