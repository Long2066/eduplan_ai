import type { LessonInput } from "@/types/lesson";
export {
  bookVolumeOptions,
  canonicalSubjectNames,
  gradeOptions,
  knttSubjectCatalogByGrade,
  subjectOptions,
  subjectOptionsByGrade,
  subjectSupportsBookVolume,
} from "@/lib/subject-catalog";

export const defaultLessonInput: LessonInput = {
  subject: "",
  grade: "",
  lessonTitle: "",
  book: "",
  bookVolume: "auto",
  periods: 1,
  duration: 35,
  hometownProvince: "auto",
  localityNote: "",
  studentProfile: "auto",
  teachingEnvironment: "auto",
  facilities: "auto",
  style: "Dạy thật trên lớp",
  specialRequest: "",
  allowAiInference: true,
  uploadedAssets: [],
};

export const bookOptions = [
  "Kết nối tri thức với Cuộc sống",
  "Cánh diều",
  "Chân trời sáng tạo",
  "Khác",
];

export const hometownProvinceOptions = [
  "Tuyên Quang",
  "Lào Cai",
  "Thái Nguyên",
  "Phú Thọ",
  "Bắc Ninh",
  "Hưng Yên",
  "Hải Phòng",
  "Ninh Bình",
  "Quảng Trị",
  "Đà Nẵng",
  "Quảng Ngãi",
  "Gia Lai",
  "Đắk Lắk",
  "Khánh Hòa",
  "Lâm Đồng",
  "Đồng Nai",
  "Tây Ninh",
  "Thành phố Hồ Chí Minh",
  "Đồng Tháp",
  "Vĩnh Long",
  "Cần Thơ",
  "An Giang",
  "Cà Mau",
  "Cao Bằng",
  "Điện Biên",
  "Hà Tĩnh",
  "Lai Châu",
  "Lạng Sơn",
  "Nghệ An",
  "Quảng Ninh",
  "Thanh Hóa",
  "Sơn La",
  "Hà Nội",
  "Huế",
] as const;

export const studentProfileOptions = [
  "Auto",
  "Học sinh vùng núi",
  "Học sinh nông thôn",
  "Học sinh thành thị",
  "Học sinh có học lực không đồng đều",
  "Học sinh khá, giỏi",
  "Học sinh cần hỗ trợ nhiều",
  "Khác",
];

export const teachingEnvironmentOptions = [
  "Auto",
  "Trường thành phố",
  "Trường nông thôn",
  "Trường vùng núi",
  "Điểm trường lẻ",
  "Lớp học đông học sinh",
  "Lớp học ít học sinh",
  "Khác",
];

export const facilityOptions = [
  "TV",
  "Wifi",
  "Máy chiếu",
  "Bảng tương tác",
  "Máy tính giáo viên",
  "Loa",
  "Phiếu học tập",
  "Không có thiết bị trình chiếu",
];

export const styleOptions = [
  "Cơ bản",
  "Dạy thật trên lớp",
  "Sáng tạo, sinh động",
] as const;
