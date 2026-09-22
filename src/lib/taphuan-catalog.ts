import type { ElementaryGrade } from "@/lib/subject-catalog";

export const UNIFIED_BOOK_LABEL = "Bộ sách Thống nhất";
export const TAPHUAN_SOURCE_LABEL = "taphuan.nxbgd.vn";
export const TAPHUAN_COPYRIGHT_LABEL = "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)";

export type TaphuanTextbook = {
  key: string;
  grade: ElementaryGrade;
  subject: string;
  volume?: "Tập một" | "Tập hai";
  title: string;
  readerUrl: string;
  source: typeof TAPHUAN_SOURCE_LABEL;
  copyright: typeof TAPHUAN_COPYRIGHT_LABEL;
};

export const taphuanCatalog: TaphuanTextbook[] = [
  {
    "key": "lop-1-tieng-viet-tap-1",
    "grade": "Lớp 1",
    "subject": "Tiếng Việt",
    "volume": "Tập một",
    "title": "SGK Tiếng Việt 1, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-1-tap-mot.4695822132",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-tieng-viet-tap-2",
    "grade": "Lớp 1",
    "subject": "Tiếng Việt",
    "volume": "Tập hai",
    "title": "SGK Tiếng Việt 1, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-1-tap-hai.4698214319",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-toan-tap-1",
    "grade": "Lớp 1",
    "subject": "Toán",
    "volume": "Tập một",
    "title": "SGK Toán 1, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-1-tap-mot.4698216815",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-toan-tap-2",
    "grade": "Lớp 1",
    "subject": "Toán",
    "volume": "Tập hai",
    "title": "SGK Toán 1, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-1-tap-hai.4712748878",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-tu-nhien-va-xa-hoi",
    "grade": "Lớp 1",
    "subject": "Tự nhiên và Xã hội",
    "title": "SGK Tự nhiên và Xã hội 1",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tu-nhien-va-xa-hoi-1.4698227889",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-dao-duc",
    "grade": "Lớp 1",
    "subject": "Đạo đức",
    "title": "SGK Đạo đức 1",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-dao-duc-1.4698230722",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-am-nhac",
    "grade": "Lớp 1",
    "subject": "Âm nhạc",
    "title": "SGK Âm nhạc 1",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-am-nhac-1.4698234437",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-mi-thuat",
    "grade": "Lớp 1",
    "subject": "Mĩ thuật",
    "title": "SGK Mĩ thuật 1",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-mi-thuat-1.4698235425",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-hoat-dong-trai-nghiem",
    "grade": "Lớp 1",
    "subject": "Hoạt động trải nghiệm",
    "title": "SGK Hoạt động trải nghiệm 1",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoat-dong-trai-nghiem-1.4698574271",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-1-giao-duc-the-chat",
    "grade": "Lớp 1",
    "subject": "Giáo dục thể chất",
    "title": "SGK Giáo dục thể chất 1",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-giao-duc-the-chat-1.4698581785",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-tieng-viet-tap-1",
    "grade": "Lớp 2",
    "subject": "Tiếng Việt",
    "volume": "Tập một",
    "title": "SGK Tiếng Việt 2, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-2-tap-mot.4698590737",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-tieng-viet-tap-2",
    "grade": "Lớp 2",
    "subject": "Tiếng Việt",
    "volume": "Tập hai",
    "title": "SGK Tiếng Việt 2, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-2-tap-hai.4698600732",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-toan-tap-1",
    "grade": "Lớp 2",
    "subject": "Toán",
    "volume": "Tập một",
    "title": "SGK Toán 2, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-2-tap-mot.4698648594",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-toan-tap-2",
    "grade": "Lớp 2",
    "subject": "Toán",
    "volume": "Tập hai",
    "title": "SGK Toán 2, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-2-tap-hai.4713893812",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-tu-nhien-va-xa-hoi",
    "grade": "Lớp 2",
    "subject": "Tự nhiên và Xã hội",
    "title": "SGK Tự nhiên và Xã hội 2",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tu-nhien-va-xa-hoi-2.4698656504",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-dao-duc",
    "grade": "Lớp 2",
    "subject": "Đạo đức",
    "title": "SGK Đạo đức 2",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-dao-duc-2.4698659171",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-am-nhac",
    "grade": "Lớp 2",
    "subject": "Âm nhạc",
    "title": "SGK Âm nhạc 2",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-am-nhac-2.4698663453",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-mi-thuat",
    "grade": "Lớp 2",
    "subject": "Mĩ thuật",
    "title": "SGK Mĩ thuật 2",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-mi-thuat-2.4698668259",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-hoat-dong-trai-nghiem",
    "grade": "Lớp 2",
    "subject": "Hoạt động trải nghiệm",
    "title": "SGK Hoạt động trải nghiệm 2",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoat-dong-trai-nghiem-2.4698673621",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-2-giao-duc-the-chat",
    "grade": "Lớp 2",
    "subject": "Giáo dục thể chất",
    "title": "SGK Giáo dục thể chất 2",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-giao-duc-the-chat-2.4698675828",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-tieng-viet-tap-1",
    "grade": "Lớp 3",
    "subject": "Tiếng Việt",
    "volume": "Tập một",
    "title": "SGK Tiếng Việt 3, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-3-tap-mot.4698680579",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-tieng-viet-tap-2",
    "grade": "Lớp 3",
    "subject": "Tiếng Việt",
    "volume": "Tập hai",
    "title": "SGK Tiếng Việt 3, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-3-tap-hai.4698697436",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-toan-tap-1",
    "grade": "Lớp 3",
    "subject": "Toán",
    "volume": "Tập một",
    "title": "SGK Toán 3, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-3-tap-mot.4698702815",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-toan-tap-2",
    "grade": "Lớp 3",
    "subject": "Toán",
    "volume": "Tập hai",
    "title": "SGK Toán 3, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-3-tap-hai.4714081721",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-tu-nhien-va-xa-hoi",
    "grade": "Lớp 3",
    "subject": "Tự nhiên và Xã hội",
    "title": "SGK Tự nhiên và Xã hội 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tu-nhien-va-xa-hoi-3.4698707453",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-dao-duc",
    "grade": "Lớp 3",
    "subject": "Đạo đức",
    "title": "SGK Đạo đức 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-dao-duc-3.4698713497",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-am-nhac",
    "grade": "Lớp 3",
    "subject": "Âm nhạc",
    "title": "SGK Âm nhạc 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-am-nhac-3.4698722151",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-mi-thuat",
    "grade": "Lớp 3",
    "subject": "Mĩ thuật",
    "title": "SGK Mĩ thuật 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-mi-thuat-3.4698724767",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-cong-nghe",
    "grade": "Lớp 3",
    "subject": "Công nghệ",
    "title": "SGK Công nghệ 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-cong-nghe-3.4698732122",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-tin-hoc",
    "grade": "Lớp 3",
    "subject": "Tin học",
    "title": "SGK Tin học 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tin-hoc-3.4698739161",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-hoat-dong-trai-nghiem",
    "grade": "Lớp 3",
    "subject": "Hoạt động trải nghiệm",
    "title": "SGK Hoạt động trải nghiệm 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoat-dong-trai-nghiem-3.4698751308",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-3-giao-duc-the-chat",
    "grade": "Lớp 3",
    "subject": "Giáo dục thể chất",
    "title": "SGK Giáo dục thể chất 3",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-giao-duc-the-chat-3.4698759404",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-tieng-viet-tap-1",
    "grade": "Lớp 4",
    "subject": "Tiếng Việt",
    "volume": "Tập một",
    "title": "SGK Tiếng Việt 4, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-4-tap-mot.4698846675",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-tieng-viet-tap-2",
    "grade": "Lớp 4",
    "subject": "Tiếng Việt",
    "volume": "Tập hai",
    "title": "SGK Tiếng Việt 4, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-4-tap-hai.4698852686",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-toan-tap-1",
    "grade": "Lớp 4",
    "subject": "Toán",
    "volume": "Tập một",
    "title": "SGK Toán 4, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-4-tap-mot.4714093295",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-toan-tap-2",
    "grade": "Lớp 4",
    "subject": "Toán",
    "volume": "Tập hai",
    "title": "SGK Toán 4, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-4-tap-hai.4698870230",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-khoa-hoc",
    "grade": "Lớp 4",
    "subject": "Khoa học",
    "title": "SGK Khoa học 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-khoa-hoc-4.4698873264",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-dao-duc",
    "grade": "Lớp 4",
    "subject": "Đạo đức",
    "title": "SGK Đạo đức 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-dao-duc-4.4698882156",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-am-nhac",
    "grade": "Lớp 4",
    "subject": "Âm nhạc",
    "title": "SGK Âm nhạc 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-am-nhac-4.4698889466",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-mi-thuat",
    "grade": "Lớp 4",
    "subject": "Mĩ thuật",
    "title": "SGK Mĩ thuật 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-mi-thuat-4.4698896486",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-cong-nghe",
    "grade": "Lớp 4",
    "subject": "Công nghệ",
    "title": "SGK Công nghệ 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-cong-nghe-4.4698906593",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-lich-su-va-dia-li",
    "grade": "Lớp 4",
    "subject": "Lịch sử và Địa lí",
    "title": "SGK Lịch sử và Địa lí 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-lich-su-va-dia-li-4.4756030172",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-tin-hoc",
    "grade": "Lớp 4",
    "subject": "Tin học",
    "title": "SGK Tin học 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tin-hoc-4.4698914396",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-4-hoat-dong-trai-nghiem",
    "grade": "Lớp 4",
    "subject": "Hoạt động trải nghiệm",
    "title": "SGK Hoạt động trải nghiệm 4",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoat-dong-trai-nghiem-4.4698921153",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-tieng-viet-tap-1",
    "grade": "Lớp 5",
    "subject": "Tiếng Việt",
    "volume": "Tập một",
    "title": "SGK Tiếng Việt 5, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-5-tap-mot.4699740998",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-tieng-viet-tap-2",
    "grade": "Lớp 5",
    "subject": "Tiếng Việt",
    "volume": "Tập hai",
    "title": "SGK Tiếng Việt 5, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tieng-viet-5-tap-hai.4699750731",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-toan-tap-1",
    "grade": "Lớp 5",
    "subject": "Toán",
    "volume": "Tập một",
    "title": "SGK Toán 5, tập một",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-5-tap-mot.4699756373",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-toan-tap-2",
    "grade": "Lớp 5",
    "subject": "Toán",
    "volume": "Tập hai",
    "title": "SGK Toán 5, tập hai",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-5-tap-hai.4714103431",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-khoa-hoc",
    "grade": "Lớp 5",
    "subject": "Khoa học",
    "title": "SGK Khoa học 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-khoa-hoc-5.4699767702",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-dao-duc",
    "grade": "Lớp 5",
    "subject": "Đạo đức",
    "title": "SGK Đạo đức 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-dao-duc-5.4699777693",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-am-nhac",
    "grade": "Lớp 5",
    "subject": "Âm nhạc",
    "title": "SGK Âm nhạc 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-am-nhac-5.4699781141",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-mi-thuat",
    "grade": "Lớp 5",
    "subject": "Mĩ thuật",
    "title": "SGK Mĩ thuật 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-mi-thuat-5.4699804883",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-cong-nghe",
    "grade": "Lớp 5",
    "subject": "Công nghệ",
    "title": "SGK Công nghệ 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-cong-nghe-5.4699808744",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-lich-su-va-dia-li",
    "grade": "Lớp 5",
    "subject": "Lịch sử và Địa lí",
    "title": "SGK Lịch sử và Địa lí 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-lich-su-va-dia-li-5.4843863100",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-tin-hoc",
    "grade": "Lớp 5",
    "subject": "Tin học",
    "title": "SGK Tin học 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-tin-hoc-5.4699814459",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  },
  {
    "key": "lop-5-hoat-dong-trai-nghiem",
    "grade": "Lớp 5",
    "subject": "Hoạt động trải nghiệm",
    "title": "SGK Hoạt động trải nghiệm 5",
    "readerUrl": "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-hoat-dong-trai-nghiem-5.4699823204",
    "source": "taphuan.nxbgd.vn",
    "copyright": "Nhà xuất bản Giáo dục Việt Nam (NXBGDVN)"
  }
];

export function findTaphuanBook(
  grade: string,
  subject: string,
  volume?: string,
): TaphuanTextbook | null {
  if (!grade || !subject) return null;
  const matches = taphuanCatalog.filter((item) => item.grade === grade && item.subject === subject);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  if (volume && volume !== "auto" && volume !== "Auto") {
    const volMatch = matches.find((item) => item.volume === volume);
    if (volMatch) return volMatch;
  }
  return matches[0];
}

export function getTaphuanBookByKey(key: string): TaphuanTextbook | null {
  return taphuanCatalog.find((item) => item.key === key) || null;
}
