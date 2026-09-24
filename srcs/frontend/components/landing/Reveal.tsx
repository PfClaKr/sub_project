'use client';

import { useEffect, useRef, useState } from "react";
import { RevealBox } from "@/styles/styledLanding";

// Fades its children in the first time they scroll into view.
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setVisible(true);
			return;
		}
		const io = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) {
				setVisible(true);
				io.disconnect();
			}
		}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
		io.observe(el);
		return () => io.disconnect();
	}, []);

	return <RevealBox ref={ref} $visible={visible} $delay={delay}>{children}</RevealBox>;
}
