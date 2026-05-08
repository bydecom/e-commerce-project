import { Request, Response } from 'express';
import { getPresignedUploadUrl } from './upload.service';
import { httpError } from '../../utils/http-error';
import { success } from '../../utils/response';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const presignedUrl = async (req: Request, res: Response) => {
  const { mimeType, ext, size } = req.query as { mimeType?: string; ext?: string; size?: string };

  if (!mimeType || !ext) {
    throw httpError(400, 'mimeType and ext are required');
  }

  if (size && parseInt(size, 10) > MAX_FILE_SIZE) {
    throw httpError(400, 'File too large (max 5MB)');
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(mimeType)) {
    throw httpError(400, 'Unsupported file type');
  }

  const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  if (!allowedExts.includes(ext.toLowerCase())) {
    throw httpError(400, 'Unsupported file extension');
  }

  const result = await getPresignedUploadUrl(mimeType, ext);
  res.json(success(result, 'Presigned URL created successfully'));
};
