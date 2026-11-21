import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Rubber-stamp impression drawn as SVG so the ink texture renders the same in every browser.
 * Tone "red" is reserved for the single P0 item on a surface.
 */
export function Stamp({
  lines,
  tone = "ink",
  rotate = -6,
  className,
}: {
  lines: [string] | [string, string];
  tone?: "red" | "ink" | "blue";
  rotate?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const color = tone === "red" ? "#C8102E" : tone === "blue" ? "#1F3A93" : "#141414";
  const [top, bottom] = lines;
  const height = bottom ? 92 : 66;
  return (
    <svg
      viewBox={`0 0 260 ${height}`}
      className={cn("pointer-events-none select-none", className)}
      style={{ transform: `rotate(${rotate}deg)`, mixBlendMode: "multiply" }}
      aria-hidden="true"
    >
      <defs>
        <filter id={`ink-${id}`} x="-5%" y="-10%" width="110%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" result="rough" />
          <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="1" seed="3" result="spots" />
          <feColorMatrix
            in="spots"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 2.15"
            result="mask"
          />
          <feComposite in="rough" in2="mask" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#ink-${id})`} fill="none" stroke={color} opacity="0.92">
        <rect x="4" y="4" width="252" height={height - 8} rx="5" strokeWidth="4" />
        <rect x="11" y="11" width="238" height={height - 22} rx="2" strokeWidth="1.5" />
        <text
          x="130"
          y={bottom ? 46 : 44}
          textAnchor="middle"
          fill={color}
          stroke="none"
          style={{ font: "800 34px Archivo, sans-serif", fontStretch: "70%", letterSpacing: "0.04em" }}
        >
          {top.toUpperCase()}
        </text>
        {bottom ? (
          <text
            x="130"
            y="74"
            textAnchor="middle"
            fill={color}
            stroke="none"
            style={{ font: "800 19px Archivo, sans-serif", fontStretch: "85%", letterSpacing: "0.16em" }}
          >
            {bottom.toUpperCase()}
          </text>
        ) : null}
      </g>
    </svg>
  );
}
