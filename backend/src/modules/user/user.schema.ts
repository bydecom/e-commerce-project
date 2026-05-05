import { z } from 'zod';

const optionalTrimmed = z.string().trim().nullable().optional();
const optionalTrimmedMax = (max: number) => z.string().trim().max(max).nullable().optional();

export const updateMeSchema = z.object({
  name:          optionalTrimmedMax(100),
  phone:         optionalTrimmedMax(30),
  provinceId:    optionalTrimmed,
  districtId:    optionalTrimmed,
  wardId:        optionalTrimmed,
  streetAddress: optionalTrimmedMax(200),
  fullAddress:   optionalTrimmedMax(500),
}).superRefine((d, ctx) => {
  const hasProvince = Boolean(d.provinceId?.trim());
  const hasWard = Boolean(d.wardId?.trim());
  const hasStreet = Boolean(d.streetAddress?.trim());

  const anyDelivery = hasProvince || hasWard || hasStreet;
  if (!anyDelivery) return;

  if (!hasProvince) {
    ctx.addIssue({
      code: 'custom' as const,
      message: 'Province is required',
      path: ['provinceId'],
    });
  }
  if (!hasWard) {
    ctx.addIssue({
      code: 'custom' as const,
      message: 'Ward is required',
      path: ['wardId'],
    });
  }
  if (!hasStreet) {
    ctx.addIssue({
      code: 'custom' as const,
      message: 'Street address is required',
      path: ['streetAddress'],
    });
  }
});
