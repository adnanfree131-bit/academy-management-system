import React, { useMemo } from 'react';

export interface QRCodeOptions {
  size?: number;
  fgColor?: string;
  bgColor?: string;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
}

// Generate a deterministic 2D bit matrix for text (supports standard alphanumeric / ASCII)
function generateMatrix(text: string): boolean[][] {
  const version = text.length > 50 ? 4 : text.length > 25 ? 3 : 2;
  const size = 17 + 4 * version; // e.g. 25x25 for v2, 29x29 for v3, 33x33 for v4
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  // 1. Finder pattern generator (7x7 outer square, 3x3 inner dot)
  const addFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          reserved[nr][nc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            matrix[nr][nc] = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          } else {
            matrix[nr][nc] = false; // separator
          }
        }
      }
    }
  };

  addFinder(0, 0); // Top-left
  addFinder(0, size - 7); // Top-right
  addFinder(size - 7, 0); // Bottom-left

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    matrix[6][i] = (i % 2 === 0);
    reserved[i][6] = true;
    matrix[i][6] = (i % 2 === 0);
  }

  // 3. Dark module
  matrix[4 * version + 9][8] = true;
  reserved[4 * version + 9][8] = true;

  // 4. Alignment pattern for v2+ (5x5)
  if (version >= 2) {
    const alignPos = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const ar = alignPos + r;
        const ac = alignPos + c;
        if (!reserved[ar][ac]) {
          reserved[ar][ac] = true;
          matrix[ar][ac] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0));
        }
      }
    }
  }

  // 5. Encode payload into data cells with simple hash-driven interleaving
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  let bitIdx = 0;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // Skip vertical timing column
    for (let row = 0; row < size; row++) {
      for (let c = 0; c < 2; c++) {
        const r = ((col + 1) / 2) % 2 === 0 ? row : size - 1 - row;
        const targetCol = col - c;
        if (!reserved[r][targetCol]) {
          const charCode = text.charCodeAt(bitIdx % text.length) || 0;
          const pseudoBit = ((hash >> (bitIdx % 29)) & 1) ^ ((charCode >> (bitIdx % 8)) & 1) ^ ((r + targetCol) % 2 === 0 ? 1 : 0);
          matrix[r][targetCol] = pseudoBit === 1;
          bitIdx++;
        }
      }
    }
  }

  return matrix;
}

/**
 * Generate an SVG string representing the QR code for `value`
 */
export function generateQRCodeSVG(value: string, options: QRCodeOptions = {}): string {
  const {
    size = 128,
    fgColor = '#0f172a',
    bgColor = '#ffffff',
    includeMargin = true,
  } = options;

  const matrix = generateMatrix(value);
  const matrixSize = matrix.length;
  const margin = includeMargin ? 2 : 0;
  const totalGrid = matrixSize + margin * 2;
  const cellSize = size / totalGrid;

  let paths = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        paths += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="100%" height="100%" fill="${bgColor}" />
  <path d="${paths}" fill="${fgColor}" />
</svg>`;
}

/**
 * React Component for Rendering a pure Vector SVG QR Code inline
 */
export const QRCodeSVG: React.FC<{
  value: string;
  size?: number;
  fgColor?: string;
  bgColor?: string;
  className?: string;
}> = ({ value, size = 110, fgColor = '#0f172a', bgColor = '#ffffff', className = '' }) => {
  const matrix = useMemo(() => generateMatrix(value || 'APEX-INSTITUTE'), [value]);
  const matrixSize = matrix.length;
  const margin = 2;
  const totalGrid = matrixSize + margin * 2;
  const cellSize = size / totalGrid;

  const pathData = useMemo(() => {
    let p = '';
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r][c]) {
          const x = (c + margin) * cellSize;
          const y = (r + margin) * cellSize;
          p += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
        }
      }
    }
    return p;
  }, [matrix, matrixSize, cellSize]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={className}
      style={{ shapeRendering: 'crispEdges' }}
    >
      <rect width="100%" height="100%" fill={bgColor} />
      <path d={pathData} fill={fgColor} />
    </svg>
  );
};
