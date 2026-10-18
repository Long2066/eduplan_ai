* EduPlan AI - SPSS syntax nhap du lieu, go nhan bien va kiem tra mo ta.
* Dat file .sps va 01_SPSS_DOI_CHIEU_THUC_NGHIEM.xlsx trong CUNG MOT THU MUC.
* Trong SPSS: File > Change Directory -> thu muc nay -> chay Run > All.
* Khong dung RID (ma dong) lam ma dinh danh ca nhan hay ghep cap.
* Cac gia tri trong system-missing la co chu dich, xem CODEBOOK.

* ====================================================================.
* DATASET DOI_CHIEU - 60 PHIEU.
CD 'D:\NCKH\Tool\EduPlan AI\CHUẨN KQ KS ĐỐI CHIẾU ĐƯA VÀO SPSS'.

GET DATA
  /TYPE=XLSX
  /FILE='D:\NCKH\Tool\EduPlan AI\CHUẨN KQ KS ĐỐI CHIẾU ĐƯA VÀO SPSS\01_SPSS_DOI_CHIEU_THUC_NGHIEM.xlsx'
  /SHEET=name 'DU_LIEU'
  /CELLRANGE=FULL
  /READNAMES=ON.
DATASET NAME DOI_CHIEU WINDOW=FRONT.

VARIABLE LABELS ROW_SRC 'Số dòng Excel trong tệp khảo sát gốc'.
VARIABLE LABELS RID 'Mã dòng khảo sát, định danh giả tạo DC001-DC060'.
VARIABLE LABELS TS_EXCEL 'Dấu thời gian, số seri Excel từ tệp gốc'.
VARIABLE LABELS TS_ISO 'Dấu thời gian ISO để đọc dễ dàng'.
VARIABLE LABELS NHOM 'Nhóm thực nghiệm / nhóm đối chứng'.
VARIABLE LABELS DOI_TUONG 'Đối tượng tham gia'.
VARIABLE LABELS KHOI_GOC 'Khối lớp câu hỏi gốc - không có dữ liệu'.
VARIABLE LABELS KHOI_SG 'Khối lớp SUY RA từ tên bài học thực nghiệm'.
VARIABLE LABELS BAI 'Bài thực nghiệm (mã 1–5 theo lớp)'.
VARIABLE LABELS T_SOAN_GOC 'Thời gian soạn KHBD - câu trả lời nguyên văn'.
VARIABLE LABELS T_SOAN_LO 'Thời gian soạn - cận dưới (phút)'.
VARIABLE LABELS T_SOAN_HI 'Thời gian soạn - cận trên (phút)'.
VARIABLE LABELS T_SOAN_EXACT 'Thời gian soạn có số phút cụ thể (phút)'.
VARIABLE LABELS T_SOAN_KIND 'Dạng thông tin thời gian'.
VARIABLE LABELS TY_LE_SUA 'Tỉ lệ phải chỉnh sửa KHBD (mức thứ bậc)'.
VARIABLE LABELS LOI_AO_GIAC 'Phát hiện ngữ liệu sai lệch / ảo giác'.
VARIABLE LABELS LOI_AO_TYPE 'Chi tiết phương án lỗi ngữ liệu theo câu trả lời gốc'.
VARIABLE LABELS SP1 'SP1: Cấu trúc KHBD phân định rõ 4 pha sư phạm và chia bảng 2 cột GV - HS chuẩn CV 2345.'.
VARIABLE LABELS SP2 'SP2: Mục tiêu (YCCĐ) được xác định chính xác theo 3 thành tố: Năng lực đặc thù, chung và phẩm chất.'.
VARIABLE LABELS SP3 'SP3: Hoạt động Khám phá xây dựng kịch bản rõ nét (câu hỏi gợi mở của GV, thao tác tích cực của HS).'.
VARIABLE LABELS SP4 'SP4: Thời lượng giữa các hoạt động cân đối, khả thi và khớp đúng chuẩn 35 phút/tiết học.'.
VARIABLE LABELS SP5 'SP5: Ngữ liệu bài học bám sát 100% SGK, an toàn sư phạm, không bịa đặt kiến thức ngoài chương trình.'.
VARIABLE LABELS TAM1 'TAM1 (Hữu ích): Nâng cao đáng kể năng suất và chất lượng bản thảo giáo án so với trước đây.'.
VARIABLE LABELS TAM2 'TAM2 (Dễ dùng): Giao diện trực quan, thao tác nhập liệu bán tự động và nhận diện ảnh dễ dàng.'.
VARIABLE LABELS TAM3 'TAM3 (Tải nhận thức): Giảm tải tối đa áp lực tra cứu tài liệu, giảm căng thẳng và mệt mỏi tinh thần.'.
VARIABLE LABELS TAM4 'TAM4 (Định dạng): File văn bản xuất Word chuẩn thể thức in ấn, giữ đúng định dạng bảng biểu.'.
VARIABLE LABELS TAM5 'TAM5 (Nghiệp vụ): Là công cụ hỗ trợ hữu ích giúp giảm tải thời gian soạn và chuẩn bị KHBD'.
VARIABLE LABELS YD1 'YD1 (Tự tin): Tôi cảm thấy tự tin và an tâm về tính khả thi khi mang KHBD này lên lớp thực tế.'.
VARIABLE LABELS YD2 'YD2 (Ý định): Tôi có ý định tiếp tục sử dụng phương thức/công cụ này thường xuyên để soạn bài.'.
VARIABLE LABELS YD3 'YD3 (Khuyến nghị): Tôi sẵn sàng chia sẻ và khuyến nghị đồng nghiệp, sinh viên sư phạm cùng ứng dụng.'.
VARIABLE LABELS YK_TEXT 'Khó khăn lớn nhất / đề xuất (nguyên văn)'.

VALUE LABELS NHOM
  1 'Nhóm thực nghiệm - dùng EduPlan AI'
  2 'Nhóm đối chứng - phương thức thông thường/AI đại trà'.
VALUE LABELS DOI_TUONG
  1 'Giáo viên tiểu học'
  2 'Sinh viên Giáo dục Tiểu học'.
VALUE LABELS KHOI_SG
  1 'Lớp 1'
  2 'Lớp 2'
  3 'Lớp 3'
  4 'Lớp 4'
  5 'Lớp 5'.
VALUE LABELS BAI
  1 'TV1 Bài 31 an/ăn/ân'
  2 'TV2 Bài 1 Tôi là học sinh lớp 2'
  3 'TV3 Bài 1 Ngày khai trường'
  4 'TV4 Bài 1 Điều kì diệu'
  5 'TV5 Bài 1 Khởi đầu mới'.
VALUE LABELS T_SOAN_KIND
  1 'Số phút cụ thể'
  2 'Khoảng kín a-b phút'
  3 'Khoảng mở Trên x phút'.
VALUE LABELS TY_LE_SUA
  1 'Dưới 10%'
  2 '10-30%'
  3 '31-50%'
  4 'Trên 50%'.
VALUE LABELS LOI_AO_GIAC
  0 'Không phát hiện'
  1 'Có phát hiện'.
VALUE LABELS LOI_AO_TYPE
  0 'Không phát hiện'
  1 'Có, không rõ tần suất'
  2 'Có, xuất hiện ít'.
VALUE LABELS SP1
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS SP2
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS SP3
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS SP4
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS SP5
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS TAM1
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS TAM2
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS TAM3
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS TAM4
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS TAM5
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS YD1
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS YD2
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VALUE LABELS YD3
  1 'Rất không đồng ý'
  2 'Không đồng ý'
  3 'Phân vân'
  4 'Đồng ý'
  5 'Rất đồng ý'.
VARIABLE LEVEL NHOM DOI_TUONG BAI T_SOAN_KIND LOI_AO_GIAC LOI_AO_TYPE (NOMINAL).
VARIABLE LEVEL KHOI_GOC KHOI_SG TY_LE_SUA SP1 SP2 SP3 SP4 SP5 TAM1 TAM2 TAM3 TAM4 TAM5 YD1 YD2 YD3 (ORDINAL).
VARIABLE LEVEL ROW_SRC TS_EXCEL T_SOAN_LO T_SOAN_HI T_SOAN_EXACT (SCALE).
EXECUTE.

* Kiem tra thong ke co ban DOI_CHIEU.
FREQUENCIES VARIABLES=NHOM DOI_TUONG KHOI_SG BAI T_SOAN_KIND TY_LE_SUA LOI_AO_GIAC LOI_AO_TYPE
 /ORDER=ANALYSIS.
FREQUENCIES VARIABLES=SP1 SP2 SP3 SP4 SP5 TAM1 TAM2 TAM3 TAM4 TAM5 YD1 YD2 YD3
 /ORDER=ANALYSIS.
* T_SOAN_LO KHONG la thoi gian chinh xac cua nhung truong hop Tren x.


* Kiem tra so dong va cau truc nhom truoc khi phan tich.
CROSSTABS
 /TABLES=NHOM BY DOI_TUONG
 /CELLS=COUNT ROW.

* Luu dataset SPSS de mo lai trong cac lan phan tich tiep theo.
SAVE OUTFILE='D:\NCKH\Tool\EduPlan AI\CHUẨN KQ KS ĐỐI CHIẾU ĐƯA VÀO SPSS\01_SPSS_DOI_CHIEU_EDUPLAN.sav' /COMPRESSED.
EXECUTE.

* Quan trong: KHONG lay T_SOAN_LO lam so phut thuc te, vi co cau tra loi theo khoang.
* Neu chua co minh chung data thuc nghiem thu duoc that, khong trinh bay nhu ket qua khach the thuc.
