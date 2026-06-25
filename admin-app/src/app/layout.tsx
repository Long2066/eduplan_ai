import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "EduPlan AI Admin",
  description: "Quản trị EduPlan AI",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
