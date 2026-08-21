import { Metadata } from "next";
import Link from "next/link";
import { AuthWrap, AuthCard, AuthTitle, AuthSubtitle, AuthFooter } from "@/styles/styledAuth";

export const metadata: Metadata = {
	title: "Check your email",
};

export default function VerifySentPage() {
	return (
		<AuthWrap>
			<AuthCard>
				<AuthTitle>메일함을 확인해주세요 📮</AuthTitle>
				<AuthSubtitle>
					가입하신 주소로 인증 링크를 보냈어요.<br />
					링크를 누르면 가입이 완료됩니다.
				</AuthSubtitle>
				<AuthFooter>
					인증을 마치셨나요? <Link href="/login">로그인하기</Link>
				</AuthFooter>
			</AuthCard>
		</AuthWrap>
	);
}
