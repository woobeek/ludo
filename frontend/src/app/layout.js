import "./globals.css";

export const metadata = {
  title: "$LUDO Casino | Web3 Luxury",
  description: "Web3 Casino purely on Solana",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Syncopate:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
