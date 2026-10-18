// Facts the legal pages (terms, privacy policy, legal notice) depend on.
// Fill in OPERATOR before launch: empty values are shown on the pages as
// a highlighted "입력 필요 / à compléter" placeholder. Changing what the
// documents say means a new LEGAL_VERSION (and the same value as
// TermsVersion in srcs/server/loginserver/signuphandler).

export const LEGAL_VERSION = "2026-10-18";

export const OPERATOR = {
	// Person or company running the site (éditeur). For an individual:
	// full name; for a company: legal name and form (e.g. "SAS ...").
	name: "",
	// Postal address (siège social, or the individual's address).
	address: "",
	email: "",
	phone: "",
	// Companies: RCS / SIREN number. Leave empty for an individual.
	registration: "",
	// Directeur de la publication (usually the operator or its legal
	// representative) and the person in charge of personal data
	// (개인정보 보호책임자).
	publicationDirector: "",
	privacyOfficer: "",
};

// Hosting (hébergeur) and processors, as deployed (deploy/README.md).
export const HOST = {
	name: "Amazon Web Services EMEA SARL",
	address: "38 avenue John F. Kennedy, L-1855 Luxembourg",
	// Check on AWS's legal pages before launch.
	phone: "",
	website: "https://aws.amazon.com",
	region: "eu-west-3 (Paris, France)",
};

// Age from which one can sign up alone: 15 under French law (consent to
// data processing), which also covers Korea's 14.
export const MIN_AGE = 15;

// How long the records of deleted content and of members who left are
// kept (graphqlhandler.RecordRetention), and notifications.
export const RECORD_RETENTION = { ko: "1년", fr: "un an" };
export const NOTIFICATION_RETENTION = { ko: "90일", fr: "90 jours" };

export type LegalLang = "ko" | "fr";

export function legalLang(v?: string): LegalLang {
	return v === "fr" ? "fr" : "ko";
}

// Dates as written in each language, e.g. "2026년 10월 17일" / "17 octobre 2026".
export function legalDate(lang: LegalLang): string {
	const [y, m, d] = LEGAL_VERSION.split("-").map(Number);
	if (lang === "ko") return `${y}년 ${m}월 ${d}일`;
	const months = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
	return `${d} ${months[m - 1]} ${y}`;
}
