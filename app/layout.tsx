import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omaha Team Manager",
  description: "Gestão de resultados e rake do time de Omaha",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
