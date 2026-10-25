import type { ReactNode } from "react";
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
    .replace(/\\(?:displaystyle|left|right)\b/g, "")
    .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\mathrm\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\mathbf\s*\{([^{}]*)\}/g, "**$1**")
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1) / ($2)")
    .replace(/\\frac\\text\s*([^\\=\n]+?)\\text\s*([^=\n]+)/g, "$1 / $2")
    .replace(/\\frac\\text\s*Data per frame\s*T_cycle/gi, "Data per frame / T_cycle")
    .replace(/\\bar\s*\{([^{}]+)\}/g, (_, inner: string) => overline(inner))
    .replace(/\\overline\s*\{([^{}]+)\}/g, (_, inner: string) => overline(inner))
    .replace(/\\Sigma/g, "\u03a3")
    .replace(/\\sum/g, "\u03a3")
    .replace(/\\Delta/g, "\u0394")
    .replace(/\\alpha/g, "\u03b1")
    .replace(/\\beta/g, "\u03b2")
    .replace(/\\theta/g, "\u03b8")
    .replace(/\\lambda/g, "\u03bb")
    .replace(/\\mu/g, "\u00b5")
    .replace(/\\times/g, "\u00d7")
    .replace(/\\cdot/g, "\u00b7")
    .replace(/\\approx/g, "\u2248")
    .replace(/\\rightarrow/g, "\u2192")
    .replace(/\\leftarrow/g, "\u2190")
    .replace(/\\geq/g, "\u2265")
    .replace(/\\leq/g, "\u2264")
    .replace(/\\neq/g, "\u2260")
    .replace(/\\text\s*(?=[A-Za-z])/g, "")
    .replace(/\\([A-Za-z]+)\b/g, "$1")
    .replace(/\{([^{}]*)\}/g, "$1");
}

function normalizePlainMath(value: string) {
  return value
    .replace(/\^\{([^{}]+)\}/g, "^$1")
    .replace(/\^([-\d]+)/g, "^$1")
    .replace(/\b(\d+(?:\.\d+)?)\s*\*\s*10\^(-?\d+)\b/g, "$1 x 10^$2")
    .replace(/\b(\d+(?:\.\d+)?)\s*x\s*10\^(-?\d+)\b/gi, "$1 x 10^$2");
}

function formatAiText(value: string) {
  return normalizePlainMath(normalizeLatexMath(value))
    .replace(/\$([^$]+)\$/g, (_, math: string) => normalizeLatexMath(math))
    .replace(/[ \t]+\n/g, "\n")
    .trim();
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
  li: ({ node, ...props }: any) => <li className="pl-1 leading-relaxed" {...props} />,
  code: ({ node, ...props }: any) => (
    <code
      className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-900 dark:bg-gray-700 dark:text-gray-100"
      {...props}
    />
  ),
  pre: ({ node, ...props }: any) => (
    <pre
      className="mb-3 overflow-x-auto rounded bg-gray-100 p-3 text-sm text-gray-900 dark:bg-gray-800 dark:text-gray-100"
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

function isTableRow(line: string) {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitTableCells(line: string) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function renderMarkdown(markdown: string, key: string) {
  if (!markdown.trim()) return null;

  return (
    <ReactMarkdown key={key} components={blockComponents}>
      {markdown}
    </ReactMarkdown>
  );
}

function renderTable(lines: string[], key: string) {
  const headers = splitTableCells(lines[0]);
  const rows = lines.slice(2).map(splitTableCells);

  return (
    <div key={key} className="mb-4 overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100">
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${key}-head-${index}`}
                className="border-b border-gray-200 px-3 py-2 font-semibold dark:border-gray-700"
              >
                <FormattedAIText inline>{header}</FormattedAIText>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {rows.map((row, rowIndex) => (
            <tr key={`${key}-row-${rowIndex}`} className="bg-white/70 dark:bg-gray-900/30">
              {headers.map((_, cellIndex) => (
                <td key={`${key}-cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top">
                  <FormattedAIText inline>{row[cellIndex] ?? ""}</FormattedAIText>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlockContent(value: string) {
  const lines = value.split("\n");
  const rendered: ReactNode[] = [];
  let markdownBuffer: string[] = [];
  let index = 0;

  const flushMarkdown = () => {
    const markdown = markdownBuffer.join("\n");
    const element = renderMarkdown(markdown, `md-${rendered.length}`);
    if (element) rendered.push(element);
    markdownBuffer = [];
  };

  while (index < lines.length) {
    if (isTableRow(lines[index]) && lines[index + 1] && isTableSeparator(lines[index + 1])) {
      flushMarkdown();
      const tableLines = [lines[index], lines[index + 1]];
      index += 2;

      while (index < lines.length && isTableRow(lines[index])) {
        tableLines.push(lines[index]);
        index++;
      }

      rendered.push(renderTable(tableLines, `table-${rendered.length}`));
      continue;
    }

    markdownBuffer.push(lines[index]);
    index++;
  }

  flushMarkdown();
  return rendered;
}

export function FormattedAIText({ children, inline = false, className }: FormattedAITextProps) {
  const formattedText = formatAiText(children);

  if (inline) {
    return (
      <span className={className}>
        <ReactMarkdown components={inlineComponents}>{formattedText}</ReactMarkdown>
      </span>
    );
  }

  return <div className={className}>{renderBlockContent(formattedText)}</div>;
}
