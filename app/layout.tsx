import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";

// Poppins is not a variable font, so the weights we actually use are listed
// explicitly. Adding a weight here is a deliberate act — see DESIGN.md.
// The variable is named --font-sans because that is what globals.css maps
// --color/--font-sans to in its @theme block.
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Lapse",
    template: "%s · Lapse",
  },
  description:
    "Compliance document expiry monitoring. Upload your permits, registrations and policies; Lapse tracks every expiry date and chases the right person before anything lapses.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
