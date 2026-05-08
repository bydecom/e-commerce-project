import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { s3Client, BUCKET_NAME } from '../../config/storage';

export const getPresignedUploadUrl = async (mimetype: string, extension: string) => {
  const key = `products/${uuidv4()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: mimetype,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  const publicUrl = process.env.AWS_ENDPOINT
    ? `${process.env.AWS_ENDPOINT}/${BUCKET_NAME}/${key}`
    : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

  return { uploadUrl, publicUrl };
};

export const deleteFile = async (key: string) => {
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
};
