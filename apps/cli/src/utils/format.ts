/**
 * 格式化工具
 */

/**
 * 格式化数字 (1234 → "1,234")
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/**
 * 格式化日期
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toISOString().split('T')[0];
}

/**
 * 格式化表格
 */
export function formatTable(rows: string[][]): string {
  if (rows.length === 0) return '';

  // 计算每列最大宽度
  const colWidths: number[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      colWidths[i] = Math.max(colWidths[i] || 0, row[i].length);
    }
  }

  // 格式化行
  return rows
    .map((row) =>
      row.map((cell, i) => cell.padEnd(colWidths[i])).join('  ')
    )
    .join('\n');
}

/**
 * 截断字符串
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}
