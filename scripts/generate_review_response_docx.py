# -*- coding: utf-8 -*-
"""
Script tạo tài liệu Word chuẩn học thuật giải trình phản biện khoa học
cho Hội đồng phản biện Tạp chí và Ban biên tập.
"""
import os
import sys
import docx
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="D1D5DB", sz="4", val="single"):
    tblPr = table._tbl.tblPr
    tblBorders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(tblBorders)

def add_callout(doc, text, title=None, border_color="1E3A8A", bg_color="F8FAFC"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.rows[0].cells[0]
    cell.width = Cm(16.0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=160)
    
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(tcBorders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    
    if title:
        run_t = p.add_run(f"📌 {title}\n")
        run_t.font.name = "Times New Roman"
        run_t.font.size = Pt(11)
        run_t.font.bold = True
        run_t.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        
    run_b = p.add_run(text)
    run_b.font.name = "Times New Roman"
    run_b.font.size = Pt(10.5)
    run_b.font.italic = True
    run_b.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(0)
    p_after.paragraph_format.space_after = Pt(4)

def main():
    doc = docx.Document()
    
    # 1. Cấu hình Page Setup chuẩn văn bản khoa học
    section = doc.sections[0]
    section.page_width = Cm(21.0)   # A4
    section.page_height = Cm(29.7)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)
    section.left_margin = Cm(2.5)   # Trái 2.5cm chuẩn
    section.right_margin = Cm(2.0)  # Phải 2.0cm
    
    # Style mặc định Normal
    style_normal = doc.styles['Normal']
    font_normal = style_normal.font
    font_normal.name = 'Times New Roman'
    font_normal.size = Pt(12)
    font_normal.color.rgb = RGBColor(0x1F, 0x29, 0x37)
    style_normal.paragraph_format.line_spacing = 1.2
    style_normal.paragraph_format.space_after = Pt(5)
    
    # Header / Title
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_sub = p_sub.add_run("HỘI ĐỒNG KHOA HỌC & BAN BIÊN TẬP TẠP CHÍ KHOA HỌC GIÁO DỤC\n")
    r_sub.font.name = "Times New Roman"
    r_sub.font.size = Pt(11)
    r_sub.font.bold = True
    r_sub.font.color.rgb = RGBColor(0x47, 0x55, 0x69)
    
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(4)
    r_title = p_title.add_run("BẢN GIẢI TRÌNH PHẢN BIỆN KHOA HỌC\nVÀ LÀM RÕ CÁC NỘI DUNG HỌC THUẬT CỦA CÔNG TRÌNH")
    r_title.font.name = "Times New Roman"
    r_title.font.size = Pt(16)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p_paper = doc.add_paragraph()
    p_paper.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_paper.paragraph_format.space_after = Pt(14)
    r_paper = p_paper.add_run("Đề tài: Nghiên cứu phát triển công cụ AI hỗ trợ xây dựng kế hoạch bài dạy ở tiểu học\ntheo Công văn 2345/BGDĐT-GDTH (EduPlan AI v2.0)")
    r_paper.font.name = "Times New Roman"
    r_paper.font.size = Pt(11.5)
    r_paper.font.italic = True
    r_paper.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    # Lời mở đầu
    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.first_line_indent = Cm(1.0)
    p_intro.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_in = p_intro.add_run(
        "Kính gửi Hội đồng phản biện và Ban Biên tập Tạp chí,\n"
        "Nhóm tác giả xin trân trọng cảm ơn những ý kiến phản biện sắc bén, xác đáng và giàu tính xây dựng của Quý Hội đồng. "
        "Với tinh thần học thuật cầu thị và phương pháp luận nghiên cứu thực chứng (empirical research) nghiêm cẩn, "
        "chúng tôi xin được trình bày bản giải trình chi tiết về 5 cụm vấn đề cốt lõi: Hệ thống 14 tài liệu tham khảo và sự chuyển hóa vào quy trình 8 bước của công cụ; "
        "Cơ sở phương pháp luận thiết kế thực nghiệm; Ý nghĩa khoa học và tính phù hợp của các thang đo chuẩn quốc tế (NASA-TLX, SUS); "
        "Bản chất của phần mềm thống kê SPSS; và Chiến lược tinh giản, quản trị tài liệu trích dẫn."
    )
    r_in.font.name = "Times New Roman"
    
    # ================= MỤC I =================
    p_h1 = doc.add_paragraph()
    p_h1.paragraph_format.space_before = Pt(12)
    p_h1.paragraph_format.space_after = Pt(4)
    r_h1 = p_h1.add_run("I. HỆ THỐNG TÀI LIỆU THAM KHẢO VÀ SỰ TÍCH HỢP VÀO 8 BƯỚC PIPELINE CỦA TOOL (CÂU HỎI 3, 4, 5)")
    r_h1.font.name = "Times New Roman"
    r_h1.font.size = Pt(13.5)
    r_h1.font.bold = True
    r_h1.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p_m1 = doc.add_paragraph()
    p_m1.paragraph_format.first_line_indent = Cm(1.0)
    p_m1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_m1.add_run(
        "Trong nghiên cứu phát triển hệ thống công nghệ giáo dục (EdTech), tài liệu tham khảo (TLTK) không phải là các dẫn chứng hình thức, "
        "mà đóng vai trò là cơ sở lý thuyết (Theoretical Foundation) trực tiếp định hình các module chức năng và rào chắn kiểm định chất lượng (Quality Gates). "
        "Toàn bộ 14 TLTK được nhóm nghiên cứu phân hóa thành 4 nhóm trụ cột và tích hợp chặt chẽ vào quy trình Staged Generation Pipeline V2 gồm 8 bước của EduPlan AI:"
    )
    
    # Bảng 1: Ma trận TLTK và 8 bước
    table1 = doc.add_table(rows=1, cols=4)
    table1.alignment = WD_TABLE_ALIGNMENT.CENTER
    table1.autofit = False
    set_table_borders(table1)
    
    headers = ["Nhóm tài liệu", "Tài liệu cụ thể & Nội dung cốt lõi", "Bài học khoa học & Ứng dụng vào EduPlan AI", "Khâu tích hợp trong Pipeline 8 bước"]
    widths = [Cm(3.0), Cm(4.2), Cm(5.8), Cm(3.0)]
    
    hdr_cells = table1.rows[0].cells
    for i, title in enumerate(headers):
        hdr_cells[i].width = widths[i]
        set_cell_background(hdr_cells[i], "1E3A8A")
        set_cell_margins(hdr_cells[i], top=120, bottom=120, left=100, right=100)
        p = hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(title)
        r.font.name = "Times New Roman"
        r.font.size = Pt(10)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        
    matrix_data = [
        (
            "1. Căn cứ pháp lý & Chuẩn chương trình",
            "[1] Thông tư 32/2018/TT-BGDĐT\n(CT GDPT 2018)\n\n[2] Công văn 2345/BGDĐT-GDTH\n(Khung KHBD Tiểu học)",
            "• Xác lập cấu trúc KHBD bắt buộc gồm 4 mục và bảng 2 cột đối ứng (Hoạt động GV - Hoạt động HS).\n• Định hình chuẩn đầu ra (YCCĐ) theo định hướng phát triển phẩm chất, năng lực và động từ hành vi quan sát được.",
            "Bước 3 (Xây dựng khung tiết học)\n\nBước 4 (Sinh nội dung các pha)\n\nBước 8 (Xuất bản Word hai cột)"
        ),
        (
            "2. Bằng chứng rủi ro & Bài học từ các mô hình AI đi trước",
            "[3] Powell & Courchesne (2024)\n(Thử nghiệm ChatGPT Khoa học lớp 1)\n\n[4] Nyaaba & Zhai (2025)\n(Lesson Planner thích ứng văn hóa)\n\n[5] Zheng và cộng sự (2025)\n(LessonPlanLM: sinh đa bước)\n\n[6] Luo & Tahir (2025)\n(Đánh giá KHBD STEAM có AI)\n\n[7] Sun & Huang (2025) &\n[8] Tran và cộng sự (2026)\n(Sinh viên sư phạm ứng dụng GenAI)",
            "• Nhận diện rủi ro ảo giác sư phạm: Cấm dùng prompt thô vì AI hay bịa ngữ liệu và trích nguồn giả.\n• Thích ứng văn hóa vùng miền: Đưa bối cảnh bản địa, điểm trường khó khăn, cơ sở vật chất sẵn có vào kịch bản.\n• Chia nhỏ quy trình: Chia việc sinh giáo án thành từng chặng chuyên biệt để tránh tràn ngữ cảnh (context window).\n• Giữ quyền quyết định của con người (Human-in-the-loop): Đóng gói giao diện dễ dùng và giữ file Word mở để người dạy rà soát.",
            "Bước 1–2 (Chuẩn bị nguồn, OCR ảnh SGK thật, nhập bối cảnh tỉnh/vùng núi)\n\nBước 3–4 (Khung bài và sinh các pha theo Pedagogy Engine)\n\nBước 7 (Quality Gates V12 chặn bịa chữ, chặn lệch tiết)\n\nBước 8 (Xuất bản bản thảo Word mở)"
        ),
        (
            "3. Phương pháp luận & Chuẩn mực hệ thống",
            "[9] Hevner et al. (2004)\n(Design Science Research - DSR)\n\n[10] ISO 9241-11:2018\n(Tiêu chuẩn Công thái học & Tính khả dụng)",
            "• Vận dụng quy trình DSR chuẩn mực: Xác định vấn đề -> Thiết kế phần mềm -> Hiện thực hóa -> Đánh giá thực nghiệm.\n• Định vị tiêu chí đo lường hiệu suất (Efficiency) qua chỉ báo 'Thời gian hoàn thành nhiệm vụ' (Time used) trong bối cảnh xác định.",
            "Khung phương pháp luận nghiên cứu của toàn bộ bài báo (Mục 2.1)\n\nCơ sở lý luận chọn biến đo thời gian (phút) trong thực nghiệm"
        ),
        (
            "4. Thang đo tâm lý học & Công thái học",
            "[11] Hart & Staveland (1988) &\n[12] Hart (2006)\n(NASA-TLX & biến thể Raw TLX)\n\n[13] Brooke (1996) &\n[14] Bangor et al. (2008)\n(System Usability Scale - SUS)",
            "• Lựa chọn công cụ đo lường gánh nặng nhận thức đa chiều của giáo viên qua 6 phương diện NASA-TLX; áp dụng tính trung bình không trọng số (Raw TLX) để giảm tải cho người tham gia.\n• Đo lường độ thân thiện, tính khả dụng của phần mềm qua 10 mục chuẩn hóa của SUS (thang điểm 0–100).",
            "Công cụ thu thập dữ liệu trong khâu Đánh giá thực nghiệm đối chứng theo cặp (Mục 2.3 & 2.4)"
        )
    ]
    
    for row_idx, (col0, col1, col2, col3) in enumerate(matrix_data):
        row = table1.add_row()
        bg = "FFFFFF" if row_idx % 2 == 0 else "F8FAFC"
        cells = row.cells
        for c_i, val in enumerate([col0, col1, col2, col3]):
            cells[c_i].width = widths[c_i]
            set_cell_background(cells[c_i], bg)
            set_cell_margins(cells[c_i], top=100, bottom=100, left=90, right=90)
            p = cells[c_i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if c_i != 0 else WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(val)
            r.font.name = "Times New Roman"
            r.font.size = Pt(9.5)
            if c_i == 0:
                r.font.bold = True
                
    p_space = doc.add_paragraph()
    p_space.paragraph_format.space_before = Pt(4)
    p_space.paragraph_format.space_after = Pt(4)

    # Chi tiết 8 bước trong Pipeline V2
    p_pipe_desc = doc.add_paragraph()
    p_pipe_desc.paragraph_format.first_line_indent = Cm(1.0)
    p_pipe_desc.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_pipe_desc.add_run(
        "Cụ thể, quy trình Staged Generation Pipeline V2 gồm 8 bước tuần tự khép kín, giải quyết triệt để bài toán biến đổi yêu cầu lý thuyết thành hành động thực tiễn:"
    )
    
    steps_data = [
        ("Bước 1–2: Chuẩn bị nguồn & Bản đồ bài học", "Hệ thống tiếp nhận thông tin bài, khối lớp, ảnh SGK thật qua Vision OCR. Thiết lập 'Hợp đồng ngữ liệu bất biến' (Source Truth Contract) từ bài học của Powell [3] để chống hallucination; thu thập bối cảnh địa phương (tỉnh, vùng cao, điểm trường) theo định hướng của Nyaaba [4]."),
        ("Bước 3: Xây dựng khung tiết học (Blueprint)", "Phân bổ thời lượng chính xác 35 phút/tiết, sinh YCCĐ theo Thông tư 32 [1] bằng các động từ hành vi đo lường được (observable verbs), lập cấu trúc bài theo Công văn 2345 [2]."),
        ("Bước 4: Sinh nội dung các pha dạy học", "Phân rã thành từng pha (Khởi động, Khám phá, Luyện tập, Vận dụng). Module Pedagogy Engine định hướng kịch bản chi tiết: lời GV nói thật, hành động cụ thể của HS, sản phẩm đầu ra và tiêu chí đánh giá; tích hợp tình huống gần gũi với học sinh bản địa."),
        ("Bước 5–6: Hợp nhất bản thảo & Đồng bộ học liệu", "Ghép nối các pha thành chỉnh thể hoàn chỉnh, đối chiếu tính liên tục giữa các tiết, gắn mỏ neo (anchor) hình ảnh và đồ dùng dạy học tương ứng."),
        ("Bước 7: Kiểm định đa tầng (Quality Gates V12)", "Lớp phòng vệ chuyên biệt quét toàn diện bản thảo: chặn các câu sáo rỗng (LQ-OUTCOME-01, LQ-ACTIVITY-02), kiểm tra quy trình ngữ âm (đặc thù lớp 1: ghép tiếng 2 bước, mẫu nét ô li), kiểm tra thời lượng và tính phân hóa. Nếu vi phạm lỗi nghiêm trọng, hệ thống chặn xuất bản để người dạy rà soát."),
        ("Bước 8: Xuất bản văn bản chuẩn CV 2345", "Sinh tệp Word (.docx) bản địa với 100% tiến trình Mục III nằm trọn vẹn trong bảng 2 cột, hỗ trợ người dạy dễ dàng xem trước, chỉnh sửa và in ấn theo nguyên tắc Human-in-the-loop của Tran et al. [8].")
    ]
    
    for title, desc in steps_data:
        p_st = doc.add_paragraph()
        p_st.paragraph_format.first_line_indent = Cm(0.5)
        p_st.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        r_t = p_st.add_run(f"• {title}: ")
        r_t.font.name = "Times New Roman"
        r_t.font.bold = True
        r_t.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
        r_d = p_st.add_run(desc)
        r_d.font.name = "Times New Roman"
        
    # ================= MỤC II =================
    p_h2 = doc.add_paragraph()
    p_h2.paragraph_format.space_before = Pt(14)
    p_h2.paragraph_format.space_after = Pt(4)
    r_h2 = p_h2.add_run("II. THIẾT KẾ THỰC NGHIỆM ĐỐI CHỨNG VÀ BỐI CẢNH XÁC ĐỊNH (CÂU HỎI 8, 10, 13)")
    r_h2.font.name = "Times New Roman"
    r_h2.font.size = Pt(13.5)
    r_h2.font.bold = True
    r_h2.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p_tn1 = doc.add_paragraph()
    p_tn1.paragraph_format.first_line_indent = Cm(1.0)
    p_tn1.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_tn1.add_run(
        "Một trong những điểm chất lượng nhất trong bài báo là thiết kế thực nghiệm được xây dựng theo chuẩn mực nghiên cứu tâm lý học và công thái học quốc tế, "
        "thay vì chỉ tiến hành khảo sát cảm nhận đơn thuần:"
    )
    
    add_callout(
        doc,
        "Thiết kế so sánh theo cặp trên cùng đối tượng (Within-Subjects Design) với 60 người (30 giáo viên tiểu học, 30 sinh viên sư phạm). "
        "Mỗi người tham gia đều thực hiện cả 2 điều kiện: Soạn truyền thống và Soạn với EduPlan AI v2.0. Kỹ thuật cân bằng thứ tự (Counterbalancing) "
        "được áp dụng: 30 người làm truyền thống trước, 30 người dùng AI trước để triệt tiêu hoàn toàn hiệu ứng thứ tự (order effect) và hiệu ứng mệt mỏi/học tập (carryover effect).",
        title="Đặc điểm cốt lõi của Thiết kế thực nghiệm"
    )
    
    p_tn2 = doc.add_paragraph()
    p_tn2.paragraph_format.first_line_indent = Cm(1.0)
    p_tn2.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_tn2.add_run(
        "Vì sao chọn Bối cảnh xác định là Tiếng Việt lớp 1 (Bài 31 'an, ăn, ân' và Bài 32 'on, ôn, ơn')?\n"
        "Theo tiêu chuẩn quốc tế ISO 9241-11:2018 [10], phép đo tính khả dụng và hiệu suất chỉ có giá trị khi đặt trong một bối cảnh sử dụng xác định (Specific Context of Use). "
        "Nhóm nghiên cứu lựa chọn hai bài học này dựa trên 3 căn cứ khoa học nghiêm ngặt:\n"
        "1. Tính tương thích hoàn hảo (Strict Parity): Bài 31 và Bài 32 có cấu trúc hoàn toàn tương đồng (đều gồm 3 vần có âm cuối 'n', thời lượng 2 tiết, cùng các khâu nhận biết tranh, đánh vần, ghép tiếng 2 bước, đọc từ ngữ ứng dụng, tập viết và luyện nói). Điều này kiểm soát tuyệt đối biến ngoại lai (confounding variables) về độ khó hoặc độ dài của bài học.\n"
        "2. Thử thách kiểm định khắt khe nhất (Stress-test): Lớp 1 là lớp có cấu trúc sư phạm chặt chẽ nhất và quy tắc ngữ âm khắt khe nhất trong toàn cấp tiểu học. Nếu một công cụ AI xử lý chính xác được logic ngữ âm và tập viết lớp 1, nó sẽ chứng minh năng lực tin cậy đối với mọi môn học khác.\n"
        "3. Đo lường thời gian (phút) khách quan: Bấm giờ độc lập từ khi nhận nhiệm vụ đến khi có bản thảo hoàn thiện, phản ánh trực tiếp hiệu quả tiết kiệm thời gian lao động sư phạm."
    )
    
    # ================= MỤC III =================
    p_h3 = doc.add_paragraph()
    p_h3.paragraph_format.space_before = Pt(14)
    p_h3.paragraph_format.space_after = Pt(4)
    r_h3 = p_h3.add_run("III. GIẢI THÍCH DỄ HIỂU VÀ ĐỘ PHÙ HỢP CỦA CÁC THANG ĐO CHUẨN QUỐC TẾ (CÂU HỎI 11, 13)")
    r_h3.font.name = "Times New Roman"
    r_h3.font.size = Pt(13.5)
    r_h3.font.bold = True
    r_h3.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p_sc_desc = doc.add_paragraph()
    p_sc_desc.paragraph_format.first_line_indent = Cm(1.0)
    p_sc_desc.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_sc_desc.add_run(
        "Nhóm nghiên cứu không tự chế tạo thang đo cảm tính mà kế thừa các thang đo chuẩn vàng (Gold Standards) đã được kiểm chứng trên hàng trăm nghìn công trình quốc tế:"
    )
    
    # NASA-TLX
    p_nasa = doc.add_paragraph()
    p_nasa.paragraph_format.first_line_indent = Cm(0.5)
    p_nasa.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_nt = p_nasa.add_run("1. Thang đo Tải công việc tâm lý NASA-TLX (Task Load Index - Hart & Staveland, 1988; Hart, 2006):\n")
    r_nt.font.bold = True
    r_nt.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    p_nasa.add_run(
        "• Bản chất: Ban đầu do Cơ quan Hàng không Vũ trụ Mỹ (NASA) phát triển để đo mức độ căng thẳng của phi hành gia và phi công. "
        "Sau đó, các nhà khoa học giáo dục nhận thấy khâu soạn bài cũng gây áp lực tinh thần và nguy cơ kiệt sức (burnout) tương đương nhiệm vụ buồng lái (Jerrim & Sims, 2020).\n"
        "• 6 phương diện phản ánh cảm giác của giáo viên (thang điểm 0–100, điểm càng cao = càng kiệt sức):\n"
        "   + Yêu cầu trí óc (Mental Demand): Mức độ phải vắt óc tư duy, tra cứu kiến thức.\n"
        "   + Yêu cầu thể chất (Physical Demand): Mức độ mỏi tay, mỏi mắt khi gõ máy tính liên tục.\n"
        "   + Áp lực thời gian (Temporal Demand): Cảm giác cuống cuồng chạy đua với thời hạn nộp bài.\n"
        "   + Đánh giá thành tích (Performance): Mức độ tự hài lòng với bản giáo án tạo ra (0 = rất tốt, 100 = rất kém).\n"
        "   + Nỗ lực bỏ ra (Effort): Phải gồng mình đến mức nào để hoàn thành nhiệm vụ.\n"
        "   + Mức độ ức chế (Frustration): Mức độ căng thẳng, khó chịu, nản lòng khi soạn bài.\n"
        "• Biến thể Raw NASA-TLX: Nhóm nghiên cứu áp dụng cách tính trung bình cộng giản đơn (không gán trọng số cặp) theo khuyến nghị tại bài báo tổng kết 20 năm của Sandra Hart (2006) [12], "
        "giúp rút ngắn thời gian trả lời phiếu mà vẫn bảo toàn độ nhạy và tương quan cao với bản có trọng số gốc (r > 0,95).\n"
        "• Ý nghĩa kết quả: Điểm tải công việc giảm từ 65,29 (mức áp lực nặng nề) xuống 27,33 (mức thư thái, nhẹ nhàng), chênh lệch 37,96 điểm có ý nghĩa thống kê (Wilcoxon Z = -6,738, p < 0,001)."
    )
    
    # SUS
    p_sus = doc.add_paragraph()
    p_sus.paragraph_format.first_line_indent = Cm(0.5)
    p_sus.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_st = p_sus.add_run("2. Thang đo Tính khả dụng Hệ thống SUS (System Usability Scale - Brooke, 1996; Bangor et al., 2008):\n")
    r_st.font.bold = True
    r_st.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    p_sus.add_run(
        "• Bản chất: Bộ 10 câu hỏi chuẩn hóa toàn cầu về độ dễ sử dụng, mạch lạc, dễ học và mức độ tự tin khi thao tác phần mềm.\n"
        "• Điểm chuẩn công nghiệp: Điểm quy đổi SUS trung bình toàn cầu là 68 điểm (mức Đạt/Acceptable). Điểm từ 70 trở lên được xếp vào mức 'Tốt' (Good) và trên 80 là 'Xuất sắc' (Excellent).\n"
        "• Kết quả EduPlan AI: Đạt 72,46/100 điểm, với hệ số tin cậy nội tại Cronbach's Alpha đạt 0,862 (vượt xa ngưỡng chấp nhận 0,70). "
        "Điều này khẳng định giáo viên và sinh viên tiểu học đánh giá công cụ rất dễ làm quen và vận hành thuận lợi."
    )
    
    # ================= MỤC IV =================
    p_h4 = doc.add_paragraph()
    p_h4.paragraph_format.space_before = Pt(14)
    p_h4.paragraph_format.space_after = Pt(4)
    r_h4 = p_h4.add_run("IV. PHÂN ĐỊNH BẢN CHẤT: VÌ SAO DÙNG SPSS VÀ LÝ GIẢI 'KHÔNG CÓ THANG ĐO CỦA SPSS' (CÂU HỎI 8, 15)")
    r_h4.font.name = "Times New Roman"
    r_h4.font.size = Pt(13.5)
    r_h4.font.bold = True
    r_h4.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    add_callout(
        doc,
        "Khẳng định phương pháp luận cốt lõi: 'SPSS KHÔNG CÓ THANG ĐO NÀO CẢ!'\n"
        "Thang đo (Measurement Scales: NASA-TLX, SUS, Rubric) thuộc về Lý thuyết đo lường Tâm lý học và Công thái học (Psychometrics & Ergonomics) — đóng vai trò là 'chiếc thước kẻ'. "
        "Trong khi đó, IBM SPSS Statistics là Phần mềm xử lý thống kê toán học (Statistical Computing Software) — đóng vai trò là 'chiếc máy tính'. "
        "Ta không thể dùng máy tính để thay thế thước kẻ, mà phải dùng máy tính để phân tích những dữ liệu do thước kẻ đo được.",
        title="Làm rõ ngộ nhận học thuật về Thang đo và Phần mềm"
    )
    
    p_spss_detail = doc.add_paragraph()
    p_spss_detail.paragraph_format.first_line_indent = Cm(1.0)
    p_spss_detail.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_spss_detail.add_run(
        "Vì sao nhóm nghiên cứu bắt buộc phải sử dụng phần mềm SPSS trong công trình này?\n"
        "Dữ liệu thời gian và điểm số thu thập từ 60 người tham gia là dữ liệu thực nghiệm thô. "
        "Để chứng minh các hiệu quả của EduPlan AI (tiết kiệm hơn 30 phút, giảm tải gần 38 điểm gánh nặng tâm lý) là sự thật khoa học khách quan chứ không phải do may rủi hay ngẫu nhiên, "
        "SPSS là công cụ bắt buộc để thực hiện chuỗi kiểm định thống kê đa tầng:\n"
        "1. Kiểm định tính phân phối chuẩn (Normality Test - Shapiro–Wilk): Kết quả chạy trên SPSS cho p = 0,001 (< 0,05). Điều này chứng minh dữ liệu chênh lệch thời gian không tuân theo phân phối chuẩn. "
        "Đây là phát hiện then chốt về mặt học thuật: nếu dùng kiểm định t-test thông thường của bài toán tham số thì kết quả sẽ bị sai lệch.\n"
        "2. Kiểm định phi tham số Wilcoxon Signed-Rank Test: Từ kết quả của Shapiro-Wilk, SPSS giúp nhóm nghiên cứu áp dụng kiểm định phi tham số dành riêng cho mẫu so sánh theo cặp (paired samples). "
        "Kết quả Z = -6,729 đối với thời gian (p < 0,001) và Z = -6,738 đối với NASA-TLX (p < 0,001) xác lập độ tin cậy thống kê vượt trên 99,9%.\n"
        "3. Kiểm định độ tin cậy thang đo (Reliability Analysis): Tính toán hệ số Cronbach's Alpha (đạt 0,862 cho thang đo SUS), bảo đảm tính nhất quán nội tại của công cụ đo."
    )
    
    # ================= MỤC V =================
    p_h5 = doc.add_paragraph()
    p_h5.paragraph_format.space_before = Pt(14)
    p_h5.paragraph_format.space_after = Pt(4)
    r_h5 = p_h5.add_run("V. RÀ SOÁT TÀI LIỆU THAM KHẢO: TÍNH BAO QUÁT, CẮT BỎ, GIỮ LẠI VÀ TRÙNG LẶP (CÂU HỎI 12)")
    r_h5.font.name = "Times New Roman"
    r_h5.font.size = Pt(13.5)
    r_h5.font.bold = True
    r_h5.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p_rev_intro = doc.add_paragraph()
    p_rev_intro.paragraph_format.first_line_indent = Cm(1.0)
    p_rev_intro.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    p_rev_intro.add_run(
        "Nhằm tối ưu hóa dung lượng bài báo và đáp ứng chặt chẽ quy định về số lượng TLTK của Tạp chí, "
        "nhóm tác giả đã rà soát tính bao quát và hiện tượng trùng lặp học thuật của 14 nguồn trích dẫn, đưa ra các đề xuất điều chỉnh cụ thể như sau:"
    )
    
    # Bảng 2: Rà soát và khuyến nghị giữ/bỏ TLTK
    table2 = doc.add_table(rows=1, cols=4)
    table2.alignment = WD_TABLE_ALIGNMENT.CENTER
    table2.autofit = False
    set_table_borders(table2)
    
    t2_headers = ["Tài liệu xem xét", "Mức độ bao quát học thuật", "Hiện tượng trùng lặp & Phân tích", "Khuyến nghị điều chỉnh cho Tạp chí"]
    t2_widths = [Cm(3.5), Cm(4.5), Cm(4.5), Cm(3.5)]
    
    t2_hdr_cells = table2.rows[0].cells
    for i, title in enumerate(t2_headers):
        t2_hdr_cells[i].width = t2_widths[i]
        set_cell_background(t2_hdr_cells[i], "1E3A8A")
        set_cell_margins(t2_hdr_cells[i], top=120, bottom=120, left=100, right=100)
        p = t2_hdr_cells[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(title)
        r.font.name = "Times New Roman"
        r.font.size = Pt(10)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        
    t2_data = [
        (
            "[9] Hevner et al. (2004)\n\n[10] ISO 9241-11:2018",
            "Bao quát toàn bộ phương pháp luận thiết kế hệ thống (DSR) và chuẩn mực quốc tế về đo lường tính khả dụng (Usability).",
            "Không trùng lặp. Đây là các tài liệu nền tảng mang tính chuẩn mực phương pháp luận (Methodological Anchor).",
            "BẮT BUỘC GIỮ NGUYÊN 100% để bảo vệ khung khoa học của bài báo."
        ),
        (
            "[1] Thông tư 32/2018 &\n[2] Công văn 2345/BGDĐT",
            "Bao quát toàn bộ tính hợp pháp và yêu cầu chuyên môn giáo dục tiểu học tại Việt Nam.",
            "Không trùng lặp; bổ trợ chặt chẽ cho nhau (Thông tư 32 quy định YCCĐ môn học; CV 2345 hướng dẫn mẫu bài dạy).",
            "BẮT BUỘC GIỮ NGUYÊN để đảm bảo giá trị ứng dụng thực tiễn."
        ),
        (
            "Cặp NASA-TLX:\n[11] Hart & Staveland (1988) &\n[12] Hart (2006)",
            "[12] Hart (2006) có tính bao quát cao hơn vì tổng kết 20 năm phát triển và ứng dụng NASA-TLX.",
            "Trùng lặp về chủ đề đo tải công việc. Bài 1988 là công trình gốc; bài 2006 trực tiếp biện minh cho biến thể Raw NASA-TLX.",
            "• Nếu giữ cả 2: Rất tốt.\n• Nếu Tạp chí yêu cầu rút gọn: Bỏ [11], CHỈ GIỮ [12] vì bài 2006 đã bao hàm lịch sử bài 1988."
        ),
        (
            "Cặp Usability SUS:\n[13] Brooke (1996) &\n[14] Bangor et al. (2008)",
            "[13] Brooke (1996) là bài báo gốc khai sinh ra thang đo SUS 10 câu hỏi và công thức chấm điểm 0–100.",
            "Trùng lặp mục đích phục vụ thang đo SUS. Bài [14] là nghiên cứu phụ trợ khẳng định độ tin cậy thực nghiệm.",
            "• BẮT BUỘC GIỮ [13].\n• CÓ THỂ LƯỢC BỎ [14] nếu cần tiết kiệm dung lượng, vì bài của Brooke đã có đầy đủ thẩm quyền học thuật."
        ),
        (
            "Cặp Sinh viên sư phạm:\n[7] Sun & Huang (2025) &\n[8] Tran et al. (2026)",
            "[8] Tran et al. (2026) nghiên cứu trực tiếp trên sinh viên sư phạm Việt Nam, có độ tương thích cao với mẫu đề tài.",
            "Cùng nghiên cứu hành vi lập kế hoạch bài dạy bằng GenAI của sinh viên ngành giáo dục.",
            "• ƯU TIÊN GIỮ [8].\n• CÓ THỂ LƯỢC BỎ [7] nếu tạp chí yêu cầu tinh giản số lượng TLTK nước ngoài."
        )
    ]
    
    for row_idx, (col0, col1, col2, col3) in enumerate(t2_data):
        row = table2.add_row()
        bg = "FFFFFF" if row_idx % 2 == 0 else "F8FAFC"
        cells = row.cells
        for c_i, val in enumerate([col0, col1, col2, col3]):
            cells[c_i].width = t2_widths[c_i]
            set_cell_background(cells[c_i], bg)
            set_cell_margins(cells[c_i], top=100, bottom=100, left=90, right=90)
            p = cells[c_i].paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT if c_i != 0 else WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing = 1.15
            p.paragraph_format.space_after = Pt(2)
            r = p.add_run(val)
            r.font.name = "Times New Roman"
            r.font.size = Pt(9.5)
            if c_i == 0:
                r.font.bold = True
                
    # Lời kết
    p_concl = doc.add_paragraph()
    p_concl.paragraph_format.space_before = Pt(14)
    p_concl.paragraph_format.first_line_indent = Cm(1.0)
    p_concl.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_c = p_concl.add_run(
        "KẾT LUẬN:\n"
        "Nhóm tác giả xin khẳng định công trình nghiên cứu được xây dựng trên một nền tảng phương pháp luận nhất quán, "
        "kết hợp chặt chẽ giữa tính chuẩn mực pháp lý của giáo dục Việt Nam (Thông tư 32, CV 2345) với các thành tựu khoa học kỹ thuật và công thái học tiên tiến trên thế giới (DSR, ISO 9241-11, NASA-TLX, SUS). "
        "Các kết quả định lượng được xử lý qua SPSS là minh chứng thực chứng khách quan, phản ánh chính xác hiệu quả giải phóng sức lao động và giảm thiểu gánh nặng tâm lý cho giáo viên tiểu học. "
        "Một lần nữa, nhóm nghiên cứu xin chân thành cảm ơn các đóng góp quý báu của Hội đồng phản biện và kính mong bài báo sớm được hoàn thiện để công bố phục vụ cộng đồng giáo dục."
    )
    r_c.font.name = "Times New Roman"
    
    # Ký tên
    p_sign = doc.add_paragraph()
    p_sign.paragraph_format.space_before = Pt(16)
    p_sign.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_s = p_sign.add_run("TM. NHÓM TÁC GIẢ NGHIÊN CỨU\nChủ nhiệm đề tài\n(Ký và ghi rõ họ tên)")
    r_s.font.name = "Times New Roman"
    r_s.font.bold = True
    r_s.font.italic = True
    r_s.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    # Lưu file
    os.makedirs("BÁO TẠP CHÍ", exist_ok=True)
    out_path1 = os.path.join("BÁO TẠP CHÍ", "BAN_GIAI_TRINH_PHAN_BIEN_KHOA_HOC_EDUPLAN_AI.docx")
    out_path2 = "BAN_GIAI_TRINH_PHAN_BIEN_KHOA_HOC_EDUPLAN_AI.docx"
    
    doc.save(out_path1)
    doc.save(out_path2)
    print(f"File created successfully:\n- {out_path1}\n- {out_path2}")

if __name__ == "__main__":
    main()
