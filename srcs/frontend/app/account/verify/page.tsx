import { Metadata } from "next";
import { VerifyResult } from "@/components/auth/VerifyResult";

export const metadata: Metadata = {
	title: "Verify Email",
};

export default function VerifyPage({ searchParams }: { searchParams: { token?: string } }) {
	return <VerifyResult token={searchParams.token} />;
}
