import ReactMarkdown from "react-markdown";

interface FormattedAITextProps {
  children: string;
  inline?: boolean;
  className?: string;
}

const combiningOverline = "\u0305";

function overline(value: string) {
  return value
    .split("")
    .map((char) => (char.trim() ? `${char}${combiningOverline}` : char))
    .join("");
}

function normalizeLatexMath(value: string) {
  return value
    .replace(/\\Sigma/g, "Σ")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\rightarrow/g, "→")
    .replace(/\\leftarrow/g, "←")
    .replace(/\\geq/g, "≥")
    .replace(/\\leq/g, "≤")
    .replace(/\\neq/g, "≠")
    .replace(/\\bar\{([^{}]+)\}/g, (_, inner: string) => overline(inner))
    .replace(/\\overline\{([^{}]+)\}/g, (_, inner: string) => overline(inner))
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "$1/$2")
    .replace(/[{}]/g, "");
}

function formatAiText(value: string) {
  return value.replace(/\$([^$]+)\$/g, (_, math: string) => normalizeLatexMath(math));
}

const inlineComponents = {
  p: ({ node, ...props }: any) => <span {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-semibold" {...props} />,
  em: ({ node, ...props }: any) => <em className="italic" {...props} />,
  code: ({ node, ...props }: any) => (
    <code
      className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-900 dark:bg-gray-700 dark:text-gray-100"
      {...props}
    />
  ),
};

const blockComponents = {
  p: ({ node, ...props }: any) => <p className="mb-3 leading-relaxed last:mb-0" {...props} />,
  strong: ({ node, ...props }: any) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />
  ),
  em: ({ node, ...props }: any) => <em className="italic" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />,
  li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
  code: ({ node, ...props }: any) => (
    <code
      className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-900 dark:bg-gray-700 dark:text-gray-100"
      {...props}
    />
  ),
  pre: ({ node, ...props }: any) => (
    <pre
      className="mb-3 overflow-x-auto rounded bg-gray-100 p-3 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
      {...props}
    />
  ),
  blockquote: ({ node, ...props }: any) => (
    <blockquote
      className="mb-3 border-l-4 border-blue-400 pl-3 italic text-gray-700 dark:border-blue-500 dark:text-gray-300"
      {...props}
    />
  ),
  h1: ({ node, ...props }: any) => (
    <h1 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100" {...props} />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 className="mb-2 text-base font-bold text-gray-900 dark:text-gray-100" {...props} />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100" {...props} />
  ),
};

export function FormattedAIText({ children, inline = false, className }: FormattedAITextProps) {
  if (inline) {
    return (
      <span className={className}>
        <ReactMarkdown components={inlineComponents}>{formatAiText(children)}</ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={className}>
      <ReactMarkdown components={blockComponents}>{formatAiText(children)}</ReactMarkdown>
    </div>
  );
}
