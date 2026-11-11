export type ReturnShape = { labels: string[]; sqlColumns: string[] };

// AGE needs a SQL record definition even though the user writes only Cypher.
// This scanner counts top-level RETURN expressions, leaving nested commas alone.
function topLevelMask(input: string): string {
  let quote: string | null = null;
  let lineComment = false;
  let blockComment = false;
  let depth = 0;
  let mask = '';

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      mask += ' ';
    } else if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        mask += '  ';
        i += 1;
      } else mask += ' ';
    } else if (quote) {
      if (char === '\\') {
        mask += '  ';
        i += 1;
      } else if (char === quote && next === quote) {
        mask += '  ';
        i += 1;
      } else {
        if (char === quote) quote = null;
        mask += ' ';
      }
    } else if (char === '/' && next === '/') {
      lineComment = true;
      mask += '  ';
      i += 1;
    } else if (char === '/' && next === '*') {
      blockComment = true;
      mask += '  ';
      i += 1;
    } else if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      mask += ' ';
    } else if ('([{'.includes(char)) {
      depth += 1;
      mask += ' ';
    } else if (')]}'.includes(char)) {
      depth = Math.max(0, depth - 1);
      mask += ' ';
    } else mask += depth === 0 ? char : ' ';
  }

  return mask;
}

export function returnShape(cypher: string): ReturnShape {
  const mask = topLevelMask(cypher);
  const returns = [...mask.matchAll(/\bRETURN\b/gi)];
  if (returns.length === 0) return { labels: [], sqlColumns: ['value agtype'] };

  const start = returns.at(-1)!.index! + 'RETURN'.length;
  const tail = mask.slice(start);
  const endMatch = /\b(?:ORDER\s+BY|SKIP|LIMIT|UNION)\b/i.exec(tail);
  const end = endMatch ? start + endMatch.index : cypher.length;
  const projection = cypher.slice(start, end).trim().replace(/^DISTINCT\s+/i, '');
  const projectionMask = topLevelMask(projection);
  const positions = [0];
  for (let i = 0; i < projectionMask.length; i += 1) {
    if (projectionMask[i] === ',') positions.push(i + 1);
  }
  positions.push(projection.length + 1);
  const expressions = positions.slice(0, -1).map((position, index) =>
    projection.slice(position, positions[index + 1] - 1).trim(),
  );

  if (expressions.some((expression) => !expression || expression === '*')) {
    throw new Error('Use explicit RETURN expressions; RETURN * is not supported yet.');
  }

  return {
    labels: expressions.map((expression) => {
      const alias = /\s+AS\s+(`[^`]+`|[A-Za-z_][\w]*)\s*$/i.exec(expression);
      return alias ? alias[1].replace(/^`|`$/g, '') : expression;
    }),
    sqlColumns: expressions.map((_, index) => `column_${index + 1} agtype`),
  };
}

export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function cypherSql(graph: string, cypher: string, columns: string[]): string {
  let tag = '$graphlab$';
  let suffix = 0;
  while (cypher.includes(tag)) tag = `$graphlab${++suffix}$`;
  return `SELECT * FROM ag_catalog.cypher(${sqlLiteral(graph)}, ${tag}${cypher}${tag}) AS (${columns.join(', ')})`;
}
