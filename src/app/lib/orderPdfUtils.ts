// src/app/lib/orderPdfUtils.ts
// Génération PDF côté frontend via jsPDF + jsPDF-AutoTable
// Install: npm install jspdf jspdf-autotable

import type { PurchaseOrder, PurchaseRequest } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMAD(amount: number): string {
  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Couleurs marque ─────────────────────────────────────────────────────────

const BRAND_BLUE  = [27, 79, 145]  as [number, number, number]; // #1B4F91
const BRAND_LIGHT = [238, 242, 255] as [number, number, number]; // #EEF2FF
const GRAY_LINE   = [226, 232, 240] as [number, number, number]; // #E2E8F0
const TEXT_DARK   = [26, 26, 46]   as [number, number, number];  // #1a1a2e
const TEXT_GRAY   = [100, 116, 139] as [number, number, number]; // slate-500

// ─── Header commun ────────────────────────────────────────────────────────────

async function drawHeader(
  doc: any,
  title: string,
  docId: string,
  emittedLabel = 'Émis le',
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();

  // Bande top
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(0, 0, pageW, 18, 'F');

  // Nom société
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LEONI', 14, 12);

  // Département
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Département Informatique — Procurement', 14, 16);

  // Titre document (droite)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(title, pageW - 14, 10, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(docId, pageW - 14, 15.5, { align: 'right' });

  // Ligne séparatrice
  let y = 26;
  doc.setDrawColor(...BRAND_BLUE);
  doc.setLineWidth(0.8);
  doc.line(14, y, pageW - 14, y);

  // Date émission
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_GRAY);
  doc.text(`${emittedLabel} : ${fmtDate(new Date().toISOString())}`, pageW - 14, y, { align: 'right' });

  return y + 6; // y de départ pour la suite
}

// ─── Bloc info (carte grise) ─────────────────────────────────────────────────

function drawInfoCard(
  doc: any,
  x: number,
  y: number,
  w: number,
  title: string,
  rows: [string, string][],
): number {
  const lineH = 6;
  const padX = 4;
  const padY = 5;
  const titleH = 8;
  const cardH = titleH + rows.length * lineH + padY * 2;

  // Fond
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(x, y, w, cardH, 2, 2, 'F');

  // Bordure
  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, cardH, 2, 2, 'S');

  // Titre carte
  doc.setFillColor(...BRAND_BLUE);
  doc.roundedRect(x, y, w, titleH, 2, 2, 'F');
  // Redessiner bas du rect titre pour masquer les coins bas arrondis
  doc.setFillColor(...BRAND_BLUE);
  doc.rect(x, y + titleH - 2, w, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), x + padX, y + 5.5);

  // Lignes info
  let rowY = y + titleH + padY;
  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_GRAY);
    doc.text(label, x + padX, rowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXT_DARK);
    doc.text(String(value ?? '—'), x + w - padX, rowY, { align: 'right', maxWidth: w * 0.55 });

    rowY += lineH;
  }

  return y + cardH;
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function drawFooter(doc: any, docId: string): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const y = pageH - 14;

  doc.setDrawColor(...GRAY_LINE);
  doc.setLineWidth(0.3);
  doc.line(14, y, pageW - 14, y);

  doc.setFontSize(7.5);
  doc.setTextColor(...TEXT_GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text(`LEONI — ${docId}`, 14, y + 5);
  doc.text(
    `Document généré automatiquement le ${fmtDate(new Date().toISOString())}`,
    pageW - 14,
    y + 5,
    { align: 'right' },
  );
}

// ─── BON DE COMMANDE (BC) ────────────────────────────────────────────────────

export async function generateBonDeCommande(
  po: PurchaseOrder,
  pr?: PurchaseRequest,
): Promise<void> {
  // Import dynamique pour le tree-shaking
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Header ────────────────────────────────────────────────────────────────
  let y = await drawHeader(doc, 'BON DE COMMANDE', po.id);

  // ── Cartes infos ─────────────────────────────────────────────────────────
  const cardW = (pageW - 14 * 2 - 6) / 2;

  const supplierRows: [string, string][] = [
    ['Fournisseur', po.supplier],
    ...(po.bce ? [['BCE', po.bce] as [string, string]] : []),
    ...(po.bci ? [['BCI', po.bci] as [string, string]] : []),
    ['Statut', po.status],
    ['Date création', fmtDate(po.createdDate)],
  ];

  const demandRows: [string, string][] = [
    ['N° PR lié', po.prId],
    ...(pr ? [['Demandeur', pr.requester] as [string, string]] : []),
    ...(pr ? [['Département', pr.department] as [string, string]] : []),
    ...(pr?.bce ? [['BCE PR', pr.bce] as [string, string]] : []),
    ...(pr?.bci ? [['BCI PR', pr.bci] as [string, string]] : []),
  ];

  const cardH1 = drawInfoCard(doc, 14, y, cardW, 'Informations Fournisseur', supplierRows);
  drawInfoCard(doc, 14 + cardW + 6, y, cardW, 'Détails de la Demande', demandRows);
  y = Math.max(cardH1, y + 6 + demandRows.length * 6 + 18) + 8;

  // ── Tableau des lignes ───────────────────────────────────────────────────
  const lines = po.lines ?? [];
  const tableBody = lines.map((l, i) => [
    String(i + 1),
    l.product,
    String(l.quantity),
    fmtMAD(l.price),
    fmtMAD(l.quantity * l.price),
  ]);

  // Ligne Total
  tableBody.push(['', '', '', 'TOTAL TTC', fmtMAD(po.total)]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Désignation', 'Qté', 'Prix unitaire', 'Total']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 32 },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    bodyStyles: { fontSize: 8.5, textColor: TEXT_DARK },
    // Style ligne total
    didParseCell(data: any) {
      if (data.row.index === tableBody.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = BRAND_LIGHT;
        data.cell.styles.textColor = BRAND_BLUE;
        data.cell.styles.fontSize = 9;
      }
    },
    margin: { left: 14, right: 14 },
  });

  // ── Zone signatures ───────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 14;
  if (finalY < doc.internal.pageSize.getHeight() - 40) {
    const sigW = (pageW - 14 * 2 - 12) / 3;
    const sigLabels = ['Demandeur', 'Responsable Achat', 'Direction'];
    sigLabels.forEach((label, i) => {
      const sx = 14 + i * (sigW + 6);
      doc.setFillColor(248, 249, 252);
      doc.setDrawColor(...GRAY_LINE);
      doc.setLineWidth(0.3);
      doc.roundedRect(sx, finalY, sigW, 28, 2, 2, 'FD');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...BRAND_BLUE);
      doc.text(label, sx + sigW / 2, finalY + 6, { align: 'center' });

      // Ligne signature
      doc.setDrawColor(...GRAY_LINE);
      doc.setLineWidth(0.5);
      doc.line(sx + 8, finalY + 22, sx + sigW - 8, finalY + 22);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXT_GRAY);
      doc.text('Signature & Cachet', sx + sigW / 2, finalY + 27, { align: 'center' });
    });
  }

  drawFooter(doc, po.id);

  doc.save(`BC_${po.id}_${po.supplier.replace(/\s+/g, '_')}.pdf`);
}

// ─── BON DE LIVRAISON (BL) ───────────────────────────────────────────────────

export async function generateBonDeLivraison(
  po: PurchaseOrder,
  pr?: PurchaseRequest,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const blId = `BL-${po.id.replace(/^PO-?/, '')}`;

  // ── Header ────────────────────────────────────────────────────────────────
  let y = await drawHeader(doc, 'BON DE LIVRAISON', blId, 'Réceptionné le');

  // ── Badge statut ──────────────────────────────────────────────────────────
  const statusLabel = po.status === 'Received' ? 'RÉCEPTIONNÉ' : po.status.toUpperCase();
  const badgeColor: [number, number, number] =
    po.status === 'Received' ? [16, 185, 129] :
    po.status === 'Ordered'  ? [245, 158, 11] :
    BRAND_BLUE;
  doc.setFillColor(...badgeColor);
  doc.roundedRect(pageW - 14 - 40, y - 4, 40, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text(statusLabel, pageW - 14 - 20, y + 1.5, { align: 'center' });

  y += 8;

  // ── Cartes infos ──────────────────────────────────────────────────────────
  const cardW = (pageW - 14 * 2 - 6) / 2;

  const expedRows: [string, string][] = [
    ['Fournisseur', po.supplier],
    ['N° PO', po.id],
    ...(po.bce ? [['BCE', po.bce] as [string, string]] : []),
    ['Date commande', fmtDate(po.createdDate)],
  ];

  const receptRows: [string, string][] = [
    ['N° BL', blId],
    ['N° PR lié', po.prId],
    ...(pr ? [['Département', pr.department] as [string, string]] : []),
    ['Date réception', po.status === 'Received' ? fmtDate(new Date().toISOString()) : '—'],
    ['Réceptionné par', pr?.requester ?? '—'],
  ];

  const cardH1 = drawInfoCard(doc, 14, y, cardW, 'Expéditeur', expedRows);
  drawInfoCard(doc, 14 + cardW + 6, y, cardW, 'Réception', receptRows);
  y = Math.max(cardH1, y + 6 + receptRows.length * 6 + 18) + 8;

  // ── Tableau ───────────────────────────────────────────────────────────────
  const lines = po.lines ?? [];
  const tableBody = lines.map((l, i) => [
    String(i + 1),
    l.product,
    String(l.quantity),
    '', // Qté reçue (à remplir)
    '', // Conforme (✓/✗)
    '',  // Observations
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Désignation', 'Qté commandée', 'Qté reçue', 'Conforme', 'Observations']],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: BRAND_BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 20 },
    },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    bodyStyles: { fontSize: 8.5, minCellHeight: 10, textColor: TEXT_DARK },
    margin: { left: 14, right: 14 },
  });

  // ── Remarques & Signatures ────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Zone remarques
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 230, 138);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, finalY, pageW - 28, 20, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(120, 53, 15);
  doc.text('Remarques / Réserves :', 18, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXT_GRAY);
  doc.text('(indiquer toute anomalie constatée à la réception)', 18, finalY + 12);

  // Signatures
  const sigStart = finalY + 26;
  const sigW = (pageW - 14 * 2 - 12) / 3;
  const sigLabels = ['Livreur / Fournisseur', 'Agent de réception', 'Responsable Magasin'];
  sigLabels.forEach((label, i) => {
    const sx = 14 + i * (sigW + 6);
    doc.setFillColor(248, 249, 252);
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(sx, sigStart, sigW, 28, 2, 2, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND_BLUE);
    doc.text(label, sx + sigW / 2, sigStart + 6, { align: 'center' });

    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.5);
    doc.line(sx + 8, sigStart + 22, sx + sigW - 8, sigStart + 22);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_GRAY);
    doc.text('Signature & Date', sx + sigW / 2, sigStart + 27, { align: 'center' });
  });

  drawFooter(doc, blId);

  doc.save(`BL_${blId}_${po.supplier.replace(/\s+/g, '_')}.pdf`);
}
