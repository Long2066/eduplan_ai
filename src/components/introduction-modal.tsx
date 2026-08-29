"use client";

import React, { useEffect, useState } from "react";

interface IntroductionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IntroductionModal({ isOpen, onClose }: IntroductionModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "team">("general");

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-modal-title"
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <span className="inline-block rounded-md bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-blue-800 uppercase">
              EduPlan AI
            </span>
            <h2 id="intro-modal-title" className="mt-0.5 text-base font-bold text-slate-900">
              THÔNG TIN EDUPLAN AI
            </h2>
          </div>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {/* Tab Sub-navigation Bar */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-2 font-sans text-xs font-bold">
          <button
            type="button"
            className={`mr-2 px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === "general"
                ? "border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("general")}
          >
            GIỚI THIỆU CHUNG
          </button>
          <button
            type="button"
            className={`px-4 py-2.5 border-b-2 transition-colors ${
              activeTab === "team"
                ? "border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setActiveTab("team")}
          >
            ĐỘI NGŨ PHÁT TRIỂN
          </button>
        </div>

        {/* Scrollable Document Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 font-serif text-slate-900 text-base leading-relaxed text-justify">
          {/* TAB 1: GIỚI THIỆU CHUNG VỀ EDUPLAN AI */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <h2 className="text-center font-bold text-lg text-emerald-700 uppercase tracking-wide my-2">
                GIỚI THIỆU CHUNG VỀ EDUPLAN AI
              </h2>

              {/* Mục 1 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-base">
                  1. Đặt vấn đề và Mục tiêu
                </h3>
                <p className="indent-8 text-slate-900">
                  EduPlan AI là công cụ công nghệ hỗ trợ chuyên môn được nghiên cứu và phát triển dành riêng cho giáo viên tiểu học. Công cụ giải quyết bài toán tối ưu hóa thời gian chuẩn bị bài giảng, hỗ trợ giáo viên xây dựng Kế hoạch bài dạy (KHBD) đúng định hướng đổi mới giáo dục, tuân thủ cấu trúc{" "}
                  <span className="text-red-600 font-medium">Công văn 2345/BGDĐT-GDTH</span> và{" "}
                  <span className="text-red-600 font-medium">Chương trình Giáo dục phổ thông 2018</span>.
                </p>
              </div>

              {/* Mục 2 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-base">
                  2. Nguyên lý hoạt động và cấu trúc sư phạm
                </h3>
                <p className="indent-8 text-slate-900">
                  Hệ thống ứng dụng công nghệ trí tuệ nhân tạo (AI) kết hợp kỹ thuật nhận diện quang học (OCR) để đọc và phân tích dữ liệu đầu vào từ ảnh chụp trang sách giáo khoa. EduPlan AI tự động nhận diện tên bài học, xác định trọng tâm kiến thức và khởi tạo tiến trình dạy học gồm 4 hoạt động cốt lõi: <em>Khởi động, Khám phá, Luyện tập và Vận dụng</em>.
                </p>
                <p className="indent-8 text-slate-900">
                  Nội dung kế hoạch bài dạy được tự động cấu trúc dưới dạng kịch bản 2 cột minh bạch, phân định rõ ràng giữa Hoạt động của Giáo viên (hệ thống câu hỏi gợi mở, hướng dẫn tổ chức, dự kiến tình huống) và Hoạt động của Học sinh (tiếp thu, thảo luận, thực hành).
                </p>
              </div>

              {/* Mục 3 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-base">
                  3. Phạm vi áp dụng và Đầu ra tài liệu
                </h3>
                <p className="indent-8 text-slate-900">
                  <strong>Hỗ trợ đa môn học:</strong> Hệ thống tích hợp sẵn bộ kiểm định chất lượng sư phạm cho trọn bộ 12 môn học từ Lớp 1 đến Lớp 5 theo chương trình Kết nối tri thức với cuộc sống.
                </p>
                <p className="indent-8 text-slate-900">
                  <strong>Định dạng tài liệu đầu ra:</strong> Kế hoạch bài dạy được xuất ra dưới dạng tệp tin Microsoft Word (.docx) chuẩn khổ giấy A4, font chữ Times New Roman, lề tiêu chuẩn và bảng biểu native, cho phép giáo viên chỉnh sửa và lưu trữ thuận tiện.
                </p>
              </div>

              {/* Mục 4 */}
              <div className="space-y-1.5">
                <h3 className="font-bold text-slate-900 text-base">
                  4. Định hướng và Phạm vi sử dụng
                </h3>
                <p className="indent-8 text-slate-900">
                  EduPlan AI đóng vai trò là công cụ trợ lý chuyên môn, cung cấp kịch bản gợi ý và khung cấu trúc tham khảo. Giáo viên căn cứ vào đối tượng học sinh, điều kiện cơ sở vật chất thực tế của nhà trường và phương pháp giảng dạy cá nhân để chủ động rà soát, tinh chỉnh nội dung trước khi đưa vào giảng dạy.
                </p>
                <p className="indent-8 text-red-600 italic text-base pt-2">
                  EduPlan AI là công cụ hỗ trợ, không thay thế giáo viên trong công tác soạn bài.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: ĐỘI NGŨ PHÁT TRIỂN */}
          {activeTab === "team" && (
            <div className="space-y-4">
              <h2 className="text-center font-bold text-lg text-emerald-700 uppercase tracking-wide my-2">
                ĐỘI NGŨ PHÁT TRIỂN
              </h2>
              <p className="indent-8 text-slate-900">
                EduPlan AI được nghiên cứu và phát triển bởi nhóm{" "}
                <em>sinh viên ngành Sư phạm Giáo dục Tiểu học thuộc Phân hiệu Đại học Thái Nguyên tại Hà Giang</em>.
              </p>
              <p className="indent-8 text-slate-900">
                Xuất phát từ quá trình học tập, trải nghiệm thực tế giảng dạy và tình yêu đối với nghề sư phạm, nhóm tác giả hướng tới việc ứng dụng giải pháp công nghệ hiện đại nhằm hỗ trợ cộng đồng giáo viên Tiểu học giảm bớt áp lực trong công tác soạn giảng, nâng cao chất lượng chuẩn bị bài dạy và đóng góp tích cực vào tiến trình chuyển đổi số trong giáo dục tiểu học.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-3.5">
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 transition-colors"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
