import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Eraser } from 'lucide-react';

interface CellData {
  value: string;
  isColored: boolean;
  isNegative: boolean;
  isTest: boolean;
}

interface MergeLabel {
  label: number;
  cells: Set<string>;
  firstCell: string;
  isRigid: boolean;
}

function App() {
  const [selectionStart, setSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [bottomSelectionStart, setBottomSelectionStart] = useState<{ row: number; col: number } | null>(null);
  const [bottomSelectionEnd, setBottomSelectionEnd] = useState<{ row: number; col: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBottomDragging, setIsBottomDragging] = useState(false);
  const [cellData, setCellData] = useState<Record<string, CellData>>({});
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isBlankMode, setIsBlankMode] = useState(false);
  const [isNegativeMode, setIsNegativeMode] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [mergeLabels, setMergeLabels] = useState<MergeLabel[]>([]);
  const [currentLabelNumber, setCurrentLabelNumber] = useState(1);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ row: number; col: number } | null>(null);

  // Add event listeners for Control key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') {
        setIsCtrlPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown as unknown as EventListener);
    window.addEventListener('keyup', handleKeyUp as unknown as EventListener);

    return () => {
      window.removeEventListener('keydown', handleKeyDown as unknown as EventListener);
      window.removeEventListener('keyup', handleKeyUp as unknown as EventListener);
    };
  }, []);

  const clearColors = () => {
    const newCellData = { ...cellData };
    Object.keys(newCellData).forEach(key => {
      if (newCellData[key].isColored) {
        newCellData[key] = {
          ...newCellData[key],
          isColored: false,
          isNegative: false,
          isTest: false
        };
      }
    });
    setCellData(newCellData);
  };

  const getSelectedCells = (isBottom = false) => {
    const start = isBottom ? bottomSelectionStart : selectionStart;
    const end = isBottom ? bottomSelectionEnd : selectionEnd;
    
    if (!start || !end) return new Set<string>();

    const startRow = Math.min(start.row, end.row);
    const endRow = Math.max(start.row, end.row);
    const startCol = Math.min(start.col, end.col);
    const endCol = Math.max(start.col, end.col);

    const selectedCells = new Set<string>();
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        selectedCells.add(`${row}-${col}`);
      }
    }
    return selectedCells;
  };

  // Check if a set of cells forms a rigid rectangle
  const isRigidRectangle = (cells: Set<string>): boolean => {
    if (cells.size === 0) return false;

    // Find the boundaries of the selection
    let minRow = Infinity, maxRow = -Infinity;
    let minCol = Infinity, maxCol = -Infinity;

    cells.forEach(cell => {
      const [row, col] = cell.split('-').map(Number);
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    });

    // Calculate expected size of a rigid rectangle
    const expectedSize = (maxRow - minRow + 1) * (maxCol - minCol + 1);

    // Check if all cells within the boundaries are selected
    return cells.size === expectedSize;
  };

  const calculateBlankAverage = () => {
    let sum = 0;
    let count = 0;

    Object.entries(cellData).forEach(([_, data]) => {
      if (data.isColored && !data.isNegative && !data.isTest && data.value) {
        const num = parseFloat(data.value);
        if (!isNaN(num)) {
          sum += num;
          count++;
        }
      }
    });

    return count > 0 ? sum / count : 0;
  };

  const calculateNegativeAverage = () => {
    let sum = 0;
    let count = 0;

    Object.entries(cellData).forEach(([_, data]) => {
      if (data.isColored && data.isNegative && !data.isTest && data.value) {
        const num = parseFloat(data.value);
        if (!isNaN(num)) {
          sum += num;
          count++;
        }
      }
    });

    return count > 0 ? sum / count : 0;
  };

  const calculateTestAverage = () => {
    let sum = 0;
    let count = 0;

    Object.entries(cellData).forEach(([_, data]) => {
      if (data.isColored && !data.isNegative && data.isTest && data.value) {
        const num = parseFloat(data.value);
        if (!isNaN(num)) {
          sum += num;
          count++;
        }
      }
    });

    return count > 0 ? sum / count : 0;
  };

  const calculateNormalizedValue = (value: string, isNegativeControl: boolean = false) => {
    const testValue = parseFloat(value);
    const blankAvg = calculateBlankAverage();
    const negativeAvg = calculateNegativeAverage();
    
    if (isNaN(testValue) || blankAvg === negativeAvg) {
      return '';
    }

    const normalized = ((testValue - blankAvg) / (negativeAvg - blankAvg)) * 100;
    return isFinite(normalized) ? normalized.toFixed(2) : '';
  };

  const handleMouseDown = (rowIndex: number, colIndex: number, e: MouseEvent) => {
    if (e.button !== 0) return;
    
    if (isBlankMode || isNegativeMode || isTestMode) {
      setSelectionStart({ row: rowIndex, col: colIndex });
      setSelectionEnd({ row: rowIndex, col: colIndex });
      setIsDragging(true);
      
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
        clickTimeoutRef.current = null;
      }
    } else {
      if (e.shiftKey && dragStartRef.current) {
        setSelectionEnd({ row: rowIndex, col: colIndex });
      } else {
        dragStartRef.current = { row: rowIndex, col: colIndex };
        setSelectionStart({ row: rowIndex, col: colIndex });
        setSelectionEnd({ row: rowIndex, col: colIndex });
        setActiveCell({ row: rowIndex, col: colIndex });
        setEditValue(cellData[`${rowIndex}-${colIndex}`]?.value || '');
        setIsDragging(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
  };

  const handleBottomMouseDown = (rowIndex: number, colIndex: number, e: MouseEvent) => {
    if (e.button !== 0) return;
    if (isMergeMode) {
      if (e.ctrlKey) {
        // When Control is pressed, only select the clicked cell
        setBottomSelectionStart({ row: rowIndex, col: colIndex });
        setBottomSelectionEnd({ row: rowIndex, col: colIndex });
      } else {
        // When dragging or clicking without Control, start a new selection
        setBottomSelectionStart({ row: rowIndex, col: colIndex });
        setBottomSelectionEnd({ row: rowIndex, col: colIndex });
      }
      setIsBottomDragging(true);
    } else {
      setBottomSelectionStart({ row: rowIndex, col: colIndex });
      setBottomSelectionEnd({ row: rowIndex, col: colIndex });
      setIsBottomDragging(true);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  const handleMouseEnter = (rowIndex: number, colIndex: number) => {
    if (isDragging) {
      if (isBlankMode || isNegativeMode || isTestMode) {
        setSelectionEnd({ row: rowIndex, col: colIndex });
      } else {
        setSelectionEnd({ row: rowIndex, col: colIndex });
        setActiveCell(null);
      }
    }
  };

  const handleBottomMouseEnter = (rowIndex: number, colIndex: number) => {
    if (isBottomDragging && !isCtrlPressed) {
      setBottomSelectionEnd({ row: rowIndex, col: colIndex });
    }
  };

  const handleMouseUp = (rowIndex: number, colIndex: number) => {
    if (isBlankMode || isNegativeMode || isTestMode) {
      if (isDragging) {
        const selectedCells = getSelectedCells();
        const newCellData = { ...cellData };
        
        selectedCells.forEach(cell => {
          const currentData = newCellData[cell] || { value: '', isColored: false, isNegative: false, isTest: false };
          newCellData[cell] = {
            value: currentData.value,
            isColored: !currentData.isColored,
            isNegative: isNegativeMode,
            isTest: isTestMode
          };
        });
        
        setCellData(newCellData);
        setIsDragging(false);
        setSelectionStart(null);
        setSelectionEnd(null);
      } else {
        clickTimeoutRef.current = window.setTimeout(() => {
          const cellKey = `${rowIndex}-${colIndex}`;
          setCellData(prev => {
            const currentData = prev[cellKey] || { value: '', isColored: false, isNegative: false, isTest: false };
            return {
              ...prev,
              [cellKey]: {
                value: currentData.value,
                isColored: !currentData.isColored,
                isNegative: isNegativeMode,
                isTest: isTestMode
              }
            };
          });
        }, 50);
      }
    } else {
      setIsDragging(false);
    }
  };

  const handleBottomMouseUp = (e: MouseEvent) => {
    if (isMergeMode && bottomSelectionStart && bottomSelectionEnd) {
      const selectedCells = getSelectedCells(true);
      if (selectedCells.size > 0) {
        const firstCell = `${bottomSelectionStart.row}-${bottomSelectionStart.col}`;
        const isRigid = isRigidRectangle(selectedCells);

        if (e.ctrlKey) {
          // If Control is pressed, add to the current label group
          setMergeLabels(prev => {
            const newLabels = [...prev];
            if (newLabels.length > 0) {
              // Get the last label group
              const lastGroup = newLabels[newLabels.length - 1];
              // Merge the new selection with the existing cells
              selectedCells.forEach(cell => lastGroup.cells.add(cell));
              // Update isRigid status after merging
              lastGroup.isRigid = isRigidRectangle(lastGroup.cells);
            } else {
              // If no groups exist yet, create a new one
              newLabels.push({
                label: currentLabelNumber,
                cells: selectedCells,
                firstCell,
                isRigid
              });
              setCurrentLabelNumber(prev => prev + 1);
            }
            return newLabels;
          });
        } else {
          // If Control is not pressed, create a new label group
          setMergeLabels(prev => [...prev, {
            label: currentLabelNumber,
            cells: selectedCells,
            firstCell,
            isRigid
          }]);
          setCurrentLabelNumber(prev => prev + 1);
          // Clear selection after creating new group
          setBottomSelectionStart(null);
          setBottomSelectionEnd(null);
        }
      }
    }
    setIsBottomDragging(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isBlankMode && !isNegativeMode && !isTestMode && e.key === 'Backspace' && !activeCell && (selectionStart || selectionEnd)) {
      e.preventDefault();
      const selectedCells = getSelectedCells();
      const newCellData = { ...cellData };
      
      selectedCells.forEach(cell => {
        if (newCellData[cell]) {
          newCellData[cell] = {
            ...newCellData[cell],
            value: ''
          };
        }
      });
      
      setCellData(newCellData);
    }
  };

  const handleCopy = useCallback((e: ClipboardEvent) => {
    e.preventDefault();

    // Always prioritize bottom table selection for copying
    if (bottomSelectionStart && bottomSelectionEnd) {
      const startRow = Math.min(bottomSelectionStart.row, bottomSelectionEnd.row);
      const endRow = Math.max(bottomSelectionStart.row, bottomSelectionEnd.row);
      const startCol = Math.min(bottomSelectionStart.col, bottomSelectionEnd.col);
      const endCol = Math.max(bottomSelectionStart.col, bottomSelectionEnd.col);

      let copyText = '';
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const cell = cellData[`${row}-${col}`];
          const normalizedValue = cell?.isColored && 
            ((cell?.isTest && cell?.value) || (cell?.isNegative && cell?.value))
              ? calculateNormalizedValue(cell.value, cell.isNegative)
              : '';
          copyText += normalizedValue;
          if (col < endCol) copyText += '\t';
        }
        if (row < endRow) copyText += '\n';
      }
      navigator.clipboard.writeText(copyText);
    } else if (!isBlankMode && !isNegativeMode && !isTestMode && selectionStart && selectionEnd) {
      // Only allow copying from top table when not in any mode
      const startRow = Math.min(selectionStart.row, selectionEnd.row);
      const endRow = Math.max(selectionStart.row, selectionEnd.row);
      const startCol = Math.min(selectionStart.col, selectionEnd.col);
      const endCol = Math.max(selectionStart.col, selectionEnd.col);

      let copyText = '';
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          copyText += cellData[`${row}-${col}`]?.value || '';
          if (col < endCol) copyText += '\t';
        }
        if (row < endRow) copyText += '\n';
      }
      navigator.clipboard.writeText(copyText);
    }
  }, [bottomSelectionStart, bottomSelectionEnd, selectionStart, selectionEnd, cellData, isBlankMode, isNegativeMode, isTestMode]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    e.preventDefault();
    if (isBlankMode || isNegativeMode || isTestMode || !activeCell) return;

    const pasteData = e.clipboardData?.getData('text/plain');
    if (!pasteData) return;

    const rows = pasteData.split('\n');
    const newCellData = { ...cellData };

    rows.forEach((row, rowIndex) => {
      const cells = row.split('\t');
      cells.forEach((cell, colIndex) => {
        const targetRow = activeCell.row + rowIndex;
        const targetCol = activeCell.col + colIndex;
        if (targetRow < 8 && targetCol < 12) {
          const key = `${targetRow}-${targetCol}`;
          const currentData = newCellData[key] || { isColored: false, isNegative: false, isTest: false };
          newCellData[key] = {
            ...currentData,
            value: cell.trim()
          };
        }
      });
    });

    setCellData(newCellData);
    setActiveCell(null);
  }, [activeCell, cellData, isBlankMode, isNegativeMode, isTestMode]);

  const handleCellEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isBlankMode || isNegativeMode || isTestMode || !activeCell) return;
    
    setEditValue(e.target.value);
    const newCellData = { ...cellData };
    const key = `${activeCell.row}-${activeCell.col}`;
    const currentData = newCellData[key] || { isColored: false, isNegative: false, isTest: false };
    newCellData[key] = {
      ...currentData,
      value: e.target.value
    };
    setCellData(newCellData);
  };

  React.useEffect(() => {
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown);
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, [handleCopy, handlePaste, handleKeyDown]);

  const isCellSelected = (rowIndex: number, colIndex: number, isBottom = false) => {
    return getSelectedCells(isBottom).has(`${rowIndex}-${colIndex}`);
  };

  const isCellColored = (rowIndex: number, colIndex: number) => {
    return cellData[`${rowIndex}-${colIndex}`]?.isColored || false;
  };

  const isCellNegative = (rowIndex: number, colIndex: number) => {
    return cellData[`${rowIndex}-${colIndex}`]?.isNegative || false;
  };

  const isCellTest = (rowIndex: number, colIndex: number) => {
    return cellData[`${rowIndex}-${colIndex}`]?.isTest || false;
  };

  const isCellActive = (rowIndex: number, colIndex: number) => {
    return !isBlankMode && !isNegativeMode && !isTestMode && activeCell?.row === rowIndex && activeCell?.col === colIndex;
  };

  const getCellLabel = (rowIndex: number, colIndex: number) => {
    const cellKey = `${rowIndex}-${colIndex}`;
    for (const mergeLabel of mergeLabels) {
      if (mergeLabel.cells.has(cellKey)) {
        return {
          label: mergeLabel.label,
          isFirst: cellKey === mergeLabel.firstCell && mergeLabel.isRigid
        };
      }
    }
    return null;
  };

  const getColumnLabel = (index: number) => {
    let label = '';
    while (index >= 0) {
      label = String.fromCharCode(65 + (index % 26)) + label;
      index = Math.floor(index / 26) - 1;
    }
    return label;
  };

  const toggleBlankMode = () => {
    setIsBlankMode(!isBlankMode);
    setIsNegativeMode(false);
    setIsTestMode(false);
    setIsMergeMode(false);
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    dragStartRef.current = null;
  };

  const toggleNegativeMode = () => {
    setIsNegativeMode(!isNegativeMode);
    setIsBlankMode(false);
    setIsTestMode(false);
    setIsMergeMode(false);
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    dragStartRef.current = null;
  };

  const toggleTestMode = () => {
    setIsTestMode(!isTestMode);
    setIsBlankMode(false);
    setIsNegativeMode(false);
    setIsMergeMode(false);
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    dragStartRef.current = null;
  };

  const toggleMergeMode = () => {
    const newMergeMode = !isMergeMode;
    setIsMergeMode(newMergeMode);
    setIsBlankMode(false);
    setIsNegativeMode(false);
    setIsTestMode(false);
    setActiveCell(null);
    setSelectionStart(null);
    setSelectionEnd(null);
    dragStartRef.current = null;
    
    // Clear all labels when toggling merge mode off
    if (!newMergeMode) {
      setMergeLabels([]);
      setCurrentLabelNumber(1);
    }
  };

  const renderMergeGroupPreview = () => {
    if (mergeLabels.length === 0) return null;

    const firstGroup = mergeLabels[0];
    if (!firstGroup) return null;

    // Convert cells Set to array and sort them
    const cellsArray = Array.from(firstGroup.cells).map(cell => {
      const [row, col] = cell.split('-').map(Number);
      return { key: cell, row, col };
    });

    if (firstGroup.isRigid) {
      // For rigid shapes, find dimensions and arrange in grid
      let minRow = Math.min(...cellsArray.map(c => c.row));
      let maxRow = Math.max(...cellsArray.map(c => c.row));
      let minCol = Math.min(...cellsArray.map(c => c.col));
      let maxCol = Math.max(...cellsArray.map(c => c.col));
      
      const rows = maxRow - minRow + 1;
      const cols = maxCol - minCol + 1;

      return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-4">Selection Group Preview</h3>
          <div className="inline-grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 3rem)` }}>
            {Array.from({ length: rows }, (_, rowIndex) => (
              Array.from({ length: cols }, (_, colIndex) => {
                const actualRow = rowIndex + minRow;
                const actualCol = colIndex + minCol;
                const cell = cellsArray.find(c => c.row === actualRow && c.col === actualCol);
                const isFirstCell = cell?.key === firstGroup.firstCell;

                return (
                  <div
                    key={`${actualRow}-${actualCol}`}
                    className={`h-12 border flex items-center justify-center relative
                      ${cell ? 'border-gray-300 bg-gray-50' : 'border-transparent'}`}
                  >
                    {cell && (
                      <div className={`absolute top-0 left-0 text-white text-xs px-1 rounded-br
                        ${isFirstCell ? 'bg-purple-600' : 'bg-purple-400'}`}>
                        {firstGroup.label}
                      </div>
                    )}
                    {cell && `${getColumnLabel(actualCol)}${actualRow + 1}`}
                  </div>
                );
              })
            ))}
          </div>
        </div>
      );
    } else {
      // For non-rigid shapes, arrange in a single row
      return (
        <div className="mt-8 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold mb-4">Selection Group Preview</h3>
          <div className="flex gap-1">
            {cellsArray.sort((a, b) => {
              if (a.key === firstGroup.firstCell) return -1;
              if (b.key === firstGroup.firstCell) return 1;
              return a.col - b.col || a.row - b.row;
            }).map((cell) => (
              <div
                key={cell.key}
                className="h-12 w-12 border border-gray-300 bg-gray-50 flex items-center justify-center relative"
              >
                <div className={`absolute top-0 left-0 text-white text-xs px-1 rounded-br
                  ${cell.key === firstGroup.firstCell ? 'bg-purple-600' : 'bg-purple-400'}`}>
                  {firstGroup.label}
                </div>
                {`${getColumnLabel(cell.col)}${cell.row + 1}`}
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Automatic Cell Viability(%) Calculator</h1>
          <p className="mt-2 text-gray-600">Enter your data and select cells to calculate viability percentages</p>
        </div>

        {/* Interactive Table */}
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table 
            className="border-collapse table-fixed"
            onMouseLeave={() => {
              setIsDragging(false);
              setSelectionStart(null);
              setSelectionEnd(null);
            }}
          >
            <thead>
              <tr>
                <th className="w-12 h-8 bg-gray-100 border border-gray-300"></th>
                {Array.from({ length: 12 }, (_, colIndex) => (
                  <th 
                    key={colIndex}
                    className="w-24 h-8 bg-gray-100 border border-gray-300 text-sm font-semibold text-gray-700"
                  >
                    {getColumnLabel(colIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="w-12 bg-gray-100 border border-gray-300 text-sm font-semibold text-gray-700 text-center">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: 12 }, (_, colIndex) => (
                    <td
                      key={colIndex}
                      className={`w-24 h-12 border border-gray-300 transition-colors relative p-1
                        ${isCellSelected(rowIndex, colIndex)
                          ? isBlankMode
                            ? 'bg-blue-200 border-blue-400'
                            : isNegativeMode
                              ? 'bg-yellow-200 border-yellow-400'
                              : isTestMode
                                ? 'bg-green-200 border-green-400'
                                : 'bg-gray-100 border-gray-300'
                          : isCellColored(rowIndex, colIndex)
                          ? isCellNegative(rowIndex, colIndex)
                            ? 'bg-yellow-100 border-yellow-300'
                            : isCellTest(rowIndex, colIndex)
                              ? 'bg-green-100 border-green-300'
                              : 'bg-blue-100 border-blue-300'
                          : isCellActive(rowIndex, colIndex)
                          ? 'bg-yellow-50'
                          : isBlankMode
                          ? 'hover:bg-blue-50 cursor-pointer'
                          : isNegativeMode
                          ? 'hover:bg-yellow-50 cursor-pointer'
                          : isTestMode
                          ? 'hover:bg-green-50 cursor-pointer'
                          : 'hover:bg-yellow-50 cursor-cell'}`}
                      onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e as unknown as MouseEvent)}
                      onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                      onMouseUp={() => handleMouseUp(rowIndex, colIndex)}
                      style={{ userSelect: 'none' }}
                    >
                      {isCellActive(rowIndex, colIndex) ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={handleCellEdit}
                          className="w-full h-full bg-transparent outline-none"
                          onBlur={() => setActiveCell(null)}
                        />
                      ) : (
                        cellData[`${rowIndex}-${colIndex}`]?.value || ''
                      )}
                      {isCellSelected(rowIndex, colIndex) && selectionStart?.row === rowIndex && selectionStart?.col === colIndex && (
                        <div className="absolute -top-[1px] -left-[1px] w-[2px] h-[2px] bg-blue-600"></div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Selection Info, Averages, and Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 flex items-center gap-4">
            {!isBlankMode && !isNegativeMode && !isTestMode && (
              <>
                {selectionStart && selectionEnd && (
                  <p>
                    Selected: {getColumnLabel(selectionStart.col)}{selectionStart.row + 1}
                    {(selectionStart.row !== selectionEnd.row || selectionStart.col !== selectionEnd.col) && 
                      `:${getColumnLabel(selectionEnd.col)}${selectionEnd.row + 1}`}
                  </p>
                )}
                {bottomSelectionStart && bottomSelectionEnd && (
                  <p>
                    Bottom Selected: {getColumnLabel(bottomSelectionStart.col)}{bottomSelectionStart.row + 1}
                    {(bottomSelectionStart.row !== bottomSelectionEnd.row || bottomSelectionStart.col !== bottomSelectionEnd.col) && 
                      `:${getColumnLabel(bottomSelectionEnd.col)}${bottomSelectionEnd.row + 1}`}
                  </p>
                )}
              </>
            )}
            <p className="font-medium">
              Blank Average: <span className="text-blue-600">{calculateBlankAverage().toFixed(2)}</span>
            </p>
            <p className="font-medium">
              Negative Average: <span className="text-yellow-600">{calculateNegativeAverage().toFixed(2)}</span>
            </p>
            <p className="font-medium">
              Test Average: <span className="text-green-600">{calculateTestAverage().toFixed(2)}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearColors}
              className="px-4 py-2 rounded-md font-medium transition-colors bg-red-500 text-white hover:bg-red-600 active:bg-red-700 flex items-center gap-2"
            >
              <Eraser size={16} /> Clear Colors
            </button>
            <button
              onClick={toggleBlankMode}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${isBlankMode
                  ? 'bg-blue-200 text-blue-800 hover:bg-blue-300'
                  : 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700'}`}
            >
              Blank
            </button>
            <button
              onClick={toggleNegativeMode}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${isNegativeMode
                  ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300'
                  : 'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700'}`}
            >
              Negative Control
            </button>
            <button
              onClick={toggleTestMode}
              className={`px-4 py-2 rounded-md font-medium transition-colors
                ${isTestMode
                  ? 'bg-green-200 text-green-800 hover:bg-green-300'
                  : 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700'}`}
            >
              Test Value
            </button>
          </div>
        </div>

        {/* Static Table */}
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <table 
            className="border-collapse table-fixed"
            onMouseLeave={() => {
              setIsBottomDragging(false);
              if (!isCtrlPressed) {
                setBottomSelectionStart(null);
                setBottomSelectionEnd(null);
              }
            }}
          >
            <thead>
              <tr>
                <th className="w-12 h-8 bg-gray-100 border border-gray-300"></th>
                {Array.from({ length: 12 }, (_, colIndex) => (
                  <th 
                    key={colIndex}
                    className="w-24 h-8 bg-gray-100 border border-gray-300 text-sm font-semibold text-gray-700"
                  >
                    {getColumnLabel(colIndex)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }, (_, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="w-12 bg-gray-100 border border-gray-300 text-sm font-semibold text-gray-700 text-center">
                    {rowIndex + 1}
                  </td>
                  {Array.from({ length: 12 }, (_, colIndex) => {
                    const cell = cellData[`${rowIndex}-${colIndex}`];
                    const normalizedValue = cell?.isColored && 
                      ((cell?.isTest && cell?.value) || (cell?.isNegative && cell?.value))
                        ? calculateNormalizedValue(cell.value, cell.isNegative)
                        : '';
                    const labelInfo = getCellLabel(rowIndex, colIndex);
                    return (
                      <td
                        key={colIndex}
                        className={`w-24 h-12 border border-gray-300 p-1 text-center transition-colors cursor-cell relative
                          ${isCellSelected(rowIndex, colIndex, true)
                            ? 'bg-gray-100'
                            : normalizedValue
                              ? cell?.isNegative
                                ? 'bg-yellow-100'
                                : 'bg-green-100'
                              : ''}`}
                        onMouseDown={(e) => handleBottomMouseDown(rowIndex, colIndex, e as unknown as MouseEvent)}
                        onMouseEnter={() => handleBottomMouseEnter(rowIndex, colIndex)}
                        onMouseUp={(e) => handleBottomMouseUp(e as unknown as MouseEvent)}
                        style={{ userSelect: 'none' }}
                      >
                        {labelInfo && (
                          <div className={`absolute top-0 left-0 text-white text-xs px-1 rounded-br
                            ${labelInfo.isFirst ? 'bg-purple-600' : 'bg-purple-400'}`}>
                            {labelInfo.label}
                          </div>
                        )}
                        {normalizedValue}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Merge Data Button */}
        <div className="flex justify-center">
          <button
            onClick={toggleMergeMode}
            className={`px-6 py-2 rounded-md font-medium transition-colors
              ${isMergeMode
                ? 'bg-purple-200 text-purple-800 hover:bg-purple-300'
                : 'bg-purple-500 text-white hover:bg-purple-600 active:bg-purple-700'}`}
          >
            Merge Data
          </button>
        </div>

        {/* Selection Group Preview */}
        {isMergeMode && renderMergeGroupPreview()}
      </div>
    </div>
  );
}

export default App;