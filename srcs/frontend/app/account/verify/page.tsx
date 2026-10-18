import { pageMetadata } from "@/libs/meta";
import { VerifyResult } from "@/components/auth/VerifyResult";

export const generateMetadata = pageMetadata("pages.verify");

export default function VerifyPage({ searchParams }: { searchParams: { token?: string } }) {
	return <VerifyResult token={searchParams.token} />;
}
