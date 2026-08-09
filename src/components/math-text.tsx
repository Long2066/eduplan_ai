"use client";

import katex from "katex";
import { Fragment, useMemo } from "react";
import { latexToReadableText, normalizeLatexExpression, parseMathContent } from "@/lib/math-content";

type MathTextProps = {
  children: string;
  className?: string;
};

function RenderedFormula({ expression, display }: { expression: string; display: boolean }) {
  const result = useMemo(() => {
    const normalized = normalizeLatexExpression(expression);
    try {
      return {
        html: katex.renderToString(normalized, {
          displayMode: display,
          output: "htmlAndMathml",
          throwOnError: true,
          strict: "error",
          trust: false,
        }),
        fallback: "",
      };
    } catch {
      return { html: "", fallback: latexToReadableText(normalized) || expression };
    }
  }, [display, expression]);

  if (result.fallback) {
    return <span className={display ? "math-fallback math-display" : "math-fallback"}>{result.fallback}</span>;
  }

  return <span className={display ? "math-formula math-display" : "math-formula math-inline"} dangerouslySetInnerHTML={{ __html: result.html }} />;
}

export function MathText({ children, className }: MathTextProps) {
  const segments = useMemo(() => parseMathContent(children), [children]);
  return (
    <span className={className}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment.type}-${index}`}>
          {segment.type === "text" ? segment.value : <RenderedFormula expression={segment.value} display={segment.type === "display-math"} />}
        </Fragment>
      ))}
    </span>
  );
}
