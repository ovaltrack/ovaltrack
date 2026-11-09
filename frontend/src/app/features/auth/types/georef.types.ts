/** Provincia según la API Georef (apis.datos.gob.ar). */
export interface Province {
  id: string;
  nombre: string;
}

export interface GeorefProvincesResponse {
  provincias: Province[];
}

export interface GeorefLocalitiesResponse {
  localidades: { nombre: string }[];
}
