import type { Metadata } from "next";
import Navigation from "./navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Optics Lab",
  description: "Inquiry-based Class 10 lens experiments and Olympiad problems",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
    >
      <body><Navigation />{children}</body>
    </html>
  );
}
