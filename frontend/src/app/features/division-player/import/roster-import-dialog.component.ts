import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, catchError, forkJoin, from, map, of, switchMap, tap } from 'rxjs';
import type * as XLSX from 'xlsx';
import { DivisionPlayerService } from 'src/app/services/division-player.service';
import {
  ROSTER_COLUMNS,
  ROSTER_TEMPLATE_FILE_NAME,
  buildRosterTemplate,
  isSupportedRosterFile,
  parseRosterSheet,
  readRosterSheet
} from './roster-import';
import {
  ParsedRosterRow,
  RosterField,
  RosterImportResult,
  RosterImportRowRequest,
  RosterImportRowResult,
  RosterParseResult
} from './roster-import.types';

type DialogPhase = 'pick' | 'checking' | 'preview' | 'importing';
type PreviewStatus = 'READY' | 'DUPLICATE' | 'INVALID';
type PreviewFilter = 'ALL' | PreviewStatus;

interface PreviewReason {
  column: string | null;
  message: string;
}

interface PreviewRow {
  rowNumber: number;
  displayName: string;
  status: PreviewStatus;
  reasons: PreviewReason[];
  request: RosterImportRowRequest | null;
}

export interface RosterImportOutcome {
  imported: number;
  skipped: number;
}

const COLUMN_HEADER = new Map<RosterField, string>(ROSTER_COLUMNS.map(column => [column.field, column.header]));

/** SheetJS pesa ~400 KB: se carga recién cuando el usuario elige un archivo o pide la plantilla. */
function loadXlsx(): Promise<typeof XLSX> {
  return import('xlsx');
}

@Component({
  selector: 'app-roster-import-dialog',
  standalone: true,
  templateUrl: './roster-import-dialog.component.html',
  styleUrls: ['./roster-import-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RosterImportDialogComponent {
  private readonly divisionPlayerService = inject(DivisionPlayerService);

  readonly divisionId = input.required<string>();
  readonly divisionName = input<string>('');

  readonly closed = output<void>();
  readonly imported = output<RosterImportOutcome>();
  readonly failed = output<string>();

  readonly columns = ROSTER_COLUMNS;
  readonly phase = signal<DialogPhase>('pick');
  readonly fileName = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly dragging = signal(false);
  readonly filter = signal<PreviewFilter>('ALL');

  private readonly parsed = signal<RosterParseResult | null>(null);
  private readonly serverRows = signal<Map<number, RosterImportRowResult>>(new Map());
  private readonly fileSelected = new Subject<File>();

  readonly previewRows = computed<PreviewRow[]>(() => {
    const parsed = this.parsed();
    const serverRows = this.serverRows();
    return (parsed?.rows ?? []).map(row => this.toPreviewRow(row, serverRows.get(row.rowNumber)));
  });

  readonly readyRows = computed(() => this.previewRows().filter(row => row.status === 'READY'));
  readonly duplicateCount = computed(() => this.previewRows().filter(row => row.status === 'DUPLICATE').length);
  readonly invalidCount = computed(() => this.previewRows().filter(row => row.status === 'INVALID').length);

  readonly visibleRows = computed(() => {
    const filter = this.filter();
    const rows = this.previewRows();
    return filter === 'ALL' ? rows : rows.filter(row => row.status === filter);
  });

  readonly busy = computed(() => this.phase() === 'checking' || this.phase() === 'importing');

  constructor() {
    this.fileSelected.pipe(
      tap(file => this.startChecking(file)),
      switchMap(file => this.checkFile(file)),
      takeUntilDestroyed()
    ).subscribe(result => this.finishChecking(result));
  }

  // <==================== Selección del archivo ====================>

  onFileInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const file = inputElement.files?.[0];
    inputElement.value = '';
    if (file) {
      this.selectFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDragLeave(): void {
    this.dragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.selectFile(file);
    }
  }

  private selectFile(file: File): void {
    if (this.busy()) {
      return;
    }
    if (!isSupportedRosterFile(file.name)) {
      this.fileName.set(file.name);
      this.fileError.set('El archivo tiene que ser una planilla .xlsx, .xls o .csv.');
      this.parsed.set(null);
      this.phase.set('pick');
      return;
    }
    this.fileSelected.next(file);
  }

  private startChecking(file: File): void {
    this.fileName.set(file.name);
    this.fileError.set(null);
    this.parsed.set(null);
    this.serverRows.set(new Map());
    this.filter.set('ALL');
    this.phase.set('checking');
  }

  /** Lee la planilla en el navegador y pide al backend la vista previa (dryRun) de las filas sin errores de formato. */
  private checkFile(file: File): Observable<{ parsed: RosterParseResult; preview: RosterImportResult | null; error: string | null }> {
    return forkJoin({ xlsx: from(loadXlsx()), data: from(file.arrayBuffer()) }).pipe(
      map(({ xlsx, data }) => parseRosterSheet(readRosterSheet(xlsx, data, file.name))),
      switchMap(parsed => {
        const rows = parsed.rows.flatMap(row => (row.request ? [row.request] : []));
        if (parsed.fileError || rows.length === 0) {
          return of({ parsed, preview: null, error: null });
        }
        return this.divisionPlayerService.importRoster({ divisionId: this.divisionId(), dryRun: true, rows }).pipe(
          map(preview => ({ parsed, preview, error: null })),
          catchError((err: HttpErrorResponse) => of({ parsed, preview: null, error: errorMessage(err, 'No se pudo revisar la planilla con el servidor.') }))
        );
      }),
      catchError(() => of({
        parsed: { fileError: 'No se pudo leer el archivo. Revisá que sea una planilla válida.', rows: [] },
        preview: null,
        error: null
      }))
    );
  }

  private finishChecking(result: { parsed: RosterParseResult; preview: RosterImportResult | null; error: string | null }): void {
    if (result.error) {
      this.parsed.set(null);
      this.fileError.set(result.error);
      this.phase.set('pick');
      return;
    }
    if (result.parsed.fileError) {
      this.parsed.set(null);
      this.fileError.set(result.parsed.fileError);
      this.phase.set('pick');
      return;
    }
    this.parsed.set(result.parsed);
    this.serverRows.set(new Map((result.preview?.rows ?? []).map(row => [row.rowNumber, row])));
    this.phase.set('preview');
  }

  // <==================== Importación ====================>

  confirmImport(): void {
    const rows = this.readyRows().flatMap(row => (row.request ? [row.request] : []));
    if (rows.length === 0 || this.busy()) {
      return;
    }
    const totalRows = this.previewRows().length;
    this.phase.set('importing');
    this.divisionPlayerService.importRoster({ divisionId: this.divisionId(), dryRun: false, rows }).subscribe({
      next: result => this.imported.emit({ imported: result.imported, skipped: totalRows - result.imported }),
      error: (err: HttpErrorResponse) => {
        this.phase.set('preview');
        this.failed.emit(errorMessage(err, 'No se pudo importar el plantel.'));
      }
    });
  }

  chooseAnotherFile(): void {
    if (this.busy()) {
      return;
    }
    this.parsed.set(null);
    this.serverRows.set(new Map());
    this.fileName.set(null);
    this.fileError.set(null);
    this.phase.set('pick');
  }

  async downloadTemplate(): Promise<void> {
    const xlsx = await loadXlsx();
    xlsx.writeFile(buildRosterTemplate(xlsx), ROSTER_TEMPLATE_FILE_NAME);
  }

  close(): void {
    if (this.phase() !== 'importing') {
      this.closed.emit();
    }
  }

  // <==================== Presentación ====================>

  statusLabel(status: PreviewStatus): string {
    switch (status) {
      case 'READY':
        return 'Lista';
      case 'DUPLICATE':
        return 'Duplicada';
      default:
        return 'Con errores';
    }
  }

  private toPreviewRow(row: ParsedRosterRow, server: RosterImportRowResult | undefined): PreviewRow {
    if (row.issues.length > 0) {
      return {
        rowNumber: row.rowNumber,
        displayName: row.displayName,
        status: 'INVALID',
        reasons: row.issues.map(issue => ({ column: issue.column, message: issue.message })),
        request: null
      };
    }
    if (server && (server.status === 'DUPLICATE' || server.status === 'INVALID')) {
      return {
        rowNumber: row.rowNumber,
        displayName: row.displayName,
        status: server.status,
        reasons: [{ column: server.field ? COLUMN_HEADER.get(server.field) ?? null : null, message: server.message ?? '' }],
        request: null
      };
    }
    return { rowNumber: row.rowNumber, displayName: row.displayName, status: 'READY', reasons: [], request: row.request };
  }
}

function errorMessage(err: HttpErrorResponse, fallback: string): string {
  if (typeof err.error === 'string' && err.error) {
    return err.error;
  }
  const message = (err.error as { message?: string } | null)?.message;
  return message || fallback;
}
