import { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/form/SignUpForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthCard, FormFooter } from "@/styles/styledForm";

export const metadata: Metadata = {
	title: "회원가입",
};

export default function AccountSignUpPage() {
	return (
		<AuthCard>
			<h1>회원가입</h1>
			<p>잇냥에서 파리 한인들과 물건을 사고팔아요.</p>
			<GoogleButton label="Google로 시작하기" />
			<SignUpForm />
			<FormFooter>
				이미 계정이 있나요? <Link href="/login">로그인</Link>
			</FormFooter>
		</AuthCard>
	);
}
