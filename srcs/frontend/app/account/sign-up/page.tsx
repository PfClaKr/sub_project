import { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/form/SignUpForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthWrap, AuthCard, AuthTitle, AuthSubtitle, AuthFooter } from "@/styles/styledAuth";

export const metadata: Metadata = {
	title: "Sign Up"
}

export default function AccountSignUpPage() {
	return (
		<AuthWrap>
			<AuthCard>
				<AuthTitle>회원가입</AuthTitle>
				<AuthSubtitle>파리 한인 중고거래, 잇냥과 함께해요.</AuthSubtitle>
				<GoogleButton label="Google로 시작하기" />
				<SignUpForm />
				<AuthFooter>
					이미 계정이 있으신가요? <Link href="/login">로그인</Link>
				</AuthFooter>
			</AuthCard>
		</AuthWrap>
	);
}
