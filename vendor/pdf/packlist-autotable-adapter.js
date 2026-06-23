/* Packlist Pro AutoTable adapter for offline export; not an upstream jsPDF AutoTable build. */
(function (global) {
  'use strict';
  const jsPDF = global.jspdf && global.jspdf.jsPDF;
  if (!jsPDF || jsPDF.prototype.autoTable) return;

  function clampText(value, maxChars) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text;
  }

  jsPDF.prototype.autoTable = function ({ head = [], body = [], startY = 20, styles = {}, margin = {} } = {}) {
    const fontSize = Number(styles.fontSize || 8);
    const rowHeight = Math.max(7, fontSize * 0.9);
    const headHeight = rowHeight + 1.5;
    const startX = Number(margin.left || 14);
    const bottom = 297 - Number(margin.bottom || 20);
    const widths = [34, 70, 14, 22, 20, 22];
    const columns = head[0] || [];
    let y = startY;

    const ensureSpace = (height, repeatHeader = true) => {
      if (y + height <= bottom) return;
      this.addPage();
      y = Number(margin.top || 20);
      if (repeatHeader && columns.length) drawHeader();
    };

    const drawTextCell = (text, x, yPos, width, isHead = false) => {
      const maxChars = Math.max(4, Math.floor(width / 2.15));
      this.setFontSize(isHead ? fontSize + 0.5 : fontSize);
      this.setTextColor?.(isHead ? 51 : 15, isHead ? 65 : 23, isHead ? 85 : 42);
      this.text(clampText(text, maxChars), x + 1.8, yPos);
    };

    const drawCheckCell = (value, x, yPos, width) => {
      const checked = /^(s[iì]|yes|true|1)$/i.test(String(value ?? '').trim());
      const size = 4.2;
      const boxX = x + (width - size) / 2;
      const boxY = yPos - 3.7;
      this.setDrawColor?.(99, 102, 241);
      this.setFillColor?.(checked ? 99 : 255, checked ? 102 : 255, checked ? 241 : 255);
      this.rect(boxX, boxY, size, size, checked ? 'F' : 'S');
      if (checked && typeof this.line === 'function') {
        this.setDrawColor?.(255, 255, 255);
        this.line(boxX + 0.9, boxY + 2.2, boxX + 1.8, boxY + 3.1);
        this.line(boxX + 1.8, boxY + 3.1, boxX + 3.4, boxY + 1.1);
      }
    };

    const drawHeader = () => {
      ensureSpace(headHeight, false);
      this.setFillColor?.(238, 242, 255);
      this.setDrawColor?.(199, 210, 254);
      this.rect(startX, y - 4.5, widths.reduce((sum, width) => sum + width, 0), headHeight, 'F');
      let x = startX;
      columns.forEach((cell, index) => {
        drawTextCell(cell, x, y, widths[index] || 24, true);
        x += widths[index] || 24;
      });
      y += headHeight;
    };

    if (columns.length) drawHeader();
    body.forEach((row, rowIndex) => {
      ensureSpace(rowHeight);
      if (rowIndex % 2 === 0) {
        this.setFillColor?.(248, 250, 252);
        this.rect(startX, y - 4.6, widths.reduce((sum, width) => sum + width, 0), rowHeight, 'F');
      }
      let x = startX;
      row.forEach((cell, index) => {
        if (index === 4 || index === 5) drawCheckCell(cell, x, y, widths[index] || 22);
        else drawTextCell(cell, x, y, widths[index] || 24);
        x += widths[index] || 24;
      });
      this.setDrawColor?.(226, 232, 240);
      if (typeof this.line === 'function') this.line(startX, y + 2.6, startX + widths.reduce((sum, width) => sum + width, 0), y + 2.6);
      y += rowHeight;
    });
    this.lastAutoTable = { finalY: y };
    return this;
  };
})(typeof window !== 'undefined' ? window : globalThis);
