import Link from "next/link";
import { HOST, OPERATOR, type LegalLang } from "@/libs/legal";
import { Fill } from "./LegalShell";

// Mentions légales (LCEN) and the same facts in Korean.
export function LegalNotice({ lang }: { lang: LegalLang }) {
	const f = (v: string, label: string) => <Fill value={v} lang={lang} label={label} />;
	if (lang === "fr") {
		return (
			<>
				<h2>Éditeur</h2>
				<address>
					{f(OPERATOR.name, "Nom ou dénomination")}<br />
					{f(OPERATOR.address, "Adresse")}<br />
					E-mail : {f(OPERATOR.email, "E-mail")}<br />
					Téléphone : {f(OPERATOR.phone, "Téléphone")}
					{OPERATOR.registration && <><br />Immatriculation : {OPERATOR.registration}</>}
				</address>
				<p>Directeur de la publication : {f(OPERATOR.publicationDirector, "Nom")}</p>

				<h2>Hébergeur</h2>
				<address>
					{HOST.name}<br />
					{HOST.address}<br />
					Téléphone : {f(HOST.phone, "Téléphone")}<br />
					<a href={HOST.website} target="_blank" rel="noopener noreferrer">{HOST.website}</a><br />
					Données hébergées dans la région {HOST.region}.
				</address>

				<h2>Signaler un contenu</h2>
				<p>
					Chaque publication, commentaire, conversation et profil comporte un bouton « Signaler ». Vous pouvez aussi écrire à {f(OPERATOR.email, "E-mail")} en indiquant
					l&apos;adresse de la page et la raison du signalement. Point de contact pour les autorités et les utilisateurs : la même adresse.
				</p>

				<h2>Données personnelles</h2>
				<p>Voir la <Link href="/privacy?lang=fr">politique de confidentialité</Link>.</p>
			</>
		);
	}
	return (
		<>
			<h2>운영자</h2>
			<address>
				{f(OPERATOR.name, "이름 또는 상호")}<br />
				주소: {f(OPERATOR.address, "주소")}<br />
				이메일: {f(OPERATOR.email, "이메일")}<br />
				전화: {f(OPERATOR.phone, "전화번호")}
				{OPERATOR.registration && <><br />등록 번호: {OPERATOR.registration}</>}
			</address>
			<p>발행 책임자: {f(OPERATOR.publicationDirector, "이름")}</p>

			<h2>호스팅</h2>
			<address>
				{HOST.name}<br />
				{HOST.address}<br />
				전화: {f(HOST.phone, "전화번호")}<br />
				<a href={HOST.website} target="_blank" rel="noopener noreferrer">{HOST.website}</a><br />
				데이터 저장 위치: {HOST.region}
			</address>

			<h2>게시물 신고</h2>
			<p>
				모든 글, 댓글, 채팅, 프로필에 &lsquo;신고&rsquo; 버튼이 있습니다. {f(OPERATOR.email, "이메일")}로 페이지 주소와 이유를 적어 보내셔도 됩니다.
				수사기관 등 공공기관의 연락도 같은 주소로 받습니다.
			</p>

			<h2>개인정보</h2>
			<p><Link href="/privacy">개인정보처리방침</Link>을 확인해주세요.</p>
		</>
	);
}
