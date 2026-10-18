'use client';

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLabels } from "@/libs/labels";
import {
	EMPLOYMENT_TYPES, HOUSING_KINDS, JOB_LANGUAGES, JOB_SECTORS, LISTING_MODES, MAX_LISTING_IMAGES, REGIONS, type ListingType,
} from "@/libs/constants";
import { gql } from "@/libs/graphql";
import { uploadImages } from "@/libs/upload";
import { LISTING_PATH } from "@/libs/listing";
import { useRegion } from "@/libs/region";
import { useSession } from "@/libs/session";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { RequireLogin } from "@/components/ui/RequireLogin";
import { ImageUploader, photoFromUrl, type Photo } from "@/components/form/ImageUploader";
import { LocationField, type LocationState } from "@/components/form/LocationField";
import { Adorned, Counter, FieldLabel, FormColumn, FormSection, Hint, SubmitButton, TwoColumns } from "@/styles/styledForm";
import { ErrorText } from "@/styles/styledUi";
import { Segmented } from "@/styles/styledLocation";
import { CheckRow } from "@/styles/styledListing";
import type { Post } from "@/libs/types";

type Result = { Post: { PostId: string } | null; Warnings: string[] };

const today = () => new Date().toISOString().slice(0, 10);

// ListingForm writes a housing or job post, or edits one when `post` is
// given. Risky text (contacts, prepayment) is never refused: the author
// sees why it is risky and confirms.
export function ListingForm({ type, post }: { type: ListingType; post?: Post }) {
	const t = useTranslations("listing.form");
	const c = useTranslations("common");
	const L = useLabels();
	const router = useRouter();
	const confirm = useConfirm();
	const { session } = useSession();
	const { city } = useRegion();
	const h = post?.Housing;
	const j = post?.Job;

	const [mode, setMode] = useState<string>(h?.Mode ?? j?.Mode ?? LISTING_MODES[type][0].value);
	const [kind, setKind] = useState(post?.Topic ?? "");
	const [title, setTitle] = useState(post?.Title ?? "");
	const [body, setBody] = useState(post?.Body ?? "");
	const [region, setRegion] = useState(post?.City ?? "");
	const [photos, setPhotos] = useState<Photo[]>(() => (post?.Images ?? []).map(photoFromUrl));
	const [location, setLocation] = useState<LocationState>(() => ({
		label: post?.AreaName ?? "",
		point: post?.Latitude && post?.Longitude ? { lat: post.Latitude, lng: post.Longitude } : null,
		exact: type === "job" && !!post?.ExactLocation,
		area: null,
		areaId: post?.AreaId,
	}));
	// Housing
	const [rent, setRent] = useState(h?.Rent?.toString() ?? "");
	const [charges, setCharges] = useState(!!h?.ChargesIncluded);
	const [deposit, setDeposit] = useState(h?.Deposit?.toString() ?? "");
	const [from, setFrom] = useState(h?.AvailableFrom ?? "");
	const [end, setEnd] = useState(h?.EndDate ?? "");
	const [minMonths, setMinMonths] = useState(h?.MinMonths?.toString() ?? "");
	const [size, setSize] = useState(h?.Size?.toString() ?? "");
	const [rooms, setRooms] = useState(h?.Rooms?.toString() ?? "");
	const [furnished, setFurnished] = useState(!!h?.Furnished);
	const [caf, setCaf] = useState(!!h?.Caf);
	const [pets, setPets] = useState(!!h?.Pets);
	const [pledge, setPledge] = useState(!!post);
	// Job
	const [employment, setEmployment] = useState(j?.Employment ?? "");
	const [wageType, setWageType] = useState<string>(j?.WageType ?? "hourly");
	const [wage, setWage] = useState(j?.Wage?.toString() ?? "");
	const [schedule, setSchedule] = useState(j?.Schedule ?? "");
	const [permit, setPermit] = useState(!!j?.PermitRequired);
	const [languages, setLanguages] = useState<string[]>(j?.Languages ?? ["한국어"]);
	const [phone, setPhone] = useState("");
	const [email, setEmail] = useState("");

	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		if (region) return;
		const fallback = city || session?.Residence || "";
		if ((REGIONS as readonly string[]).includes(fallback)) setRegion(fallback);
	}, [city, session?.Residence, region]);

	const offering = type === "housing" && mode === "offer";
	const hiring = type === "job" && mode === "hiring";
	const kinds = type === "housing" ? HOUSING_KINDS : JOB_SECTORS;

	const buildInput = (images: string[]) => {
		const input: Record<string, unknown> = {
			Type: type, Title: title, Body: body, City: region || null, Images: images,
			Latitude: location.point?.lat, Longitude: location.point?.lng, ExactLocation: type === "job" && location.exact,
		};
		const optNum = (v: string) => (v.trim() === "" ? null : Number(v));
		if (type === "housing") {
			input.Housing = {
				Mode: mode, Kind: kind, Rent: Number(rent), ChargesIncluded: charges, Deposit: optNum(deposit),
				AvailableFrom: from, EndDate: end || null, MinMonths: optNum(minMonths), Size: optNum(size), Rooms: optNum(rooms),
				Furnished: furnished, Caf: caf, Pets: pets,
			};
		} else {
			input.Job = {
				Mode: mode, Sector: kind, Employment: employment, WageType: wageType,
				Wage: wageType === "negotiable" ? null : optNum(wage), Schedule: schedule || null, PermitRequired: permit, Languages: languages,
			};
			if (hiring && (phone.trim() || email.trim())) input.Contact = { Phone: phone.trim() || null, Email: email.trim() || null };
		}
		return input;
	};

	const send = async (input: Record<string, unknown>, ack: boolean) => {
		if (post) {
			const r = await gql<{ updateListing: Result }>(
				`mutation($id: String!, $in: ListingInput!, $ack: Boolean) { updateListing(PostId: $id, Input: $in, Acknowledge: $ack) { Warnings Post { PostId } } }`,
				{ id: post.PostId, in: input, ack },
			);
			return { result: r.data?.updateListing, error: r.error };
		}
		const r = await gql<{ createListing: Result }>(
			`mutation($in: ListingInput!, $ack: Boolean) { createListing(Input: $in, Acknowledge: $ack) { Warnings Post { PostId } } }`,
			{ in: input, ack },
		);
		return { result: r.data?.createListing, error: r.error };
	};

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		setError("");
		if (!(kinds as readonly string[]).includes(kind)) return setError(t(type === "housing" ? "chooseKind" : "chooseSector"));
		if (!location.point) return setError(t("choosePlace"));
		if (offering && photos.length === 0) return setError(t("needPhoto"));
		if (offering && !pledge) return setError(t("needPledge"));
		setSubmitting(true);
		try {
			// Upload once; a confirmation round trip reuses the URLs.
			const uploaded = await uploadImages(photos.flatMap(p => (p.file ? [p.file] : [])));
			let next = 0;
			const images = photos.map(p => (p.file ? uploaded[next++] : p.url));
			setPhotos(images.map(photoFromUrl));
			const input = buildInput(images);

			let { result, error } = await send(input, false);
			if (result && !result.Post && result.Warnings.length > 0) {
				const message = result.Warnings.map(code => `• ${L.warning(code).title}\n${L.warning(code).text}`).join("\n\n");
				const ok = await confirm({
					title: t("checkTitle"),
					message: `${message}\n\n${t("checkFooter")}`,
					confirmLabel: t("postAnyway"),
					cancelLabel: t("fix"),
					danger: true,
				});
				if (!ok) return;
				({ result, error } = await send(input, true));
			}
			if (!result?.Post) {
				setError(error ?? c("saveError"));
				return;
			}
			router.push(`${LISTING_PATH[type]}/${result.Post.PostId}`);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : c("saveError"));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={submit} style={{ maxWidth: 720 }}>
			<FormSection aria-labelledby="sec-kind">
				<header><h2 id="sec-kind">{t("whatKind")}</h2></header>
				<Segmented role="group" aria-label={t("modes")}>
					{LISTING_MODES[type].map(m => (
						<button key={m.value} type="button" aria-pressed={mode === m.value} disabled={!!post} onClick={() => setMode(m.value)}>{L.mode(type, m.value)}</button>
					))}
				</Segmented>
				<TwoColumns>
					<FieldLabel>{t(type === "housing" ? "kind" : "sector")}
						<select value={kind} required onChange={e => setKind(e.target.value)}>
							<option value="" disabled>{c("choose")}</option>
							{kinds.map(k => <option key={k} value={k}>{L.enum(type === "housing" ? "housingKind" : "jobSector", k)}</option>)}
						</select>
					</FieldLabel>
					<FieldLabel>{c("region")} <Hint>{c("regionHint")}</Hint>
						<select value={region} onChange={e => setRegion(e.target.value)}>
							{REGIONS.map(r => <option key={r} value={r}>{L.enum("region", r)}</option>)}
						</select>
					</FieldLabel>
				</TwoColumns>
			</FormSection>

			{type === "housing" ? (
				<FormSection aria-labelledby="sec-terms">
					<header>
						<h2 id="sec-terms">{t("terms")}</h2>
						{!offering && <p>{t("seekTip")}</p>}
					</header>
					<TwoColumns>
						<FieldLabel>{offering ? t("rent") : t("maxRent")}
							<Adorned><span aria-hidden>€</span>
								<input type="number" required min={0} max={20000} inputMode="numeric" value={rent} onChange={e => setRent(e.target.value)} />
							</Adorned>
						</FieldLabel>
						<FieldLabel>{t("deposit")} <Hint>{t("optional")}</Hint>
							<Adorned><span aria-hidden>€</span>
								<input type="number" min={0} max={50000} inputMode="numeric" value={deposit} onChange={e => setDeposit(e.target.value)} />
							</Adorned>
						</FieldLabel>
						<FieldLabel>{t("moveIn")}
							<input type="date" required min={post ? undefined : today()} value={from} onChange={e => setFrom(e.target.value)} />
						</FieldLabel>
						<FieldLabel>{t("endDate")} <Hint>{kind === "서블렛" ? t("endSublet") : t("optional")}</Hint>
							<input type="date" required={kind === "서블렛"} min={from || undefined} value={end} onChange={e => setEnd(e.target.value)} />
						</FieldLabel>
						<FieldLabel>{t("minStay")} <Hint>{t("minStayHint")}</Hint>
							<input type="number" min={1} max={36} inputMode="numeric" value={minMonths} onChange={e => setMinMonths(e.target.value)} />
						</FieldLabel>
						<FieldLabel>{t("sizeRooms")} <Hint>{t("optional")}</Hint>
							<div style={{ display: "flex", gap: 8 }}>
								<input type="number" min={1} max={1000} inputMode="numeric" placeholder="m²" aria-label={t("size")} value={size} onChange={e => setSize(e.target.value)} />
								<input type="number" min={1} max={20} inputMode="numeric" placeholder={t("rooms")} aria-label={t("rooms")} value={rooms} onChange={e => setRooms(e.target.value)} />
							</div>
						</FieldLabel>
					</TwoColumns>
					<CheckRow>
						<label><input type="checkbox" checked={charges} onChange={e => setCharges(e.target.checked)} /> {t("charges")}</label>
						<label><input type="checkbox" checked={furnished} onChange={e => setFurnished(e.target.checked)} /> {t("furnished")}</label>
						<label><input type="checkbox" checked={caf} onChange={e => setCaf(e.target.checked)} /> {t("caf")}</label>
						<label><input type="checkbox" checked={pets} onChange={e => setPets(e.target.checked)} /> {t("pets")}</label>
					</CheckRow>
				</FormSection>
			) : (
				<FormSection aria-labelledby="sec-terms">
					<header><h2 id="sec-terms">{t("jobTerms")}</h2></header>
					<TwoColumns>
						<FieldLabel>{t("employment")}
							<select required value={employment} onChange={e => setEmployment(e.target.value)}>
								<option value="" disabled>{c("choose")}</option>
								{EMPLOYMENT_TYPES.map(e => <option key={e} value={e}>{L.enum("employment", e)}</option>)}
							</select>
						</FieldLabel>
						<FieldLabel>{t("pay")}
							<div style={{ display: "flex", gap: 8 }}>
								<select value={wageType} onChange={e => setWageType(e.target.value)} aria-label={t("payType")} style={{ width: "auto" }}>
									<option value="hourly">{t("hourly")}</option>
									<option value="monthly">{t("monthly")}</option>
									<option value="negotiable">{t("negotiable")}</option>
								</select>
								{wageType !== "negotiable" && (
									<Adorned style={{ flex: 1 }}><span aria-hidden>€</span>
										<input type="number" required min={0} step={0.01} inputMode="decimal" value={wage} onChange={e => setWage(e.target.value)} aria-label={t("amount")} />
									</Adorned>
								)}
							</div>
						</FieldLabel>
					</TwoColumns>
					<FieldLabel>{t("schedule")} <Hint>{t("optional")}</Hint>
						<input type="text" maxLength={200} placeholder={t("schedulePlaceholder")} value={schedule} onChange={e => setSchedule(e.target.value)} />
					</FieldLabel>
					<FieldLabel as="div">{t("languages")}
						<CheckRow>
							{JOB_LANGUAGES.map(l => (
								<label key={l}>
									<input type="checkbox" checked={languages.includes(l)} onChange={e => setLanguages(prev => e.target.checked ? [...prev, l] : prev.filter(x => x !== l))} /> {L.enum("jobLanguage", l)}
								</label>
							))}
						</CheckRow>
					</FieldLabel>
					<CheckRow>
						<label><input type="checkbox" checked={permit} onChange={e => setPermit(e.target.checked)} /> {t("permit")}</label>
					</CheckRow>
					<Hint>{t("discrimination")}</Hint>
					{hiring && !post && (
						<TwoColumns>
							<FieldLabel>{t("phone")} <Hint>{t("phoneHint")}</Hint>
								<input type="tel" maxLength={30} placeholder="06 12 34 56 78" value={phone} onChange={e => setPhone(e.target.value)} />
							</FieldLabel>
							<FieldLabel>{t("email")} <Hint>{t("optional")}</Hint>
								<input type="email" maxLength={100} value={email} onChange={e => setEmail(e.target.value)} />
							</FieldLabel>
						</TwoColumns>
					)}
				</FormSection>
			)}

			<FormSection aria-labelledby="sec-content">
				<header><h2 id="sec-content">{t("about")}</h2></header>
				<FieldLabel>{c("title")}
					<input type="text" required minLength={2} maxLength={100} value={title} onChange={e => setTitle(e.target.value)}
						placeholder={t(type === "housing" ? "titleHousing" : "titleJob")} />
				</FieldLabel>
				<FieldLabel>
					<span className="sr-only">{t("content")}</span>
					<textarea required rows={8} maxLength={5000} value={body} onChange={e => setBody(e.target.value)}
						placeholder={t(type === "housing" ? "bodyHousing" : "bodyJob")} />
					<Counter>{body.length.toLocaleString()} / {(5000).toLocaleString()}</Counter>
				</FieldLabel>
				<ImageUploader photos={photos} onChange={next => setPhotos(next.slice(0, MAX_LISTING_IMAGES))} uploading={submitting} />
				{offering && <Hint>{t("photoTip")}</Hint>}
			</FormSection>

			<FormSection aria-labelledby="sec-place">
				<header><h2 id="sec-place">{t("place")}</h2></header>
				<LocationField
					value={location}
					onChange={setLocation}
					areaOnly={type === "housing"}
					exactHint={t("shopPin")}
				/>
			</FormSection>

			{offering && !post && (
				<CheckRow>
					<label style={{ borderRadius: 8 }}>
						<input type="checkbox" checked={pledge} onChange={e => setPledge(e.target.checked)} />
						{t("pledge")}
					</label>
				</CheckRow>
			)}
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<SubmitButton type="submit" disabled={submitting}>{submitting ? c("saving") : post ? t("update") : t("post")}</SubmitButton>
		</FormColumn>
	);
}

// NewListing is the write page's body: login first, then the form.
export function NewListing({ type }: { type: ListingType }) {
	return <RequireLogin>{() => <ListingForm type={type} />}</RequireLogin>;
}
