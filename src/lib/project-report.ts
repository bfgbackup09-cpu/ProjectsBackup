import ExcelJS from "exceljs";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { computeTraRow, invoicedByTra } from "@/lib/tra-costing";

async function fetchAll(projectId: string) {
  const tables = [
    "panels",
    "tracking_columns",
    "tracking_cells",
    "deliveries",
    "daily_production",
    "daily_plans",
    "monthly_plans",
    "monthly_manufacturing",
    "costing_entries",
    "costing_tra",
    "ecr_status",
    "one_pager_updates",
    "one_pager_financials",
    "outstanding_balance_weekly",
  ] as const;

  const out: Record<string, any[]> = {};
  await Promise.all(
    tables.map(async (t) => {
      const { data } = await supabase.from(t).select("*").eq("project_id", projectId);
      out[t] = data ?? [];
    }),
  );
  return out;
}

// Style helpers
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } } as const;
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 } as const;
const SUBHEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } } as const;
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as const;
const BORDER = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
} as const;

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL as any;
    cell.font = HEADER_FONT as any;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = BORDER as any;
  });
  row.height = 28;
}

function applyBorders(ws: ExcelJS.Worksheet) {
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      if (!cell.border) cell.border = BORDER as any;
    });
  });
}

function autoSize(ws: ExcelJS.Worksheet, min = 12, max = 50) {
  ws.columns.forEach((c) => {
    let m = min;
    c.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const len = v == null ? 0 : String(typeof v === "object" ? (v as any).text ?? JSON.stringify(v) : v).length;
      if (len > m) m = len;
    });
    c.width = Math.min(m + 2, max);
  });
}

function fmtDate(v: any) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toISOString().slice(0, 10);
}

// Friendly table writer (skips UUIDs, formats dates, labels columns)
function writeFriendlyTable(
  wb: ExcelJS.Workbook,
  sheetName: string,
  rows: any[],
  columns: { key: string; label: string; type?: "date" | "money" | "number" | "percent" | "text" }[],
  title?: string,
) {
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  let rowIdx = 1;
  if (title) {
    ws.mergeCells(rowIdx, 1, rowIdx, columns.length);
    const c = ws.getCell(rowIdx, 1);
    c.value = title;
    c.font = { bold: true, size: 14, color: { argb: "FF111827" } };
    c.alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(rowIdx).height = 24;
    rowIdx += 1;
  }
  const header = ws.getRow(rowIdx);
  columns.forEach((c, i) => (header.getCell(i + 1).value = c.label));
  styleHeaderRow(header);
  rowIdx += 1;

  if (!rows.length) {
    ws.mergeCells(rowIdx, 1, rowIdx, columns.length);
    const c = ws.getCell(rowIdx, 1);
    c.value = "(no data)";
    c.alignment = { horizontal: "center" };
    c.font = { italic: true, color: { argb: "FF6B7280" } };
  } else {
    for (const r of rows) {
      const row = ws.getRow(rowIdx);
      columns.forEach((col, i) => {
        const cell = row.getCell(i + 1);
        const raw = r[col.key];
        if (raw === null || raw === undefined || raw === "") {
          cell.value = "";
        } else if (col.type === "date") {
          cell.value = fmtDate(raw);
          cell.alignment = { horizontal: "center" };
        } else if (col.type === "money") {
          cell.value = Number(raw);
          cell.numFmt = '€#,##0.00;[Red](€#,##0.00);"-"';
          cell.alignment = { horizontal: "right" };
        } else if (col.type === "number") {
          cell.value = Number(raw);
          cell.numFmt = '#,##0;[Red](#,##0);"-"';
          cell.alignment = { horizontal: "right" };
        } else if (col.type === "percent") {
          cell.value = Number(raw) / 100;
          cell.numFmt = "0.0%";
          cell.alignment = { horizontal: "right" };
        } else {
          cell.value = String(raw);
          cell.alignment = { vertical: "top", wrapText: true };
        }
      });
      rowIdx += 1;
    }
  }
  autoSize(ws);
  applyBorders(ws);
  ws.views = [{ state: "frozen", ySplit: title ? 2 : 1 }];
  return ws;
}

async function captureCharts(): Promise<{ name: string; dataUrl: string }[]> {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-report-chart]"));
  const imgs: { name: string; dataUrl: string }[] = [];
  for (const node of nodes) {
    try {
      const dataUrl = await toPng(node, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      imgs.push({ name: node.getAttribute("data-report-chart") || "Chart", dataUrl });
    } catch (e) {
      console.warn("Chart capture failed", e);
    }
  }
  return imgs;
}

export async function generateProjectReport(project: any) {
  const data = await fetchAll(project.id);
  const charts = await captureCharts();

  const wb = new ExcelJS.Workbook();
  wb.creator = "BFG Planner";
  wb.created = new Date();

  // ---------- 1. PROJECT INFO ----------
  const info = wb.addWorksheet("Project Info");
  info.mergeCells("A1:B1");
  const titleCell = info.getCell("A1");
  titleCell.value = `Project Report — ${project.name ?? ""}`;
  titleCell.font = { bold: true, size: 16, color: { argb: "FF111827" } };
  info.getRow(1).height = 30;

  info.getRow(2).values = ["Field", "Value"];
  styleHeaderRow(info.getRow(2));

  const projectRows: [string, any][] = [
    ["Project Name", project.name],
    ["Customer", project.customer],
    ["End Customer", project.end_customer],
    ["OEM", project.oem],
    ["Site", project.site],
    ["Scope", project.scope],
    ["PO (FE)", project.po_fe],
    ["PO (CAB)", project.po_cab],
    ["Total Trainsets", project.trainsets],
    ["Start Date", fmtDate(project.start_date)],
    ["End Date", fmtDate(project.end_date)],
    ["Report Generated", new Date().toLocaleString()],
  ];
  projectRows.forEach(([k, v], i) => {
    const r = info.getRow(3 + i);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    r.getCell(1).fill = SUBHEADER_FILL as any;
    r.getCell(2).value = v ?? "";
  });
  info.getColumn(1).width = 26;
  info.getColumn(2).width = 60;
  applyBorders(info);

  // ---------- 2. SUMMARY KPIs ----------
  const panels = data.panels;
  const cells = data.tracking_cells;
  const cols = [...data.tracking_columns].sort(
    (a: any, b: any) => Number(a.position ?? 0) - Number(b.position ?? 0),
  );

  const cellMap = new Map<string, number>();
  for (const c of cells) cellMap.set(`${c.panel_id}::${c.column_id}`, Number(c.value || 0));

  const pcByPanel = new Map<string, number>();
  for (const c of cells) pcByPanel.set(c.panel_id, (pcByPanel.get(c.panel_id) ?? 0) + Number(c.value || 0));
  const producedTs = (id: string) => (pcByPanel.get(id) ?? 0) / 2;

  const poTotal = panels.reduce((s: number, p: any) => s + Number(p.price_eur || 0) * Number(p.po_quantity || 0), 0);
  const producedTotal = panels.reduce((s: number, p: any) => s + Number(p.price_eur || 0) * producedTs(p.id), 0);
  const balance = poTotal - producedTotal;
  const totalProducedQty = panels.reduce((s: number, p: any) => s + producedTs(p.id), 0);
  const totalPoQty = panels.reduce((s: number, p: any) => s + Number(p.po_quantity || 0), 0);
  const pct = totalPoQty ? (totalProducedQty / totalPoQty) * 100 : 0;

  const kpi = wb.addWorksheet("Summary");
  kpi.mergeCells("A1:B1");
  kpi.getCell("A1").value = "Project Summary";
  kpi.getCell("A1").font = { bold: true, size: 14 };
  kpi.getRow(2).values = ["Metric", "Value"];
  styleHeaderRow(kpi.getRow(2));
  const kpiRows: [string, any, string?][] = [
    ["PO Total Value", poTotal, "money"],
    ["Produced Value", producedTotal, "money"],
    ["Balance Value", balance, "money"],
    ["Total PO Quantity (PC)", totalPoQty, "number"],
    ["Total Produced (TS)", totalProducedQty, "number"],
    ["Progress", pct, "percent"],
    ["Panels Count", panels.length, "number"],
    ["PC Columns Count", cols.length, "number"],
    ["Deliveries Count", data.deliveries.length, "number"],
  ];
  kpiRows.forEach(([k, v, t], i) => {
    const r = kpi.getRow(3 + i);
    r.getCell(1).value = k;
    r.getCell(1).font = { bold: true };
    r.getCell(1).fill = SUBHEADER_FILL as any;
    const c = r.getCell(2);
    c.value = t === "percent" ? Number(v) / 100 : Number(v);
    c.numFmt =
      t === "money" ? '€#,##0.00;[Red](€#,##0.00);"-"' :
      t === "percent" ? "0.0%" :
      '#,##0;[Red](#,##0);"-"';
    c.alignment = { horizontal: "right" };
  });
  kpi.getColumn(1).width = 30;
  kpi.getColumn(2).width = 22;
  applyBorders(kpi);

  // ---------- 3. TRACKING SHEET (matrix, mirrors website) ----------
  const tracking = wb.addWorksheet("Tracking Sheet");
  // Row 1: title
  const colCount = 2 + cols.length + 1; // TRA + Description + N columns + Total
  tracking.mergeCells(1, 1, 1, colCount);
  tracking.getCell(1, 1).value = "Tracking Sheet — Panels × PC Columns";
  tracking.getCell(1, 1).font = { bold: true, size: 14 };
  tracking.getRow(1).height = 24;

  // Header rows: 3 sub-rows per PC column (Date / Invoice / Delivery Note) merged for TRA + Desc + Total
  // Row 2: Date row
  // Row 3: Invoice row
  // Row 4: Delivery note row
  const r2 = tracking.getRow(2);
  const r3 = tracking.getRow(3);
  const r4 = tracking.getRow(4);

  r2.getCell(1).value = "Panel TRA No.";
  r2.getCell(2).value = "Description";
  tracking.mergeCells(2, 1, 4, 1);
  tracking.mergeCells(2, 2, 4, 2);

  cols.forEach((col: any, i: number) => {
    const colIdx = 3 + i;
    r2.getCell(colIdx).value = col.column_date ? `Date: ${fmtDate(col.column_date)}` : `Column ${col.position ?? i + 1}`;
    r3.getCell(colIdx).value = col.invoice_no ? `Invoice: ${col.invoice_no}` : "Invoice: —";
    r4.getCell(colIdx).value = col.delivery_note ? `DN: ${col.delivery_note}` : "DN: —";
  });
  const totalColIdx = 3 + cols.length;
  r2.getCell(totalColIdx).value = "Total PC";
  tracking.mergeCells(2, totalColIdx, 4, totalColIdx);

  [r2, r3, r4].forEach(styleHeaderRow);

  // Data rows
  let rowI = 5;
  const sortedPanels = [...panels].sort((a: any, b: any) => Number(a.line_no ?? 0) - Number(b.line_no ?? 0));
  sortedPanels.forEach((p: any) => {
    const row = tracking.getRow(rowI);
    row.getCell(1).value = p.tra_code ?? "";
    row.getCell(1).font = { name: "Consolas", size: 10 };
    row.getCell(2).value = p.description ?? "";
    row.getCell(2).alignment = { wrapText: true, vertical: "top" };
    let total = 0;
    cols.forEach((col: any, i: number) => {
      const v = cellMap.get(`${p.id}::${col.id}`) ?? 0;
      const c = row.getCell(3 + i);
      if (v > 0) {
        c.value = v;
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } } as any;
        c.font = { bold: true, color: { argb: "FF1E3A8A" } };
      }
      c.alignment = { horizontal: "center" };
      total += v;
    });
    const tc = row.getCell(totalColIdx);
    tc.value = total;
    tc.font = { bold: true };
    tc.fill = TOTAL_FILL as any;
    tc.alignment = { horizontal: "right" };
    rowI += 1;
  });

  // Column totals
  const totalsRow = tracking.getRow(rowI);
  totalsRow.getCell(1).value = "Column Total";
  totalsRow.getCell(1).font = { bold: true };
  totalsRow.getCell(2).value = "";
  let grand = 0;
  cols.forEach((col: any, i: number) => {
    let t = 0;
    for (const p of panels) t += cellMap.get(`${p.id}::${col.id}`) ?? 0;
    grand += t;
    const c = totalsRow.getCell(3 + i);
    c.value = t;
    c.font = { bold: true };
    c.alignment = { horizontal: "center" };
  });
  const gc = totalsRow.getCell(totalColIdx);
  gc.value = grand;
  gc.font = { bold: true, color: { argb: "FF065F46" } };
  totalsRow.eachCell((c) => (c.fill = TOTAL_FILL as any));

  // Sizing
  tracking.getColumn(1).width = 18;
  tracking.getColumn(2).width = 42;
  cols.forEach((_, i) => (tracking.getColumn(3 + i).width = 14));
  tracking.getColumn(totalColIdx).width = 12;
  applyBorders(tracking);
  tracking.views = [{ state: "frozen", xSplit: 2, ySplit: 4 }];

  // ---------- 4. PANELS (PLANNING) ----------
  const panelRows = sortedPanels.map((p: any) => ({
    line_no: p.line_no,
    tra_code: p.tra_code,
    description: p.description,
    customer_no: p.customer_no,
    sales_order: p.sales_order,
    scope: p.scope,
    qty_per_ts: p.qty_per_ts,
    po_quantity: p.po_quantity,
    produced_ts: producedTs(p.id),
    balance_ts: Number(p.po_quantity || 0) - producedTs(p.id),
    price_eur: p.price_eur,
    po_value: Number(p.price_eur || 0) * Number(p.po_quantity || 0),
    produced_value: Number(p.price_eur || 0) * producedTs(p.id),
  }));
  writeFriendlyTable(
    wb,
    "Panels (Planning)",
    panelRows,
    [
      { key: "line_no", label: "Line #", type: "number" },
      { key: "tra_code", label: "TRA Code" },
      { key: "description", label: "Description" },
      { key: "customer_no", label: "Customer No." },
      { key: "sales_order", label: "Sales Order" },
      { key: "scope", label: "Scope" },
      { key: "qty_per_ts", label: "Qty / TS", type: "number" },
      { key: "po_quantity", label: "PO Qty", type: "number" },
      { key: "produced_ts", label: "Produced (TS)", type: "number" },
      { key: "balance_ts", label: "Balance (TS)", type: "number" },
      { key: "price_eur", label: "Unit Price", type: "money" },
      { key: "po_value", label: "PO Value", type: "money" },
      { key: "produced_value", label: "Produced Value", type: "money" },
    ],
    "Panels — Planning Overview",
  );

  // ---------- 5. DELIVERIES ----------
  writeFriendlyTable(
    wb,
    "Deliveries",
    data.deliveries.sort((a: any, b: any) => (a.delivery_date < b.delivery_date ? 1 : -1)),
    [
      { key: "delivery_date", label: "Date", type: "date" },
      { key: "mode", label: "Mode" },
      { key: "delivery_no", label: "Delivery No." },
      { key: "invoice_no", label: "Invoice No." },
      { key: "box_no", label: "Box No." },
      { key: "trainset", label: "Trainset" },
      { key: "total_qty", label: "Qty", type: "number" },
      { key: "total_value_eur", label: "Value", type: "money" },
      { key: "comments", label: "Comments" },
    ],
    "Deliveries",
  );

  // ---------- 6. DAILY PRODUCTION vs PLAN (combined) ----------
  const dailyMap = new Map<string, { date: string; planned: number; produced: number; notes: string }>();
  for (const p of data.daily_plans) {
    const k = fmtDate(p.plan_date);
    dailyMap.set(k, {
      date: k,
      planned: Number(p.planned_qty || 0),
      produced: 0,
      notes: p.notes || "",
    });
  }
  for (const a of data.daily_production) {
    const k = fmtDate(a.production_date);
    const e = dailyMap.get(k) ?? { date: k, planned: 0, produced: 0, notes: "" };
    e.produced = Number(a.produced_qty || 0);
    if (a.notes) e.notes = e.notes ? `${e.notes} | ${a.notes}` : a.notes;
    dailyMap.set(k, e);
  }
  const dailyRows = [...dailyMap.values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((d) => ({
      ...d,
      variance: d.produced - d.planned,
      achievement: d.planned > 0 ? (d.produced / d.planned) * 100 : 0,
    }));
  writeFriendlyTable(
    wb,
    "Daily Production vs Plan",
    dailyRows,
    [
      { key: "date", label: "Date", type: "date" },
      { key: "planned", label: "Planned Qty", type: "number" },
      { key: "produced", label: "Produced Qty", type: "number" },
      { key: "variance", label: "Variance", type: "number" },
      { key: "achievement", label: "Achievement %", type: "percent" },
      { key: "notes", label: "Notes" },
    ],
    "Daily Production vs Plan",
  );

  // ---------- 7. MONTHLY PRODUCTION vs PLAN (combined) ----------
  const monthMap = new Map<string, { month: string; planned: number; actual: number; otd: number; notes: string }>();
  for (const p of data.monthly_plans) {
    const k = fmtDate(p.month);
    monthMap.set(k, { month: k, planned: Number(p.planned_qty || 0), actual: 0, otd: 0, notes: p.notes || "" });
  }
  for (const m of data.monthly_manufacturing) {
    const k = fmtDate(m.month);
    const e = monthMap.get(k) ?? { month: k, planned: 0, actual: 0, otd: 0, notes: "" };
    e.planned = e.planned || Number(m.planned_qty || 0);
    e.actual = Number(m.actual_qty || 0);
    e.otd = Number(m.otd_percent || 0);
    if (m.notes) e.notes = e.notes ? `${e.notes} | ${m.notes}` : m.notes;
    monthMap.set(k, e);
  }
  const monthRows = [...monthMap.values()]
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .map((m) => ({
      ...m,
      variance: m.actual - m.planned,
      achievement: m.planned > 0 ? (m.actual / m.planned) * 100 : 0,
    }));
  writeFriendlyTable(
    wb,
    "Monthly Production vs Plan",
    monthRows,
    [
      { key: "month", label: "Month", type: "date" },
      { key: "planned", label: "Planned Qty", type: "number" },
      { key: "actual", label: "Actual Qty", type: "number" },
      { key: "variance", label: "Variance", type: "number" },
      { key: "achievement", label: "Achievement %", type: "percent" },
      { key: "otd", label: "OTD %", type: "percent" },
      { key: "notes", label: "Notes" },
    ],
    "Monthly Production vs Plan",
  );

  // ---------- 8. COSTING ----------
  writeFriendlyTable(
    wb,
    "Costing",
    data.costing_entries.sort((a: any, b: any) => (a.month < b.month ? 1 : -1)),
    [
      { key: "month", label: "Month", type: "date" },
      { key: "category", label: "Category" },
      { key: "item", label: "Item" },
      { key: "scope", label: "Scope" },
      { key: "price_eur", label: "Price", type: "money" },
      { key: "cost_eur", label: "Cost", type: "money" },
      { key: "notes", label: "Notes" },
    ],
    "Costing Entries",
  );

  // ---------- 8b. TRA COSTING BREAKDOWN (per month) ----------
  {
    const traSheet = wb.addWorksheet("TRA Breakdown");
    traSheet.getCell("A1").value = "TRA Costing Breakdown (per month)";
    traSheet.getCell("A1").font = { bold: true, size: 14 };
    traSheet.getRow(1).height = 24;

    const headers = [
      "Month", "TRA No.", "Invoiced Panels",
      "Selling Unit Price", "Selling Total",
      "Unit Material Cost", "Total Material Cost",
      "Panel Labour Cost", "Unit Packaging Labour", "Total Packaging Labour",
      "Total Labour Cost", "Total Cost",
      "G-Margin (EUR)", "G-Margin %",
    ];
    const hr = traSheet.getRow(2);
    headers.forEach((h, i) => (hr.getCell(i + 1).value = h));
    styleHeaderRow(hr);

    // Build per-month maps from stored costing_tra; also include any month that
    // has invoicing in tracking even if no row was saved yet (so report mirrors UI).
    const monthsSet = new Set<string>();
    for (const r of data.costing_tra) monthsSet.add(String(r.month).slice(0, 7));
    for (const c of data.tracking_columns) {
      if (c.invoice_no && c.column_date) monthsSet.add(String(c.column_date).slice(0, 7));
    }
    const months = Array.from(monthsSet).sort();

    let row = 3;
    let grand = { selling: 0, cost: 0 };

    for (const m of months) {
      const invMap = invoicedByTra({
        panels: data.panels,
        tracking_columns: data.tracking_columns,
        tracking_cells: data.tracking_cells,
        month: m,
      });
      const storedThisMonth = data.costing_tra.filter(
        (r: any) => String(r.month).slice(0, 7) === m,
      );
      const storedMap = new Map<string, any>(storedThisMonth.map((r: any) => [r.tra_code, r]));
      const tras = new Set<string>();
      invMap.forEach((q, t) => { if (q > 0) tras.add(t); });
      for (const s of storedThisMonth) tras.add(s.tra_code);
      if (tras.size === 0) continue;

      const monthSum = { selling: 0, material: 0, packaging: 0, panelLab: 0, labour: 0, cost: 0, invoiced: 0 };

      for (const tra of Array.from(tras).sort()) {
        const s = storedMap.get(tra) ?? {};
        const c = computeTraRow({
          tra_code: tra,
          invoiced_panels: invMap.get(tra) ?? 0,
          selling_unit_price_eur: Number(s.selling_unit_price_eur ?? 0),
          unit_material_cost_eur: Number(s.unit_material_cost_eur ?? 0),
          panel_labour_cost_eur: Number(s.panel_labour_cost_eur ?? 0),
          unit_packaging_labour_cost_eur: Number(s.unit_packaging_labour_cost_eur ?? 0),
        });
        const r = traSheet.getRow(row++);
        const cells: [number, any, ("money" | "number" | "percent" | "text")?][] = [
          [1, m, "text"],
          [2, tra, "text"],
          [3, c.invoiced_panels, "number"],
          [4, c.selling_unit_price_eur, "money"],
          [5, c.selling_total_eur, "money"],
          [6, c.unit_material_cost_eur, "money"],
          [7, c.total_material_eur, "money"],
          [8, c.panel_labour_cost_eur, "money"],
          [9, c.unit_packaging_labour_cost_eur, "money"],
          [10, c.total_packaging_labour_eur, "money"],
          [11, c.total_labour_eur, "money"],
          [12, c.total_cost_eur, "money"],
          [13, c.margin_eur, "money"],
          [14, c.margin_pct / 100, "percent"],
        ];
        cells.forEach(([i, v, t]) => {
          const cell = r.getCell(i);
          cell.value = v;
          if (t === "money") { cell.numFmt = '€#,##0.00;[Red](€#,##0.00);"-"'; cell.alignment = { horizontal: "right" }; }
          else if (t === "number") { cell.numFmt = '#,##0;[Red](#,##0);"-"'; cell.alignment = { horizontal: "right" }; }
          else if (t === "percent") { cell.numFmt = "0.0%"; cell.alignment = { horizontal: "right" }; }
        });

        monthSum.invoiced += c.invoiced_panels;
        monthSum.selling += c.selling_total_eur;
        monthSum.material += c.total_material_eur;
        monthSum.packaging += c.total_packaging_labour_eur;
        monthSum.panelLab += c.panel_labour_cost_eur;
        monthSum.labour += c.total_labour_eur;
        monthSum.cost += c.total_cost_eur;
      }

      // Month subtotal row
      const margin = monthSum.selling - monthSum.cost;
      const marginPct = monthSum.selling > 0 ? margin / monthSum.selling : 0;
      const sr = traSheet.getRow(row++);
      const subCells: [number, any, ("money" | "number" | "percent" | "text")?][] = [
        [1, `${m} subtotal`, "text"],
        [3, monthSum.invoiced, "number"],
        [5, monthSum.selling, "money"],
        [7, monthSum.material, "money"],
        [8, monthSum.panelLab, "money"],
        [10, monthSum.packaging, "money"],
        [11, monthSum.labour, "money"],
        [12, monthSum.cost, "money"],
        [13, margin, "money"],
        [14, marginPct, "percent"],
      ];
      subCells.forEach(([i, v, t]) => {
        const cell = sr.getCell(i);
        cell.value = v;
        cell.font = { bold: true };
        cell.fill = TOTAL_FILL as any;
        if (t === "money") { cell.numFmt = '€#,##0.00;[Red](€#,##0.00);"-"'; cell.alignment = { horizontal: "right" }; }
        else if (t === "number") { cell.numFmt = '#,##0;[Red](#,##0);"-"'; cell.alignment = { horizontal: "right" }; }
        else if (t === "percent") { cell.numFmt = "0.0%"; cell.alignment = { horizontal: "right" }; }
      });
      // Fill empty subtotal cells with total fill
      for (let i = 1; i <= 14; i++) {
        const cell = sr.getCell(i);
        if (!cell.fill) cell.fill = TOTAL_FILL as any;
      }

      grand.selling += monthSum.selling;
      grand.cost += monthSum.cost;
      row += 1; // spacer
    }

    // Grand total
    if (grand.selling > 0 || grand.cost > 0) {
      const gr = traSheet.getRow(row);
      gr.getCell(1).value = "Grand total";
      gr.getCell(5).value = grand.selling; gr.getCell(5).numFmt = '€#,##0.00';
      gr.getCell(12).value = grand.cost; gr.getCell(12).numFmt = '€#,##0.00';
      gr.getCell(13).value = grand.selling - grand.cost; gr.getCell(13).numFmt = '€#,##0.00';
      gr.getCell(14).value = grand.selling > 0 ? (grand.selling - grand.cost) / grand.selling : 0;
      gr.getCell(14).numFmt = "0.0%";
      gr.eachCell((c) => {
        c.font = { bold: true, color: { argb: "FF065F46" } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } } as any;
      });
    }

    autoSize(traSheet);
    applyBorders(traSheet);
    traSheet.views = [{ state: "frozen", ySplit: 2 }];
  }

  // ---------- 9. ECR STATUS ----------
  writeFriendlyTable(
    wb,
    "ECR Status",
    data.ecr_status,
    [
      { key: "cr_no", label: "CR No." },
      { key: "cr_status", label: "Status" },
      { key: "date_initiation", label: "Initiated", type: "date" },
      { key: "released_to_bids", label: "Released to BIDS", type: "date" },
      { key: "offer_sent_alstom", label: "Offer Sent", type: "date" },
      { key: "po_received_date", label: "PO Received", type: "date" },
      { key: "roa_remarks", label: "ROA Remarks" },
    ],
    "ECR Status",
  );

  // ---------- 10. ONE-PAGER UPDATES ----------
  writeFriendlyTable(
    wb,
    "One-Pager Updates",
    data.one_pager_updates.sort((a: any, b: any) => (a.week_of < b.week_of ? 1 : -1)),
    [
      { key: "week_of", label: "Week Of", type: "date" },
      { key: "topic", label: "Topic" },
      { key: "ongoing_progress", label: "Ongoing Progress" },
      { key: "challenges", label: "Challenges" },
      { key: "action_plan", label: "Action Plan" },
      { key: "quality_notes", label: "Quality Notes" },
      { key: "outstanding_balance_eur", label: "Outstanding Balance", type: "money" },
    ],
    "Weekly One-Pager Updates",
  );

  // ---------- 11. ONE-PAGER FINANCIALS ----------
  writeFriendlyTable(
    wb,
    "Financials",
    data.one_pager_financials.sort((a: any, b: any) => (a.month < b.month ? 1 : -1)),
    [
      { key: "month", label: "Month", type: "date" },
      { key: "total_po_value_eur", label: "Total PO Value", type: "money" },
      { key: "invoiced_value_eur", label: "Invoiced Value", type: "money" },
      { key: "notes", label: "Notes" },
    ],
    "Monthly Financials",
  );

  // ---------- 12. OUTSTANDING BALANCE ----------
  writeFriendlyTable(
    wb,
    "Outstanding Balance",
    data.outstanding_balance_weekly.sort((a: any, b: any) => (a.week_of < b.week_of ? 1 : -1)),
    [
      { key: "week_of", label: "Week Of", type: "date" },
      { key: "amount_eur", label: "Amount", type: "money" },
      { key: "notes", label: "Notes" },
    ],
    "Weekly Outstanding Balance",
  );

  // ---------- 13. CHARTS ----------
  if (charts.length) {
    const cs = wb.addWorksheet("Charts");
    cs.getCell("A1").value = "Dashboard Charts";
    cs.getCell("A1").font = { bold: true, size: 16 };
    let row = 3;
    for (const chart of charts) {
      cs.getCell(`A${row}`).value = chart.name;
      cs.getCell(`A${row}`).font = { bold: true, size: 13, color: { argb: "FF1F2937" } };
      row += 1;
      const imgId = wb.addImage({ base64: chart.dataUrl, extension: "png" });
      cs.addImage(imgId, {
        tl: { col: 0, row },
        ext: { width: 800, height: 400 },
      });
      row += 24;
    }
    cs.getColumn(1).width = 110;
  }

  // ---------- WRITE & DOWNLOAD ----------
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (project.name || "project").replace(/[^a-z0-9_-]+/gi, "_");
  a.download = `${safeName}_report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
