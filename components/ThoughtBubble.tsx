import React from "react";

interface ThoughtBubbleProps {
  text: string;
  className?: string;
  width?: number; // rendered pixel width
  height?: number; // rendered pixel height
}

const ThoughtBubble: React.FC<ThoughtBubbleProps> = ({
  text,
  className,
  width = 760,
  height = 220,
}) => {
  // Minimal SVG-based bubble with soft fill, thin outline, and a small tail.
  // Text is wrapped in a simple <foreignObject> to allow HTML text layout.
  return (
    <div className={className} aria-hidden>
      <svg
        width={width}
        height={height}
        viewBox="0 0 520 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="thought bubble"
      >
        <defs>
          <filter id="softShadow" x="-20%" y="-25%" width="140%" height="150%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="10"
              floodColor="#000"
              floodOpacity="0.16"
            />
          </filter>
        </defs>

        <g filter="url(#softShadow)">
          <path
            d="M28 18 C28 10 36 4 44 4 H476 C488 4 500 12 500 24 C500 32 496 38 488 44 C500 56 508 72 508 110 C508 140 492 160 468 160 H60 C44 160 28 146 28 120 C28 96 28 60 28 18 Z"
            fill="rgba(255,255,255,0.92)"
            stroke="rgba(0,0,0,0.16)"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />

          {/* small tail circles to suggest thought */}
          <circle
            cx="120"
            cy="116"
            r="6"
            fill="rgba(255,255,255,0.94)"
            stroke="rgba(0,0,0,0.12)"
          />
          <circle
            cx="100"
            cy="126"
            r="4"
            fill="rgba(255,255,255,0.94)"
            stroke="rgba(0,0,0,0.12)"
          />
        </g>

        <foreignObject x="36" y="18" width="448" height="160">
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            style={{
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
              fontSize: 13,
              lineHeight: "1.4",
              color: "rgba(20,20,20,0.9)",
              paddingRight: 8,
              paddingLeft: 8,
              paddingTop: 6,
              paddingBottom: 6,
              textAlign: "left",
              whiteSpace: "pre-wrap",
            }}
          >
            {text}
          </div>
        </foreignObject>
      </svg>
    </div>
  );
};
export default ThoughtBubble;
