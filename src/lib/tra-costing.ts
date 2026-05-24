// Helpers for the per-month TRA costing breakdown.

export type TraCostingRow = {
  id?: string;
  tra_code: string;
  description?: string | null;
  invoiced_panels: number;
  selling_unit_price_eur: number;
  unit_material_cost_eur: number;
  panel_labour_cost_eur: number;
  unit_packaging_labour_cost_eur: number;
};

export type TraCostingComputed = TraCostingRow & {
  selling_total_eur: number;
  total_material_eur: number;
  total_packaging_labour_eur: number;
  total_labour_eur: number;
  total_cost_eur: number;
  margin_eur: number;
  margin_pct: number;
};

export function computeTraRow(r: TraCostingRow): TraCostingComputed {
  const inv = Number(r.invoiced_panels || 0);
  const sellingTotal = inv * Number(r.selling_unit_price_eur || 0);
  const totalMaterial = inv * Number(r.unit_material_cost_eur || 0);
  const totalPackagingLabour = inv * Number(r.unit_packaging_labour_cost_eur || 0);
  const panelLabour = Number(r.panel_labour_cost_eur || 0);
  const totalLabour = totalPackagingLabour + panelLabour;
  const totalCost = totalMaterial + totalLabour;
  const margin = sellingTotal - totalCost;
  const marginPct = sellingTotal > 0 ? (margin / sellingTotal) * 100 : 0;
  return {
    ...r,
    selling_total_eur: sellingTotal,
    total_material_eur: totalMaterial,
    total_packaging_labour_eur: totalPackagingLabour,
    total_labour_eur: totalLabour,
    total_cost_eur: totalCost,
    margin_eur: margin,
    margin_pct: marginPct,
  };
}

// Given raw tables, compute invoiced PC quantity per TRA for a given YYYY-MM month.
// Invoiced = sum of tracking_cells.value for columns that have an invoice_no AND
// fall inside the month, grouped by the panel's TRA code.
export function invoicedByTra(args: {
  panels: any[];
  tracking_columns: any[];
  tracking_cells: any[];
  month: string; // "YYYY-MM"
}): Map<string, number> {
  const { panels, tracking_columns, tracking_cells, month } = args;
  const panelTra = new Map<string, string>();
  for (const p of panels) panelTra.set(p.id, p.tra_code || "—");
  const validCols = new Set<string>();
  for (const c of tracking_columns) {
    if (!c.invoice_no) continue;
    const d = c.column_date ? String(c.column_date).slice(0, 7) : null;
    if (d === month) validCols.add(c.id);
  }
  const out = new Map<string, number>();
  for (const cell of tracking_cells) {
    if (!validCols.has(cell.column_id)) continue;
    const tra = panelTra.get(cell.panel_id);
    if (!tra) continue;
    out.set(tra, (out.get(tra) ?? 0) + Number(cell.value || 0));
  }
  return out;
}
