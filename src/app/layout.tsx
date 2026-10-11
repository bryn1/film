import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Filmsidan — upptäck filmer",
  description:
    "Utforska trendiga filmer, aktuella biopremiärer och toppbetygsatta favoriter. Sök fritt eller upptäck efter genre.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" data-theme="dark">
      <body className={inter.className}>
        <Nav />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
