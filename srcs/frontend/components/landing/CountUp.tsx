'use client';

import { useEffect, useRef, useState } from "react";

// Counts from 0 to value once visible (ease-out, ~1.2s).
export function CountUp({ value }: { value: number }) {
	const ref = useRef<HTMLSpanElement>(null);
	const [shown, setShown] = useState(0);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
			setShown(value);
			return;
		}
		let frame = 0;
		const io = new IntersectionObserver(([entry]) => {
			if (!entry.isIntersecting) return;
			io.disconnect();
			const start = performance.now();
			const tick = (now: number) => {
				const t = Math.min(1, (now - start) / 1200);
				setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
				if (t < 1) frame = requestAnimationFrame(tick);
			};
			frame = requestAnimationFrame(tick);
		});
		io.observe(el);
		return () => {
			io.disconnect();
			cancelAnimationFrame(frame);
		};
	}, [value]);

	return <span ref={ref}>{shown.toLocaleString("ko-KR")}</span>;
}
