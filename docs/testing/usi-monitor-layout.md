# USI Monitor layout regression check

Run Vite from `codex/ui-codex-1` and open `/docs/testing/usi-monitor-layout.html`. This browser fixture loads the production USI Monitor and secondary-frame styles. The sample engine output is synthetic; it never starts engines or changes game state.

Click each size/count control. Expected: PASS; equal engine section heights; the last section meets the content bottom; each search scrollport extends to its section's bottom padding and contains its overflowing rows. Cases cover native-size containers at 450/700/800/1000px, one/two/three engines, a 600px floating frame and the Engine Monitor command-output tab. This catches the previous 220px search-table cap and missing full-height layout.

The production change is scoped to `usi-communication-monitor` within floating/native containers. Docked monitors retain their compact maximum height; other analysis panels retain their existing layout. Engine headers/tabs stay outside scrolling search rows. Each engine's output scrolls independently, and manual command input remains available in a shorter Engine Monitor section through its own scrolling.

Verified October 5, 2026 in the in-app browser using production CSS. The frontend build passes. Project-wide type and test failures are tracked in analysis-panels-roadmap.md.
