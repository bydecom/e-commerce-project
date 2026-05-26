import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, map, from } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccess } from '../../shared/models/api-response.model';
import imageCompression from 'browser-image-compression';

interface PresignedResponse {
  uploadUrl: string;
  publicUrl: string;
}

@Injectable({ providedIn: 'root' })
export class UploadService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  uploadImage(file: File): Observable<string> {
    // Cấu hình nén ảnh tối ưu
    const options = {
      maxSizeMB: 0.3, // Nén tối đa 300KB
      maxWidthOrHeight: 1200, // Giới hạn chiều rộng/cao tối đa 1200px
      useWebWorker: true, // Chạy ngầm trong Web Worker tránh block UI thread
      fileType: 'image/webp' // Tự động convert sang định dạng WebP siêu nhẹ!
    };

    return from(imageCompression(file, options)).pipe(
      switchMap((compressedBlob) => {
        // Tạo File mới từ Blob đã nén với đuôi mở rộng .webp
        const originalNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || 'image';
        const fileName = `${originalNameWithoutExt}.webp`;
        const fileToUpload = new File([compressedBlob], fileName, {
          type: 'image/webp',
          lastModified: Date.now()
        });

        const ext = 'webp';

        return this.http.get<ApiSuccess<PresignedResponse>>(
          `${this.apiUrl}/api/upload/presigned-url`,
          { params: { mimeType: fileToUpload.type, ext, size: fileToUpload.size.toString() } }
        ).pipe(
          switchMap(res => {
            return this.http.put(res.data.uploadUrl, fileToUpload, {
              headers: { 'Content-Type': fileToUpload.type }
            }).pipe(
              map(() => res.data.publicUrl)
            );
          })
        );
      })
    );
  }
}
