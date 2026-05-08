import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../../shared/models/api-response.model';

interface PresignedResponse {
  uploadUrl: string;
  publicUrl: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  uploadImage(file: File): Observable<string> {
    const ext = file.name.split('.').pop()!;

    return this.http.get<ApiSuccess<PresignedResponse>>(
      `${this.apiUrl}/api/upload/presigned-url`,
      { params: { mimeType: file.type, ext, size: file.size.toString() } }
    ).pipe(
      switchMap(res => {
        return this.http.put(res.data.uploadUrl, file, {
          headers: { 'Content-Type': file.type }
        }).pipe(
          map(() => res.data.publicUrl)
        );
      })
    );
  }
}
