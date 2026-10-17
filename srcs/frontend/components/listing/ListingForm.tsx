'use client';

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
	EMPLOYMENT_TYPES, HOUSING_KINDS, JOB_LANGUAGES, JOB_SECTORS, LISTING_MODES, MAX_LISTING_IMAGES, REGIONS, type ListingType,
} from "@/libs/constants";
import { gql } from "@/libs/graphql";
import { uploadImages } from "@/libs/upload";
import { LISTING_PATH, warningText } from "@/libs/listing";
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
		if (!(kinds as readonly string[]).includes(kind)) return setError(type === "housing" ? "집 형태를 골라주세요." : "업종을 골라주세요.");
		if (!location.point) return setError("지도에서 위치를 골라주세요.");
		if (offering && photos.length === 0) return setError("방 사진을 1장 이상 올려주세요.");
		if (offering && !pledge) return setError("안전 약속에 동의해주세요.");
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
				const message = result.Warnings.map(code => `• ${warningText(code).title}\n${warningText(code).text}`).join("\n\n");
				const ok = await confirm({
					title: "올리기 전에 확인해주세요",
					message: `${message}\n\n그래도 올리면 운영진이 먼저 확인할 수 있어요.`,
					confirmLabel: "그래도 올리기",
					cancelLabel: "수정하기",
					danger: true,
				});
				if (!ok) return;
				({ result, error } = await send(input, true));
			}
			if (!result?.Post) {
				setError(error ?? "저장하지 못했어요. 다시 시도해주세요.");
				return;
			}
			router.push(`${LISTING_PATH[type]}/${result.Post.PostId}`);
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "저장하지 못했어요.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<FormColumn onSubmit={submit} style={{ maxWidth: 720 }}>
			<FormSection aria-labelledby="sec-kind">
				<header><h2 id="sec-kind">어떤 글인가요?</h2></header>
				<Segmented role="group" aria-label="글 종류">
					{LISTING_MODES[type].map(m => (
						<button key={m.value} type="button" aria-pressed={mode === m.value} disabled={!!post} onClick={() => setMode(m.value)}>{m.label}</button>
					))}
				</Segmented>
				<TwoColumns>
					<FieldLabel>{type === "housing" ? "집 형태" : "업종"}
						<select value={kind} required onChange={e => setKind(e.target.value)}>
							<option value="" disabled>선택해주세요</option>
							{kinds.map(k => <option key={k} value={k}>{k}</option>)}
						</select>
					</FieldLabel>
					<FieldLabel>지역 <Hint>지역 필터에 쓰여요</Hint>
						<select value={region} onChange={e => setRegion(e.target.value)}>
							{REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
						</select>
					</FieldLabel>
				</TwoColumns>
			</FormSection>

			{type === "housing" ? (
				<FormSection aria-labelledby="sec-terms">
					<header>
						<h2 id="sec-terms">조건</h2>
						{!offering && <p>구하는 조건을 적어주세요. 월세는 최대 예산이에요.</p>}
					</header>
					<TwoColumns>
						<FieldLabel>{offering ? "월세" : "최대 월세"}
							<Adorned><span aria-hidden>€</span>
								<input type="number" required min={0} max={20000} inputMode="numeric" value={rent} onChange={e => setRent(e.target.value)} />
							</Adorned>
						</FieldLabel>
						<FieldLabel>보증금 <Hint>선택</Hint>
							<Adorned><span aria-hidden>€</span>
								<input type="number" min={0} max={50000} inputMode="numeric" value={deposit} onChange={e => setDeposit(e.target.value)} />
							</Adorned>
						</FieldLabel>
						<FieldLabel>입주 가능일
							<input type="date" required min={post ? undefined : today()} value={from} onChange={e => setFrom(e.target.value)} />
						</FieldLabel>
						<FieldLabel>종료일 <Hint>{kind === "서블렛" ? "서블렛은 필수" : "선택"}</Hint>
							<input type="date" required={kind === "서블렛"} min={from || undefined} value={end} onChange={e => setEnd(e.target.value)} />
						</FieldLabel>
						<FieldLabel>최소 기간 <Hint>개월, 선택</Hint>
							<input type="number" min={1} max={36} inputMode="numeric" value={minMonths} onChange={e => setMinMonths(e.target.value)} />
						</FieldLabel>
						<FieldLabel>면적·방 수 <Hint>선택</Hint>
							<div style={{ display: "flex", gap: 8 }}>
								<input type="number" min={1} max={1000} inputMode="numeric" placeholder="m²" aria-label="면적" value={size} onChange={e => setSize(e.target.value)} />
								<input type="number" min={1} max={20} inputMode="numeric" placeholder="방 수" aria-label="방 수" value={rooms} onChange={e => setRooms(e.target.value)} />
							</div>
						</FieldLabel>
					</TwoColumns>
					<CheckRow>
						<label><input type="checkbox" checked={charges} onChange={e => setCharges(e.target.checked)} /> 관리비 포함</label>
						<label><input type="checkbox" checked={furnished} onChange={e => setFurnished(e.target.checked)} /> 가구 포함</label>
						<label><input type="checkbox" checked={caf} onChange={e => setCaf(e.target.checked)} /> CAF(APL) 신청 가능</label>
						<label><input type="checkbox" checked={pets} onChange={e => setPets(e.target.checked)} /> 반려동물 가능</label>
					</CheckRow>
				</FormSection>
			) : (
				<FormSection aria-labelledby="sec-terms">
					<header><h2 id="sec-terms">근무 조건</h2></header>
					<TwoColumns>
						<FieldLabel>고용 형태
							<select required value={employment} onChange={e => setEmployment(e.target.value)}>
								<option value="" disabled>선택해주세요</option>
								{EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
							</select>
						</FieldLabel>
						<FieldLabel>급여
							<div style={{ display: "flex", gap: 8 }}>
								<select value={wageType} onChange={e => setWageType(e.target.value)} aria-label="급여 방식" style={{ width: "auto" }}>
									<option value="hourly">시급</option>
									<option value="monthly">월급</option>
									<option value="negotiable">협의</option>
								</select>
								{wageType !== "negotiable" && (
									<Adorned style={{ flex: 1 }}><span aria-hidden>€</span>
										<input type="number" required min={0} step={0.01} inputMode="decimal" value={wage} onChange={e => setWage(e.target.value)} aria-label="금액" />
									</Adorned>
								)}
							</div>
						</FieldLabel>
					</TwoColumns>
					<FieldLabel>근무 요일·시간 <Hint>선택</Hint>
						<input type="text" maxLength={200} placeholder="예: 주말 11시~16시, 주 2회" value={schedule} onChange={e => setSchedule(e.target.value)} />
					</FieldLabel>
					<FieldLabel as="div">언어
						<CheckRow>
							{JOB_LANGUAGES.map(l => (
								<label key={l}>
									<input type="checkbox" checked={languages.includes(l)} onChange={e => setLanguages(prev => e.target.checked ? [...prev, l] : prev.filter(x => x !== l))} /> {l}
								</label>
							))}
						</CheckRow>
					</FieldLabel>
					<CheckRow>
						<label><input type="checkbox" checked={permit} onChange={e => setPermit(e.target.checked)} /> 근로 가능한 체류증 필요</label>
					</CheckRow>
					<Hint>성별·나이·국적 조건은 적을 수 없어요(프랑스 차별금지 규정). &lsquo;한국어 가능&rsquo; 같은 직무 조건은 괜찮아요.</Hint>
					{hiring && !post && (
						<TwoColumns>
							<FieldLabel>연락처 전화 <Hint>선택 · 로그인한 회원에게만 보여요</Hint>
								<input type="tel" maxLength={30} placeholder="06 12 34 56 78" value={phone} onChange={e => setPhone(e.target.value)} />
							</FieldLabel>
							<FieldLabel>연락처 이메일 <Hint>선택</Hint>
								<input type="email" maxLength={100} value={email} onChange={e => setEmail(e.target.value)} />
							</FieldLabel>
						</TwoColumns>
					)}
				</FormSection>
			)}

			<FormSection aria-labelledby="sec-content">
				<header><h2 id="sec-content">소개</h2></header>
				<FieldLabel>제목
					<input type="text" required minLength={2} maxLength={100} value={title} onChange={e => setTitle(e.target.value)}
						placeholder={type === "housing" ? "예: 15구 메트로 6분, 채광 좋은 쉐어 방" : "예: 11구 한식당 주말 홀서빙 구해요"} />
				</FieldLabel>
				<FieldLabel>
					<span className="sr-only">내용</span>
					<textarea required rows={8} maxLength={5000} value={body} onChange={e => setBody(e.target.value)}
						placeholder={type === "housing" ? "집 상태, 함께 사는 사람, 주변 환경, 원하는 입주자 등을 적어주세요." : "하는 일, 근무 환경, 원하는 사람(또는 내 경력)을 적어주세요."} />
					<Counter>{body.length.toLocaleString()} / 5,000</Counter>
				</FieldLabel>
				<ImageUploader photos={photos} onChange={next => setPhotos(next.slice(0, MAX_LISTING_IMAGES))} uploading={submitting} />
				{offering && <Hint>방 사진은 1장 이상 필요해요. 실제 사진이 신뢰를 높여요.</Hint>}
			</FormSection>

			<FormSection aria-labelledby="sec-place">
				<header><h2 id="sec-place">위치</h2></header>
				<LocationField
					value={location}
					onChange={setLocation}
					areaOnly={type === "housing"}
					exactHint="가게 위치가 핀으로 보여요."
				/>
			</FormSection>

			{offering && !post && (
				<CheckRow>
					<label style={{ borderRadius: 8 }}>
						<input type="checkbox" checked={pledge} onChange={e => setPledge(e.target.checked)} />
						집을 보여주기 전에는 보증금이나 월세를 받지 않을게요.
					</label>
				</CheckRow>
			)}
			{error && <ErrorText role="alert">{error}</ErrorText>}
			<SubmitButton type="submit" disabled={submitting}>{submitting ? "저장 중..." : post ? "수정 완료" : "올리기"}</SubmitButton>
		</FormColumn>
	);
}

// NewListing is the write page's body: login first, then the form.
export function NewListing({ type }: { type: ListingType }) {
	return <RequireLogin>{() => <ListingForm type={type} />}</RequireLogin>;
}
