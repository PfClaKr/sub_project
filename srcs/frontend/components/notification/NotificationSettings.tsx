'use client';

import { useEffect, useState } from "react";
import { BellRing, Mail } from "lucide-react";
import { gql } from "@/libs/graphql";
import { currentSubscription, detectPushSupport, disablePush, enablePush, type PushSupport } from "@/libs/push";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { FormSection, Hint } from "@/styles/styledForm";
import { ErrorText, GhostButton, Muted, Skeleton } from "@/styles/styledUi";
import { SettingsTable } from "@/styles/styledNotification";
import { useTranslations } from "next-intl";

type Item = { Type: string; Label: string; Email: string; Push: boolean };
type Settings = { EmailEnabled: boolean; HasEmail: boolean; Items: Item[] };

const FIELDS = `EmailEnabled HasEmail Items { Type Label Email Push }`;

const EMAIL_MODES = [
	{ value: "immediate" },
	{ value: "digest" },
	{ value: "off" },
];

function DevicePush() {
	const t = useTranslations("notifications");
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
	if (support === "unsupported") return <Muted as="p">{t("pushUnsupported")}</Muted>;
	if (support === "needs-install") {
		return <Muted as="p">{t("pushInstall")}</Muted>;
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
				? t("pushServiceError")
				: t("pushError"));
		} finally {
			setBusy(false);
		}
	};
	return (
		<div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
			<button type="button" onClick={toggle} disabled={busy} aria-pressed={on}>
				{busy ? t("working") : on ? t("pushOff") : t("pushOn")}
			</button>
			<Muted>{on ? t("pushOnNote") : t("pushOffNote")}</Muted>
			{error && <ErrorText role="alert" style={{ width: "100%" }}>{error}</ErrorText>}
		</div>
	);
}

function Form() {
	const t = useTranslations("notifications");
	const label = (it: Item) => (t.has(`settingTypes.${it.Type}`) ? t(`settingTypes.${it.Type}`) : it.Label);
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
					<h2 id="sec-push"><BellRing size={17} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />{t("push")}</h2>
					<p>{t("pushLead")}</p>
				</header>
				<DevicePush />
			</FormSection>

			<FormSection aria-labelledby="sec-email">
				<header>
					<h2 id="sec-email"><Mail size={17} aria-hidden style={{ verticalAlign: -3, marginRight: 6 }} />{t("emailTitle")}</h2>
					<p>{t("emailLead")}</p>
				</header>
				{settings.HasEmail ? (
					<label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15 }}>
						<input type="checkbox" checked={settings.EmailEnabled} onChange={e => save({ ...settings, EmailEnabled: e.target.checked })} style={{ width: "auto" }} />
						{t("emailOn")}
					</label>
				) : (
					<Muted as="p">{t("noEmail")}</Muted>
				)}
			</FormSection>

			<SettingsTable>
				<thead>
					<tr><th>{t("colType")}</th><th>{t("colEmail")}</th><th>{t("colPush")}</th></tr>
				</thead>
				<tbody>
					{settings.Items.map(it => (
						<tr key={it.Type}>
							<td>{label(it)}</td>
							<td>
								<select
									aria-label={t("emailFor", { type: label(it) })}
									value={it.Email}
									disabled={!settings.EmailEnabled || !settings.HasEmail}
									onChange={e => setItem(it.Type, { Email: e.target.value })}
								>
									{EMAIL_MODES.map(m => <option key={m.value} value={m.value}>{t(`email.${m.value}`)}</option>)}
								</select>
							</td>
							<td>
								<input type="checkbox" aria-label={t("pushFor", { type: label(it) })} checked={it.Push} onChange={e => setItem(it.Type, { Push: e.target.checked })} />
							</td>
						</tr>
					))}
				</tbody>
			</SettingsTable>
			<Hint aria-live="polite">{saved ? t("saved") : t("autosave")}</Hint>
			{error && <ErrorText role="alert">{error}</ErrorText>}
		</div>
	);
}

export function NotificationSettings() {
	return <RequireLogin>{() => <Form />}</RequireLogin>;
}
