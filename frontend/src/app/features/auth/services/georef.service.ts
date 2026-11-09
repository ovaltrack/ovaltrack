import { HttpBackend, HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';
import { GeorefLocalitiesResponse, GeorefProvincesResponse, Province } from '../types/georef.types';

const GEOREF_URL = 'https://apis.datos.gob.ar/georef/api';
/** En CABA las "localidades" de Georef son barrios: la ciudad es la propia CABA. */
const CABA_ID = '02';
const CABA_NAME = 'Ciudad Autónoma de Buenos Aires';

/**
 * Provincias y ciudades de Argentina (API oficial Georef). Se cachean en memoria.
 * Usa HttpBackend para saltear los interceptores: el JWT de la sesión no viaja a un dominio externo
 * y un error de Georef no dispara el cierre de sesión del interceptor.
 */
@Injectable({ providedIn: 'root' })
export class GeorefService {
  private readonly http = new HttpClient(inject(HttpBackend));
  private provinces$?: Observable<Province[]>;
  private readonly citiesByProvince = new Map<string, Observable<string[]>>();

  provinces(): Observable<Province[]> {
    this.provinces$ ??= this.http
      .get<GeorefProvincesResponse>(`${GEOREF_URL}/provincias`, { params: { campos: 'id,nombre', max: 30 } })
      .pipe(
        map((res) => [...res.provincias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.provinces$;
  }

  /** Nombres de ciudades/localidades de la provincia, sin repetidos y ordenados. */
  cities(provinceId: string): Observable<string[]> {
    const cached = this.citiesByProvince.get(provinceId);
    if (cached) return cached;

    const params = new HttpParams().set('provincia', provinceId).set('campos', 'nombre').set('max', 5000);
    const cities$ = this.http.get<GeorefLocalitiesResponse>(`${GEOREF_URL}/localidades`, { params }).pipe(
      map((res) =>
        provinceId === CABA_ID
          ? [CABA_NAME]
          : [...new Set(res.localidades.map((l) => l.nombre))].sort((a, b) => a.localeCompare(b, 'es')),
      ),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.citiesByProvince.set(provinceId, cities$);
    return cities$;
  }
}
