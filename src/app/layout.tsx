import type { Metadata } from "next";
import { Manrope } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Loja Camisa | Camisas de Time Sob Encomenda",
  description:
    "Camisas premium de time sob encomenda com processo transparente e entrega confiavel.",
  icons: {
    icon: "/gg-favicon.svg",
    shortcut: "/gg-favicon.svg",
    apple: "/gg-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} antialiased`}>{children}</body>
    </html>
  );
}
