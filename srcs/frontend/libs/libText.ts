import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";

// Errors raised by plain library functions (upload, geolocation, push,
// network) that run outside React and cannot use the translator. In the
// browser the page's <html lang> gives the language; on the server they
// fall back to Korean.
const TEXT = {
	ko: {
		server: "서버에 연결하지 못했어요.",
		tooMany: "사진은 최대 {max}장까지 올릴 수 있어요.",
		tooBig: "사진은 한 장에 5MB 이하여야 해요.",
		uploadFailed: "이미지 업로드에 실패했어요.",
		uploadFormat: "이미지 업로드에 실패했어요. jpg/png/gif/webp만 가능해요.",
		loginNeeded: "로그인이 필요해요.",
		map: "지도 서비스에 연결하지 못했어요.",
		noGeolocation: "이 브라우저는 위치 확인을 지원하지 않아요.",
		position: "현재 위치를 가져오지 못했어요. 위치 권한을 확인해주세요.",
		pushNotReady: "푸시 알림이 아직 준비되지 않았어요.",
		pushBlocked: "브라우저에서 알림이 차단되어 있어요. 사이트 설정에서 허용해주세요.",
		pushRegister: "이 기기를 등록하지 못했어요.",
	},
	fr: {
		server: "Impossible de joindre le serveur.",
		tooMany: "{max} photos maximum.",
		tooBig: "Chaque photo doit faire 5 Mo au plus.",
		uploadFailed: "L'envoi des photos a échoué.",
		uploadFormat: "L'envoi a échoué. Formats acceptés : jpg, png, gif, webp.",
		loginNeeded: "Vous devez être connecté.",
		map: "Impossible de joindre le service de cartes.",
		noGeolocation: "Ce navigateur ne permet pas la géolocalisation.",
		position: "Impossible d'obtenir votre position. Vérifiez l'autorisation de localisation.",
		pushNotReady: "Les notifications push ne sont pas encore disponibles.",
		pushBlocked: "Les notifications sont bloquées dans le navigateur. Autorisez-les dans les réglages du site.",
		pushRegister: "Impossible d'enregistrer cet appareil.",
	},
	en: {
		server: "Couldn't reach the server.",
		tooMany: "Up to {max} photos.",
		tooBig: "Each photo must be 5 MB or less.",
		uploadFailed: "The photo upload failed.",
		uploadFormat: "The upload failed. Only jpg, png, gif and webp work.",
		loginNeeded: "You need to log in.",
		map: "Couldn't reach the map service.",
		noGeolocation: "This browser can't share your location.",
		position: "Couldn't get your location. Check the location permission.",
		pushNotReady: "Push notifications aren't available yet.",
		pushBlocked: "Notifications are blocked in your browser. Allow them in the site settings.",
		pushRegister: "Couldn't register this device.",
	},
} satisfies Record<Locale, Record<string, string>>;

export type LibTextKey = keyof (typeof TEXT)["ko"];

function pageLocale(): Locale {
	const lang = typeof document === "undefined" ? "" : document.documentElement.lang;
	return isLocale(lang) ? lang : DEFAULT_LOCALE;
}

export function libText(key: LibTextKey, values: Record<string, string | number> = {}): string {
	return TEXT[pageLocale()][key].replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
}
