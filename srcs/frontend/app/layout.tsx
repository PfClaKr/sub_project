import { Metadata } from "next";
import Navigation from "../components/navigation";
import Footer from "../components/footer";

export const metadata: Metadata = {
  title: {
    template: "%s | itnyang",
    default: "itnyang",
  },
  description: "itnyang test page",
}

export default function RootLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navigation />
		<br/><hr/>
        {children}
		<br/><hr/>
		{/* <Footer /> */}
      </body>
    </html>
  )
}
