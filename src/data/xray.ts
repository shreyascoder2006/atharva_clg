/**
 * The three trade documents compared field by field, per shipment.
 *
 * SHP-2611-0482 carries the seeded gross-weight discrepancy (see XRAY_FIX). The other
 * two reconcile cleanly, which is what most shipments look like.
 */
import { FLEET } from './fleet';
import { SHIPMENT, XRAY_LAYOUT, XRAY_VALUES, type XrayFieldKey, type ShipmentId } from './shipment';

export interface XrayDocSpec {
  /** Position key for connectors, and the document id used for RBAC lookups. */
  id: 'ci' | 'pl' | 'ebl' | 'awb';
  title: string;
  ref: string;
  issuer: string;
  accent: string;
  order: XrayFieldKey[];
  values: Record<XrayFieldKey, string>;
  extras: { label: string; value: string; pricing?: boolean }[];
}

export interface XraySet {
  fieldLabels: Record<XrayFieldKey, string>;
  docs: [XrayDocSpec, XrayDocSpec, XrayDocSpec];
}

const LABELS: Record<XrayFieldKey, string> = { consignee: 'Consignee', hs: 'HS Code', gross: 'Gross Weight', container: 'Container #' };

const surat = FLEET['SHP-2611-0494'];
const suratValues: Record<XrayFieldKey, string> = {
  consignee: 'Al Noor Textile Trading LLC, Dubai',
  hs: surat.hsCode,
  gross: '24,600 kg',
  container: surat.unit.ref,
};
const blr = FLEET['SHP-2611-0519'];
const blrValues: Record<XrayFieldKey, string> = {
  consignee: 'Rhein-Main Pharma Distribution GmbH',
  hs: blr.hsCode,
  gross: '1,840 kg',
  container: '2 × PMC · 14 pcs',
};

export const XRAY_SETS: Record<ShipmentId, XraySet> = {
  'SHP-2611-0482': {
    fieldLabels: LABELS,
    docs: [
      {
        id: 'ci',
        title: 'Commercial Invoice',
        ref: 'DPC/EXP/26-27/0482',
        issuer: SHIPMENT.shipper,
        accent: '#2563EB',
        order: XRAY_LAYOUT.ci,
        values: XRAY_VALUES.ci,
        extras: [
          { label: 'Incoterm', value: SHIPMENT.incoterm },
          { label: 'Invoice value', value: `USD ${SHIPMENT.invoiceValueUsd.toLocaleString('en-US')}.00`, pricing: true },
          { label: 'Unit price', value: 'USD 129.46 / pc · 1,440 pcs', pricing: true },
          { label: 'Net weight', value: '11,620 kg' },
        ],
      },
      {
        id: 'pl',
        title: 'Packing List',
        ref: 'PL-0482',
        issuer: SHIPMENT.shipper,
        accent: '#7C3AED',
        order: XRAY_LAYOUT.pl,
        values: XRAY_VALUES.pl,
        extras: [
          { label: 'Packages', value: '36 pallets · 1,440 pcs' },
          { label: 'Pallet tare', value: '36 × 34.2 kg' },
          { label: 'Net weight', value: '11,620 kg' },
          { label: 'Dimensions', value: '1.2 × 1.0 × 1.05 m' },
        ],
      },
      {
        id: 'ebl',
        title: 'e-Bill of Lading',
        ref: 'KMOL-047W-0482',
        issuer: 'Arabian Gateway Logistics (as agent)',
        accent: '#0284C7',
        order: XRAY_LAYOUT.ebl,
        values: XRAY_VALUES.ebl,
        extras: [
          { label: 'Vessel / voyage', value: `${SHIPMENT.vessel} ${SHIPMENT.voyage}` },
          { label: 'POL → POD', value: 'INNSA → NLRTM' },
          { label: 'Seal', value: SHIPMENT.seal },
          { label: 'Freight', value: 'Prepaid' },
        ],
      },
    ],
  },
  'SHP-2611-0494': {
    fieldLabels: LABELS,
    docs: [
      {
        id: 'ci',
        title: 'Commercial Invoice',
        ref: 'TTT/EXP/26-27/0494',
        issuer: surat.parties.exporter.org,
        accent: '#2563EB',
        order: XRAY_LAYOUT.ci,
        values: suratValues,
        extras: [
          { label: 'Incoterm', value: surat.incoterm },
          { label: 'Invoice value', value: `USD ${surat.valueUsd.toLocaleString('en-US')}.00`, pricing: true },
          { label: 'Unit price', value: 'USD 3.94 / kg net', pricing: true },
          { label: 'Net weight', value: '23,860 kg' },
        ],
      },
      {
        id: 'pl',
        title: 'Packing List',
        ref: 'PL-0494',
        issuer: surat.parties.exporter.org,
        accent: '#7C3AED',
        order: XRAY_LAYOUT.pl,
        values: suratValues,
        extras: [
          { label: 'Packages', value: '288 bobbin cases' },
          { label: 'Case tare', value: '288 × 2.57 kg' },
          { label: 'Net weight', value: '23,860 kg' },
          { label: 'Denier', value: '75D / 36F FDY' },
        ],
      },
      {
        id: 'ebl',
        title: 'e-Bill of Lading',
        ref: 'KPL-112E-0494',
        issuer: 'Arabian Gateway Logistics (as agent)',
        accent: '#0284C7',
        order: XRAY_LAYOUT.ebl,
        values: suratValues,
        extras: [
          { label: 'Vessel / voyage', value: surat.carrier },
          { label: 'POL → POD', value: 'INMUN → AEJEA' },
          { label: 'Seal', value: 'ES-7730459' },
          { label: 'Freight', value: 'Prepaid' },
        ],
      },
    ],
  },
  'SHP-2611-0519': {
    fieldLabels: { ...LABELS, container: 'ULD / pieces' },
    docs: [
      {
        id: 'ci',
        title: 'Commercial Invoice',
        ref: 'KBL/EXP/26-27/0519',
        issuer: blr.parties.exporter.org,
        accent: '#2563EB',
        order: XRAY_LAYOUT.ci,
        values: blrValues,
        extras: [
          { label: 'Incoterm', value: blr.incoterm },
          { label: 'Invoice value', value: `USD ${blr.valueUsd.toLocaleString('en-US')}.00`, pricing: true },
          { label: 'Unit price', value: 'USD 14.20 / vial', pricing: true },
          { label: 'Batch', value: 'KB-2611' },
        ],
      },
      {
        id: 'pl',
        title: 'Packing List',
        ref: 'PL-0519',
        issuer: blr.parties.exporter.org,
        accent: '#7C3AED',
        order: XRAY_LAYOUT.pl,
        values: blrValues,
        extras: [
          { label: 'Packages', value: '14 insulated shippers' },
          { label: 'Temperature', value: '2–8 °C · logger TL-0519' },
          { label: 'Net weight', value: '1,512 kg' },
          { label: 'Volume', value: '9.8 m³' },
        ],
      },
      {
        id: 'awb',
        title: 'House Air Waybill',
        ref: 'AGL-HAWB-BLR-0519',
        issuer: 'Arabian Gateway Logistics (as agent)',
        accent: '#0284C7',
        order: XRAY_LAYOUT.ebl,
        values: blrValues,
        extras: [
          { label: 'Flight', value: 'SKB 761 · BLR → FRA' },
          { label: 'Handling', value: 'PIL · COL · EAP' },
          { label: 'Chargeable', value: '1,960 kg' },
          { label: 'Charges', value: 'Prepaid' },
        ],
      },
    ],
  },
};
