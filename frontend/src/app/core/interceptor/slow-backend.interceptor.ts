import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SlowBackendNoticeService } from '../services/slow-backend-notice.service';

/** Avisa si un pedido al backend tarda demasiado (ver {@link SlowBackendNoticeService}); el pedido sigue igual. */
export const slowBackendInterceptor: HttpInterceptorFn = (req, next) =>
  inject(SlowBackendNoticeService).watch(req.url, next(req));
