import "./globals.css";

export const metadata = {
  title: "Website Rating Scanner",
  description: "Audit websites and turn technical quality into a clear score.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
