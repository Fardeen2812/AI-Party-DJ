import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AutoAux — AI Party DJ",
  description: "Next.js App Router AI DJ powered by Gemini 3.8 Flash & YouTube Most Replayed Hook Detection",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#06060b] text-slate-100 antialiased">{children}</body>
    </html>
  );
}
