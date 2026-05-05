import { z } from 'zod';

const optionalTrimmed = z.string().trim().nullable().optional();

export const updateMeSchema = z.object({
  name:          optionalTrimmed.max(100),
  phone:         optionalTrimmed.max(30),
  provinceId:    optionalTrimmed,
  districtId:    optionalTrimmed,
  wardId:        optionalTrimmed,
  streetAddress: optionalTrimmed.max(200),
  fullAddress:   optionalTrimmed.max(500),
}).superRefine((d, ctx) => {
  const hasProvince = Boolean(d.provinceId?.trim());
  const hasWard = Boolean(d.wardId?.trim());
  const hasStreet = Boolean(d.streetAddress?.trim());

  const anyDelivery = hasProvince || hasWard || hasStreet;
  if (!anyDelivery) return;

  if (!hasProvince) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Province is required', path: ['provinceId'] });
  }
  if (!hasWard) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ward is required', path: ['wardId'] });
  }
  if (!hasStreet) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Street address is required', path: ['streetAddress'] });
  }
});
