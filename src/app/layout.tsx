import type { Metadata } from "next";
import { FeedbackWidget } from "@/components/feedback-widget";
import "./globals.css";

export const metadata: Metadata = {
  title: "EduPlan AI",
  description: "Tạo kế hoạch bài dạy theo Công văn 2345 bằng AI",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased">
        {children}
        <FeedbackWidget />
      </body>
    </html>
  );
}
