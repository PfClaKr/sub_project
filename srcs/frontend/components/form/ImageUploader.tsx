'use client';

import { useEffect, useRef, useState, DragEvent } from "react";
import { ImagePlus, Plus, Star, X } from "lucide-react";
import { MAX_IMAGES, MAX_IMAGE_BYTES } from "@/libs/constants";
import {
	AddTile, CoverBadge, DropIcon, DropZone, PhotoTile, TileButton, TileGrid, Uploading, UploaderFoot,
} from "@/styles/styledUploader";

// An already uploaded photo (url) or a new file with a local preview.
export type Photo = { id: string; url: string; file?: File };

const ACCEPT = ["image/jpeg", "image/png", "image/gif", "image/webp"];

let nextId = 0;
export const photoFromUrl = (url: string): Photo => ({ id: `u${nextId++}`, url });

// ImageUploader: drop or pick photos, reorder them by dragging, and make
// any one the cover (the first photo is the listing thumbnail).
export function ImageUploader({ photos, onChange, uploading }: {
	photos: Photo[];
	onChange: (next: Photo[]) => void;
	uploading?: boolean;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [dropActive, setDropActive] = useState(false);
	const [dragId, setDragId] = useState<string | null>(null);
	const [overId, setOverId] = useState<string | null>(null);
	const [warning, setWarning] = useState("");
	const latest = useRef(photos);
	latest.current = photos;

	// Free the object URLs of local previews when the form goes away.
	useEffect(() => () => latest.current.forEach(p => p.file && URL.revokeObjectURL(p.url)), []);

	const addFiles = (files: FileList | File[]) => {
		const list = Array.from(files);
		const rejected = list.filter(f => !ACCEPT.includes(f.type) || f.size > MAX_IMAGE_BYTES);
		const room = MAX_IMAGES - photos.length;
		const accepted = list.filter(f => !rejected.includes(f)).slice(0, room);

		const notes = [];
		if (rejected.length) notes.push(`${rejected.length}장은 jpg·png·gif·webp가 아니거나 5MB를 넘어서 뺐어요.`);
		if (list.length - rejected.length > room) notes.push(`사진은 최대 ${MAX_IMAGES}장까지예요.`);
		setWarning(notes.join(" "));

		if (accepted.length) {
			onChange([...photos, ...accepted.map(file => ({ id: `f${nextId++}`, url: URL.createObjectURL(file), file }))]);
		}
	};

	const remove = (id: string) => {
		const p = photos.find(x => x.id === id);
		if (p?.file) URL.revokeObjectURL(p.url);
		setWarning("");
		onChange(photos.filter(x => x.id !== id));
	};

	const move = (id: string, to: number) => {
		const from = photos.findIndex(x => x.id === id);
		if (from < 0 || from === to) return;
		const next = [...photos];
		const [item] = next.splice(from, 1);
		next.splice(to, 0, item);
		onChange(next);
	};

	const onZoneDrop = (e: DragEvent) => {
		e.preventDefault();
		setDropActive(false);
		if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
	};

	const picker = (
		<input
			ref={input}
			type="file"
			accept={ACCEPT.join(",")}
			multiple
			hidden
			onChange={e => {
				if (e.target.files) addFiles(e.target.files);
				e.target.value = "";
			}}
		/>
	);

	if (photos.length === 0) {
		return (
			<div>
				<DropZone
					role="button"
					tabIndex={0}
					$active={dropActive}
					$compact={false}
					aria-label="사진 추가"
					onClick={() => input.current?.click()}
					onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), input.current?.click())}
					onDragOver={e => {
						e.preventDefault();
						setDropActive(true);
					}}
					onDragLeave={() => setDropActive(false)}
					onDrop={onZoneDrop}
				>
					<DropIcon aria-hidden><ImagePlus size={26} /></DropIcon>
					<strong>사진을 끌어다 놓거나 눌러서 추가하세요</strong>
					<small>최대 {MAX_IMAGES}장 · jpg, png, gif, webp · 한 장에 5MB 이하</small>
				</DropZone>
				{picker}
				{warning && <UploaderFoot $warn role="alert">{warning}</UploaderFoot>}
			</div>
		);
	}

	return (
		<div
			onDragOver={e => {
				if (e.dataTransfer.types.includes("Files")) e.preventDefault();
			}}
			onDrop={e => {
				if (e.dataTransfer.files.length) onZoneDrop(e);
			}}
		>
			<TileGrid aria-label="등록할 사진">
				{photos.map((p, i) => (
					<PhotoTile
						key={p.id}
						draggable={!uploading}
						$dragging={dragId === p.id}
						$over={overId === p.id && dragId !== p.id}
						onDragStart={e => {
							setDragId(p.id);
							e.dataTransfer.effectAllowed = "move";
						}}
						onDragEnd={() => {
							setDragId(null);
							setOverId(null);
						}}
						onDragOver={e => {
							if (!dragId) return;
							e.preventDefault();
							setOverId(p.id);
						}}
						onDrop={e => {
							if (!dragId) return;
							e.preventDefault();
							e.stopPropagation();
							move(dragId, i);
							setDragId(null);
							setOverId(null);
						}}
					>
						<img src={p.url} alt={`사진 ${i + 1}`} />
						{i === 0 && <CoverBadge>대표</CoverBadge>}
						{uploading && p.file && <Uploading aria-label="업로드 중" />}
						{!uploading && (
							<div className="actions">
								{i > 0
									? <TileButton type="button" aria-label="대표 사진으로" title="대표 사진으로" onClick={() => move(p.id, 0)}><Star size={15} /></TileButton>
									: <span />}
								<TileButton type="button" aria-label="사진 삭제" title="삭제" onClick={() => remove(p.id)}><X size={16} /></TileButton>
							</div>
						)}
					</PhotoTile>
				))}
				{photos.length < MAX_IMAGES && (
					<AddTile>
						<button type="button" onClick={() => input.current?.click()} disabled={uploading}>
							<Plus size={22} />
							사진 추가
						</button>
					</AddTile>
				)}
			</TileGrid>
			{picker}
			<UploaderFoot $warn={!!warning} role={warning ? "alert" : undefined}>
				<span>{warning || "끌어서 순서를 바꾸고, ★로 대표 사진을 정할 수 있어요."}</span>
				<span>{photos.length}/{MAX_IMAGES}</span>
			</UploaderFoot>
		</div>
	);
}
