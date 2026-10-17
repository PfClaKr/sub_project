'use client';

import { useEffect, useState } from "react";
import { BellRing, Mail } from "lucide-react";
import { gql } from "@/libs/graphql";
import { currentSubscription, detectPushSupport, disablePush, enablePush, type PushSupport } from "@/libs/push";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { FormSection, Hint } from "@/styles/styledForm";
import { ErrorText, GhostButton, Muted, Skeleton } from "@/styles/styledUi";
import { SettingsTable } from "@/styles/styledNotification";

type Item = { Type: string; Label: string; Email: string; Push: boolean };
type Settings = { EmailEnabled: boolean; HasEmail: boolean; Items: Item[] };

const FIELDS = `EmailEnabled HasEmail Items { Type Label Email Push }`;

const EMAIL_MODES = [
	{ value: "immediate", label: "바로" },
	{ value: "digest", label: "모아서 (15분)" },
	{ value: "off", label: "안 받기" },
];

function DevicePush() {
	const [support, setSupport] = useState<PushSupport | null>(null);
	const [on, setOn] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const s = detectPushSupport();
		setSupport(s);
		if (s === "supported") currentSubscription().then(sub => setOn(!!sub)).catch(() => {});
	}, []);

	if (support === null) return null;
	if (support === "unsupported") return <Muted as="p">이 브라우저는 푸시 알림을 지원하지 않아요.</Muted>;
	if (support === "needs-install") {
		return <Muted as="p">아이폰·아이패드는 Safari 공유 버튼에서 &lsquo;홈 화면에 추가&rsquo;로 잇냥을 설치한 뒤, 설치한 앱에서 푸시를 켤 수 있어요.</Muted>;
	}
	const toggle = async () => {
		setBusy(true);
		setError("");
		try {
			if (on) {
				await disablePush();
				setOn(false);
			} else {
				const err = await enablePush();
				if (err) setError(err);
				else setOn(true);
			}
		} catch (e) {
			// AbortError: the browser could not reach its push service.
			setError(e instanceof DOMException && e.name === "AbortError"
				? "브라우저의 푸시 서비스에 연결하지 못했어요. 잠시 후 다시 시도해주세요."
				: "푸시 설정을 바꾸지 못했어요.");
		} finally {
			setBusy(false);
		}
	};
	return (
		<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
			<button type="button" onClick={toggle} disabled={busy} aria-pressed={on}>
				{busy ? "처리 중..." : on ? "이 기기에서 푸시 끄기" : "이 기기에서 푸시 켜기"}
			</button>
			<Muted>{on ? "이 기기로 푸시 알림이 와요." : "켜면 사이트를 닫아도 알림이 와요."}</Muted>
			{error && <ErrorText role="alert" style={{ width: "100%" }}>{error}</ErrorText>}
		</div>
	);
}

function Form() {
	const [settings, setSettings] = useState<Settings | null>(null);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);

	useEffect(() => {
		gql<{ notifySettings: Settings }>(`{ notifySettings { ${FIELDS} } }`).then(({ data, error }) => {
			if (error) setError(error);
			setSettings(data?.notifySettings ?? null);
		});
	}, []);

	const save = async (next: Settings) => {
		setSettings(next);
		setSaved(false);
		const { data, error } = await gql<{ updateNotifySettings: Settings }>(
			`mutation($e: Boolean, $items: [NotifySettingInput!]) { updateNotifySettings(EmailEnabled: $e, Items: $items) { ${FIELDS} } }`,
			{ e: next.EmailEnabled, items: next.Items.map(({ Type, Email, Push }) => ({ Type, Email, Push })) },
		);
		if (error) return setError(error);
		if (data) setSettings(data.updateNotifySettings);
		setSaved(true);
	};

	if (error && !settings) return <ErrorText>{error}</ErrorText>;
	if (!settings) return <Skeleton $h="320px" />;

	const setItem = (type: string, patch: Partial<Item>) =>
		save({ ...settings, Items: settings.Items.map(it => (it.Type === type ? { ...it, ...patch } : it)) });

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
			<FormSection aria-labelledby="sec-push">
				<header>
					<h2 id="sec-push"><BellRing size={17} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />푸시 알림</h2>
					<p>기기마다 따로 켜요. 아래 표에서 어떤 알림을 푸시로 받을지 고를 수 있어요.</p>
				</header>
				<DevicePush />
			</FormSection>

			<FormSection aria-labelledby="sec-email">
				<header>
					<h2 id="sec-email"><Mail size={17} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />이메일 알림</h2>
					<p>&lsquo;모아서&rsquo;는 15분 동안의 알림을 한 통으로 보내요. 사이트에서 이미 읽은 알림은 메일로 보내지 않아요.</p>
				</header>
				{settings.HasEmail ? (
					<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
						<input type="checkbox" checked={settings.EmailEnabled} onChange={e => save({ ...settings, EmailEnabled: e.target.checked })} style={{ width: "auto" }} />
						이메일 알림 받기
					</label>
				) : (
					<Muted as="p">이메일 주소가 없는 계정이라 메일 알림을 보낼 수 없어요.</Muted>
				)}
			</FormSection>

			<SettingsTable>
				<thead>
					<tr><th>알림</th><th>이메일</th><th>푸시</th></tr>
				</thead>
				<tbody>
					{settings.Items.map(it => (
						<tr key={it.Type}>
							<td>{it.Label}</td>
							<td>
								<select
									aria-label={`${it.Label} 이메일`}
									value={it.Email}
									disabled={!settings.EmailEnabled || !settings.HasEmail}
									onChange={e => setItem(it.Type, { Email: e.target.value })}
								>
									{EMAIL_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
								</select>
							</td>
							<td>
								<input type="checkbox" aria-label={`${it.Label} 푸시`} checked={it.Push} onChange={e => setItem(it.Type, { Push: e.target.checked })} />
							</td>
						</tr>
					))}
				</tbody>
			</SettingsTable>
			<Hint aria-live="polite">{saved ? "저장했어요." : "바꾸면 바로 저장돼요."}</Hint>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</div>
	);
}

export function NotificationSettings() {
	return <RequireLogin>{() => <Form />}</RequireLogin>;
}
