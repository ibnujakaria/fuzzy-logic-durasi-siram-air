const BMKG_API = "https://api.bmkg.go.id/publik/prakiraan-cuaca";

export interface WeatherEntry {
  datetime: string;
  local_datetime: string;
  t: number;
  hu: number;
  weather: number;
  weather_desc: string;
  weather_desc_en: string;
  tcc: number;
  tp: number;
  ws: number;
  wd: string;
  wd_deg: number;
  vs: number;
  vs_text: string;
  image: string;
}

export interface LocationInfo {
  adm1: string;
  adm2: string;
  adm3: string;
  adm4: string;
  provinsi: string;
  kotkab: string;
  kecamatan: string;
  desa: string;
  lon: number;
  lat: number;
  timezone: string;
}

export interface BmkgResponse {
  lokasi: LocationInfo;
  data: Array<{
    lokasi: LocationInfo;
    cuaca: WeatherEntry[][];
  }>;
}

export async function fetchWeatherData(locationId: string): Promise<BmkgResponse> {
  const response = await fetch(`${BMKG_API}?adm4=${locationId}`);
  if (!response.ok) {
    throw new Error(`BMKG API error: ${response.status}`);
  }
  return response.json() as Promise<BmkgResponse>;
}

export function getLocationInfo(data: BmkgResponse): LocationInfo {
  return data.data[0].lokasi;
}

export function getRainProbabilityNext3Hours(data: BmkgResponse): WeatherEntry[] {
  const cuaca = data.data[0].cuaca.flat();
  const now = new Date();
  const threeHoursLater = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  return cuaca.filter((item) => {
    const dt = new Date(item.local_datetime);
    return dt >= now && dt <= threeHoursLater;
  });
}
