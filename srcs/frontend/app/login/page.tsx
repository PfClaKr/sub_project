import { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "@/components/form/SignInForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AuthWrap, AuthCard, AuthTitle, AuthSubtitle, AuthFooter } from "@/styles/styledAuth";

export const metadata: Metadata = {
	title: "login"
}

export default function LoginPage() {
	return (
		<AuthWrap>
			<AuthCard>
				<AuthTitle>로그인</AuthTitle>
				<AuthSubtitle>잇냥에 오신 걸 환영해요.</AuthSubtitle>
				<GoogleButton label="Google로 로그인" />
				<Suspense>
					<SignInForm/>
				</Suspense>
				<AuthFooter>
					계정이 없으신가요? <Link href="/account/sign-up">회원가입</Link>
				</AuthFooter>
			</AuthCard>
		</AuthWrap>
	);
}
