import type { Metadata } from "next";
import { Lora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const lora = Lora({
	subsets: ["latin"],
	variable: "--font-lora",
	display: "swap",
	weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
	title: "QuestMaster",
	description: "A D&D-themed task management agent",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en" className={lora.variable}>
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className="antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
