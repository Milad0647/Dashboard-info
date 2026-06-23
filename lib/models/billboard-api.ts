export interface ExternalCampaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  client_name: string | null;
  client_phone: string | null;
  start_date: string;
  end_date: string;
  start_date_shamsi: string;
  end_date_shamsi: string;
  date_range_shamsi: string;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalBillboard {
  id: string;
  axis: string;
  code: string;
  area_sqm: number | null;
  width_m: number | null;
  length_m: number | null;
  provider_id: string | null;
  peak_visit_periods: string[];
  visit_volume_band: string | null;
  quality_tier: string | null;
  price: number | null;
  billboard_type: string | null;
  face_direction: string | null;
  has_backlight: boolean | null;
  has_light: boolean | null;
  latitude: number;
  longitude: number;
  address: string;
  image_url: string | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ExternalPaginatedMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ExternalCampaignsResponse {
  data: ExternalCampaign[];
}

export interface ExternalBillboardsResponse {
  data: ExternalBillboard[];
  meta?: ExternalPaginatedMeta;
}

export interface IntegrationBillboardImage {
  id: string;
  type: string;
  image_url: string | null;
  thumbnail_url: string | null;
}

export interface IntegrationBillboardDesign {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  start_date_shamsi: string;
  end_date_shamsi: string;
  date_range_shamsi: string;
  image_url: string | null;
  thumbnail_url: string | null;
  sort_order: number;
}

export interface IntegrationBillboard {
  assignment_id: string;
  billboard_id: string;
  name: string;
  axis: string;
  code: string;
  address: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  thumbnail_url: string | null;
  execution_image_url: string | null;
  execution_thumbnail_url: string | null;
  card_image_url: string | null;
  display_start: string | null;
  display_end: string | null;
  display_start_shamsi: string | null;
  display_end_shamsi: string | null;
  display_range_shamsi: string | null;
  notes: string | null;
  area_sqm: number | null;
  width_m: number | null;
  length_m: number | null;
  billboard_type: string | null;
  billboard_type_label: string | null;
  face_direction: string | null;
  face_direction_label: string | null;
  provider_id: string | null;
  provider_name: string | null;
  peak_visit_periods: string[];
  peak_visit_periods_labels: string[];
  visit_volume_band: string | null;
  visit_volume_band_label: string | null;
  quality_tier: string | null;
  quality_tier_label: string | null;
  price: number | null;
  has_backlight: boolean | null;
  has_light: boolean | null;
  images: IntegrationBillboardImage[];
  designs: IntegrationBillboardDesign[];
}

export interface IntegrationCampaign {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  client_name: string | null;
  client_phone: string | null;
  start_date: string;
  end_date: string;
  start_date_shamsi: string;
  end_date_shamsi: string;
  date_range_shamsi: string;
  status: string;
  is_active: boolean;
}

export interface CampaignIntegrationData {
  campaign: IntegrationCampaign;
  billboards: IntegrationBillboard[];
  meta: {
    billboards_count: number;
    generated_at: string;
  };
}

export interface CampaignIntegrationResponse {
  data: CampaignIntegrationData;
}

export function getExternalBillboardTag(externalId: string): string {
  return `map:${externalId}`;
}
