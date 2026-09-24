import { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { ResendVerification } from "@/components/auth/ResendVerification";
import { AuthCard, FormFooter } from "@/styles/styledForm";
import palette from "@/theme/colorPalette";

export const metadata: Metadata = {
	title: "메일함을 확인해주세요",
};

export default function VerifySentPage({ searchParams }: { searchParams: { email?: string } }) {
	const email = searchParams.email ?? "";
	return (
		<AuthCard>
			<MailCheck size={40} color={palette.primary} aria-hidden />
			<h1>메일함을 확인해주세요</h1>
			<p>
				{email ? <><strong>{email}</strong>로 </> : "가입하신 주소로 "}
				인증 링크를 보냈어요. 링크를 누르면 가입이 완료돼요.
			</p>
			{email && <ResendVerification email={email} />}
			<FormFooter>
				인증을 마치셨나요? <Link href="/login">로그인하기</Link>
			</FormFooter>
		</AuthCard>
	);
}
